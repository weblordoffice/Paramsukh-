import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM || 'Paramsukh <onboarding@resend.dev>';

let resend = null;
const getResend = () => {
    if (!process.env.RESEND_API_KEY) return null;
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
};

const safeSend = (fn) => {
    if (!process.env.RESEND_API_KEY) return Promise.resolve();
    return fn().catch(err => {
        console.error('Email send failed:', err?.message || err);
        return { success: false, error: err?.message || 'Unknown email error' };
    });
};

export const sendEmail = async ({ to, subject, html }) => {
    try {
        const instance = getResend();
        if (!instance) {
            return { success: false, message: 'Missing API Key' };
        }
        const { data, error } = await instance.emails.send({ from: FROM, to, subject, html });
        if (error) {
            console.error('Resend error:', error);
            return { success: false, error };
        }
        console.log(`Email sent: ${subject} → ${to} (${data?.id})`);
        return { success: true, data };
    } catch (err) {
        console.error('Send email exception:', err);
        return { success: false, error: err.message };
    }
};

const baseTemplate = (title, body) => `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:40px 0">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
<tr><td style="background:linear-gradient(135deg,#8B5CF6,#6D28D9);padding:32px 40px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">ParamSukh Gurukul</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${title}</p>
</td></tr>
<tr><td style="padding:32px 40px">
${body}
</td></tr>
<tr><td style="background:#f3f4f6;padding:20px 40px;text-align:center">
<p style="color:#9ca3af;font-size:12px;margin:0">© ${new Date().getFullYear()} ParamSukh. All rights reserved.</p>
</td></tr></table></td></tr></table></body></html>`;

export const sendWelcomeEmail = (user) => {
    if (!user.email) return;
    safeSend(() => sendEmail({
        to: user.email,
        subject: 'Welcome to ParamSukh!',
        html: baseTemplate('Welcome aboard!', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user.displayName}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Thank you for joining ParamSukh — your scientific online gurukul for holistic wellness.</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">You can now explore courses, join events, connect with the community, and start your wellness journey.</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Welcome to the family!</p>
        `),
    }));
};

export const sendOrderConfirmationEmail = (user, order) => {
    if (!user.email) return;
    safeSend(() => sendEmail({
        to: user.email,
        subject: `Order Confirmed — #${order.orderNumber}`,
        html: baseTemplate('Order Confirmed', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user.displayName}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Your order <strong>#${order.orderNumber}</strong> has been confirmed.</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0;font-size:14px;color:#6b7280">Total Amount</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#111827">₹${order.pricing?.total || order.totalAmount || 0}</p>
            </div>
            <p style="font-size:13px;color:#9ca3af">We'll notify you when it ships.</p>
        `),
    }));
};

export const sendReferralRewardEmail = (referrerId, { rewardType, rewardDays, referredUserName }) => {
    safeSend(async () => {
        const { User } = await import('../models/user.models.js');
        const referrer = await User.findById(referrerId).select('email displayName');
        if (!referrer || !referrer.email) return;

        const rewardText = rewardType === 'premium_extension'
            ? `${rewardDays} days of Premium membership`
            : 'a free course unlock';

        return sendEmail({
            to: referrer.email,
            subject: `Referral Reward Earned!`,
            html: baseTemplate('Referral Reward!', `
                <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${referrer.displayName}</strong>,</p>
                <p style="font-size:15px;color:#374151;line-height:1.6">Great news! <strong>${referredUserName || 'Your friend'}</strong> just completed their first course, and you earned a referral reward.</p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
                    <p style="margin:0;font-size:14px;color:#166534">Your Reward</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#15803d">${rewardText}</p>
                </div>
                <p style="font-size:15px;color:#374151;line-height:1.6">Keep sharing your referral code to earn more rewards!</p>
            `),
        });
    });
};

export const sendMembershipPurchaseEmail = (user) => {
    if (!user.email) return;
    safeSend(() => sendEmail({
        to: user.email,
        subject: 'Membership Activated — Welcome to Premium!',
        html: baseTemplate('Premium Access Unlocked', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user.displayName}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Your membership has been activated! You now have access to premium courses, exclusive events, counseling, and much more.</p>
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0;font-size:14px;color:#7c3aed">Plan</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#6d28d9">${user.subscriptionPlan || 'Premium'}</p>
            </div>
        `),
    }));
};

