import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true cuando hay credenciales reales en `.env.local`. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Cliente único (singleton) de Supabase.
 * Es `null` si no hay variables de entorno: en ese caso la app usa el
 * repositorio simulado para que la demo funcione sin backend.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
