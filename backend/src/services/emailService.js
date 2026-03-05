import { Resend } from 'resend';

// Initialize Resend with API Key from env
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email using Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email text content (optional)
 */
export const sendEmail = async ({ to, subject, html, text }) => {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('⚠️ RESEND_API_KEY is missing. Email not sent.');
            return { success: false, message: 'Missing API Key' };
        }

        const { data, error } = await resend.emails.send({
            from: 'Paramsukh <onboarding@resend.dev>', // Default testing sender
            to,
            subject,
            html,
            text
        });

        if (error) {
            console.error('❌ Resend Email Error:', error);
            return { success: false, error };
        }

        console.log('✅ Email sent successfully:', data.id);
        return { success: true, data };
    } catch (error) {
        console.error('❌ Send Email Exception:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send Welcome Email
 */
export const sendWelcomeEmail = async (user) => {
    return sendEmail({
        to: user.email,
        subject: 'Welcome to Paramsukh!',
        html: `
      <h1>Welcome, ${user.displayName}!</h1>
      <p>Thank you for joining Paramsukh. We are excited to have you on board.</p>
      <p>Explore our courses, events, and community.</p>
    `
    });
};

/**
 * Send Order Confirmation Email
 */
export const sendOrderConfirmationEmail = async (user, order) => {
    return sendEmail({
        to: user.email,
        subject: `Order Confirmation #${order.orderNumber}`,
        html: `
      <h1>Order Confirmed!</h1>
      <p>Hi ${user.displayName},</p>
      <p>Your order <strong>#${order.orderNumber}</strong> has been placed successfully.</p>
      <p><strong>Total Amount:</strong> ₹${order.pricing.total}</p>
      <p>We will notify you once it ships.</p>
    `
    });
};

export default {
    sendEmail,
    sendWelcomeEmail,
    sendOrderConfirmationEmail
};
