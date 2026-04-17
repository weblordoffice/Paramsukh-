import { User } from '../../models/user.models.js';
import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { UserImportSession } from '../../models/userImportSession.models.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { syncUserCommunityMembershipsByPlan } from '../../services/planUpgrade.service.js';
import {
  parseAndValidateImportFile,
  normalizeImportMode,
  buildImportTemplateCsv,
} from '../../services/userImport.service.js';

const normalizeText = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizePhone = (value) => normalizeText(value).replace(/[\s-]/g, '');

const getAdminIdentifier = (req) => {
  if (req.admin?._id) {
    return `admin:${String(req.admin._id)}`;
  }
  return 'api-key';
};

const resolveExistingUserId = async ({ phone, email }) => {
  const orConditions = [];
  if (phone) {
    orConditions.push({ phone });
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
    ? users.find((user) => normalizePhone(user.phone) === phone)
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
        const user = shouldCreate ? new User() : await User.findById(existingUserId);

        if (!user) {
          rowResult.status = 'failed';
          rowResult.errorCode = 'USER_NOT_FOUND';
          rowResult.errorMessage = 'user not found during update';
          counters.failed += 1;
          results.push(rowResult);
          continue;
        }

        const resolvedPlan = planSlug || 'free';
        const statusRaw = String(normalized.subscriptionStatus || (resolvedPlan === 'free' ? 'inactive' : 'active')).toLowerCase();
        const status = statusRaw === 'trial' ? 'inactive' : statusRaw;

        user.displayName = normalized.displayName;
        user.phone = normalized.phone;
        user.email = normalized.email || undefined;
        user.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
        user.isActive = Boolean(normalized.isActive);
        user.subscriptionPlan = resolvedPlan;
        user.subscriptionStatus = status;
        user.authProvider = 'phone';

        if (resolvedPlan === 'free') {
          user.subscriptionStartDate = null;
          user.subscriptionEndDate = null;
          user.trialEndsAt = null;
        } else if (status === 'active') {
          const validityDays = Number(planMap.get(resolvedPlan)?.validityDays || normalized.planValidityDays || 365);
          user.subscriptionStartDate = new Date();
          user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
          user.trialEndsAt = null;
        } else {
          user.subscriptionStartDate = null;
          user.subscriptionEndDate = null;
          user.trialEndsAt = null;
        }

        await user.save();

        if (resolvedPlan !== 'free' && status === 'active') {
          await upsertActiveUserMembership({
            userId: user._id,
            planSlug: resolvedPlan,
            startDate: user.subscriptionStartDate || new Date(),
            endDate: user.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            source: 'admin_grant',
            metadata: {
              sourceController: 'admin.commitUserImport',
              importSessionId: String(importSession._id),
              rowNumber: row.rowNumber,
            },
          });
        } else {
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
            }
          );
        }

        await syncUserCommunityMembershipsByPlan({
          userId: user._id,
          planSlug: resolvedPlan,
          membershipActive: status === 'active',
        });

        rowResult.status = 'success';
        rowResult.action = shouldCreate ? 'created' : 'updated';
        rowResult.userId = String(user._id);

        if (shouldCreate) {
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
    const csv = buildImportTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('❌ Error building import template:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate import template',
      error: error.message,
    });
  }
};
