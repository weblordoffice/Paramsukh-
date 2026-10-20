import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDatabase from '../src/config/database.js';
import Booking from '../src/models/booking.models.js';
import CounselingService from '../src/models/counselingService.model.js';
import { User } from '../src/models/user.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const services = [
  {
    title: 'General Wellness Consultation',
    description: 'A free first conversation to understand your goals and point you to the right support.',
    duration: '60 mins',
    price: 0,
    isFree: true,
    counselorName: 'Dr. Ananya Iyer',
    icon: 'heart',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    category: 'General',
  },
  {
    title: 'Mindfulness & Meditation Coaching',
    description: 'Guided practice and habit-building for a steadier, calmer mind.',
    duration: '45 mins',
    price: 0,
    isFree: true,
    counselorName: 'Swami Anand',
    icon: 'leaf',
    color: '#10B981',
    bgColor: '#ECFDF5',
    category: 'Mindfulness',
  },
  {
    title: 'Spiritual Morning Guidance',
    description: 'One-to-one guidance on practice, scripture and daily spiritual discipline.',
    duration: '60 mins',
    price: 500,
    isFree: false,
    counselorName: 'Pandit Rajesh Sharma',
    icon: 'sunny',
    color: '#F1842D',
    bgColor: '#FFF7ED',
    category: 'Spirituality',
  },
  {
    title: 'Restorative Sleep Consultation',
    description: 'A specialist session to rebuild restful sleep with practical, personal routines.',
    duration: '60 mins',
    price: 1200,
    isFree: false,
    counselorName: 'Dr. Meera Nair',
    icon: 'moon',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    category: 'Wellness',
  },
];

const dayAt = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Every scenario: free/paid, upcoming/past, confirmed/pending/completed/cancelled/no_show/rescheduled,
// payment pending/paid/refunded, and reschedule requests (user- and admin-initiated).
const scenarios = [
  { service: 'General Wellness Consultation', day: 3, time: '10:00', status: 'confirmed', paid: false, platform: 'google_meet', link: 'https://meet.google.com/seed-free-confirmed' },
  { service: 'Spiritual Morning Guidance', day: 5, time: '11:00', status: 'confirmed', paid: true, paymentId: 'seed_pay_1', platform: 'zoom', link: 'https://zoom.us/j/seed-paid-confirmed' },
  { service: 'Restorative Sleep Consultation', day: 7, time: '12:00', status: 'pending', paid: true, pendingPayment: true },
  { service: 'Mindfulness & Meditation Coaching', day: 9, time: '13:00', status: 'pending', paid: false },
  { service: 'General Wellness Consultation', day: -5, time: '10:00', status: 'completed', paid: false, completed: true, platform: 'phone' },
  { service: 'Spiritual Morning Guidance', day: -8, time: '11:00', status: 'completed', paid: true, paymentId: 'seed_pay_2', completed: true, platform: 'in_person' },
  { service: 'Restorative Sleep Consultation', day: -3, time: '12:00', status: 'cancelled', paid: true, paymentId: 'seed_pay_3', refunded: true, cancelledBy: 'user' },
  { service: 'Mindfulness & Meditation Coaching', day: -2, time: '13:00', status: 'cancelled', paid: false, cancelledBy: 'user' },
  { service: 'General Wellness Consultation', day: -6, time: '14:00', status: 'no_show', paid: false, platform: 'in_person' },
  { service: 'Spiritual Morning Guidance', day: 12, time: '15:00', status: 'rescheduled', paid: true, paymentId: 'seed_pay_4', platform: 'zoom', link: 'https://zoom.us/j/seed-rescheduled', rescheduledBy: 'admin' },
  { service: 'General Wellness Consultation', day: 14, time: '16:00', status: 'confirmed', paid: false, platform: 'phone',
    rescheduleRequest: { status: 'pending', requestedBy: 'user', requestedDay: 16, requestedTime: '18:00', reason: 'Need a later slot, please.' } },
  { service: 'Mindfulness & Meditation Coaching', day: 15, time: '17:00', status: 'confirmed', paid: false, platform: 'google_meet', link: 'https://meet.google.com/seed-admin-reschedule',
    rescheduleRequest: { status: 'pending', requestedBy: 'admin', requestedDay: 17, requestedTime: '19:00', reason: 'Counselor unavailable, proposing a new time.' } },
];

const resolveUser = async () => {
  const email = process.env.SEED_USER_EMAIL;
  if (email) {
    const byEmail = await User.findOne({ email });
    if (byEmail) return byEmail;
  }
  const demo = await User.findOne({ phone: '+919999999999' });
  if (demo) return demo;
  return User.findOne({}).sort({ createdAt: 1 });
};

