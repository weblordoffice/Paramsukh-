import { 
  createRazorpayOrder, 
  createRazorpayPaymentLink,
  fetchPaymentLink,
  listPaymentLinks,
  verifyRazorpaySignature,
  fetchPaymentDetails,
  createRefund,
  isTestMode,
  verifyWebhookSignature
} from '../../services/razorpayService.js';
import { User } from '../../models/user.models.js';
import Booking from '../../models/booking.models.js';
import Order from '../../models/order.models.js';
import { Course } from '../../models/course.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { resolveMembershipPlanChargeAmount } from '../../services/membershipPlan.service.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { handlePlanUpgrade } from '../../services/planUpgrade.service.js';
import { getAutoEnrollCoursesForPlan } from '../../services/membershipAccess.service.js';
import { AdminPaymentLink } from '../../models/adminPaymentLink.models.js';

const MAX_ADMIN_LINK_EXPIRY_HOURS = 24 * 30;

const normalizePhoneForRazorpay = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) {
    return undefined;
  }

  return raw.replace(/^\+91/, '').replace(/\s+/g, '').trim() || undefined;
};

const resolveMembershipValidityDays = ({ notes = {}, planConfig = null } = {}) => {
  const fromNotes = Number(notes?.validityDays);
  if (Number.isFinite(fromNotes) && fromNotes > 0) {
    return fromNotes;
  }

  return Number(planConfig?.plan?.validityDays || 365);
};

const upsertUserPaymentEntry = ({ user, orderId, paymentId, amount, plan, metadata = {} }) => {
  user.payments = user.payments || [];

  const alreadyRecorded = user.payments.some(
    (entry) => entry.orderId === orderId || entry.paymentId === paymentId
  );
  if (alreadyRecorded) {
    return false;
  }

  user.payments.push({
    orderId,
    paymentId,
    amount,
    plan,
    status: 'completed',
    date: new Date(),
    metadata,
  });

  return true;
};

const resolveTargetUserForAdminLink = async ({ targetUserId, targetEmail, targetPhone }) => {
  if (targetUserId) {
    const byId = await User.findById(targetUserId);
    if (byId) {
      return byId;
    }
  }

  if (targetEmail) {
    const byEmail = await User.findOne({ email: String(targetEmail).trim().toLowerCase() });
    if (byEmail) {
      return byEmail;
    }
  }

  if (targetPhone) {
    const normalizedInput = String(targetPhone).trim();
    const variants = Array.from(
      new Set([
        normalizedInput,
        normalizedInput.replace(/\s+/g, ''),
        normalizedInput.replace(/^\+91/, ''),
        `+91${normalizedInput.replace(/^\+91/, '')}`,
      ])
    ).filter(Boolean);

    const byPhone = await User.findOne({ phone: { $in: variants } });
    if (byPhone) {
      return byPhone;
    }
  }

  return null;
};

/**
 * Create Razorpay payment link for counseling booking (hosted checkout)
 * POST /api/payments/booking-link
 */
export const createBookingPaymentLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }
    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.isFree) {
      return res.status(400).json({ success: false, message: 'Free booking does not require payment' });
    }
    const amount = Number(booking.amount) || 0;
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking amount' });
    }
    const user = await User.findById(userId).select('email phone displayName name');
    const customer = {
      name: user?.displayName || user?.name || 'Customer',
      email: user?.email || undefined,
      contact: user?.phone ? String(user.phone).replace('+91', '').trim() : undefined,
    };
    const link = await createRazorpayPaymentLink({
      amount,
      currency: 'INR',
      description: `Counseling booking · ${booking.bookingTitle || 'Session'}`,
      customer,
      notes: { type: 'counseling', bookingId: String(bookingId), userId: String(userId) },
    });
    return res.status(200).json({
      success: true,
      data: { url: link.short_url, paymentLinkId: link.id },
    });
  } catch (error) {
    console.error('❌ Create booking link error:', error);
    return res.status(500).json({ success: false, message: error.message, error: error.message });
  }
};

/**
 * Confirm counseling booking payment link and mark booking paid
 * POST /api/payments/booking-link/confirm
 */
