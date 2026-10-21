import { Offer } from '../../models/offer.models.js';
import { notifyNewOffer } from '../../services/notificationAutomation.service.js';

const ALLOWED_APPLICABLE_ON = new Set(['all', 'category', 'product', 'shop']);
const ALLOWED_DISCOUNT_TYPES = new Set(['percentage', 'flat']);

const normalizeIds = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
};

const validateOfferPayload = (body, existing = null) => {
  const title = body.title !== undefined ? String(body.title || '').trim() : existing?.title;
  const description = body.description !== undefined
    ? String(body.description || '').trim()
    : (existing?.description || '');
  const bannerImage = body.bannerImage !== undefined
    ? String(body.bannerImage || '').trim() || null
    : (existing?.bannerImage || null);
  const discountType = body.discountType !== undefined
    ? String(body.discountType || '').toLowerCase()
    : existing?.discountType;
  const discountValue = body.discountValue !== undefined
    ? Number(body.discountValue)
    : Number(existing?.discountValue);
  const maxDiscount = body.maxDiscount !== undefined && body.maxDiscount !== null && body.maxDiscount !== ''
    ? Number(body.maxDiscount)
    : (existing?.maxDiscount ?? null);
  const minOrderValue = body.minOrderValue !== undefined
    ? Number(body.minOrderValue)
    : Number(existing?.minOrderValue || 0);
  const applicableOn = body.applicableOn !== undefined
    ? String(body.applicableOn || '').toLowerCase()
    : (existing?.applicableOn || 'all');
  const startDate = body.startDate !== undefined ? new Date(body.startDate) : new Date(existing?.startDate);
  const endDate = body.endDate !== undefined ? new Date(body.endDate) : new Date(existing?.endDate);
  const priority = body.priority !== undefined ? Number(body.priority) : Number(existing?.priority || 0);
  const isActive = body.isActive !== undefined ? body.isActive === true : existing?.isActive !== false;

  if (!title || title.length < 3) return { error: 'Offer title must be at least 3 characters' };
  if (!ALLOWED_DISCOUNT_TYPES.has(discountType)) return { error: 'Invalid discount type' };
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: 'Discount value must be greater than 0' };
  if (discountType === 'percentage' && discountValue > 100) return { error: 'Percentage discount cannot exceed 100' };
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return { error: 'Invalid max discount' };
  if (!Number.isFinite(minOrderValue) || minOrderValue < 0) return { error: 'Invalid minimum order value' };
  if (!ALLOWED_APPLICABLE_ON.has(applicableOn)) return { error: 'Invalid applicability' };
  if (!startDate || Number.isNaN(startDate.getTime())) return { error: 'Valid start date is required' };
  if (!endDate || Number.isNaN(endDate.getTime())) return { error: 'Valid end date is required' };
  if (endDate < startDate) return { error: 'End date cannot be before start date' };
  if (!Number.isFinite(priority)) return { error: 'Invalid priority' };

  const categories = normalizeIds(body.categories !== undefined ? body.categories : existing?.categories);
  const products = normalizeIds(body.products !== undefined ? body.products : existing?.products);
  const shops = normalizeIds(body.shops !== undefined ? body.shops : existing?.shops);

  if (applicableOn === 'category' && categories.length === 0) return { error: 'Select at least one category' };
  if (applicableOn === 'product' && products.length === 0) return { error: 'Select at least one product' };
  if (applicableOn === 'shop' && shops.length === 0) return { error: 'Select at least one shop' };

  return {
    value: {
      title,
      description,
      bannerImage,
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue,
      applicableOn,
      categories: applicableOn === 'category' ? categories : [],
      products: applicableOn === 'product' ? products : [],
      shops: applicableOn === 'shop' ? shops : [],
      startDate,
      endDate,
      priority,
      isActive,
    },
  };
};

const populateOffer = (id) => Offer.findById(id)
  .populate('categories', 'name')
  .populate('products', 'name')
  .populate('shops', 'name')
  .lean();

/**
 * Public/authenticated list of currently active offers.
 * GET /api/offers
 */
export const listActiveOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate('categories', 'name')
      .populate('products', 'name')
      .populate('shops', 'name')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error('List Offers Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load offers',
      error: error.message,
    });
  }
};

/**
 * Admin: list all offers.
 */
export const getAllOffersAdmin = async (req, res) => {
  try {
    const offers = await Offer.find({})
      .populate('categories', 'name')
      .populate('products', 'name')
      .populate('shops', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error('List Admin Offers Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load offers',
      error: error.message,
    });
  }
};

/**
 * Admin: create offer.
 */
export const createOffer = async (req, res) => {
  try {
    const validated = validateOfferPayload(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const offer = await Offer.create(validated.value);
    const populated = await populateOffer(offer._id);

    notifyNewOffer(offer).catch((error) =>
      console.error('Offer notification failed:', error?.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      offer: populated,
    });
  } catch (error) {
    console.error('Create Offer Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create offer',
      error: error.message,
    });
  }
};

/**
 * Admin: update offer.
 */
export const updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const validated = validateOfferPayload(req.body, offer.toObject());
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    Object.assign(offer, validated.value);
    await offer.save();

    const populated = await populateOffer(offer._id);

    return res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      offer: populated,
    });
  } catch (error) {
    console.error('Update Offer Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update offer',
      error: error.message,
    });
  }
};

/**
 * Admin: delete offer.
 */
export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    return res.status(200).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete Offer Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete offer',
      error: error.message,
    });
  }
};
