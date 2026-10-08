import Booking from '../models/booking.models.js';
import CounselingService from '../models/counselingService.model.js';
import { setupDB } from './db.js';

setupDB();

const nextMondayIso = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString();
};

describe('Counseling slots - two shifts with a mid-day break', () => {
  it('splits the day around the break', async () => {
    const service = await CounselingService.create({
      title: 'Break Test',
      description: 'test',
      duration: '60 mins',
      price: 0,
      counselorName: 'Tester',
      isActive: true,
      intervalMinutes: 60,
      businessHours: {
        monday: { start: '09:00', end: '18:00', isActive: true, breakStart: '13:00', breakEnd: '14:00' },
        tuesday: { start: '09:00', end: '18:00', isActive: true },
        wednesday: { start: '09:00', end: '18:00', isActive: true },
        thursday: { start: '09:00', end: '18:00', isActive: true },
        friday: { start: '09:00', end: '18:00', isActive: true },
        saturday: { start: '10:00', end: '16:00', isActive: false },
        sunday: { start: '10:00', end: '16:00', isActive: false },
      },
    });

    const slots = await Booking.getAvailableSlots(nextMondayIso(), String(service._id));

    expect(slots).toContain('09:00');
    expect(slots).toContain('12:00');
    expect(slots).toContain('14:00');
    expect(slots).toContain('17:00');
    // Break window excluded.
    expect(slots).not.toContain('13:00');
  });

  it('keeps a continuous day when no break is set', async () => {
    const service = await CounselingService.create({
      title: 'No Break',
      description: 'test',
      duration: '60 mins',
      price: 0,
      counselorName: 'Tester',
      isActive: true,
      intervalMinutes: 60,
      businessHours: {
        monday: { start: '09:00', end: '18:00', isActive: true },
        tuesday: { start: '09:00', end: '18:00', isActive: true },
        wednesday: { start: '09:00', end: '18:00', isActive: true },
        thursday: { start: '09:00', end: '18:00', isActive: true },
        friday: { start: '09:00', end: '18:00', isActive: true },
        saturday: { start: '10:00', end: '16:00', isActive: false },
        sunday: { start: '10:00', end: '16:00', isActive: false },
      },
    });

    const slots = await Booking.getAvailableSlots(nextMondayIso(), String(service._id));
    expect(slots).toContain('13:00');
  });
});
