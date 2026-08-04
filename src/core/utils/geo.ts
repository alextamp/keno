// Shared great-circle distance helper — used by FeedTab (nearby filter) and
// MapTab (distance filter in the filter sheet) so the formula lives in one
// place instead of being copy-pasted per screen.
const EARTH_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "Σήμερα / Αύριο / Σαββατοκύριακο" bucket a date falls into, relative to `now`. */
export type WhenBucket = 'today' | 'tomorrow' | 'weekend';

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function matchesWhenBucket(date: Date, bucket: WhenBucket, now: Date): boolean {
  if (bucket === 'today') return isSameCalendarDay(date, now);
  if (bucket === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return isSameCalendarDay(date, tomorrow);
  }
  // 'weekend' — the nearest upcoming Saturday and the Sunday right after it.
  // If today is already Saturday or Sunday, that day is part of "this weekend".
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0) return isSameCalendarDay(date, now); // Sunday: only today is left of this weekend
  const daysUntilSaturday = day === 6 ? 0 : 6 - day;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return isSameCalendarDay(date, saturday) || isSameCalendarDay(date, sunday);
}
