import mongoose from 'mongoose';
import { Group, GroupMember, Post, Comment, MentorProfile } from '../../models/community.models.js';
import Notification from '../../models/notification.models.js';
import { sendPushToUser } from '../../services/pushService.js';
import { evaluateCommunityAccess } from '../../services/entitlement.service.js';
import { syncUserCommunityMembershipsByPlan } from '../../services/planUpgrade.service.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { ensureGeneralGroup, enrollUserInGroup, isPublicGroup, getPublicGroupIds } from '../../services/community.service.js';
import {
  awardCommunityPoints,
  revokeCommunityPoints,
  revokeCommunityPointsForRef,
  revokeCommunityPointsForPost,
  getCommunityLeaderboard,
  getGroupScopeIds,
} from '../../services/communityPoints.service.js';

const normalizeCategory = (value) => String(value || '').trim().toLowerCase();

const VALID_POST_TYPES = new Set(['discussion', 'question']);
const VALID_QUESTION_FILTERS = new Set(['all', 'unanswered', 'resolved']);

const parsePostType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_POST_TYPES.has(normalized) ? normalized : 'discussion';
};

const parseQuestionFilter = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_QUESTION_FILTERS.has(normalized) ? normalized : 'all';
};

const applyPostTypeFilter = (query, postType, status) => {
  if (postType === 'question') {
    query.postType = 'question';
    if (status === 'unanswered') query.isResolved = false;
    if (status === 'resolved') query.isResolved = true;
    return query;
  }

  // Legacy documents created before postType existed are discussions.
  query.$and = [
    ...(query.$and || []),
    { $or: [{ postType: 'discussion' }, { postType: { $exists: false } }, { postType: null }] },
  ];
  return query;
};

const isMentorForGroup = async (userId, groupId) => {
  const [membership, profile] = await Promise.all([
    GroupMember.findOne({ groupId, userId, isActive: true, role: 'mentor' }).select('_id').lean(),
    MentorProfile.findOne({ userId, isActive: true, groupIds: groupId }).select('_id').lean(),
  ]);
  return Boolean(membership || profile);
};

const canManageQuestion = async (post, userId) => {
  if (post.userId && post.userId.toString() === userId.toString()) return true;
  if (post.assignedMentorId) {
    const assigned = await MentorProfile.findOne({
      _id: post.assignedMentorId,
      userId,
      isActive: true,
    }).select('_id').lean();
    if (assigned) return true;
  }
  return isMentorForGroup(userId, post.groupId);
};

const getAccessibleGroupIds = async (userId) => {
  const [memberships, publicGroupIds] = await Promise.all([
    GroupMember.find({ userId, isActive: true }).select('groupId').lean(),
    getPublicGroupIds(),
  ]);

  return [...new Set([
    ...memberships.map((membership) => String(membership.groupId)),
    ...publicGroupIds.map((id) => String(id)),
  ])];
};

const expandGroupIdsWithChildren = async (groupIds) => {
  const expanded = new Set();

  for (const groupId of groupIds) {
    const scopeIds = await getGroupScopeIds(groupId);
    (scopeIds || []).forEach((id) => expanded.add(String(id)));
  }

  return [...expanded];
};

const getMentorContextForUser = async (userId) => {
  const [profile, memberships] = await Promise.all([
    MentorProfile.findOne({ userId, isActive: true }).select('_id').lean(),
    GroupMember.find({ userId, isActive: true, role: 'mentor' }).select('groupId').lean(),
  ]);

  return {
    mentorProfileId: profile?._id ? String(profile._id) : null,
    mentorGroupIds: new Set(memberships.map((membership) => String(membership.groupId))),
  };
};

const getMentorAuthorIds = async (posts) => {
  const authorIds = posts
    .map((post) => post.userId?._id)
    .filter(Boolean);

  if (authorIds.length === 0) return new Set();

  const profiles = await MentorProfile.find({
    userId: { $in: authorIds },
    isActive: true,
  }).select('userId').lean();

  return new Set(profiles.map((profile) => String(profile.userId)));
};

const formatPostsForUser = async (posts, userId, mentorContext = null) => {
  const context = mentorContext || await getMentorContextForUser(userId);
  const mentorAuthorIds = await getMentorAuthorIds(posts);

  return posts.map((post) => {
    const formatted = formatPostForUser(post, userId);
    const authorId = formatted.author?._id ? String(formatted.author._id) : null;
    const isQuestion = (post.postType || 'discussion') === 'question';
    const isAuthor = authorId && authorId === String(userId);
    const isAssignedMentor = context.mentorProfileId
      && post.assignedMentorId
      && String(post.assignedMentorId) === context.mentorProfileId;
    const isMentorInGroup = context.mentorGroupIds.has(String(post.groupId));

    if (authorId) {
      formatted.author.isMentor = mentorAuthorIds.has(authorId);
    }

    formatted.viewerCanManageQuestion = isQuestion && (isAuthor || isAssignedMentor || isMentorInGroup);

    return formatted;
  });
};

