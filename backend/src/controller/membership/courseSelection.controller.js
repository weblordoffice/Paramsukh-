import { getEligibleCourses, getSelectionStatus, selectCourse, undoCourseSelection } from '../../services/courseSelection.service.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { resolveMembershipPlanInheritanceBySlug } from '../../services/membershipPlan.service.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export const fetchActiveMembership = async (req, res) => {
  try {
    const userId = req.user._id;

    // A user may hold several active memberships at once (e.g. gold + silver + test-1).
    // Course access must consider ALL of them — never just the newest — otherwise buying
    // a new plan locks courses from the plans the user already owns.
    const memberships = await UserMembership.find({
      userId,
      status: 'active',
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null },
        { endDate: { $exists: false } },
      ],
    })
      .populate('planId', 'title slug access.courseSelection')
      .sort({ endDate: -1 })
      .lean();

    if (!memberships.length) {
      return res.status(200).json({
        success: true,
        hasActiveMembership: false,
      });
    }

    const selectedCourseIdSet = new Set();
    const entitlementPlanSlugs = new Set();
    const selectionPlanSlugs = new Set();
    const normalizedMemberships = [];

    for (const membership of memberships) {
      const plan = membership.planId;
      const selectionEnabled = plan?.access?.courseSelection?.enabled === true;
      const planSlug = normalize(plan?.slug);

      if (planSlug) {
        if (selectionEnabled) selectionPlanSlugs.add(planSlug);
        else entitlementPlanSlugs.add(planSlug);

        // Inherited (lower-tier) plans are granted as entitlements: buying a
        // higher plan unlocks all courses of the plans it includes. Their own
        // selection caps do not apply.
        try {
          const inheritance = await resolveMembershipPlanInheritanceBySlug(planSlug);
          for (const inherited of inheritance.plans || []) {
            const inheritedSlug = normalize(inherited.slug);
            if (!inheritedSlug || inheritedSlug === planSlug) continue;
            entitlementPlanSlugs.add(inheritedSlug);
          }
        } catch {
          // ignore inheritance resolution errors
        }
      }

      const selectedCourseIds = (membership.selectedCourseIds || []).map(String);
      selectedCourseIds.forEach((id) => selectedCourseIdSet.add(id));

      const maxSelectable = plan?.access?.courseSelection?.maxSelectableCourses || 0;
      const remaining = membership.selectedCourseCredits || 0;

      const entry = {
        membershipId: String(membership._id),
        planSlug: plan?.slug || null,
        planTitle: plan?.title || null,
        courseSelectionEnabled: selectionEnabled,
        maxSelectable,
        remaining,
        used: selectedCourseIds.length,
        selectedCourseIds,
        eligibleCourseIds: [],
      };

      // Only credit-selection plans expose an eligible pool to unlock from.
      if (selectionEnabled) {
        try {
          const eligible = await getEligibleCourses(userId, String(membership._id));
          const list = Array.isArray(eligible) ? eligible : (eligible?.eligible || []);
          entry.eligibleCourseIds = list.map((c) => String(c._id));
        } catch {
          entry.eligibleCourseIds = [];
        }
      }

      normalizedMemberships.push(entry);
    }

    const primary = normalizedMemberships[0];
    const primaryPlan = memberships[0].planId;

    return res.status(200).json({
      success: true,
      hasActiveMembership: true,
      // Backward-compatible "primary" (newest) fields
      membershipId: primary.membershipId,
      planTitle: primaryPlan?.title,
      planSlug: primaryPlan?.slug,
      courseSelection: {
        enabled: primary.courseSelectionEnabled,
        maxSelectable: primary.maxSelectable,
        remaining: primary.remaining,
        used: primary.used,
      },
      // Cumulative view across every active membership
      memberships: normalizedMemberships,
      selectedCourseIds: Array.from(selectedCourseIdSet),
      entitlementPlanSlugs: Array.from(entitlementPlanSlugs),
      selectionPlanSlugs: Array.from(selectionPlanSlugs),
    });
  } catch (error) {
    console.error('❌ Error fetching active membership:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const fetchEligibleCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    const { membershipId } = req.params;

    if (!membershipId) {
      return res.status(400).json({ success: false, message: 'membershipId is required' });
    }

    const result = await getEligibleCourses(userId, membershipId);
    if (result.reason) {
      return res.status(400).json({
        success: false,
        message: `Unable to fetch eligible courses: ${result.reason}`,
        reason: result.reason,
      });
    }

    return res.status(200).json({
      success: true,
      courses: result,
    });
  } catch (error) {
    console.error('❌ Error fetching eligible courses:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const fetchSelectionStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { membershipId } = req.params;

    if (!membershipId) {
      return res.status(400).json({ success: false, message: 'membershipId is required' });
    }

    const result = await getSelectionStatus(userId, membershipId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('❌ Error fetching selection status:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleSelectCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const { membershipId } = req.params;
    const { courseId } = req.body;

    if (!membershipId || !courseId) {
      return res.status(400).json({ success: false, message: 'membershipId and courseId are required' });
    }

    const ip = req.ip || req.connection?.remoteAddress || null;
    const result = await selectCourse({ userId, membershipId, courseId, ip });

    if (!result.success) {
      const statusCode = result.reason === 'no_credits' ? 422
        : result.reason === 'already_selected' ? 409
        : result.reason === 'course_not_eligible' ? 403
        : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error selecting course:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleUndoSelection = async (req, res) => {
  try {
    const userId = req.user._id;
    const { membershipId } = req.params;
    const { courseId } = req.body;

    if (!membershipId || !courseId) {
      return res.status(400).json({ success: false, message: 'membershipId and courseId are required' });
    }

    const ip = req.ip || req.connection?.remoteAddress || null;
    const result = await undoCourseSelection({ userId, membershipId, courseId, ip });

    if (!result.success) {
      const statusCode = result.reason === 'not_selected' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error undoing course selection:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
