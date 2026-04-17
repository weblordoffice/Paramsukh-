import { Course } from '../../models/course.models.js';
import { CoursePlan } from '../../models/coursePlan.models.js';
import { MembershipPlan } from '../../models/membershipPlan.models.js';
import mongoose from 'mongoose';

const normalizePlanIdentifier = (value) => String(value || '').trim();
const normalizeText = (value) => String(value || '').trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isObjectIdLike = (value) => {
    const normalized = normalizePlanIdentifier(value);
    return normalized.length === 24 && mongoose.Types.ObjectId.isValid(normalized);
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
        const { title, description, color, icon, thumbnailUrl, bannerUrl, duration, category, tags, status, includedInPlans } = req.body;

        // validate the request body
        if (!title || !description || !color || !icon || !thumbnailUrl || !bannerUrl || !duration || !category || !tags || !status) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const normalizedTitle = normalizeText(title);
        const normalizedCategory = normalizeText(category).toLowerCase();
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

        if (planSlugs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one membership plan is required'
            });
        }

        // creating a courses 
        const course = await Course.create({
            title: normalizedTitle,
            description: normalizeText(description),
            color,
            icon: normalizeText(icon),
            thumbnailUrl,
            bannerUrl,
            duration: normalizeText(duration),
            category: normalizedCategory,
            tags,
            status,
            includedInPlans: planSlugs
        });

        // Sync junction table
        await syncCoursePlans(course._id, planIds);

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
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required"
            })
        }

        // Clean up junction table
        await CoursePlan.deleteMany({ courseId: id });

        const course = await Course.findByIdAndDelete(id);
        // if course not found
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "courses not found"
            })
        }

        return res.status(200).json({
            success: true,
            message: "Course deleted successfully",
            course
        })
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
        const { title, description, color, icon, thumbnailUrl, bannerUrl, duration, category, tags, status, includedInPlans } = req.body;
        if (!title || !description || !color || !icon || !thumbnailUrl || !bannerUrl || !duration || !category || !tags || !status) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            })
        }

        const normalizedTitle = normalizeText(title);
        const normalizedCategory = normalizeText(category).toLowerCase();
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
            if (resolved.planSlugs.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one membership plan is required'
                });
            }
            planIds = resolved.planIds;
            planSlugs = resolved.planSlugs;
        }

        const updatePayload = {
            title: normalizedTitle,
            description: normalizeText(description),
            color,
            icon: normalizeText(icon),
            thumbnailUrl,
            bannerUrl,
            duration: normalizeText(duration),
            category: normalizedCategory,
            tags,
            status,
            ...(planSlugs !== null ? { includedInPlans: planSlugs } : {})
        };

        const course = await Course.findByIdAndUpdate(id, updatePayload, { new: true }).populate('assignments');
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "courses not found"
            })
        }

        // Sync junction table
        if (planIds !== null) {
            await syncCoursePlans(course._id, planIds);
        }

        return res.status(200).json({
            success: true,
            message: "Course updated successfully",
            course
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
        const courses = await Course.find()
            .select('title description thumbnailUrl bannerUrl color icon duration category tags status totalVideos totalPdfs enrollmentCount completionCount averageRating reviewCount includedInPlans createdAt')
            .sort({ createdAt: -1 });

        if (!courses || courses.length === 0) {
            return res.status(404).json({
                success: false,
                message: "courses not found"
            })
        }

        // Make sure to return includedInPlans for the UI to precheck the checkboxes.
        return res.status(200).json({
            success: true,
            message: "courses fetched successfully",
            courses
        })
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
        const course = await Course.findById(id).populate('assignments');
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Course fetched successfully",
            course
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
        const course = await Course.findOne({ slug });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Course fetched successfully",
            course
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
