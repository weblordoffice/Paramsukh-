import mongoose from 'mongoose';
import Coupon from '../../models/coupon.models.js';
import { normalizePurchaseTypes } from '../../services/purchaseDiscount.service.js';
import { notifyCouponRecipients } from '../../services/couponNotification.service.js';

const normalizeIds = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
};

const normalizeTargetIds = (value) => {
  const ids = normalizeIds(value);
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
};

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
      purchaseTypes,
      applicableOn,
      categories,
      products,
      shops,
      membershipPlanIds,
      eventIds,
      counselingServiceIds,
      maxUsageCount,
      maxUsagePerUser,
      applicableUsers,
      startDate,
      endDate,
      isActive
    } = req.body;

    const normalizedPurchaseTypes = normalizePurchaseTypes(purchaseTypes, ['shop']);
    const normalizedApplicableOn = applicableOn || 'all';
    const normalizedApplicableUsers = normalizeTargetIds(applicableUsers);

    if (normalizedApplicableUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one user'
      });
    }

    if (normalizedPurchaseTypes.includes('shop')) {
      if (normalizedApplicableOn === 'category' && (!Array.isArray(categories) || categories.length === 0)) {
        return res.status(400).json({ success: false, message: 'Select at least one category' });
      }
      if (normalizedApplicableOn === 'product' && (!Array.isArray(products) || products.length === 0)) {
        return res.status(400).json({ success: false, message: 'Select at least one product' });
      }
      if (normalizedApplicableOn === 'shop' && (!Array.isArray(shops) || shops.length === 0)) {
        return res.status(400).json({ success: false, message: 'Select at least one shop' });
      }
    }

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
      purchaseTypes: normalizedPurchaseTypes,
      applicableOn: normalizedApplicableOn,
      categories: normalizedPurchaseTypes.includes('shop') ? (categories || []) : [],
      products: normalizedPurchaseTypes.includes('shop') ? (products || []) : [],
      shops: normalizedPurchaseTypes.includes('shop') ? (shops || []) : [],
      membershipPlanIds: normalizedPurchaseTypes.includes('membership')
        ? normalizeTargetIds(membershipPlanIds)
        : [],
      eventIds: normalizedPurchaseTypes.includes('event') ? normalizeTargetIds(eventIds) : [],
      counselingServiceIds: normalizedPurchaseTypes.includes('counseling')
        ? normalizeTargetIds(counselingServiceIds)
        : [],
      maxUsageCount,
      maxUsagePerUser: maxUsagePerUser !== undefined ? maxUsagePerUser : 1,
      userRestriction: 'specific',
      applicableUsers: normalizedApplicableUsers,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true
    });

    await coupon.save();

    let notified = 0;
    try {
      ({ notified } = await notifyCouponRecipients(coupon));
    } catch (notificationError) {
      console.error('Coupon notification failed:', notificationError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon,
      notified
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
    const coupons = await Coupon.find()
      .populate('categories', 'name')
      .populate('products', 'name')
      .populate('shops', 'name')
      .sort({ createdAt: -1 });
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

    if (updates.purchaseTypes !== undefined) {
      updates.purchaseTypes = normalizePurchaseTypes(updates.purchaseTypes, ['shop']);
    }
    if (updates.membershipPlanIds !== undefined) {
      updates.membershipPlanIds = normalizeTargetIds(updates.membershipPlanIds);
    }
    if (updates.eventIds !== undefined) {
      updates.eventIds = normalizeTargetIds(updates.eventIds);
    }
    if (updates.counselingServiceIds !== undefined) {
      updates.counselingServiceIds = normalizeTargetIds(updates.counselingServiceIds);
    }

    delete updates.notifiedUsers;

    if (updates.applicableUsers !== undefined) {
      updates.applicableUsers = normalizeTargetIds(updates.applicableUsers);
      if (updates.applicableUsers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Select at least one user'
        });
      }
      updates.userRestriction = 'specific';
      // Re-assigned users should be notified again if they are added back later.
      await Coupon.updateOne(
        { _id: id },
        { $pull: { notifiedUsers: { $nin: updates.applicableUsers } } }
      );
    } else {
      delete updates.userRestriction;
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    let notified = 0;
    try {
      ({ notified } = await notifyCouponRecipients(coupon));
    } catch (notificationError) {
      console.error('Coupon notification failed:', notificationError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon,
      notified
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
