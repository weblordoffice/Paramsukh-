const pad = (value) => String(value).padStart(2, '0');

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_24 = /^(\d{1,2}):(\d{2})/;
const TIME_AMPM = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/;

export const normalizeTimeToHHmm = (value) => {
  const raw = String(value || '').trim();
  const ampm = raw.match(TIME_AMPM);
  if (ampm) {
    let hours = Number(ampm[1]) % 12;
    if (/pm/i.test(ampm[3])) hours += 12;
    return `${pad(hours)}:${ampm[2]}`;
  }
  const match = raw.match(TIME_24);
  if (match) return `${pad(Number(match[1]) % 24)}:${match[2]}`;
  return '';
};

/** Calendar date key (YYYY-MM-DD); date-only strings keep their literal value. */
export const toDateKey = (value) => {
  if (!value) return '';
  const raw = String(value);
  const match = raw.match(DATE_ONLY);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const startOfUtcDay = (value) => {
  const key = toDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const endOfUtcDay = (value) => {
  const start = startOfUtcDay(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

const getTimeZoneOffsetMs = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
};

/** Convert a wall-clock date + time in an IANA zone to a UTC Date. */
export const zonedDateTimeToUtc = (dateValue, timeValue, timeZone) => {
  const dateKey = toDateKey(dateValue);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const normalizedTime = normalizeTimeToHHmm(timeValue) || '00:00';
  const [hours, minutes] = normalizedTime.split(':').map(Number);

  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const zone = timeZone || 'UTC';
  const firstOffset = getTimeZoneOffsetMs(guess, zone);
  let utc = new Date(guess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(utc, zone);
  if (secondOffset !== firstOffset) {
    utc = new Date(guess.getTime() - secondOffset);
  }
  return utc;
};

/** Today's calendar date (YYYY-MM-DD) in an IANA zone. */
export const todayInZone = (timeZone, now = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Format a UTC instant as a date + time in an IANA zone (for messages). */
export const formatInZone = (date, timeZone, options = {}) => {
  if (!date) return '';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timeZone || 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(parsed);
};
