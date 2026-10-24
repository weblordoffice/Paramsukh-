import mongoose from 'mongoose';
import { Offer } from '../models/offer.models.js';
import Coupon from '../models/coupon.models.js';
import CouponUsage from '../models/couponUsage.models.js';
import { PurchaseDiscount } from '../models/purchaseDiscount.models.js';

export const PURCHASE_TYPES = ['shop', 'membership', 'event', 'counseling'];
const NON_SHOP_PURCHASE_TYPES = new Set(['membership', 'event', 'counseling']);

const normalize = (value) => String(value || '').trim().toLowerCase();

const toObjectId = (value) => {
  const id = String(value || '');
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
};

export const normalizePurchaseTypes = (value, fallback = ['shop']) => {
  const values = Array.isArray(value) ? value : fallback;
  const normalized = [...new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => normalize(item))
      .filter((item) => PURCHASE_TYPES.includes(item))
  )];
  return normalized.length > 0 ? normalized : ['shop'];
};

const purchaseTypeMatches = (rule, purchaseType) => {
  const types = normalizePurchaseTypes(rule?.purchaseTypes, []);
  if (types.length === 0) {
    return purchaseType === 'shop';
  }
  return types.includes(purchaseType);
};

const targetMatches = (rule, purchaseType, targetId) => {
  const id = String(targetId || '');
  if (!id) return false;

  if (purchaseType === 'membership') {
    const ids = (rule?.membershipPlanIds || []).map(String);
    return ids.length === 0 || ids.includes(id);
  }
  if (purchaseType === 'event') {
    const ids = (rule?.eventIds || []).map(String);
    return ids.length === 0 || ids.includes(id);
  }
  if (purchaseType === 'counseling') {
    const ids = (rule?.counselingServiceIds || []).map(String);
    return ids.length === 0 || ids.includes(id);
  }
  return false;
};

const calculateDiscount = (rule, amount) => {
  const baseAmount = Number(amount || 0);
  if (!rule || baseAmount <= 0) return 0;
  if (baseAmount < Number(rule.minOrderValue || 0)) return 0;

  let discount = 0;
  if (normalize(rule.discountType) === 'percentage') {
    discount = (baseAmount * Number(rule.discountValue || 0)) / 100;
    if (rule.maxDiscount && discount > Number(rule.maxDiscount)) {
      discount = Number(rule.maxDiscount);
    }
  } else {
    discount = Number(rule.discountValue || 0);
  }

  return Math.max(0, Math.round(Math.min(discount, baseAmount) * 100) / 100);
};

const activeWindowQuery = (now = new Date()) => ({
  isActive: true,
  startDate: { $lte: now },
  endDate: { $gte: now },
});

const ruleMatchesPurchase = (rule, purchaseType, targetId) =>
  purchaseTypeMatches(rule, purchaseType) && targetMatches(rule, purchaseType, targetId);

export const findBestOfferForPurchase = async ({ purchaseType, targetId, amount }) => {
  if (!NON_SHOP_PURCHASE_TYPES.has(purchaseType)) {
    return { offer: null, discount: 0 };
  }

  const offers = await Offer.find(activeWindowQuery())
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  let bestOffer = null;
  let bestDiscount = 0;

  for (const offer of offers) {
    if (!ruleMatchesPurchase(offer, purchaseType, targetId)) continue;
    const discount = calculateDiscount(offer, amount);
    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestOffer = offer;
    }
  }

  return { offer: bestOffer, discount: bestDiscount };
};

export const validateCouponForPurchase = async ({
  code,
  userId,
  purchaseType,
  targetId,
  amount,
}) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { coupon: null, discount: 0, error: null };
  }
  if (!NON_SHOP_PURCHASE_TYPES.has(purchaseType)) {
    return { coupon: null, discount: 0, error: 'Coupons are not supported for this purchase type' };
  }

  const coupon = await Coupon.findOne({
    code: normalizedCode,
    ...activeWindowQuery(),
  });

  if (!coupon) {
    return { coupon: null, discount: 0, error: 'Invalid or expired coupon code' };
  }
  if (!ruleMatchesPurchase(coupon, purchaseType, targetId)) {
    return { coupon: null, discount: 0, error: 'This coupon is not valid for this purchase' };
  }

  const baseAmount = Number(amount || 0);
  const discount = calculateDiscount(coupon, baseAmount);
  if (discount <= 0) {
    return {
      coupon: null,
      discount: 0,
      error: `This coupon requires a minimum purchase of ₹${Number(coupon.minOrderValue || 0)}`,
    };
  }

  const validity = await coupon.canUserUse(userId, baseAmount);
  if (!validity.valid) {
    return { coupon: null, discount: 0, error: validity.message };
  }

  return { coupon, discount, error: null };
};

