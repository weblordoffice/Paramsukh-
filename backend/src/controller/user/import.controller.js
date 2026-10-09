import mongoose from 'mongoose';
import { User } from '../../models/user.models.js';
import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { UserImportSession } from '../../models/userImportSession.models.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { syncUserCommunityMembershipsByPlan } from '../../services/planUpgrade.service.js';
import {
  parseAndValidateImportFile,
  normalizeImportMode,
  buildImportTemplateWorkbook,
  phoneKey,
  buildPhoneSearchRegex,
} from '../../services/userImport.service.js';

const normalizeText = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const getAdminIdentifier = (req) => {
  if (req.admin?._id) {
    return `admin:${String(req.admin._id)}`;
  }
  return 'api-key';
};

const resolveExistingUserId = async ({ phone, email }) => {
  const orConditions = [];
  const phoneRegex = phone ? buildPhoneSearchRegex(phone) : null;
  if (phoneRegex) {
    orConditions.push({ phone: phoneRegex });
  }
  if (email) {
    orConditions.push({ email });
  }

  if (!orConditions.length) {
    return { userId: null, ambiguous: false };
  }

  const users = await User.find({ $or: orConditions })
    .select('_id phone email')
    .lean();

  const phoneMatch = phone
    ? users.find((user) => phoneKey(user.phone) === phoneKey(phone))
    : null;

  const emailMatch = email
    ? users.find((user) => normalizeEmail(user.email) === email)
    : null;

  if (phoneMatch && emailMatch && String(phoneMatch._id) !== String(emailMatch._id)) {
    return { userId: null, ambiguous: true };
  }

  return {
    userId: phoneMatch ? String(phoneMatch._id) : (emailMatch ? String(emailMatch._id) : null),
    ambiguous: false,
  };
};

// Mongo transactions require a replica set / mongos. Detect once and cache.
let transactionSupportPromise = null;
const supportsTransactions = () => {
  if (!transactionSupportPromise) {
    transactionSupportPromise = (async () => {
      try {
        if (!mongoose.connection?.db) {
          return false;
        }
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        return Boolean(hello?.setName) || hello?.msg === 'isdbgrid';
      } catch {
        return false;
      }
    })();
  }
  return transactionSupportPromise;
};

// Runs `work(session)` atomically when the deployment supports transactions,
// otherwise falls back to running it without a session (sequential behavior).
const runRowTransaction = async (work) => {
  if (!(await supportsTransactions())) {
    return work(null);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Preview user bulk import file
 * POST /api/user/import/preview
 */
export const previewUserImport = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Spreadsheet file is required in field "file"',
      });
    }

    const parsed = await parseAndValidateImportFile({
      buffer: req.file.buffer,
      fileName: req.file.originalname || 'users-import.xlsx',
    });

    const rowsForSession = parsed.rows.map((row) => ({
      rowNumber: row.rowNumber,
      normalized: row.normalized,
      flags: row.flags,
      errors: row.errors,
      warnings: row.warnings,
      existingUserId: row.existingUserId,
      phoneMatchUserId: row.phoneMatchUserId,
      emailMatchUserId: row.emailMatchUserId,
      actionHint: row.actionHint,
    }));

    const session = await UserImportSession.create({
      adminIdentifier: getAdminIdentifier(req),
      fileName: req.file.originalname || 'users-import.xlsx',
      checksum: parsed.checksum,
      rows: rowsForSession,
      summary: parsed.summary,
    });

    const previousImport = await UserImportSession.findOne({
      checksum: parsed.checksum,
      status: 'committed',
    })
      .select('committedAt')
      .sort({ committedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Import preview generated successfully',
      data: {
        sessionId: String(session._id),
        checksum: parsed.checksum,
        recognizedHeaders: parsed.recognizedHeaders,
        summary: parsed.summary,
        rows: rowsForSession,
        expiresAt: session.expiresAt,
        previouslyImportedAt: previousImport?.committedAt || null,
      },
    });
  } catch (error) {
    console.error('❌ Error creating import preview:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to preview import file',
    });
  }
};

/**
 * Commit user bulk import
 * POST /api/user/import/commit
 */