const formatMentorProfile = (profile, accessibleGroupIds = null) => {
  const accessibleSet = accessibleGroupIds ? new Set(accessibleGroupIds.map(String)) : null;
  const groups = (profile.groupIds || [])
    .filter((group) => group && (!accessibleSet || accessibleSet.has(String(group._id))))
    .map((group) => ({
      _id: group._id,
      name: group.name,
      groupType: group.groupType,
      category: group.category || null,
      planSlug: group.planSlug || null,
    }));

  return {
    _id: profile._id,
    userId: profile.userId?._id || profile.userId,
    displayName: profile.userId?.displayName || 'Mentor',
    photoURL: profile.userId?.photoURL || null,
    subscriptionPlan: profile.userId?.subscriptionPlan || null,
    headline: profile.headline || '',
    bio: profile.bio || '',
    expertise: profile.expertise || [],
    languages: profile.languages || [],
    isVerified: profile.isVerified === true,
    isActive: profile.isActive !== false,
    groups,
  };
};

const evaluateCommunityAchievements = (userId) => {
  import('../../services/badgeUnlockingService.js')
    .then(({ unlockBadgesForUser }) => unlockBadgesForUser(userId))
    .catch((error) => console.error('Community badge evaluation failed:', error?.message));
};

const rejectBlockedUser = (res) => res.status(403).json({
  success: false,
  code: 'POSTING_BLOCKED',
  message: "You have been blocked from posting in the community by an administrator."
});

const notifyCommunityUser = async ({
  userId,
  type,
  title,
  message,
  relatedId = null,
  relatedType = null,
  actionUrl = '/(home)/community',
  icon = '💬',
}) => {
  if (!userId) return;
  try {
    await Notification.createNotification({
      user: userId,
      type,
      title,
      message,
      relatedId,
      relatedType,
      actionUrl,
      icon,
    });
    await sendPushToUser(userId, {
      title,
      body: message,
      data: { type, actionUrl, relatedId: relatedId ? String(relatedId) : null },
    });
  } catch (error) {
    console.error('Community notification error:', error?.message);
  }
};

/**
 * Check if user has community access (free users get General group, paid users get plan groups)
 * GET /api/community/check-access
 */
