import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

export default function ManageBarbers() {
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  const load = async () => {
    const { data } = await supabase.from('barbers').select('*').order('created_at')
    setBarbers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!name.trim()) { toast('Enter a name.', 'error'); return }
    setAdding(true)
    const { error } = await supabase.from('barbers').insert({ name: name.trim(), specialty: specialty.trim() || null })
    if (error) toast('Could not add barber.', 'error')
    else { toast(`${name} added!`, 'success'); setName(''); setSpecialty(''); setShowAdd(false); load() }
    setAdding(false)
  }

  const handleToggle = async (b) => {
    await supabase.from('barbers').update({ is_active: !b.is_active }).eq('id', b.id)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this barber? This will affect cut records.')) return
    await supabase.from('barbers').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-4 max-w-xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-cream uppercase tracking-wider">BARBERS</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary gap-2" style={{ height: 40, fontSize: 11 }}>
          <Plus size={14} /> ADD
        </button>
      </div>

      {showAdd && (
        <div className="card p-4 mb-5 border border-clipper-red/30 space-y-3">
          <div className="font-heading text-[12px] tracking-wider uppercase text-cream">Add Barber</div>
          <input className="input" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Specialty (optional)" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          <button onClick={handleAdd} disabled={adding} className="btn btn-primary w-full">
            {adding ? 'ADDING...' : 'ADD BARBER'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2].map((i) => <div key={i} className="card h-16 animate-skeleton" />)}</div>
      ) : (
        <div className="space-y-2">
          {barbers.map((b) => (
            <div key={b.id} className={`card p-4 flex items-center gap-3 ${!b.is_active ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-clipper-red/20 flex items-center justify-center text-lg font-bold uppercase text-clipper-red shrink-0">
                {b.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading text-[13px] font-semibold tracking-wider uppercase text-cream">{b.name}</div>
                {b.specialty && <div className="font-body text-[10px] text-warm-grey">{b.specialty}</div>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => handleToggle(b)} className="text-warm-grey hover:text-cream transition-colors">
                  {b.is_active ? <ToggleRight size={22} className="text-success" /> : <ToggleLeft size={22} />}
                </button>
                <button onClick={() => handleDelete(b.id)} className="text-warm-grey hover:text-error transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
