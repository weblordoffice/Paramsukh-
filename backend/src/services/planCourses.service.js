import mongoose from 'mongoose';
import { Course } from '../models/course.models.js';
import { CoursePlan } from '../models/coursePlan.models.js';

const normalizeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const COURSE_SELECT_FIELDS =
  'title description shortDescription thumbnailUrl bannerUrl icon color duration category tags totalVideos totalPdfs status';

const addMappedCourseIds = async (plan, slug, ids) => {
  const junctionMappings = await CoursePlan.find({ planId: plan._id }).lean();
  junctionMappings.forEach((m) => ids.add(String(m.courseId)));

  // Legacy: courses tagged with this plan's slug, or (older admin UI) its ObjectId.
  const legacyMatch = [slug, String(plan._id)].filter(Boolean);
  const legacyCourses = await Course.find({ includedInPlans: { $in: legacyMatch } })
    .select('_id')
    .lean();
  legacyCourses.forEach((c) => ids.add(String(c._id)));

  (plan.access?.includedCourseIds || []).forEach((id) => ids.add(String(id)));

  const includedCategories = (plan.access?.includedCategories || [])
    .map(normalizeSlug)
    .filter(Boolean);
  if (includedCategories.length > 0) {
    const catCourses = await Course.find({ category: { $in: includedCategories } })
      .select('_id')
      .lean();
    catCourses.forEach((c) => ids.add(String(c._id)));
  }
};

/**
 * Resolve the published course ids a plan grants access to, for BOTH credit-selection
 * plans (eligible menu) and entitlement plans (auto-included courses).
 */
export const resolvePlanCourseIds = async (plan) => {
  if (!plan) return [];

  const ids = new Set();
  const slug = normalizeSlug(plan.slug);
  const selection = plan.access?.courseSelection;

  if (selection?.enabled) {
    const mode = selection.eligibleCoursesMode || 'all_published';
    if (mode === 'specific') {
      (selection.eligibleCourseIds || []).forEach((id) => ids.add(String(id)));
    } else if (mode === 'categories') {
      const cats = (selection.eligibleCategories || []).map(normalizeSlug).filter(Boolean);
      if (cats.length > 0) {
        const courses = await Course.find({ category: { $in: cats } }).select('_id').lean();
        courses.forEach((c) => ids.add(String(c._id)));
      }
    } else {
      await addMappedCourseIds(plan, slug, ids);
    }
  } else {
    await addMappedCourseIds(plan, slug, ids);
  }

  const candidateIds = Array.from(ids).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (candidateIds.length === 0) return [];

  const published = await Course.find({ _id: { $in: candidateIds }, status: 'published' })
    .select('_id')
    .lean();

  return published.map((c) => String(c._id));
};

export const getPlanCourses = async (plan) => {
  const ids = await resolvePlanCourseIds(plan);
  if (ids.length === 0) return [];

  return Course.find({ _id: { $in: ids }, status: 'published' })
    .select(COURSE_SELECT_FIELDS)
    .sort({ title: 1 })
    .lean();
};
