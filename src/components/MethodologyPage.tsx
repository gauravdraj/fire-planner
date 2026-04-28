import {
  methodologySections,
  type ConstantSourceRow,
  type MethodologyListItem,
  type MethodologyMetricEntry,
  type MethodologySection,
  type NotModeledItem,
  type SourceReference,
} from '@/lib/methodologyContent';

import { classNames } from './ui/controlStyles';

const SECTIONS: readonly MethodologySection[] = methodologySections;

const panelClassName =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none';
const sectionCardClassName =
  'rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/45 dark:shadow-none sm:p-5';
const sectionHeadingClassName = 'text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50';
const mutedTextClassName = 'text-sm leading-6 text-slate-600 dark:text-slate-400';
const bodyTextClassName = 'text-sm leading-6 text-slate-700 dark:text-slate-300';
const itemCardClassName =
  'rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none';
const linkClassName =
  'rounded-sm font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-4 transition-colors hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:text-indigo-300 dark:decoration-indigo-500/60 dark:hover:text-indigo-100 dark:focus-visible:outline-indigo-400';
const tableShellClassName =
  'mt-4 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none';
const tableHeaderCellClassName =
  'border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:text-slate-300';
const tableCellClassName = 'border-b border-slate-100 px-3 py-3 text-slate-700 dark:border-slate-800 dark:text-slate-300';

export function MethodologyPage() {
  return (
    <section aria-labelledby="methodology-page-heading" className={classNames('mt-5 min-w-0', panelClassName)}>
      <header className="max-w-3xl">
        <p className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-950/40 dark:text-indigo-200">
          Trust and assumptions
        </p>
        <h2
          className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50"
          id="methodology-page-heading"
        >
          Methodology
        </h2>
        <p className={classNames('mt-2', mutedTextClassName)}>
          A plain-English reference for this free, open-source, client-only, fixture-validated, transparent planner.
        </p>
      </header>

      <nav
        aria-label="Methodology sections"
        className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">On this page</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200 dark:focus-visible:outline-indigo-400"
              href={`#methodology-${section.id}-heading`}
              key={section.id}
            >
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-6 space-y-6">
        {SECTIONS.map((section) => (
          <section
            aria-labelledby={`methodology-${section.id}-heading`}
            className={sectionCardClassName}
            key={section.id}
          >
            <h3 className={sectionHeadingClassName} id={`methodology-${section.id}-heading`}>
              {section.title}
            </h3>
            <p className={classNames('mt-1 max-w-3xl', mutedTextClassName)}>{section.summary}</p>

            {section.paragraphs === undefined ? null : (
              <div className={classNames('mt-4 max-w-3xl space-y-2', bodyTextClassName)}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}

            {section.items === undefined ? null : <MethodologyItemList items={section.items} />}
            {section.notModeledItems === undefined ? null : <NotModeledList items={section.notModeledItems} />}
            {section.constantRows === undefined ? null : <ConstantsTable rows={section.constantRows} />}
            {section.metricEntries === undefined ? null : <MetricMethodologyList entries={section.metricEntries} />}
            {section.sourceReferences === undefined ? null : <SourceReferenceList references={section.sourceReferences} />}
          </section>
        ))}
      </div>
    </section>
  );
}

function MethodologyItemList({ items }: { items: readonly MethodologyListItem[] }) {
  return (
    <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li className={itemCardClassName} key={item.id}>
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.label}:</p>
          <p className={classNames('mt-1', bodyTextClassName)}>{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

function NotModeledList({ items }: { items: readonly NotModeledItem[] }) {
  return (
    <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li className={itemCardClassName} key={item.id}>
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.label}:</p>
          <p className={classNames('mt-1', bodyTextClassName)}>{item.note}</p>
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {item.designText}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ConstantsTable({ rows }: { rows: readonly ConstantSourceRow[] }) {
  return (
    <div className={tableShellClassName}>
      <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left text-sm">
        <caption className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
          Sourced law constants and retrieval dates
        </caption>
        <thead className="bg-slate-100 dark:bg-slate-900">
          <tr>
            <th className={tableHeaderCellClassName} scope="col">
              Constant
            </th>
            <th className={tableHeaderCellClassName} scope="col">
              Value
            </th>
            <th className={tableHeaderCellClassName} scope="col">
              Source
            </th>
            <th className={tableHeaderCellClassName} scope="col">
              Retrieved
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-950">
          {rows.map((row) => (
            <tr className="align-top" key={row.id}>
              <th
                className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950 dark:border-slate-800 dark:text-slate-50"
                scope="row"
              >
                {row.name}
              </th>
              <td className={tableCellClassName}>{row.value}</td>
              <td className={classNames(tableCellClassName, 'max-w-[22rem] break-words')}>
                <a className={linkClassName} href={row.sourceUrl}>
                  {row.source}
                </a>
              </td>
              <td className={classNames(tableCellClassName, 'whitespace-nowrap tabular-nums')}>{row.retrievedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricMethodologyList({ entries }: { entries: readonly MethodologyMetricEntry[] }) {
  return (
    <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <li className={itemCardClassName} key={entry.id}>
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-semibold text-slate-950 dark:text-slate-50">{entry.explanation.label}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {entry.kind === 'live-stat' ? 'Live stat' : 'Table column'}
            </span>
          </div>
          <p className={classNames('mt-2', bodyTextClassName)}>{entry.explanation.description}</p>
        </li>
      ))}
    </ul>
  );
}

function SourceReferenceList({ references }: { references: readonly SourceReference[] }) {
  return (
    <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {references.map((reference) => (
        <li className={itemCardClassName} key={reference.id}>
          <a className={linkClassName} href={reference.sourceUrl}>
            {reference.label}
          </a>
          <p className={classNames('mt-1 break-words', bodyTextClassName)}>{reference.source}</p>
          {reference.retrievedAt === undefined ? null : (
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Retrieved {reference.retrievedAt}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
