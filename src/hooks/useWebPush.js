import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { MOCK_MODE } from '@/lib/mockData'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

const isSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function useWebPush() {
  const { user } = useAuth()
  const [permission, setPermission] = useState(isSupported ? Notification.permission : 'denied')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reflect any existing subscription on mount.
  useEffect(() => {
    if (!isSupported || MOCK_MODE) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported) return { error: new Error('Push not supported on this device') }
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setLoading(false)
        return { error: new Error('Permission not granted') }
      }

      if (MOCK_MODE) {
        setSubscribed(true)
        setLoading(false)
        return { error: null }
      }

      if (!VAPID_PUBLIC_KEY) {
        setLoading(false)
        return { error: new Error('Missing VITE_VAPID_PUBLIC_KEY') }
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          customer_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
      )
      if (error) { setLoading(false); return { error } }

      setSubscribed(true)
      setLoading(false)
      return { error: null }
    } catch (err) {
      setLoading(false)
      return { error: err }
    }
  }, [user?.id])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      if (MOCK_MODE) {
        setSubscribed(false)
        setLoading(false)
        return { error: null }
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setLoading(false)
      return { error: null }
    } catch (err) {
      setLoading(false)
      return { error: err }
    }
  }, [])

  return { supported: isSupported, permission, subscribed, loading, subscribe, unsubscribe }
}
