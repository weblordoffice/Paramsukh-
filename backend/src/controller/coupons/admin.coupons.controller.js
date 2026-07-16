import Coupon from '../../models/coupon.models.js';

/**
 * Create a new coupon campaign
 */
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue,
      applicableOn,
      categories,
      products,
      shops,
      maxUsageCount,
      maxUsagePerUser,
      userRestriction,
      applicableUsers,
      startDate,
      endDate,
      isActive
    } = req.body;

    if (!code || !description || !discountType || discountValue === undefined || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: code, description, discountType, discountValue, startDate, endDate'
      });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue: minOrderValue || 0,
      applicableOn: applicableOn || 'all',
      categories: categories || [],
      products: products || [],
      shops: shops || [],
      maxUsageCount,
      maxUsagePerUser: maxUsagePerUser !== undefined ? maxUsagePerUser : 1,
      userRestriction: userRestriction || 'all',
      applicableUsers: applicableUsers || [],
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true
    });

    await coupon.save();

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error('Create Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error creating coupon',
      error: error.message
    });
  }
};

/**
 * Get list of all coupons
 */
export const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      coupons
    });
  } catch (error) {
    console.error('Get All Coupons Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching coupons',
      error: error.message
    });
  }
};

/**
 * Get details of a single coupon
 */
export const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id)
      .populate('categories', 'name')
      .populate('products', 'name')
      .populate('shops', 'name');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    return res.status(200).json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Get Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching coupon details',
      error: error.message
    });
  }
};

/**
 * Update an existing coupon campaign config
 */
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.code) {
      updates.code = updates.code.toUpperCase();
      const existing = await Coupon.findOne({ code: updates.code, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Coupon code already exists'
        });
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error('Update Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error updating coupon',
      error: error.message
    });
  }
};

/**
 * Delete a coupon from database
 */
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete Coupon Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error deleting coupon',
      error: error.message
    });
  }
};
