import { useEffect, useRef } from 'react';

export const SHARE_LINK_PRIVACY_TEXT =
  'Sharing embeds your full financial profile in the URL hash. The hash is not sent to our servers, but anyone receiving the URL — including local URL loggers — sees the full profile. Use export-JSON for sensitive figures.';

type ShareLinkModalProps = Readonly<{
  onCancel: () => void;
  onCopyShareLink: () => void;
  onExportJson: () => void;
}>;

export function ShareLinkModal({ onCancel, onCopyShareLink, onExportJson }: ShareLinkModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <section
        aria-labelledby="share-link-privacy-heading"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/30"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="share-link-privacy-heading">
          Share-link privacy
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{SHARE_LINK_PRIVACY_TEXT}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:outline-indigo-400"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:outline-indigo-400"
            onClick={onExportJson}
            type="button"
          >
            Export JSON
          </button>
          <button
            className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 dark:focus-visible:outline-indigo-300"
            onClick={onCopyShareLink}
            type="button"
          >
            Copy share link
          </button>
        </div>
      </section>
    </div>
  );
}
