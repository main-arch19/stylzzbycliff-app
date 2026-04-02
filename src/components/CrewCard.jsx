import { useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { useCrew } from '@/hooks/useCrew'
import { useToast } from './Toast'
import { supabase } from '@/lib/supabase'

export function CrewCard() {
  const { crew, members, loading, isCaptain, createCrew, refetch } = useCrew()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [crewName, setCrewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviting, setInviting] = useState(false)

  const handleCreateCrew = async () => {
    if (!crewName.trim()) return
    setCreating(true)
    const { error } = await createCrew(crewName.trim())
    if (error) toast('Could not create crew. Try again.', 'error')
    else { toast('Crew created! Invite your squad.', 'success'); setShowCreate(false) }
    setCreating(false)
  }

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return
    setInviting(true)
    // Look up profile by username
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', inviteUsername.trim().toLowerCase())
      .single()

    if (!profile) {
      toast('Username not found, King.', 'error')
      setInviting(false)
      return
    }

    const { error } = await supabase
      .from('crew_members')
      .insert({ crew_id: crew.id, member_id: profile.id })

    if (error) toast('Could not invite. Maybe already in crew?', 'error')
    else { toast(`${inviteUsername} invited to the crew!`, 'success'); setInviteUsername(''); refetch() }
    setInviting(false)
  }

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="h-4 w-32 bg-charcoal animate-skeleton rounded" />
        <div className="h-3 w-full bg-charcoal animate-skeleton rounded" />
      </div>
    )
  }

  if (!crew) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Users size={20} className="text-warm-grey" />
          <div>
            <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-white">YOUR CREW</div>
            <div className="font-body text-[10px] text-warm-grey mt-0.5">No crew yet. Start one.</div>
          </div>
        </div>

        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="btn btn-primary w-full">
            START A CREW
          </button>
        ) : (
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Crew name (e.g. Fresh Fades FC)"
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
            />
            <button onClick={handleCreateCrew} disabled={creating} className="btn btn-primary w-full">
              {creating ? 'CREATING...' : 'CREATE CREW'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-[18px] text-white uppercase">{crew.name}</div>
          <div className="font-body text-[10px] text-warm-grey">{members.length} member{members.length !== 1 ? 's' : ''}</div>
        </div>
        {isCaptain && <span className="badge badge-premium">CAPTAIN</span>}
      </div>

      {/* Members */}
      <div className="space-y-2 mb-4">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 py-1">
            <div className="w-7 h-7 rounded-full bg-charcoal border border-white/10 flex items-center justify-center text-[11px] uppercase font-bold text-warm-grey">
              {m.profiles?.username?.[0] || '?'}
            </div>
            <span className="font-heading text-[12px] font-medium tracking-wide uppercase text-white flex-1">
              {m.profiles?.username}
            </span>
            <span className="font-mono text-[9px] text-accent">{m.profiles?.total_xp?.toLocaleString()} XP</span>
          </div>
        ))}
      </div>

      {/* Invite (captain only) */}
      {isCaptain && (
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Username to invite..."
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="btn btn-primary px-4 shrink-0"
            style={{ height: 48, minWidth: 0 }}
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
