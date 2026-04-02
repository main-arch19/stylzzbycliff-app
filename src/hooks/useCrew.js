import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useCrew() {
  const { user } = useAuth()
  const [crew, setCrew] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCrew = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)

    // Check if user is a captain
    const { data: captainCrew } = await supabase
      .from('crews')
      .select('*')
      .eq('captain_id', user.id)
      .maybeSingle()

    // Check if user is a member
    const { data: memberOf } = await supabase
      .from('crew_members')
      .select('crew_id, crews(*)')
      .eq('member_id', user.id)
      .maybeSingle()

    const foundCrew = captainCrew || memberOf?.crews || null
    setCrew(foundCrew)

    if (foundCrew) {
      const { data: membersData } = await supabase
        .from('crew_members')
        .select('*, profiles!member_id(username, avatar_url, total_xp, membership_tier)')
        .eq('crew_id', foundCrew.id)
      setMembers(membersData || [])
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchCrew() }, [fetchCrew])

  const createCrew = async (name) => {
    if (!user?.id) return { error: new Error('Not authenticated') }
    const { data, error: err } = await supabase
      .from('crews')
      .insert({ name, captain_id: user.id })
      .select()
      .single()
    if (!err) await fetchCrew()
    return { data, error: err }
  }

  const inviteMember = async (profileId) => {
    if (!crew?.id) return { error: new Error('No crew found') }
    const { data, error: err } = await supabase
      .from('crew_members')
      .insert({ crew_id: crew.id, member_id: profileId })
      .select()
      .single()
    if (!err) await fetchCrew()
    return { data, error: err }
  }

  const isCaptain = crew?.captain_id === user?.id

  return { crew, members, loading, error, isCaptain, createCrew, inviteMember, refetch: fetchCrew }
}