export const sendEventRegistrationEmail = (user, eventTitle, amount) => {
    if (!user.email) return;
    safeSend(() => sendEmail({
        to: user.email,
        subject: `Registered — ${eventTitle}`,
        html: baseTemplate('Event Registration Confirmed', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user.displayName}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">You're registered for <strong>${eventTitle}</strong>!</p>
            ${amount > 0 ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0;font-size:14px;color:#6b7280">Amount Paid</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#111827">₹${amount}</p>
            </div>` : ''}
            <p style="font-size:13px;color:#9ca3af">Check the app for event details and updates.</p>
        `),
    }));
};

export const sendDonationReceiptEmail = (user, donation) => {
    if (!user?.email) return;
    const amount = donation.amount ?? 0;
    const receiptNo = donation.receiptNumber || donation.transactionId || donation._id;
    safeSend(() => sendEmail({
        to: user.email,
        subject: 'Thank You for Your Donation 🙏',
        html: baseTemplate('Donation Receipt', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user.displayName || 'Friend'}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Thank you for your generous donation to Paramsukh Foundation. Your support helps us spread wellness and spiritual knowledge to everyone.</p>
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin:16px 0">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151">
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Receipt No.</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;font-family:monospace">${receiptNo}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Amount</td>
                        <td style="padding:4px 0;text-align:right;font-size:18px;font-weight:700;color:#6d28d9">₹${amount}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Payment Method</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;text-transform:capitalize">${donation.paymentMethod || 'razorpay'}</td>
                    </tr>
                    ${donation.transactionId ? `<tr>
                        <td style="padding:4px 0;color:#6b7280">Payment ID</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;font-family:monospace">${donation.transactionId}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Date</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827">${new Date(donation.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    </tr>
                </table>
            </div>
            <p style="font-size:13px;color:#9ca3af">This is a donation receipt for your records. Paramsukh Foundation thanks you for your kindness.</p>
        `),
    }));
};

export const sendPodcastPurchaseEmail = (user, podcast) => {
    if (!user?.email) return;
    safeSend(() => sendEmail({
        to: user.email,
        subject: `Podcast Purchase — ${podcast?.title || 'ParamSukh Podcast'}`,
        html: baseTemplate('Podcast Purchased', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user.displayName || 'Friend'}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Thank you for purchasing <strong>${podcast?.title || 'this podcast'}</strong>.</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0;font-size:14px;color:#6b7280">Amount Paid</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#111827">₹${podcast?.price || 0}</p>
            </div>
            <p style="font-size:13px;color:#9ca3af">You can now listen to this podcast anytime in the app.</p>
        `),
    }));
};

export const sendCounselingBookingEmail = (user, booking) => {
    const email = user?.email || booking?.userEmail;
    if (!email) return;
    const dateStr = booking?.bookingDate
        ? new Date(booking.bookingDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : '';
    safeSend(() => sendEmail({
        to: email,
        subject: 'Counseling Booking Confirmed',
        html: baseTemplate('Counseling Session Confirmed', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Hi <strong>${user?.displayName || 'Friend'}</strong>,</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">Your counseling session has been confirmed.</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#374151">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Counselor</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827">${booking?.counselorName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Session</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827">${booking?.bookingTitle || booking?.bookingType || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Date</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827">${dateStr || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0;color:#6b7280">Time</td>
                        <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827">${booking?.bookingTime || '-'}</td>
                    </tr>
                    ${booking?.amount ? `<tr>
                        <td style="padding:4px 0;color:#6b7280">Amount Paid</td>
                        <td style="padding:4px 0;text-align:right;font-weight:700;color:#15803d">₹${booking.amount}</td>
                    </tr>` : ''}
                </table>
            </div>
            <p style="font-size:13px;color:#9ca3af">You'll receive the meeting link before your session.</p>
        `),
    }));
};

export const sendCertificateEarnedEmail = (user, courseName, certificateId) => {
    if (!user.email) return;
    safeSend(() => sendEmail({
        to: user.email,
        subject: `Certificate Earned — ${courseName}`,
        html: baseTemplate('Certificate Earned!', `
            <p style="font-size:15px;color:#374151;line-height:1.6">Congratulations, <strong>${user.displayName}</strong>!</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">You've successfully completed <strong>${courseName}</strong> and earned a verifiable certificate.</p>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0;font-size:14px;color:#92400e">Certificate ID</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#d97706;font-family:monospace">${certificateId}</p>
            </div>
            <p style="font-size:13px;color:#9ca3af">Share this certificate ID to let others verify your achievement.</p>
        `),
    }));
};
