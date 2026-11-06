import { act, renderHook, waitFor } from '@testing-library/react'
import { useEmissions, emissionsReducer } from '../hooks/useEmissions'
import { createMockRepository } from '../services/emissionsRepository'

describe('useEmissions', () => {
  it('pasa por loading y termina en success con los datos', async () => {
    const repo = createMockRepository({ latencyMs: 10 })
    const { result } = renderHook(() => useEmissions(repo))
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.emissions.length).toBe(6)
    expect(result.current.totals.total).toBeGreaterThan(0)
  })

  it('expone el error cuando la carga falla', async () => {
    const repo = createMockRepository({ latencyMs: 10, failureRate: 1 })
    const { result } = renderHook(() => useEmissions(repo))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toMatch(/Error simulado/)
  })

  it('inserta sin duplicar aunque llegue también por realtime', async () => {
    const repo = createMockRepository({ latencyMs: 10, seed: [] })
    const { result } = renderHook(() => useEmissions(repo))
    await waitFor(() => expect(result.current.status).toBe('success'))
    let ok = false
    await act(async () => {
      ok = await result.current.addEmission({ sourceName: 'Caldera', category: 'Energía', co2Kg: 50 })
    })
    expect(ok).toBe(true)
    expect(result.current.emissions).toHaveLength(1)
    expect(result.current.totals.byCategory.Energía).toBe(50)
  })

  it('el reducer conserva la referencia si el evento realtime es duplicado', () => {
    const e = { id: '1', sourceName: 'x', category: 'Residuos' as const, co2Kg: 1, createdAt: new Date() }
    const state = { status: 'success' as const, emissions: [e], error: null, isSubmitting: false, submitError: null }
    expect(emissionsReducer(state, { type: 'REALTIME_INSERT', payload: e })).toBe(state)
  })
})
