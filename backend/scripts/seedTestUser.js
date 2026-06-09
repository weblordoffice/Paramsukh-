import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import connectDatabase from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const seedTestUser = async () => {
    try {
        await connectDatabase();

        const phone = '+919999999999';
        const email = 'testuser@paramsukh.com';

        const existingUser = await User.findOne({ phone });
        
        const payload = {
            phone,
            displayName: 'Test User',
            email,
            authProvider: 'phone',
            subscriptionPlan: 'free',
            subscriptionStatus: 'inactive',
            isActive: true,
        };

        if (existingUser) {
            console.log('Test User already exists:', phone);
            // Ensure properties are correct
            await User.updateOne({ phone }, { $set: payload });
            console.log('Test User properties updated.');
            process.exit(0);
        }

        const newUser = await User.create(payload);
        console.log(`Test User created in database: ${newUser.phone}`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding test user:', error);
        process.exit(1);
    }
};

seedTestUser();
