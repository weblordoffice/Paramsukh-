import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Blog from './models/blog.models.js';

dotenv.config();

const SAMPLE_BLOGS = [
    {
        title: 'Introduction to Mindfulness Meditation',
        content: 'Mindfulness is the basic human ability to be fully present, aware of where we are and what we’re doing, and not overly reactive or overwhelmed by what’s going on around us.\n\nTo practice mindfulness meditation, find a quiet space, sit comfortably, focus on your breath, and gently bring your attention back whenever your mind wanders. Regular practice has been shown to reduce stress, improve focus, and promote emotional well-being.',
        imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=600',
        author: 'ParamSukh Guide',
    },
    {
        title: 'Understanding the Bhagavad Gita in Modern Life',
        content: 'The Bhagavad Gita is a timeless guide to spiritual development. Set on a battlefield, it symbolizes the inner struggles we face in our daily lives.\n\nBy teaching the paths of Karma Yoga (selfless action), Bhakti Yoga (devotion), and Jnana Yoga (knowledge), the Gita provides practical wisdom on duty, mindfulness, and finding peace amidst chaos. Integrating its lessons into modern routines helps build resilience, clarity, and purpose.',
        imageUrl: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&q=80&w=600',
        author: 'Acharya Dev',
    },
    {
        title: 'Breathwork Techniques for Instant Calm',
        content: 'Your breath is a powerful tool to regulate your nervous system. Whenever you feel anxious or distracted, try the 4-7-8 breathing technique:\n\n1. Inhale quietly through your nose for 4 seconds.\n2. Hold your breath for a count of 7 seconds.\n3. Exhale completely through your mouth, making a whoosh sound, for 8 seconds.\n\nRepeating this cycle four times helps lower your heart rate, calm anxiety, and bring your focus back to the present moment.',
        imageUrl: 'https://images.unsplash.com/photo-1474418397713-7dedd3900bb7?auto=format&fit=crop&q=80&w=600',
        author: 'Spiritual Coach',
    }
];

async function seed() {
    console.log('Connecting to MongoDB:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Clearing existing blogs...');
    await Blog.deleteMany({});

    console.log('Seeding sample blogs...');
    const blogs = await Blog.insertMany(SAMPLE_BLOGS);

    console.log(`Seeded ${blogs.length} blogs successfully!`);
    await mongoose.connection.close();
}

seed().catch(err => {
    console.error('Error seeding blogs:', err);
    process.exit(1);
});