const run = async () => {
  try {
    await connectDatabase();
    console.log('Connected DB =', mongoose.connection.name);

    const user = await resolveUser();
    if (!user) throw new Error('No target user found');
    console.log(`Bookings for: ${user.displayName} <${user.email || user.phone}>`);

    const servicesByTitle = {};
    for (const service of services) {
      const saved = await CounselingService.findOneAndUpdate(
        { title: service.title },
        { $set: { ...service, currencyCode: 'INR', isActive: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      servicesByTitle[service.title] = { doc: saved, price: service.price, isFree: service.isFree, counselorName: service.counselorName };
    }

    const now = Date.now();
    for (const s of scenarios) {
      const svc = servicesByTitle[s.service];
      if (!svc) continue;

      const paid = s.paid === true;
      const amount = paid ? svc.price : 0;
      const bookingDate = dayAt(s.day);

      const payload = {
        user: user._id,
        counselorType: svc.doc.title,
        counselorName: svc.counselorName,
        bookingType: svc.doc.title,
        bookingTitle: svc.doc.title,
        bookingDate,
        bookingTime: s.time,
        duration: 60,
        userPhone: user.phone || '+919999999999',
        userEmail: user.email || undefined,
        userNotes: s.notes || 'Seeded booking for testing.',
        status: s.status,
        isFree: !paid,
        amount,
        paymentStatus: 'not_required',
        meetingPlatform: s.platform || 'zoom',
      };

      if (paid) {
        if (s.pendingPayment) {
          const expires = new Date(now + 2 * DAY_MS);
          Object.assign(payload, {
            paymentStatus: 'pending',
            razorpayOrderId: `seed_order_${s.time.replace(':', '')}`,
            paymentLinkId: `seed_link_${s.time.replace(':', '')}`,
            paymentLinkUrl: 'https://rzp.io/seed',
            paymentLinkExpiresAt: expires,
          });
        } else {
          Object.assign(payload, {
            paymentStatus: s.refunded ? 'refunded' : 'paid',
            paymentId: s.paymentId,
            paymentMethod: 'razorpay',
            paidAt: new Date(bookingDate.getTime() - DAY_MS),
          });
        }
      } else {
        payload.paymentStatus = 'not_required';
      }

      if (s.link) payload.meetingLink = s.link;
      if (s.completed) payload.completedAt = new Date(bookingDate.getTime() + HOUR_MS);
      if (s.status === 'cancelled') {
        payload.cancelledAt = new Date(bookingDate.getTime() - DAY_MS);
        payload.cancelledBy = s.cancelledBy || 'user';
        payload.cancellationReason = 'Seeded cancellation.';
      }
      if (s.refunded) {
        Object.assign(payload, {
          refundId: `seed_refund_${s.paymentId}`,
          refundAmount: amount,
          refundStatus: 'processed',
          refundProcessedAt: new Date(now - DAY_MS),
        });
      }
      if (s.status === 'rescheduled') {
        Object.assign(payload, {
          rescheduledFrom: new Date(bookingDate.getTime() - 3 * DAY_MS),
          rescheduledReason: 'Counselor rescheduled.',
          rescheduledBy: s.rescheduledBy || 'admin',
        });
      }
      if (s.rescheduleRequest) {
        const rr = s.rescheduleRequest;
        payload.rescheduleRequest = {
          status: rr.status,
          requestedBy: rr.requestedBy,
          requestedNewDate: dayAt(rr.requestedDay),
          requestedNewTime: rr.requestedTime,
          reason: rr.reason,
        };
      }

      await Booking.findOneAndUpdate(
        { user: user._id, counselorType: svc.doc.title, bookingDate, bookingTime: s.time },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const all = await Booking.find({ user: user._id }).select('bookingTitle status isFree amount paymentStatus bookingDate bookingTime meetingPlatform').sort({ bookingDate: 1 }).lean();
    console.table(all.map((b) => ({
      title: b.bookingTitle,
      status: b.status,
      paid: b.isFree ? 'free' : `₹${b.amount}`,
      payment: b.paymentStatus,
      date: new Date(b.bookingDate).toISOString().slice(0, 10),
      time: b.bookingTime,
      platform: b.meetingPlatform,
    })));
    console.log(`Counseling services: ${Object.keys(servicesByTitle).length} | bookings for this user: ${all.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed counseling bookings:', error);
    process.exit(1);
  }
};

run();
