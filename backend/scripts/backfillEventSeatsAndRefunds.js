import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import { Event } from '../src/models/event.models.js';
import { EventRegistration } from '../src/models/eventRegistration.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');

/**
 * Rebuild Event.reservedSeats from pending registrations and mark those
 * registrations as holding a seat. Idempotent.
 */
const run = async () => {
  try {
    await connectDatabase();

    const events = await Event.find({}).select('_id title reservedSeats');
    let eventsUpdated = 0;
    let registrationsUpdated = 0;

    for (const event of events) {
      const pending = await EventRegistration.find({
        eventId: event._id,
        status: 'pending',
      }).select('_id seatReserved');

      const expectedReservedSeats = pending.length;

      if (expectedReservedSeats === 0 && Number(event.reservedSeats || 0) === 0) {
        continue;
      }

      if (!dryRun) {
        if (pending.length > 0) {
          const result = await EventRegistration.updateMany(
            { _id: { $in: pending.map((registration) => registration._id) } },
            { $set: { seatReserved: true } }
          );
          registrationsUpdated += result.modifiedCount;
        }
        await Event.updateOne(
          { _id: event._id },
          { $set: { reservedSeats: expectedReservedSeats } }
        );
      }

      eventsUpdated += 1;
      console.log(
        `${dryRun ? '[dry-run] ' : ''}${event.title || event._id}: reservedSeats ${event.reservedSeats || 0} -> ${expectedReservedSeats} (${pending.length} pending)`
      );
    }

    console.log(
      `\n${dryRun ? 'Would update' : 'Updated'} ${eventsUpdated} events and ${registrationsUpdated} registrations.`
    );

    process.exit(0);
  } catch (error) {
    console.error('Failed to backfill event seats:', error);
    process.exit(1);
  }
};

run();
