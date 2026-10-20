import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import { Event } from '../src/models/event.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY_MS = 24 * 60 * 60 * 1000;

const IMG = (id) => `https://images.unsplash.com/${id}?w=1200`;
const VIDEO_MP4 = (name) => `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`;

const buildSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Matrix: upcoming/past x online/physical x free/paid, with photos and/or videos.
const eventCatalog = [
  // ---------- UPCOMING ----------
  {
    title: 'Sunrise Meditation Circle',
    category: 'Meditation',
    locationType: 'online',
    location: 'Zoom',
    daysFromNow: 5,
    startHour: 6,
    durationHours: 1,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Guides',
    shortDescription: 'A live guided morning meditation for beginners and returning practitioners.',
    description:
      'Join a supportive morning meditation circle with breath awareness, silence, and practical guidance for building consistency.',
    tags: ['beginner', 'meditation', 'live'],
    color: '#F1842D',
    icon: 'sunny',
    emoji: '☀️',
  },
  {
    title: 'Inner Peace Weekend Retreat',
    category: 'Retreat',
    locationType: 'physical',
    location: 'Rishikesh Wellness Center',
    daysFromNow: 14,
    startHour: 8,
    durationHours: 8,
    isPaid: true,
    price: 2499,
    earlyBirdPrice: 1999,
    earlyBirdOffsetDays: 7,
    registrationRequired: true,
    organizer: 'ParamSukh Retreat Team',
    shortDescription: 'A one-day immersive retreat focused on silence, movement, and guided reflection.',
    description:
      'Experience a structured day of meditation, restorative movement, journaling, and group practice in a peaceful retreat space.',
    tags: ['retreat', 'spiritual', 'premium'],
    color: '#D97A2B',
    icon: 'leaf',
    emoji: '🍃',
    images: [
      { url: IMG('photo-1506126613408-eca07ce68773'), caption: 'Morning hall' },
      { url: IMG('photo-1544367567-0f2fcb009e0b'), caption: 'Outdoor practice' },
    ],
  },
  {
    title: 'Mindful Parenting Q&A',
    category: 'Workshop',
    locationType: 'online',
    location: 'Google Meet',
    daysFromNow: 9,
    startHour: 19,
    durationHours: 2,
    isPaid: true,
    price: 499,
    registrationRequired: true,
    organizer: 'ParamSukh Family Circle',
    shortDescription: 'Practical mindfulness tools for calmer and more connected parenting.',
    description:
      'An interactive session with examples, reflection prompts, and supportive Q&A around presence in family life.',
    tags: ['family', 'mindfulness', 'q&a'],
    color: '#E7A86A',
    icon: 'people',
    emoji: '👨‍👩‍👧',
  },
  {
    title: 'Community Satsang Evening',
    category: 'Discourse',
    locationType: 'physical',
    location: 'ParamSukh Hall, Delhi',
    daysFromNow: 21,
    startHour: 18,
    durationHours: 2,
    isPaid: false,
    registrationRequired: false,
    organizer: 'ParamSukh Teachers',
    shortDescription: 'An open evening of shared practice, music, and reflection.',
    description:
      'Come together for chanting, a short discourse, and community connection. Open to everyone — no registration needed.',
    tags: ['satsang', 'community'],
    color: '#C7671E',
    icon: 'book',
    emoji: '📖',
    images: [{ url: IMG('photo-1470252649378-9c29740c9fa8'), caption: 'Evening satsang' }],
  },

  // ---------- PAST (with photos and/or videos to test the media screen) ----------
  {
    title: 'Breathwork for Emotional Reset',
    category: 'Workshop',
    locationType: 'online',
    location: 'Zoom',
    daysFromNow: -5,
    startHour: 18,
    durationHours: 1,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Breath Team',
    shortDescription: 'A recorded workshop on practical breathwork for stress release.',
    description:
      'This recent session covered guided breathing, grounding, and recovery practices for emotionally heavy days.',
    tags: ['breathwork', 'stress', 'recorded'],
    color: '#B96524',
    icon: 'water',
    emoji: '🌬️',
    images: [{ url: IMG('photo-1518241353330-0f7941c2d9b5'), caption: 'Session key visual' }],
    videos: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
        title: 'Full session replay',
        description: 'Complete guided breathwork session.',
        thumbnailUrl: IMG('photo-1518241353330-0f7941c2d9b5'),
      },
    ],
  },
  {
    title: 'Silent Retreat Day',
    category: 'Retreat',
    locationType: 'physical',
    location: 'Rishikesh Wellness Center',
    daysFromNow: -14,
    startHour: 7,
    durationHours: 8,
    isPaid: true,
    price: 2999,
    registrationRequired: true,
    organizer: 'ParamSukh Retreat Team',
    shortDescription: 'A full day of noble silence, sitting and walking meditation.',
    description:
      'A structured silent day with periods of sitting and walking meditation, mindful meals, and evening reflection.',
    tags: ['retreat', 'silence', 'meditation'],
    color: '#8B5CF6',
    icon: 'leaf',
    emoji: '🤫',
    images: [
      { url: IMG('photo-1500534314209-a25ddb2bd429'), caption: 'Retreat grounds' },
      { url: IMG('photo-1470770841072-f978cf4d019e'), caption: 'Walking path' },
      { url: IMG('photo-1519710164239-da123dc03ef4'), caption: 'Evening reflection' },
    ],
    videos: [
      {
        type: 'local',
        url: VIDEO_MP4('BigBuckBunny'),
        title: 'Highlights reel',
        description: 'Short highlights from the silent retreat day.',
        thumbnailUrl: IMG('photo-1500534314209-a25ddb2bd429'),
      },
    ],
  },
  {
    title: 'Scripture Reflection Evening',
    category: 'Discourse',
    locationType: 'physical',
    location: 'ParamSukh Hall, Delhi',
    daysFromNow: -20,
    startHour: 18,
    durationHours: 2,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Teachers',
    shortDescription: 'A reflective discourse connecting timeless teachings to modern challenges.',
    description: 'Explore selected teachings, group contemplation, and practical application for daily inner steadiness.',
    tags: ['scripture', 'reflection'],
    color: '#C7671E',
    icon: 'book',
    emoji: '📖',
    images: [
      { url: IMG('photo-1457369804613-52c61a468e7d'), caption: 'Reading circle' },
      { url: IMG('photo-1499209974431-9dddcece7f88'), caption: 'Hall view' },
    ],
  },
  {
    title: 'Sound Healing Live',
    category: 'Workshop',
    locationType: 'online',
    location: 'Zoom',
    daysFromNow: -10,
    startHour: 20,
    durationHours: 1,
    isPaid: true,
    price: 799,
    registrationRequired: true,
    organizer: 'ParamSukh Sound Team',
    shortDescription: 'A recorded live sound bath with singing bowls and gongs.',
    description: 'Immerse in a live sound bath recorded for on-demand replay.',
    tags: ['sound', 'healing', 'recorded'],
    color: '#2DD4BF',
    icon: 'musical-notes',
    emoji: '🎵',
    images: [{ url: IMG('photo-1591291621164-2c6367723315'), caption: 'Singing bowls' }],
    videos: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
        title: 'Sound bath replay',
        description: 'Full sound bath session.',
        thumbnailUrl: IMG('photo-1591291621164-2c6367723315'),
      },
      {
        type: 'local',
        url: VIDEO_MP4('ElephantsDream'),
        title: 'Behind the scenes',
        description: 'A short look at setting up the sound bath.',
        thumbnailUrl: IMG('photo-1591291621164-2c6367723315'),
      },
    ],
  },
  {
    title: 'Guided Visualisation Replay',
    category: 'Meditation',
    locationType: 'online',
    location: 'Recorded',
    daysFromNow: -30,
    startHour: 21,
    durationHours: 1,
    isPaid: false,
    registrationRequired: false,
    organizer: 'ParamSukh Guides',
    shortDescription: 'A video-only recorded guided visualisation (no photo gallery).',
    description: 'A calming recorded visualisation to unwind. Video only — useful for testing video-only events.',
    tags: ['visualisation', 'recorded', 'video'],
    color: '#6366F1',
    icon: 'moon',
    emoji: '🌙',
    videos: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        title: 'Recorded session',
        description: 'Full guided visualisation.',
        thumbnailUrl: IMG('photo-1511296265581-c2450046447d'),
      },
    ],
  },
];

