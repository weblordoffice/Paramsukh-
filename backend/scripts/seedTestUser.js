import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import { DeviceSession, DeviceRegistrationLog } from '../src/models/deviceSession.models.js';
import connectDatabase from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const seedTestUsers = async () => {
  try {
    await connectDatabase();

    const phones = ['+919999999999', '+919888888888'];
    const existingUsers = await User.find({ phone: { $in: phones } });
    if (existingUsers.length > 0) {
      const ids = existingUsers.map(u => u._id);
      await DeviceSession.deleteMany({ user: { $in: ids } });
      await DeviceRegistrationLog.deleteMany({ user: { $in: ids } });
    }

    // 1. Fully Onboarded & Active Test User
    const primaryPhone = '+919999999999';
    await User.findOneAndUpdate(
      { phone: primaryPhone },
      {
        displayName: 'Param Test User',
        phone: primaryPhone,
        email: 'testuser@paramsukh.com',
        authProvider: 'phone',
        onboardingCompleted: true,
        assessmentCompleted: true,
        assessmentCompletedAt: new Date(),
        subscriptionPlan: 'premium',
        subscriptionStatus: 'active',
        isActive: true,
        preferences: {
          theme: 'system',
          notifications: true,
          emailNotifications: true,
          autoPlay: true,
          dataSaver: false,
        },
      },
      { upsert: true, new: true }
    );

    // 2. Secondary Test User
    const secondaryPhone = '+919888888888';
    await User.findOneAndUpdate(
      { phone: secondaryPhone },
      {
        displayName: 'Dev Tester',
        phone: secondaryPhone,
        email: 'devtester@paramsukh.com',
        authProvider: 'phone',
        onboardingCompleted: true,
        assessmentCompleted: true,
        assessmentCompletedAt: new Date(),
        subscriptionPlan: 'free',
        subscriptionStatus: 'inactive',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log('✅ Test users seeded successfully:');
    console.log('   1. Phone: 9999999999 | OTP: 123456 (Premium Active)');
    console.log('   2. Phone: 9888888888 | OTP: 123456 (Free Member)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
    process.exit(1);
  }
};

seedTestUsers();