export const confirmBookingPaymentLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentLinkId, bookingId } = req.body;
    if (!paymentLinkId || !bookingId) {
      return res.status(400).json({ success: false, message: 'paymentLinkId and bookingId are required' });
    }
    const link = await fetchPaymentLink(paymentLinkId);
    const status = String(link?.status || '').toLowerCase();
    const notes = link?.notes || {};
    if (notes?.userId && String(notes.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Payment link does not belong to you' });
    }
    if (notes?.bookingId && String(notes.bookingId) !== String(bookingId)) {
      return res.status(400).json({ success: false, message: 'Payment link does not match this booking' });
    }
    if (status !== 'paid' && status !== 'captured') {
      return res.status(200).json({ success: true, data: { status: link?.status }, message: 'Payment not completed yet' });
    }
    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const paymentsRaw = link?.payments;
    const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
    const paymentId = firstPayment?.payment_id || link?.payment_id;
    booking.paymentId = paymentId || `pay_${Date.now()}`;
    booking.paymentMethod = 'razorpay';
    booking.paymentStatus = 'paid';
    booking.paidAt = new Date();
    booking.status = 'confirmed';
    await booking.save();
    try {
      await sendNotification(userId, {
        type: 'system',
        title: 'Payment Confirmed',
        message: `Payment of ₹${booking.amount} received. Your counseling session is confirmed for ${booking.bookingDate?.toLocaleDateString?.() || 'the selected date'}`,
        icon: '✅',
        priority: 'high',
        relatedId: booking._id,
        relatedType: 'booking',
      });
    } catch (_) {}
    return res.status(200).json({
      success: true,
      message: 'Payment confirmed',
      data: { booking },
    });
  } catch (error) {
    console.error('❌ Confirm booking link error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create payment order for membership
 * POST /api/payments/create-order
 */
export const createMembershipOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan } = req.body;

    const planConfig = await resolveMembershipPlanChargeAmount(plan, req.body.amount);
    if (!planConfig.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership plan'
      });
    }

    const finalPlan = planConfig.slug;
    const amount = Number(planConfig.amount || 0);
    const validityDays = Number(planConfig.plan?.validityDays || 365);

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount,
      currency: planConfig.currency || 'INR',
      receipt: `membership_${userId}_${Date.now()}`,
      notes: {
        type: 'membership',
        plan: finalPlan,
        userId: userId.toString(),
        validityDays: String(validityDays),
      }
    });

    console.log(`✅ Payment order created for user ${userId}, plan: ${finalPlan}`);

    return res.status(200).json({
      success: true,
      message: 'Payment order created',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
        testMode: isTestMode()
      }
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
};

/**
 * Create Razorpay payment link for membership (hosted checkout)
 * POST /api/payments/membership-link
 */
export const createMembershipPaymentLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan } = req.body;

    const planConfig = await resolveMembershipPlanChargeAmount(plan, req.body.amount);
    if (!planConfig.isValid) {
      return res.status(400).json({ success: false, message: 'Invalid membership plan' });
    }

    const finalPlan = planConfig.slug;
    const amount = Number(planConfig.amount || 0);
    const validityDays = Number(planConfig.plan?.validityDays || 365);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const user = await User.findById(userId).select('email phone displayName name');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const customer = {
      name: user.displayName || user.name || 'ParamSukh User',
      email: user.email || undefined,
      contact: user.phone ? String(user.phone).replace('+91', '').trim() : undefined,
    };

    const link = await createRazorpayPaymentLink({
      amount,
      currency: planConfig.currency || 'INR',
      description: `${String(finalPlan).toUpperCase()} Membership · ParamSukh`,
      customer,
      notes: {
        type: 'membership',
        plan: finalPlan,
        userId: userId.toString(),
        validityDays: String(validityDays),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment link created',
      data: {
        paymentLinkId: link.id,
        url: link.short_url,
        testMode: isTestMode(),
      },
    });
  } catch (error) {
    console.error('❌ Create payment link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment link',
      error: error.message
    });
  }
};

