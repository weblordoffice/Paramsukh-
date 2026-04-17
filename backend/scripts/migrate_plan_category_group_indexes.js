import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Group } from '../src/models/community.models.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const run = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is undefined');
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const collection = Group.collection;
    const indexes = await collection.indexes();

    const legacyIndex = indexes.find((idx) => {
      const key = idx?.key || {};
      return key.groupType === 1 && key.category === 1 && key.planSlug === undefined;
    });

    if (legacyIndex) {
      await collection.dropIndex(legacyIndex.name);
      console.log(`Dropped legacy index: ${legacyIndex.name}`);
    } else {
      console.log('Legacy category index not found (already migrated).');
    }

    await collection.createIndex(
      { groupType: 1, planSlug: 1, category: 1 },
      {
        unique: true,
        partialFilterExpression: {
          groupType: 'category',
          planSlug: { $type: 'string' },
          category: { $type: 'string' },
        },
        name: 'groupType_1_planSlug_1_category_1',
      }
    );

    console.log('Ensured plan-category unique index: groupType_1_planSlug_1_category_1');
    console.log('Index migration completed successfully.');
  } catch (error) {
    console.error('Failed to migrate community group indexes:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run();
