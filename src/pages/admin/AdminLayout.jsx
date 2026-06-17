import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Scissors, Users, Gift, Target, UserCog, BarChart2, Tag, LogOut, Menu, X, CheckSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const NAV = [
  { path: '/admin',             label: 'LOG CUT',   icon: Scissors,    end: true },
  { path: '/admin/approvals',   label: 'APPROVALS', icon: CheckSquare           },
  { path: '/admin/customers',   label: 'CUSTOMERS', icon: Users                 },
  { path: '/admin/redeem',      label: 'REDEEM',    icon: Tag                   },
  { path: '/admin/analytics',   label: 'ANALYTICS', icon: BarChart2             },
  { path: '/admin/rewards',     label: 'REWARDS',   icon: Gift                  },
  { path: '/admin/challenges',  label: 'CHALLENGES',icon: Target                },
  { path: '/admin/barbers',     label: 'BARBERS',   icon: UserCog               },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen]         = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  // Poll pending submission count for the badge dot
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('cut_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      setPendingCount(count ?? 0)
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-dvh bg-midnight flex flex-col">
      {/* Top bar */}
      <header className="bg-charcoal border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-clipper-red/20 flex items-center justify-center">
            <span className="font-display text-[16px] text-clipper-red">S</span>
          </div>
          <div>
            <div className="font-display text-[16px] text-white tracking-widest uppercase leading-none">STYLZZ</div>
            <div className="font-heading text-[8px] tracking-widest uppercase text-warm-grey">ADMIN</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-body text-[10px] text-warm-grey hidden sm:block">
            {profile?.username}
          </span>
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-warm-grey hover:text-white transition-colors md:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-52 bg-charcoal border-r border-white/5 sticky top-14 h-[calc(100dvh-56px)]">
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map((item) => (
              <AdminNavLink key={item.path} item={item} pendingCount={item.path === '/admin/approvals' ? pendingCount : 0} />
            ))}
          </nav>
          <div className="p-3 border-t border-white/5">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full p-2 rounded-[8px] text-warm-grey hover:text-error hover:bg-error/10 transition-all font-heading text-[11px] tracking-wider uppercase"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-14 left-0 right-0 bg-charcoal border-b border-white/5 p-3 space-y-1">
              {NAV.map((item) => (
                <AdminNavLink
                  key={item.path}
                  item={item}
                  pendingCount={item.path === '/admin/approvals' ? pendingCount : 0}
                  onClick={() => setMenuOpen(false)}
                />
              ))}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full p-3 rounded-[8px] text-error font-heading text-[11px] tracking-wider uppercase mt-2"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AdminNavLink({ item, pendingCount = 0, onClick }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] font-heading text-[11px] tracking-wider uppercase transition-all duration-150
        ${isActive
          ? 'bg-clipper-red/15 text-clipper-red border border-clipper-red/20'
          : 'text-warm-grey hover:text-white hover:bg-white/5'
        }`
      }
    >
      <Icon size={14} />
      {item.label}
      {pendingCount > 0 && (
        <span
          className="ml-auto w-4 h-4 rounded-full flex items-center justify-center font-heading text-[9px]"
          style={{ background: '#C0392B', color: '#fff' }}
        >
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </NavLink>
  )
}
