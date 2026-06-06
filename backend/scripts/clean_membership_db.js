import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ MONGO_URI is missing in .env');
  process.exit(1);
}

async function clean() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Collections to wipe completely
    const collectionsToWipe = [
      'courses',
      'enrollments',
      'membershipplans',
      'usermemberships',
      'adminpaymentlinks'
    ];

    for (const name of collectionsToWipe) {
      try {
        console.log(`🧹 Dropping/cleaning collection: "${name}"...`);
        // Drop the collection if it exists
        const collections = await db.listCollections({ name }).toArray();
        if (collections.length > 0) {
          await db.dropCollection(name);
          console.log(`   ✅ Collection "${name}" dropped successfully.`);
        } else {
          console.log(`   ℹ️  Collection "${name}" does not exist, skipping.`);
        }
      } catch (err) {
        console.error(`   ❌ Error dropping collection "${name}":`, err.message);
      }
    }

    // Reset user fields in the "users" collection
    try {
      console.log('\n👤 Resetting subscription & payment history for all users...');
      const usersCollection = db.collection('users');
      const result = await usersCollection.updateMany(
        {},
        {
          $set: {
            subscriptionPlan: 'free',
            subscriptionPlanVariant: null,
            subscriptionStatus: 'inactive',
            subscriptionStartDate: null,
            subscriptionEndDate: null,
            payments: []
          }
        }
      );
      console.log(`   ✅ Successfully updated ${result.modifiedCount} user records.`);
    } catch (err) {
      console.error('   ❌ Error updating users collection:', err.message);
    }

    console.log('\n🎉 Database cleaned successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database clean-up failed:', error);
    process.exit(1);
  }
}

clean();
