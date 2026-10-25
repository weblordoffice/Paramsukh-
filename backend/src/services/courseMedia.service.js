import { getSignedMediaUrl } from './r2Service.js';
import { sanitizeAssignmentForUser } from './courseContentSanitizer.service.js';

const toPlain = (value) => {
  if (!value) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
};

const signOrRemove = async (item, key, allowed) => {
  if (!item) return item;
  if (!allowed) {
    delete item[key];
    return item;
  }
  if (item[key]) item[key] = await getSignedMediaUrl(item[key]);
  return item;
};

const isSessionJoinable = (session, now) => {
  const start = new Date(session?.scheduledAt).getTime();
  if (!Number.isFinite(start)) return false;
  const end = start + (Number(session.durationInMinutes) || 60) * 60 * 1000;
  return now >= start - 10 * 60 * 1000 && now <= end;
};

/**
 * Build the course payload for a specific viewer.
 * Media URLs are stripped unless the viewer is entitled or the item is a free
 * preview. Live meeting links are only exposed inside the join window.
 */
export const buildCourseViewerPayload = async (course, { entitled = false } = {}) => {
  const plain = toPlain(course);
  if (!plain) return plain;

  const now = Date.now();

  plain.assignments = (plain.assignments || []).map(sanitizeAssignmentForUser);

  plain.videos = await Promise.all((plain.videos || []).map(async (video) => {
    const safe = toPlain(video);
    safe.assignments = (safe.assignments || []).map(sanitizeAssignmentForUser);
    await signOrRemove(safe, 'videoUrl', entitled || safe.isFree === true);
    return safe;
  }));

  plain.pdfs = await Promise.all((plain.pdfs || []).map((pdf) => {
    const safe = toPlain(pdf);
    return signOrRemove(safe, 'pdfUrl', entitled || safe.isFree === true);
  }));

  plain.audioLessons = await Promise.all((plain.audioLessons || []).map((lesson) => {
    const safe = toPlain(lesson);
    return signOrRemove(safe, 'audioUrl', entitled || safe.isFree === true);
  }));

  plain.liveSessions = await Promise.all((plain.liveSessions || []).map(async (session) => {
    const safe = toPlain(session);
    const joinable = entitled && isSessionJoinable(safe, now);
    if (!joinable) delete safe.meetingLink;

    const ended = Number.isFinite(new Date(safe.scheduledAt).getTime())
      && new Date(safe.scheduledAt).getTime() + (Number(safe.durationInMinutes) || 60) * 60 * 1000 < now;
    if (!(entitled && ended)) delete safe.recordingUrl;

    if (Array.isArray(safe.resources)) {
      safe.resources = await Promise.all(safe.resources.map((resource) => {
        const safeResource = toPlain(resource);
        return signOrRemove(safeResource, 'pdfUrl', entitled);
      }));
    }

    return safe;
  }));

  return plain;
};

/** Sign a single course item URL for an access-checked item endpoint. */
export const signCourseItemUrl = async (item, key) => {
  const safe = toPlain(item);
  if (!safe || !safe[key]) return safe;
  safe[key] = await getSignedMediaUrl(safe[key]);
  return safe;
};
