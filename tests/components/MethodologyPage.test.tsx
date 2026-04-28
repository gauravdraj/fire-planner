import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MethodologyPage } from '@/components/MethodologyPage';
import {
  constantSourceRows,
  methodologySections,
  metricMethodologyEntries,
  notModeledItems,
} from '@/lib/methodologyContent';

describe('MethodologyPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all nine methodology section headings in order', () => {
    render(<MethodologyPage />);

    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      methodologySections.map((section) => section.title),
    );
  });

  it('renders section navigation from methodology content', () => {
    render(<MethodologyPage />);

    const navigation = screen.getByRole('navigation', { name: 'Methodology sections' });

    for (const section of methodologySections) {
      expect(within(navigation).getByRole('link', { name: section.title })).toHaveAttribute(
        'href',
        `#methodology-${section.id}-heading`,
      );
    }
  });

  it('renders sourced constants with source links and retrieval dates', () => {
    render(<MethodologyPage />);

    const table = screen.getByRole('table', { name: 'Sourced law constants and retrieval dates' });
    const bodyRows = within(table).getAllByRole('row').slice(1);
    const scrollRegion = table.parentElement;

    expect(bodyRows).toHaveLength(constantSourceRows.length);
    expect(bodyRows.length).toBeGreaterThanOrEqual(8);
    expect(scrollRegion).toHaveClass('max-w-full', 'overflow-x-auto', 'overscroll-x-contain');

    for (const row of constantSourceRows) {
      const renderedRow = within(table).getByRole('row', { name: new RegExp(escapeRegExp(row.name)) });
      const sourceLink = within(renderedRow).getByRole('link');

      expect(renderedRow).toHaveTextContent(row.value);
      expect(renderedRow).toHaveTextContent(row.retrievedAt);
      expect(sourceLink).toHaveAttribute('href', row.sourceUrl);
    }
  });

  it('renders shared metric explanations visibly without relying on tooltips', () => {
    render(<MethodologyPage />);

    for (const entry of metricMethodologyEntries) {
      expect(screen.getByText(entry.explanation.label)).toBeInTheDocument();
      expect(screen.getByText(entry.explanation.description)).toBeInTheDocument();
    }

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps required out-of-scope items visible', () => {
    render(<MethodologyPage />);

    for (const item of notModeledItems) {
      expect(screen.getByText(`${item.label}:`)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(escapeRegExp(item.designText)))).toBeInTheDocument();
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
