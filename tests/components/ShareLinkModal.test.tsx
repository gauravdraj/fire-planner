import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SHARE_LINK_ACKNOWLEDGED_KEY, ShareButton } from '@/components/ShareButton';
import { SHARE_LINK_PRIVACY_TEXT } from '@/components/ShareLinkModal';
import { decodeScenario } from '@/lib/urlHash';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

let clipboardWrites: string[];

function installClipboardMock() {
  clipboardWrites = [];

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        clipboardWrites.push(text);
      },
    },
  });
}

function installShareScenario() {
  useScenarioStore.getState().replaceFormValues({
    ...DEFAULT_BASIC_FORM_VALUES,
    annualSpendingToday: 72_000,
    brokerageAndCashBalance: 125_000,
    currentYear: 2026,
    planEndAge: 66,
    primaryAge: 60,
    retirementYear: 2027,
    rothBalance: 50_000,
    taxableBrokerageBasis: 100_000,
    traditionalBalance: 300_000,
  });
}

function clickHeaderShare() {
  fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
}

describe('ShareLinkModal and ShareButton', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    installClipboardMock();
    window.history.replaceState(null, '', '/planner?case=basic');
    useScenarioStore.getState().resetScenario();
    installShareScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the privacy modal on first share and cancel leaves acknowledgement unset', () => {
    render(<ShareButton />);

    clickHeaderShare();

    expect(screen.getByRole('dialog', { name: /share-link privacy/i })).toBeInTheDocument();
    expect(screen.getByText(SHARE_LINK_PRIVACY_TEXT)).toBeInTheDocument();
    expect(clipboardWrites).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(clipboardWrites).toHaveLength(0);
    expect(window.localStorage.getItem(SHARE_LINK_ACKNOWLEDGED_KEY)).toBeNull();
  });

  it('copies a compressed share URL from the modal and stores acknowledgement', async () => {
    const expectedState = useScenarioStore.getState();

    render(<ShareButton />);

    clickHeaderShare();
    fireEvent.click(screen.getByRole('button', { name: /copy share link/i }));

    await waitFor(() => expect(clipboardWrites).toHaveLength(1));

    const copiedUrl = clipboardWrites[0] ?? '';
    const copiedHash = new URL(copiedUrl).hash;
    const decoded = decodeScenario(copiedHash);

    expect(copiedHash).toMatch(/^#v1:/);
    expect(window.location.hash).toMatch(/^#v1:/);
    expect(decoded?.scenario.startYear).toBe(expectedState.scenario.startYear);
    expect(decoded?.plan.endYear).toBe(expectedState.plan.endYear);
    expect(window.localStorage.getItem(SHARE_LINK_ACKNOWLEDGED_KEY)).toBe('true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Share link copied.');
  });

  it('copies immediately on share when acknowledgement already exists', async () => {
    window.localStorage.setItem(SHARE_LINK_ACKNOWLEDGED_KEY, 'true');

    render(<ShareButton />);

    clickHeaderShare();

    await waitFor(() => expect(clipboardWrites).toHaveLength(1));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(new URL(clipboardWrites[0] ?? '').hash).toMatch(/^#v1:/);
    expect(screen.getByRole('status')).toHaveTextContent('Share link copied.');
  });

  it('exports plain scenario JSON without setting share acknowledgement', async () => {
    const expectedState = useScenarioStore.getState();

    render(<ShareButton />);

    clickHeaderShare();
    fireEvent.click(screen.getByRole('button', { name: /export json/i }));

    await waitFor(() => expect(clipboardWrites).toHaveLength(1));

    const exported = clipboardWrites[0] ?? '';
    const parsed: unknown = JSON.parse(exported);

    expect(exported).not.toContain('v1:');
    expect(parsed).toMatchObject({
      scenario: {
        startYear: expectedState.scenario.startYear,
      },
      plan: {
        endYear: expectedState.plan.endYear,
      },
    });
    expect(window.location.hash).toBe('');
    expect(window.localStorage.getItem(SHARE_LINK_ACKNOWLEDGED_KEY)).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Scenario JSON copied.');
  });
});
