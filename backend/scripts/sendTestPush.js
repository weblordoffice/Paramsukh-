import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import { DeviceToken } from '../src/models/notification.models.js';

dotenv.config();

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

// Mirrors mobile/utils/notificationNavigation.ts KNOWN_PATHS — a deep link
// outside this list falls back to the Notifications screen on the device.
const SUPPORTED_LINKS = [
  '/(home)/notifications',
  '/(home)/help-support',
  '/(home)/my-membership',
  '/(home)/community',
  '/(home)/podcasts',
  '/(home)/my-progress',
  '/(home)/courses',
  '/(home)/events',
  '/(home)/referral',
  '/(home)/settings',
  '/event-detail?eventId=<id>',
  '/course-detail?id=<id>',
  '/counseling',
  '/counseling-detail?bookingId=<id>',
  '/order-detail?orderId=<id>',
  '/orders',
  '/donations',
  '/shops',
  '/shop-detail',
  '/product-detail?productId=<id>',
  '/blogs',
  '/blog-detail?id=<id>',
];

const HELP = `
Send a test push (with a deep link) to a device.

Usage:
  node scripts/sendTestPush.js [options]

Options:
  --link   "/course-detail?id=..."   Deep link the tap should open (default "/home/notifications")
  --title  "Hello"                   Notification title
  --body   "Tap to open"             Notification body
  --user   <id|email|phone>          Target a specific user (default: most recently used device)
  --type   general                   Notification type sent in the payload
  --all                              Send to every registered device
  --help                             Show this help

Supported deep links (anything else falls back to Notifications):
  ${SUPPORTED_LINKS.join('\n  ')}

Examples:
  node scripts/sendTestPush.js --link "/(home)/events" --title "Events are live" --body "Tap to open"
  node scripts/sendTestPush.js --link "/course-detail?id=<mongoId>" --user user@example.com
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'all' || key === 'help') {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

async function resolveTokens(args) {
  if (args.all) {
    const all = await DeviceToken.find({}).lean();
    return { tokens: all, label: `all devices (${all.length})` };
  }

  if (args.user) {
    const or = [];
    if (mongoose.Types.ObjectId.isValid(args.user)) or.push({ _id: args.user });
    or.push({ email: String(args.user).toLowerCase() });
    or.push({ phone: args.user });
    const user = await User.findOne({ $or: or }).select('displayName email phone').lean();
    if (!user) {
      throw new Error(`No user found for "${args.user}"`);
    }
    const tokens = await DeviceToken.find({ user: user._id }).lean();
    return { tokens, label: `${user.displayName || user.email || user._id} (${tokens.length} device/s)` };
  }

  const latest = await DeviceToken.findOne({}).sort({ lastUsedAt: -1 }).lean();
  return { tokens: latest ? [latest] : [], label: `most recent device (${latest?.platform || 'n/a'})` };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const link = args.link || '/(home)/notifications';
  const title = args.title || 'ParamSukh test push';
  const body = args.body || 'Tap to open the deep-linked screen.';
  const type = args.type || 'general';

  if (!SUPPORTED_LINKS.some((supported) => supported.split('?')[0] === link.split('?')[0])) {
    console.warn(`⚠️  "${link}" is not in the mobile allow-list — tapping will fall back to Notifications.`);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing (run from the backend/ folder with backend/.env)');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log(`DB: ${mongoose.connection.name}`);

  const { tokens, label } = await resolveTokens(args);
  if (!tokens.length) {
    console.error('No device tokens found to send to.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Target: ${label}`);
  console.log(`Deep link: ${link}`);

  await mongoose.disconnect();

  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: { type, actionUrl: link },
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    badge: 1,
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  const json = await res.json();
  console.log(`\nSend HTTP ${res.status}`);
  console.log(JSON.stringify(json, null, 2));

  const ids = (json?.data || []).map((d) => d.id).filter(Boolean);
  if (ids.length) {
    console.log('Waiting 15s for receipts...');
    await new Promise((r) => setTimeout(r, 15000));
    const rr = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids }),
    });
    console.log(`Receipt HTTP ${rr.status}`);
    console.log(JSON.stringify(await rr.json(), null, 2));
  }

  console.log(`\nIf the receipt is "ok", the push was delivered — tap it on the device to open ${link}`);
}

main().catch((err) => {
  console.error('sendTestPush failed:', err?.message || err);
  process.exit(1);
});
