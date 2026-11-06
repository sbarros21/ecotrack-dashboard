/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "mock" fuerza los datos simulados aunque existan credenciales. */
  readonly VITE_DATA_SOURCE?: 'supabase' | 'mock'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
