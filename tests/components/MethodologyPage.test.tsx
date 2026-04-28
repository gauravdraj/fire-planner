import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MethodologyPage } from '@/components/MethodologyPage';
import { constantSourceRows, methodologySections, notModeledItems } from '@/lib/methodologyContent';

describe('MethodologyPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all eight methodology section headings in order', () => {
    render(<MethodologyPage />);

    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      methodologySections.map((section) => section.title),
    );
  });

  it('renders sourced constants with source links and retrieval dates', () => {
    render(<MethodologyPage />);

    const table = screen.getByRole('table', { name: 'Sourced law constants and retrieval dates' });
    const bodyRows = within(table).getAllByRole('row').slice(1);

    expect(bodyRows).toHaveLength(constantSourceRows.length);
    expect(bodyRows.length).toBeGreaterThanOrEqual(8);

    for (const row of constantSourceRows) {
      const renderedRow = within(table).getByRole('row', { name: new RegExp(escapeRegExp(row.name)) });
      const sourceLink = within(renderedRow).getByRole('link');

      expect(renderedRow).toHaveTextContent(row.value);
      expect(renderedRow).toHaveTextContent(row.retrievedAt);
      expect(sourceLink).toHaveAttribute('href', row.sourceUrl);
    }
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
