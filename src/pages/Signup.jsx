import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

export default function Signup() {
  const { signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [showReferral, setShowReferral] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !email || !password) {
      toast('Fill in all fields, King.', 'error')
      return
    }
    if (password.length < 6) {
      toast('Password needs at least 6 characters.', 'error')
      return
    }
    if (username.length < 3) {
      toast('Username needs at least 3 characters.', 'error')
      return
    }

    setLoading(true)

    const { data, error } = await signUp({
      email,
      password,
      username: username.toLowerCase().replace(/\s+/g, '_'),
      fullName: username,
    })

    if (error) {
      const msg = error.message.includes('already')
        ? 'That email is already registered. Log in instead.'
        : 'Something went wrong, King. Try again.'
      toast(msg, 'error')
      setLoading(false)
      return
    }

    // Apply referral code if provided
    if (referralCode.trim() && data?.user) {
      await supabase.rpc('use_referral_code', {
        p_new_customer_id: data.user.id,
        p_referral_code: referralCode.trim(),
      })
    }

    toast("You're in the fam now. Welcome to Stylzz!", 'success')
    navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-midnight flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-charcoal border-2 border-clipper-red/30 flex items-center justify-center mb-3 overflow-hidden">
          <span className="font-display text-[36px] text-clipper-red">S</span>
        </div>
        <h1 className="font-display text-[36px] text-cream tracking-widest uppercase">GET FRESH</h1>
        <p className="font-heading text-[10px] tracking-[4px] uppercase text-warm-grey mt-1">
          Create Your Account
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="signup-username" className="section-header block mb-2">Username</label>
          <input
            id="signup-username"
            type="text"
            className="input"
            placeholder="freshking, cliffsfav..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
          />
        </div>

        <div>
          <label htmlFor="signup-email" className="section-header block mb-2">Email</label>
          <input
            id="signup-email"
            type="email"
            className="input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="section-header block mb-2">Password</label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPass ? 'text' : 'password'}
              className="input pr-12"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              aria-pressed={showPass}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-grey hover:text-cream transition-colors"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Referral code toggle */}
        <button
          type="button"
          onClick={() => setShowReferral(!showReferral)}
          className="flex items-center gap-2 text-warm-grey hover:text-cream transition-colors"
        >
          {showReferral ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span className="font-heading text-[10px] tracking-wider uppercase">
            Have a referral code?
          </span>
        </button>

        {showReferral && (
          <div>
            <input
              type="text"
              aria-label="Referral code"
              className="input font-mono uppercase tracking-widest"
              placeholder="XXXXXXXX"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <div className="font-body text-[9px] text-warm-grey mt-1">
              You'll get +100 XP · Your friend gets +200 XP
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2"
        >
          {loading ? 'CREATING...' : 'GET FRESH'}
        </button>
      </form>

      {/* Log in link */}
      <div className="mt-8 text-center">
        <span className="font-body text-[11px] text-warm-grey">Already fresh? </span>
        <Link
          to="/login"
          className="font-heading text-[11px] tracking-wider uppercase text-clipper-red hover:text-cream transition-colors"
        >
          Log In
        </Link>
      </div>
    </div>
  )
}
