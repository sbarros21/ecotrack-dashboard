# Bitácora de Prompts — EcoTrack · Dashboard de Emisiones

**Autor:** Sebastián Barros
**Stack:** React 19 + Vite + TypeScript (estricto) + Tailwind CSS v4 + Supabase (PostgREST + Realtime)
**Objetivo:** pasar de la especificación funcional de `EmissionsTracker` a código de calidad profesional mediante un ciclo iterativo *Spec-to-Code*, sin aceptar la primera salida de la IA.

---

## Resumen del ciclo

| # | Prompt | Qué pedí | Problemas detectados en la salida | Qué cambió en el código |
|---|--------|----------|-----------------------------------|--------------------------|
| 1 | Estructura | Arquitectura de componentes a partir de la spec | Un solo componente gigante; Supabase llamado dentro del JSX; tipos `any` | Se separa en contenedor + 3 presentacionales + hook + repositorio |
| 2 | Lógica | `useEmissions` con loading / error / inserción | `useState` sueltos (estados imposibles), sin cancelación, sin realtime | `useReducer` como máquina de estados, `AbortController`, suscripción Realtime con deduplicación |
| 3 | Refinamiento | Accesibilidad, TypeScript estricto, `useMemo` / `memo` | Inputs sin `label`, errores no anunciados, totales recalculados en cada render | ARIA completo, foco en primer error, `memo` en tarjetas, totales y filtro memoizados, `strict` + `noUncheckedIndexedAccess` |
| 4 | Corrección visual + tests | Bug de layout detectado en capturas; pruebas | CO₂ partido en 2 líneas en 3 columnas | Grid `2xl:grid-cols-3`, `whitespace-nowrap`, 8 tests con Vitest + Testing Library |

---

## Prompt 1 — Estructura (arquitectura)

> **Prompt utilizado**
>
> Actúa como arquitecto frontend senior. Estoy construyendo el "Dashboard de Emisiones en Tiempo Real" de EcoTrack, una plataforma de huella de carbono. Stack: React 18+ con Vite, TypeScript y Tailwind CSS. El backend ya tiene una tabla en Supabase `emissions(id uuid, source_name text, category text, co2_kg numeric, created_at timestamptz)`.
>
> Especificación del componente `EmissionsTracker`:
> 1. Listado de tarjetas con: nombre de la fuente, categoría (Transporte, Energía, Residuos) y CO₂ producido.
> 2. Formulario para agregar nuevas mediciones.
> 3. Un custom hook `useEmissions` que gestione carga, inserción y errores contra Supabase.
>
> **No escribas todavía la implementación.** Entrégame: (a) el árbol de componentes con la responsabilidad de cada uno, (b) la estructura de carpetas, (c) los tipos TypeScript del dominio y (d) qué estado vive en el hook y qué estado es local de la UI. Justifica cada decisión en una línea.

### Salida inicial de la IA (v1, resumida)

```tsx
// EmissionsTracker.tsx — todo en un archivo
export default function EmissionsTracker() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => {
    supabase.from('emissions').select('*').then(({ data }) => setData(data))
  }, [])
  // ...formulario y tarjetas en el mismo componente
}
```

### Análisis crítico

- Mezcla acceso a datos, lógica y presentación: imposible de testear sin Supabase.
- `any[]` y `select('*')`: sin contrato de datos.
- No contempla que la base usa `snake_case` y la UI debería usar `camelCase`.

### Decisión tomada (v2 de la arquitectura)

```
src/
├── types/emissions.ts            ← tipos de dominio + mapper Row → Emission
├── lib/supabase.ts               ← cliente singleton
├── services/emissionsRepository.ts ← interfaz EmissionsRepository (Supabase | Mock)
├── hooks/useEmissions.ts         ← lógica de estado
└── components/EmissionsTracker/
    ├── EmissionsTracker.tsx      ← contenedor (compone y filtra)
    ├── EmissionsSummary.tsx      ← KPIs por categoría
    ├── EmissionCard.tsx          ← tarjeta presentacional
    ├── EmissionForm.tsx          ← formulario + validación
    └── categoryStyles.ts         ← tokens visuales y formateadores
```

Introduje el **patrón Repository**: el hook depende de una interfaz, no de Supabase. Esto permite inyectar datos simulados (demo y tests) sin tocar la UI.

---

## Prompt 2 — Lógica (custom hook `useEmissions`)

> **Prompt utilizado**
>
> Con la arquitectura anterior, implementa `useEmissions.ts`. Requisitos:
> - Recibe opcionalmente un `EmissionsRepository` (inyección de dependencias) con `list(signal)`, `insert(input)` y `subscribe(onInsert)`.
> - Estados: `idle | loading | success | error` para la carga, y estado separado `isSubmitting` / `submitError` para la inserción (un error al guardar no debe borrar la lista).
> - Cancela la petición si el componente se desmonta (`AbortController`) y no hagas `setState` tras desmontar.
> - Suscríbete a Supabase Realtime (INSERT en `public.emissions`) para que el dashboard sea en tiempo real.
> - `addEmission` debe devolver `Promise<boolean>` para que el formulario sepa si limpiarse.
> - Expón `refresh()` para reintentar después de un error.