/**
 * Resolve the discount for a non-shop purchase. Coupons explicitly entered by
 * the user take precedence over automatically applied offers.
 */
export const resolvePurchaseDiscount = async ({
  userId,
  purchaseType,
  targetId,
  amount,
  couponCode = '',
}) => {
  const baseAmount = Number(amount || 0);
  if (!NON_SHOP_PURCHASE_TYPES.has(purchaseType) || baseAmount <= 0) {
    return {
      baseAmount,
      discountAmount: 0,
      finalAmount: baseAmount,
      sourceType: 'none',
      coupon: null,
      offer: null,
      couponCode: null,
      offerTitle: null,
      error: null,
    };
  }

  if (String(couponCode || '').trim()) {
    const result = await validateCouponForPurchase({
      code: couponCode,
      userId,
      purchaseType,
      targetId,
      amount: baseAmount,
    });
    if (result.error) {
      return {
        baseAmount,
        discountAmount: 0,
        finalAmount: baseAmount,
        sourceType: 'none',
        coupon: null,
        offer: null,
        couponCode: null,
        offerTitle: null,
        error: result.error,
      };
    }
    return {
      baseAmount,
      discountAmount: result.discount,
      finalAmount: Math.max(0, baseAmount - result.discount),
      sourceType: 'coupon',
      coupon: result.coupon,
      offer: null,
      couponCode: result.coupon?.code || null,
      offerTitle: null,
      error: null,
    };
  }

  const best = await findBestOfferForPurchase({ purchaseType, targetId, amount: baseAmount });
  return {
    baseAmount,
    discountAmount: best.discount,
    finalAmount: Math.max(0, baseAmount - best.discount),
    sourceType: best.offer ? 'offer' : 'none',
    coupon: null,
    offer: best.offer,
    couponCode: null,
    offerTitle: best.offer?.title || null,
    error: null,
  };
};

export const createPurchaseDiscount = async ({
  userId,
  purchaseType,
  targetId,
  discount,
  providerOrderId = null,
  providerPaymentLinkId = null,
  referenceType = null,
  referenceId = null,
  metadata = {},
}) => {
  if (!discount || Number(discount.discountAmount || 0) <= 0) {
    return null;
  }

  return PurchaseDiscount.create({
    user: userId,
    purchaseType,
    targetId: toObjectId(targetId),
    baseAmount: Number(discount.baseAmount || 0),
    discountAmount: Number(discount.discountAmount || 0),
    finalAmount: Number(discount.finalAmount || 0),
    sourceType: discount.sourceType || 'none',
    coupon: discount.coupon?._id || null,
    offer: discount.offer?._id || null,
    couponCode: discount.couponCode || null,
    offerTitle: discount.offerTitle || null,
    providerOrderId: providerOrderId ? String(providerOrderId) : null,
    providerPaymentLinkId: providerPaymentLinkId ? String(providerPaymentLinkId) : null,
    referenceType,
    referenceId: toObjectId(referenceId),
    metadata,
  });
};

export const findPurchaseDiscount = async ({
  providerOrderId = null,
  providerPaymentLinkId = null,
  referenceType = null,
  referenceId = null,
} = {}) => {
  const query = [];
  if (providerOrderId) query.push({ providerOrderId: String(providerOrderId) });
  if (providerPaymentLinkId) query.push({ providerPaymentLinkId: String(providerPaymentLinkId) });
  if (referenceType && referenceId && mongoose.Types.ObjectId.isValid(String(referenceId))) {
    query.push({ referenceType, referenceId: toObjectId(referenceId) });
  }
  if (query.length === 0) return null;

  return PurchaseDiscount.findOne({ $or: query });
};

