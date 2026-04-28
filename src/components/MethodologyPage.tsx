import {
  methodologySections,
  type ConstantSourceRow,
  type MethodologyListItem,
  type MethodologyMetricEntry,
  type MethodologySection,
  type NotModeledItem,
  type SourceReference,
} from '@/lib/methodologyContent';

const SECTIONS: readonly MethodologySection[] = methodologySections;

export function MethodologyPage() {
  return (
    <section aria-labelledby="methodology-page-heading" className="rounded-lg border border-slate-200 p-5">
      <p className="text-sm font-medium text-indigo-700">Trust and assumptions</p>
      <h2 className="mt-1 text-xl font-semibold" id="methodology-page-heading">
        Methodology
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        A plain-English reference for what Fire Planner models, what it leaves out, and where key law constants come
        from.
      </p>

      <div className="mt-6 space-y-6">
        {SECTIONS.map((section) => (
          <section aria-labelledby={`methodology-${section.id}-heading`} className="rounded-lg bg-slate-50 p-4" key={section.id}>
            <h3 className="text-lg font-semibold text-slate-950" id={`methodology-${section.id}-heading`}>
              {section.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{section.summary}</p>

            {section.paragraphs === undefined ? null : (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
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
    <ul className="mt-3 space-y-2 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item.id}>
          <span className="font-medium text-slate-950">{item.label}:</span> {item.description}
        </li>
      ))}
    </ul>
  );
}

function NotModeledList({ items }: { items: readonly NotModeledItem[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item.id}>
          <span className="font-medium text-slate-950">{item.label}:</span> {item.note}{' '}
          <span className="text-slate-500">({item.designText})</span>
        </li>
      ))}
    </ul>
  );
}

function ConstantsTable({ rows }: { rows: readonly ConstantSourceRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Sourced law constants and retrieval dates</caption>
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold" scope="col">
              Constant
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold" scope="col">
              Value
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold" scope="col">
              Source
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold" scope="col">
              Retrieved
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="align-top" key={row.id}>
              <th className="border-b border-slate-100 px-3 py-3 font-medium text-slate-950" scope="row">
                {row.name}
              </th>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.value}</td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                <a className="font-medium text-indigo-700 underline-offset-2 hover:underline" href={row.sourceUrl}>
                  {row.source}
                </a>
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.retrievedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricMethodologyList({ entries }: { entries: readonly MethodologyMetricEntry[] }) {
  return (
    <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
      {entries.map((entry) => (
        <li className="rounded-md border border-slate-200 bg-white p-3" key={entry.id}>
          <span className="font-medium text-slate-950">{entry.explanation.label}</span>
          <p className="mt-1">{entry.explanation.description}</p>
        </li>
      ))}
    </ul>
  );
}

function SourceReferenceList({ references }: { references: readonly SourceReference[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-slate-700">
      {references.map((reference) => (
        <li key={reference.id}>
          <a className="font-medium text-indigo-700 underline-offset-2 hover:underline" href={reference.sourceUrl}>
            {reference.label}
          </a>
          <span className="text-slate-600"> — {reference.source}</span>
          {reference.retrievedAt === undefined ? null : (
            <span className="text-slate-500"> Retrieved {reference.retrievedAt}.</span>
          )}
        </li>
      ))}
    </ul>
  );
}
