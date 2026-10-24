import mongoose from 'mongoose';
import connectDatabase from '../src/config/database.js';
import { runCertificationBackfill } from '../src/services/certificationBackfill.service.js';

const apply = process.argv.includes('--apply');

const run = async () => {
  try {
    await connectDatabase();
    const report = await runCertificationBackfill({ dryRun: !apply });
    console.log(JSON.stringify(report, null, 2));
    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to persist these changes.');
    }
  } catch (error) {
    console.error('Certification backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
