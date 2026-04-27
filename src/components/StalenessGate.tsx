import { useState } from 'react';

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

  if (level === 'fresh') {
    return null;
  }

  const isHardStale = level === 'stale-hard';
  const bannerTitle = isHardStale ? 'Tax data is stale.' : 'Tax data may be getting stale.';
  const bannerBody = `The bundled 2026 tax data was retrieved on ${retrievedAt} and is ${ageDays} days old. Verify official IRS and state sources before relying on this estimate.`;
  const showModal = isHardStale && !acknowledged;

  return (
    <>
      <section
        aria-label="Tax data staleness warning"
        className={`border-b px-4 py-3 text-sm ${
          isHardStale
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-yellow-200 bg-yellow-50 text-yellow-950'
        }`}
        role="status"
      >
        <div className="mx-auto max-w-5xl">
          <p className="font-semibold">{bannerTitle}</p>
          <p>{bannerBody}</p>
        </div>
      </section>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section
            aria-labelledby="hard-stale-title"
            aria-modal="true"
            className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-slate-900"
            role="dialog"
          >
            <h2 className="text-lg font-semibold" id="hard-stale-title">
              Tax data is stale
            </h2>
            <p className="mt-3 text-sm text-slate-700">
              The bundled 2026 tax data is {ageDays} days old. This planner can still run, but tax outputs may be
              materially out of date until the constants are refreshed.
            </p>
            <button
              className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => {
                writeAcknowledgement(retrievedAt);
                setAcknowledged(true);
              }}
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
