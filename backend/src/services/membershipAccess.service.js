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

  // Iterative BFS to resolve all inherited plan IDs (avoids stack overflow on deep chains)
  const resolvedPlanIds = new Set([plan._id.toString()]);
  const queue = [plan];
  while (queue.length > 0) {
    const current = queue.shift();
    const inheritedIds = current?.access?.inheritedPlanIds || [];
    for (const id of inheritedIds) {
      const idStr = String(id);
      if (!resolvedPlanIds.has(idStr)) {
        resolvedPlanIds.add(idStr);
        const parentPlan = await MembershipPlan.findById(id).lean();
        if (parentPlan) {
          queue.push(parentPlan);
        }
      }
    }
  }

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
