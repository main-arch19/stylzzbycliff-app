import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, X, Check, Clock, AlertCircle, Upload } from 'lucide-react'
import { useCutSubmissions } from '@/hooks/useCutSubmissions'
import { formatDate } from '@/utils/helpers'

const STATUS_STYLES = {
  pending:  { bg: 'rgba(230,126,34,0.1)',  border: 'rgba(230,126,34,0.3)',  color: '#E67E22', label: 'PENDING'  },
  approved: { bg: 'rgba(39,174,96,0.1)',   border: 'rgba(39,174,96,0.3)',   color: '#27AE60', label: 'APPROVED' },
  rejected: { bg: 'rgba(231,76,60,0.1)',   border: 'rgba(231,76,60,0.3)',   color: '#E74C3C', label: 'REJECTED' },
}

export default function SubmitCut() {
  const navigate = useNavigate()
  const { submissions, loading, submitting, submitCut, uploadPhoto } = useCutSubmissions()

  const today = new Date().toISOString().split('T')[0]
  const [cutDate, setCutDate]       = useState(today)
  const [notes, setNotes]           = useState('')
  const [photoFile, setPhotoFile]   = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [formError, setFormError]   = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const fileRef = useRef(null)

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Photo must be under 5 MB.')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setFormError('')
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!cutDate) {
      setFormError('Please select a cut date.')
      return
    }

    let photoUrl = null
    if (photoFile) {
      try {
        photoUrl = await uploadPhoto(photoFile)
      } catch {
        setFormError('Photo upload failed. Try again or submit without a photo.')
        return
      }
    }

    const result = await submitCut({ cutDate, photoUrl, notes: notes.trim() || null })
    if (result?.success) {
      setSubmitted(true)
      setCutDate(today)
      setNotes('')
      removePhoto()
      setTimeout(() => setSubmitted(false), 3000)
    } else {
      setFormError(result?.message || 'Submission failed. Try again.')
    }
  }

  return (
    <div className="scroll-container pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 bg-midnight sticky top-0 z-10 border-b border-white/5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-warm-grey hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="font-display text-[24px] text-white uppercase tracking-wider leading-none">
            SUBMIT A CUT
          </div>
          <div className="font-body text-[10px] text-warm-grey mt-0.5">
            Submit your visit — we'll verify and credit your count.
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* Submission form */}
        <div className="card p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div>
              <label className="font-heading text-[10px] tracking-widest uppercase text-warm-grey block mb-1.5">
                CUT DATE
              </label>
              <input
                type="date"
                className="input"
                value={cutDate}
                max={today}
                onChange={(e) => setCutDate(e.target.value)}
                required
              />
            </div>

            {/* Photo upload */}
            <div>
              <label className="font-heading text-[10px] tracking-widest uppercase text-warm-grey block mb-1.5">
                PHOTO (OPTIONAL)
              </label>

              {photoPreview ? (
                <div className="relative w-full aspect-video rounded-[12px] overflow-hidden bg-charcoal">
                  <img
                    src={photoPreview}
                    alt="Cut preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-6 rounded-[12px] border border-dashed border-white/15 flex flex-col items-center gap-2 text-warm-grey hover:border-white/30 hover:text-white transition-all"
                >
                  <Camera size={20} />
                  <span className="font-heading text-[10px] tracking-wider uppercase">TAP TO ADD PHOTO</span>
                  <span className="font-body text-[9px]">JPG, PNG — max 5 MB</span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="font-heading text-[10px] tracking-widest uppercase text-warm-grey block mb-1.5">
                NOTES (OPTIONAL)
              </label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="e.g. mid fade, 3pm appointment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="flex items-start gap-2 text-error font-body text-[11px]">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {formError}
              </div>
            )}

            {/* Success */}
            {submitted && (
              <div className="flex items-center gap-2 text-success font-body text-[11px]">
                <Check size={13} />
                Submitted! Your barber will review it soon.
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  SUBMITTING...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  SUBMIT CUT
                </>
              )}
            </button>
          </form>
        </div>

        {/* Submission history */}
        <div>
          <div className="section-header mb-3">YOUR SUBMISSIONS</div>
          <div className="card divide-y divide-white/5">
            {loading ? (
              [1,2,3].map((i) => (
                <div key={i} className="p-3 animate-skeleton h-14" />
              ))
            ) : submissions.length === 0 ? (
              <div className="py-8 text-center">
                <div className="font-heading text-[11px] tracking-wider uppercase text-warm-grey">
                  No submissions yet.
                </div>
                <div className="font-body text-[10px] text-warm-grey mt-1">
                  Submit your first cut above.
                </div>
              </div>
            ) : (
              submissions.map((s) => {
                const st = STATUS_STYLES[s.status] || STATUS_STYLES.pending
                return (
                  <div key={s.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={11} className="text-warm-grey" />
                        <span className="font-heading text-[11px] tracking-wider uppercase text-white">
                          {formatDate(s.cut_date)}
                        </span>
                      </div>
                      <span
                        className="font-heading text-[8px] tracking-widest uppercase px-2 py-0.5 rounded-pill"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                      >
                        {st.label}
                      </span>
                    </div>

                    <div className="font-body text-[9px] text-warm-grey">
                      Submitted {formatDate(s.created_at)}
                    </div>

                    {s.status === 'rejected' && s.rejection_reason && (
                      <div className="flex items-start gap-1.5 pt-1">
                        <AlertCircle size={10} className="text-error shrink-0 mt-0.5" />
                        <span className="font-body text-[10px] text-error">
                          {s.rejection_reason}
                        </span>
                      </div>
                    )}

                    {s.photo_url && (
                      <a
                        href={s.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-heading text-[9px] tracking-wider uppercase text-clipper-red"
                      >
                        VIEW PHOTO →
                      </a>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
