/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A1A1A',
        secondary: '#C0392B',
        accent: '#D4A03C',
        'bg-light': '#F2EFEA',
        'bg-dark': '#111111',
        surface: '#FFFFFF',
        'surface-dark': '#1E1E1E',
        'text-primary': '#F2EFEA',
        'text-secondary': '#6B6560',
        success: '#27AE60',
        warning: '#E67E22',
        error: '#E74C3C',
        // Semantic aliases
        'clipper-red': '#C0392B',
        'gold-blade': '#D4A03C',
        'obsidian': '#1A1A1A',
        'midnight': '#111111',
        'charcoal': '#1E1E1E',
        'cream': '#F2EFEA',
        'warm-grey': '#6B6560',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        heading: ['Oswald', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display': ['30px', { lineHeight: '1.1', letterSpacing: '0.02em' }],
        'h1': ['22px', { lineHeight: '1.15', letterSpacing: '0.02em' }],
        'h2': ['18px', { lineHeight: '1.2', letterSpacing: '0.015em' }],
        'h3': ['14px', { lineHeight: '1.3', letterSpacing: '0.01em' }],
        'body-sm': ['11px', { lineHeight: '1.5' }],
        'caption': ['9px', { lineHeight: '1.4' }],
        'mono-sm': ['10px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        pill: '999px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        DEFAULT: '0 2px 12px rgba(0,0,0,0.08)',
        elevated: '0 8px 32px rgba(0,0,0,0.12)',
        glow: '0 0 20px rgba(192,57,43,0.4)',
        'glow-gold': '0 0 20px rgba(212,160,60,0.4)',
      },
      spacing: {
        unit: '8px',
      },
      height: {
        btn: '52px',
        input: '48px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(192,57,43,0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(192,57,43,0.7)' },
        },
        'count-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'spin-decel': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(var(--spin-degrees, 1800deg))' },
        },
        'prize-reveal': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '60%': { transform: 'scale(1.1)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'count-up': 'count-up 0.4s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
        'prize-reveal': 'prize-reveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backgroundImage: {
        'red-gradient': 'linear-gradient(135deg, #C0392B, #961F16)',
        'gold-gradient': 'linear-gradient(135deg, #D4A03C, #A07C2A)',
        'red-gold-gradient': 'linear-gradient(90deg, #C0392B, #D4A03C)',
        'dark-gradient': 'linear-gradient(180deg, #1E1E1E, #111111)',
      },
    },
  },
  plugins: [],
}
