import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './models/admin.models.js';

dotenv.config();

async function seed() {
  console.log('Connecting to MongoDB:', process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'admin@paramsukh.com';
  
  // Clear any existing dev admin
  await Admin.deleteMany({ email });

  const admin = await Admin.create({
    name: 'Dev Super Admin',
    email,
    password: 'password123',
    role: 'super_admin',
    permissions: [
      'manage_users',
      'manage_courses',
      'manage_events',
      'manage_community',
      'manage_shop',
      'manage_orders',
      'manage_content',
      'manage_admins',
      'view_analytics'
    ],
    isActive: true
  });

  console.log('Created Dev Super Admin successfully:');
  console.log('Email:', admin.email);
  console.log('Password: password123');

  await mongoose.connection.close();
}

seed().catch(err => {
  console.error('Error seeding admin:', err);
  process.exit(1);
});
