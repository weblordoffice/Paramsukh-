import mongoose from 'mongoose';
import { CommunityPointEvent } from '../models/communityPoint.models.js';
import { MentorProfile, Group } from '../models/community.models.js';
import { User } from '../models/user.models.js';
import Admin from '../models/admin.models.js';

export const COMMUNITY_POINT_RULES = {
  discussion_created: { points: 5, dailyCap: 3 },
  question_created: { points: 5, dailyCap: 3 },
  comment_created: { points: 2, dailyCap: 10 },
  answer_accepted: { points: 20, dailyCap: 5 },
  like_received: { points: 1, dailyCap: 20 },
  upvote_received: { points: 1, dailyCap: 20 },
};

export const COMMUNITY_LEVELS = [
  { min: 0, name: 'New Seeker' },
  { min: 101, name: 'Active Learner' },
  { min: 501, name: 'Community Guide' },
  { min: 1500, name: 'Wellness Champion' },
];

export const getCommunityLevel = (points = 0) => {
  const value = Number(points) || 0;
  let level = COMMUNITY_LEVELS[0].name;
  for (const entry of COMMUNITY_LEVELS) {
    if (value >= entry.min) level = entry.name;
  }
  return level;
};

export const getWeekKey = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const getMonthKey = (date = new Date()) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getUtcDayStart = (date = new Date()) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const countActiveToday = async (userId, action) => {
  // updatedAt tracks reactivations (unlike -> like), so daily caps stay correct.
  return CommunityPointEvent.countDocuments({
    userId,
    action,
    isActive: true,
    updatedAt: { $gte: getUtcDayStart() },
  });
};

const validatePeriod = (period) => {
  const normalized = String(period || 'all').toLowerCase();
  if (['weekly', 'monthly', 'all'].includes(normalized)) return normalized;
  return 'all';
};

const getPeriodMatch = (period) => {
  if (period === 'weekly') return { weekKey: getWeekKey() };
  if (period === 'monthly') return { monthKey: getMonthKey() };
  return {};
};

