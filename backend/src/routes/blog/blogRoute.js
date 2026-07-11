import express from 'express';
import {
    getAllBlogs,
    getBlogDetails,
    createBlog,
    updateBlog,
    deleteBlog
} from '../../controller/blog/blog.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/:id', getBlogDetails);

// Admin-only routes
router.post('/admin/create', adminAuth, createBlog);
router.put('/admin/:id', adminAuth, updateBlog);
router.delete('/admin/:id', adminAuth, deleteBlog);

export default router;
