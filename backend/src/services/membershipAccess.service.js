import { MembershipPlan } from '../models/membershipPlan.models.js';
import { Course } from '../models/course.models.js';
import { CoursePlan } from '../models/coursePlan.models.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export const getAutoEnrollCoursesForPlan = async (planSlug) => {
  const slug = normalize(planSlug);
  if (!slug || slug === 'free') {
    return [];
  }

  const plan = await MembershipPlan.findOne({ slug }).lean();
  if (!plan) return [];

  // Recursively resolve all inherited plan IDs
  const resolvedPlanIds = new Set([plan._id.toString()]);
  const processInheritance = async (currentPlan) => {
    const inheritedIds = currentPlan?.access?.inheritedPlanIds || [];
    for (const id of inheritedIds) {
      const idStr = id.toString();
      if (!resolvedPlanIds.has(idStr)) {
        resolvedPlanIds.add(idStr);
        const parentPlan = await MembershipPlan.findById(id).lean();
        if (parentPlan) {
          await processInheritance(parentPlan);
        }
      }
    }
  };
  await processInheritance(plan);

  const allPlanIds = Array.from(resolvedPlanIds);
  const allPlansQuery = await MembershipPlan.find({ _id: { $in: allPlanIds } }).lean();

  const explicitCourseIdsSet = new Set();
  const legacySlugsSet = new Set();

  for (const p of allPlansQuery) {
    legacySlugsSet.add(normalize(p.slug));
  }

  // Include modern junction table courses for ALL inherited plans
  const mappedPlans = await CoursePlan.find({ planId: { $in: allPlanIds } }).lean();
  mappedPlans.forEach(mp => explicitCourseIdsSet.add(mp.courseId.toString()));

  const explicitCourseIds = Array.from(explicitCourseIdsSet).filter(Boolean);
  const legacySlugs = Array.from(legacySlugsSet).filter(Boolean);

  const queryConditions = [];
  if (explicitCourseIds.length > 0) {
    queryConditions.push({ _id: { $in: explicitCourseIds } });
  }
  if (legacySlugs.length > 0) {
    queryConditions.push({ includedInPlans: { $in: legacySlugs } });
  }

  if (queryConditions.length === 0) return [];

  return Course.find({
    $or: queryConditions,
    status: 'published'
  });
};
