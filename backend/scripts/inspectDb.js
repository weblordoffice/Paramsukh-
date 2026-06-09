import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDatabase from '../src/config/database.js';

// Import models
import { User } from '../src/models/user.models.js';
import Admin from '../src/models/admin.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { Course } from '../src/models/course.models.js';
import { Event } from '../src/models/event.models.js';
import Product from '../src/models/product.models.js';
import Order from '../src/models/order.models.js';
import Booking from '../src/models/booking.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const inspectDb = async () => {
    try {
        await connectDatabase();

        console.log('\n--- Database Stats ---\n');

        const userCount = await User.countDocuments();
        const adminCount = await Admin.countDocuments();
        const planCount = await MembershipPlan.countDocuments();
        const courseCount = await Course.countDocuments();
        const eventCount = await Event.countDocuments();
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const bookingCount = await Booking.countDocuments();

        console.log(`- Users: ${userCount}`);
        console.log(`- Admins (DB): ${adminCount}`);
        console.log(`- Membership Plans: ${planCount}`);
        console.log(`- Courses: ${courseCount}`);
        console.log(`- Events: ${eventCount}`);
        console.log(`- Products: ${productCount}`);
        console.log(`- Orders: ${orderCount}`);
        console.log(`- Bookings: ${bookingCount}`);

        console.log('\n--- Admins (DB) List ---');
        const admins = await Admin.find({}, 'name email role');
        admins.forEach(admin => {
            console.log(`  * ${admin.name} (${admin.email}) [Role: ${admin.role}]`);
        });

        console.log('\n--- Users List (Max 5) ---');
        const users = await User.find({}, 'displayName phone email').limit(5);
        users.forEach(user => {
            console.log(`  * ${user.displayName} (${user.phone || 'No Phone'}) [Email: ${user.email || 'None'}]`);
        });

        console.log('\n--- Membership Plans ---');
        const plans = await MembershipPlan.find({}, 'title slug pricing');
        plans.forEach(plan => {
            const price = plan.pricing?.oneTime?.amount || plan.pricing?.recurring?.monthly?.amount || 0;
            console.log(`  * ${plan.title} (slug: ${plan.slug}) [Price: ${price/100} INR]`);
        });

        console.log('\n-----------------------\n');
        process.exit(0);
    } catch (error) {
        console.error('Error inspecting database:', error);
        process.exit(1);
    }
};

inspectDb();
