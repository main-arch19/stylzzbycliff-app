import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

/**
 * Compact icon button that flips between light and dark themes.
 * Drop into any header. Pass className to tweak spacing if needed.
 */
export default function ThemeToggle({ className = '' }) {
  const { isLight, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`w-9 h-9 rounded-full flex items-center justify-center text-warm-grey hover:text-clipper-red bg-line/5 border border-line/10 transition-colors ${className}`}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
