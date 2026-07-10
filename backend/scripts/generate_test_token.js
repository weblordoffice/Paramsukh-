import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/paramsukh';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_paramsukh_2026_change_me';

const userSchema = new mongoose.Schema({
  phone: String,
  displayName: String
}, { strict: false });

const User = mongoose.model('User', userSchema, 'users');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB at', MONGO_URI);
  
  const user = await User.findOne({ phone: { $in: ['+919999999999', '9999999999'] } });
  if (!user) {
    console.error('Demo user not found!');
    process.exit(1);
  }
  
  console.log('Found user:', user.displayName, 'with ID:', user._id);
  
  const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '15d' });
  console.log('\nGenerated JWT Token:\n', token);
  
  await mongoose.disconnect();
}

run().catch(console.error);
