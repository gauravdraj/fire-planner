import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '@/App';
import { DISCLAIMER_TEXT } from '@/components/Disclaimer';
import { UI_STORAGE_KEY, useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from './store/memoryStorage';

describe('App', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the shell in disclaimer, header, main, footer order when tax data is fresh', () => {
    const { container } = render(<App />);
    const shell = container.firstElementChild;

    expect(shell?.children).toHaveLength(4);
    expect(shell?.children[0]).toHaveTextContent(DISCLAIMER_TEXT);
    expect(shell?.children[1]?.tagName).toBe('HEADER');
    expect(shell?.children[2]?.tagName).toBe('MAIN');
    expect(shell?.children[3]?.tagName).toBe('FOOTER');
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fire Planner' })).toBeInTheDocument();
    expect(screen.getByText('All inputs stay on your device.')).toBeInTheDocument();
  });

  it('persists mode changes and renders only the advanced Gate 4 placeholder', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByRole('heading', { name: 'Advanced mode' })).toBeInTheDocument();
    expect(screen.getByText('Advanced controls arrive in Gate 4.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({ mode: 'advanced' });
  });

  it('persists display unit changes without changing planner mode', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Nominal dollars' }));

    expect(useUiStore.getState().mode).toBe('basic');
    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      displayUnit: 'nominal',
      mode: 'basic',
    });
  });
});
