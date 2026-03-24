import { Course, Assignment } from '../../models/course.models.js';

/**
 * Add an assignment (standalone or linked to a video)
 */
export const addAssignment = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, description, questions, order, isStandalone, videoId } = req.body;

        if (!courseId || !title || order === undefined) {
            return res.status(400).json({
                success: false,
                message: "Course ID, title, and order are required"
            });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        // Create new assignment
        const newAssignment = new Assignment({
            title,
            description: description || '',
            questions: questions || [],
            order,
            isStandalone: isStandalone !== undefined ? isStandalone : true
        });

        await newAssignment.save();

        if (newAssignment.isStandalone) {
            // Add to course-level assignments
            course.assignments.push(newAssignment._id);
        } else if (videoId) {
            // Add to a specific video
            const video = course.videos.id(videoId);
            if (!video) {
                // If video not found, delete the orphan assignment and return error
                await Assignment.findByIdAndDelete(newAssignment._id);
                return res.status(404).json({
                    success: false,
                    message: "Video not found in this course"
                });
            }
            video.assignments.push(newAssignment._id);
        } else {
            // Not standalone but no videoId provided
            await Assignment.findByIdAndDelete(newAssignment._id);
            return res.status(400).json({
                success: false,
                message: "videoId is required for non-standalone assignments"
            });
        }

        await course.save();

        return res.status(201).json({
            success: true,
            message: "Assignment added successfully",
            assignment: newAssignment
        });
    } catch (error) {
        console.error("❌ Error in adding assignment:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get all assignments for a course (standalone)
 */
export const getCourseAssignments = async (req, res) => {
    try {
        const { courseId } = req.params;
        const course = await Course.findById(courseId).populate('assignments');

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        return res.status(200).json({
            success: true,
            assignments: course.assignments || []
        });
    } catch (error) {
        console.error("❌ Error in fetching assignments:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get assignments for a specific video
 */
export const getVideoAssignments = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;
        const course = await Course.findById(courseId).populate({
            path: 'videos.assignments',
            model: 'Assignment'
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const video = course.videos.id(videoId);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found"
            });
        }

        return res.status(200).json({
            success: true,
            assignments: video.assignments || []
        });
    } catch (error) {
        console.error("❌ Error in fetching video assignments:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Update an assignment
 */
export const updateAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const updates = req.body;

        const updatedAssignment = await Assignment.findByIdAndUpdate(
            assignmentId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedAssignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Assignment updated successfully",
            assignment: updatedAssignment
        });
    } catch (error) {
        console.error("❌ Error in updating assignment:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Delete an assignment
 */
export const deleteAssignment = async (req, res) => {
    try {
        const { courseId, assignmentId } = req.params;
        
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found"
            });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        // Remove reference from Course if standalone
        if (assignment.isStandalone) {
            course.assignments = course.assignments.filter(id => id.toString() !== assignmentId);
        } else {
            // Remove reference from all videos (just to be safe, though usually one)
            course.videos.forEach(video => {
                video.assignments = video.assignments.filter(id => id.toString() !== assignmentId);
            });
        }

        await course.save();
        await Assignment.findByIdAndDelete(assignmentId);

        return res.status(200).json({
            success: true,
            message: "Assignment deleted successfully"
        });
    } catch (error) {
        console.error("❌ Error in deleting assignment:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
