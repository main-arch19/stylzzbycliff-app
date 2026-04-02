import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-24 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }) {
  const icons = {
    success: <CheckCircle size={16} className="text-success shrink-0" />,
    error: <XCircle size={16} className="text-error shrink-0" />,
    info: <Info size={16} className="text-accent shrink-0" />,
  }

  const borders = {
    success: 'border-success/30',
    error: 'border-error/30',
    info: 'border-accent/30',
  }

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 p-4 rounded-[12px]
        bg-[#1E1E1E] border ${borders[toast.type] || 'border-white/10'}
        animate-slide-up shadow-elevated
      `}
    >
      {icons[toast.type]}
      <span className="font-heading text-[11px] font-semibold tracking-wide text-text-primary uppercase flex-1">
        {toast.message}
      </span>
      <button onClick={() => onRemove(toast.id)} className="text-text-secondary hover:text-white transition-colors">
        <X size={12} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
