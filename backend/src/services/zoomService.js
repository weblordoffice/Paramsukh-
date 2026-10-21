const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export const isZoomConfigured = () => {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID
    && process.env.ZOOM_CLIENT_ID
    && process.env.ZOOM_CLIENT_SECRET
  );
};

const getZoomAccessToken = async () => {
  if (!isZoomConfigured()) {
    throw new Error('Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.');
  }

  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: process.env.ZOOM_ACCOUNT_ID,
  });
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${ZOOM_TOKEN_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.reason || data.error_description || 'Failed to authenticate with Zoom');
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
};

/**
 * Creates a scheduled Zoom meeting.
 * @param {{ topic: string, startTime: string|Date, durationInMinutes: number, agenda?: string }} input
 */
export const createZoomMeeting = async ({ topic, startTime, durationInMinutes, agenda = '' }) => {
  const token = await getZoomAccessToken();
  const userId = process.env.ZOOM_USER_ID || 'me';

  const response = await fetch(`${ZOOM_API_BASE}/users/${encodeURIComponent(userId)}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      type: 2,
      start_time: new Date(startTime).toISOString(),
      duration: Math.max(1, Number(durationInMinutes) || 60),
      timezone: process.env.ZOOM_TIMEZONE || 'Asia/Kolkata',
      agenda: agenda || undefined,
      settings: {
        join_before_host: true,
        waiting_room: false,
        approval_type: 2,
        audio: 'both',
        auto_recording: 'none',
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.join_url) {
    throw new Error(data.message || 'Failed to create Zoom meeting');
  }

  return {
    zoomMeetingId: String(data.id),
    meetingLink: data.join_url,
    meetingPassword: data.password || null,
    startTime: data.start_time || new Date(startTime).toISOString(),
  };
};
