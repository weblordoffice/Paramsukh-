/**
 * pushService.js
 * -------------------------------------------------
 * Sends real device push notifications via the
 * Expo Push Notification service  (no extra SDK
 * required; pure HTTP fetch to exp.host).
 *
 * Usage:
 *   import { sendPushToUser, sendPushToUsers } from './pushService.js';
 *   await sendPushToUser(userId, { title, body, data });
 *   await sendPushToUsers([userId1, userId2], { title, body, data });
 */

import { DeviceToken } from '../models/notification.models.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to ALL device tokens belonging to one user.
 * @param {string|ObjectId} userId
 * @param {{ title: string, body: string, data?: object, sound?: string, badge?: number }} payload
 */
export const sendPushToUser = async (userId, payload) => {
  try {
    const tokens = await DeviceToken.find({ user: userId }).select('token').lean();
    if (!tokens.length) return;

    const messages = tokens.map(({ token }) => buildMessage(token, payload));
    await sendToExpo(messages);
  } catch (err) {
    console.error('❌ pushService.sendPushToUser error:', err?.message);
  }
};

/**
 * Send a push notification to multiple users (bulk).
 * @param {Array<string|ObjectId>} userIds
 * @param {{ title: string, body: string, data?: object }} payload
 */
export const sendPushToUsers = async (userIds, payload) => {
  if (!userIds?.length) return;
  try {
    const tokens = await DeviceToken.find({ user: { $in: userIds } }).select('token').lean();
    if (!tokens.length) return;

    // Expo accepts up to 100 messages per request
    const messages = tokens.map(({ token }) => buildMessage(token, payload));
    for (let i = 0; i < messages.length; i += 100) {
      await sendToExpo(messages.slice(i, i + 100));
    }
  } catch (err) {
    console.error('❌ pushService.sendPushToUsers error:', err?.message);
  }
};

/**
 * Send push to every registered device token (broadcast).
 * Used by admin broadcast notifications.
 * @param {{ title: string, body: string, data?: object }} payload
 */
export const sendPushToAll = async (payload) => {
  try {
    const tokens = await DeviceToken.find().select('token').lean();
    if (!tokens.length) return;

    const messages = tokens.map(({ token }) => buildMessage(token, payload));
    for (let i = 0; i < messages.length; i += 100) {
      await sendToExpo(messages.slice(i, i + 100));
    }
    console.log(`📲 Push broadcast sent to ${messages.length} devices`);
  } catch (err) {
    console.error('❌ pushService.sendPushToAll error:', err?.message);
  }
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildMessage(expoPushToken, { title, body, data = {}, sound = 'default', badge = 1 }) {
  return {
    to: expoPushToken,
    title,
    body,
    data,
    sound,
    badge,
    channelId: 'default', // Android notification channel
  };
}

async function sendToExpo(messages) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const json = await res.json();

  // Log any individual ticket errors without throwing — push failure shouldn't
  // crash the main business logic that called it.
  if (json?.data) {
    json.data.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        console.warn(`⚠️  Push ticket[${i}] error:`, ticket.message, ticket.details);
        // Clean up dead tokens automatically
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const badToken = messages[i]?.to;
          if (badToken) DeviceToken.deleteOne({ token: badToken }).catch(() => {});
        }
      }
    });
  }

  return json;
}
