require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Active users
  const users = await db.collection('users').find({
    subscriptionStatus: 'active',
    subscriptionPlan: { $nin: [null, 'free', ''] }
  }).project({ displayName: 1, email: 1, subscriptionPlan: 1, subscriptionStatus: 1, phone: 1 }).toArray();

  console.log('Active plan users:', users.length);
  users.forEach(u => console.log('  -', u.displayName || u.email || u.phone, '| Plan:', u.subscriptionPlan, '| Status:', u.subscriptionStatus));

  // 2. All groups
  const groups = await db.collection('groups').find({}).toArray();
  console.log('\nTotal groups:', groups.length);
  groups.forEach(g => console.log('  -', JSON.stringify({
    name: g.name,
    type: g.groupType,
    plan: g.planSlug,
    cat: g.category,
    parent: g.parentGroupId ? String(g.parentGroupId) : 'NONE',
    members: g.memberCount,
    active: g.isActive
  })));

  // 3. Active memberships
  const members = await db.collection('groupmembers').find({ isActive: true }).toArray();
  console.log('\nActive memberships:', members.length);

  // 4. Check enrollments for active users
  for (const u of users.slice(0, 3)) {
    const enrs = await db.collection('enrollments').find({ userId: u._id }).toArray();
    console.log('\nEnrollments for', u.displayName || u.email || u.phone, ':', enrs.length);
    for (const e of enrs) {
      const c = await db.collection('courses').findOne({ _id: e.courseId });
      if (c) console.log('  course:', c.title, '| category:', c.category, '| plans:', (c.includedInPlans || []).join(','));
    }

    const mems = await db.collection('groupmembers').find({ userId: u._id, isActive: true }).toArray();
    console.log('  Group memberships:', mems.length);
    for (const m of mems) {
      const g = await db.collection('groups').findOne({ _id: m.groupId });
      if (g) console.log('    -', g.name, '(type:', g.groupType, ')');
    }
  }

  // 5. Indexes
  const indexes = await db.collection('groups').indexes();
  console.log('\nGroup indexes:');
  indexes.forEach(idx => console.log('  -', idx.name, JSON.stringify(idx.key), idx.unique ? 'UNIQUE' : '', idx.partialFilterExpression ? 'partial:' + JSON.stringify(idx.partialFilterExpression) : ''));

  await mongoose.disconnect();
  console.log('\nDone.');
})();
