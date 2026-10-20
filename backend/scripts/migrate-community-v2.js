import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDatabase from '../src/config/database.js';
import { Post } from '../src/models/community.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');

const migrate = async () => {
  try {
    await connectDatabase();

    const missingTypeQuery = {
      $or: [
        { postType: { $exists: false } },
        { postType: null },
      ],
    };

    const missingTypeCount = await Post.countDocuments(missingTypeQuery);

    console.log(`Posts missing postType: ${missingTypeCount}`);
    if (dryRun) {
      console.log('Dry run enabled. No documents were modified.');
      return;
    }

    if (missingTypeCount > 0) {
      const result = await Post.updateMany(missingTypeQuery, {
        $set: { postType: 'discussion' },
      });
      console.log(`Updated ${result.modifiedCount} post(s) to postType=discussion`);
    }

    console.log('Community v2 migration complete.');
  } catch (error) {
    console.error('Community v2 migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

migrate();
