import { describe, expect, it } from 'vitest';

import { daysSince, getStalenessLevel } from '@/lib/staleness';

function isoDateDaysBefore(baseISODate: string, days: number): string {
  const date = new Date(`${baseISODate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);

  return date.toISOString().slice(0, 10);
}

describe('staleness helpers', () => {
  describe('daysSince', () => {
    it('counts UTC calendar days across a DST spring-forward boundary', () => {
      expect(daysSince('2024-03-09T12:00:00-08:00', '2024-03-11T12:00:00-07:00')).toBe(2);
    });

    it('counts leap day as a full calendar day', () => {
      expect(daysSince('2024-02-28', '2024-03-01')).toBe(2);
    });

    it('uses UTC day boundaries instead of local timezone dates', () => {
      expect(daysSince('2026-01-01T23:30:00-08:00', '2026-01-02T00:30:00-08:00')).toBe(0);
    });
  });

  describe('getStalenessLevel', () => {
    const now = '2026-04-26';

    it.each([
      [539, 'fresh'],
      [540, 'stale-soft'],
      [899, 'stale-soft'],
      [900, 'stale-hard'],
    ] as const)('classifies tax data that is %i days old as %s', (ageDays, expectedLevel) => {
      expect(getStalenessLevel(isoDateDaysBefore(now, ageDays), now)).toBe(expectedLevel);
    });
  });
});
