// Fix Database - Drop old firebaseUID index
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixDatabase() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Get all indexes
    console.log('📋 Current indexes:');
    const indexes = await usersCollection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop firebaseUID index if it exists
    try {
      console.log('\n🗑️  Dropping firebaseUID_1 index...');
      await usersCollection.dropIndex('firebaseUID_1');
      console.log('✅ Successfully dropped firebaseUID_1 index');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('ℹ️  Index firebaseUID_1 not found (already removed)');
      } else {
        console.error('❌ Error dropping index:', error.message);
      }
    }

    // Show final indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Database schema fixed!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDatabase();
