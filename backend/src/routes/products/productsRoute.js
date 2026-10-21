import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  searchProducts,
  getProductsByCategory,
  getFeaturedProducts,
  addProductReview,
  getProductReviews
} from '../../controller/products/products.controller.js';
import {
  createProductAdmin,
  updateProductAdmin,
  deleteProductAdmin
} from '../../controller/products/admin.products.controller.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/featured', getFeaturedProducts);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/:id', getProductById);
router.get('/:id/reviews', getProductReviews);

// Admin routes (New Simplified APIs)
router.post('/admin/create', adminAuth, requirePermission('manage_shop'), createProductAdmin);
router.put('/admin/:id', adminAuth, requirePermission('manage_shop'), updateProductAdmin);
router.delete('/admin/:id', adminAuth, requirePermission('manage_shop'), deleteProductAdmin);

// Protected routes (Original Shop Owner APIs)
router.post('/create', protectedRoutes, createProduct);
router.put('/:id', protectedRoutes, updateProduct);
router.delete('/:id', protectedRoutes, deleteProduct);
router.post('/:id/review', protectedRoutes, addProductReview);

export default router;
