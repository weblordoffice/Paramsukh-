import mongoose from 'mongoose';
import { User } from '../../models/user.models.js';
import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { UserMembership } from '../../models/userMembership.models.js';

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveUser = async ({ userId, phone, email }) => {
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    return User.findById(userId).select('_id displayName email phone isActive').lean();
  }

  if (phone) {
    return User.findOne({ phone: String(phone).trim() }).select('_id displayName email phone isActive').lean();
  }

  if (email) {
    return User.findOne({ email: String(email).trim().toLowerCase() }).select('_id displayName email phone isActive').lean();
  }

  return null;
};

const buildPlanSnapshot = (plan) => ({
  title: plan.title,
  slug: plan.slug,
  pricing: {
    amount: Number(plan.pricing?.oneTime?.amount || 0),
    currency: plan.pricing?.oneTime?.currency || 'INR',
    type: 'one_time',
  },
});

export const grantMembershipByAdmin = async (req, res) => {
  try {
    const {
      userId,
      phone,
      email,
      planId,
      startDate,
      endDate,
      durationDays,
      reason,
      grantedBy,
      replaceActive = true,
    } = req.body || {};

    if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ success: false, message: 'Valid planId is required' });
    }

    const user = await resolveUser({ userId, phone, email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isActive === false) {
      return res.status(400).json({ success: false, message: 'Cannot grant membership to inactive user' });
    }

    const plan = await MembershipPlan.findById(planId).lean();
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    const effectiveStartDate = toDate(startDate) || new Date();
    let effectiveEndDate = toDate(endDate);

    if (!effectiveEndDate) {
      const parsedDurationDays = Number(durationDays);
      const validityDays = Number.isFinite(parsedDurationDays) && parsedDurationDays > 0
        ? parsedDurationDays
        : Number(plan.validityDays || 365);
      effectiveEndDate = new Date(effectiveStartDate.getTime() + validityDays * 24 * 60 * 60 * 1000);
    }

    if (effectiveEndDate <= effectiveStartDate) {
      return res.status(400).json({ success: false, message: 'endDate must be later than startDate' });
    }

    const now = new Date();
    const activeMembership = await UserMembership.findOne({
      userId: user._id,
      status: 'active',
      endDate: { $gte: now },
    }).sort({ endDate: -1 });

    if (activeMembership && !replaceActive) {
      return res.status(409).json({
        success: false,
        message: 'User already has an active membership. Set replaceActive=true to replace it.',
      });
    }

    if (activeMembership && replaceActive) {
      activeMembership.status = 'expired';
      activeMembership.endDate = now;
      activeMembership.metadata = {
        ...(activeMembership.metadata || {}),
        replacedByAdminGrant: true,
        replacedAt: now,
      };
      await activeMembership.save();
    }

    const membership = await UserMembership.create({
      userId: user._id,
      planId: plan._id,
      planSnapshot: buildPlanSnapshot(plan),
      status: 'active',
      source: 'admin_grant',
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      autoRenew: false,
      payment: {
        provider: 'manual',
        orderId: null,
        paymentId: null,
        amount: 0,
        currency: plan.pricing?.oneTime?.currency || 'INR',
      },
      metadata: {
        grantReason: reason || 'Complimentary admin grant',
        grantedBy: grantedBy || 'admin_api_key',
        grantedAt: now,
        complimentary: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Membership granted successfully',
      data: membership,
    });
  } catch (error) {
    console.error('Admin grant membership error:', error);
    return res.status(500).json({ success: false, message: 'Failed to grant membership', error: error.message });
  }
};

export const listAdminGrantedMemberships = async (req, res) => {
  try {
    const { userId, planId, status } = req.query;
    const query = { source: 'admin_grant' };

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }

    if (planId && mongoose.Types.ObjectId.isValid(planId)) {
      query.planId = planId;
    }

    if (status) {
      query.status = status;
    }

    const records = await UserMembership.find(query)
      .populate('userId', 'displayName email phone')
      .populate('planId', 'title slug status')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: records.length,
      data: records,
    });
  } catch (error) {
    console.error('List admin granted memberships error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list admin grants', error: error.message });
  }
};

export const revokeAdminGrantedMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, revokedBy } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid membership id' });
    }

    const membership = await UserMembership.findOne({ _id: id, source: 'admin_grant' });
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Admin granted membership not found' });
    }

    const now = new Date();
    membership.status = 'cancelled';
    if (membership.endDate > now) {
      membership.endDate = now;
    }
    membership.metadata = {
      ...(membership.metadata || {}),
      revokedBy: revokedBy || 'admin_api_key',
      revokeReason: reason || 'Revoked by admin',
      revokedAt: now,
    };

    await membership.save();

    return res.status(200).json({
      success: true,
      message: 'Admin granted membership revoked',
      data: membership,
    });
  } catch (error) {
    console.error('Revoke admin granted membership error:', error);
    return res.status(500).json({ success: false, message: 'Failed to revoke membership', error: error.message });
  }
};

export const extendAdminGrantedMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const { extendDays, endDate, reason, updatedBy } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid membership id' });
    }

    const membership = await UserMembership.findOne({ _id: id, source: 'admin_grant' });
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Admin granted membership not found' });
    }

    const parsedExtendDays = Number(extendDays);
    const requestedEndDate = toDate(endDate);

    if ((!Number.isFinite(parsedExtendDays) || parsedExtendDays <= 0) && !requestedEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Provide either a valid extendDays (>0) or endDate',
      });
    }

    const baseDate = membership.endDate > new Date() ? membership.endDate : new Date();
    const computedEndDate = requestedEndDate || new Date(baseDate.getTime() + parsedExtendDays * 24 * 60 * 60 * 1000);

    if (computedEndDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'New end date must be in the future' });
    }

    membership.endDate = computedEndDate;
    if (membership.status !== 'active') {
      membership.status = 'active';
    }
    membership.metadata = {
      ...(membership.metadata || {}),
      extendedBy: updatedBy || 'admin_api_key',
      extensionReason: reason || 'Extended by admin',
      extendedAt: new Date(),
    };

    await membership.save();

    return res.status(200).json({
      success: true,
      message: 'Admin granted membership extended',
      data: membership,
    });
  } catch (error) {
    console.error('Extend admin granted membership error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend membership', error: error.message });
  }
};
