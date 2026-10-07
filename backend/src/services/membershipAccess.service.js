import { MembershipPlan } from '../models/membershipPlan.models.js';
import { Course } from '../models/course.models.js';
import { CoursePlan } from '../models/coursePlan.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { resolvePlanCourseIds } from './planCourses.service.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

/**
 * Resolve the full inheritance closure of a plan (the plan itself plus all
 * transitively included plans).
 */
const resolvePlanClosure = async (rootPlan) => {
  const closurePlans = [rootPlan];
  const seen = new Set([String(rootPlan._id)]);
  const queue = [rootPlan];

  while (queue.length > 0) {
    const current = queue.shift();
    const inheritedIds = current?.access?.inheritedPlanIds || [];
    for (const id of inheritedIds) {
      const idStr = String(id);
      if (seen.has(idStr)) continue;
      seen.add(idStr);
      const parentPlan = await MembershipPlan.findById(id).lean();
      if (parentPlan) {
        closurePlans.push(parentPlan);
        queue.push(parentPlan);
      }
    }
  }

  return closurePlans;
};

/**
 * Courses granted to a buyer of `planSlug` by every plan it INHERITS (all lower
 * tiers), excluding the purchased plan's own courses. Used so that a capped
 * higher plan still grants the full lower-hierarchy catalog.
 */
export const getInheritedCoursesForPlan = async (planSlug) => {
  const slug = normalize(planSlug);
  if (!slug || slug === 'free') {
    return [];
  }

  const rootPlan = await MembershipPlan.findOne({ slug }).lean();
  if (!rootPlan) {
    return [];
  }

  const closurePlans = await resolvePlanClosure(rootPlan);
  const inheritedPlans = closurePlans.filter((p) => String(p._id) !== String(rootPlan._id));
  if (inheritedPlans.length === 0) {
    return [];
  }

  const idSet = new Set();
  for (const plan of inheritedPlans) {
    const courseIds = await resolvePlanCourseIds(plan);
    courseIds.forEach((id) => idSet.add(String(id)));
  }

  if (idSet.size === 0) {
    return [];
  }

  return Course.find({ _id: { $in: Array.from(idSet) }, status: 'published' });
};

/**
 * Idempotently enroll a user in the given courses and keep enrollmentCount in sync.
 * Returns the number of new enrollments created.
 */
export const autoEnrollUserInCourses = async (userId, courses = []) => {
  let enrolled = 0;
  for (const course of courses) {
    const existing = await Enrollment.findOne({ userId, courseId: course._id });
    if (!existing) {
      await Enrollment.create({
        userId,
        courseId: course._id,
        currentVideoId: course.videos?.length > 0 ? course.videos[0]._id : null,
      });
      await Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } });
      enrolled += 1;
    }
  }
  return enrolled;
};

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