export const awardCommunityPoints = async ({
  userId,
  action,
  refType = null,
  refId = null,
  groupId = null,
  points,
  dedupeKey,
  metadata = {},
}) => {
  if (!userId || !action || !dedupeKey) return null;

  const rule = COMMUNITY_POINT_RULES[action];
  const finalPoints = typeof points === 'number' ? points : rule?.points;
  if (!finalPoints || finalPoints <= 0) return null;

  const now = new Date();
  const existing = await CommunityPointEvent.findOne({ dedupeKey }).select('_id isActive').lean();

  if (existing) {
    if (existing.isActive) return existing;

    if (rule?.dailyCap) {
      const count = await countActiveToday(userId, action);
      if (count >= rule.dailyCap) return null;
    }

    await CommunityPointEvent.updateOne(
      { _id: existing._id },
      {
        $set: {
          isActive: true,
          points: finalPoints,
          weekKey: getWeekKey(now),
          monthKey: getMonthKey(now),
          metadata,
        },
      }
    );
    return existing;
  }

  if (rule?.dailyCap) {
    const count = await countActiveToday(userId, action);
    if (count >= rule.dailyCap) return null;
  }

  try {
    return await CommunityPointEvent.create({
      userId,
      action,
      points: finalPoints,
      refType,
      refId,
      groupId,
      weekKey: getWeekKey(now),
      monthKey: getMonthKey(now),
      dedupeKey,
      metadata,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return CommunityPointEvent.findOne({ dedupeKey });
    }
    console.error('awardCommunityPoints error:', error?.message);
    return null;
  }
};

export const revokeCommunityPoints = async (dedupeKey) => {
  if (!dedupeKey) return;
  await CommunityPointEvent.updateOne({ dedupeKey }, { $set: { isActive: false } });
};

export const revokeCommunityPointsForRef = async ({ refType, refId, action = null }) => {
  if (!refType || !refId) return;
  const query = { refType, refId };
  if (action) query.action = action;
  await CommunityPointEvent.updateMany(query, { $set: { isActive: false } });
};

export const revokeCommunityPointsForPost = async (postId, commentIds = []) => {
  if (!postId) return;
  const commentObjectIds = commentIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const or = [
    { refType: 'post', refId: postId },
    ...(commentObjectIds.length ? [{ refType: 'comment', refId: { $in: commentObjectIds } }] : []),
  ];

  await CommunityPointEvent.updateMany({ $or: or }, { $set: { isActive: false } });
};

export const getGroupScopeIds = async (groupId) => {
  if (!groupId) return null;
  if (!mongoose.Types.ObjectId.isValid(groupId)) return [];

  const group = await Group.findById(groupId).select('groupType').lean();
  if (!group) return [];

  if (group.groupType === 'plan') {
    const children = await Group.find({ parentGroupId: groupId, isActive: true }).select('_id').lean();
    return [new mongoose.Types.ObjectId(groupId), ...children.map((child) => child._id)];
  }

  return [new mongoose.Types.ObjectId(groupId)];
};

const buildLeaderboardPipeline = (match, excludedUserIds = []) => {
  const pipeline = [
    { $match: match },
    { $group: { _id: '$userId', points: { $sum: '$points' } } },
    { $match: { points: { $gt: 0 } } },
    { $sort: { points: -1, _id: 1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.isActive': true,
        'user.communityPostingBlocked': { $ne: true },
      },
    },
  ];

  if (excludedUserIds.length > 0) {
    pipeline.push({ $match: { _id: { $nin: excludedUserIds } } });
  }

  pipeline.push({
    $project: {
      _id: 1,
      points: 1,
      displayName: '$user.displayName',
      photoURL: '$user.photoURL',
      subscriptionPlan: '$user.subscriptionPlan',
    },
  });

  return pipeline;
};

export const getCommunityLeaderboard = async ({
  period = 'all',
  groupId = null,
  limit = 50,
  currentUserId = null,
} = {}) => {
  const normalizedPeriod = validatePeriod(period);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));

  const match = { isActive: true, ...getPeriodMatch(normalizedPeriod) };

  if (groupId) {
    const scopeIds = await getGroupScopeIds(groupId);
    if (!scopeIds || scopeIds.length === 0) {
      return {
        period: normalizedPeriod,
        groupId: null,
        leaderboard: [],
        me: null,
      };
    }
    match.groupId = scopeIds.length === 1 ? scopeIds[0] : { $in: scopeIds };
  }

  const [mentors, admins] = await Promise.all([
    MentorProfile.find({ isActive: true }).select('userId').lean(),
    Admin.find({ isActive: true }).select('email').lean(),
  ]);

  const excludedById = new Map();
  mentors.forEach((mentor) => {
    if (mentor.userId) excludedById.set(String(mentor.userId), mentor.userId);
  });

  const adminEmails = admins.map((admin) => admin.email).filter(Boolean);
  if (adminEmails.length > 0) {
    const adminUsers = await User.find({ email: { $in: adminEmails } }).select('_id').lean();
    adminUsers.forEach((adminUser) => {
      excludedById.set(String(adminUser._id), adminUser._id);
    });
  }

  const excludedUserIds = [...excludedById.values()];

  const rows = await CommunityPointEvent.aggregate(buildLeaderboardPipeline(match, excludedUserIds));

  const leaderboard = rows.slice(0, safeLimit).map((row, index) => ({
    rank: index + 1,
    userId: row._id,
    displayName: row.displayName || 'Community Member',
    photoURL: row.photoURL || null,
    points: row.points,
    level: getCommunityLevel(row.points),
    isCurrentUser: currentUserId ? String(row._id) === String(currentUserId) : false,
  }));

  let me = null;
  if (currentUserId) {
    const index = rows.findIndex((row) => String(row._id) === String(currentUserId));
    if (index >= 0) {
      me = {
        rank: index + 1,
        points: rows[index].points,
        level: getCommunityLevel(rows[index].points),
      };
    } else {
      me = { rank: null, points: 0, level: getCommunityLevel(0) };
    }
  }

  return {
    period: normalizedPeriod,
    groupId: groupId || null,
    leaderboard,
    me,
  };
};

export const getCommunityPointEvents = async ({
  period = 'all',
  groupId = null,
  page = 1,
  limit = 20,
  includeInactive = true,
} = {}) => {
  const normalizedPeriod = validatePeriod(period);
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const query = { ...getPeriodMatch(normalizedPeriod) };
  if (!includeInactive) query.isActive = true;

  if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
    const scopeIds = await getGroupScopeIds(groupId);
    if (scopeIds && scopeIds.length > 0) {
      query.groupId = scopeIds.length === 1 ? scopeIds[0] : { $in: scopeIds };
    }
  }

  const [events, total] = await Promise.all([
    CommunityPointEvent.find(query)
      .populate('userId', 'displayName email photoURL')
      .populate('groupId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    CommunityPointEvent.countDocuments(query),
  ]);

  return {
    period: normalizedPeriod,
    events,
    pagination: {
      currentPage: safePage,
      totalPages: Math.ceil(total / safeLimit),
      totalItems: total,
    },
  };
};
