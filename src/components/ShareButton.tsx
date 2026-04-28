import { useRef, useState } from 'react';

import type { ScenarioHashPayload } from '@/lib/urlHash';
import { encodeScenario } from '@/lib/urlHash';
import { useScenarioStore } from '@/store/scenarioStore';

import { ShareLinkModal } from './ShareLinkModal';

export const SHARE_LINK_ACKNOWLEDGED_KEY = 'fire-planner.shareLink.acknowledged';

type CopyStatus = 'idle' | 'share-link' | 'json' | 'error';

export function ShareButton() {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const customLaw = useScenarioStore((state) => state.customLaw);
  const customLawActive = useScenarioStore((state) => state.customLawActive);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const payload =
    customLaw === undefined ? { scenario, plan, customLawActive } : { scenario, plan, customLaw, customLawActive };

  function handleShareClick() {
    setCopyStatus('idle');

    if (hasShareLinkAcknowledgement()) {
      void copyShareLink(payload);
      return;
    }

    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function copyShareLink(currentPayload: ScenarioHashPayload) {
    try {
      const shareUrl = writeShareHash(currentPayload);

      await copyTextToClipboard(shareUrl);
      acknowledgeShareLink();
      closeModal();
      setCopyStatus('share-link');
    } catch {
      setCopyStatus('error');
    }
  }

  async function exportJson(currentPayload: ScenarioHashPayload) {
    try {
      await copyTextToClipboard(JSON.stringify(currentPayload, null, 2));
      closeModal();
      setCopyStatus('json');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <div className="relative flex min-w-[6rem] flex-col items-start gap-1">
      <button
        className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-0 text-sm font-medium text-slate-700 shadow-sm shadow-slate-900/5 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:outline-indigo-400"
        onClick={handleShareClick}
        ref={triggerRef}
        type="button"
      >
        Share
      </button>
      {copyStatus !== 'idle' ? (
        <p className="text-xs text-slate-600 dark:text-slate-400" role="status">
          {statusMessage(copyStatus)}
        </p>
      ) : null}
      {isModalOpen ? (
        <ShareLinkModal
          onCancel={closeModal}
          onCopyShareLink={() => {
            void copyShareLink(payload);
          }}
          onExportJson={() => {
            void exportJson(payload);
          }}
        />
      ) : null}
    </div>
  );
}

export function buildShareUrl(payload: ScenarioHashPayload, href = currentHref()): string {
  const url = new URL(href);

  url.hash = encodeScenario(payload);

  return url.toString();
}

function writeShareHash(payload: ScenarioHashPayload): string {
  const shareUrl = buildShareUrl(payload);

  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', shareUrl);
  }

  return shareUrl;
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.clipboard?.writeText === undefined) {
    throw new Error('Clipboard API is unavailable.');
  }

  await navigator.clipboard.writeText(text);
}

function hasShareLinkAcknowledgement(): boolean {
  return getLocalStorage()?.getItem(SHARE_LINK_ACKNOWLEDGED_KEY) === 'true';
}

function acknowledgeShareLink() {
  getLocalStorage()?.setItem(SHARE_LINK_ACKNOWLEDGED_KEY, 'true');
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function currentHref(): string {
  if (typeof window === 'undefined') {
    return 'https://fire-planner.local/';
  }

  return window.location.href;
}

function statusMessage(status: CopyStatus): string {
  if (status === 'share-link') {
    return 'Share link copied.';
  }

  if (status === 'json') {
    return 'Scenario JSON copied.';
  }

  return 'Could not copy to clipboard.';
}
