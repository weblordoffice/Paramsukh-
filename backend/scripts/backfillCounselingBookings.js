import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDatabase from '../src/config/database.js';
import Booking from '../src/models/booking.models.js';
import CounselingService from '../src/models/counselingService.model.js';
import { startOfUtcDay, toDateKey } from '../src/utils/timezone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');

const recreateBookingSlotIndex = async () => {
  const collection = Booking.collection;
  const indexes = await collection.indexes();
  const slotIndex = indexes.find(
    (index) =>
      index.key?.counselorType === 1
      && index.key?.bookingDate === 1
      && index.key?.bookingTime === 1
  );

  if (slotIndex) {
    console.log(`Dropping slot index ${slotIndex.name}`);
    if (!dryRun) {
      await collection.dropIndex(slotIndex.name).catch((error) => {
        if (error?.codeName !== 'IndexNotFound') throw error;
      });
    }
  }

  if (!dryRun) {
    await Booking.syncIndexes();
  }
  console.log(`${dryRun ? 'Would recreate' : 'Recreated'} booking slot indexes`);
};

const run = async () => {
  try {
    await connectDatabase();

    const serverInfo = await mongoose.connection.db.admin().serverInfo();
    const version = serverInfo?.version || 'unknown';
    console.log(`MongoDB server version: ${version}`);
    if (Number(String(version).split('.')[0]) < 5) {
      console.warn('⚠️ MongoDB < 5.0: partial indexes with $in are not supported.');
    }

    const services = await CounselingService.find({}).select('_id title timezone');
    const serviceByTitle = new Map(services.map((service) => [String(service.title), service]));
    const serviceById = new Map(services.map((service) => [String(service._id), service]));

    const bookings = await Booking.find({});
    let updated = 0;

    for (const booking of bookings) {
      const service = (booking.serviceId && serviceById.get(String(booking.serviceId)))
        || serviceByTitle.get(String(booking.counselorType))
        || null;

      const normalizedDate = startOfUtcDay(booking.bookingDate);
      const nextServiceId = service?._id || booking.serviceId || null;
      const nextTimezone = service?.timezone || booking.timezone || 'Asia/Kolkata';
      const shouldBeWaitlisted =
        booking.waitlistRank != null
        && !['cancelled', 'completed', 'no_show', 'waitlisted'].includes(booking.status);

      const needsUpdate =
        (normalizedDate && booking.bookingDate?.getTime() !== normalizedDate.getTime())
        || (nextServiceId && String(booking.serviceId || '') !== String(nextServiceId))
        || booking.timezone !== nextTimezone
        || shouldBeWaitlisted
        || (booking.reminderSentAt && !booking.reminder24SentAt)
        || (booking.reminderSentAt && !booking.reminder1SentAt);

      if (!needsUpdate) continue;

      updated += 1;
      if (dryRun) continue;

      const set = {
        timezone: nextTimezone,
      };
      if (normalizedDate) set.bookingDate = normalizedDate;
      if (nextServiceId) set.serviceId = nextServiceId;
      if (shouldBeWaitlisted) set.status = 'waitlisted';
      if (booking.reminderSentAt) {
        set.reminder24SentAt = booking.reminder24SentAt;
        set.reminder1SentAt = booking.reminderSentAt;
      }

      await Booking.collection.updateOne(
        { _id: booking._id },
        { $set: set }
      );
    }

    console.log(
      `${dryRun ? 'Would update' : 'Updated'} ${updated} bookings (date normalization, serviceId, timezone, waitlist status, reminder flags).`
    );

    await recreateBookingSlotIndex();

    process.exit(0);
  } catch (error) {
    console.error('Failed to backfill counseling bookings:', error);
    process.exit(1);
  }
};

run();
