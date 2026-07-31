import { getEligibleCourses, getSelectionStatus, selectCourse, undoCourseSelection } from '../../services/courseSelection.service.js';
import { UserMembership } from '../../models/userMembership.models.js';

export const fetchActiveMembership = async (req, res) => {
  try {
    const userId = req.user._id;

    const membership = await UserMembership.findOne({
      userId,
      status: 'active',
      endDate: { $gte: new Date() },
    })
      .populate('planId', 'title slug access.courseSelection')
      .sort({ endDate: -1 })
      .lean();

    if (!membership) {
      return res.status(200).json({
        success: true,
        hasActiveMembership: false,
      });
    }

    const plan = membership.planId;
    const cs = plan?.access?.courseSelection;

    return res.status(200).json({
      success: true,
      hasActiveMembership: true,
      membershipId: membership._id,
      planTitle: plan?.title,
      planSlug: plan?.slug,
      courseSelection: {
        enabled: cs?.enabled || false,
        maxSelectable: cs?.maxSelectableCourses || 0,
        remaining: membership.selectedCourseCredits || 0,
        used: (membership.selectedCourseIds || []).length,
      },
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
