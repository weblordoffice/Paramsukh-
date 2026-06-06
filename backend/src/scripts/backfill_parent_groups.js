/**
 * One-time backfill script: Create plan-level parent groups and link existing category groups.
 * 
 * Usage:
 *   node --experimental-modules src/scripts/backfill_parent_groups.js
 *
 * What it does:
 *   1. Finds all existing groupType:'category' groups
 *   2. For each unique planSlug, creates a groupType:'plan' parent group
 *   3. Sets parentGroupId on all matching category groups
 *   4. Ensures all users who are members of category groups are also added to the parent
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment');
  process.exit(1);
}

async function backfill() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  const db = mongoose.connection.db;
  const groupsCollection = db.collection('groups');
  const groupMembersCollection = db.collection('groupmembers');

  // Step 1: Find all distinct planSlugs from category groups
  const categoryGroups = await groupsCollection.find({ groupType: 'category', planSlug: { $type: 'string' } }).toArray();
  const planSlugs = [...new Set(categoryGroups.map(g => g.planSlug).filter(Boolean))];

  console.log(`📊 Found ${categoryGroups.length} category groups across ${planSlugs.length} plans: ${planSlugs.join(', ')}`);

  if (planSlugs.length === 0) {
    console.log('ℹ️  No category groups to backfill. Done.');
    await mongoose.disconnect();
    return;
  }

  const formatPlanLabel = (slug) => {
    return slug
      .split(/[-_\s]+/g)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  // Step 2: For each planSlug, create or find the plan-level parent group
  const planParentMap = new Map(); // planSlug -> parentGroupId

  for (const planSlug of planSlugs) {
    const planLabel = formatPlanLabel(planSlug);
    const filter = { groupType: 'plan', planSlug };

    let parentGroup = await groupsCollection.findOne(filter);
    if (!parentGroup) {
      const result = await groupsCollection.insertOne({
        groupType: 'plan',
        planSlug,
        category: null,
        parentGroupId: null,
        name: `${planLabel} Community`,
        description: `Community for ${planLabel} plan members`,
        memberCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      parentGroup = { _id: result.insertedId };
      console.log(`  ✅ Created plan parent group: "${planLabel} Community" (${result.insertedId})`);
    } else {
      console.log(`  ℹ️  Plan parent group already exists: "${planLabel} Community" (${parentGroup._id})`);
    }

    planParentMap.set(planSlug, parentGroup._id);
  }

  // Step 3: Link category groups to their parent
  let linkedCount = 0;
  for (const catGroup of categoryGroups) {
    const parentId = planParentMap.get(catGroup.planSlug);
    if (parentId && String(catGroup.parentGroupId) !== String(parentId)) {
      await groupsCollection.updateOne(
        { _id: catGroup._id },
        { $set: { parentGroupId: parentId, updatedAt: new Date() } }
      );
      linkedCount++;
    }
  }
  console.log(`🔗 Linked ${linkedCount} category groups to their plan parents`);

  // Step 4: Ensure all members of category groups are also members of the parent group
  let addedMembers = 0;
  for (const [planSlug, parentId] of planParentMap) {
    // Get all category groups for this plan
    const planCategoryGroups = categoryGroups.filter(g => g.planSlug === planSlug);
    const categoryGroupIds = planCategoryGroups.map(g => g._id);

    // Find all unique active members across these category groups
    const memberDocs = await groupMembersCollection.find({
      groupId: { $in: categoryGroupIds },
      isActive: true,
    }).toArray();

    const uniqueUserIds = [...new Set(memberDocs.map(m => String(m.userId)))];

    for (const userIdStr of uniqueUserIds) {
      const userId = new mongoose.Types.ObjectId(userIdStr);
      // Check if user is already a member of the parent group
      const existing = await groupMembersCollection.findOne({ groupId: parentId, userId });
      if (!existing) {
        await groupMembersCollection.insertOne({
          groupId: parentId,
          userId,
          role: 'member',
          isActive: true,
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        addedMembers++;
      } else if (!existing.isActive) {
        await groupMembersCollection.updateOne(
          { _id: existing._id },
          { $set: { isActive: true, updatedAt: new Date() } }
        );
        addedMembers++;
      }
    }

    // Update parent group member count
    const activeMemberCount = await groupMembersCollection.countDocuments({
      groupId: parentId,
      isActive: true,
    });
    await groupsCollection.updateOne(
      { _id: parentId },
      { $set: { memberCount: activeMemberCount, updatedAt: new Date() } }
    );

    console.log(`  📊 ${formatPlanLabel(planSlug)}: ${uniqueUserIds.length} unique members, ${activeMemberCount} active in parent`);
  }

  console.log(`👥 Added ${addedMembers} new parent group memberships`);
  console.log('✅ Backfill complete!');

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

backfill().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
