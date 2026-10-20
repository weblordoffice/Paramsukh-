import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import Podcast from '../src/models/podcast.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const AUDIO = (n) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;
const THUMB = (id) => `https://images.unsplash.com/${id}?w=800`;

const podcastCatalog = [
  {
    title: 'Morning Mantra Reset',
    description: 'A short guided mantra session to create clarity and steadiness before the day begins.',
    host: 'ParamSukh Audio',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    thumbnailUrl: THUMB('photo-1506126613408-eca07ce68773'),
    duration: '14:22',
    category: 'Meditation',
    accessType: 'free',
  },
  {
    title: 'Wisdom for Difficult Days',
    description: 'A practical discourse on how to respond to stressful situations with awareness and compassion.',
    host: 'ParamSukh Audio',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    thumbnailUrl: THUMB('photo-1499209974431-9dddcece7f88'),
    duration: '28:10',
    category: 'Discourse',
    accessType: 'free',
  },
  {
    title: 'Scripture and Stillness',
    description: 'A reflective audio session connecting scripture study with everyday mindfulness.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: AUDIO(1),
    thumbnailUrl: THUMB('photo-1500530855697-b586d89ba3ee'),
    duration: '22:08',
    category: 'Scripture',
    accessType: 'free',
  },
  {
    title: 'Healing Breath for Sleep',
    description: 'A calming nighttime audio practice that helps you release tension and prepare for rest.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: AUDIO(2),
    thumbnailUrl: THUMB('photo-1511296265581-c2450046447d'),
    duration: '18:45',
    category: 'Mindfulness',
    accessType: 'free',
  },
  {
    title: 'Sacred Sound Journey',
    description: 'A long-form mantra immersion designed for deeper spiritual focus and inner quiet.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: AUDIO(3),
    thumbnailUrl: THUMB('photo-1469474968028-56623f02e42e'),
    duration: '41:15',
    category: 'Mantra',
    accessType: 'free',
  },
  {
    title: 'Grounding in Stillness',
    description: 'A gentle grounding meditation to settle the body and quiet a busy mind.',
    host: 'ParamSukh Audio',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    thumbnailUrl: THUMB('photo-1518241353330-0f7941c2d9b5'),
    duration: '12:30',
    category: 'Meditation',
    accessType: 'free',
  },
  {
    title: 'Everyday Mindfulness',
    description: 'Simple mindfulness cues you can bring into ordinary moments of the day.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: AUDIO(4),
    thumbnailUrl: THUMB('photo-1545389336-cf090694435e'),
    duration: '16:20',
    category: 'Mindfulness',
    accessType: 'free',
  },
  {
    title: 'Reflections on Gratitude',
    description: 'An uplifting reflection on gratitude, appreciation and emotional steadiness.',
    host: 'ParamSukh Audio',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    thumbnailUrl: THUMB('photo-1470252649378-9c29740c9fa8'),
    duration: '20:00',
    category: 'Other',
    accessType: 'free',
  },
  {
    title: 'Video Podcast: Mantra & Movement',
    description: 'A guided video session combining mantra chanting and gentle movement, streamed from YouTube.',
    host: 'ParamSukh Video',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: THUMB('photo-1518611012118-696072aa579a'),
    duration: '03:33',
    category: 'Mindfulness',
    accessType: 'free',
  },
];

const membershipPodcasts = [
  {
    title: 'Premium Scripture Circle',
    description: 'An in-depth scripture series reserved for members, with guided contemplation.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: AUDIO(5),
    thumbnailUrl: THUMB('photo-1457369804613-52c61a468e7d'),
    duration: '30:00',
    category: 'Scripture',
    accessType: 'membership',
  },
];

const paidPodcasts = [
  {
    title: 'Deep Mantra Immersion',
    description: 'A premium-length mantra immersion for deeper spiritual focus and inner quiet.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: AUDIO(6),
    thumbnailUrl: THUMB('photo-1470770841072-f978cf4d019e'),
    duration: '45:00',
    category: 'Mantra',
    accessType: 'paid',
    price: 199,
  },
];

const upsertPodcast = async (podcast) => {
  const payload = { ...podcast, currencyCode: 'INR' };
  return Podcast.findOneAndUpdate(
    { title: podcast.title },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const seedPodcasts = async () => {
  try {
    await connectDatabase();

    for (const podcast of podcastCatalog) {
      await upsertPodcast(podcast);
    }

    for (const podcast of paidPodcasts) {
      await upsertPodcast(podcast);
    }

    const plan = await MembershipPlan.findOne({ slug: { $in: ['silver', 'copper', 'bronze'] } })
      .sort({ displayOrder: -1 });
    if (plan) {
      for (const podcast of membershipPodcasts) {
        await upsertPodcast({ ...podcast, requiredMemberships: [plan._id] });
      }
    } else {
      console.warn('No membership plans found — skipping membership podcasts. Run "npm run seed-memberships" first.');
    }

    const podcasts = await Podcast.find({}).sort({ createdAt: -1 }).select('title category accessType source');
    console.log(`Seeded ${podcasts.length} podcasts:`);
    console.table(
      podcasts.map((p) => ({
        title: p.title,
        category: p.category,
        access: p.accessType,
        source: p.source,
      }))
    );
    console.log('Free podcasts visible in the app:', await Podcast.countDocuments({ accessType: 'free' }));
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed podcasts:', error);
    process.exit(1);
  }
};

seedPodcasts();
