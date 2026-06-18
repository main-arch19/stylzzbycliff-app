import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

// Isolate the page from its data hooks so this is a pure render smoke test.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { username: 'Cliff' } }),
}))
vi.mock('@/hooks/useBarberDashboard', () => ({
  useBarberDashboard: () => ({
    stats: {
      appointments_today: 3, cuts_today: 2, tips_today_cents: 1500,
      website_bookings_upcoming: 2, pending_approvals: 2, unmatched_bookings: 1,
      pending_redemptions: 1, decay_risk: 3, next_appointment: null,
    },
    websiteBookings: [{
      id: 'w1',
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      service_name: 'Skin Fade',
      customer_id: 'c1',
      customer_name: 'Marcus',
    }],
    loading: false,
    refetch: vi.fn(),
  }),
}))
vi.mock('@/hooks/useAppointments', () => ({
  useAdminAppointments: () => ({
    dayAppointments: [],
    complete: vi.fn(),
    markNoShow: vi.fn(),
    refetch: vi.fn(),
  }),
}))
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))

import Dashboard from '../Dashboard'

describe('Barber Dashboard', () => {
  it('renders the greeting, website-bookings section, attention queue and quick actions', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Cliff')).toBeInTheDocument()
    expect(screen.getByText('FROM THE WEBSITE')).toBeInTheDocument()
    expect(screen.getByText('NEEDS ATTENTION')).toBeInTheDocument()
    expect(screen.getByText('Cut approvals')).toBeInTheDocument()
    expect(screen.getByText('LOG WALK-IN')).toBeInTheDocument()
  })
})
