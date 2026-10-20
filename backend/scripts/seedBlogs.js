import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import Blog from '../src/models/blog.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY_MS = 24 * 60 * 60 * 1000;
const IMG = (id) => `https://images.unsplash.com/${id}?w=1200`;

const blogs = [
  {
    title: 'The Art of Stillness in a Noisy World',
    category: 'Mindfulness',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1506126613408-eca07ce68773'),
    tags: ['mindfulness', 'stillness', 'focus'],
    daysAgo: 2,
    content:
      'Stillness is not the absence of noise. It is the ability to remain undisturbed by it.\n\n' +
      'Most of us believe peace will arrive once the circumstances settle. But circumstances rarely settle. The traffic, the notifications, the endless to-do list: they are not going away. What can change is our relationship to them.\n\n' +
      'Begin with one breath. Notice it fully. Then the next. In that small act, you have already stepped out of the current. Practise for a few minutes each day, and stillness slowly becomes a place you can return to, no matter how loud the world gets.',
  },
  {
    title: "Understanding the Bhagavad Gita's Timeless Wisdom",
    category: 'Scripture',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1544716278-ca5e3f4abd8c'),
    tags: ['gita', 'scripture', 'wisdom'],
    daysAgo: 6,
    content:
      'The Bhagavad Gita is a conversation between a warrior and his guide, set on a battlefield, about how to act when everything is uncertain.\n\n' +
      'Its central teaching is simple and difficult: do your work fully, without being attached to the outcome. Action, offered without grasping, becomes freedom rather than burden.\n\n' +
      'Read a single verse a day. Sit with it. Let it question you before you question it. Over time, the Gita stops being a book and becomes a way of seeing.',
  },
  {
    title: "A Beginner's Guide to Pranayama",
    category: 'Wellness',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1545389336-cf090694435e'),
    tags: ['pranayama', 'breathwork', 'wellness'],
    daysAgo: 10,
    content:
      'Pranayama is the practice of guiding the breath to steady the body and the mind.\n\n' +
      'Start with the simplest technique: balanced breathing. Inhale gently for four counts, exhale gently for four counts. No force, no strain. Continue for five minutes.\n\n' +
      'The breath is the one rhythm we carry everywhere. Learning to shape it is learning to shape the quality of a day.',
  },
  {
    title: 'Why Gratitude Rewires Your Mind',
    category: 'Spirituality',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1470252649378-9c29740c9fa8'),
    tags: ['gratitude', 'mindset', 'spirituality'],
    daysAgo: 14,
    content:
      'Gratitude is not positive thinking. It is attention, deliberately directed towards what is already good.\n\n' +
      'Write down three things at the end of each day. They can be small: a warm cup of tea, a kind word, a moment of quiet. What we notice repeatedly, we begin to notice everywhere.\n\n' +
      'Over weeks, the mind stops scanning only for what is missing. That shift is quiet, and it changes everything.',
  },
  {
    title: 'Meditation for Busy People: Five Minutes a Day',
    category: 'Meditation',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1518241353330-0f7941c2d9b5'),
    tags: ['meditation', 'beginner', 'habit'],
    daysAgo: 18,
    content:
      'You do not need an hour. You need consistency.\n\n' +
      'Sit for five minutes at the same time each day. Close your eyes. Follow the breath. When the mind wanders, return, without judgement.\n\n' +
      'Five faithful minutes will teach you more than an occasional heroic hour. Habits are built on repetition, not intensity.',
  },
  {
    title: 'The Role of Community in Spiritual Growth',
    category: 'Community',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1529156069898-49953e39b3ac'),
    tags: ['community', 'satsang', 'growth'],
    daysAgo: 22,
    content:
      'Growth is often described as a solitary path. In practice, it is sustained by company.\n\n' +
      'A community offers three things: example, accountability, and perspective. We see others practise, we are gently held to our commitments, and we learn from journeys unlike our own.\n\n' +
      'Find a group, however small, that meets honestly and regularly. Progress becomes lighter when it is shared.',
  },
  {
    title: 'Detachment Without Indifference',
    category: 'Discourse',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1499209974431-9dddcece7f88'),
    tags: ['detachment', 'discourse', 'balance'],
    daysAgo: 27,
    content:
      'Detachment is often mistaken for coldness. The two are opposites.\n\n' +
      'Indifference turns away from life. Detachment engages fully while holding results lightly. You give your best to the work, and you release your grip on how it must turn out.\n\n' +
      'This is the middle path: wholehearted action, open hands.',
  },
  {
    title: 'Sleep as a Spiritual Practice',
    category: 'Other',
    author: 'ParamSukh Team',
    imageUrl: IMG('photo-1511296265581-c2450046447d'),
    tags: ['sleep', 'rest', 'practice'],
    daysAgo: 32,
    content:
      'We rarely think of rest as practice. Yet the way we end a day shapes the way we begin the next.\n\n' +
      'Wind down deliberately: dim the lights, close the screens, and take a few slow breaths. Let the day complete itself without replaying it.\n\n' +
      'Sleep offered with awareness is not lost time. It is restoration, and it is the quiet ground of every practice.',
  },
];

const run = async () => {
  try {
    await connectDatabase();

    const now = Date.now();
    for (const blog of blogs) {
      const createdAt = new Date(now - (blog.daysAgo || 0) * DAY_MS);
      await Blog.findOneAndUpdate(
        { title: blog.title },
        {
          $set: {
            title: blog.title,
            content: blog.content,
            excerpt: blog.excerpt || blog.content.replace(/\s+/g, ' ').slice(0, 180) + '…',
            imageUrl: blog.imageUrl,
            author: blog.author,
            category: blog.category,
            tags: blog.tags || [],
            readTime: blog.readTime || Math.max(1, Math.ceil(blog.content.split(/\s+/).length / 200)),
            createdAt,
            updatedAt: createdAt,
            deletedAt: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const count = await Blog.countDocuments({ deletedAt: null });
    console.table(blogs.map((b) => ({ title: b.title, category: b.category, readTime: b.readTime || 'auto' })));
    console.log(`Blogs seeded — total active: ${count}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed blogs:', error);
    process.exit(1);
  }
};

run();
