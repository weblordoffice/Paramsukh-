import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Admin from '../src/models/admin.models.js';
import connectDatabase from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const seedSuperAdmin = async () => {
    try {
        await connectDatabase();

        const email = process.env.SUPER_ADMIN_EMAIL || 'admin@paramsukh.com';
        const password = process.env.SUPER_ADMIN_PASSWORD; // optional: leave unset for Google-only sign-in

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            console.log('Admin already exists:', email);
            process.exit(0);
        }

        const payload = {
            name: 'Super Admin',
            email,
            role: 'super_admin',
            permissions: [],
        };
        if (password && String(password).trim()) {
            payload.password = password;
        }

        const superAdmin = await Admin.create(payload);
        console.log(
            `Super Admin created: ${superAdmin.email}` +
                (payload.password ? ' (email + password)' : ' (Google sign-in only – use this email in Google Cloud OAuth)')
        );
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedSuperAdmin();
