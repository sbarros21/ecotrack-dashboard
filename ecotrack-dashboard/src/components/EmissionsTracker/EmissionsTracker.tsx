import { useMemo, useState } from 'react'
import { useEmissions } from '../../hooks/useEmissions'
import type { EmissionsRepository } from '../../services/emissionsRepository'
import { EMISSION_CATEGORIES, type EmissionCategory } from '../../types/emissions'
import { CATEGORY_STYLES } from './categoryStyles'
import { EmissionCard } from './EmissionCard'
import { EmissionForm } from './EmissionForm'
import { EmissionsSummary } from './EmissionsSummary'

type Filter = EmissionCategory | 'Todas'
const FILTERS: readonly Filter[] = ['Todas', ...EMISSION_CATEGORIES]

interface EmissionsTrackerProps {
  /** Permite inyectar un repositorio (tests / storybook). */
  repository?: EmissionsRepository
}

function CardSkeleton() {
  return (
    <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white p-5" aria-hidden="true">
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-1/4 rounded bg-slate-100" />
      <div className="mt-8 h-6 w-1/2 rounded bg-slate-200" />
    </div>
  )
}

/**
 * Dashboard de Emisiones en Tiempo Real.
 * Componente contenedor: compone resumen, filtros, listado y formulario.
 * Toda la lógica de datos vive en `useEmissions` (separación lógica/UI).
 */
export function EmissionsTracker({ repository }: EmissionsTrackerProps = {}) {
  const {
    emissions,
    isLoading,
    error,
    isSubmitting,
    submitError,
    totals,
    dataSource,
    addEmission,
    refresh,
    clearSubmitError,
  } = useEmissions(repository)

  const [filter, setFilter] = useState<Filter>('Todas')

  const visible = useMemo(
    () => (filter === 'Todas' ? emissions : emissions.filter((e) => e.category === filter)),
    [emissions, filter],
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">EcoTrack</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Dashboard de Emisiones
          </h1>
          <p className="mt-2 text-slate-600">Monitoreo de la huella de carbono de tu empresa en tiempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            En vivo · {dataSource === 'supabase' ? 'Supabase' : 'Datos simulados'}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
          >
            Actualizar
          </button>
        </div>
      </header>

      <EmissionsSummary totals={totals} count={emissions.length} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="list-title" aria-busy={isLoading} className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="list-title" className="text-lg font-semibold text-slate-900">
              Fuentes de emisión
            </h2>
            <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = filter === f
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f !== 'Todas' && <span aria-hidden="true">{CATEGORY_STYLES[f].icon} </span>}
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
              <p className="font-semibold">No pudimos cargar las mediciones</p>
              <p className="mt-1 text-sm">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
              >
                Reintentar
              </button>
            </div>
          ) : isLoading ? (
            <>
              <p className="sr-only" role="status">
                Cargando mediciones…
              </p>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
              <p className="font-medium text-slate-900">Sin mediciones {filter !== 'Todas' && `de ${filter}`}</p>
              <p className="mt-1 text-sm text-slate-600">Agrega la primera con el formulario.</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-live="polite">
              {visible.map((emission) => (
                <li key={emission.id}>
                  <EmissionCard emission={emission} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <EmissionForm
            onSubmit={addEmission}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onDismissError={clearSubmitError}
          />
        </aside>
      </div>
    </div>
  )
}

export default EmissionsTracker
