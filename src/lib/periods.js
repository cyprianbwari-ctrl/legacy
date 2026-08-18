export const REPORTING_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday'
];

export function dateKey(value) {
  const date = value instanceof Date ? value : parseLocalDate(String(value));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(key) {
  if (key instanceof Date) return new Date(key);
  const [year, month, day] = String(key).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function normalizeDate(value) {
  return value instanceof Date ? new Date(value) : parseLocalDate(value);
}

export function addDays(value, amount) {
  const date = normalizeDate(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function isFriday(value) {
  return normalizeDate(value).getDay() === 5;
}

export function weekFor(value = new Date()) {
  const date = normalizeDate(value);
  const day = date.getDay(); // Sun 0 ... Sat 6
  const daysSinceSaturday = day === 6 ? 0 : day + 1;
  const start = addDays(date, -daysSinceSaturday);
  const end = addDays(start, 5);

  return {
    start,
    end,
    key: `${dateKey(start)}_${dateKey(end)}`
  };
}

export function shiftWeek(period, amount) {
  return weekFor(addDays(period.start, amount * 7));
}

export function monthWeeks(year, monthIndex) {
  // The application exposes exactly four operational weeks.
  // A reporting week is always Saturday -> Thursday.
  // A fifth overlapping week is carried into the following month's display.
  const firstDay = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const lastDay = new Date(year, monthIndex + 1, 0, 12, 0, 0, 0);

  // First Saturday on or after the 1st of the calendar month.
  const day = firstDay.getDay();
  const daysUntilSaturday = day === 6 ? 0 : 6 - day;
  const firstSaturday = addDays(firstDay, daysUntilSaturday);

  const weeks = [];
  let cursor = firstSaturday;

  for (let i = 0; i < 4; i += 1) {
    const period = weekFor(cursor);
    weeks.push(period);
    cursor = addDays(cursor, 7);
  }

  // If the first Saturday is beyond the calendar month, use the preceding
  // operational week so the month never becomes empty.
  if (firstSaturday > lastDay) {
    return [weekFor(addDays(firstDay, -(day === 6 ? 0 : day + 1)))];
  }

  return weeks;
}

export function monthLabel(value) {
  const date = normalizeDate(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export function dayLabel(value) {
  const date = normalizeDate(value);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits
  }).format(Number(value || 0));
}

export function formatPeriod(period) {
  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(period.start)} – ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(period.end)}`;
}
