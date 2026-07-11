import Blog from '../../models/blog.models.js';

// Get all blogs (newest first)
export const getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: blogs.length,
            data: { blogs },
        });
    } catch (error) {
        console.error('Get All Blogs Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve blogs',
            error: error.message,
        });
    }
};

// Get single blog details
export const getBlogDetails = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        res.status(200).json({
            success: true,
            data: { blog },
        });
    } catch (error) {
        console.error('Get Blog Details Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve blog details',
            error: error.message,
        });
    }
};

// Create a new blog (admin only)
export const createBlog = async (req, res) => {
    try {
        const { title, content, imageUrl, author } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required',
            });
        }

        const blog = await Blog.create({
            title,
            content,
            imageUrl,
            author: author || 'Admin',
        });

        res.status(201).json({
            success: true,
            data: { blog },
        });
    } catch (error) {
        console.error('Create Blog Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create blog',
            error: error.message,
        });
    }
};

// Update a blog (admin only)
export const updateBlog = async (req, res) => {
    try {
        const { title, content, imageUrl, author } = req.body;

        let blog = await Blog.findById(req.params.id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        blog = await Blog.findByIdAndUpdate(
            req.params.id,
            { title, content, imageUrl, author },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: { blog },
        });
    } catch (error) {
        console.error('Update Blog Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update blog',
            error: error.message,
        });
    }
};

// Delete a blog (admin only)
export const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        await Blog.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Blog deleted successfully',
        });
    } catch (error) {
        console.error('Delete Blog Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete blog',
            error: error.message,
        });
    }
};
