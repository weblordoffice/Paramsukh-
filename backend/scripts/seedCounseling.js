import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CounselingService from '../src/models/counselingService.model.js';

dotenv.config();

const demoServices = [
  {
    title: 'General Wellness Consultation',
    description:
      'A short orientation call to assess where you are and map out the right courses, rituals and sessions for you.',
    icon: 'help-buoy-outline',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    duration: '30 mins',
    price: 0,
    isFree: true,
    counselorName: 'Expert Counselor',
    isActive: true,
    intervalMinutes: 30,
  },
  {
    title: 'Mindfulness & Meditation Coaching',
    description:
      'One-on-one session to build or refine a daily meditation practice — breathwork, stillness and consistency.',
    icon: 'water-outline',
    color: '#10B981',
    bgColor: '#ECFDF5',
    duration: '60 mins',
    price: 0,
    isFree: true,
    counselorName: 'Yogi Ananda',
    isActive: true,
    intervalMinutes: 60,
  },
  {
    title: 'Spiritual Morning Guidance',
    description:
      'Start your day with clarity and intention — prayer, scriptural reflection and personal alignment guidance.',
    icon: 'sunny-outline',
    color: '#F1842D',
    bgColor: '#FFF7ED',
    duration: '45 mins',
    price: 500,
    isFree: false,
    counselorName: 'Acharya Shastri',
    isActive: true,
    intervalMinutes: 45,
  },
  {
    title: 'Restorative Sleep Consultation',
    description:
      'Sleep hygiene, evening wind-down routines and natural ways to reset your nervous system for deep rest.',
    icon: 'moon-outline',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    duration: '60 mins',
    price: 1200,
    isFree: false,
    counselorName: 'Dr. Karen Bose',
    isActive: true,
    intervalMinutes: 60,
  },
];

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const dbName = mongoose.connection.name;
  const devDb = process.env.DEV_MONGO_DB || 'psog_dev';

  // Safety guard: never wipe a non-dev database by accident.
  if (dbName !== devDb && process.env.FORCE_SEED !== 'true') {
    console.error(`Refusing to seed database "${dbName}" (expected "${devDb}"). Set FORCE_SEED=true to override.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  await CounselingService.deleteMany({});
  const created = await CounselingService.insertMany(demoServices);
  console.log(`Seeded ${created.length} counseling services into "${dbName}" (2 free).`);
  created.forEach((s) => console.log(`  - ${s.title} — ${s.isFree ? 'FREE' : `₹${s.price}`}`));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
