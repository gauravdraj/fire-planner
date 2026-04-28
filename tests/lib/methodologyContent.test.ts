import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { columnExplanations, liveStatExplanations } from '@/lib/columnExplanations';
import {
  constantSourceRows,
  glossaryItems,
  methodologySections,
  methodologySectionIds,
  metricMethodologyEntries,
  notModeledItems,
} from '@/lib/methodologyContent';
import methodologyContentSource from '@/lib/methodologyContent?raw';

describe('methodologyContent', () => {
  it('exports all nine Methodology sections in the required order', () => {
    expect(methodologySectionIds).toEqual([
      'overview',
      'glossary',
      'modeled',
      'not-modeled',
      'constants-source',
      'two-year-lag',
      'metrics',
      'caveats',
      'source-references',
    ]);
    expect(methodologySections.map((section) => section.id)).toEqual(methodologySectionIds);

    for (const section of methodologySections) {
      expect(section.title.trim()).not.toBe('');
      expect(section.summary.trim()).not.toBe('');
    }
  });

  it('keeps the intro wedge and required glossary terms visible in app content', () => {
    const overview = methodologySections.find((section) => section.id === 'overview');
    const wedgeText = overview?.paragraphs?.join(' ') ?? '';
    const glossaryText = glossaryItems.map((item) => `${item.label} ${item.description}`).join('\n').toLowerCase();

    expect(overview?.title).toBe("What this tool is and isn't");
    expect(wedgeText).toContain('free, open-source, client-only, fixture-validated, transparent');
    for (const term of ['magi', 'irmaa', 'aca', 'ptc', 'fpl', 'ltcg', 'qbi', 'sstb', 'niit', 'sepp', '72(t)', 'roth conversion ladder', 'customlaw scenario']) {
      expect(glossaryText).toContain(term);
    }
  });

  it('surfaces sourced constants rows with shared retrieval metadata', () => {
    expect(constantSourceRows.length).toBeGreaterThanOrEqual(8);

    for (const row of constantSourceRows) {
      expect(row.name.trim(), row.id).not.toBe('');
      expect(row.value.trim(), row.id).not.toBe('');
      expect(row.source.trim(), row.id).not.toBe('');
      expect(row.sourceUrl, row.id).toMatch(/^https?:\/\//);
      expect(row.retrievedAt, row.id).toBe(CONSTANTS_2026.retrievedAt);
    }
  });

  it('keeps required not-modeled exclusions and deferred reasons visible', () => {
    const notModeledText = notModeledItems
      .map((item) => `${item.label}\n${item.designText}\n${item.note}`)
      .join('\n')
      .toLowerCase();

    expect(notModeledText).toContain('amt');
    expect(notModeledText).toContain('multi-state');
    expect(notModeledText).toContain('mega-backdoor');
    expect(notModeledText).toContain('schedule e depreciation');
    expect(notModeledText).toMatch(/72\(t\).*full 3-method calculator/);
    expect(notModeledText).toContain('monte carlo');

    expect(notModeledText).toContain('deferred to v1.5');
    expect(notModeledText).toContain('only "net rental income" is taken as input');
    expect(notModeledText).toContain('not a global optimizer');
  });

  it('reuses existing metric explanation entries instead of duplicating copy', () => {
    expect(metricMethodologyEntries.find((entry) => entry.id === 'agi')?.explanation).toBe(columnExplanations.agi);
    expect(metricMethodologyEntries.find((entry) => entry.id === 'aca-magi')?.explanation).toBe(
      columnExplanations.acaMagi,
    );
    expect(metricMethodologyEntries.find((entry) => entry.id === 'average-bridge-magi')?.explanation).toBe(
      liveStatExplanations['average-bridge-magi'],
    );
    expect(metricMethodologyEntries.find((entry) => entry.id === 'total-bridge-tax')?.explanation).toBe(
      liveStatExplanations['total-bridge-tax'],
    );
  });

  it('keeps the methodology content module free of React imports', () => {
    expect(methodologyContentSource).not.toMatch(/from ['"]react(?:\/|['"])/);
    expect(methodologyContentSource).not.toMatch(/import\(['"]react(?:\/|['"])/);
  });
});
