import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Disclaimer, DISCLAIMER_TEXT } from '@/components/Disclaimer';

describe('Disclaimer', () => {
  it('renders the canonical educational disclaimer exactly', () => {
    const { container } = render(<Disclaimer />);
    const paragraph = container.querySelector('p');

    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
    expect(paragraph?.textContent).toBe(DISCLAIMER_TEXT);
  });
});
