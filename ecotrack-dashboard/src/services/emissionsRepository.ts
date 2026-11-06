import type { SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  isEmissionCategory,
  mapRowToEmission,
  type Emission,
  type EmissionRow,
  type NewEmission,
} from '../types/emissions'

/**
 * Contrato de acceso a datos. El hook `useEmissions` depende de esta interfaz
 * y no de Supabase directamente, lo que permite inyectar un mock en tests y demos.
 */
export interface EmissionsRepository {
  readonly kind: 'supabase' | 'mock'
  list(signal?: AbortSignal): Promise<Emission[]>
  insert(input: NewEmission): Promise<Emission>
  /** Se suscribe a inserciones en tiempo real. Devuelve la función para desuscribirse. */
  subscribe(onInsert: (emission: Emission) => void): () => void
}

const TABLE = 'emissions'
const COLUMNS = 'id, source_name, category, co2_kg, created_at'

function assertRow(value: unknown): EmissionRow {
  if (typeof value !== 'object' || value === null) throw new Error('Respuesta inválida de Supabase')
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.source_name !== 'string' ||
    !isEmissionCategory(row.category) ||
    (typeof row.co2_kg !== 'number' && typeof row.co2_kg !== 'string') ||
    typeof row.created_at !== 'string'
  ) {
    throw new Error('La fila recibida no cumple el esquema esperado')
  }
  return {
    id: row.id,
    source_name: row.source_name,
    category: row.category,
    co2_kg: Number(row.co2_kg),
    created_at: row.created_at,
  }
}

export function createSupabaseRepository(client: SupabaseClient): EmissionsRepository {
  return {
    kind: 'supabase',

    async list(signal) {
      let query = client.from(TABLE).select(COLUMNS).order('created_at', { ascending: false })
      if (signal) query = query.abortSignal(signal)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => mapRowToEmission(assertRow(r)))
    },

    async insert(input) {
      const { data, error } = await client
        .from(TABLE)
        .insert({
          source_name: input.sourceName.trim(),
          category: input.category,
          co2_kg: input.co2Kg,
        })
        .select(COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      return mapRowToEmission(assertRow(data))
    },

    subscribe(onInsert) {
      const channel = client
        .channel('emissions-inserts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
          try {
            onInsert(mapRowToEmission(assertRow(payload.new)))
          } catch {
            /* fila malformada: se ignora */
          }
        })
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}

/* ------------------------------------------------------------------ */
/* Repositorio simulado: misma interfaz, datos en memoria.              */
/* ------------------------------------------------------------------ */

const SEED: NewEmission[] = [
  { sourceName: 'Flota de camiones de reparto', category: 'Transporte', co2Kg: 1840.5 },
  { sourceName: 'Planta de producción – Línea A', category: 'Energía', co2Kg: 3210 },
  { sourceName: 'Vuelos corporativos Q4', category: 'Transporte', co2Kg: 2675.2 },
  { sourceName: 'Data center (servidores)', category: 'Energía', co2Kg: 980.75 },
  { sourceName: 'Residuos orgánicos cafetería', category: 'Residuos', co2Kg: 142.3 },
  { sourceName: 'Relleno sanitario – embalajes', category: 'Residuos', co2Kg: 418 },
]

export interface MockOptions {
  latencyMs?: number
  /** Probabilidad (0–1) de que una operación falle, útil para probar el estado de error. */
  failureRate?: number
  seed?: NewEmission[]
}

export function createMockRepository(options: MockOptions = {}): EmissionsRepository {
  const { latencyMs = 600, failureRate = 0, seed = SEED } = options
  const listeners = new Set<(e: Emission) => void>()
  const now = Date.now()
  let store: Emission[] = seed.map((s, i) => ({
    ...s,
    id: crypto.randomUUID(),
    createdAt: new Date(now - (i + 1) * 47 * 60_000),
  }))

  const wait = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, latencyMs)
      signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })

  const maybeFail = (op: string) => {
    if (Math.random() < failureRate) throw new Error(`Error simulado al ${op}. Intenta de nuevo.`)
  }

  return {
    kind: 'mock',
    async list(signal) {
      await wait(signal)
      maybeFail('cargar las mediciones')
      return [...store].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    async insert(input) {
      await wait()
      maybeFail('guardar la medición')
      const created: Emission = {
        id: crypto.randomUUID(),
        sourceName: input.sourceName.trim(),
        category: input.category,
        co2Kg: input.co2Kg,
        createdAt: new Date(),
      }
      store = [created, ...store]
      // Emula Supabase Realtime: el evento llega a todos los suscriptores.
      listeners.forEach((l) => l(created))
      return created
    },
    subscribe(onInsert) {
      listeners.add(onInsert)
      return () => listeners.delete(onInsert)
    },
  }
}

/** Repositorio por defecto según configuración de entorno. */
export function getDefaultRepository(): EmissionsRepository {
  const forceMock = import.meta.env.VITE_DATA_SOURCE === 'mock'
  if (!forceMock && isSupabaseConfigured && supabase) return createSupabaseRepository(supabase)
  return createMockRepository()
}
