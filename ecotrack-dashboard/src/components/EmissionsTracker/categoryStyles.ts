import type { EmissionCategory } from '../../types/emissions'

interface CategoryStyle {
  icon: string
  badge: string
  bar: string
  accent: string
}

/** Colores con contraste AA sobre fondo blanco (texto 700 sobre fondo 50/100). */
export const CATEGORY_STYLES: Record<EmissionCategory, CategoryStyle> = {
  Transporte: {
    icon: '🚚',
    badge: 'bg-sky-50 text-sky-800 ring-sky-600/20',
    bar: 'bg-sky-500',
    accent: 'border-l-sky-500',
  },
  Energía: {
    icon: '⚡',
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    bar: 'bg-amber-500',
    accent: 'border-l-amber-500',
  },
  Residuos: {
    icon: '♻️',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    bar: 'bg-emerald-500',
    accent: 'border-l-emerald-500',
  },
}

const kgFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const tonFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export function formatCo2(kg: number): string {
  return kg >= 1000 ? `${tonFormatter.format(kg / 1000)} t CO₂e` : `${kgFormatter.format(kg)} kg CO₂e`
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date)
}
