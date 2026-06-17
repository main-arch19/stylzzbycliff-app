import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { timeUntil } from '@/utils/helpers'

const TYPES = ['cuts_in_period', 'try_new_style', 'referral', 'check_in']
const EMPTY = { name: '', description: '', challenge_type: 'cuts_in_period', target_value: 3, reward_description: '', reward_xp: 0, starts_at: '', ends_at: '' }

export default function ManageChallenges() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    const { data } = await supabase.from('challenges').select('*').order('ends_at')
    setChallenges(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.name || !form.starts_at || !form.ends_at) { toast('Fill in all required fields.', 'error'); return }
    setSaving(true)
    const payload = { ...form, target_value: Number(form.target_value), reward_xp: Number(form.reward_xp) }
    let error
    if (editId) {
      ({ error } = await supabase.from('challenges').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('challenges').insert({ ...payload, is_active: true }))
    }
    if (error) toast('Save failed.', 'error')
    else { toast(editId ? 'Challenge updated!' : 'Challenge created!', 'success'); setShowForm(false); setForm(EMPTY); setEditId(null); load() }
    setSaving(false)
  }

  const handleEdit = (c) => {
    setForm({
      ...c,
      starts_at: c.starts_at?.slice(0, 16),
      ends_at: c.ends_at?.slice(0, 16),
    })
    setEditId(c.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this challenge?')) return
    await supabase.from('challenges').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-cream uppercase tracking-wider">CHALLENGES</h1>
        <button onClick={() => { setShowForm(true); setForm(EMPTY); setEditId(null) }} className="btn btn-primary gap-2" style={{ height: 40, fontSize: 11 }}>
          <Plus size={14} /> ADD
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-5 border border-clipper-red/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-heading text-[12px] tracking-wider uppercase text-cream">{editId ? 'Edit' : 'New'} Challenge</div>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-warm-grey" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="section-header block mb-1.5">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="section-header block mb-1.5">Description</label>
              <input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="section-header block mb-1.5">Type</label>
              <select className="input bg-charcoal" value={form.challenge_type} onChange={(e) => setForm({ ...form, challenge_type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="section-header block mb-1.5">Target</label>
              <input type="number" className="input" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} min="1" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Reward XP</label>
              <input type="number" className="input" value={form.reward_xp} onChange={(e) => setForm({ ...form, reward_xp: e.target.value })} min="0" />
            </div>
            <div className="col-span-2">
              <label className="section-header block mb-1.5">Reward Description</label>
              <input className="input" value={form.reward_description || ''} onChange={(e) => setForm({ ...form, reward_description: e.target.value })} />
            </div>
            <div>
              <label className="section-header block mb-1.5">Starts *</label>
              <input type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <label className="section-header block mb-1.5">Ends *</label>
              <input type="datetime-local" className="input" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full">
            {saving ? 'SAVING...' : 'SAVE CHALLENGE'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="card h-16 animate-skeleton" />)}</div>
      ) : (
        <div className="space-y-2">
          {challenges.map((c) => (
            <div key={c.id} className={`card p-4 flex items-center gap-3 ${!c.is_active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream truncate">{c.name}</div>
                <div className="flex gap-2 mt-0.5">
                  <span className="font-mono text-[9px] text-warm-grey">{c.challenge_type}</span>
                  <span className="font-mono text-[9px] text-warm-grey">·</span>
                  <span className="font-mono text-[9px] text-accent">+{c.reward_xp} XP</span>
                  <span className="font-mono text-[9px] text-warm-grey">·</span>
                  <span className="font-mono text-[9px] text-clipper-red">{timeUntil(c.ends_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleEdit(c)} className="text-warm-grey hover:text-cream transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => handleDelete(c.id)} className="text-warm-grey hover:text-error transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
