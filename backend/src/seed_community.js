import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/user.models.js';
import { Group, GroupMember, Post, Comment } from './models/community.models.js';

dotenv.config();

const userId = "6a46363086cce2ebdb030771";

async function seed() {
  console.log('Connecting to MongoDB:', process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Ensure user has community access in user fields
  const user = await User.findById(userId);
  if (!user) {
    console.error(`User ${userId} not found. Please verify user ID!`);
    await mongoose.connection.close();
    return;
  }

  user.subscriptionPlan = 'gold';
  user.subscriptionStatus = 'active';
  await user.save();
  console.log(`Updated user ${user.displayName} subscriptionPlan=gold, status=active`);

  // 2. Clear previous community data
  await GroupMember.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
  await Group.deleteMany({});
  console.log('Cleared previous community data');

  // 3. Create plan group
  const planGroup = await Group.create({
    name: 'Gold Membership Community',
    description: 'Exclusive discussion space for Gold tier members.',
    groupType: 'plan',
    planSlug: 'gold',
    memberCount: 1,
    isActive: true
  });
  console.log('Created plan group:', planGroup.name, planGroup._id);

  // 4. Create category groups (parentGroupId links to planGroup)
  const categoryGroup1 = await Group.create({
    name: 'Yoga & Physical Practices',
    description: 'Discuss postures, breathing exercises, and daily physical routines.',
    groupType: 'category',
    planSlug: 'gold',
    category: 'physical',
    parentGroupId: planGroup._id,
    memberCount: 1,
    isActive: true
  });
  console.log('Created category group 1:', categoryGroup1.name, categoryGroup1._id);

  const categoryGroup2 = await Group.create({
    name: 'Meditation & Spiritual Discussion',
    description: 'Share experiences with mantras, mindfulness, and internal peace.',
    groupType: 'category',
    planSlug: 'gold',
    category: 'spiritual',
    parentGroupId: planGroup._id,
    memberCount: 1,
    isActive: true
  });
  console.log('Created category group 2:', categoryGroup2.name, categoryGroup2._id);

  // 5. Create course group (mock course ID)
  const courseGroup = await Group.create({
    name: 'Rudraksha Mala Devotees',
    description: 'A course circle for learning Rudraksha spiritual energies.',
    groupType: 'course',
    courseId: new mongoose.Types.ObjectId(), // mock course
    memberCount: 1,
    isActive: true
  });
  console.log('Created course group:', courseGroup.name, courseGroup._id);

  // 6. Join user to all groups
  const groupsToJoin = [planGroup, categoryGroup1, categoryGroup2, courseGroup];
  for (const group of groupsToJoin) {
    await GroupMember.create({
      groupId: group._id,
      userId: user._id,
      role: 'member',
      isActive: true
    });
  }
  console.log('Added user memberships to all groups');

  // 7. Seed posts and comments in physical category group
  const post1 = await Post.create({
    userId: user._id,
    groupId: categoryGroup1._id,
    content: 'Hi community! Just started the morning Surya Namaskar session. Feeling incredibly energized!',
    likeCount: 5,
    commentCount: 2,
    tags: ['suryanamaskar', 'morning_routine'],
    isActive: true
  });
  console.log('Created post 1 in Yoga group:', post1._id);

  await Comment.create({
    postId: post1._id,
    userId: user._id,
    content: 'Keep it up! Consistency is key.',
    likeCount: 2,
    isActive: true
  });
  await Comment.create({
    postId: post1._id,
    userId: user._id,
    content: 'Do you practice breathing exercises before or after posture work?',
    likeCount: 1,
    isActive: true
  });

  // 8. Seed post in spiritual category group
  const post2 = await Post.create({
    userId: user._id,
    groupId: categoryGroup2._id,
    content: 'Does anyone have tips for staying focused during the 20-minute silent meditation?',
    likeCount: 3,
    commentCount: 1,
    tags: ['meditation', 'focus'],
    isActive: true
  });
  console.log('Created post 2 in Meditation group:', post2._id);

  await Comment.create({
    postId: post2._id,
    userId: user._id,
    content: 'Try counting breaths from 1 to 10. Start over if your mind wanders.',
    likeCount: 3,
    isActive: true
  });

  console.log('Seeding completed successfully!');
  await mongoose.connection.close();
}

seed().catch(err => {
  console.error('Error seeding community data:', err);
  process.exit(1);
});
