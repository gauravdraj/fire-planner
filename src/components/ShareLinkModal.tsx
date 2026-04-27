export const SHARE_LINK_PRIVACY_TEXT =
  'Sharing embeds your full financial profile in the URL hash. The hash is not sent to our servers, but anyone receiving the URL — including local URL loggers — sees the full profile. Use export-JSON for sensitive figures.';

type ShareLinkModalProps = Readonly<{
  onCancel: () => void;
  onCopyShareLink: () => void;
  onExportJson: () => void;
}>;

export function ShareLinkModal({ onCancel, onCopyShareLink, onExportJson }: ShareLinkModalProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <section
        aria-labelledby="share-link-privacy-heading"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-slate-950" id="share-link-privacy-heading">
          Share-link privacy
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{SHARE_LINK_PRIVACY_TEXT}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={onExportJson}
            type="button"
          >
            Export JSON
          </button>
          <button
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
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