export const commitUserImport = async (req, res) => {
  try {
    const { sessionId, mode, selectedRowNumbers } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    const importSession = await UserImportSession.findById(sessionId);
    if (!importSession) {
      return res.status(404).json({ success: false, message: 'Import session not found or expired' });
    }

    if (new Date(importSession.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({ success: false, message: 'Import session has expired. Please upload file again.' });
    }

    if (importSession.status === 'committed') {
      return res.status(409).json({ success: false, message: 'This import session is already committed' });
    }

    const selectedSet = new Set(
      (Array.isArray(selectedRowNumbers) ? selectedRowNumbers : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    );

    const candidateRows = importSession.rows.filter((row) => {
      if (selectedSet.size === 0) {
        return true;
      }
      return selectedSet.has(Number(row.rowNumber));
    });

    if (!candidateRows.length) {
      return res.status(400).json({ success: false, message: 'No rows selected for import' });
    }

    const importMode = normalizeImportMode(mode);

    const planSlugs = Array.from(
      new Set(
        candidateRows
          .map((row) => String(row?.normalized?.subscriptionPlan || '').toLowerCase())
          .filter((slug) => slug && slug !== 'free')
      )
    );

    const planMap = new Map();
    if (planSlugs.length > 0) {
      const plans = await MembershipPlan.find({ slug: { $in: planSlugs }, status: 'published' })
        .select('slug validityDays')
        .lean();
      plans.forEach((plan) => {
        planMap.set(String(plan.slug).toLowerCase(), plan);
      });
    }

    const results = [];
    const counters = {
      totalRows: candidateRows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const row of candidateRows) {
      const normalized = row.normalized || {};
      const rowResult = {
        rowNumber: row.rowNumber,
        displayName: normalized.displayName || '',
        phone: normalized.phone || '',
        email: normalized.email || '',
        subscriptionPlan: normalized.subscriptionPlan || '',
        status: 'failed',
        action: null,
        userId: null,
        errorCode: null,
        errorMessage: null,
        warning: null,
      };

      if (Array.isArray(row.errors) && row.errors.length > 0) {
        rowResult.status = 'skipped';
        rowResult.action = 'invalid';
        rowResult.errorCode = row.errors[0]?.code || 'INVALID_ROW';
        rowResult.errorMessage = row.errors.map((error) => error.message).join('; ');
        counters.skipped += 1;
        results.push(rowResult);
        continue;
      }

      const planSlug = String(normalized.subscriptionPlan || '').toLowerCase();
      if (planSlug !== 'free' && !planMap.has(planSlug)) {
        rowResult.status = 'failed';
        rowResult.errorCode = 'INVALID_SUBSCRIPTION_PLAN';
        rowResult.errorMessage = `subscriptionPlan '${planSlug}' is not published`;
        counters.failed += 1;
        results.push(rowResult);
        continue;
      }

      const flags = row.flags || {};
      const planProvided = flags.planProvided !== false;
      const statusProvided = flags.statusProvided === true;
      const isActiveProvided = flags.isActiveProvided === true;

      try {
        const existingLookup = await resolveExistingUserId({
          phone: normalized.phone,
          email: normalized.email,
        });

        if (existingLookup.ambiguous) {
          rowResult.status = 'failed';
          rowResult.errorCode = 'AMBIGUOUS_EXISTING_USER';
          rowResult.errorMessage = 'phone and email match different users';
          counters.failed += 1;
          results.push(rowResult);
          continue;
        }

        const existingUserId = existingLookup.userId;

        if (importMode === 'create_only' && existingUserId) {
          rowResult.status = 'skipped';
          rowResult.action = 'already_exists';
          rowResult.userId = existingUserId;
          rowResult.errorCode = 'USER_EXISTS';
          rowResult.errorMessage = 'row skipped because user already exists in create_only mode';
          counters.skipped += 1;
          results.push(rowResult);
          continue;
        }

        if (importMode === 'update_existing' && !existingUserId) {
          rowResult.status = 'skipped';
          rowResult.action = 'not_found';
          rowResult.errorCode = 'USER_NOT_FOUND';
          rowResult.errorMessage = 'row skipped because user does not exist in update_existing mode';
          counters.skipped += 1;
          results.push(rowResult);
          continue;
        }

        const shouldCreate = !existingUserId;

        const outcome = await runRowTransaction(async (session) => {
          let user;
          if (shouldCreate) {
            user = new User();
          } else {
            const findQuery = User.findById(existingUserId);
            if (session) {
              findQuery.session(session);
            }
            user = await findQuery;
          }

          if (!user) {
            return { missing: true };
          }

          user.displayName = normalized.displayName;
          user.phone = normalized.phone;
          user.email = normalized.email || undefined;
          user.tags = Array.isArray(normalized.tags) ? normalized.tags : [];

          // Only set authProvider on creation so we never flip a Google/Clerk user to phone auth.
          if (shouldCreate) {
            user.authProvider = 'phone';
          }

          // Never deactivate an existing user just because the isActive column was omitted.
          if (isActiveProvided || shouldCreate) {
            user.isActive = Boolean(normalized.isActive);
          }

          // A blank subscriptionPlan column must never downgrade an existing paid member.
          const shouldApplySubscription = shouldCreate || planProvided;
          const planChanged = !shouldCreate
            && String(user.subscriptionPlan || 'free').toLowerCase() !== planSlug;
          let membershipAction = 'unchanged';

          if (shouldApplySubscription) {
            const resolvedPlan = planSlug || 'free';
            let status;
            if (statusProvided) {
              status = String(normalized.subscriptionStatus || '').toLowerCase();
            } else if (resolvedPlan === 'free') {
              status = 'inactive';
            } else if (!shouldCreate && !planChanged) {
              status = String(user.subscriptionStatus || '').toLowerCase() || 'active';
            } else {
              status = 'active';
            }

            user.subscriptionPlan = resolvedPlan;
            user.subscriptionStatus = status;

            if (resolvedPlan === 'free') {
              user.subscriptionStartDate = null;
              user.subscriptionEndDate = null;
              user.trialEndsAt = null;
              membershipAction = 'revoke';
            } else if (status === 'active') {
              // Only (re)start the window when the plan actually changed or none exists yet,
              // so re-importing the same plan does not reset the membership period.
              if (planChanged || !user.subscriptionEndDate) {
                const validityDays = Number(planMap.get(resolvedPlan)?.validityDays || normalized.planValidityDays || 365);
                user.subscriptionStartDate = new Date();
                user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
              }
              user.trialEndsAt = null;
              membershipAction = 'grant';
            } else {
              user.subscriptionStartDate = null;
              user.subscriptionEndDate = null;
              user.trialEndsAt = null;
              membershipAction = 'revoke';
            }
          }

          await user.save({ session: session || undefined });

          if (membershipAction === 'grant') {
            await upsertActiveUserMembership({
              userId: user._id,
              planSlug: user.subscriptionPlan,
              startDate: user.subscriptionStartDate || new Date(),
              endDate: user.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              source: 'admin_grant',
              session,
              metadata: {
                sourceController: 'admin.commitUserImport',
                importSessionId: String(importSession._id),
                rowNumber: row.rowNumber,
              },
            });
          } else if (membershipAction === 'revoke') {
            await UserMembership.updateMany(
              { userId: user._id, status: 'active', endDate: { $gte: new Date() } },
              {
                $set: {
                  status: 'expired',
                  endDate: new Date(),
                  metadata: {
                    sourceController: 'admin.commitUserImport',
                    importSessionId: String(importSession._id),
                    rowNumber: row.rowNumber,
                    reason: 'membership_not_active',
                  },
                },
              },
              session ? { session } : undefined
            );
          }

          return {
            missing: false,
            userId: String(user._id),
            created: shouldCreate,
            subscriptionChanged: shouldApplySubscription,
            planSlug: String(user.subscriptionPlan || 'free').toLowerCase(),
            membershipActive: String(user.subscriptionStatus || '') === 'active',
          };
        });

        if (outcome.missing) {
          rowResult.status = 'failed';
          rowResult.errorCode = 'USER_NOT_FOUND';
          rowResult.errorMessage = 'user not found during update';
          counters.failed += 1;
          results.push(rowResult);
          continue;
        }

        // Derived side-effect: run best-effort AFTER the atomic write so a community
        // failure never reports an already-committed user as "failed".
        if (outcome.subscriptionChanged) {
          try {
            await syncUserCommunityMembershipsByPlan({
              userId: outcome.userId,
              planSlug: outcome.planSlug,
              membershipActive: outcome.membershipActive,
            });
          } catch (syncError) {
            console.error(`⚠️ Community sync failed for import row ${row.rowNumber}:`, syncError);
            rowResult.warning = 'community membership sync failed; user was imported';
          }
        }

        rowResult.status = 'success';
        rowResult.action = outcome.created ? 'created' : 'updated';
        rowResult.userId = outcome.userId;

        if (outcome.created) {
          counters.created += 1;
        } else {
          counters.updated += 1;
        }
      } catch (error) {
        console.error(`❌ Import row ${row.rowNumber} failed:`, error);
        rowResult.status = 'failed';
        rowResult.errorCode = error?.code === 11000 ? 'DUPLICATE_KEY' : 'ROW_PROCESSING_ERROR';
        rowResult.errorMessage = error?.code === 11000
          ? 'phone or email conflicts with an existing user'
          : (error.message || 'unknown processing error');
        counters.failed += 1;
      }

      results.push(rowResult);
    }

    importSession.status = 'committed';
    importSession.committedAt = new Date();
    importSession.summary = {
      ...(importSession.summary || {}),
      commit: counters,
      importMode,
    };
    await importSession.save();

    return res.status(200).json({
      success: true,
      message: 'User import committed',
      data: {
        sessionId: String(importSession._id),
        importMode,
        summary: counters,
        rows: results,
      },
    });
  } catch (error) {
    console.error('❌ Error committing user import:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to commit user import',
      error: error.message,
    });
  }
};

/**
 * Download user import template
 * GET /api/user/import/template
 */
export const getUserImportTemplate = async (req, res) => {
  try {
    const workbookBuffer = buildImportTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.xlsx"');
    return res.status(200).send(workbookBuffer);
  } catch (error) {
    console.error('❌ Error building import template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate import template',
      error: error.message,
    });
  }
};
