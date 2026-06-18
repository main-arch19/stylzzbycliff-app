import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Isolate the page from its data + chrome dependencies so this is a pure
// render smoke test (does the JSX render and show appointment data?).
vi.mock('@/hooks/useAppointments', () => ({
  useAppointments: () => ({
    upcoming: [{
      id: 'a1',
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      status: 'confirmed',
      service_name: 'Skin Fade',
      barbers: { name: 'Cliff' },
    }],
    past: [],
    loading: false,
    cancel: vi.fn(),
  }),
}))
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('@/components/ThemeToggle', () => ({ default: () => null }))

import Appointments from '../Appointments'

describe('Appointments page', () => {
  it('renders the header and an upcoming appointment', () => {
    render(<Appointments />)
    expect(screen.getByText('APPOINTMENTS')).toBeInTheDocument()
    expect(screen.getByText('Skin Fade')).toBeInTheDocument()
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument()
  })

  it('shows a cancel control for active appointments', () => {
    render(<Appointments />)
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })
})
