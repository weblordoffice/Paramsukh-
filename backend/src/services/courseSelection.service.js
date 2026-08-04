import mongoose from 'mongoose';
import { UserMembership } from '../models/userMembership.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { Course } from '../models/course.models.js';
import { CoursePlan } from '../models/coursePlan.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { MembershipSelectionLog } from '../models/membershipSelectionLog.models.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

let sessionProvider = null;
export const setCourseSelectionSessionProvider = (provider) => {
  sessionProvider = provider;
};

export const getEligibleCourses = async (userId, membershipId) => {
  const membership = await UserMembership.findOne({
    _id: membershipId,
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .populate('planId')
    .lean();

  if (!membership) {
    return { eligible: [], reason: 'membership_not_found' };
  }

  const plan = membership.planId;
  if (!plan?.access?.courseSelection?.enabled) {
    return { eligible: [], reason: 'selection_not_enabled' };
  }

  const selectionConfig = plan.access.courseSelection;
  const mode = selectionConfig.eligibleCoursesMode || 'all_published';
  const eligibleCategories = (selectionConfig.eligibleCategories || []).map(normalize);
  const eligibleCourseIds = (selectionConfig.eligibleCourseIds || []).map((id) => String(id));

  const baseFilter = { status: 'published' };

  if (mode === 'specific' && eligibleCourseIds.length > 0) {
    baseFilter._id = { $in: eligibleCourseIds };
  } else if (mode === 'categories' && eligibleCategories.length > 0) {
    baseFilter.category = { $in: eligibleCategories };
  }

  const selectedIds = membership.selectedCourseIds || [];
  const enrolledIds = await Enrollment.find({ userId })
    .select('courseId')
    .lean()
    .then((enrollments) => enrollments.map((e) => String(e.courseId)));

  const courses = await Course.find(baseFilter)
    .select('title description shortDescription thumbnailUrl bannerUrl icon color duration category tags totalVideos totalPdfs status')
    .sort({ title: 1 })
    .lean();

  const allSelectedOrEnrolled = new Set([
    ...selectedIds.map(String),
    ...enrolledIds,
  ]);

  return courses.map((course) => ({
    ...course,
    alreadySelected: allSelectedOrEnrolled.has(String(course._id)),
  }));
};

export const getSelectionStatus = async (userId, membershipId) => {
  const membership = await UserMembership.findOne({
    _id: membershipId,
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .populate('planId')
    .lean();

  if (!membership) {
    return { success: false, reason: 'membership_not_found' };
  }

  const plan = membership.planId;
  const selectionEnabled = plan?.access?.courseSelection?.enabled || false;
  const maxSelectable = plan?.access?.courseSelection?.maxSelectableCourses || 0;
  const remaining = membership.selectedCourseCredits || 0;
  const used = maxSelectable - remaining;
  const selectedCourseIds = (membership.selectedCourseIds || []).map(String);

  const selectedCourses = selectedCourseIds.length > 0
    ? await Course.find({ _id: { $in: selectedCourseIds } })
        .select('title description thumbnailUrl icon color duration category totalVideos totalPdfs')
        .lean()
    : [];

  return {
    success: true,
    selectionEnabled,
    maxSelectable,
    remaining,
    used,
    selectedCourses,
    selectedCourseIds,
  };
};

export const selectCourse = async ({ userId, membershipId, courseId, ip = null }) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return { success: false, reason: 'invalid_course_id', message: 'Invalid course ID' };
  }

  const membership = await UserMembership.findOne({
    _id: membershipId,
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .populate('planId')
    .lean();

  if (!membership) {
    return { success: false, reason: 'membership_not_found', message: 'Active membership not found' };
  }

  const plan = membership.planId;
  if (!plan?.access?.courseSelection?.enabled) {
    return { success: false, reason: 'selection_not_enabled', message: 'Course selection is not enabled for this plan' };
  }

  if ((membership.selectedCourseCredits || 0) <= 0) {
    return { success: false, reason: 'no_credits', message: 'No remaining course selection credits' };
  }

  const course = await Course.findById(courseId).lean();
  if (!course || course.status !== 'published') {
    return { success: false, reason: 'course_unavailable', message: 'Course not found or not published' };
  }

  const selectionConfig = plan.access.courseSelection;
  const mode = selectionConfig.eligibleCoursesMode || 'all_published';
  const eligibleCategories = (selectionConfig.eligibleCategories || []).map(normalize);
  const eligibleCourseIds = (selectionConfig.eligibleCourseIds || []).map(String);

  if (mode === 'specific' && eligibleCourseIds.length > 0 && !eligibleCourseIds.includes(String(course._id))) {
    return { success: false, reason: 'course_not_eligible', message: 'This course is not eligible for your plan' };
  }

  if (mode === 'categories' && eligibleCategories.length > 0 && !eligibleCategories.includes(normalize(course.category))) {
    return { success: false, reason: 'course_not_eligible', message: 'This course category is not eligible for your plan' };
  }

  const alreadySelected = (membership.selectedCourseIds || []).some((id) => String(id) === String(courseId));
  if (alreadySelected) {
    return { success: false, reason: 'already_selected', message: 'Course already selected' };
  }

  const alreadyEnrolled = await Enrollment.findOne({ userId, courseId: course._id }).lean();
  if (alreadyEnrolled) {
    return { success: false, reason: 'already_enrolled', message: 'Already enrolled in this course' };
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const updated = await UserMembership.findOneAndUpdate(
        {
          _id: membershipId,
          userId,
          status: 'active',
          selectedCourseCredits: { $gt: 0 },
          selectedCourseIds: { $ne: course._id },
        },
        {
          $inc: { selectedCourseCredits: -1 },
          $addToSet: { selectedCourseIds: course._id },
        },
        { new: true, session }
      );

      if (!updated) {
        throw new Error('CREDIT_CONSUME_FAILED');
      }

      const enrollment = await Enrollment.create([{
        userId,
        courseId: course._id,
        currentVideoId: course.videos?.[0]?._id || null,
      }], { session });

      await Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } }, { session });

      await MembershipSelectionLog.create([{
        userId,
        membershipId,
        courseId: course._id,
        action: 'select',
        creditsBefore: updated.selectedCourseCredits + 1,
        creditsAfter: updated.selectedCourseCredits,
        ip,
      }], { session });

      result = {
        success: true,
        reason: 'selected',
        course: { _id: course._id, title: course.title },
        remainingCredits: updated.selectedCourseCredits,
        enrollment: enrollment[0],
      };
    });

    return result;
  } catch (error) {
    if (error.message === 'CREDIT_CONSUME_FAILED') {
      return { success: false, reason: 'credit_consume_failed', message: 'Failed to consume credit. The course may already be selected or credits may be exhausted.' };
    }
    console.error('❌ Course selection error:', error);
    return { success: false, reason: 'transaction_failed', message: 'Selection failed. Please try again.' };
  } finally {
    await session.endSession();
  }
};

