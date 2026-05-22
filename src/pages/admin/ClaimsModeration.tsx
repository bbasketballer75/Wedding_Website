import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  User,
  Mail,
  Check,
  X,
  Image as ImageIcon,
  ExternalLink,
  AlertTriangle,
  Loader2,
  XCircle,
  MessageSquare
} from 'lucide-react'
import {
  fetchPendingClaims,
  fetchApprovedClaims,
  fetchRejectedClaims,
  approvePhotoClaim,
  rejectPhotoClaim,
  type PhotoClaim
} from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/context/ToastContext'
import { getAdminAuditActor } from './utils'
import { Button } from '@/components/ui/Button'

export const ClaimsModeration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [claims, setClaims] = useState<PhotoClaim[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  
  // Rejection modal state
  const [rejectingClaim, setRejectingClaim] = useState<PhotoClaim | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const { user } = useAuthStore()
  const { addToast } = useToast()

  const loadClaims = useCallback(async () => {
    setLoading(true)
    try {
      let data: PhotoClaim[] = []
      if (activeTab === 'pending') {
        data = await fetchPendingClaims()
        setPendingCount(data.length)
      } else if (activeTab === 'approved') {
        data = await fetchApprovedClaims()
      } else {
        data = await fetchRejectedClaims()
      }
      setClaims(data)
      
      // Also silently update pending count if we are not on the pending tab
      if (activeTab !== 'pending') {
        const pendingData = await fetchPendingClaims()
        setPendingCount(pendingData.length)
      }
    } catch (err: any) {
      console.error('Error fetching photo claims:', err)
      addToast(`Failed to load photo claims: ${  err.message || err}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, addToast])

  useEffect(() => {
    void loadClaims()
  }, [loadClaims])

  const handleApprove = async (claim: PhotoClaim) => {
    setSubmittingId(claim.id)
    try {
      const actor = getAdminAuditActor(user)
      await approvePhotoClaim(claim.id, actor)
      addToast(`Claim for ${claim.guest_identities?.display_name} successfully approved!`, 'success')
      await loadClaims()
    } catch (err: any) {
      console.error('Error approving claim:', err)
      addToast(`Failed to approve claim: ${  err.message || err}`, 'error')
    } finally {
      setSubmittingId(null)
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingClaim) return

    setSubmittingId(rejectingClaim.id)
    const claimId = rejectingClaim.id
    const guestName = rejectingClaim.guest_identities?.display_name || 'Guest'
    
    // Close modal early for immediate responsiveness
    setRejectingClaim(null)

    try {
      const actor = getAdminAuditActor(user)
      await rejectPhotoClaim(claimId, rejectionReason.trim(), actor)
      addToast(`Claim for ${guestName} rejected.`, 'info')
      setRejectionReason('')
      await loadClaims()
    } catch (err: any) {
      console.error('Error rejecting claim:', err)
      addToast(`Failed to reject claim: ${  err.message || err}`, 'error')
    } finally {
      setSubmittingId(null)
    }
  }

  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return isoString
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex border-b border-gold-500/10 pb-px">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`relative py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-gold-700'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            Pending Claims
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800 animate-pulse">
                {pendingCount}
              </span>
            )}
            {activeTab === 'pending' && (
              <motion.div
                layoutId="activeClaimTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"
              />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('approved')}
            className={`relative py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'approved'
                ? 'text-gold-700'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            Approved Claims
            {activeTab === 'approved' && (
              <motion.div
                layoutId="activeClaimTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`relative py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'rejected'
                ? 'text-gold-700'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            Rejected Claims
            {activeTab === 'rejected' && (
              <motion.div
                layoutId="activeClaimTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"
              />
            )}
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 border border-gold-100 bg-white/70 rounded-xl"
          >
            <Loader2 className="w-10 h-10 text-gold-500 animate-spin" />
            <p className="mt-4 text-sm text-charcoal-500 font-sans">
              Loading claims database...
            </p>
          </motion.div>
        ) : claims.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-16 px-4 border border-gold-100 bg-white/70 rounded-xl text-center"
          >
            <div className="w-12 h-12 rounded-full bg-cream-50 flex items-center justify-center text-gold-500 border border-gold-200/30 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-900">
              {activeTab === 'pending'
                ? 'No Pending Claims'
                : activeTab === 'approved'
                ? 'No Approved Claims Yet'
                : 'No Rejected Claims'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-charcoal-500 font-sans">
              {activeTab === 'pending'
                ? 'All guest identity verification and photo claims are up to date! Great work.'
                : activeTab === 'approved'
                ? 'Approved claims will appear here once guest identities are confirmed.'
                : 'Rejected claims list is currently clear.'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4"
          >
            {claims.map((claim) => {
              const identity = claim.guest_identities
              const photo = claim.photos
              const thumbnailSrc = photo?.thumbnail || photo?.url

              return (
                <motion.div
                  key={claim.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                  className="flex flex-col md:flex-row gap-5 p-5 border border-gold-100 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  {/* Status strip */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      claim.status === 'pending'
                        ? 'bg-amber-400'
                        : claim.status === 'approved'
                        ? 'bg-emerald-500'
                        : 'bg-rose-400'
                    }`}
                  />

                  {/* Photo Thumbnail */}
                  <div className="flex-shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-lg overflow-hidden border border-gold-200/20 bg-cream-50 relative flex items-center justify-center">
                    {thumbnailSrc ? (
                      <>
                        <img
                          src={thumbnailSrc}
                          alt="Claimed media"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-charcoal-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                          title="Open full photo in new tab"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </>
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gold-300" />
                    )}
                  </div>

                  {/* Guest Metadata & Identity Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-cream-100 text-gold-800 border border-gold-200/20 uppercase tracking-wider font-sans">
                        {claim.claim_type === 'face' ? 'Face Tag Claim' : 'Photo Upload Claim'}
                      </span>
                      <span className="text-xs text-charcoal-400 font-sans flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(claim.created_at)}
                      </span>
                    </div>

                    <h4 className="font-serif text-lg font-semibold text-charcoal-900 flex items-center gap-1.5 mt-1">
                      <User className="w-4 h-4 text-gold-500" />
                      {identity?.display_name || 'Anonymous Guest'}
                    </h4>

                    <div className="text-sm text-charcoal-600 font-sans flex flex-col gap-1 sm:flex-row sm:gap-4 mt-0.5">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-charcoal-400" />
                        {identity?.email ? (
                          <a
                            href={`mailto:${identity.email}`}
                            className="hover:text-gold-600 hover:underline"
                          >
                            {identity.email}
                          </a>
                        ) : (
                          'No email'
                        )}
                      </span>
                      {claim.claim_type === 'face' && claim.face_id && (
                        <span className="flex items-center gap-1.5 text-gold-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Tagging Face: {identity?.display_name}
                        </span>
                      )}
                    </div>

                    {/* Rejection comment display */}
                    {claim.status === 'rejected' && claim.rejection_reason && (
                      <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-sans flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Rejection Reason:</span>{' '}
                          {claim.rejection_reason}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Moderation Pane */}
                  <div className="flex-shrink-0 flex md:flex-col items-stretch md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-gold-500/10 md:pl-5">
                    {claim.status === 'pending' ? (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white border-none flex-1 md:flex-none justify-center"
                          disabled={submittingId === claim.id}
                          onClick={() => handleApprove(claim)}
                        >
                          {submittingId === claim.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1.5" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 flex-1 md:flex-none justify-center"
                          disabled={submittingId === claim.id}
                          onClick={() => setRejectingClaim(claim)}
                        >
                          <X className="w-4 h-4 mr-1.5" />
                          Reject
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        {claim.status === 'approved' ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-medium font-sans">
                            <CheckCircle className="w-5 h-5" />
                            Approved
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 font-medium font-sans">
                            <XCircle className="w-5 h-5" />
                            Rejected
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Modal Overlay */}
      <AnimatePresence>
        {rejectingClaim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white border border-gold-200 rounded-xl shadow-xl overflow-hidden z-10 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gold-500/10 bg-cream-50/50">
                <h3 className="font-serif text-lg font-semibold text-charcoal-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  Reject Verification Claim
                </h3>
                <button
                  onClick={() => setRejectingClaim(null)}
                  className="p-1 rounded-full text-charcoal-400 hover:text-charcoal-800 hover:bg-charcoal-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleRejectSubmit} className="p-4 space-y-4">
                <p className="text-xs text-charcoal-500 leading-normal">
                  Provide a clear reason why the photo/face claim for{' '}
                  <span className="font-semibold text-charcoal-800">
                    {rejectingClaim.guest_identities?.display_name}
                  </span>{' '}
                  ({rejectingClaim.guest_identities?.email}) is being rejected. This is logged to the audit log.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="rejection-reason" className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600">
                    Rejection Reason
                  </label>
                  <textarea
                    id="rejection-reason"
                    rows={3}
                    required
                    placeholder="E.g., Email address matches, but the uploaded photos do not match this guest profile / face belongs to another guest."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gold-200 p-2.5 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500 bg-cream-50/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gold-500/10">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setRejectingClaim(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-700 text-white border-none"
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
