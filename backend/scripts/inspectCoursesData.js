import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Course } from '../src/models/course.models.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const courses = await Course.find({ status: 'published' });
    console.log(`Found ${courses.length} published courses:`);
    courses.forEach(c => {
      console.log(`\n=============================`);
      console.log(`Title: ${c.title}`);
      console.log(`ID: ${c._id}`);
      console.log(`Category: ${c.category}`);
      console.log(`Included in Plans:`, c.includedInPlans);
      console.log(`Total Videos: ${c.totalVideos}`);
      console.log(`Videos:`, JSON.stringify(c.videos, null, 2));
    });

    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
