import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AIConversation, AIMessage } from './src/models/aiChat.models.js';

dotenv.config();

async function showMessages() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Find latest conversation
    const convo = await AIConversation.findOne().sort({ updatedAt: -1 });
    if (!convo) {
      console.log('No conversations found.');
      await mongoose.connection.close();
      return;
    }
    console.log(`Latest Conversation: ${convo._id} - Title: "${convo.title}"`);

    // Fetch messages
    const messages = await AIMessage.find({ conversation: convo._id }).sort({ createdAt: 1 }).lean();
    console.log(`Total messages: ${messages.length}\n`);

    messages.forEach((msg, idx) => {
      console.log(`[${idx}] ${msg.role.toUpperCase()}: "${msg.content}"`);
      if (msg.toolName) {
        console.log(`     TOOL CALL: ${msg.toolName}`);
        console.log(`     PAYLOAD: ${JSON.stringify(msg.toolPayload)}`);
      }
      console.log('----------------------------------------------------');
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

showMessages();
