import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/paramsukh';

await mongoose.connect(uri);
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
const users = await User.find({ email: /neeraj/i }).select('email phone subscriptionPlan subscriptionStatus').lean();
console.log(JSON.stringify(users, null, 2));
await mongoose.disconnect();
