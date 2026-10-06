/**
 * One-time migration: fix Cloudflare R2 public URLs that were generated with the
 * invalid `pub-<R2_ACCOUNT_ID>.r2.dev` host (returns 401) and rewrite them to the
 * correct `R2_PUBLIC_URL`.
 *
 * Usage:
 *   node scripts/fix-r2-public-urls.js          # dry run (report only)
 *   node scripts/fix-r2-public-urls.js --apply   # actually update
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

const BAD_HOST =
  process.env.R2_BAD_PUBLIC_HOST || `pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
const GOOD_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!GOOD_BASE) {
  console.error('❌ R2_PUBLIC_URL is not set in the environment.');
  process.exit(1);
}

const GOOD_HOST = GOOD_BASE.replace(/^https?:\/\//, '');

function collectReplacements(value, currentPath, out) {
  if (typeof value === 'string') {
    if (value.includes(BAD_HOST)) {
      out.push({
        path: currentPath,
        before: value,
        after: value.split(BAD_HOST).join(GOOD_HOST),
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectReplacements(item, `${currentPath}.${i}`, out));
    return;
  }
  if (value && typeof value === 'object') {
    // Skip BSON types (ObjectId, Date, Buffer, ...) — they expose _bsontype.
    if (value._bsontype) return;
    for (const key of Object.keys(value)) {
      collectReplacements(value[key], `${currentPath}.${key}`, out);
    }
  }
}

async function run() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');
  console.log(`Bad host : ${BAD_HOST}`);
  console.log(`Good host: ${GOOD_HOST}`);
  console.log(`Mode     : ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  let totalDocs = 0;
  let totalFields = 0;

  for (const { name } of collections) {
    const col = db.collection(name);
    const cursor = col.find({});
    let docsInCollection = 0;

    for await (const doc of cursor) {
      const matches = [];
      collectReplacements(doc, '', matches);
      if (matches.length === 0) continue;

      docsInCollection++;
      totalDocs++;
      totalFields += matches.length;

      const sets = {};
      for (const m of matches) {
        const fieldPath = m.path.replace(/^\./, '');
        sets[fieldPath] = m.after;
        console.log(`  [${name}] ${doc._id} ${fieldPath}`);
        console.log(`      - ${m.before}`);
        console.log(`      + ${m.after}`);
      }

      if (APPLY) {
        await col.updateOne({ _id: doc._id }, { $set: sets });
      }
    }

    if (docsInCollection > 0) {
      console.log(`[${name}] ${docsInCollection} document(s)\n`);
    }
  }

  console.log('----------------------------------------');
  console.log(`Documents affected: ${totalDocs}`);
  console.log(`Fields affected   : ${totalFields}`);
  console.log(APPLY ? 'Migration applied.' : 'Dry run complete. Re-run with --apply to update.');

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Migration failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
