import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'

export default function Login() {
  const { signIn } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { toast('Fill in all fields, King.', 'error'); return }
    setLoading(true)
    const { error } = await signIn({ email, password })
    if (error) {
      toast(error.message.includes('Invalid') ? 'Wrong email or password. Try again.' : 'Something went wrong, King. Try again.', 'error')
    } else {
      navigate(from, { replace: true })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-midnight flex flex-col items-center justify-center px-6 py-12">
      {/* Logo area */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-24 h-24 rounded-full bg-charcoal border-2 border-clipper-red/30 flex items-center justify-center mb-4 overflow-hidden">
          <span className="font-display text-[40px] text-clipper-red">S</span>
        </div>
        <h1 className="font-display text-[42px] text-white tracking-widest uppercase">STYLZZ</h1>
        <p className="font-heading text-[11px] tracking-[4px] uppercase text-accent mt-1">
          Stay Fresh. Stay Sharp.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="section-header block mb-2">Email</label>
          <input
            type="email"
            className="input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label className="section-header block mb-2">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              className="input pr-12"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-grey hover:text-white transition-colors"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2"
        >
          {loading ? 'LOCKING IN...' : 'LOCK IN'}
        </button>
      </form>

      {/* Sign up link */}
      <div className="mt-8 text-center">
        <span className="font-body text-[11px] text-warm-grey">New to Stylzz? </span>
        <Link
          to="/signup"
          className="font-heading text-[11px] tracking-wider uppercase text-clipper-red hover:text-white transition-colors"
        >
          Create Account
        </Link>
      </div>
    </div>
  )
}
