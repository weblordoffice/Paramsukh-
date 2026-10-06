/**
 * One-time copy of user-related data from the production database into the
 * local development database, on the SAME cluster.
 *
 * Copies only:
 *   - users
 *   - admins
 *
 * Everything else (plans, courses, groups, orders, memberships, ...) is NOT
 * copied, so the dev database stays clean.
 *
 * Usage (from the backend folder):
 *   node scripts/copy-users-to-dev.js            # dry run (report only)
 *   node scripts/copy-users-to-dev.js --apply     # actually copy
 *
 * Database names come from the environment (defaults shown):
 *   PROD_MONGO_DB=psog
 *   DEV_MONGO_DB=psog_dev
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 500;
const COLLECTIONS = ['users', 'admins'];

const uri = process.env.MONGO_URI;
const PROD_DB = process.env.PROD_MONGO_DB || 'psog';
const DEV_DB = process.env.DEV_MONGO_DB || 'psog_dev';

if (!uri) {
  console.error('FATAL: MONGO_URI is not set (check backend/.env).');
  process.exit(1);
}

if (!DEV_DB || DEV_DB === PROD_DB) {
  console.error(`FATAL: refusing to run because DEV_MONGO_DB ("${DEV_DB}") equals PROD_MONGO_DB ("${PROD_DB}").`);
  process.exit(1);
}

const copyCollection = async (source, target, name) => {
  const sourceDocs = await source.collection(name).find({}).toArray();
  console.log(`\n[${name}] source "${PROD_DB}": ${sourceDocs.length} document(s)`);

  if (!APPLY) {
    console.log(`[${name}] dry run: would upsert ${sourceDocs.length} document(s) into "${DEV_DB}"`);
    return { sourceCount: sourceDocs.length, targetCount: null };
  }

  if (sourceDocs.length > 0) {
    for (let i = 0; i < sourceDocs.length; i += BATCH_SIZE) {
      const batch = sourceDocs.slice(i, i + BATCH_SIZE);
      const operations = batch.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await target.collection(name).bulkWrite(operations, { ordered: false });
    }
  }

  const targetCount = await target.collection(name).countDocuments();
  console.log(`[${name}] copied into "${DEV_DB}": now ${targetCount} document(s)`);
  return { sourceCount: sourceDocs.length, targetCount };
};

const run = async () => {
  console.log('============================================');
  console.log('  COPY users + admins: PROD -> DEV');
  console.log('============================================');
  console.log(`  Source DB : ${PROD_DB}`);
  console.log(`  Target DB : ${DEV_DB}`);
  console.log(`  Mode      : ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);
  console.log('============================================');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const source = client.db(PROD_DB);
    const target = client.db(DEV_DB);

    for (const name of COLLECTIONS) {
      await copyCollection(source, target, name);
    }

    console.log('\nDone.');
    if (!APPLY) {
      console.log('This was a dry run. Re-run with --apply to copy the data.');
    }
  } finally {
    await client.close();
  }
};

run().catch((error) => {
  console.error('\nCopy failed:', error.message);
  process.exit(1);
});
