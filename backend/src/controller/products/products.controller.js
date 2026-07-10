import Product from '../../models/product.models.js';
import Shop from '../../models/shop.models.js';
import Review from '../../models/review.models.js';
import Category from '../../models/category.models.js';
import mongoose from 'mongoose';

// @desc    Create product
// @route   POST /api/products/create
// @access  Private (Shop Owner)
export const createProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      shopId, name, slug, description, shortDescription, images,
      category, subcategory, pricing, inventory, specifications,
      variants, shipping, tags
    } = req.body;

    // Verify shop ownership
    const shop = await Shop.findOne({ _id: shopId, owner: userId });
    if (!shop) {
      return res.status(403).json({
        success: false,
        message: 'Shop not found or you are not authorized'
      });
    }

    const product = new Product({
      shop: shopId,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      description,
      shortDescription,
      images,
      category,
      subcategory,
      pricing,
      inventory,
      specifications,
      variants,
      shipping,
      tags
    });

    await product.save();

    // Update shop product count
    await shop.updateProductCount();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    console.error('Create Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      shop,
      search,
      minPrice,
      maxPrice,
      rating,
      inStock,
      featured,
      sort = '-createdAt'
    } = req.query;

    const query = { isActive: true };

    // Filters
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const foundCategory = await Category.findOne({
          $or: [
            { name: { $regex: new RegExp('^' + category + '$', 'i') } },
            { slug: category.toLowerCase() }
          ]
        });
        if (foundCategory) {
          query.category = foundCategory._id;
        } else {
          query.category = new mongoose.Types.ObjectId();
        }
      }
    }
    if (shop) query.shop = shop;
    if (featured === 'true') query.isFeatured = true;
    if (inStock === 'true') query.isOutOfStock = false;
    if (rating) query['rating.average'] = { $gte: parseFloat(rating) };
    
    if (minPrice || maxPrice) {
      query['pricing.sellingPrice'] = {};
      if (minPrice) query['pricing.sellingPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.sellingPrice'].$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$text = { $search: search };
    }

    const products = await Product.find(query)
      .populate('shop', 'name slug rating')
      .populate('category', 'name slug icon')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get All Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error.message
    });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('shop', 'name slug rating address phone email')
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    product.stats.views += 1;
    await product.save();

    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: error.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Shop Owner)
export const updateProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const product = await Product.findById(id).populate('shop');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check ownership
    if (product.shop.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    // Update fields
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        product[key] = updates[key];
      }
    });

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Shop Owner)
export const deleteProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const product = await Product.findById(id).populate('shop');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check ownership
    if (product.shop.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    await product.deleteOne();

    // Update shop product count
    const shop = await Shop.findById(product.shop._id);
    await shop.updateProductCount();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const products = await Product.find({
      $text: { $search: q },
      isActive: true
    })
      .populate('shop', 'name slug')
      .populate('category', 'name slug')
      .limit(limit * 1)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        products,
        count: products.length
      }
    });
  } catch (error) {
    console.error('Search Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:categoryId
// @access  Public
export const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const products = await Product.find({
      category: categoryId,
      isActive: true
    })
      .populate('shop', 'name slug rating')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments({ category: categoryId, isActive: true });

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get Products by Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error.message
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({
      isFeatured: true,
      isActive: true
    })
      .populate('shop', 'name slug')
      .populate('category', 'name slug')
      .limit(limit * 1)
      .lean();

    res.status(200).json({
      success: true,
      data: { products }
    });
  } catch (error) {
    console.error('Get Featured Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve featured products',
      error: error.message
    });
  }
};

// @desc    Add product review
// @route   POST /api/products/:id/review
// @access  Private
export const addProductReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { rating, title, comment, images, orderId } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const review = new Review({
      user: userId,
      reviewType: 'product',
      product: id,
      shop: product.shop,
      rating,
      title,
      comment,
      images,
      order: orderId,
      isVerifiedPurchase: !!orderId
    });

    await review.save();

    // Update product rating
    const reviews = await Review.find({ product: id, isVisible: true });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    product.rating.average = Math.round(avgRating * 10) / 10;
    product.rating.count = reviews.length;
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Add Product Review Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
};

// @desc    Get product reviews
// @route   GET /api/products/:id/reviews
// @access  Public
export const getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ product: id, isVisible: true })
      .populate('user', 'displayName photoURL')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Review.countDocuments({ product: id, isVisible: true });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get Product Reviews Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews',
      error: error.message
    });
  }
};
