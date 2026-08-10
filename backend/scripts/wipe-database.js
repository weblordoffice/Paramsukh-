import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const KEEP_COLLECTIONS = ['users', 'admins'];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    console.log(`\nFound ${names.length} collections:`);
    names.forEach(n => console.log(`  ${n}`));

    const toDrop = names.filter(n => !KEEP_COLLECTIONS.includes(n));

    if (toDrop.length === 0) {
      console.log('\nNo collections to drop.');
      process.exit(0);
    }

    console.log(`\nDropping ${toDrop.length} collections (keeping: ${KEEP_COLLECTIONS.join(', ')}):`);
    for (const name of toDrop) {
      process.stdout.write(`  Dropping ${name}... `);
      await db.dropCollection(name);
      console.log('✅');
    }

    console.log('\n✅ All collections dropped. Users and admins preserved.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
