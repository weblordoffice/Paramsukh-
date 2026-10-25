import { Course } from '../../models/course.models.js';
import { CoursePlan } from '../../models/coursePlan.models.js';
import { MembershipPlan } from '../../models/membershipPlan.models.js';
import mongoose from 'mongoose';

import { getAdminFromRequest, isValidAdminApiKey } from '../../middleware/adminAuth.js';
import { notifyNewCourse } from '../../services/notificationAutomation.service.js';
import { buildCourseViewerPayload } from '../../services/courseMedia.service.js';
import { evaluateCourseEnrollmentAccess } from '../../services/entitlement.service.js';

const normalizePlanIdentifier = (value) => String(value || '').trim();
const normalizeText = (value) => String(value || '').trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAdminRequest = async (req) => {
    if (isValidAdminApiKey(req)) return true;
    return Boolean(await getAdminFromRequest(req));
};
const slugify = (value) =>
    normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);

const resolveUniqueSlug = async (baseSlug, excludeId = null) => {
    const safeBase = slugify(baseSlug) || `course-${Date.now()}`;
    let candidate = safeBase;
    let attempt = 1;

    // Keep trying until we find an unused slug.
    // For updates, ignore the current course ID.
    while (true) {
        const existing = await Course.findOne({
            slug: candidate,
            ...(excludeId ? { _id: { $ne: excludeId } } : {})
        })
            .select('_id')
            .lean();

        if (!existing) return candidate;

        attempt += 1;
        candidate = `${safeBase}-${attempt}`;
    }
};

const isObjectIdLike = (value) => {
    const normalized = normalizePlanIdentifier(value);
    return normalized.length === 24 && mongoose.Types.ObjectId.isValid(normalized);
};

const viewerHasCourseEntitlement = async (req, course) => {
    if (!req.user?._id) return false;
    const decision = await evaluateCourseEnrollmentAccess({
        userId: req.user._id,
        course,
    }).catch(() => ({ allowed: false }));
    return Boolean(decision.allowed);
};

const resolveIncludedPlans = async (includedInPlans = []) => {
    const rawValues = Array.isArray(includedInPlans) ? includedInPlans : [];
    const normalizedValues = Array.from(
        new Set(rawValues.map(normalizePlanIdentifier).filter(Boolean))
    );

    if (normalizedValues.length === 0) {
        return { planIds: [], planSlugs: [], invalidValues: [] };
    }

    const objectIdValues = normalizedValues.filter(isObjectIdLike);
    const slugValues = normalizedValues
        .filter((value) => !isObjectIdLike(value))
        .map((value) => value.toLowerCase());

    const query = [];
    if (objectIdValues.length > 0) {
        query.push({ _id: { $in: objectIdValues } });
    }
    if (slugValues.length > 0) {
        query.push({ slug: { $in: slugValues } });
    }

    const plans = await MembershipPlan.find({ $or: query }).select('_id slug').lean();

    const planIds = Array.from(new Set(plans.map((plan) => String(plan._id))));
    const planSlugs = Array.from(
        new Set(plans.map((plan) => String(plan.slug || '').trim().toLowerCase()).filter(Boolean))
    );

    const foundById = new Set(plans.map((plan) => String(plan._id)));
    const foundBySlug = new Set(planSlugs);
    const invalidValues = normalizedValues.filter((value) => {
        if (isObjectIdLike(value)) {
            return !foundById.has(value);
        }
        return !foundBySlug.has(value.toLowerCase());
    });

    return { planIds, planSlugs, invalidValues };
};

const syncCoursePlans = async (courseId, newPlanIds) => {
    // Delete existing mappings for this course
    await CoursePlan.deleteMany({ courseId });
    
    // Create new mappings
    if (newPlanIds && newPlanIds.length > 0) {
        const mappings = newPlanIds.map(planId => ({ courseId, planId }));
        await CoursePlan.insertMany(mappings);
    }
};