/**
 * Create Razorpay payment link for a target user (admin flow)
 * POST /api/payments/admin/membership-link
 */
export const createAdminMembershipPaymentLink = async (req, res) => {
  try {
    const {
      targetUserId,
      targetEmail,
      targetPhone,
      plan,
      amount,
      expiresInHours,
    } = req.body;

    if (!plan) {
      return res.status(400).json({ success: false, message: 'plan is required' });
    }

    if (!targetUserId && !targetEmail && !targetPhone) {
      return res.status(400).json({
        success: false,
        message: 'Provide one of targetUserId, targetEmail, or targetPhone',
      });
    }

    const targetUser = await resolveTargetUserForAdminLink({ targetUserId, targetEmail, targetPhone });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    const planConfig = await resolveMembershipPlanChargeAmount(plan, amount);
    if (!planConfig.isValid) {
      return res.status(400).json({ success: false, message: 'Invalid membership plan' });
    }

    const finalPlan = planConfig.slug;
    const finalAmount = Number(amount || planConfig.amount || 0);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const finalValidityDays = Number(planConfig.plan?.validityDays || 365);
    const expiryHours = Math.min(
      Math.max(Number(expiresInHours || 72), 1),
      MAX_ADMIN_LINK_EXPIRY_HOURS
    );
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const adminIdentifier = req.admin?._id
      ? String(req.admin._id)
      : 'api_key_admin';

    const customer = {
      name: targetUser.displayName || targetUser.name || 'ParamSukh User',
      email: targetUser.email || undefined,
      contact: normalizePhoneForRazorpay(targetUser.phone),
    };

    const trackingId = `admin_plink_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const link = await createRazorpayPaymentLink({
      amount: finalAmount,
      currency: planConfig.currency || 'INR',
      description: `${String(finalPlan).toUpperCase()} Membership · ParamSukh`,
      customer,
      notes: {
        type: 'membership',
        plan: finalPlan,
        userId: String(targetUser._id),
        adminCreated: 'true',
        adminId: adminIdentifier,
        trackingId,
        validityDays: String(finalValidityDays),
      },
    });

    await AdminPaymentLink.create({
      paymentLinkId: link.id,
      shortUrl: link.short_url,
      userId: targetUser._id,
      planSlug: finalPlan,
      amount: finalAmount,
      currency: planConfig.currency || 'INR',
      validityDays: finalValidityDays,
      status: 'created',
      adminId: req.admin?._id || null,
      adminIdentifier,
      expiresAt,
      metadata: {
        trackingId,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Admin membership payment link created',
      data: {
        paymentLinkId: link.id,
        url: link.short_url,
        trackingId,
        user: {
          _id: String(targetUser._id),
          displayName: targetUser.displayName || targetUser.name || 'User',
          email: targetUser.email || null,
          phone: targetUser.phone || null,
        },
        plan: finalPlan,
        amount: finalAmount,
        currency: planConfig.currency || 'INR',
        validityDays: finalValidityDays,
        expiresAt,
        testMode: isTestMode(),
      },
    });
  } catch (error) {
    console.error('❌ Create admin membership payment link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin membership payment link',
      error: error.message,
    });
  }
};

/**
 * List admin-created membership payment links
 * GET /api/payments/admin/membership-links
 */
export const getAdminMembershipPaymentLinks = async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 20 } = req.query;

    await AdminPaymentLink.updateMany(
      {
        status: 'created',
        expiresAt: { $lt: new Date() },
      },
      { $set: { status: 'expired' } }
    );

    const query = {};
    if (userId) {
      query.userId = userId;
    }
    if (status) {
      query.status = String(status).toLowerCase();
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      AdminPaymentLink.find(query)
        .populate('userId', 'displayName email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AdminPaymentLink.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        links: items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('❌ Get admin membership payment links error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin membership payment links',
      error: error.message,
    });
  }
};

/**
 * Confirm a membership payment link after redirect (fallback when webhooks don't reach local dev)
 * POST /api/payments/membership-link/confirm
 */
export const confirmMembershipPaymentLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentLinkId, plan } = req.body;

    const requestedPlanConfig = await resolveMembershipPlanChargeAmount(plan);
    if (!requestedPlanConfig.isValid) {
      return res.status(400).json({ success: false, message: 'Invalid membership plan' });
    }
    if (!paymentLinkId) {
      return res.status(400).json({ success: false, message: 'paymentLinkId is required' });
    }

    console.log(`📩 Confirm payment link: ${paymentLinkId}, plan: ${plan}, userId: ${userId}`);

    let link;
    try {
      link = await fetchPaymentLink(paymentLinkId);
    } catch (fetchErr) {
      console.error('❌ Fetch payment link failed:', fetchErr.message);
      return res.status(500).json({
        success: false,
        message: 'Could not verify payment with Razorpay. Is the link ID correct?',
        error: fetchErr.message
      });
    }

    const status = String(link?.status || '').toLowerCase();
    const notes = link?.notes || {};
    const isAdminCreated = String(notes?.adminCreated || '').toLowerCase() === 'true';
    const targetUserId = notes?.userId ? String(notes.userId) : String(userId);
    console.log(`   Razorpay link status: ${status}, notes.plan: ${notes?.plan}, notes.userId: ${notes?.userId}`);

    // Basic ownership check (if notes were set)
    if (!isAdminCreated && notes?.userId && String(notes.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Payment link does not belong to this user' });
    }

    const isPaid = status === 'paid' || status === 'captured';
    if (!isPaid) {
      return res.status(200).json({
        success: true,
        message: 'Payment not completed yet',
        data: { status: link?.status || 'unknown' }
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const finalPlan = String(notes?.plan || requestedPlanConfig.slug).toLowerCase();
    const finalPlanConfig = await resolveMembershipPlanChargeAmount(finalPlan);
    if (!finalPlanConfig.isValid) {
      return res.status(400).json({ success: false, message: 'Invalid membership plan' });
    }

    const validityDays = resolveMembershipValidityDays({ notes, planConfig: finalPlanConfig });

    user.subscriptionPlan = finalPlan;
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = new Date();
    user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    // Razorpay can return payments as array or single object
    const paymentsRaw = link?.payments;
    const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
    const paymentId = firstPayment?.payment_id || link?.payment_id || `pay_link_${Date.now()}`;
    const amountPaise = link?.amount ?? firstPayment?.amount ?? 0;

    upsertUserPaymentEntry({
      user,
      orderId: paymentLinkId,
      paymentId,
      amount: Number(amountPaise) / 100,
      plan: finalPlan,
      metadata: {
        sourceController: 'payments.confirmMembershipPaymentLink',
        adminCreated: isAdminCreated,
        trackingId: notes?.trackingId || null,
      },
    });

    await user.save();
    await upsertActiveUserMembership({
      userId: targetUserId,
      planSlug: finalPlan,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      source: 'purchase',
      payment: {
        provider: 'razorpay',
        orderId: paymentLinkId,
        paymentId,
        amount: Number(amountPaise) / 100,
        currency: 'INR',
      },
      metadata: {
        sourceController: 'payments.confirmMembershipPaymentLink',
        adminCreated: isAdminCreated,
        trackingId: notes?.trackingId || null,
      },
    });
    console.log(`✅ Membership activated for user ${targetUserId}: ${finalPlan}`);

    if (isAdminCreated) {
      await AdminPaymentLink.findOneAndUpdate(
        { paymentLinkId },
        {
          status: 'paid',
          paymentId,
          paidAt: new Date(),
        }
      );
    }

    // Enroll in courses for this plan (same as purchaseMembership)
    const courses = await getAutoEnrollCoursesForPlan(finalPlan);

    for (const course of courses) {
      const existingEnrollment = await Enrollment.findOne({ userId: targetUserId, courseId: course._id });
      if (!existingEnrollment) {
        await Enrollment.create({
          userId: targetUserId,
          courseId: course._id,
          currentVideoId: course.videos?.length > 0 ? course.videos[0]._id : null
        });
        course.enrollmentCount = (course.enrollmentCount || 0) + 1;
        await course.save();
      }
    }
    console.log(`   Enrolled in ${courses.length} course(s) for plan ${finalPlan}`);

    // Sync plan-category groups after enrollments are created.
    try {
      const upgradeResult = await handlePlanUpgrade(targetUserId, finalPlan);
      console.log(`⬆️ Plan-category sync: Enrolled in ${upgradeResult.enrolledInGroups} groups`);
    } catch (error) {
      console.error('⚠️ Plan-category sync failed (non-critical):', error.message);
      // Don't fail payment completion when community sync fails.
    }

    return res.status(200).json({
      success: true,
      message: 'Membership activated',
      data: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        paymentLinkStatus: link?.status
      }
    });
  } catch (error) {
    console.error('❌ Confirm payment link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
};

/**
 * Sync membership from Razorpay (find paid payment link for this user and activate)
 * POST /api/payments/sync-membership
 * Use when user paid but webhook + confirm didn't run (e.g. paid before app stored link)
 */
export const syncMembershipFromRazorpay = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const result = await listPaymentLinks({ count: 25 });
    const items = result?.items || result?.entity?.items || [];
    if (items.length === 0) {
      return res.status(200).json({ success: true, activated: false, message: 'No payment links found' });
    }

    for (const item of items) {
      if (String(item?.status).toLowerCase() !== 'paid') continue;
      let full;
      try {
        full = await fetchPaymentLink(item.id);
      } catch {
        continue;
      }
      const notes = full?.notes || {};
      if (String(notes.userId) !== String(userId)) continue;
      const orderId = full.id;
      if ((user.payments || []).some(p => p.orderId === orderId)) continue;

      const finalPlan = String(notes.plan || '').toLowerCase().trim();
      if (!finalPlan) continue;
      const finalPlanConfig = await resolveMembershipPlanChargeAmount(finalPlan);
      if (!finalPlanConfig.isValid) continue;

      const validityDays = resolveMembershipValidityDays({ notes, planConfig: finalPlanConfig });

      const paymentsRaw = full?.payments;
      const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
      const paymentId = firstPayment?.payment_id || full?.payment_id || `pay_${Date.now()}`;
      const amountPaise = full?.amount ?? firstPayment?.amount ?? 0;

      user.subscriptionPlan = finalPlan;
      user.subscriptionStatus = 'active';
      user.subscriptionStartDate = new Date();
      user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

      upsertUserPaymentEntry({
        user,
        orderId,
        paymentId,
        amount: Number(amountPaise) / 100,
        plan: finalPlan,
        metadata: {
          sourceController: 'payments.syncMembershipFromRazorpay',
          adminCreated: String(notes?.adminCreated || '').toLowerCase() === 'true',
          trackingId: notes?.trackingId || null,
        },
      });

      await user.save();
      await upsertActiveUserMembership({
        userId,
        planSlug: finalPlan,
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        source: 'purchase',
        payment: {
          provider: 'razorpay',
          orderId,
          paymentId,
          amount: Number(amountPaise) / 100,
          currency: 'INR',
        },
        metadata: {
          sourceController: 'payments.syncMembershipFromRazorpay',
          adminCreated: String(notes?.adminCreated || '').toLowerCase() === 'true',
          trackingId: notes?.trackingId || null,
        },
      });

      if (String(notes?.adminCreated || '').toLowerCase() === 'true') {
        await AdminPaymentLink.findOneAndUpdate(
          { paymentLinkId: orderId },
          {
            status: 'paid',
            paymentId,
            paidAt: new Date(),
          }
        );
      }

      const courses = await getAutoEnrollCoursesForPlan(finalPlan);
      for (const course of courses) {
        const existingEnrollment = await Enrollment.findOne({ userId, courseId: course._id });
        if (!existingEnrollment) {
          await Enrollment.create({
            userId,
            courseId: course._id,
            currentVideoId: course.videos?.length > 0 ? course.videos[0]._id : null
          });
          course.enrollmentCount = (course.enrollmentCount || 0) + 1;
          await course.save();
        }
      }
      await handlePlanUpgrade(userId, finalPlan);
      console.log(`✅ Sync: Membership activated for user ${userId}: ${finalPlan} (from payment link ${orderId})`);
      return res.status(200).json({
        success: true,
        activated: true,
        message: 'Membership activated',
        data: { plan: user.subscriptionPlan, status: user.subscriptionStatus }
      });
    }

    return res.status(200).json({ success: true, activated: false, message: 'No paid payment link found for you' });
  } catch (error) {
    console.error('❌ Sync membership error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync payment',
      error: error.message
    });
  }
};

/**
 * Verify payment and activate membership
 * POST /api/payments/verify-membership
 */
export const verifyMembershipPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      plan 
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !plan) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment details'
      });
    }

    const planConfig = await resolveMembershipPlanChargeAmount(plan);
    if (!planConfig.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership plan'
      });
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature || (isTestMode() ? 'test_signature' : '')
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Fetch payment details
    let paymentDetails;
    try {
      paymentDetails = await fetchPaymentDetails(razorpay_payment_id);
    } catch (error) {
      console.error('⚠️ Could not fetch payment details:', error.message);
      // Continue with mock data in test mode
      paymentDetails = { amount: 0, status: 'captured' };
    }

    // Update user membership
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Activate membership
    const validityDays = Number(planConfig.plan?.validityDays || 365);

    user.subscriptionPlan = planConfig.slug;
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = new Date();
    user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    // Store payment info
    user.payments = user.payments || [];
    user.payments.push({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: paymentDetails.amount / 100, // Convert from paise
      plan: planConfig.slug,
      status: 'completed',
      date: new Date()
    });

    await user.save();
    await upsertActiveUserMembership({
      userId,
      planSlug: planConfig.slug,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      source: 'purchase',
      payment: {
        provider: 'razorpay',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: paymentDetails.amount / 100,
        currency: 'INR',
      },
      metadata: { sourceController: 'payments.verifyMembershipPayment' },
    });

    console.log(`✅ Membership activated for user ${userId}: ${planConfig.slug}`);

    return res.status(200).json({
      success: true,
      message: `${planConfig.slug} membership activated successfully!`,
      data: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        validUntil: user.subscriptionEndDate,
        paymentId: razorpay_payment_id
      }
    });

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

/**
 * Create payment order for counseling booking
 * POST /api/payments/create-booking-order
 */
export const createBookingOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId, amount: requestedAmount } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.isFree) {
      return res.status(400).json({
        success: false,
        message: 'This booking does not require payment'
      });
    }

    const amount = Number(booking.amount) || 0;
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking amount'
      });
    }

    if (requestedAmount !== undefined && Number(requestedAmount) > 0 && Number(requestedAmount) !== amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking amount mismatch'
      });
    }

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount,
      currency: 'INR',
      receipt: `booking_${bookingId}_${Date.now()}`,
      notes: {
        type: 'booking',
        bookingId: bookingId.toString(),
        userId: userId.toString()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Booking payment order created',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
        testMode: isTestMode()
      }
    });

  } catch (error) {
    console.error('❌ Create booking order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking payment order',
      error: error.message
    });
  }
};

/**
 * Webhook handler for payment events
 * POST /api/payments/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const payload = req.body;

    console.log('📩 Webhook received:', payload.event);

    // Verify webhook signature when possible (skipped in test mode)
    if (signature && !verifyWebhookSignature(payload, signature)) {
      console.error('❌ Invalid Razorpay webhook signature');
      return res.status(400).json({ status: 'invalid_signature' });
    }

    // Handle different events
    switch (payload.event) {
      case 'payment.captured': {
        const payment = payload.payload.payment.entity;
        console.log('✅ Payment captured:', payment.id, 'notes:', payment.notes);
        const pNotes = payment.notes || {};

        if (pNotes.type === 'membership' && pNotes.userId && pNotes.plan) {
          const mUser = await User.findById(pNotes.userId);
          if (mUser) {
            const planConfig = await resolveMembershipPlanChargeAmount(String(pNotes.plan).toLowerCase());
            if (!planConfig.isValid) {
              break;
            }
            const validityDays = resolveMembershipValidityDays({ notes: pNotes, planConfig });
            mUser.subscriptionPlan = String(pNotes.plan).toLowerCase();
            mUser.subscriptionStatus = 'active';
            mUser.subscriptionStartDate = new Date();
            mUser.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

            upsertUserPaymentEntry({
              user: mUser,
              orderId: payment.order_id || payment.id,
              paymentId: payment.id,
              amount: payment.amount / 100,
              plan: String(pNotes.plan).toLowerCase(),
              metadata: {
                sourceController: 'payments.webhook.payment.captured',
                adminCreated: String(pNotes?.adminCreated || '').toLowerCase() === 'true',
                trackingId: pNotes?.trackingId || null,
              },
            });

            await mUser.save();
            await upsertActiveUserMembership({
              userId: pNotes.userId,
              planSlug: String(pNotes.plan).toLowerCase(),
              startDate: mUser.subscriptionStartDate,
              endDate: mUser.subscriptionEndDate,
              source: 'purchase',
              payment: {
                provider: 'razorpay',
                orderId: payment.order_id || payment.id,
                paymentId: payment.id,
                amount: payment.amount / 100,
                currency: 'INR',
              },
              metadata: {
                sourceController: 'payments.webhook.payment.captured',
                adminCreated: String(pNotes?.adminCreated || '').toLowerCase() === 'true',
                trackingId: pNotes?.trackingId || null,
              },
            });
            console.log(`✅ Membership activated via payment.captured for user ${pNotes.userId}: ${pNotes.plan}`);

            if (String(pNotes?.adminCreated || '').toLowerCase() === 'true') {
              await AdminPaymentLink.findOneAndUpdate(
                { paymentLinkId: payment.order_id || payment.id },
                {
                  status: 'paid',
                  paymentId: payment.id,
                  paidAt: new Date(),
                }
              );
            }

            // Handle plan upgrade - enroll in new community groups
            try {
              const upgradeResult = await handlePlanUpgrade(pNotes.userId, String(pNotes.plan).toLowerCase());
              console.log(`⬆️ Webhook plan upgrade: Enrolled in ${upgradeResult.enrolledInGroups} new groups`);
            } catch (error) {
              console.error('⚠️ Webhook plan upgrade group enrollment failed (non-critical):', error.message);
            }
          }
        }

        if (pNotes.type === 'booking' && pNotes.bookingId) {
          const booking = await Booking.findById(pNotes.bookingId);
          if (booking && booking.paymentStatus !== 'paid') {
            booking.paymentId = payment.id;
            booking.paymentMethod = 'razorpay';
            booking.paymentStatus = 'paid';
            booking.paidAt = new Date();
            booking.status = 'confirmed';
            await booking.save();
            console.log(`✅ Booking ${pNotes.bookingId} confirmed via payment.captured`);
          }
        }

        if (pNotes.type === 'order' && pNotes.orderId) {
          const order = await Order.findById(pNotes.orderId);
          if (order && order.status !== 'confirmed') {
            order.payment.status = 'completed';
            order.payment.razorpayPaymentId = payment.id;
            order.payment.paidAt = new Date();
            order.status = 'confirmed';
            await order.save();
            console.log(`✅ Order ${pNotes.orderId} confirmed via payment.captured`);
          }
        }
        break;
      }

      case 'payment_link.paid': {
        const pl = payload?.payload?.payment_link?.entity;
        const notes = pl?.notes || {};
        const plUserId = notes.userId;
        const plPlan = notes.plan;
        const plPaymentId = payload?.payload?.payment?.entity?.id || `pay_${Date.now()}`;
        console.log('✅ Payment link paid:', pl?.id, 'user:', plUserId, 'plan:', plPlan);

        if (plUserId && plPlan) {
          const plUser = await User.findById(plUserId);
          if (plUser) {
            const planConfig = await resolveMembershipPlanChargeAmount(String(plPlan).toLowerCase());
            if (!planConfig.isValid) {
              break;
            }
            const validityDays = resolveMembershipValidityDays({ notes, planConfig });

            plUser.subscriptionPlan = String(plPlan).toLowerCase();
            plUser.subscriptionStatus = 'active';
            plUser.subscriptionStartDate = new Date();
            plUser.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

            const orderId = pl?.id || `plink_${Date.now()}`;
            const inserted = upsertUserPaymentEntry({
              user: plUser,
              orderId,
              paymentId: plPaymentId,
              amount: pl?.amount ? pl.amount / 100 : 0,
              plan: String(plPlan).toLowerCase(),
              metadata: {
                sourceController: 'payments.webhook.payment_link.paid',
                adminCreated: String(notes?.adminCreated || '').toLowerCase() === 'true',
                trackingId: notes?.trackingId || null,
              },
            });

            if (inserted) {
              await plUser.save();
              await upsertActiveUserMembership({
                userId: plUserId,
                planSlug: String(plPlan).toLowerCase(),
                startDate: plUser.subscriptionStartDate,
                endDate: plUser.subscriptionEndDate,
                source: 'purchase',
                payment: {
                  provider: 'razorpay',
                  orderId,
                  paymentId: plPaymentId,
                  amount: (pl?.amount ? pl.amount / 100 : 0),
                  currency: 'INR',
                },
                metadata: {
                  sourceController: 'payments.webhook.payment_link.paid',
                  adminCreated: String(notes?.adminCreated || '').toLowerCase() === 'true',
                  trackingId: notes?.trackingId || null,
                },
              });
              console.log(`✅ Membership activated via payment_link.paid for user ${plUserId}: ${plPlan}`);

              if (String(notes?.adminCreated || '').toLowerCase() === 'true') {
                await AdminPaymentLink.findOneAndUpdate(
                  { paymentLinkId: orderId },
                  {
                    status: 'paid',
                    paymentId: plPaymentId,
                    paidAt: new Date(),
                  }
                );
              }

              // Handle plan upgrade - enroll in new community groups
              try {
                const upgradeResult = await handlePlanUpgrade(plUserId, String(plPlan).toLowerCase());
                console.log(`⬆️ Payment link plan upgrade: Enrolled in ${upgradeResult.enrolledInGroups} new groups`);
              } catch (error) {
                console.error('⚠️ Payment link plan upgrade group enrollment failed (non-critical):', error.message);
              }
            } else {
              console.log(`ℹ️ Payment already recorded for user ${plUserId}, skipping`);
            }
          }
        }

        if (notes.type === 'counseling' && notes.bookingId) {
          const whBooking = await Booking.findById(notes.bookingId);
          if (whBooking && whBooking.paymentStatus !== 'paid') {
            whBooking.paymentId = plPaymentId;
            whBooking.paymentMethod = 'razorpay';
            whBooking.paymentStatus = 'paid';
            whBooking.paidAt = new Date();
            whBooking.status = 'confirmed';
            await whBooking.save();
            console.log(`✅ Booking ${notes.bookingId} confirmed via payment_link.paid`);
          }
        }
        break;
      }
      
      case 'payment.failed':
        console.log('❌ Payment failed:', payload.payload.payment.entity.id);
        break;
      
      case 'refund.created':
        console.log('💰 Refund created:', payload.payload.refund.entity.id);
        break;
      
      default:
        console.log('ℹ️ Unhandled event:', payload.event);
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

/**
 * Get payment history for user
 * GET /api/payments/history
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('payments');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const payments = user.payments || [];

    return res.status(200).json({
      success: true,
      data: {
        payments: payments.reverse(), // Most recent first
        totalPayments: payments.length
      }
    });

  } catch (error) {
    console.error('❌ Get payment history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message
    });
  }
};

export default {
  createMembershipOrder,
  createMembershipPaymentLink,
  createAdminMembershipPaymentLink,
  getAdminMembershipPaymentLinks,
  confirmMembershipPaymentLink,
  syncMembershipFromRazorpay,
  createBookingOrder,
  createBookingPaymentLink,
  confirmBookingPaymentLink,
  verifyMembershipPayment,
  handleWebhook,
  getPaymentHistory
};
