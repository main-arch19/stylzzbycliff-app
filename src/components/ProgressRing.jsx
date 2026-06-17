export function ProgressRing({ progress = 0, size = 120, strokeWidth = 8, children, className = '' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference
  const center = size / 2

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C0392B" />
            <stop offset="100%" stopColor="#D4A03C" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          style={{ stroke: 'rgba(var(--c-line) / 0.12)' }}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
