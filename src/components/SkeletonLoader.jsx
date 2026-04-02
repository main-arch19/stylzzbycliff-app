export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 space-y-3 ${className}`}>
      <div className="h-4 w-32 bg-charcoal animate-skeleton rounded" />
      <div className="h-3 w-full bg-charcoal animate-skeleton rounded" />
      <div className="h-3 w-3/4 bg-charcoal animate-skeleton rounded" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-10 h-10 rounded-full bg-charcoal animate-skeleton shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 bg-charcoal animate-skeleton rounded" />
        <div className="h-2 w-20 bg-charcoal animate-skeleton rounded" />
      </div>
      <div className="h-3 w-12 bg-charcoal animate-skeleton rounded" />
    </div>
  )
}

export function SkeletonRing({ size = 100 }) {
  return (
    <div
      className="rounded-full bg-charcoal animate-skeleton shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

export function SkeletonText({ width = 'full', height = 3, className = '' }) {
  const widthClass = width === 'full' ? 'w-full' : `w-${width}`
  const heightClass = `h-${height}`
  return <div className={`${heightClass} ${widthClass} bg-charcoal animate-skeleton rounded ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <SkeletonCard />
      <SkeletonCard />
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}
