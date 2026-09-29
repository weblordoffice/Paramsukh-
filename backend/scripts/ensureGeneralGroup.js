/**
 * Idempotent ops helper: ensure the General (public) community group exists.
 * Run from backend folder: node scripts/ensureGeneralGroup.js
 * Uses MONGO_URI from .env. Non-destructive.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureGeneralGroup } from '../src/services/community.service.js';

dotenv.config();

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGO_URI in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    const group = await ensureGeneralGroup();
    console.log(`✅ General community ready: "${group.name}" (${group._id}) isPublic=${group.isPublic}`);
  } catch (error) {
    console.error('❌ Error ensuring General group:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
