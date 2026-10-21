import express from 'express';
import {
    getAllBlogs,
    getBlogCategories,
    getBlogDetails,
    createBlog,
    updateBlog,
    deleteBlog
} from '../../controller/blog/blog.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = express.Router();

// Public routes
router.get('/categories', getBlogCategories);
router.get('/', getAllBlogs);
router.get('/:id', getBlogDetails);

// Admin-only routes
router.post('/admin/create', adminAuth, requirePermission('manage_content'), createBlog);
router.put('/admin/:id', adminAuth, requirePermission('manage_content'), updateBlog);
router.delete('/admin/:id', adminAuth, requirePermission('manage_content'), deleteBlog);

export default router;
