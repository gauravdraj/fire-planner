import { describe, expect, it } from 'vitest';

import {
  basicFormSectionExplanations,
  basicFormSectionIds,
  columnExplanations,
  liveStatExplanations,
  liveStatMetricIds,
  tableColumnIds,
  type TableColumnId,
} from '@/lib/columnExplanations';
import { visibleYearByYearColumnIds, yearByYearColumnBands, yearByYearColumns } from '@/lib/yearByYearColumns';

const REQUIRED_PHASE_0_5_COLUMNS: readonly TableColumnId[] = [
  'fplPercentage',
  'withdrawalRate',
  'agi',
  'acaMagi',
  'irmaaMagi',
  'federalTax',
  'stateTax',
  'ltcgTax',
  'niit',
  'seTax',
  'acaPremiumCredit',
  'taxableSocialSecurity',
  'afterTaxCashFlow',
];

describe('columnExplanations', () => {
  it('has one explanation entry for every planned table column id', () => {
    expect(Object.keys(columnExplanations).sort()).toEqual([...tableColumnIds].sort());

    for (const columnId of tableColumnIds) {
      expect(columnExplanations[columnId].label.trim()).not.toBe('');
      expect(columnExplanations[columnId].description.trim()).not.toBe('');
    }
  });

  it('covers the Phase 0.5 threshold and tax explanation columns', () => {
    for (const columnId of REQUIRED_PHASE_0_5_COLUMNS) {
      expect(columnExplanations[columnId]).toBeDefined();
    }
  });

  it('keeps the visible year table column contract ordered and sourced from known explanations', () => {
    expect(visibleYearByYearColumnIds).toHaveLength(yearByYearColumns.length);
    expect(new Set(visibleYearByYearColumnIds).size).toBe(visibleYearByYearColumnIds.length);
    expect(yearByYearColumns[0]?.id).toBe('year');
    expect(yearByYearColumns[1]?.id).toBe('age');
    expect(yearByYearColumns[2]?.id).toBe('phase');

    for (const column of yearByYearColumns) {
      expect(yearByYearColumnBands).toContain(column.band);
      expect(columnExplanations[column.id]).toBeDefined();
    }
  });

  it('has one explanation entry for every live stat and basic form section id', () => {
    expect(Object.keys(liveStatExplanations).sort()).toEqual([...liveStatMetricIds].sort());
    expect(Object.keys(basicFormSectionExplanations).sort()).toEqual([...basicFormSectionIds].sort());

    for (const metricId of liveStatMetricIds) {
      expect(liveStatExplanations[metricId].description.trim()).not.toBe('');
    }

    for (const sectionId of basicFormSectionIds) {
      expect(basicFormSectionExplanations[sectionId].description.trim()).not.toBe('');
    }
  });
});
