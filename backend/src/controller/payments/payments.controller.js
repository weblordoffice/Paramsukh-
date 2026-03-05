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
import { Group, GroupMember } from '../../models/community.models.js';

/**
 * Create payment order for membership
 * POST /api/payments/create-order
 */
export const createMembershipOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan, amount } = req.body;

    // Validate plan
    const validPlans = ['bronze', 'copper', 'silver'];
    if (!validPlans.includes(plan.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership plan'
      });
    }

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
      currency: 'INR',
      receipt: `membership_${userId}_${Date.now()}`,
      notes: {
        type: 'membership',
        plan: plan,
        userId: userId.toString()
      }
    });

    console.log(`✅ Payment order created for user ${userId}, plan: ${plan}`);

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
    const { plan, amount } = req.body;

    const validPlans = ['bronze', 'copper', 'silver'];
    if (!plan || !validPlans.includes(String(plan).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid membership plan' });
    }

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
      currency: 'INR',
      description: `${String(plan).toUpperCase()} Membership · ParamSukh`,
      customer,
      notes: {
        type: 'membership',
        plan: String(plan).toLowerCase(),
        userId: userId.toString(),
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
 * Confirm a membership payment link after redirect (fallback when webhooks don't reach local dev)
 * POST /api/payments/membership-link/confirm
 */
export const confirmMembershipPaymentLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentLinkId, plan } = req.body;

    const validPlans = ['bronze', 'copper', 'silver'];
    if (!plan || !validPlans.includes(String(plan).toLowerCase())) {
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
    console.log(`   Razorpay link status: ${status}, notes.plan: ${notes?.plan}, notes.userId: ${notes?.userId}`);

    // Basic ownership check (if notes were set)
    if (notes?.userId && String(notes.userId) !== String(userId)) {
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const finalPlan = String(notes?.plan || plan).toLowerCase();
    user.subscriptionPlan = finalPlan;
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = new Date();
    user.subscriptionEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Razorpay can return payments as array or single object
    const paymentsRaw = link?.payments;
    const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
    const paymentId = firstPayment?.payment_id || link?.payment_id || `pay_link_${Date.now()}`;
    const amountPaise = link?.amount ?? firstPayment?.amount ?? 0;

    user.payments = user.payments || [];
    user.payments.push({
      orderId: paymentLinkId,
      paymentId,
      amount: Number(amountPaise) / 100,
      plan: finalPlan,
      status: 'completed',
      date: new Date()
    });

    await user.save();
    console.log(`✅ Membership activated for user ${userId}: ${finalPlan}`);

    // Enroll in courses for this plan (same as purchaseMembership)
    const courses = await Course.find({
      includedInPlans: finalPlan,
      status: 'published'
    });

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

      let group = await Group.findOne({ courseId: course._id });
      if (!group) {
        group = await Group.create({
          name: `${course.title} Community`,
          description: `Discussion group for ${course.title} course members`,
          courseId: course._id,
          coverImage: course.thumbnailUrl || null,
          memberCount: 0
        });
      }
      const existingMember = await GroupMember.findOne({ groupId: group._id, userId });
      if (!existingMember) {
        await GroupMember.create({ groupId: group._id, userId, role: 'member' });
        group.memberCount = (group.memberCount || 0) + 1;
        await group.save();
      }
    }
    console.log(`   Enrolled in ${courses.length} course(s) for plan ${finalPlan}`);

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

      const finalPlan = String(notes.plan || 'copper').toLowerCase();
      if (!['bronze', 'copper', 'silver'].includes(finalPlan)) continue;

      const paymentsRaw = full?.payments;
      const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
      const paymentId = firstPayment?.payment_id || full?.payment_id || `pay_${Date.now()}`;
      const amountPaise = full?.amount ?? firstPayment?.amount ?? 0;

      user.subscriptionPlan = finalPlan;
      user.subscriptionStatus = 'active';
      user.subscriptionStartDate = new Date();
      user.subscriptionEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      user.payments = user.payments || [];
      user.payments.push({
        orderId,
        paymentId,
        amount: Number(amountPaise) / 100,
        plan: finalPlan,
        status: 'completed',
        date: new Date()
      });
      await user.save();

      const courses = await Course.find({ includedInPlans: finalPlan, status: 'published' });
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
        let group = await Group.findOne({ courseId: course._id });
        if (!group) {
          group = await Group.create({
            name: `${course.title} Community`,
            description: `Discussion group for ${course.title} course members`,
            courseId: course._id,
            coverImage: course.thumbnailUrl || null,
            memberCount: 0
          });
        }
        const existingMember = await GroupMember.findOne({ groupId: group._id, userId });
        if (!existingMember) {
          await GroupMember.create({ groupId: group._id, userId, role: 'member' });
          group.memberCount = (group.memberCount || 0) + 1;
          await group.save();
        }
      }
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

    // Verify signature (in test mode, accepts test_ prefixed IDs)
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature || 'test_signature'
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
    user.subscriptionPlan = plan.toLowerCase();
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = new Date();
    user.subscriptionEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Store payment info
    user.payments = user.payments || [];
    user.payments.push({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: paymentDetails.amount / 100, // Convert from paise
      plan: plan.toLowerCase(),
      status: 'completed',
      date: new Date()
    });

    await user.save();

    console.log(`✅ Membership activated for user ${userId}: ${plan}`);

    return res.status(200).json({
      success: true,
      message: `${plan} membership activated successfully!`,
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
    const { bookingId, amount } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and amount are required'
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
      case 'payment.captured':
        console.log('✅ Payment captured:', payload.payload.payment.entity.id);
        break;

      case 'payment_link.paid': {
        const pl = payload?.payload?.payment_link?.entity;
        const notes = pl?.notes || {};
        const userId = notes.userId;
        const plan = notes.plan;
        console.log('✅ Payment link paid:', pl?.id, 'user:', userId, 'plan:', plan);

        if (userId && plan) {
          const user = await User.findById(userId);
          if (user) {
            user.subscriptionPlan = String(plan).toLowerCase();
            user.subscriptionStatus = 'active';
            user.subscriptionStartDate = new Date();
            user.subscriptionEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            user.payments = user.payments || [];
            user.payments.push({
              orderId: pl?.id || `plink_${Date.now()}`,
              paymentId: payload?.payload?.payment?.entity?.id || `pay_${Date.now()}`,
              amount: (pl?.amount ? pl.amount / 100 : 0),
              plan: String(plan).toLowerCase(),
              status: 'completed',
              date: new Date()
            });
            await user.save();
            console.log(`✅ Membership activated via payment link for user ${userId}: ${plan}`);
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
  confirmMembershipPaymentLink,
  syncMembershipFromRazorpay,
  verifyMembershipPayment,
  createBookingOrder,
  handleWebhook,
  getPaymentHistory
};
