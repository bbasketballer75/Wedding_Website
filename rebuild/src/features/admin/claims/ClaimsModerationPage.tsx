/**
 * `/admin/claims` — photo/face claim moderation, ported from the frozen
 * `src/pages/admin/ClaimsModeration.tsx`.
 *
 * Frozen parity: Pending/Approved/Rejected tabs with the pending-count badge,
 * claim cards (status strip, thumbnail + external link, claim type badge, guest
 * name/email, face-tagging line, rejection reason), approve action and the
 * reject-with-reason modal. Approve marks the claim approved (the real data layer
 * also verifies the identity and syncs face names — see `data.ts` wiring TODO);
 * reject requires a non-empty reason and is recorded via `claim_rejected`.
 *
 * DELTAS (W7-1 report): inline result message instead of the toast provider, and
 * the rejection reason is validated in the modal (the frozen form relied on the
 * browser's `required` attribute only).
 */
import {
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Mail,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { useAdminApi } from '../api-context'
import { useAdminAuth } from '../auth-context'
import { getAdminAuditActor, type AdminClaim } from '../data'
import { formatClaimDate } from '../utils'

type ClaimTab = 'pending' | 'approved' | 'rejected'

const CLAIM_TABS: ReadonlyArray<{ value: ClaimTab; label: string }> = [
  { value: 'pending', label: 'Pending Claims' },
  { value: 'approved', label: 'Approved Claims' },
  { value: 'rejected', label: 'Rejected Claims' },
]

const EMPTY_COPY: Record<ClaimTab, { title: string; description: string }> = {
  pending: {
    title: 'No Pending Claims',
    description: 'All guest identity verification and photo claims are up to date! Great work.',
  },
  approved: {
    title: 'No Approved Claims Yet',
    description: 'Approved claims will appear here once guest identities are confirmed.',
  },
  rejected: {
    title: 'No Rejected Claims',
    description: 'Rejected claims list is currently clear.',
  },
}

function claimTypeLabel(claim: AdminClaim): string {
  return claim.claimType === 'face' ? 'Face Tag Claim' : 'Photo Upload Claim'
}

export function ClaimsModerationPage() {
  const api = useAdminApi()
  const auth = useAdminAuth()
  const actor = getAdminAuditActor(auth.user)

  const [activeTab, setActiveTab] = useState<ClaimTab>('pending')
  const [claimsByStatus, setClaimsByStatus] = useState<Record<ClaimTab, AdminClaim[]>>({
    pending: [],
    approved: [],
    rejected: [],
  })
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [rejectingClaim, setRejectingClaim] = useState<AdminClaim | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    tone: 'success' | 'error' | 'info'
    text: string
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const loadClaims = useCallback((): Promise<void> => {
    return Promise.all([
      api.fetchClaims('pending'),
      api.fetchClaims('approved'),
      api.fetchClaims('rejected'),
    ])
      .then(([pending, approved, rejected]) => {
        setClaimsByStatus({ pending, approved, rejected })
      })
      .catch(() => {
        setMessage({ tone: 'error', text: 'Failed to load photo claims. Please try again.' })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [api])

  useEffect(() => {
    void loadClaims()
  }, [loadClaims])

  const handleApprove = async (claim: AdminClaim) => {
    setSubmittingId(claim.id)
    try {
      await api.moderateClaim({ id: claim.id, decision: 'approve', actor })
      setMessage({
        tone: 'success',
        text: `Claim for ${claim.identity?.displayName ?? 'the guest'} successfully approved!`,
      })
      await loadClaims()
      panelRef.current?.focus()
    } catch {
      setMessage({ tone: 'error', text: 'Failed to approve claim. Please try again.' })
    } finally {
      setSubmittingId(null)
    }
  }

  const handleRejectSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rejectingClaim) return

    const reason = rejectionReason.trim()
    if (!reason) {
      setReasonError('Enter a rejection reason before confirming.')
      return
    }

    setReasonError(null)
    setSubmittingId(rejectingClaim.id)
    const claimId = rejectingClaim.id
    const guestName = rejectingClaim.identity?.displayName ?? 'Guest'

    try {
      await api.moderateClaim({ id: claimId, decision: 'reject', reason, actor })
      setRejectingClaim(null)
      setRejectionReason('')
      setMessage({ tone: 'info', text: `Claim for ${guestName} rejected.` })
      await loadClaims()
      panelRef.current?.focus()
    } catch {
      setMessage({ tone: 'error', text: 'Failed to reject claim. Please try again.' })
      setRejectingClaim(null)
    } finally {
      setSubmittingId(null)
    }
  }

  const activeClaims = claimsByStatus[activeTab]
  const pendingCount = claimsByStatus.pending.length

  return (
    <div className='space-y-6'>
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className='flex border-b border-gold-500/10 pb-px'>
        <div className='flex gap-4' role='tablist' aria-label='Claim status'>
          {CLAIM_TABS.map(tab => (
            <button
              key={tab.value}
              type='button'
              role='tab'
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`relative py-3 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'text-gold-700'
                  : 'text-charcoal-500 hover:text-charcoal-800'
              }`}
            >
              {tab.label}
              {tab.value === 'pending' && pendingCount > 0 && (
                <span className='ml-2 inline-flex items-center rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800 animate-pulse'>
                  {pendingCount}
                </span>
              )}
              {activeTab === tab.value && (
                <motion.div
                  layoutId='activeClaimTab'
                  className='absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500'
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div ref={panelRef} tabIndex={-1} role='tabpanel' className='outline-none space-y-4'>
        {loading ? (
          <div className='flex flex-col items-center justify-center py-20 border border-gold-100 bg-white/70 rounded-xl'>
            <Loader2 className='w-10 h-10 text-gold-500 animate-spin' aria-hidden='true' />
            <p className='mt-4 text-sm text-charcoal-500 font-sans'>Loading claims database...</p>
          </div>
        ) : activeClaims.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 px-4 border border-gold-100 bg-white/70 rounded-xl text-center'>
            <div className='w-12 h-12 rounded-full bg-cream-50 flex items-center justify-center text-gold-500 border border-gold-200/30 mb-4'>
              <ShieldCheck className='w-6 h-6' aria-hidden='true' />
            </div>
            <h3 className='font-serif text-lg font-semibold text-charcoal-900'>
              {EMPTY_COPY[activeTab].title}
            </h3>
            <p className='mt-1 max-w-sm text-sm text-charcoal-500 font-sans'>
              {EMPTY_COPY[activeTab].description}
            </p>
          </div>
        ) : (
          activeClaims.map(claim => {
            const identity = claim.identity
            const photo = claim.photo
            const thumbnailSrc = photo?.thumbnail || photo?.url

            return (
              <motion.div
                key={claim.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className='flex flex-col md:flex-row gap-5 p-5 border border-gold-100 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group'
                data-testid='claim-card'
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    claim.status === 'pending'
                      ? 'bg-amber-400'
                      : claim.status === 'approved'
                        ? 'bg-emerald-500'
                        : 'bg-rose-400'
                  }`}
                  aria-hidden='true'
                />

                <div className='flex-shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-lg overflow-hidden border border-gold-200/20 bg-cream-50 relative flex items-center justify-center'>
                  {thumbnailSrc ? (
                    <>
                      <img
                        src={thumbnailSrc}
                        alt='Claimed media'
                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                      />
                      <a
                        href={photo?.url ?? thumbnailSrc}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='absolute inset-0 bg-charcoal-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200'
                        title='Open full photo in new tab'
                        aria-label='Open full photo in new tab'
                      >
                        <ExternalLink className='w-5 h-5' aria-hidden='true' />
                      </a>
                    </>
                  ) : (
                    <ImageIcon className='w-8 h-8 text-gold-300' aria-hidden='true' />
                  )}
                </div>

                <div className='flex-1 min-w-0 space-y-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-cream-100 text-gold-800 border border-gold-200/20 uppercase tracking-wider font-sans'>
                      {claimTypeLabel(claim)}
                    </span>
                    <span className='text-xs text-charcoal-400 font-sans flex items-center gap-1'>
                      <Clock className='w-3.5 h-3.5' aria-hidden='true' />
                      {formatClaimDate(claim.createdAt)}
                    </span>
                  </div>

                  <h4 className='font-serif text-lg font-semibold text-charcoal-900 flex items-center gap-1.5 mt-1'>
                    <User className='w-4 h-4 text-gold-500' aria-hidden='true' />
                    {identity?.displayName || 'Anonymous Guest'}
                  </h4>

                  <div className='text-sm text-charcoal-600 font-sans flex flex-col gap-1 sm:flex-row sm:gap-4 mt-0.5'>
                    <span className='flex items-center gap-1.5'>
                      <Mail className='w-3.5 h-3.5 text-charcoal-400' aria-hidden='true' />
                      {identity?.email ? (
                        <a
                          href={`mailto:${identity.email}`}
                          className='hover:text-gold-600 hover:underline'
                        >
                          {identity.email}
                        </a>
                      ) : (
                        'No email'
                      )}
                    </span>
                    {claim.claimType === 'face' && claim.faceId && (
                      <span className='flex items-center gap-1.5 text-gold-700 font-medium'>
                        <ShieldCheck className='w-3.5 h-3.5' aria-hidden='true' />
                        Tagging Face: {identity?.displayName}
                      </span>
                    )}
                  </div>

                  {claim.status === 'rejected' && claim.rejectionReason && (
                    <div className='mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-sans flex items-start gap-2'>
                      <XCircle className='w-4 h-4 flex-shrink-0 mt-0.5' aria-hidden='true' />
                      <div>
                        <span className='font-semibold'>Rejection Reason:</span>{' '}
                        {claim.rejectionReason}
                      </div>
                    </div>
                  )}
                </div>

                <div className='flex-shrink-0 flex md:flex-col items-stretch md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-gold-500/10 md:pl-5'>
                  {claim.status === 'pending' ? (
                    <>
                      <Button
                        size='sm'
                        className='bg-emerald-600 hover:bg-emerald-700 text-white border-none flex-1 md:flex-none justify-center'
                        disabled={submittingId === claim.id}
                        onClick={() => void handleApprove(claim)}
                        ariaLabel={`Approve claim for ${identity?.displayName ?? 'guest'}`}
                      >
                        {submittingId === claim.id ? (
                          <Loader2 className='w-4 h-4 animate-spin' aria-hidden='true' />
                        ) : (
                          <>
                            <Check className='w-4 h-4 mr-1.5' aria-hidden='true' />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size='sm'
                        variant='secondary'
                        className='border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 flex-1 md:flex-none justify-center'
                        disabled={submittingId === claim.id}
                        onClick={() => {
                          setRejectingClaim(claim)
                          setRejectionReason('')
                          setReasonError(null)
                        }}
                        ariaLabel={`Reject claim for ${identity?.displayName ?? 'guest'}`}
                      >
                        <X className='w-4 h-4 mr-1.5' aria-hidden='true' />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <div className='flex items-center gap-2 text-sm'>
                      {claim.status === 'approved' ? (
                        <div className='flex items-center gap-1.5 text-emerald-600 font-medium font-sans'>
                          <CheckCircle className='w-5 h-5' aria-hidden='true' />
                          Approved
                        </div>
                      ) : (
                        <div className='flex items-center gap-1.5 text-rose-600 font-medium font-sans'>
                          <XCircle className='w-5 h-5' aria-hidden='true' />
                          Rejected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      <AnimatePresence>
        {rejectingClaim && (
          <div
            className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-sm'
            role='presentation'
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role='dialog'
              aria-modal='true'
              aria-labelledby='reject-claim-title'
              className='relative w-full max-w-md bg-white border border-gold-200 rounded-xl shadow-xl overflow-hidden z-10 flex flex-col'
            >
              <div className='flex items-center justify-between p-4 border-b border-gold-500/10 bg-cream-50/50'>
                <h3
                  id='reject-claim-title'
                  className='font-serif text-lg font-semibold text-charcoal-900 flex items-center gap-2'
                >
                  <XCircle className='w-5 h-5 text-rose-500' aria-hidden='true' />
                  Reject Verification Claim
                </h3>
                <button
                  type='button'
                  onClick={() => setRejectingClaim(null)}
                  aria-label='Close rejection dialog'
                  className='p-1 rounded-full text-charcoal-400 hover:text-charcoal-800 hover:bg-charcoal-100 transition-colors'
                >
                  <X className='w-4 h-4' aria-hidden='true' />
                </button>
              </div>

              <form onSubmit={event => void handleRejectSubmit(event)} className='p-4 space-y-4'>
                <p className='text-xs text-charcoal-500 leading-normal'>
                  Provide a clear reason why the photo/face claim for{' '}
                  <span className='font-semibold text-charcoal-800'>
                    {rejectingClaim.identity?.displayName}
                  </span>{' '}
                  ({rejectingClaim.identity?.email}) is being rejected. This is logged to the audit
                  log.
                </p>

                <div className='space-y-1.5'>
                  <label
                    htmlFor='rejection-reason'
                    className='block text-xs font-semibold uppercase tracking-wider text-charcoal-600'
                  >
                    Rejection Reason
                  </label>
                  <textarea
                    id='rejection-reason'
                    rows={3}
                    aria-required='true'
                    placeholder='E.g., Email address matches, but the uploaded photos do not match this guest profile / face belongs to another guest.'
                    value={rejectionReason}
                    onChange={event => {
                      setRejectionReason(event.target.value)
                      if (reasonError) setReasonError(null)
                    }}
                    aria-invalid={reasonError !== null}
                    aria-describedby={reasonError ? 'rejection-reason-error' : undefined}
                    className='w-full text-sm rounded-lg border border-gold-200 p-2.5 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500 bg-cream-50/20'
                  />
                  {reasonError && (
                    <p id='rejection-reason-error' role='alert' className='text-xs text-rose-700'>
                      {reasonError}
                    </p>
                  )}
                </div>

                <div className='flex items-center justify-end gap-2 pt-2 border-t border-gold-500/10'>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    onClick={() => setRejectingClaim(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    size='sm'
                    className='bg-rose-600 hover:bg-rose-700 text-white border-none'
                    disabled={submittingId === rejectingClaim.id}
                  >
                    Confirm Rejection
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
