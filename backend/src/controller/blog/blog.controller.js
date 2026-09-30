import Blog from '../../models/blog.models.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const buildMatch = (query) => {
    const match = { deletedAt: null };
    const { category, search } = query;

    if (category && category !== 'All') {
        match.category = category;
    }

    if (search && search.trim()) {
        const term = search.trim();
        match.$or = [
            { title: { $regex: term, $options: 'i' } },
            { content: { $regex: term, $options: 'i' } },
        ];
    }

    return match;
};

// Get all blogs (paginated, filterable, searchable)
export const getAllBlogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || DEFAULT_PAGE);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
        const skip = (page - 1) * limit;

        const match = buildMatch(req.query);

        const [blogs, total] = await Promise.all([
            Blog.find(match)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Blog.countDocuments(match),
        ]);

        res.status(200).json({
            success: true,
            count: blogs.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
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

// Get blog categories
export const getBlogCategories = async (_req, res) => {
    try {
        const categories = await Blog.distinct('category', { deletedAt: null });
        const sorted = categories.sort();
        res.status(200).json({
            success: true,
            data: { categories: ['All', ...sorted] },
        });
    } catch (error) {
        console.error('Get Blog Categories Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve categories',
            error: error.message,
        });
    }
};

// Get single blog details
export const getBlogDetails = async (req, res) => {
    try {
        const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null }).lean();

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
        const { title, content, excerpt, imageUrl, author, category, tags, readTime } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required',
            });
        }

        const blog = await Blog.create({
            title,
            content,
            excerpt: excerpt || content.replace(/<[^>]*>/g, '').slice(0, 200) + (content.length > 200 ? '...' : ''),
            imageUrl,
            author: author || 'Admin',
            category: category || 'Other',
            tags: tags || [],
            readTime: readTime || Math.max(1, Math.ceil(content.split(/\s+/).length / 200)),
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
        const { title, content, excerpt, imageUrl, author, category, tags, readTime } = req.body;

        const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        if (title !== undefined) blog.title = title;
        if (content !== undefined) {
            blog.content = content;
            if (!excerpt) {
                blog.excerpt = content.replace(/<[^>]*>/g, '').slice(0, 200) + (content.length > 200 ? '...' : '');
            }
            blog.readTime = readTime || Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
        }
        if (excerpt !== undefined) blog.excerpt = excerpt;
        if (imageUrl !== undefined) blog.imageUrl = imageUrl;
        if (author !== undefined) blog.author = author;
        if (category !== undefined) blog.category = category;
        if (tags !== undefined) blog.tags = tags;
        if (readTime !== undefined) blog.readTime = readTime;

        await blog.save();

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

// Soft-delete a blog (admin only)
export const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        blog.deletedAt = new Date();
        await blog.save();

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
