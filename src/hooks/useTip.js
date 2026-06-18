import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MOCK_MODE } from '@/lib/mockData'

// Starts a tip payment. In mock mode it simulates success; in real mode it
// asks the create-payment Edge Function for a Stripe Checkout URL and
// redirects the browser there (no card data touches the app).
export function useTip() {
  const [loading, setLoading] = useState(false)

  const tip = useCallback(async (appointmentId, amountCents) => {
    setLoading(true)
    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 500))
      setLoading(false)
      return { error: null, simulated: true }
    }
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: { amount_cents: amountCents, type: 'tip', appointment_id: appointmentId },
    })
    setLoading(false)
    if (error) return { error }
    if (data?.url) window.location.assign(data.url)
    return { error: null }
  }, [])

  return { tip, loading }
}
