import { Course } from '../../models/course.models.js';

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
            tags,
            status,
            includedInPlans: includedInPlans || []
        })

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

        const course = await Course.findByIdAndUpdate(id, { title, description, color, icon, thumbnailUrl, bannerUrl, duration, category, tags, status, includedInPlans }, { new: true });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "courses not found"
            })
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
        const course = await Course.findById(id);
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