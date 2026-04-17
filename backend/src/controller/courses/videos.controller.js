import { Course } from '../../models/course.models.js';

// Helper function to parse duration string to seconds
function parseDurationToSeconds(duration) {
    if (duration === null || duration === undefined) return 0;

    if (typeof duration === 'number') {
        // Treat plain numeric value as minutes.
        return Number.isFinite(duration) && duration > 0
            ? Math.round(duration * 60)
            : 0;
    }

    const text = String(duration).trim();
    if (!text) return 0;

    // Format: "15:30" or "20:00"
    const parts = text.split(':');
    if (parts.length === 2) {
        const mins = Number(parts[0]);
        const secs = Number(parts[1]);
        if (Number.isFinite(mins) && Number.isFinite(secs)) {
            return (mins * 60) + secs;
        }
    }

    // Fallback: treat string number as minutes.
    const numericMinutes = Number(text);
    if (Number.isFinite(numericMinutes) && numericMinutes > 0) {
        return Math.round(numericMinutes * 60);
    }

    return 0;
}

export const addVideoToCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required"
            });
        }

        const { title, description, duration, videoUrl, thumbnailUrl, order, isFree } = req.body;
        const normalizedDuration = typeof duration === 'string' ? duration.trim() : duration;
        const durationInSeconds = parseDurationToSeconds(normalizedDuration);

        // Only validate truly required fields
        if (!title || !videoUrl || order === undefined) {
            return res.status(400).json({
                success: false,
                message: "Title, videoUrl, and order are required"
            });
        }

        if (!normalizedDuration || durationInSeconds <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid duration is required"
            });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        course.videos.push({
            title,
            description: description || '',
            duration: normalizedDuration,
            durationInSeconds,
            videoUrl,
            thumbnailUrl: thumbnailUrl || null,
            order,
            isFree: isFree || false
        });

        await course.save();
        return res.status(201).json({
            success: true,
            message: "Video added to course successfully",
            video: course.videos[course.videos.length - 1]
        });
    } catch (error) {
        console.error("❌ Error in adding video to course:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export const getCourseVideos = async(req ,res) =>{
    try{
        const {courseId} = req.params;
        if(!courseId){
            return res.status(400).json({
                success: false,
                message:"course Id is required"
            })
        }
        const course  = await Course.findById(courseId).select('videos');

        if(!course || !course.videos || course.videos.length === 0){
            return res.status(404).json({
                success: false,
                message:"No videos found for this course"
            })
        }
        return res.status(200).json({             
            success: true,
            message:"videos fetched successfully",
            videos: course.videos
        })                       
    }catch(error){  
        console.error("❌ Error in fetching course videos:", error);
        return res.status(500).json({
            success: false,
            message:"Internal server error",
            error: error.message
        })
    }
}

export const getVideoById = async(req ,res) =>{
    try{
        const {courseId , videoId} = req.params;
        if(!courseId || !videoId){
            return res.status(400).json({
                success: false,          
                message:"course Id and video Id are required"
            })
        }

        const course  =  await Course.findById(courseId);
        if(!course){
            return res.status(404).json({
                success: false,
                message:"Course not found"
            })
        }

        const video =  course.videos.id(videoId);
        if(!video){
            return res.status(404).json({
                success: false,
                message:"Video not found"
            })
        }
        return res.status(200).json({
            success: true,
            message:"Video fetched successfully",
            video
        })
    }catch(error){
        console.error("❌ Error in fetching video by ID:", error);
        return res.status(500).json({
            success: false,
            message:"Internal server error",
            error: error.message
        })
    }
}


export const updateVideo = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;
        if (!courseId || !videoId) {
            return res.status(400).json({
                success: false,
                message: "Course ID and video ID are required"
            });
        }

        const updateData = req.body;
        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Update data is required"
            });
        }

        const course = await Course.findById(courseId);
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

        // update the video fields (only when provided)
        if (updateData.title !== undefined) video.title = updateData.title;
        if (updateData.description !== undefined) video.description = updateData.description;
        if (updateData.duration !== undefined) {
            video.duration = updateData.duration;
            video.durationInSeconds = parseDurationToSeconds(updateData.duration);
        }
        if (updateData.videoUrl !== undefined) video.videoUrl = updateData.videoUrl;
        if (updateData.thumbnailUrl !== undefined) video.thumbnailUrl = updateData.thumbnailUrl;
        if (updateData.order !== undefined) video.order = updateData.order;
        if (updateData.isFree !== undefined) video.isFree = updateData.isFree;

        await course.save();
        return res.status(200).json({
            success: true,
            message: "Video updated successfully",
            video
        });

    } catch (error) {
        console.error("❌ Error in updating video:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


export const deleteVideo = async (req, res) =>{
    try{
        const {courseId , videoId} = req.params;
        if(!courseId || !videoId){
            return res.status(400).json({
                success: false,
                message:"course Id and video Id are required"
            })
        }

        const course  = await Course.findById(courseId);
        if(!course){
            return res.status(404).json({
                success: false,
                message:"Course not found"
            })
        }

        const video = course.videos.id(videoId);
        if(!video){
            return res.status(404).json({
                success: false,
                message:"Video not found"
            })
        }
        
        course.videos.pull(videoId);
        await course.save();
        
        return res.status(200).json({
            success: true,
            message:"Video deleted successfully"
        })
    }catch(error){
        console.error("❌ Error in deleting video:", error);
        return res.status(500).json({
            success: false,
            message:"Internal server error",
            error: error.message
        })
    }
}

