import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDatabase from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  try {
    await connectDatabase();

    const collection = mongoose.connection.db.collection('counselingservices');
    const result = await collection.updateMany(
      { calendlyIntegration: { $exists: true } },
      { $unset: { calendlyIntegration: '' } }
    );

    console.log(`Matched ${result.matchedCount} counseling service(s).`);
    console.log(`Removed calendlyIntegration from ${result.modifiedCount} counseling service(s).`);
  } catch (error) {
    console.error('Error removing calendlyIntegration:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
