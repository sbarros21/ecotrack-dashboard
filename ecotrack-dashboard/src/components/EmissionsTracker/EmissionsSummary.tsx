import { memo } from 'react'
import type { EmissionsTotals } from '../../hooks/useEmissions'
import { EMISSION_CATEGORIES } from '../../types/emissions'
import { CATEGORY_STYLES, formatCo2 } from './categoryStyles'

interface EmissionsSummaryProps {
  totals: EmissionsTotals
  count: number
}

/** KPIs superiores: total y desglose por categoría con barra proporcional. */
export const EmissionsSummary = memo(function EmissionsSummary({ totals, count }: EmissionsSummaryProps) {
  return (
    <section aria-label="Resumen de emisiones" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-sm font-medium text-slate-300">Huella total</p>
        <p className="mt-2 text-3xl font-bold tabular-nums">{formatCo2(totals.total)}</p>
        <p className="mt-1 text-sm text-slate-400">{count} mediciones registradas</p>
      </div>

      {EMISSION_CATEGORIES.map((category) => {
        const value = totals.byCategory[category]
        const pct = totals.total > 0 ? Math.round((value / totals.total) * 100) : 0
        const style = CATEGORY_STYLES[category]
        return (
          <div key={category} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span aria-hidden="true">{style.icon}</span>
              {category}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{formatCo2(value)}</p>
            <div
              role="meter"
              aria-label={`Porcentaje de ${category} sobre el total`}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div className={`h-full rounded-full ${style.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{pct}% del total</p>
          </div>
        )
      })}
    </section>
  )
})