### Salida inicial de la IA (v1, resumida)

```ts
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [emissions, setEmissions] = useState<Emission[]>([])

const addEmission = async (e: NewEmission) => {
  setLoading(true)
  const { data, error } = await supabase.from('emissions').insert(e).select()
  if (error) setError(error.message)
  else setEmissions([...emissions, data[0]])
  setLoading(false)
}
```

### Problemas encontrados

1. **Estados imposibles**: `loading=true` y `error` a la vez; la inserción reutiliza el `loading` de la carga → toda la lista muestra skeleton al guardar.
2. **Closure obsoleto**: `[...emissions, data[0]]` usa el valor capturado; con Realtime activo se pierden filas.
3. **Duplicados**: la fila insertada llega dos veces (respuesta del `insert` + evento Realtime).
4. `data[0]` sin validar y en `snake_case`.

### Prompt de seguimiento

> Reemplaza los `useState` por un `useReducer` con acciones tipadas (unión discriminada). Deduplica por `id` cuando el mismo INSERT llegue por la respuesta y por Realtime, y si es duplicado devuelve **la misma referencia de estado** para no provocar re-render. Valida la forma de la fila que devuelve Supabase antes de mapearla.

### Resultado (v2)

```ts
type Action =
  | { type: 'FETCH_START' } | { type: 'FETCH_SUCCESS'; payload: Emission[] }
  | { type: 'FETCH_ERROR'; payload: string } | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: Emission } | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'REALTIME_INSERT'; payload: Emission } | { type: 'CLEAR_SUBMIT_ERROR' }

case 'REALTIME_INSERT': {
  const next = upsertById(state.emissions, action.payload)
  return next === state.emissions ? state : { ...state, emissions: next }
}
```

Y en el repositorio, `assertRow()` valida en tiempo de ejecución lo que TypeScript no puede garantizar sobre datos externos.

---

## Prompt 3 — Refinamiento (accesibilidad, TS estricto, rendimiento)

> **Prompt utilizado**
>
> Refina los componentes con estas restricciones no negociables:
> 1. **Accesibilidad WCAG 2.1 AA**: cada input con `<label htmlFor>`, `aria-invalid` y `aria-describedby` apuntando al mensaje de error; al enviar un formulario inválido mueve el foco al primer campo con error; anuncia éxito con `role="status"` y errores con `role="alert"`; los filtros deben usar `aria-pressed`; respeta `prefers-reduced-motion`.
> 2. **TypeScript estricto**: activa `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. Prohibido `any`. Las categorías deben salir de una sola tupla `as const` que sirva para el tipo y para el `<select>`.
> 3. **Rendimiento**: memoiza los totales por categoría y la lista filtrada con `useMemo`; envuelve `EmissionCard`, `EmissionForm` y `EmissionsSummary` en `memo`; las funciones que bajan como props deben ser estables (`useCallback`).
> 4. **UI**: Tailwind, responsive mobile-first, estados de carga (skeleton), vacío y error con botón "Reintentar".

### Cambios en el código

| Antes | Después |
|-------|---------|
| `<input placeholder="Nombre">` | `<label htmlFor={id}>` + `useId()` + `aria-invalid` + `aria-describedby` |
| `category: string` | `EMISSION_CATEGORIES = [...] as const` → `type EmissionCategory` + type guard `isEmissionCategory` |
| Totales calculados en el JSX en cada render | `useMemo(() => …, [state.emissions])` dentro del hook |
| Validación solo con `required` de HTML | `validate()` pura y testeable (acepta coma decimal, rango 0 < x ≤ 1 000 000) |
| Spinner genérico | Skeleton con `aria-hidden` + texto `sr-only` "Cargando mediciones…" |

---

## Prompt 4 — Corrección basada en evidencia + pruebas

Al revisar las capturas de pantalla del build detecté un bug visual que la IA no había previsto:

> **Prompt utilizado**
>
> En un viewport de 1440 px el grid usa 3 columnas junto al formulario lateral de 360 px, y el valor "1,84 t CO₂e" se parte en dos líneas y la fecha queda comprimida a la derecha. Reorganiza `EmissionCard` para que el valor quede en una sola línea y la fecha debajo, y ajusta el breakpoint del grid. Después escribe tests con Vitest + Testing Library para: transición loading → success, estado de error, inserción sin duplicados, que el reducer conserve la referencia ante un duplicado, validación accesible del formulario y filtro por categoría.

### Resultado

- `sm:grid-cols-2 xl:grid-cols-3` → `sm:grid-cols-2 2xl:grid-cols-3` y `whitespace-nowrap` en el valor.
- **8 tests en verde** (`npm test`).
- `tsc -b` sin errores con la configuración estricta.

---

## Lecciones aprendidas

1. Pedir **primero la arquitectura sin código** evita que la IA “se case” con un diseño monolítico.
2. Los prompts más útiles fueron los que **nombraban el defecto concreto** (closure obsoleto, duplicado por Realtime) en lugar de “mejóralo”.
3. Las restricciones verificables (flags de `tsconfig`, atributos ARIA específicos) producen salidas comprobables; las vagas (“hazlo accesible”) no.
4. La IA no ve la interfaz: las capturas reales fueron necesarias para encontrar el bug de layout.
