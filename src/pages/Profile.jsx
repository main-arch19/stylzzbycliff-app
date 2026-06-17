import { useState } from 'react'
import { Settings, Scissors, Flame, Trophy, Calendar } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { StyleDNA } from '@/components/StyleDNA'
import { useToast } from '@/components/Toast'
import { getTierInfo } from '@/utils/helpers'
import { supabase } from '@/lib/supabase'

export default function Profile() {
  const { profile, updateProfile, signOut } = useAuth()
  const toast = useToast()
  const [showSettings, setShowSettings] = useState(false)
  const [editUsername, setEditUsername] = useState(profile?.username || '')
  const [saving, setSaving] = useState(false)

  const tierInfo = getTierInfo(profile?.membership_tier || 'bronze')

  const handleSaveUsername = async () => {
    if (!editUsername.trim() || editUsername === profile?.username) return
    setSaving(true)
    const { error } = await updateProfile({ username: editUsername.trim().toLowerCase() })
    if (error) toast('Could not update username. Maybe taken?', 'error')
    else toast('Username updated!', 'success')
    setSaving(false)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  if (!profile) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-charcoal animate-skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-charcoal animate-skeleton rounded" />
            <div className="h-3 w-20 bg-charcoal animate-skeleton rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll-container pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-midnight sticky top-0 z-10 border-b border-white/5 flex items-center justify-between">
        <h1 className="font-display text-[28px] text-white uppercase tracking-wider">PROFILE</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setShowSettings(!showSettings)} className="text-warm-grey hover:text-white transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5 pt-4">
        {/* Avatar + info */}
        <div className="flex items-center gap-4">
          {/* Avatar with red ring */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold uppercase"
              style={{
                background: 'linear-gradient(135deg, #C0392B22, #1E1E1E)',
                border: '2px solid #C0392B',
              }}
            >
              {profile.username?.[0]?.toUpperCase() || '?'}
            </div>
          </div>

          <div>
            <div className="font-display text-[22px] text-white uppercase tracking-wide leading-tight">
              {profile.username}
            </div>
            {profile.full_name && (
              <div className="font-body text-[11px] text-warm-grey">{profile.full_name}</div>
            )}
            <span
              className="inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-pill font-heading text-[9px] font-semibold tracking-widest uppercase"
              style={{ background: tierInfo.bg, color: tierInfo.color }}
            >
              {tierInfo.label}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: <Scissors size={12} className="text-clipper-red" />, value: profile.total_cuts, label: 'CUTS' },
            { icon: <span className="text-accent font-mono text-[10px]">XP</span>, value: profile.total_xp, label: 'TOTAL' },
            { icon: <Flame size={12} className="text-warning" />, value: profile.current_streak, label: 'STREAK' },
            { icon: <Trophy size={12} className="text-accent" />, value: profile.longest_streak, label: 'BEST' },
          ].map((stat) => (
            <div key={stat.label} className="card p-3 flex flex-col items-center gap-1 text-center">
              {stat.icon}
              <div className="font-display text-[18px] text-white leading-none">{stat.value}</div>
              <div className="font-heading text-[7px] tracking-widest uppercase text-warm-grey">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Style DNA */}
        <div>
          <div className="section-header mb-3">STYLE DNA</div>
          <StyleDNA />
        </div>

        {/* Your Barber */}
        <div>
          <div className="section-header mb-3">YOUR BARBER</div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-charcoal border border-clipper-red/30 flex items-center justify-center shrink-0">
              <span className="font-display text-[24px] text-clipper-red">C</span>
            </div>
            <div className="flex-1">
              <div className="font-heading text-[15px] font-semibold tracking-wider uppercase text-white">CLIFF</div>
              <div className="font-body text-[10px] text-warm-grey">Master Barber · Fades & Line-Ups</div>
              <div className="flex gap-0.5 mt-1">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className="text-accent text-[10px]">★</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <div>
            <div className="section-header mb-3">SETTINGS</div>
            <div className="card p-4 space-y-4">
              <div>
                <label className="section-header block mb-2">Change Username</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="new username"
                  />
                  <button
                    onClick={handleSaveUsername}
                    disabled={saving}
                    className="btn btn-primary px-4 shrink-0"
                    style={{ height: 48, minWidth: 0, padding: '0 16px' }}
                  >
                    {saving ? '...' : 'SAVE'}
                  </button>
                </div>
              </div>

              <div className="divider" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="section-header mb-1">Appearance</div>
                  <div className="font-body text-[9px] text-warm-grey">
                    {isLight ? 'Light mode' : 'Dark mode'}
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  role="switch"
                  aria-checked={isLight}
                  className="relative w-12 h-7 rounded-pill border border-line/15 bg-line/5 transition-colors"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-clipper-red text-white transition-transform ${isLight ? 'translate-x-5' : ''}`}
                  >
                    {isLight ? <Sun size={13} /> : <Moon size={13} />}
                  </span>
                </button>
              </div>

              <div className="divider" />

              <div>
                <div className="section-header mb-2">Referral Code</div>
                <div className="font-display text-[20px] text-clipper-red tracking-[4px]">
                  {profile.referral_code}
                </div>
                <div className="font-body text-[9px] text-warm-grey mt-0.5">
                  Share this code to earn +200 XP per referral
                </div>
              </div>

              <div className="divider" />

              <button
                onClick={handleSignOut}
                className="btn btn-ghost w-full text-error border-error/30"
              >
                SIGN OUT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