export const createCourse = async (req, res) => {
    try {
        const { title, description, color, icon, thumbnailUrl, bannerUrl, duration, category, tags, status, includedInPlans, strictVideoOrder } = req.body;

        // validate the request body
        if (!title || !description || !duration || !category) {
            return res.status(400).json({
                success: false,
                message: "Title, description, duration, and category are required"
            });
        }

        const normalizedTitle = normalizeText(title);
        const normalizedCategory = normalizeText(category).toLowerCase();
        let slug = await resolveUniqueSlug(normalizedTitle);
        const existingCourse = await Course.findOne({
            title: { $regex: `^${escapeRegex(normalizedTitle)}$`, $options: 'i' },
            category: normalizedCategory,
        }).select('_id title').lean();

        if (existingCourse) {
            return res.status(409).json({
                success: false,
                message: 'A course with the same title already exists in this category'
            });
        }

        const { planIds, planSlugs, invalidValues } = await resolveIncludedPlans(includedInPlans || []);
        if (invalidValues.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid membership plan values: ${invalidValues.join(', ')}`
            });
        }

        // Retry on slug collision (concurrent requests)
        let course;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                course = await Course.create({
                    title: normalizedTitle,
                    description: normalizeText(description),
                    color: color || '#8B5CF6',
                    icon: normalizeText(icon || 'book'),
                    thumbnailUrl: thumbnailUrl || null,
                    bannerUrl: bannerUrl || null,
                    duration: normalizeText(duration),
                    category: normalizedCategory,
                    tags: tags || [],
                    status: status || 'draft',
                    slug,
                    includedInPlans: planSlugs,
                    strictVideoOrder: strictVideoOrder === true || strictVideoOrder === 'true'
                });
                break;
            } catch (err) {
                if (err.code === 11000 && attempt < 2) {
                    slug = await resolveUniqueSlug(slug + '-' + (attempt + 1));
                    continue;
                }
                throw err;
            }
        }

        // Sync junction table
        await syncCoursePlans(course._id, planIds);

        notifyNewCourse(course).catch((error) =>
            console.error('Course notification failed:', error?.message)
        );

        return res.status(201).json({
            success: true,
            message: "Course created successfully",
            course
        });

    } catch (error) {
        console.error("❌ Error in creating course:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

export const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(id))) {
            return res.status(400).json({ success: false, message: 'Invalid course id' });
        }

        const course = await Course.findById(id).select('_id assignments');
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const [
            { Enrollment },
            { AssessmentAttempt },
            { CourseActivitySubmission },
            { VivaApplication },
            { Certificate },
            { Assignment },
        ] = await Promise.all([
            import('../../models/enrollment.models.js'),
            import('../../models/assessmentAttempt.models.js'),
            import('../../models/courseActivitySubmission.models.js'),
            import('../../models/vivaApplication.models.js'),
            import('../../models/certificate.models.js'),
            import('../../models/course.models.js'),
        ]);

        const [enrollments, attempts, submissions, vivaApplications, certificates] = await Promise.all([
            Enrollment.countDocuments({ courseId: id }),
            AssessmentAttempt.countDocuments({ course: id }),
            CourseActivitySubmission.countDocuments({ courseId: id }),
            VivaApplication.countDocuments({ course: id }),
            Certificate.countDocuments({ course: id }),
        ]);

        const historyCount = enrollments + attempts + submissions + vivaApplications + certificates;
        if (historyCount > 0) {
            return res.status(409).json({
                success: false,
                message: 'This course has learner history. Archive it instead of deleting.',
                archiveRequired: true,
                history: { enrollments, attempts, submissions, vivaApplications, certificates },
            });
        }

        await Promise.all([
            CoursePlan.deleteMany({ courseId: id }),
            course.assignments?.length
                ? Assignment.deleteMany({ _id: { $in: course.assignments } })
                : Promise.resolve(),
        ]);

        await Course.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: 'Course deleted successfully',
        });
    } catch (error) {
        console.error("❌ Error in deleting course:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

export const updateCourse = async (req, res) => {
    try {
        // update course
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required"
            })
        }
        const { title, description, color, icon, thumbnailUrl, bannerUrl, duration, category, tags, status, includedInPlans, strictVideoOrder } = req.body;

        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const wasPublished = course.status === 'published';

        const normalizedTitle = title !== undefined ? normalizeText(title) : course.title;
        const normalizedCategory = category !== undefined ? normalizeText(category).toLowerCase() : course.category;
        
        let slug = course.slug;
        if (title !== undefined || category !== undefined) {
            slug = await resolveUniqueSlug(normalizedTitle, id);
        }

        const duplicateCourse = await Course.findOne({
            _id: { $ne: id },
            title: { $regex: `^${escapeRegex(normalizedTitle)}$`, $options: 'i' },
            category: normalizedCategory,
        }).select('_id').lean();

        if (duplicateCourse) {
            return res.status(409).json({
                success: false,
                message: 'Another course with the same title already exists in this category'
            });
        }

        let planIds = null;
        let planSlugs = null;
        if (includedInPlans !== undefined) {
            const resolved = await resolveIncludedPlans(includedInPlans);
            if (resolved.invalidValues.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid membership plan values: ${resolved.invalidValues.join(', ')}`
                });
            }
            planIds = resolved.planIds;
            planSlugs = resolved.planSlugs;
        }

        const updatePayload = {
            title: normalizedTitle,
            description: description !== undefined ? normalizeText(description) : course.description,
            color: color !== undefined ? color : course.color,
            icon: icon !== undefined ? normalizeText(icon) : course.icon,
            thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : course.thumbnailUrl,
            bannerUrl: bannerUrl !== undefined ? bannerUrl : course.bannerUrl,
            duration: duration !== undefined ? normalizeText(duration) : course.duration,
            category: normalizedCategory,
            tags: tags !== undefined ? tags : course.tags,
            slug,
            status: status !== undefined ? status : course.status,
            ...(status === 'published' && course.status !== 'published' ? { publishedAt: new Date() } : {}),
            strictVideoOrder: strictVideoOrder !== undefined ? (strictVideoOrder === true || strictVideoOrder === 'true') : course.strictVideoOrder,
            ...(planSlugs !== null ? { includedInPlans: planSlugs } : {})
        };

        const updatedCourse = await Course.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        ).populate('assignments');

        if (planIds !== null) {
            await syncCoursePlans(id, planIds);
        }

        if (!wasPublished && updatedCourse?.status === 'published') {
            notifyNewCourse(updatedCourse).catch((error) =>
                console.error('Course notification failed:', error?.message)
            );
        }

        return res.status(200).json({
            success: true,
            message: "Course updated successfully",
            course: updatedCourse
        })
    } catch (error) {
        console.error("❌ Error in updating course:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

export const getAllCourses = async (req, res) => {
    try {
        const adminView = await isAdminRequest(req);
        const query = adminView ? {} : { status: 'published' };

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        if (adminView && ['draft', 'published', 'archived'].includes(req.query.status)) {
            query.status = req.query.status;
        }
        if (req.query.category) {
            query.category = String(req.query.category).trim().toLowerCase();
        }
        if (req.query.search) {
            const escaped = escapeRegex(String(req.query.search).trim());
            query.$or = [
                { title: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } },
            ];
        }

        const sort = req.query.sort === 'oldest'
            ? { createdAt: 1 }
            : req.query.sort === 'title'
                ? { title: 1 }
                : { createdAt: -1 };

        const [courses, total] = await Promise.all([
            Course.find(query)
                .select('title description thumbnailUrl bannerUrl color icon duration category tags status totalVideos totalPdfs enrollmentCount completionCount averageRating reviewCount includedInPlans createdAt')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Course.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            message: 'courses fetched successfully',
            courses: courses || [],
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(1, Math.ceil(total / limit)),
            },
        });
    } catch (error) {
        console.error("❌ Error in fetching courses:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

export const getCourseById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required"
            })
        }
        const course = await Course.findById(id)
            .populate('assignments')
            .populate({ path: 'videos.assignments', model: 'Assignment' });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            })
        }
        const adminView = await isAdminRequest(req);
        if (!adminView && course.status !== 'published') {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }
        const entitled = adminView ? true : await viewerHasCourseEntitlement(req, course);
        return res.status(200).json({
            success: true,
            message: "Course fetched successfully",
            course: adminView ? course : await buildCourseViewerPayload(course, { entitled })
        })
    } catch (error) {
        console.error("❌ Error in fetching course by ID:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

export const getCourseBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Course slug is required"
            })
        }
        const course = await Course.findOne({ slug })
            .populate('assignments')
            .populate({ path: 'videos.assignments', model: 'Assignment' });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            })
        }
        const adminView = await isAdminRequest(req);
        if (!adminView && course.status !== 'published') {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }
        const entitled = adminView ? true : await viewerHasCourseEntitlement(req, course);
        return res.status(200).json({
            success: true,
            message: "Course fetched successfully",
            course: adminView ? course : await buildCourseViewerPayload(course, { entitled })
        })
    } catch (error) {
        console.error("❌ Error in fetching course by slug:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}
