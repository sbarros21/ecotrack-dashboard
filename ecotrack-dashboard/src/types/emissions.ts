/**
 * Tipos de dominio del Dashboard de Emisiones.
 * Las categorías se modelan como una tupla `as const` para tener una única
 * fuente de verdad que sirve tanto para el tipo como para el <select> del formulario.
 */
export const EMISSION_CATEGORIES = ['Transporte', 'Energía', 'Residuos'] as const

export type EmissionCategory = (typeof EMISSION_CATEGORIES)[number]

/** Fila tal como vive en la tabla `public.emissions` de Supabase. */
export interface EmissionRow {
  id: string
  source_name: string
  category: EmissionCategory
  co2_kg: number
  created_at: string
}

/** Modelo que consume la UI (camelCase, fecha como objeto Date). */
export interface Emission {
  id: string
  sourceName: string
  category: EmissionCategory
  co2Kg: number
  createdAt: Date
}

/** Datos necesarios para registrar una nueva medición. */
export interface NewEmission {
  sourceName: string
  category: EmissionCategory
  co2Kg: number
}

export function isEmissionCategory(value: unknown): value is EmissionCategory {
  return typeof value === 'string' && (EMISSION_CATEGORIES as readonly string[]).includes(value)
}

export function mapRowToEmission(row: EmissionRow): Emission {
  return {
    id: row.id,
    sourceName: row.source_name,
    category: row.category,
    co2Kg: Number(row.co2_kg),
    createdAt: new Date(row.created_at),
  }
}
