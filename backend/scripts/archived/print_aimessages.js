import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AIMessage } from './src/models/aiChat.models.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const messages = await AIMessage.find({}).sort({ createdAt: -1 }).limit(35).lean();
  console.log('--- Last 35 AI Messages ---');
  for (const m of messages.reverse()) {
    console.log(`[${m.createdAt.toISOString()}] [${m.role.toUpperCase()}] messageId: ${m._id}`);
    if (m.role === 'assistant') {
      console.log(`Content: "${m.content}"`);
      if (m.toolName) {
        console.log(`  toolName: ${m.toolName}`);
      }
      if (m.toolPayload) {
        console.log(`  toolPayload:`, JSON.stringify(m.toolPayload));
      }
    } else {
      console.log(`Content: "${m.content}"`);
    }
    if (m.metadata) {
      console.log(`  metadata:`, JSON.stringify(m.metadata));
    }
    console.log('---------------------------');
  }

  await mongoose.connection.close();
}

run().catch(console.error);
