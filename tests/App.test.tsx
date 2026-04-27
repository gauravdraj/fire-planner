import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';

const disclaimer =
  'Educational estimate only. Not tax, legal, investment, or filing advice. Do not make tax elections (Roth conversions, withdrawals, harvesting) from this output without verifying official IRS/state sources or a qualified professional.';

describe('App', () => {
  it('renders only the persistent educational disclaimer', () => {
    const { container } = render(<App />);

    expect(container.children).toHaveLength(1);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByText(disclaimer)).toBeInTheDocument();
    expect(container.querySelector('p')?.textContent).toBe(disclaimer);
    expect(container.querySelectorAll('form, input, button, select, textarea, svg, canvas, a')).toHaveLength(
      0,
    );
  });
});
