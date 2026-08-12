import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';
import { Enrollment } from '../src/models/enrollment.models.js';
import { Course } from '../src/models/course.models.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const phone = '+917972531164';
    const user = await User.findOne({ phone });
    if (!user) {
      console.log(`User with phone ${phone} not found!`);
      await mongoose.disconnect();
      return;
    }

    console.log(`\n=== User Info ===`);
    console.log(JSON.stringify(user, null, 2));

    console.log(`\n=== User Memberships ===`);
    const memberships = await UserMembership.find({ userId: user._id }).populate('planId');
    memberships.forEach(m => {
      console.log(JSON.stringify(m, null, 2));
    });

    console.log(`\n=== User Enrollments ===`);
    const enrollments = await Enrollment.find({ userId: user._id });
    enrollments.forEach(e => {
      console.log(JSON.stringify(e, null, 2));
    });

    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
