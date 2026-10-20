import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import { Assignment, Course } from '../src/models/course.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

// Target a course the copper plan unlocks. Prefer the one titled "copper course",
// otherwise fall back to the first published course included in the copper plan.
const TARGET_TITLE = /copper course/i;

const resolveTargetCourse = async () => {
  const byTitle = await Course.findOne({ title: TARGET_TITLE });
  if (byTitle) return byTitle;
  return Course.findOne({ includedInPlans: 'copper', status: 'published' }).sort({ createdAt: 1 });
};

const buildLiveSessions = () => {
  const now = Date.now();
  return [
    {
      title: 'Live Guided Meditation — Week 1',
      description: 'Join the live guided session; there is a short Q&A at the end.',
      scheduledAt: new Date(now - 10 * MIN_MS),
      durationInMinutes: 60,
      meetingPlatform: 'zoom',
      meetingLink: 'https://zoom.us/j/1234567890',
      resources: [{ title: 'Session slides', pdfUrl: 'https://example.com/sessions/week1-slides.pdf' }],
      status: 'scheduled',
      recordingUrl: null,
    },
    {
      title: 'Live Breath Awareness Practice',
      description: 'A live practice session focused on breath awareness and posture.',
      scheduledAt: new Date(now + 3 * DAY_MS),
      durationInMinutes: 45,
      meetingPlatform: 'google-meet',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      resources: [],
      status: 'scheduled',
      recordingUrl: null,
    },
    {
      title: 'Live Q&A: Building Your Practice',
      description: 'Bring your questions for an open Q&A with the teacher.',
      scheduledAt: new Date(now + 10 * DAY_MS),
      durationInMinutes: 60,
      meetingPlatform: 'teams',
      meetingLink: 'https://teams.microsoft.com/l/meetup-join/xyz',
      resources: [],
      status: 'scheduled',
      recordingUrl: null,
    },
    {
      title: 'Replay: Foundations Kickoff',
      description: 'Recorded live session, now available as a replay.',
      scheduledAt: new Date(now - 7 * DAY_MS),
      durationInMinutes: 60,
      meetingPlatform: 'zoom',
      meetingLink: 'https://zoom.us/j/9999999999',
      recordingUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
      resources: [],
      status: 'completed',
    },
    {
      title: 'Evening Meditation (cancelled)',
      description: 'This session was cancelled and should not appear in the list.',
      scheduledAt: new Date(now + 5 * DAY_MS),
      durationInMinutes: 45,
      meetingPlatform: 'other',
      meetingLink: 'https://example.com/live/cancelled',
      resources: [],
      status: 'cancelled',
      recordingUrl: null,
    },
  ];
};

const assignmentCatalog = [
  {
    title: 'Week 1 Reflection',
    description: 'Reflect on your first week of practice.',
    order: 1,
    questions: [
      {
        questionText: 'How many minutes did you meditate on most days this week?',
        type: 'mcq',
        options: ['Less than 5', '5 to 10', '10 to 20', 'More than 20'],
        correctAnswer: '10 to 20',
        explanation: 'Aim for 10 to 20 minutes as a sustainable daily habit.',
      },
      {
        questionText: 'Describe how you felt after your longest session.',
        type: 'input',
        correctAnswer: 'Calmer and more focused',
        explanation: 'There is no single right answer here — just reflect honestly.',
      },
    ],
  },
  {
    title: 'Breath Awareness Quiz',
    description: 'A short quiz to check your understanding of breath awareness.',
    order: 2,
    questions: [
      {
        questionText: 'Where should your attention rest during breath awareness?',
        type: 'mcq',
        options: ['On the breath at the nostrils', 'On a screen', 'On background noise', 'On nothing'],
        correctAnswer: 'On the breath at the nostrils',
        explanation: 'Anchoring attention at the nostrils helps steady the mind.',
      },
      {
        questionText: 'What is the recommended posture for practice?',
        type: 'mcq',
        options: ['Slouched and relaxed', 'Upright with a stable base', 'Lying flat always', 'Standing only'],
        correctAnswer: 'Upright with a stable base',
        explanation: 'A stable, upright posture keeps you alert yet relaxed.',
      },
    ],
  },
];

const seedCourseActivities = async () => {
  try {
    await connectDatabase();

    const course = await resolveTargetCourse();
    if (!course) {
      throw new Error('No copper-accessible course found to attach activities to.');
    }

    const assignmentIds = [];
    for (const assignment of assignmentCatalog) {
      const saved = await Assignment.findOneAndUpdate(
        { title: assignment.title },
        { $set: { ...assignment, isStandalone: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      assignmentIds.push(saved._id);
    }

    const liveSessions = buildLiveSessions();
    await Course.updateOne(
      { _id: course._id },
      { $set: { liveSessions, assignments: assignmentIds } }
    );

    const updated = await Course.findById(course._id).select('title slug liveSessions assignments includedInPlans').lean();
    console.log(`Course: ${updated.title} (${updated._id}) | plans: ${(updated.includedInPlans || []).join(', ') || 'none'}`);
    console.table(
      updated.liveSessions.map((session) => ({
        title: session.title,
        platform: session.meetingPlatform,
        status: session.status,
        scheduledAt: session.scheduledAt,
        minutes: session.durationInMinutes,
        recording: Boolean(session.recordingUrl),
      }))
    );
    console.log(`Assignments attached: ${updated.assignments.length} (${updated.assignments.map((id) => id.toString()).join(', ')})`);
    console.log(`Seeded ${updated.liveSessions.length} live sessions and ${updated.assignments.length} assignments.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed course activities:', error);
    process.exit(1);
  }
};

seedCourseActivities();
