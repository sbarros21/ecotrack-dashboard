import { memo, useId, useRef, useState, type FormEvent } from 'react'
import { EMISSION_CATEGORIES, isEmissionCategory, type EmissionCategory, type NewEmission } from '../../types/emissions'

interface EmissionFormProps {
  onSubmit: (input: NewEmission) => Promise<boolean>
  isSubmitting: boolean
  submitError: string | null
  onDismissError: () => void
}

interface FormValues {
  sourceName: string
  category: EmissionCategory | ''
  co2Kg: string
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

const EMPTY: FormValues = { sourceName: '', category: '', co2Kg: '' }
const MAX_NAME = 80
const MAX_CO2 = 1_000_000

export function validate(values: FormValues): { errors: FieldErrors; data: NewEmission | null } {
  const errors: FieldErrors = {}
  const name = values.sourceName.trim()
  if (!name) errors.sourceName = 'El nombre de la fuente es obligatorio.'
  else if (name.length > MAX_NAME) errors.sourceName = `Máximo ${MAX_NAME} caracteres.`

  if (!isEmissionCategory(values.category)) errors.category = 'Selecciona una categoría.'

  const co2 = Number(values.co2Kg.replace(',', '.'))
  if (values.co2Kg.trim() === '') errors.co2Kg = 'Ingresa la cantidad de CO₂.'
  else if (!Number.isFinite(co2) || co2 <= 0) errors.co2Kg = 'Debe ser un número mayor que 0.'
  else if (co2 > MAX_CO2) errors.co2Kg = `El valor no puede superar ${MAX_CO2.toLocaleString('es-CO')} kg.`

  if (Object.keys(errors).length > 0 || !isEmissionCategory(values.category)) return { errors, data: null }
  return { errors, data: { sourceName: name, category: values.category, co2Kg: co2 } }
}

const inputBase =
  'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50'
const inputOk = 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/30'
const inputErr = 'border-rose-500 focus:border-rose-600 focus:ring-rose-600/30'

export const EmissionForm = memo(function EmissionForm({
  onSubmit,
  isSubmitting,
  submitError,
  onDismissError,
}: EmissionFormProps) {
  const id = useId()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [success, setSuccess] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const co2Ref = useRef<HTMLInputElement>(null)

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors(({ [key]: _omit, ...rest }) => rest)
    if (success) setSuccess(null)
    if (submitError) onDismissError()
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { errors: nextErrors, data } = validate(values)
    setErrors(nextErrors)
    if (!data) {
      // Foco en el primer campo inválido (accesibilidad).
      if (nextErrors.sourceName) nameRef.current?.focus()
      else if (nextErrors.category) categoryRef.current?.focus()
      else co2Ref.current?.focus()
      return
    }
    const ok = await onSubmit(data)
    if (ok) {
      setValues(EMPTY)
      setSuccess(`Medición "${data.sourceName}" registrada.`)
      nameRef.current?.focus()
    }
  }

  const fieldId = (name: string) => `${id}-${name}`
  const errId = (name: keyof FormValues) => (errors[name] ? `${id}-${name}-error` : undefined)

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${id}-title`}
      aria-busy={isSubmitting}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
        Nueva medición
      </h2>
      <p className="mt-1 text-sm text-slate-600">Registra una fuente de emisión y su CO₂ equivalente.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor={fieldId('name')} className="mb-1.5 block text-sm font-medium text-slate-700">
            Nombre de la fuente <span className="text-rose-600" aria-hidden="true">*</span>
          </label>
          <input
            ref={nameRef}
            id={fieldId('name')}
            type="text"
            autoComplete="off"
            maxLength={MAX_NAME + 20}
            placeholder="Ej. Flota de vehículos eléctricos"
            value={values.sourceName}
            onChange={(e) => update('sourceName', e.target.value)}
            disabled={isSubmitting}
            required
            aria-required="true"
            aria-invalid={Boolean(errors.sourceName)}
            aria-describedby={errId('sourceName')}
            className={`${inputBase} ${errors.sourceName ? inputErr : inputOk}`}
          />
          {errors.sourceName && (
            <p id={errId('sourceName')} className="mt-1.5 text-sm text-rose-700">
              {errors.sourceName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fieldId('category')} className="mb-1.5 block text-sm font-medium text-slate-700">
            Categoría <span className="text-rose-600" aria-hidden="true">*</span>
          </label>
          <select
            ref={categoryRef}
            id={fieldId('category')}
            value={values.category}
            onChange={(e) => update('category', isEmissionCategory(e.target.value) ? e.target.value : '')}
            disabled={isSubmitting}
            required
            aria-required="true"
            aria-invalid={Boolean(errors.category)}
            aria-describedby={errId('category')}
            className={`${inputBase} ${errors.category ? inputErr : inputOk}`}
          >
            <option value="" disabled>
              Selecciona una categoría
            </option>
            {EMISSION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.category && (
            <p id={errId('category')} className="mt-1.5 text-sm text-rose-700">
              {errors.category}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fieldId('co2')} className="mb-1.5 block text-sm font-medium text-slate-700">
            CO₂ producido (kg) <span className="text-rose-600" aria-hidden="true">*</span>
          </label>
          <input
            ref={co2Ref}
            id={fieldId('co2')}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={values.co2Kg}
            onChange={(e) => update('co2Kg', e.target.value)}
            disabled={isSubmitting}
            required
            aria-required="true"
            aria-invalid={Boolean(errors.co2Kg)}
            aria-describedby={errId('co2Kg')}
            className={`${inputBase} tabular-nums ${errors.co2Kg ? inputErr : inputOk}`}
          />
          {errors.co2Kg && (
            <p id={errId('co2Kg')} className="mt-1.5 text-sm text-rose-700">
              {errors.co2Kg}
            </p>
          )}
        </div>
      </div>

      {submitError && (
        <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          No se pudo guardar: {submitError}
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-4 text-sm text-emerald-700 empty:hidden">
        {success}
      </p>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {isSubmitting ? 'Guardando…' : 'Agregar medición'}
      </button>
    </form>
  )
})
