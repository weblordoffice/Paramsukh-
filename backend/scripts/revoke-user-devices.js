import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const email = process.argv[2] || 'neerajkushwaha0401@gmail.com';

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected');

    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email });
    if (!user) { console.log('User not found'); process.exit(0); }

    const result = await db.collection('devicesessions').updateMany(
      { user: user._id, isRevoked: false },
      { $set: { isRevoked: true } }
    );
    console.log(`Revoked ${result.modifiedCount} device sessions for ${email}`);
  } catch (e) { console.error(e.message); }
  finally { await mongoose.disconnect(); process.exit(0); }
})();
