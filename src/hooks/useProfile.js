import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useProfile() {
  const { user, profile: authProfile, refreshProfile } = useAuth()
  const [profile, setProfile] = useState(authProfile)
  const [loading, setLoading] = useState(!authProfile)
  const [error, setError] = useState(null)

  // Keep in sync with auth context profile
  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile)
      setLoading(false)
    }
  }, [authProfile])

  // Realtime subscription to own profile row
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          setProfile(payload.new)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id])

  const updateProfile = useCallback(async (updates) => {
    if (!user?.id) return { error: new Error('Not authenticated') }
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (err) { setError(err); return { error: err } }
    setProfile(data)
    return { data }
  }, [user?.id])

  return { profile, loading, error, updateProfile, refreshProfile }
}
