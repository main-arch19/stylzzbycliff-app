import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useCutSubmissions() {
  const { profile } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState(null)

  const fetchSubmissions = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('cut_submissions')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
    setSubmissions(data || [])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  // Upload a photo to Supabase Storage and return the public URL
  const uploadPhoto = useCallback(async (file) => {
    if (!profile?.id || !file) return null
    const ext      = file.name.split('.').pop()
    const path     = `${profile.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('cut-photos')
      .upload(path, file, { upsert: false })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('cut-photos').getPublicUrl(path)
    return data.publicUrl
  }, [profile?.id])

  // Submit a cut request
  const submitCut = useCallback(async ({ cutDate, photoUrl, notes }) => {
    if (!profile?.id) return { success: false, message: 'Not logged in' }
    setSubmitting(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('submit_cut_request', {
        p_customer_id: profile.id,
        p_cut_date:    cutDate,
        p_photo_url:   photoUrl || null,
        p_notes:       notes    || null,
      })
      if (rpcErr) throw rpcErr
      if (data?.success) {
        await fetchSubmissions()
      }
      return data
    } catch (err) {
      const msg = err?.message || 'Something went wrong. Try again.'
      setError(msg)
      return { success: false, message: msg }
    } finally {
      setSubmitting(false)
    }
  }, [profile?.id, fetchSubmissions])

  return {
    submissions,
    loading,
    submitting,
    error,
    submitCut,
    uploadPhoto,
    refetch: fetchSubmissions,
  }
}
