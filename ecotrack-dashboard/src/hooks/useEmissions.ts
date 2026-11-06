import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { getDefaultRepository, type EmissionsRepository } from '../services/emissionsRepository'
import {
  EMISSION_CATEGORIES,
  type Emission,
  type EmissionCategory,
  type NewEmission,
} from '../types/emissions'

/* ------------------------------------------------------------------ */
/* Estado (máquina de estados con useReducer)                          */
/* ------------------------------------------------------------------ */

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

interface State {
  status: LoadStatus
  emissions: Emission[]
  error: string | null
  isSubmitting: boolean
  submitError: string | null
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Emission[] }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: Emission }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'REALTIME_INSERT'; payload: Emission }
  | { type: 'CLEAR_SUBMIT_ERROR' }

const initialState: State = {
  status: 'idle',
  emissions: [],
  error: null,
  isSubmitting: false,
  submitError: null,
}

/** Inserta sin duplicar: el INSERT puede llegar por la respuesta y por Realtime. */
function upsertById(list: Emission[], item: Emission): Emission[] {
  if (list.some((e) => e.id === item.id)) return list
  return [item, ...list]
}

export function emissionsReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading', error: null }
    case 'FETCH_SUCCESS':
      return { ...state, status: 'success', emissions: action.payload }
    case 'FETCH_ERROR':
      return { ...state, status: 'error', error: action.payload }
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null }
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, emissions: upsertById(state.emissions, action.payload) }
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.payload }
    case 'REALTIME_INSERT': {
      const next = upsertById(state.emissions, action.payload)
      // Mantener la misma referencia evita re-renders si era un duplicado.
      return next === state.emissions ? state : { ...state, emissions: next }
    }
    case 'CLEAR_SUBMIT_ERROR':
      return state.submitError === null ? state : { ...state, submitError: null }
  }
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Ocurrió un error inesperado'
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

let defaultRepo: EmissionsRepository | null = null
function resolveDefaultRepo(): EmissionsRepository {
  defaultRepo ??= getDefaultRepository()
  return defaultRepo
}

export interface EmissionsTotals {
  total: number
  byCategory: Record<EmissionCategory, number>
}

export interface UseEmissionsResult {
  emissions: Emission[]
  status: LoadStatus
  isLoading: boolean
  error: string | null
  isSubmitting: boolean
  submitError: string | null
  totals: EmissionsTotals
  dataSource: EmissionsRepository['kind']
  /** Devuelve `true` si se guardó correctamente (el formulario lo usa para limpiarse). */
  addEmission: (input: NewEmission) => Promise<boolean>
  refresh: () => void
  clearSubmitError: () => void
}

/**
 * Gestiona carga, inserción, errores y suscripción en tiempo real de las emisiones.
 * @param repository Inyectable para tests; por defecto usa Supabase o el mock según `.env`.
 */
export function useEmissions(repository?: EmissionsRepository): UseEmissionsResult {
  const repo = useMemo(() => repository ?? resolveDefaultRepo(), [repository])
  const [state, dispatch] = useReducer(emissionsReducer, initialState)
  const [reloadKey, forceReload] = useReducer((n: number) => n + 1, 0)

  // Evita dispatch tras desmontar (p. ej. un insert lento).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Carga inicial + recargas manuales, cancelables con AbortController.
  useEffect(() => {
    const controller = new AbortController()
    dispatch({ type: 'FETCH_START' })
    repo
      .list(controller.signal)
      .then((data) => dispatch({ type: 'FETCH_SUCCESS', payload: data }))
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return
        dispatch({ type: 'FETCH_ERROR', payload: toMessage(err) })
      })
    return () => controller.abort()
  }, [repo, reloadKey])

  // Tiempo real: nuevas filas insertadas por cualquier cliente.
  useEffect(() => {
    return repo.subscribe((emission) => dispatch({ type: 'REALTIME_INSERT', payload: emission }))
  }, [repo])

  const addEmission = useCallback(
    async (input: NewEmission): Promise<boolean> => {
      dispatch({ type: 'SUBMIT_START' })
      try {
        const created = await repo.insert(input)
        if (mountedRef.current) dispatch({ type: 'SUBMIT_SUCCESS', payload: created })
        return true
      } catch (err) {
        if (mountedRef.current) dispatch({ type: 'SUBMIT_ERROR', payload: toMessage(err) })
        return false
      }
    },
    [repo],
  )

  const refresh = useCallback(() => forceReload(), [])
  const clearSubmitError = useCallback(() => dispatch({ type: 'CLEAR_SUBMIT_ERROR' }), [])

  // Derivado memoizado: solo se recalcula cuando cambia la lista.
  const totals = useMemo<EmissionsTotals>(() => {
    const byCategory = Object.fromEntries(EMISSION_CATEGORIES.map((c) => [c, 0])) as Record<
      EmissionCategory,
      number
    >
    let total = 0
    for (const e of state.emissions) {
      byCategory[e.category] += e.co2Kg
      total += e.co2Kg
    }
    return { total, byCategory }
  }, [state.emissions])

  return {
    emissions: state.emissions,
    status: state.status,
    isLoading: state.status === 'loading' || state.status === 'idle',
    error: state.error,
    isSubmitting: state.isSubmitting,
    submitError: state.submitError,
    totals,
    dataSource: repo.kind,
    addEmission,
    refresh,
    clearSubmitError,
  }
}
