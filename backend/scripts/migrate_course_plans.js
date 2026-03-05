
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Course } from '../src/models/course.models.js';

dotenv.config({ path: '.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const MEMBERSHIP_COURSE_ACCESS = {
    bronze: ['Physical Wellness'],
    copper: ['Physical Wellness', 'Spirituality & Mantra Yoga', 'Mental Wellness'],
    silver: ['Physical Wellness', 'Mental Wellness', 'Financial Wellness', 'Relationship & Family Wellness', 'Spirituality & Mantra Yoga']
};

const normalizeCourseTitle = (title) => {
    return title ? title.toLowerCase().trim() : '';
};

const migrate = async () => {
    try {
        console.log('Script started. URI defined:', !!MONGO_URI);
        if (!MONGO_URI) throw new Error('MONGO_URI is undefined');

        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        const courses = await Course.find({});
        console.log(`Found ${courses.length} courses to check.`);

        for (const course of courses) {
            const courseTitle = normalizeCourseTitle(course.title);
            const includedInPlans = new Set(course.includedInPlans || []);

            // Check each plan
            for (const [plan, titles] of Object.entries(MEMBERSHIP_COURSE_ACCESS)) {
                const normalizedTitles = titles.map(normalizeCourseTitle);
                if (normalizedTitles.includes(courseTitle)) {
                    includedInPlans.add(plan);
                }
            }

            // Update course if changed
            if (includedInPlans.size > (course.includedInPlans?.length || 0)) {
                course.includedInPlans = Array.from(includedInPlans);
                await course.save();
                console.log(`Updated course "${course.title}" with plans: ${course.includedInPlans.join(', ')}`);
            }
        }

        console.log('Migration complete.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
};

migrate();
