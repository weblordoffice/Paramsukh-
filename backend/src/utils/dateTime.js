// Shared 12-hour clock formatting for backend-generated text (emails, push
// notifications) that interpolates `bookingTime` and similar "HH:mm" values.

const TIME_AMPM = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/;
const TIME_24 = /^(\d{1,2}):(\d{2})/;

export function formatTime12h(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  let hours;
  let minutes;

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
      const match = raw.match(TIME_24);
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