export const checkCommunityAccess = async (req, res) => {
  try {
    const userId = req.user._id;

    const access = await evaluateCommunityAccess(userId);
    if (access.reason === 'user_not_found') {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      hasAccess: access.hasAccess,
      subscriptionPlan: access.plan,
      subscriptionStatus: access.status,
      reason: access.reason,
      isFreeUser: access.isFreeUser || false,
    });

  } catch (error) {
    console.error("❌ Error checking community access:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get community leaderboard.
 * GET /api/community/leaderboard?period=weekly|monthly|all&groupId=
 */
export const getLeaderboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const period = String(req.query.period || 'all').toLowerCase();
    const groupId = req.query.groupId || null;
    const limit = req.query.limit;

    if (!['weekly', 'monthly', 'all'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Period must be weekly, monthly, or all"
      });
    }

    if (groupId) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ success: false, message: "Invalid group id" });
      }

      const group = await Group.findById(groupId).select('isPublic isActive').lean();
      if (!group || group.isActive === false) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }

      if (!isPublicGroup(group)) {
        const scopeIds = await getGroupScopeIds(groupId);
        const membership = await GroupMember.findOne({
          userId,
          isActive: true,
          groupId: { $in: scopeIds || [] },
        }).select('_id').lean();

        if (!membership) {
          return res.status(403).json({
            success: false,
            message: "You must be a member of this group to view its leaderboard"
          });
        }
      }
    }

    const result = await getCommunityLeaderboard({
      period,
      groupId,
      limit,
      currentUserId: userId,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("❌ Error fetching community leaderboard:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const formatPlanLabel = (planSlug) => {
  const normalized = String(planSlug || '').trim().toLowerCase();
  if (!normalized) return 'Plan';
  return normalized
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatCategoryLabel = (category) => {
  const normalized = normalizeCategory(category);
  const labels = { physical: 'Physical', mental: 'Mental', financial: 'Financial', relationship: 'Relationship', spiritual: 'Spiritual', general: 'General' };
  return labels[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'General');
};

const formatPostForUser = (post, userId) => {
  const likes = post.likes || [];
  const votes = post.votes || [];
  const userLiked = likes.some(like => like.userId.toString() === userId.toString());
  const userVoted = votes.some(vote => vote.userId.toString() === userId.toString());
  return {
    _id: post._id,
    content: post.content,
    postType: post.postType || 'discussion',
    title: post.title || null,
    isResolved: post.isResolved === true,
    acceptedCommentId: post.acceptedCommentId || null,
    assignedMentorId: post.assignedMentorId || null,
    images: post.images,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    voteCount: post.voteCount || 0,
    userVoted,
    isPinned: post.isPinned,
    isBlocked: post.isBlocked === true,
    userLiked,
    author: post.userId ? {
      _id: post.userId._id,
      displayName: post.userId.displayName,
      photoURL: post.userId.photoURL,
      subscriptionPlan: post.userId.subscriptionPlan
    } : {
      _id: null,
      displayName: post.authorName || 'ParamSukh Admin',
      photoURL: null,
      subscriptionPlan: 'admin'
    },
    tags: post.tags,
    groupId: post.groupId,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
};

/**
 * Get user's groups - returns hierarchical plan -> subgroup tree for paid users,
 * or General group for free users.
 * GET /api/community/my-groups
 */
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const postingBlocked = req.user?.communityPostingBlocked === true;

    const access = await evaluateCommunityAccess(userId);

    // The General (public) group is available to everyone, regardless of membership.
    const generalGroup = await ensureGeneralGroup();
    let generalFormatted = null;

    if (generalGroup && generalGroup.isActive !== false) {
      await enrollUserInGroup(generalGroup._id, userId);
      const reFetched = await Group.findById(generalGroup._id).select('memberCount').lean();
      const membership = await GroupMember.findOne({ groupId: generalGroup._id, userId, isActive: true }).lean();

      generalFormatted = {
        _id: generalGroup._id,
        name: generalGroup.name,
        description: generalGroup.description,
        memberCount: reFetched?.memberCount || 0,
        coverImage: generalGroup.coverImage || null,
        groupType: 'plan',
        planSlug: 'general',
        category: null,
        parentGroupId: null,
        course: null,
        isPublic: true,
        joinedAt: membership?.joinedAt || new Date(),
        role: membership?.role || 'member',
      };
    }

    const mentorProfile = await MentorProfile.findOne({ userId, isActive: true })
      .select('groupIds')
      .lean();

    const mentorGroupIds = (mentorProfile?.groupIds || []).filter(Boolean);
    let mentorGroups = [];

    if (mentorGroupIds.length > 0) {
      const [mentorGroupDocs, mentorMemberships] = await Promise.all([
        Group.find({ _id: { $in: mentorGroupIds }, isActive: true }).lean(),
        GroupMember.find({
          userId,
          groupId: { $in: mentorGroupIds },
          isActive: true,
          role: 'mentor',
        }).select('groupId joinedAt').lean(),
      ]);

      const membershipByGroupId = new Map(
        mentorMemberships.map((membership) => [String(membership.groupId), membership])
      );

      mentorGroups = mentorGroupDocs
        .filter((group) => String(group._id) !== String(generalGroup?._id))
        .map((group) => {
          const membership = membershipByGroupId.get(String(group._id));
          return {
            _id: group._id,
            name: group.name,
            description: group.description,
            memberCount: group.memberCount || 0,
            coverImage: group.coverImage || null,
            groupType: group.groupType,
            planSlug: group.planSlug,
            category: group.category || null,
            parentGroupId: group.parentGroupId || null,
            course: group.courseId || null,
            isPublic: group.isPublic === true,
            joinedAt: membership?.joinedAt || new Date(),
            role: 'mentor',
          };
        });
    }

    const baseGroups = [generalFormatted, ...mentorGroups].filter(Boolean);

    // Users without plan-based community access still get the General group
    // and any groups they mentor.
    if (!access.hasAccess) {
      return res.status(200).json({
        success: true,
        generalGroup: generalFormatted,
        planGroups: [],
        mentorGroups,
        groups: baseGroups,
        otherGroups: [],
        postingBlocked,
        totalGroups: baseGroups.length,
      });
    }

    const activeMemberships = await UserMembership.find({
      userId,
      status: 'active',
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null },
        { endDate: { $exists: false } },
      ],
    })
      .populate('planId')
      .sort({ endDate: -1 })
      .lean();

    if (!activeMemberships.length) {
      return res.status(200).json({
        success: true,
        generalGroup: generalFormatted,
        planGroups: [],
        mentorGroups,
        groups: baseGroups,
        otherGroups: [],
        postingBlocked,
        totalGroups: baseGroups.length,
      });
    }

    const allPlanGroups = [];

    for (const membership of activeMemberships) {
      const planSlug = membership?.planId?.slug || access.planSlug;
      if (!planSlug || planSlug === 'free') continue;

      const existingPlanMembership = await GroupMember.findOne({
        userId,
        isActive: true,
        groupId: { $in: await Group.find({ groupType: 'plan', planSlug, isActive: true }).select('_id').lean().then(g => g.map(x => x._id)) }
      });

      if (!existingPlanMembership) {
        await syncUserCommunityMembershipsByPlan({
          userId,
          planSlug,
          membershipActive: true,
        });
      }

      const planParentGroup = await Group.findOne({ groupType: 'plan', planSlug, isActive: true }).lean();
      const categorySubgroups = await Group.find({
        groupType: 'category',
        planSlug,
        isActive: true,
      }).sort({ name: 1 }).lean();

      if (planParentGroup || categorySubgroups.length > 0) {
        const userMemberships = await GroupMember.find({
          userId,
          isActive: true,
          groupId: { $in: [planParentGroup?._id, ...categorySubgroups.map((g) => g._id)].filter(Boolean) },
        }).select('groupId joinedAt role').lean();

        const membershipByGroupId = new Map(userMemberships.map((m) => [String(m.groupId), m]));

        const formatGroupLocal = (group) => {
          const mem = membershipByGroupId.get(String(group._id));
          return {
            _id: group._id,
            name: group.name,
            description: group.description,
            memberCount: group.memberCount || 0,
            coverImage: group.coverImage || null,
            groupType: group.groupType,
            planSlug: group.planSlug,
            category: group.category || null,
            parentGroupId: group.parentGroupId || null,
            course: group.courseId || null,
            isPublic: false,
            joinedAt: mem?.joinedAt || new Date(),
            role: mem?.role || 'member',
          };
        };

        allPlanGroups.push({
          ...formatGroupLocal(planParentGroup || {
            _id: null,
            name: `${formatPlanLabel(planSlug)} Community`,
            description: `Community for ${formatPlanLabel(planSlug)} plan members`,
            memberCount: 0,
            groupType: 'plan',
            planSlug,
            category: null,
            parentGroupId: null,
          }),
          subgroups: categorySubgroups.map(formatGroupLocal),
        });
      }
    }

    const flatPlanGroups = allPlanGroups.flatMap(pg => [pg, ...pg.subgroups]).filter(g => g._id);

    const groupsById = new Map();
    [...baseGroups, ...flatPlanGroups].forEach((group) => {
      if (group?._id) groupsById.set(String(group._id), group);
    });
    const combinedGroups = [...groupsById.values()];

    return res.status(200).json({
      success: true,
      generalGroup: generalFormatted,
      planGroups: allPlanGroups,
      mentorGroups,
      groups: combinedGroups,
      otherGroups: [],
      postingBlocked,
      totalGroups: combinedGroups.length,
    });

  } catch (error) {
    console.error("❌ Error fetching user groups:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * List verified mentors available in the user's accessible groups.
 * GET /api/community/mentors
 */
export const getMentors = async (req, res) => {
  try {
    const userId = req.user._id;
    const accessibleGroupIds = await getAccessibleGroupIds(userId);

    if (accessibleGroupIds.length === 0) {
      return res.status(200).json({ success: true, mentors: [] });
    }

    const profiles = await MentorProfile.find({
      isActive: true,
      isVerified: true,
      groupIds: { $in: accessibleGroupIds },
    })
      .populate('userId', 'displayName photoURL subscriptionPlan isActive')
      .populate('groupIds', 'name groupType category planSlug')
      .sort({ createdAt: 1 })
      .lean();

    const mentors = profiles
      .filter((profile) => profile.userId && profile.userId.isActive !== false)
      .map((profile) => formatMentorProfile(profile, accessibleGroupIds));

    return res.status(200).json({ success: true, mentors });
  } catch (error) {
    console.error("❌ Error fetching mentors:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get a mentor profile with recent activity.
 * GET /api/community/mentors/:userId
 */
export const getMentorProfile = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;

    const accessibleGroupIds = await getAccessibleGroupIds(currentUserId);
    if (accessibleGroupIds.length === 0) {
      return res.status(404).json({ success: false, message: "Mentor not found" });
    }

    const profile = await MentorProfile.findOne({
      userId,
      isActive: true,
      isVerified: true,
      groupIds: { $in: accessibleGroupIds },
    })
      .populate('userId', 'displayName photoURL subscriptionPlan isActive')
      .populate('groupIds', 'name groupType category planSlug')
      .lean();

    if (!profile || !profile.userId || profile.userId.isActive === false) {
      return res.status(404).json({ success: false, message: "Mentor not found" });
    }

    const accessibleSet = new Set(accessibleGroupIds.map(String));
    const directSharedGroupIds = (profile.groupIds || [])
      .filter((group) => accessibleSet.has(String(group._id)))
      .map((group) => String(group._id));
    const sharedGroupIds = (await expandGroupIdsWithChildren(directSharedGroupIds))
      .filter((groupId) => accessibleSet.has(String(groupId)));

    const [questionsAssigned, answersGiven, recentQuestions, recentPosts] = await Promise.all([
      Post.countDocuments({
        postType: 'question',
        assignedMentorId: profile._id,
        isActive: true,
      }),
      Comment.countDocuments({ userId: profile.userId._id, isActive: true }),
      Post.find({
        postType: 'question',
        groupId: { $in: sharedGroupIds },
        assignedMentorId: profile._id,
        isActive: true,
        isBlocked: { $ne: true },
      })
        .populate('userId', 'displayName photoURL subscriptionPlan')
        .sort({ createdAt: -1 })
        .limit(10),
      Post.find({
        userId: profile.userId._id,
        groupId: { $in: sharedGroupIds },
        isActive: true,
        isBlocked: { $ne: true },
      })
        .populate('userId', 'displayName photoURL subscriptionPlan')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const mentorContext = await getMentorContextForUser(currentUserId);

    return res.status(200).json({
      success: true,
      mentor: formatMentorProfile(profile, accessibleGroupIds),
      stats: { questionsAssigned, answersGiven },
      recentQuestions: await formatPostsForUser(recentQuestions, currentUserId, mentorContext),
      recentPosts: await formatPostsForUser(recentPosts, currentUserId, mentorContext),
    });
  } catch (error) {
    console.error("❌ Error fetching mentor profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get the current user's mentor profile, if any.
 * GET /api/community/mentor/me
 */
export const getMentorMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const profile = await MentorProfile.findOne({ userId, isActive: true })
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .populate('groupIds', 'name groupType category planSlug')
      .lean();

    if (!profile) {
      return res.status(200).json({ success: true, isMentor: false, profile: null });
    }

    return res.status(200).json({
      success: true,
      isMentor: true,
      profile: formatMentorProfile(profile),
    });
  } catch (error) {
    console.error("❌ Error fetching mentor status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get questions in the current mentor's groups.
 * GET /api/community/mentor/questions
 */
export const getMentorQuestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const profile = await MentorProfile.findOne({ userId, isActive: true })
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .populate('groupIds', 'name groupType category planSlug')
      .lean();

    if (!profile) {
      return res.status(403).json({
        success: false,
        code: 'NOT_A_MENTOR',
        message: "Only mentors can access the mentor question queue"
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = parseQuestionFilter(req.query.status);

    const mentorMemberships = await GroupMember.find({
      userId,
      isActive: true,
      role: 'mentor',
    }).select('groupId').lean();

    const directGroupIds = [...new Set([
      ...(profile.groupIds || []).map((group) => String(group._id)),
      ...mentorMemberships.map((membership) => String(membership.groupId)),
    ])];
    const groupIds = await expandGroupIdsWithChildren(directGroupIds);

    const query = {
      postType: 'question',
      groupId: { $in: groupIds },
      isActive: true,
      isBlocked: { $ne: true },
    };

    if (status === 'unanswered') query.isResolved = false;
    if (status === 'resolved') query.isResolved = true;
    if (req.query.assigned === 'true') query.assignedMentorId = profile._id;

    const [questions, total] = await Promise.all([
      Post.find(query)
        .populate('userId', 'displayName photoURL subscriptionPlan')
        .sort({ isPinned: -1, isResolved: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(query),
    ]);

    const mentorContext = await getMentorContextForUser(userId);
    const formattedQuestions = await formatPostsForUser(questions, userId, mentorContext);

    return res.status(200).json({
      success: true,
      mentor: formatMentorProfile(profile),
      questions: formattedQuestions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalQuestions: total,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching mentor questions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get posts from a specific group (or combined feed for plan-level groups)
 * GET /api/community/groups/:groupId/posts
 */
export const getGroupPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const postType = parsePostType(req.query.postType);
    const questionStatus = parseQuestionFilter(req.query.status);

    // Determine which group IDs to query posts from
    // If this is a plan-level parent group, get posts from all child subgroups too
    const group = await Group.findById(groupId).select('groupType planSlug isPublic isActive').lean();
    if (!group || group.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    const publicGroup = isPublicGroup(group);

    // Public (General) groups are open to any authenticated user.
    if (!publicGroup) {
      const access = await evaluateCommunityAccess(userId);
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Community access requires an active membership"
        });
      }
    }

    // Check membership; auto-enroll into public groups.
    let membership = await GroupMember.findOne({ groupId, userId, isActive: true });
    if (!membership && publicGroup) {
      await enrollUserInGroup(groupId, userId);
      membership = true;
    }
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    let queryGroupIds = [groupId];

    if (group.groupType === 'plan') {
      const childGroups = await Group.find({ parentGroupId: groupId, isActive: true })
        .select('_id')
        .lean();
      const childIds = childGroups.map((g) => g._id);
      queryGroupIds = [groupId, ...childIds];
    }

    // Build post query - use $in for combined feeds
    const postQuery = applyPostTypeFilter(
      { groupId: { $in: queryGroupIds }, isActive: true, isBlocked: { $ne: true } },
      postType,
      questionStatus
    );

    if (postType === 'question' && req.query.mine === 'true') {
      postQuery.userId = userId;
    }

    if (postType === 'question' && req.query.mentorId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.mentorId)) {
        return res.status(400).json({ success: false, message: "Invalid mentor id" });
      }
      postQuery.assignedMentorId = req.query.mentorId;
    }

    const sort = postType === 'question'
      ? { isPinned: -1, isResolved: 1, createdAt: -1 }
      : { isPinned: -1, createdAt: -1 };

    // Get posts
    const posts = await Post.find(postQuery)
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(postQuery);

    // Check if current user liked each post and can moderate as a mentor/author
    const postsWithUserLike = await formatPostsForUser(posts, userId);

    return res.status(200).json({
      success: true,
      posts: postsWithUserLike,
      postType,
      isCombinedFeed: queryGroupIds.length > 1,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });

  } catch (error) {
    console.error("❌ Error fetching group posts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get posts across every group the user can access ("All" view).
 * GET /api/community/feed
 */
export const getAllFeedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const postType = parsePostType(req.query.postType);
    const questionStatus = parseQuestionFilter(req.query.status);

    const memberships = await GroupMember.find({ userId, isActive: true })
      .select('groupId')
      .lean();
    const memberGroupIds = memberships.map((m) => String(m.groupId));

    const publicGroupIds = (await getPublicGroupIds()).map((id) => String(id));

    const queryGroupIds = [...new Set([...memberGroupIds, ...publicGroupIds])];

    if (!queryGroupIds.length) {
      return res.status(200).json({
        success: true,
        posts: [],
        isCombinedFeed: true,
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalPosts: 0,
          hasMore: false
        }
      });
    }

    const postQuery = applyPostTypeFilter(
      { groupId: { $in: queryGroupIds }, isActive: true, isBlocked: { $ne: true } },
      postType,
      questionStatus
    );

    if (postType === 'question' && req.query.mine === 'true') {
      postQuery.userId = userId;
    }

    if (postType === 'question' && req.query.mentorId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.mentorId)) {
        return res.status(400).json({ success: false, message: "Invalid mentor id" });
      }
      postQuery.assignedMentorId = req.query.mentorId;
    }

    const sort = postType === 'question'
      ? { isPinned: -1, isResolved: 1, createdAt: -1 }
      : { isPinned: -1, createdAt: -1 };

    const posts = await Post.find(postQuery)
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(postQuery);

    const postsWithUserLike = await formatPostsForUser(posts, userId);

    return res.status(200).json({
      success: true,
      posts: postsWithUserLike,
      postType,
      isCombinedFeed: queryGroupIds.length > 1,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });

  } catch (error) {
    console.error("❌ Error fetching all feed posts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Create a new post in a group
 * POST /api/community/groups/:groupId/posts
 */
export const createPost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const { content, images, tags } = req.body;
    const postType = parsePostType(req.body.postType);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const assignedMentorId = req.body.assignedMentorId || null;

    if (postType === 'question' && title.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Question title must be between 5 and 200 characters"
      });
    }

    if (req.user?.communityPostingBlocked) {
      return rejectBlockedUser(res);
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Post content is required"
      });
    }

    const group = await Group.findById(groupId).select('planSlug isPublic isActive').lean();
    if (!group || group.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Members can post; public (General) groups auto-enroll any authenticated user.
    let membership = await GroupMember.findOne({ groupId, userId, isActive: true });
    if (!membership && isPublicGroup(group)) {
      await enrollUserInGroup(groupId, userId);
      membership = true;
    }
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    let mentorProfile = null;
    if (postType === 'question' && assignedMentorId) {
      mentorProfile = await MentorProfile.findOne({
        _id: assignedMentorId,
        isActive: true,
        groupIds: groupId,
      }).populate('userId', 'displayName');

      if (!mentorProfile) {
        return res.status(400).json({
          success: false,
          message: "The selected mentor is not available for this group"
        });
      }
    }

    const post = await Post.create({
      userId,
      groupId,
      postType,
      title: postType === 'question' ? title : null,
      content: content.trim(),
      images: images || [],
      tags: tags || [],
      assignedMentorId: mentorProfile?._id || null,
    });

    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'displayName photoURL subscriptionPlan');

    await awardCommunityPoints({
      userId,
      action: postType === 'question' ? 'question_created' : 'discussion_created',
      refType: 'post',
      refId: post._id,
      groupId,
      dedupeKey: `${postType}:${post._id}`,
    });
    evaluateCommunityAchievements(userId);

    console.log(`✅ ${postType === 'question' ? 'Question' : 'Post'} created in group ${groupId} by user ${userId}`);

    const mentorAuthorIds = await getMentorAuthorIds([populatedPost]);

    if (mentorProfile?.userId) {
      await notifyCommunityUser({
        userId: mentorProfile.userId._id || mentorProfile.userId,
        type: 'mentor_question',
        title: 'New question for you',
        message: `${req.user.displayName || 'A community member'} asked: ${title}`,
        relatedId: post._id,
        relatedType: 'post',
        actionUrl: '/(home)/mentor-questions',
        icon: '🎓',
      });
    }

    return res.status(201).json({
      success: true,
      message: postType === 'question' ? "Question created successfully" : "Post created successfully",
      post: {
        _id: populatedPost._id,
        content: populatedPost.content,
        postType: populatedPost.postType,
        title: populatedPost.title,
        isResolved: populatedPost.isResolved,
        acceptedCommentId: populatedPost.acceptedCommentId,
        assignedMentorId: populatedPost.assignedMentorId,
        images: populatedPost.images,
        likeCount: populatedPost.likeCount,
        commentCount: populatedPost.commentCount,
        voteCount: populatedPost.voteCount,
        viewerCanManageQuestion: postType === 'question',
        author: {
          _id: populatedPost.userId._id,
          displayName: populatedPost.userId.displayName,
          photoURL: populatedPost.userId.photoURL,
          subscriptionPlan: populatedPost.userId.subscriptionPlan,
          isMentor: mentorAuthorIds.has(String(populatedPost.userId._id)),
        },
        tags: populatedPost.tags,
        createdAt: populatedPost.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error creating post:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Like/Unlike a post
 * POST /api/community/posts/:postId/like
 */
export const togglePostLike = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    if (req.user?.communityPostingBlocked) {
      return rejectBlockedUser(res);
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    // Atomic toggle — prevents race conditions on concurrent likes
    const alreadyLiked = post.likes.some(like => like.userId.toString() === userId.toString());

    if (alreadyLiked) {
      await Post.findOneAndUpdate(
        { _id: postId, 'likes.userId': userId },
        { $pull: { likes: { userId } }, $inc: { likeCount: -1 } }
      );
    } else {
      await Post.findOneAndUpdate(
        { _id: postId, 'likes.userId': { $ne: userId } },
        { $addToSet: { likes: { userId } }, $inc: { likeCount: 1 } }
      );
    }

    const updated = await Post.findById(postId).select('likeCount').lean();

    const dedupeKey = `like:${post._id}:${userId}`;
    if (alreadyLiked) {
      await revokeCommunityPoints(dedupeKey);
    } else if (post.userId && post.userId.toString() !== userId.toString()) {
      await awardCommunityPoints({
        userId: post.userId,
        action: 'like_received',
        refType: 'post',
        refId: post._id,
        groupId: post.groupId,
        dedupeKey,
        metadata: { likerId: userId },
      });
    }

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likeCount: updated?.likeCount ?? post.likeCount
    });

  } catch (error) {
    console.error("❌ Error toggling post like:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Upvote/remove upvote on a question
 * POST /api/community/posts/:postId/vote
 */
export const togglePostVote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    if (req.user?.communityPostingBlocked) {
      return rejectBlockedUser(res);
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    if ((post.postType || 'discussion') !== 'question') {
      return res.status(400).json({
        success: false,
        message: "Only questions can be upvoted"
      });
    }

    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const alreadyVoted = post.votes.some(vote => vote.userId.toString() === userId.toString());

    if (alreadyVoted) {
      await Post.findOneAndUpdate(
        { _id: postId, 'votes.userId': userId },
        { $pull: { votes: { userId } }, $inc: { voteCount: -1 } }
      );
    } else {
      await Post.findOneAndUpdate(
        { _id: postId, 'votes.userId': { $ne: userId } },
        { $addToSet: { votes: { userId } }, $inc: { voteCount: 1 } }
      );
    }

    const updated = await Post.findById(postId).select('voteCount').lean();

    const dedupeKey = `vote:${post._id}:${userId}`;
    if (alreadyVoted) {
      await revokeCommunityPoints(dedupeKey);
    } else if (post.userId && post.userId.toString() !== userId.toString()) {
      await awardCommunityPoints({
        userId: post.userId,
        action: 'upvote_received',
        refType: 'post',
        refId: post._id,
        groupId: post.groupId,
        dedupeKey,
        metadata: { voterId: userId },
      });
    }

    return res.status(200).json({
      success: true,
      voted: !alreadyVoted,
      voteCount: Math.max(0, updated?.voteCount ?? post.voteCount ?? 0)
    });

  } catch (error) {
    console.error("❌ Error toggling post vote:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Mark a question resolved/unresolved.
 * PATCH /api/community/posts/:postId/resolve
 */
export const resolveQuestion = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;
    const resolved = req.body?.resolved === undefined ? true : req.body.resolved === true;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if ((post.postType || 'discussion') !== 'question') {
      return res.status(400).json({ success: false, message: "Only questions can be resolved" });
    }

    const canManage = await canManageQuestion(post, userId);
    if (!canManage) {
      return res.status(403).json({
        success: false,
        message: "Only the question author or a mentor can resolve this question"
      });
    }

    post.isResolved = resolved;
    await post.save();

    return res.status(200).json({
      success: true,
      isResolved: post.isResolved,
      acceptedCommentId: post.acceptedCommentId || null,
    });
  } catch (error) {
    console.error("❌ Error resolving question:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Accept an answer on a question.
 * PATCH /api/community/posts/:postId/accept-answer
 */
export const acceptAnswer = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;
    const { commentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: "A valid answer id is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if ((post.postType || 'discussion') !== 'question') {
      return res.status(400).json({ success: false, message: "Only questions can have an accepted answer" });
    }

    const canManage = await canManageQuestion(post, userId);
    if (!canManage) {
      return res.status(403).json({
        success: false,
        message: "Only the question author or a mentor can accept an answer"
      });
    }

    const comment = await Comment.findOne({ _id: commentId, postId, isActive: true });
    if (!comment) {
      return res.status(404).json({ success: false, message: "Answer not found" });
    }

    if (comment.userId.toString() === post.userId?.toString()) {
      return res.status(400).json({ success: false, message: "You cannot accept your own answer" });
    }

    await revokeCommunityPointsForRef({
      refType: 'post',
      refId: post._id,
      action: 'answer_accepted',
    });

    post.acceptedCommentId = comment._id;
    post.isResolved = true;
    await post.save();

    await awardCommunityPoints({
      userId: comment.userId,
      action: 'answer_accepted',
      refType: 'post',
      refId: post._id,
      groupId: post.groupId,
      dedupeKey: `accept:${post._id}:${comment._id}`,
      metadata: { commentId: comment._id },
    });
    evaluateCommunityAchievements(comment.userId);

    await notifyCommunityUser({
      userId: comment.userId,
      type: 'community_answer_accepted',
      title: 'Your answer was accepted',
      message: `Your answer on "${post.title || 'a question'}" was accepted.`,
      relatedId: post._id,
      relatedType: 'post',
      actionUrl: '/(home)/community',
      icon: '✅',
    });

    return res.status(200).json({
      success: true,
      acceptedCommentId: post.acceptedCommentId,
      isResolved: post.isResolved,
    });
  } catch (error) {
    console.error("❌ Error accepting answer:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get comments for a post
 * GET /api/community/posts/:postId/comments
 */
export const getPostComments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const [comments, total] = await Promise.all([
      Comment.find({ postId, isActive: true })
        .populate('userId', 'displayName photoURL subscriptionPlan')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Comment.countDocuments({ postId, isActive: true })
    ]);

    const mentorAuthorIds = await getMentorAuthorIds(comments);

    const commentsWithUserLike = comments.map(comment => {
      const userLiked = comment.likes.some(like => like.userId.toString() === userId.toString());
      return {
        _id: comment._id,
        postId: comment.postId,
        parentCommentId: comment.parentCommentId || null,
        content: comment.content,
        likeCount: comment.likeCount,
        replyCount: comment.replyCount || 0,
        isAccepted: post.acceptedCommentId?.toString() === comment._id.toString(),
        userLiked,
        author: {
          _id: comment.userId._id,
          displayName: comment.userId.displayName,
          photoURL: comment.userId.photoURL,
          subscriptionPlan: comment.userId.subscriptionPlan,
          isMentor: mentorAuthorIds.has(String(comment.userId._id)),
        },
        createdAt: comment.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      comments: commentsWithUserLike,
      totalComments: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("❌ Error fetching comments:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add a comment to a post
 * POST /api/community/posts/:postId/comments
 */
export const addComment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;

    if (req.user?.communityPostingBlocked) {
      return rejectBlockedUser(res);
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required"
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findOne({ _id: parentCommentId, postId, isActive: true })
        .populate('userId', 'displayName photoURL subscriptionPlan');
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "The comment you want to reply to was not found"
        });
      }
    }

    const comment = await Comment.create({
      postId,
      userId,
      parentCommentId: parentComment ? parentComment._id : null,
      content: content.trim()
    });

    await awardCommunityPoints({
      userId,
      action: 'comment_created',
      refType: 'comment',
      refId: comment._id,
      groupId: post.groupId,
      dedupeKey: `comment:${comment._id}`,
    });
    evaluateCommunityAchievements(userId);

    // Atomic increment — prevents lost updates on concurrent comments
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    if (parentComment) {
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'displayName photoURL subscriptionPlan');

    const mentorAuthorIds = await getMentorAuthorIds([populatedComment]);

    const notificationRecipients = new Set();
    if (post.userId && post.userId.toString() !== userId.toString()) {
      notificationRecipients.add(post.userId.toString());
    }
    if (parentComment?.userId && parentComment.userId.toString() !== userId.toString()) {
      notificationRecipients.add(parentComment.userId.toString());
    }

    const isQuestion = (post.postType || 'discussion') === 'question';
    for (const recipientId of notificationRecipients) {
      await notifyCommunityUser({
        userId: recipientId,
        type: isQuestion ? 'community_answer' : 'community_comment',
        title: isQuestion ? 'New answer to your question' : 'New comment on your post',
        message: isQuestion
          ? `${req.user.displayName || 'Someone'} answered "${post.title || 'your question'}"`
          : `${req.user.displayName || 'Someone'} commented on your post.`,
        relatedId: post._id,
        relatedType: 'post',
        actionUrl: '/(home)/community',
        icon: isQuestion ? '💡' : '💬',
      });
    }

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: {
        _id: populatedComment._id,
        postId: populatedComment.postId,
        parentCommentId: populatedComment.parentCommentId || null,
        content: populatedComment.content,
        likeCount: populatedComment.likeCount,
        replyCount: populatedComment.replyCount || 0,
        isAccepted: false,
        author: {
          _id: populatedComment.userId._id,
          displayName: populatedComment.userId.displayName,
          photoURL: populatedComment.userId.photoURL,
          subscriptionPlan: populatedComment.userId.subscriptionPlan,
          isMentor: mentorAuthorIds.has(String(populatedComment.userId._id)),
        },
        parentComment: parentComment ? {
          _id: parentComment._id,
          content: parentComment.content,
          author: {
            _id: parentComment.userId?._id,
            displayName: parentComment.userId?.displayName,
            photoURL: parentComment.userId?.photoURL,
            subscriptionPlan: parentComment.userId?.subscriptionPlan
          }
        } : null,
        createdAt: populatedComment.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error adding comment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Like/Unlike a comment
 * POST /api/community/comments/:commentId/like
 */
export const toggleCommentLike = async (req, res) => {
  try {
    const userId = req.user._id;
    const { commentId } = req.params;

    if (req.user?.communityPostingBlocked) {
      return rejectBlockedUser(res);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Ensure the caller is a member of the group that owns this comment's post
    const post = await Post.findById(comment.postId).select('groupId').lean();
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const alreadyLiked = comment.likes.some(like => like.userId.toString() === userId.toString());

    if (alreadyLiked) {
      await Comment.findOneAndUpdate(
        { _id: commentId, 'likes.userId': userId },
        { $pull: { likes: { userId } }, $inc: { likeCount: -1 } }
      );
    } else {
      await Comment.findOneAndUpdate(
        { _id: commentId, 'likes.userId': { $ne: userId } },
        { $addToSet: { likes: { userId } }, $inc: { likeCount: 1 } }
      );
    }

    const updated = await Comment.findById(commentId).select('likeCount').lean();

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likeCount: updated?.likeCount ?? comment.likeCount
    });

  } catch (error) {
    console.error("❌ Error toggling comment like:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete a comment (only by comment author)
 * DELETE /api/community/comments/:commentId
 */
export const deleteComment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Only comment author can delete
    if (comment.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments"
      });
    }

    // Soft delete
    comment.isActive = false;
    await comment.save();

    await revokeCommunityPointsForRef({ refType: 'comment', refId: comment._id });

    const post = await Post.findById(comment.postId).select('acceptedCommentId');
    if (post?.acceptedCommentId?.toString() === comment._id.toString()) {
      await Post.findByIdAndUpdate(comment.postId, {
        $set: { acceptedCommentId: null, isResolved: false },
      });
      await revokeCommunityPointsForRef({
        refType: 'post',
        refId: comment.postId,
        action: 'answer_accepted',
      });
    }

    // Decrement post commentCount
    await Post.findByIdAndUpdate(comment.postId, { $inc: { commentCount: -1 } });

    // If it's a reply, decrement parent comment's replyCount
    if (comment.parentCommentId) {
      await Comment.findByIdAndUpdate(comment.parentCommentId, { $inc: { replyCount: -1 } });
    }

    console.log(`🗑️ Comment ${commentId} deleted by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting comment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete a post (only by post author)
 * DELETE /api/community/posts/:postId
 */
export const deletePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // User must still be an active group member
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    // Only post author can delete
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts"
      });
    }

    // Soft delete
    post.isActive = false;
    await post.save();

    const commentIds = await Comment.find({ postId }).distinct('_id');
    await revokeCommunityPointsForPost(post._id, commentIds);

    // Also soft delete all comments
    await Comment.updateMany({ postId }, { isActive: false });

    console.log(`🗑️ Post ${postId} deleted by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting post:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
