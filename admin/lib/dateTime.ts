// Shared 12-hour clock formatting for the admin panel. Use everywhere a
// time-of-day is shown so it reads "5:30 PM" instead of "17:30".

const TIME_AMPM = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/;
const TIME_24 = /^(\d{1,2}):(\d{2})/;

/**
 * Format a time-of-day as 12-hour "h:mm AM/PM".
 * Accepts a Date, an ISO date-time string, or a time string in either
 * "HH:mm" (24h) or "h:mm AM/PM" form. Returns '' for empty/invalid input.
 */
export function formatTime12h(value?: string | Date | null): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  let hours: number;
  let minutes: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    hours = value.getHours();
    minutes = value.getMinutes();
  } else {
    const raw = String(value).trim();

    const ampmMatch = raw.match(TIME_AMPM);
    if (ampmMatch) {
      hours = Number(ampmMatch[1]) % 12;
      if (/pm/i.test(ampmMatch[3])) hours += 12;
      minutes = Number(ampmMatch[2]);
    } else if (TIME_24.test(raw)) {
      const match = raw.match(TIME_24)!;
      hours = Number(match[1]);
      minutes = Number(match[2]);
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return '';
      hours = parsed.getHours();
      minutes = parsed.getMinutes();
    }
  }

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

const pad = (value: number) => String(value).padStart(2, '0');

const parseWallClock = (value: string): { hours: number; minutes: number } | null => {
  const raw = String(value || '').trim();
  const ampmMatch = raw.match(TIME_AMPM);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]) % 12;
    if (/pm/i.test(ampmMatch[3])) hours += 12;
    return { hours, minutes: Number(ampmMatch[2]) };
  }
  const match = raw.match(TIME_24);
  if (match) {
    return { hours: Number(match[1]), minutes: Number(match[2]) };
  }
  return null;
};

/**
 * Value for <input type="date">. Date-only ISO strings keep their literal
 * calendar date (the backend stores them at UTC midnight).
 */
export function toDateInput(value?: string | Date | null): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for <input type="time"> (HH:mm), accepting 12h or 24h input. */
export function toTimeInput(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  const time = parseWallClock(String(value));
  if (time) return `${pad(time.hours)}:${pad(time.minutes)}`;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '';
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
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
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
};

/**
 * Convert a wall-clock date + time in a specific IANA time zone to a UTC Date.
 * Handles DST boundaries with a second offset pass.
 */
export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const time = parseWallClock(timeStr) || { hours: 0, minutes: 0 };
  const guess = new Date(Date.UTC(year, month - 1, day, time.hours, time.minutes, 0));

  const zone = timeZone || 'UTC';
  const firstOffset = getTimeZoneOffsetMs(guess, zone);
  let utc = new Date(guess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(utc, zone);
  if (secondOffset !== firstOffset) {
    utc = new Date(guess.getTime() - secondOffset);
  }
  return utc;
}

/** Date input (YYYY-MM-DD) for a UTC instant rendered in an IANA time zone. */
export function toZonedDateInput(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** HH:mm input for a UTC instant rendered in an IANA time zone. */
export function toZonedTimeInput(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${pad(Number(parts.hour) % 24)}:${parts.minute}`;
}
