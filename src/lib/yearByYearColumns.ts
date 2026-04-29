import { columnExplanations, type TableColumnId } from './columnExplanations';

export type YearByYearColumnBand = 'Identity' | 'Balances' | 'Income' | 'Tax' | 'KPIs';

export type StickyYearByYearColumn = 'year' | 'age' | 'phase';

export type YearByYearColumnDefinition = Readonly<{
  id: TableColumnId;
  band: YearByYearColumnBand;
  label?: string;
  align?: 'left' | 'right';
  sticky?: StickyYearByYearColumn;
  dividerBefore?: boolean;
}>;

export const yearByYearColumnBands = ['Identity', 'Balances', 'Income', 'Tax', 'KPIs'] as const satisfies readonly YearByYearColumnBand[];

export const yearByYearColumns = [
  { id: 'year', band: 'Identity', sticky: 'year' },
  { id: 'age', band: 'Identity', sticky: 'age' },
  { id: 'phase', band: 'Identity', sticky: 'phase', align: 'left' },
  { id: 'traditionalBalance', band: 'Balances', label: 'Trad', dividerBefore: true },
  { id: 'rothBalance', band: 'Balances', label: 'Roth' },
  { id: 'hsaBalance', band: 'Balances', label: 'HSA' },
  { id: 'taxableBrokerageBalance', band: 'Balances', label: 'Taxable' },
  { id: 'cashBalance', band: 'Balances', label: 'Cash' },
  { id: 'endingBalance', band: 'Balances', label: 'Total' },
  { id: 'brokerageBasisRemaining', band: 'Balances', label: 'Basis' },
  { id: 'spending', band: 'Income', dividerBefore: true },
  { id: 'wages', band: 'Income' },
  { id: 'taxableSocialSecurity', band: 'Income', label: 'Taxable SS' },
  { id: 'traditionalWithdrawals', band: 'Income', label: 'IRA dist.' },
  { id: 'rothConversions', band: 'Income', label: 'Roth conv.' },
  { id: 'brokerageWithdrawals', band: 'Income', label: 'Brokerage wd.' },
  { id: 'realizedLtcg', band: 'Income', label: 'Realized gain/loss' },
  { id: 'agi', band: 'Income', label: 'AGI' },
  { id: 'federalTax', band: 'Tax', label: 'Federal', dividerBefore: true },
  { id: 'stateTax', band: 'Tax', label: 'State' },
  { id: 'ltcgTax', band: 'Tax', label: 'LTCG' },
  { id: 'niit', band: 'Tax', label: 'NIIT' },
  { id: 'seTax', band: 'Tax', label: 'SE' },
  { id: 'rothConversionRecaptureTax', band: 'Tax', label: 'Roth 5yr' },
  { id: 'totalTax', band: 'Tax', label: 'Total tax' },
  { id: 'acaMagi', band: 'KPIs', label: 'ACA MAGI', dividerBefore: true },
  { id: 'fplPercentage', band: 'KPIs', label: 'FPL %' },
  { id: 'withdrawalRate', band: 'KPIs', label: 'Withdrawal rate' },
  { id: 'acaPremiumCredit', band: 'KPIs', label: 'ACA PTC' },
  { id: 'irmaaPremium', band: 'KPIs', label: 'IRMAA' },
  { id: 'afterTaxCashFlow', band: 'KPIs', label: 'After-tax cash flow' },
] as const satisfies readonly YearByYearColumnDefinition[];

export type VisibleYearByYearColumnId = (typeof yearByYearColumns)[number]['id'];

export const visibleYearByYearColumnIds = yearByYearColumns.map((column) => column.id) as readonly VisibleYearByYearColumnId[];

export function getYearByYearColumnLabel(column: YearByYearColumnDefinition): string {
  return column.label ?? columnExplanations[column.id].label;
}
