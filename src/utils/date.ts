export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function shiftDays(source: Date, days: number): Date {
  return new Date(source.getTime() + days * DAY_MS);
}

export function getYearDays(year: number): Date[] {
  const firstDay = new Date(year, 0, 1);
  const nextYear = new Date(year + 1, 0, 1);
  const count = Math.round((nextYear.getTime() - firstDay.getTime()) / DAY_MS);
  return Array.from({ length: count }, (_, index) => shiftDays(firstDay, index));
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function monthStartKey(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function monthEndKey(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function getYearMonths(year: number): Date[] {
  return Array.from({ length: 12 }, (_, month) => new Date(year, month, 1));
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map((piece) => Number.parseInt(piece, 10));
  return new Date(year, month - 1, day);
}

export function shiftDateKey(key: string, days: number): string {
  return toDateKey(shiftDays(fromDateKey(key), days));
}

export function dayDiff(fromKey: string, toKey: string): number {
  return Math.round((fromDateKey(toKey).getTime() - fromDateKey(fromKey).getTime()) / DAY_MS);
}

export function normalizeRange(a: string, b: string): { startKey: string; endKey: string } {
  return a <= b ? { startKey: a, endKey: b } : { startKey: b, endKey: a };
}

export function isWithinRange(key: string, a: string, b: string): boolean {
  const range = normalizeRange(a, b);
  return key >= range.startKey && key <= range.endKey;
}

export function rangesIntersect(startA: string, endA: string, startB: string, endB: string): boolean {
  return maxDateKey(startA, startB) <= minDateKey(endA, endB);
}

export function minDateKey(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDateKey(a: string, b: string): string {
  return a >= b ? a : b;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return toDateKey(fromDateKey(value)) === value;
}

export function formatMonth(date: Date): string {
  const month = date.toLocaleDateString('ru-RU', { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}
