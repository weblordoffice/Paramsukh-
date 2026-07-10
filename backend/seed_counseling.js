import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CounselingService from './src/models/counselingService.model.js';

dotenv.config();

const demoServices = [
  {
    title: 'Spiritual Morning Guidance',
    description: 'Personalized guidance to start your day with clarity, intention, and calm energy. Includes daily prayer, scriptural reflection advice, and personal alignment tips.',
    icon: 'sunny-outline',
    color: '#F1842D',
    bgColor: '#FFF7ED',
    duration: '45 mins',
    price: 500,
    isFree: false,
    counselorName: 'Acharya Shastri',
    isActive: true,
    intervalMinutes: 45
  },
  {
    title: 'Mindfulness & Meditation Coaching',
    description: 'One-on-one session to establish or refine your daily meditation practice. Ideal for beginners seeking structured breathwork and stillness training.',
    icon: 'water-outline',
    color: '#10B981',
    bgColor: '#ECFDF5',
    duration: '60 mins',
    price: 0,
    isFree: true,
    counselorName: 'Yogi Ananda',
    isActive: true,
    intervalMinutes: 60
  },
  {
    title: 'Restorative Sleep Consultation',
    description: 'Struggling with sleep? Discuss sleep hygiene, evening downshifting routines, and natural ways to reset your nervous system for deep rest.',
    icon: 'moon-outline',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    duration: '60 mins',
    price: 1200,
    isFree: false,
    counselorName: 'Dr. Karen Bose',
    isActive: true,
    intervalMinutes: 60
  },
  {
    title: 'General Wellness Consultation',
    description: 'A brief orientation call to assess your current mental and physical wellness and map out recommended courses, rituals, and events.',
    icon: 'help-buoy-outline',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    duration: '30 mins',
    price: 0,
    isFree: true,
    counselorName: 'Expert Counselor',
    isActive: true,
    intervalMinutes: 30
  },
  {
    title: 'general',
    description: 'General counseling and support session for wellness guidance.',
    icon: 'help-buoy-outline',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    duration: '30 mins',
    price: 0,
    isFree: true,
    counselorName: 'General Counselor',
    isActive: true,
    intervalMinutes: 30
  }
];

async function seedCounseling() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Clear existing services
    console.log('Clearing old counseling services...');
    await CounselingService.deleteMany();

    // Insert new ones
    console.log('Inserting counseling services...');
    const result = await CounselingService.insertMany(demoServices);
    console.log(`Successfully seeded ${result.length} counseling services.`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedCounseling();
