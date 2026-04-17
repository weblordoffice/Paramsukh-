import crypto from 'crypto';
import { EventRegistration } from '../../models/eventRegistration.models.js';
import { Event } from '../../models/event.models.js';

export const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';
    
    // Verify signature - assuming it has passed simple JSON parsing
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== req.headers['x-razorpay-signature']) {
      return res.status(400).json({ status: 'ignored', message: 'Invalid signature' });
    }

    const { event, payload } = req.body;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment.entity;
      const notes = paymentEntity.notes;

      // Handling logic
      if (notes && notes.type === 'event' && notes.registrationId) {
        const registration = await EventRegistration.findById(notes.registrationId);
        
        if (registration && registration.status !== 'confirmed') {
          registration.paymentStatus = 'completed';
          registration.paymentId = paymentEntity.id;
          registration.paidAt = new Date();
          registration.status = 'confirmed';
          await registration.save(); // pre-save will create ticketId automatically

          // Increment atomically if confirmed via webhook (safety net)
          await Event.findByIdAndUpdate(notes.eventId, { $inc: { currentAttendees: 1 } });
          console.log(`✅ Webhook: Registration ${registration._id} confirmed`);
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ status: 'error' });
  }
};
