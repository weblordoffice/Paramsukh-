import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import { Comment, Group, Post } from '../src/models/community.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';
import { enrollUserInGroup, ensureGeneralGroup } from '../src/services/community.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEMO_PHONE = '+919999999999';
const CATEGORIES = ['physical', 'mental', 'spiritual'];

const IMG = (id) => `https://images.unsplash.com/${id}?w=1000`;

const planLabel = (slug) =>
  String(slug || '')
    .trim()
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Plan';

const categoryLabel = (category) =>
  ({ physical: 'Physical', mental: 'Mental', financial: 'Financial', relationship: 'Relationship', spiritual: 'Spiritual', general: 'General' }[category]) ||
  (category ? category.charAt(0).toUpperCase() + category.slice(1) : 'General');

const authors = [
  { key: 'aarav', displayName: 'Aarav Sharma', phone: '+919000000001', email: 'seed.aarav@paramsukh.test' },
  { key: 'diya', displayName: 'Diya Patel', phone: '+919000000002', email: 'seed.diya@paramsukh.test' },
  { key: 'rohan', displayName: 'Rohan Verma', phone: '+919000000003', email: 'seed.rohan@paramsukh.test' },
];

const ensureAuthor = (author) =>
  User.findOneAndUpdate(
    { email: author.email },
    {
      $set: {
        displayName: author.displayName,
        phone: author.phone,
        email: author.email,
        authProvider: 'phone',
        subscriptionPlan: 'silver',
        subscriptionStatus: 'active',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

const ensurePlanGroup = (planSlug) =>
  Group.findOneAndUpdate(
    { groupType: 'plan', planSlug },
    {
      $set: {
        name: `${planLabel(planSlug)} Community`,
        description: `Community for ${planLabel(planSlug)} plan members`,
        isActive: true,
        category: null,
        parentGroupId: null,
      },
      $setOnInsert: { memberCount: 0 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

const ensureCategoryGroup = (planSlug, category, parentGroupId) =>
  Group.findOneAndUpdate(
    { groupType: 'category', planSlug, category },
    {
      $set: {
        name: `${planLabel(planSlug)} - ${categoryLabel(category)} Community`,
        description: `${planLabel(planSlug)} members enrolled in ${categoryLabel(category)} courses`,
        isActive: true,
        parentGroupId: parentGroupId || null,
      },
      $setOnInsert: { memberCount: 0 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

const upsertPost = async ({ group, author, content, images = [], tags = [], pinned = false, isAdmin = false, authorName = null, likes = [] }) => {
  const likeDocs = likes.map((userId) => ({ userId, createdAt: new Date() }));
  return Post.findOneAndUpdate(
    { groupId: group._id, content },
    {
      $set: {
        userId: isAdmin ? null : author?._id || null,
        isAdminPost: isAdmin,
        authorName,
        content,
        images,
        tags,
        likes: likeDocs,
        likeCount: likeDocs.length,
        isPinned: pinned,
        isActive: true,
        isBlocked: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const upsertComment = ({ post, author, content, likes = [] }) =>
  Comment.findOneAndUpdate(
    { postId: post._id, userId: author._id, content },
    {
      $set: {
        postId: post._id,
        userId: author._id,
        content,
        likes: likes.map((userId) => ({ userId, createdAt: new Date() })),
        likeCount: likes.length,
        isActive: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

const seedComments = async (post, items) => {
  for (const item of items) {
    await upsertComment({ post, author: item.author, content: item.content, likes: item.likes || [] });
  }
  await Post.findByIdAndUpdate(post._id, { $set: { commentCount: items.length } });
};

const seedCommunity = async () => {
  try {
    await connectDatabase();

    const general = await ensureGeneralGroup();

    const a = {};
    for (const author of authors) {
      a[author.key] = await ensureAuthor(author);
    }
    const viewer = (await User.findOne({ phone: DEMO_PHONE })) || a.aarav;

    const members = [viewer, a.aarav, a.diya, a.rohan];
    for (const user of members) {
      await enrollUserInGroup(general._id, user._id);
    }

    const activeMembership = await UserMembership.findOne({ userId: viewer._id, status: 'active' })
      .populate('planId')
      .sort({ endDate: -1 });
    let planSlug = activeMembership?.planId?.slug || null;
    if (!planSlug && viewer.subscriptionPlan && viewer.subscriptionPlan !== 'free') {
      planSlug = viewer.subscriptionPlan;
    }
    if (!planSlug) {
      const anyPlan = await MembershipPlan.findOne({ status: 'published' }).sort({ displayOrder: -1 });
      planSlug = anyPlan?.slug || null;
    }

    let planGroup = null;
    const categoryGroups = {};
    if (planSlug && planSlug !== 'free') {
      planGroup = await ensurePlanGroup(planSlug);
      await enrollUserInGroup(planGroup._id, viewer._id);
      for (const category of CATEGORIES) {
        const group = await ensureCategoryGroup(planSlug, category, planGroup._id);
        categoryGroups[category] = group;
        await enrollUserInGroup(group._id, viewer._id);
      }
    }

    // --- General (public) group: text, image, and a pinned admin announcement ---
    const generalAnnouncement = await upsertPost({
      group: general,
      isAdmin: true,
      authorName: 'ParamSukh Admin',
      pinned: true,
      likes: [a.diya._id, a.rohan._id],
      content:
        '📢 Welcome to the ParamSukh Community! Be kind, stay curious, and share your journey. Please read the community guidelines before posting.',
    });

    const generalQuestion = await upsertPost({
      group: general,
      author: a.aarav,
      tags: ['meditation', 'beginner'],
      likes: [viewer._id, a.diya._id],
      content: 'Starting my 21-day meditation challenge today. Any tips for staying consistent in the first week?',
    });

    const generalPhoto = await upsertPost({
      group: general,
      author: a.diya,
      images: [IMG('photo-1470252649378-9c29740c9fa8')],
      tags: ['gratitude'],
      likes: [viewer._id, a.aarav._id, a.rohan._id],
      content: 'Morning sunrise from my balcony after today\u2019s practice. Gratitude changes everything. 🌅',
    });

    await seedComments(generalQuestion, [
      { author: a.diya, content: 'Keep it small — 5 minutes a day beats 30 minutes once a week. You\u2019ve got this!', likes: [a.aarav._id] },
      { author: a.rohan, content: 'Same time every morning helped me the most. Habit stacking works.', likes: [] },
    ]);
    await seedComments(generalPhoto, [
      { author: a.aarav, content: 'Beautiful! That view would make anyone meditate 😄', likes: [a.diya._id] },
    ]);

    // --- Plan + category groups ---
    if (planGroup) {
      const planAma = await upsertPost({
        group: planGroup,
        author: a.rohan,
        tags: ['announcement'],
        likes: [viewer._id],
        content: 'Members-only AMA this Friday: bring your questions on building a daily practice that actually sticks.',
      });

      const planTemplate = await upsertPost({
        group: planGroup,
        author: a.aarav,
        images: [IMG('photo-1512820790803-83ca734da794')],
        tags: ['reflection'],
        likes: [a.diya._id],
        content: 'Sharing my weekly reflection template. It takes 10 minutes and keeps me grounded.',
      });

      await seedComments(planAma, [
        { author: a.diya, content: 'Can we submit questions in advance?', likes: [] },
        { author: a.rohan, content: 'Yes — drop them in this thread and I\u2019ll cover as many as I can.', likes: [a.diya._id, a.aarav._id] },
      ]);
      await seedComments(planTemplate, [
        { author: a.rohan, content: 'Saving this. Simple and repeatable — exactly what I needed.', likes: [] },
      ]);

      if (categoryGroups.physical) {
        await upsertPost({
          group: categoryGroups.physical,
          author: a.diya,
          images: [IMG('photo-1544367567-0f2fcb009e0b')],
          tags: ['yoga', 'morning'],
          likes: [viewer._id, a.rohan._id],
          content: 'New morning yoga flow done — 20 minutes of hips and hamstrings. Feeling light!',
        });
      }
      if (categoryGroups.mental) {
        await upsertPost({
          group: categoryGroups.mental,
          author: a.rohan,
          tags: ['breathwork', 'stress'],
          likes: [a.aarav._id],
          content: 'Tried the 4-7-8 breathing technique before a stressful meeting. It genuinely helped. Highly recommend.',
        });
      }
      if (categoryGroups.spiritual) {
        await upsertPost({
          group: categoryGroups.spiritual,
          author: a.aarav,
          tags: ['scripture', 'reflection'],
          likes: [viewer._id],
          content: 'A line from today\u2019s reading that stayed with me: "Peace comes from within. Do not seek it without."',
        });
      }
    }

    const groupIds = [general._id, planGroup?._id, ...Object.values(categoryGroups).map((g) => g._id)].filter(Boolean);
    const seededPosts = await Post.find({ groupId: { $in: groupIds } })
      .populate('groupId', 'name groupType planSlug category')
      .populate('userId', 'displayName')
      .sort({ createdAt: -1 })
      .lean();

    console.table(
      seededPosts.map((post) => ({
        group: post.groupId?.name,
        author: post.authorName || post.userId?.displayName || 'ParamSukh Admin',
        type: post.images?.length ? 'image' : 'text',
        pinned: post.isPinned,
        likes: post.likeCount,
        comments: post.commentCount,
      }))
    );
    console.log(
      `Community seeded — groups: ${groupIds.length}, posts: ${await Post.countDocuments({ groupId: { $in: groupIds } })}, comments: ${await Comment.countDocuments({ postId: { $in: seededPosts.map((p) => p._id) } })}`
    );
    console.log(`Viewer: ${viewer.displayName} (${viewer.phone}) | plan: ${planSlug || 'none (General only)'} | general group: ${general.name}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed community:', error);
    process.exit(1);
  }
};

seedCommunity();
