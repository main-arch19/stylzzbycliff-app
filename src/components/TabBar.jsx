import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/',        label: 'HOME',    icon: '⚡' },
  { path: '/rewards', label: 'REWARDS', icon: '🏆' },
  { path: '/profile', label: 'PROFILE', icon: '👤' },
  { path: '/social',  label: 'SOCIAL',  icon: '👥' },
]

export function TabBar() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-midnight border-t border-white/5 safe-bottom">
      <div className="flex">
        {TABS.map((tab) => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path)

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`
                flex-1 flex flex-col items-center justify-center py-3 gap-1 relative
                transition-colors duration-200
                ${isActive ? 'text-clipper-red' : 'text-warm-grey'}
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-clipper-red rounded-b-full" />
              )}
              <span className="text-base leading-none">{tab.icon}</span>
              <span
                className="font-heading font-semibold leading-none"
                style={{ fontSize: 8, letterSpacing: '1.5px' }}
              >
                {tab.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
