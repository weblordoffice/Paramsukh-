/**
 * One-time script: drop the current database for a fresh start.
 * Run from backend folder: node scripts/drop-database.js
 * Uses MONGO_URI from .env (e.g. paramsukh-dev).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { assertSafeDestructiveTarget } from '../src/utils/dbSafety.js';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('No MONGO_URI in .env');
  process.exit(1);
}

const dbName = uri.split('/').pop()?.split('?').shift() || 'paramsukh-dev';

async function run() {
  try {
    await assertSafeDestructiveTarget({ scriptName: 'drop-database', action: 'drop the database' });
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    console.log(`Dropped database: ${dbName}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
