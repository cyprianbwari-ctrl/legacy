export const REPORTING_DAYS = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday'];

export function dateKey(date) {
  return new Date(date).toISOString().slice(0,10);
}

export function parseLocalDate(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y, m-1, d);
}

export function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function isFriday(date) {
  return new Date(date).getDay() === 5;
}

// Reporting week is Saturday through Thursday. A Friday is a non-reporting day.
// If the date is Friday, the surrounding week resolves to the preceding Saturday–Thursday.
export function weekFor(dateLike = new Date()) {
  const d = new Date(dateLike);
  const day = d.getDay(); // Sun 0 ... Sat 6
  const daysSinceSaturday = day === 6 ? 0 : day + 1;
  const start = addDays(d, -daysSinceSaturday);
  const end = addDays(start, 5);
  return { start, end, key: `${dateKey(start)}_${dateKey(end)}` };
}

export function shiftWeek(period, amount) {
  return weekFor(addDays(period.start, amount * 7));
}

export function monthWeeks(year, monthIndex) {
  // Build four reporting weeks anchored to the first Saturday on/before the month
  // start, then include only weeks whose Saturday–Thursday reporting window
  // intersects the selected calendar month. If the calendar produces a fifth
  // intersecting reporting week, it belongs to the next month for this UI.
  const first = new Date(year, monthIndex, 1);
  let cursor = weekFor(first).start;
  const candidates = [];
  for (let i=0; i<6; i++) {
    const w = weekFor(cursor);
    const intersects = w.end >= first && w.start <= new Date(year, monthIndex + 1, 0);
    if (intersects) candidates.push(w);
    cursor = addDays(cursor, 7);
  }
  // Product reporting uses four weeks per month. Extra overlap is carried forward.
  return candidates.slice(0,4);
}

export function monthLabel(dateLike) {
  return new Intl.DateTimeFormat('en-US', {month:'long', year:'numeric'}).format(new Date(dateLike));
}

export function dayLabel(dateLike) {
  return new Intl.DateTimeFormat('en-US', {weekday:'short', month:'short', day:'numeric'}).format(new Date(dateLike));
}

export function formatNumber(value, maximumFractionDigits=3) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(value || 0));
}

export function formatPeriod(period) {
  return `${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(period.start)} – ${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(period.end)}`;
}
