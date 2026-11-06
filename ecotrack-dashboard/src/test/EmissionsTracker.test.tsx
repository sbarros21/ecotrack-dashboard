import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmissionsTracker } from '../components/EmissionsTracker/EmissionsTracker'
import { validate } from '../components/EmissionsTracker/EmissionForm'
import { createMockRepository } from '../services/emissionsRepository'

describe('EmissionsTracker', () => {
  it('renderiza las tarjetas y agrega una nueva medición', async () => {
    render(<EmissionsTracker repository={createMockRepository({ latencyMs: 5 })} />)
    expect(await screen.findByText('Flota de camiones de reparto')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Nombre de la fuente/), { target: { value: 'Generador diésel' } })
    fireEvent.change(screen.getByLabelText(/Categoría/), { target: { value: 'Energía' } })
    fireEvent.change(screen.getByLabelText(/CO₂ producido/), { target: { value: '120.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar medición/ }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generador diésel' })).toBeInTheDocument())
  })

  it('muestra errores accesibles si el formulario es inválido', async () => {
    render(<EmissionsTracker repository={createMockRepository({ latencyMs: 5 })} />)
    fireEvent.click(screen.getByRole('button', { name: /Agregar medición/ }))
    const name = screen.getByLabelText(/Nombre de la fuente/)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(await screen.findByText('El nombre de la fuente es obligatorio.')).toBeInTheDocument()
  })

  it('filtra por categoría', async () => {
    render(<EmissionsTracker repository={createMockRepository({ latencyMs: 5 })} />)
    await screen.findByText('Flota de camiones de reparto')
    fireEvent.click(screen.getByRole('button', { name: /Residuos/ }))
    expect(screen.queryByText('Flota de camiones de reparto')).not.toBeInTheDocument()
    expect(screen.getByText('Residuos orgánicos cafetería')).toBeInTheDocument()
  })
})

describe('validate', () => {
  it('rechaza CO2 negativo y acepta coma decimal', () => {
    expect(validate({ sourceName: 'a', category: 'Energía', co2Kg: '-3' }).data).toBeNull()
    expect(validate({ sourceName: 'a', category: 'Energía', co2Kg: '3,5' }).data?.co2Kg).toBe(3.5)
  })
})