const buildEventPayload = (event) => {
  const startTime = new Date(Date.now() + event.daysFromNow * DAY_MS);
  startTime.setHours(event.startHour, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + event.durationHours * 60 * 60 * 1000);
  const registrationDeadline = new Date(startTime.getTime() - 2 * DAY_MS);
  const earlyBirdEndDate =
    typeof event.earlyBirdOffsetDays === 'number'
      ? new Date(startTime.getTime() - event.earlyBirdOffsetDays * DAY_MS)
      : null;

  const slug = buildSlug(event.title);

  let status = 'upcoming';
  const now = Date.now();
  if (startTime.getTime() > now) status = 'upcoming';
  else if (endTime.getTime() < now) status = 'past';
  else status = 'ongoing';

  const images = (event.images || []).map((image) => ({ url: image.url, caption: image.caption || '' }));
  const videos = (event.videos || []).map((video) => ({
    type: video.type || 'youtube',
    url: video.url,
    title: video.title || '',
    description: video.description || '',
    thumbnailUrl: video.thumbnailUrl || null,
  }));

  return {
    title: event.title,
    slug,
    description: event.description,
    shortDescription: event.shortDescription,
    icon: event.icon,
    color: event.color,
    emoji: event.emoji,
    thumbnailUrl: IMG('photo-1500530855697-b586d89ba3ee') + `&sig=${slug}`,
    bannerUrl: IMG('photo-1506744038136-46273834b3fb') + `&sig=${slug}`,
    eventDate: startTime,
    eventTime: startTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
    startTime,
    endTime,
    timezone: 'Asia/Kolkata',
    location: event.locationType === 'online' ? event.location || 'Online' : event.location,
    locationType: event.locationType,
    address:
      event.locationType === 'physical'
        ? { street: 'Wellness Avenue', city: 'Delhi', state: 'Delhi', zipCode: '110001', country: 'India' }
        : undefined,
    onlineMeetingLink: event.locationType === 'online' ? `https://meet.paramsukh.test/${slug}` : null,
    category: event.category,
    tags: event.tags || [],
    isPaid: event.isPaid,
    price: event.price || 0,
    currency: 'INR',
    earlyBirdPrice: event.earlyBirdPrice || null,
    earlyBirdEndDate,
    maxAttendees: event.isPaid ? 150 : 300,
    registrationRequired: event.registrationRequired,
    registrationDeadline,
    status,
    isActive: true,
    organizer: event.organizer,
    images,
    videos,
    imageCount: images.length,
    hasRecording: videos.length > 0,
    recordingUrl: videos.find((v) => v.type === 'youtube')?.url || null,
    requirements: ['Arrive 10 minutes early', 'Keep a notebook handy'],
    whatToBring: event.locationType === 'physical' ? ['Water bottle', 'Comfortable clothing'] : ['Notebook'],
    additionalInfo: 'Seeded event for full-coverage testing.',
  };
};

const seedEvents = async () => {
  try {
    await connectDatabase();

    for (const event of eventCatalog) {
      const payload = buildEventPayload(event);
      await Event.findOneAndUpdate(
        { slug: payload.slug },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const events = await Event.find({ slug: { $in: eventCatalog.map((e) => buildSlug(e.title)) } })
      .sort({ startTime: 1 })
      .lean();

    console.table(
      events.map((event) => ({
        title: event.title,
        status: event.status,
        where: event.locationType,
        paid: event.isPaid,
        price: event.isPaid ? event.price : 0,
        images: event.imageCount,
        videos: event.videos?.length || 0,
      }))
    );

    console.log(
      `Events seeded — total: ${events.length}, upcoming: ${events.filter((e) => e.status !== 'past').length}, past: ${events.filter((e) => e.status === 'past').length}, with photos: ${events.filter((e) => e.imageCount > 0).length}, with videos: ${events.filter((e) => (e.videos?.length || 0) > 0).length}`
    );
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed events:', error);
    process.exit(1);
  }
};

seedEvents();
