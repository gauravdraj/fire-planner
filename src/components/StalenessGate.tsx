import { useEffect, useRef, useState } from 'react';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { daysSince, getStalenessLevel } from '@/lib/staleness';

type StalenessGateProps = {
  now?: Date | string;
};

const ACK_KEY_PREFIX = 'fire-planner.staleAck.';

export function staleAcknowledgementKey(retrievedAt: string): string {
  return `${ACK_KEY_PREFIX}${retrievedAt}`;
}

export function StalenessGate({ now = new Date() }: StalenessGateProps) {
  const retrievedAt = CONSTANTS_2026.retrievedAt;
  const level = getStalenessLevel(retrievedAt, now);
  const ageDays = daysSince(retrievedAt, now);
  const [acknowledged, setAcknowledged] = useState(() => hasAcknowledgedHardStale(retrievedAt));
  const acknowledgeButtonRef = useRef<HTMLButtonElement>(null);
  const isHardStale = level === 'stale-hard';
  const showModal = isHardStale && !acknowledged;

  useEffect(() => {
    if (showModal) {
      acknowledgeButtonRef.current?.focus();
    }
  }, [showModal]);

  if (level === 'fresh') {
    return null;
  }

  const bannerTitle = isHardStale ? 'Tax data is stale.' : 'Tax data may be getting stale.';
  const bannerBody = `The bundled 2026 tax data was retrieved on ${retrievedAt} and is ${ageDays} days old. Verify official IRS and state sources before relying on this estimate.`;

  return (
    <>
      <section
        aria-label="Tax data staleness warning"
        className={`border-b px-4 py-3 text-sm ${
          isHardStale
            ? 'border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100'
            : 'border-yellow-200 bg-yellow-50 text-yellow-950 dark:border-yellow-500/40 dark:bg-yellow-950/40 dark:text-yellow-100'
        }`}
        role="status"
      >
        <div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
          <p className="font-semibold">{bannerTitle}</p>
          <p>{bannerBody}</p>
        </div>
      </section>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <section
            aria-labelledby="hard-stale-title"
            aria-modal="true"
            className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/30"
            role="dialog"
          >
            <h2 className="text-lg font-semibold" id="hard-stale-title">
              Tax data is stale
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              The bundled 2026 tax data is {ageDays} days old. This planner can still run, but tax outputs may be
              materially out of date until the constants are refreshed.
            </p>
            <button
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:focus-visible:outline-indigo-400"
              onClick={() => {
                writeAcknowledgement(retrievedAt);
                setAcknowledged(true);
              }}
              ref={acknowledgeButtonRef}
              type="button"
            >
              Acknowledge and continue
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

function hasAcknowledgedHardStale(retrievedAt: string): boolean {
  const storage = getLocalStorage();

  if (storage === null) {
    return false;
  }

  return storage.getItem(staleAcknowledgementKey(retrievedAt)) !== null;
}

function writeAcknowledgement(retrievedAt: string): void {
  const storage = getLocalStorage();

  if (storage !== null) {
    storage.setItem(staleAcknowledgementKey(retrievedAt), 'true');
  }
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