export const undoCourseSelection = async ({ userId, membershipId, courseId, ip = null }) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return { success: false, reason: 'invalid_course_id', message: 'Invalid course ID' };
  }

  const membership = await UserMembership.findOne({
    _id: membershipId,
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .populate('planId')
    .lean();

  if (!membership) {
    return { success: false, reason: 'membership_not_found', message: 'Active membership not found' };
  }

  const plan = membership.planId;
  const maxSelectable = plan?.access?.courseSelection?.maxSelectableCourses || 0;
  const isSelected = (membership.selectedCourseIds || []).some((id) => String(id) === String(courseId));
  if (!isSelected) {
    return { success: false, reason: 'not_selected', message: 'Course was not selected with membership credits' };
  }

  const currentCredits = membership.selectedCourseCredits || 0;
  if (currentCredits >= maxSelectable) {
    return { success: false, reason: 'credits_full', message: 'All credits are already available' };
  }

  const enrollment = await Enrollment.findOne({ userId, courseId }).lean();
  if (enrollment) {
    const watchedCount = (enrollment.completedVideos || []).length;
    const readCount = (enrollment.completedPdfs || []).length;
    if (watchedCount > 0 || readCount > 0) {
      return {
        success: false,
        reason: 'progress_made',
        message: `You've already watched ${watchedCount} video(s) and read ${readCount} PDF(s) in this course. Cannot swap after consuming content.`,
      };
    }
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const updated = await UserMembership.findOneAndUpdate(
        {
          _id: membershipId,
          userId,
          status: 'active',
          selectedCourseIds: course._id,
        },
        {
          $inc: { selectedCourseCredits: 1 },
          $pull: { selectedCourseIds: course._id },
        },
        { new: true, session }
      );

      if (!updated) {
        throw new Error('UNDO_FAILED');
      }

      await Enrollment.deleteOne({ userId, courseId: course._id }, { session });

      await Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: -1 } }, { session });

      await MembershipSelectionLog.create([{
        userId,
        membershipId,
        courseId: course._id,
        action: 'undo',
        creditsBefore: currentCredits,
        creditsAfter: updated.selectedCourseCredits,
        ip,
      }], { session });

      result = {
        success: true,
        reason: 'undone',
        course: { _id: course._id },
        remainingCredits: updated.selectedCourseCredits,
      };
    });

    return result;
  } catch (error) {
    if (error.message === 'UNDO_FAILED') {
      return { success: false, reason: 'undo_failed', message: 'Failed to undo course selection.' };
    }
    console.error('❌ Course undo error:', error);
    return { success: false, reason: 'transaction_failed', message: 'Undo failed. Please try again.' };
  } finally {
    await session.endSession();
  }
};
