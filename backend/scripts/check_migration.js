
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Course } from '../src/models/course.models.js';

dotenv.config({ path: '.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

console.log('URI:', MONGO_URI ? 'Defined' : 'Undefined');

const check = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const courses = await Course.find({ "includedInPlans.0": { "$exists": true } });
        console.log(`Courses with plans: ${courses.length}`);
        courses.forEach(c => console.log(`${c.title}: ${c.includedInPlans}`));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
check();
