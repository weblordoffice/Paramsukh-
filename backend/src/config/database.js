import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDatabase = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('FATAL: MONGO_URI is missing. Set it in backend/.env');
        process.exit(1);
    }

    const maxRetries = Number(process.env.MONGO_MAX_RETRIES || 12);
    const retryDelayMs = Number(process.env.MONGO_RETRY_DELAY_MS || 5000);

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const conn = await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 15000,
            });
            console.log(`MongoDB Connected: ${conn.connection.host}`);
            return;
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;
            const message = error instanceof Error ? error.message : String(error);
            console.error(`MongoDB connection failed (attempt ${attempt}/${maxRetries}): ${message}`);
            if (isLastAttempt) {
                console.error('FATAL: Unable to connect to MongoDB after max retries.');
                process.exit(1);
            }
            await wait(retryDelayMs);
        }
    }
};

export default connectDatabase; 