const recordCouponUsage = async (discountRecord) => {
  if (!discountRecord?.coupon) return;

  const referenceType = discountRecord.referenceType || discountRecord.purchaseType;
  const referenceId = discountRecord.referenceId
    || discountRecord.providerOrderId
    || discountRecord.providerPaymentLinkId;
  const validReferenceId = mongoose.Types.ObjectId.isValid(String(referenceId || ''))
    ? toObjectId(referenceId)
    : null;

  const result = await CouponUsage.updateOne(
    validReferenceId
      ? { coupon: discountRecord.coupon, referenceType, referenceId: validReferenceId }
      : {
          coupon: discountRecord.coupon,
          referenceType,
          providerOrderId: discountRecord.providerOrderId,
        },
    {
      $setOnInsert: {
        coupon: discountRecord.coupon,
        user: discountRecord.user,
        order: referenceType === 'order' ? validReferenceId : null,
        referenceType,
        referenceId: validReferenceId,
        discountAmount: Number(discountRecord.discountAmount || 0),
        usedAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    await Coupon.findByIdAndUpdate(discountRecord.coupon, {
      $inc: {
        currentUsageCount: 1,
        'stats.totalUsed': 1,
        'stats.totalDiscount': Number(discountRecord.discountAmount || 0),
      },
    });
  }
};

/**
 * Mark a pending discount as applied and record offer/coupon usage exactly once.
 */
export const applyPurchaseDiscount = async ({
  providerOrderId = null,
  providerPaymentLinkId = null,
  referenceType = null,
  referenceId = null,
} = {}) => {
  const discount = await findPurchaseDiscount({
    providerOrderId,
    providerPaymentLinkId,
    referenceType,
    referenceId,
  });
  if (!discount) return null;
  if (discount.status !== 'pending') return discount;

  if (referenceType && referenceId && mongoose.Types.ObjectId.isValid(String(referenceId))) {
    discount.referenceType = referenceType;
    discount.referenceId = toObjectId(referenceId);
  }

  discount.status = 'applied';
  discount.appliedAt = new Date();
  await discount.save();

  if (discount.sourceType === 'coupon') {
    await recordCouponUsage(discount).catch((error) =>
      console.error('Coupon usage recording failed:', error.message)
    );
  }

  if (discount.sourceType === 'offer' && discount.offer) {
    await Offer.findByIdAndUpdate(discount.offer, {
      $inc: {
        'stats.timesApplied': 1,
        'stats.totalDiscount': Number(discount.discountAmount || 0),
      },
    }).catch((error) => console.error('Offer usage recording failed:', error.message));
  }

  return discount;
};

const findDiscountForRevert = async ({
  providerOrderId = null,
  providerPaymentLinkId = null,
  referenceType = null,
  referenceId = null,
}) => {
  const query = [];
  if (providerOrderId) query.push({ providerOrderId: String(providerOrderId) });
  if (providerPaymentLinkId) query.push({ providerPaymentLinkId: String(providerPaymentLinkId) });
  if (referenceType && referenceId && mongoose.Types.ObjectId.isValid(String(referenceId))) {
    query.push({ referenceType, referenceId: toObjectId(referenceId) });
  }
  if (query.length === 0) return null;

  return PurchaseDiscount.findOne({
    $or: query,
    status: { $in: ['pending', 'applied'] },
  }).sort({ createdAt: -1 });
};

/**
 * Undo a discount: revoke coupon usage / offer stats exactly once and mark the
 * ledger row cancelled. Safe to call repeatedly.
 */
export const revertPurchaseDiscount = async ({
  providerOrderId = null,
  providerPaymentLinkId = null,
  referenceType = null,
  referenceId = null,
} = {}) => {
  const discount = await findDiscountForRevert({
    providerOrderId,
    providerPaymentLinkId,
    referenceType,
    referenceId,
  });
  if (!discount) return null;

  if (discount.status === 'applied' && discount.sourceType === 'coupon' && discount.coupon) {
    const usageReferenceType = discount.referenceType || discount.purchaseType;
    const usageReferenceId = discount.referenceId
      || (mongoose.Types.ObjectId.isValid(String(discount.providerOrderId || ''))
        ? toObjectId(discount.providerOrderId)
        : null);

    const usageQuery = usageReferenceId
      ? { coupon: discount.coupon, referenceType: usageReferenceType, referenceId: usageReferenceId }
      : { coupon: discount.coupon, referenceType: usageReferenceType, providerOrderId: discount.providerOrderId };

    const deletedUsage = await CouponUsage.findOneAndDelete(usageQuery);
    if (deletedUsage) {
      const discountAmount = Number(discount.discountAmount || 0);
      await Coupon.updateOne(
        { _id: discount.coupon },
        [{
          $set: {
            currentUsageCount: { $max: [0, { $subtract: [{ $ifNull: ['$currentUsageCount', 0] }, 1] }] },
            'stats.totalUsed': { $max: [0, { $subtract: [{ $ifNull: ['$stats.totalUsed', 0] }, 1] }] },
            'stats.totalDiscount': { $max: [0, { $subtract: [{ $ifNull: ['$stats.totalDiscount', 0] }, discountAmount] }] },
          },
        }]
      );
    }
  }

  if (discount.status === 'applied' && discount.sourceType === 'offer' && discount.offer) {
    const discountAmount = Number(discount.discountAmount || 0);
    await Offer.updateOne(
      { _id: discount.offer },
      [{
        $set: {
          'stats.timesApplied': { $max: [0, { $subtract: [{ $ifNull: ['$stats.timesApplied', 0] }, 1] }] },
          'stats.totalDiscount': { $max: [0, { $subtract: [{ $ifNull: ['$stats.totalDiscount', 0] }, discountAmount] }] },
        },
      }]
    ).catch((error) => console.error('Offer revert failed:', error.message));
  }

  discount.status = 'cancelled';
  await discount.save();
  return discount;
};

export const cancelPurchaseDiscount = revertPurchaseDiscount;
