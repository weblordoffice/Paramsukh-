import Shop from '../../models/shop.models.js';
import Product from '../../models/product.models.js';
import Review from '../../models/review.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { escapeRegex } from '../../utils/sanitizeUtils.js';

// @desc    Register new shop
// @route   POST /api/shops/register
// @access  Private
export const registerShop = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name, slug, description, logo, banner, email, phone,
      address, categories, businessType, gstNumber, panNumber
    } = req.body;

    // Check if user already has a shop
    const existingShop = await Shop.findOne({ owner: userId });
    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: 'You already have a registered shop'
      });
    }

    // Create shop
    const shop = new Shop({
      owner: userId,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      description,
      logo,
      banner,
      email,
      phone,
      address,
      categories,
      businessType,
      gstNumber,
      panNumber,
      status: 'pending'
    });

    await shop.save();

    // Send notification
    await sendNotification(userId, {
      type: 'system',
      title: 'Shop Registration Received',
      message: 'Your shop registration is under review. You will be notified once approved.',
      icon: '🏪',
      priority: 'high'
    });

    res.status(201).json({
      success: true,
      message: 'Shop registration submitted successfully',
      data: { shop }
    });
  } catch (error) {
    console.error('Register Shop Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register shop',
      error: error.message
    });
  }
};

// @desc    Get all shops
// @route   GET /api/shops
// @access  Public
export const getAllShops = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      rating,
      featured,
      sort = '-rating.average'
    } = req.query;

    const query = { status: 'approved' };

    // Apply filters
    if (category) query.categories = category;
    if (featured === 'true') query.isFeatured = true;
    if (rating) query['rating.average'] = { $gte: parseFloat(rating) };
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const shops = await Shop.find(query)
      .populate('categories', 'name slug icon')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Shop.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        shops,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get All Shops Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shops',
      error: error.message
    });
  }
};

// @desc    Get shop by ID
// @route   GET /api/shops/:id
// @access  Public
export const getShopById = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id)
      .populate('categories', 'name slug icon')
      .populate('owner', 'displayName email');

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { shop }
    });
  } catch (error) {
    console.error('Get Shop Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shop',
      error: error.message
    });
  }
};

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private (Shop Owner)
export const updateShop = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Check ownership
    if (shop.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this shop'
      });
    }

    // Update fields
    const allowedUpdates = [
      'name', 'description', 'logo', 'banner', 'email', 'phone',
      'whatsapp', 'address', 'categories', 'timings', 'socialMedia', 'policies'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        shop[field] = req.body[field];
      }
    });

    await shop.save();

    res.status(200).json({
      success: true,
      message: 'Shop updated successfully',
      data: { shop }
    });
  } catch (error) {
    console.error('Update Shop Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update shop',
      error: error.message
    });
  }
};

// @desc    Get shop products
// @route   GET /api/shops/:id/products
// @access  Public
export const getShopProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const products = await Product.find({ shop: id, isActive: true })
      .populate('category', 'name slug')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments({ shop: id, isActive: true });

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
    console.error('Get Shop Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error.message
    });
  }
};

// @desc    Get shop reviews
// @route   GET /api/shops/:id/reviews
// @access  Public
export const getShopReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ shop: id, isVisible: true })
      .populate('user', 'displayName photoURL')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Review.countDocuments({ shop: id, isVisible: true });

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
    console.error('Get Shop Reviews Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews',
      error: error.message
    });
  }
};

// @desc    Add shop review
// @route   POST /api/shops/:id/review
// @access  Private
export const addShopReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { rating, title, comment, orderId } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating and comment are required'
      });
    }

    // Check if shop exists
    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Create review
    const review = new Review({
      user: userId,
      reviewType: 'shop',
      shop: id,
      rating,
      title,
      comment,
      order: orderId,
      isVerifiedPurchase: !!orderId
    });

    await review.save();

    // Update shop rating
    const reviews = await Review.find({ shop: id, isVisible: true });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    shop.rating.average = Math.round(avgRating * 10) / 10;
    shop.rating.count = reviews.length;
    await shop.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Add Shop Review Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
};
