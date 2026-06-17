import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

// Pages
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Home from '@/pages/Home'
import Rewards from '@/pages/Rewards'
import Profile from '@/pages/Profile'
import Social from '@/pages/Social'
import SubmitCut from '@/pages/SubmitCut'
import AdminLayout from '@/pages/admin/AdminLayout'
import LogCut from '@/pages/admin/LogCut'
import Customers from '@/pages/admin/Customers'
import ManageRewards from '@/pages/admin/ManageRewards'
import ManageChallenges from '@/pages/admin/ManageChallenges'
import ManageBarbers from '@/pages/admin/ManageBarbers'
import Analytics from '@/pages/admin/Analytics'
import RedeemReward from '@/pages/admin/RedeemReward'
import CutApprovals from '@/pages/admin/CutApprovals'

// Components
import { TabBar } from '@/components/TabBar'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// PWA install prompt on second visit
function usePWAInstallPrompt() {
  useEffect(() => {
    const visits = Number(localStorage.getItem('pwa_visits') || 0) + 1
    localStorage.setItem('pwa_visits', visits)

    let deferredPrompt = null

    const handler = (e) => {
      e.preventDefault()
      deferredPrompt = e
      if (visits >= 2) {
        setTimeout(() => {
          if (deferredPrompt) {
            deferredPrompt.prompt()
            deferredPrompt.userChoice.then(() => { deferredPrompt = null })
          }
        }, 3000)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
}

// Layout wrapper for customer app (adds TabBar)
function CustomerLayout({ children }) {
  return (
    <div className="min-h-dvh bg-midnight flex flex-col">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      <TabBar />
    </div>
  )
}

export default function App() {
  usePWAInstallPrompt()
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh bg-midnight flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-2 border-clipper-red border-t-transparent rounded-full animate-spin" />
          <div className="font-display text-[20px] text-cream tracking-widest">STYLZZ</div>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />

      {/* Customer app */}
      <Route path="/" element={
        <ProtectedRoute>
          <CustomerLayout><Home /></CustomerLayout>
        </ProtectedRoute>
      } />
      <Route path="/rewards" element={
        <ProtectedRoute>
          <CustomerLayout><Rewards /></CustomerLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <CustomerLayout><Profile /></CustomerLayout>
        </ProtectedRoute>
      } />
      <Route path="/social" element={
        <ProtectedRoute>
          <CustomerLayout><Social /></CustomerLayout>
        </ProtectedRoute>
      } />
      <Route path="/submit-cut" element={
        <ProtectedRoute>
          <CustomerLayout><SubmitCut /></CustomerLayout>
        </ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute requireRole="barber">
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<LogCut />} />
        <Route path="approvals" element={<CutApprovals />} />
        <Route path="customers" element={<Customers />} />
        <Route path="rewards" element={<ManageRewards />} />
        <Route path="challenges" element={<ManageChallenges />} />
        <Route path="barbers" element={<ManageBarbers />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="redeem" element={<RedeemReward />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
