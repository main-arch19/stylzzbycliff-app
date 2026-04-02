import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const EMPTY = { name: '', description: '', icon: '🎁', cuts_required: 1, xp_bonus: 0, sort_order: 0 }

export default function ManageRewards() {
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    const { data } = await supabase.from('rewards').select('*').order('sort_order')
    setRewards(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.name || !form.cuts_required) { toast('Fill in all required fields.', 'error'); return }
    setSaving(true)
    const payload = { ...form, cuts_required: Number(form.cuts_required), xp_bonus: Number(form.xp_bonus), sort_order: Number(form.sort_order) }
    let error
    if (editId) {
      ({ error } = await supabase.from('rewards').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('rewards').insert(payload))
    }
    if (error) toast('Save failed. Try again.', 'error')
    else { toast(editId ? 'Reward updated!' : 'Reward added!', 'success'); setShowForm(false); setForm(EMPTY); setEditId(null); load() }
    setSaving(false)
  }

  const handleEdit = (r) => { setForm(r); setEditId(r.id); setShowForm(true) }

  const handleDelete = async (id) => {
    if (!confirm('Delete this reward?')) return
    await supabase.from('rewards').delete().eq('id', id)
    toast('Reward deleted.', 'info')
    load()
  }

  const handleToggleActive = async (r) => {
    await supabase.from('rewards').update({ is_active: !r.is_active }).eq('id', r.id)
    load()
  }

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-white uppercase tracking-wider">REWARDS</h1>
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY); setEditId(null) }}
          className="btn btn-primary gap-2"
          style={{ height: 40, fontSize: 11 }}
        >
          <Plus size={14} /> ADD
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-5 border border-clipper-red/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-heading text-[12px] tracking-wider uppercase text-white">{editId ? 'Edit Reward' : 'New Reward'}</div>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-warm-grey" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="section-header block mb-1.5">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Free Haircut" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Icon</label>
              <input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="💈" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Cuts Required *</label>
              <input type="number" className="input" value={form.cuts_required} onChange={(e) => setForm({ ...form, cuts_required: e.target.value })} min="1" />
            </div>
            <div className="col-span-2">
              <label className="section-header block mb-1.5">Description</label>
              <input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="section-header block mb-1.5">XP Bonus</label>
              <input type="number" className="input" value={form.xp_bonus} onChange={(e) => setForm({ ...form, xp_bonus: e.target.value })} min="0" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Sort Order</label>
              <input type="number" className="input" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} min="0" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full gap-2">
            <Check size={14} /> {saving ? 'SAVING...' : 'SAVE REWARD'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="card h-16 animate-skeleton" />)}</div>
      ) : (
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className={`card p-4 flex items-center gap-3 ${!r.is_active ? 'opacity-50' : ''}`}>
              <span className="text-xl">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-white truncate">{r.name}</div>
                <div className="font-mono text-[9px] text-accent">{r.cuts_required} cuts · +{r.xp_bonus} XP bonus</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleToggleActive(r)} className={`font-heading text-[8px] tracking-wider uppercase px-2 py-1 rounded-pill border transition-colors ${r.is_active ? 'border-success/30 text-success' : 'border-white/10 text-warm-grey'}`}>
                  {r.is_active ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => handleEdit(r)} className="text-warm-grey hover:text-white transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => handleDelete(r.id)} className="text-warm-grey hover:text-error transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
