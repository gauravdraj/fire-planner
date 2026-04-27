const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SOFT_STALE_DAYS = 540;
const HARD_STALE_DAYS = 900;

type DateInput = Date | string;

export type StalenessLevel = 'fresh' | 'stale-soft' | 'stale-hard';

function parseDateInput(input: DateInput, label: string): Date {
  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label} date: ${String(input)}`);
  }

  return date;
}

function utcDayStart(input: DateInput, label: string): number {
  const date = parseDateInput(input, label);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysSince(referenceISODate: string, now: DateInput = new Date()): number {
  return Math.floor((utcDayStart(now, 'current') - utcDayStart(referenceISODate, 'reference')) / MS_PER_DAY);
}

export function getStalenessLevel(retrievedAt: string, now: DateInput = new Date()): StalenessLevel {
  const ageDays = daysSince(retrievedAt, now);

  if (ageDays >= HARD_STALE_DAYS) {
    return 'stale-hard';
  }

  if (ageDays >= SOFT_STALE_DAYS) {
    return 'stale-soft';
  }

  return 'fresh';
}
