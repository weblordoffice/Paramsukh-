import { Course } from '../../models/course.models.js';
import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { CoursePlan } from '../../models/coursePlan.models.js';

const enforcePlanLimits = async (planIds, newCategory, courseIdToExclude = null) => {
    for (const planId of planIds) {
        const plan = await MembershipPlan.findById(planId);
        if (!plan) throw new Error(`Plan not found: ${planId}`);
        const limits = plan.access?.limits || {};

        // Find all junction mappings for this plan
        const mappings = await CoursePlan.find({ planId }).populate('courseId');
        
        // Filter out null courseIds (if a course was deleted without cleaning up) and the current course being edited
        let existingCourses = mappings
            .map(m => m.courseId)
            .filter(c => c && c._id.toString() !== String(courseIdToExclude));

        // Check maxCoursesTotal
        if (limits.maxCoursesTotal && existingCourses.length >= limits.maxCoursesTotal) {
            throw new Error(`Plan "${plan.title}" has reached its maximum course limit of ${limits.maxCoursesTotal}`);
        }

        // Check maxCategories
        if (limits.maxCategories) {
            const currentCategories = new Set(existingCourses.map(c => c.category).filter(Boolean));
            currentCategories.add(newCategory);
            if (currentCategories.size > limits.maxCategories) {
                throw new Error(`Plan "${plan.title}" allows only ${limits.maxCategories} unique categories. Adding category "${newCategory}" exceeds this limit.`);
            }
        }

        // Check perCategoryCourseLimit
        if (limits.perCategoryCourseLimit) {
            const categoryCount = existingCourses.filter(c => c.category === newCategory).length;
            if (categoryCount >= limits.perCategoryCourseLimit) {
                 throw new Error(`Plan "${plan.title}" allows maximum ${limits.perCategoryCourseLimit} courses per category. Category "${newCategory}" limit reached.`);
            }
        }
    }
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

        // Enforce limits before creation
        if (includedInPlans && includedInPlans.length > 0) {
            try {
                await enforcePlanLimits(includedInPlans, category);
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
        }

        // creating a courses 
        const course = await Course.create({
            title,
            description,
            color,
            icon,
            thumbnailUrl,
            bannerUrl,
            duration,
            category,
            tags,
            status,
            includedInPlans: includedInPlans || []
        });

        // Sync junction table
        await syncCoursePlans(course._id, includedInPlans || []);

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

        // Enforce limits before updating
        if (includedInPlans) {
            try {
                await enforcePlanLimits(includedInPlans, category, id);
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
        }

        const course = await Course.findByIdAndUpdate(id, { title, description, color, icon, thumbnailUrl, bannerUrl, duration, category, tags, status, includedInPlans }, { new: true }).populate('assignments');
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "courses not found"
            })
        }

        // Sync junction table
        if (includedInPlans) {
            await syncCoursePlans(course._id, includedInPlans);
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