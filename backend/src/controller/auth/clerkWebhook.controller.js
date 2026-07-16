import crypto from 'crypto';
import { User } from '../../models/user.models.js';

function verifySvixSignature(payload, headers, secret) {
    if (!secret) return false;
    const svixId = headers['svix-id'];
    const svixTimestamp = headers['svix-timestamp'];
    const svixSignature = headers['svix-signature'];
    if (!svixId || !svixTimestamp || !svixSignature) return false;

    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
    const computedSignature = crypto
        .createHmac('sha256', Buffer.from(secret.split('_').pop(), 'base64'))
        .update(signedContent)
        .digest('hex');

    const signatures = svixSignature.split(' ').map((s) => s.split(',')[1]);
    return signatures.includes(computedSignature);
}

export const clerkWebhookHandler = async (req, res) => {
    try {
        const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
        if (!signingSecret) {
            console.warn('CLERK_WEBHOOK_SIGNING_SECRET not set; rejecting webhook');
            return res.status(500).json({ success: false, message: 'Webhook not configured' });
        }

        const rawBody = req.rawBody || JSON.stringify(req.body);
        const isValid = verifySvixSignature(rawBody, req.headers, signingSecret);
        if (!isValid) {
            console.warn('Clerk webhook signature verification failed');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        const event = req.body;
        const eventType = event.type;

        console.log(`📨 Clerk webhook received: ${eventType}`);

        switch (eventType) {
            case 'user.deleted': {
                const clerkId = event.data?.id;
                if (clerkId) {
                    const user = await User.findOne({ clerkId });
                    if (user) {
                        user.clerkId = null;
                        user.authProvider = user.phone ? 'phone' : 'phone';
                        await user.save();
                        console.log(`🗑️ Unlinked Clerk ID from user ${user._id} (Clerk user deleted)`);
                    }
                }
                break;
            }

            case 'user.updated': {
                const clerkId = event.data?.id;
                if (clerkId && event.data) {
                    const user = await User.findOne({ clerkId });
                    if (user) {
                        const updates = event.data;
                        if (updates.email_addresses?.length) {
                            user.email = updates.email_addresses[0].email_address;
                        }
                        if (updates.first_name || updates.last_name) {
                            user.displayName = [updates.first_name, updates.last_name].filter(Boolean).join(' ') || user.displayName;
                        }
                        if (updates.image_url) {
                            user.photoURL = updates.image_url;
                        }
                        await user.save();
                        console.log(`🔄 Synced Clerk user update for ${user._id}`);
                    }
                }
                break;
            }

            case 'session.revoked': {
                const clerkUserId = event.data?.user_id;
                if (clerkUserId) {
                    const user = await User.findOne({ clerkId: clerkUserId });
                    if (user) {
                        // Revoke all device sessions for this user
                        const { DeviceSession } = await import('../../models/deviceSession.models.js');
                        await DeviceSession.updateMany(
                            { user: user._id, isRevoked: false },
                            { isRevoked: true }
                        );
                        console.log(`🔒 Revoked all device sessions for user ${user._id} (Clerk session revoked)`);
                    }
                }
                break;
            }

            case 'session.ended': {
                const clerkUserId = event.data?.user_id;
                if (clerkUserId) {
                    const { DeviceSession } = await import('../../models/deviceSession.models.js');
                    const user = await User.findOne({ clerkId: clerkUserId });
                    if (user) {
                        const clerkSid = event.data?.id;
                        if (clerkSid) {
                            await DeviceSession.updateMany(
                                { user: user._id, clerkSessionId: clerkSid, isRevoked: false },
                                { isRevoked: true }
                            );
                            console.log(`🔒 Revoked device session matching Clerk SID ${clerkSid}`);
                        }
                    }
                }
                break;
            }

            default:
                console.log(`ℹ️ Unhandled Clerk webhook event: ${eventType}`);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Clerk webhook error:', error);
        return res.status(500).json({ success: false, message: 'Webhook processing failed', error: error.message });
    }
};
