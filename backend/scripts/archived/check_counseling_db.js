import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CounselingService from './src/models/counselingService.model.js';

dotenv.config();

async function checkCounseling() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const count = await CounselingService.countDocuments();
    console.log(`Counseling Service documents: ${count}`);

    const services = await CounselingService.find();
    console.log('Services details:');
    console.log(JSON.stringify(services, null, 2));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCounseling();
