import { memo } from 'react'
import type { Emission } from '../../types/emissions'
import { CATEGORY_STYLES, formatCo2, formatDate } from './categoryStyles'

interface EmissionCardProps {
  emission: Emission
}

/** Tarjeta de una medición. `memo` evita re-render cuando llegan otras emisiones. */
export const EmissionCard = memo(function EmissionCard({ emission }: EmissionCardProps) {
  const style = CATEGORY_STYLES[emission.category]
  const headingId = `emission-${emission.id}-title`

  return (
    <article
      aria-labelledby={headingId}
      className={`flex h-full flex-col justify-between gap-4 rounded-xl border border-l-4 border-slate-200 ${style.accent} bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={headingId} className="text-base font-semibold leading-snug text-slate-900">
          {emission.sourceName}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.badge}`}
        >
          <span aria-hidden="true">{style.icon}</span>
          {emission.category}
        </span>
      </div>

      <dl>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">CO₂ producido</dt>
        <dd className="mt-1 whitespace-nowrap text-2xl font-bold tabular-nums text-slate-900">
          {formatCo2(emission.co2Kg)}
        </dd>
        <dt className="sr-only">Fecha de registro</dt>
        <dd className="mt-2 text-xs text-slate-500">
          <time dateTime={emission.createdAt.toISOString()}>{formatDate(emission.createdAt)}</time>
        </dd>
      </dl>
    </article>
  )
})
