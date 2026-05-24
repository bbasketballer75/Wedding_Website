import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClaimStore } from '@/stores/claimStore'
import {
  X,
  Mail,
  User,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Code,
  Image as ImageIcon,
  Check,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react'

export const ClaimModal: React.FC = () => {
  const {
    isOpen,
    step,
    displayName,
    email,
    otpCode,
    simulatedOtpCode,
    sandboxMode,
    isLoading,
    error,
    photosToClaim,
    selectedPhotoIds,
    targetFaceId,
    targetFaceName,
    closeWizard,
    setInputs,
    toggleSandboxMode,
    sendOtp,
    verifyOtp,
    submitClaims,
    togglePhotoSelection,
    selectAllPhotos,
    setStep,
  } = useClaimStore()

  if (!isOpen) return null

  const handleAutocomplete = () => {
    if (simulatedOtpCode) {
      setInputs({ otpCode: simulatedOtpCode })
    }
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    await verifyOtp()
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendOtp()
  }

  return (
    <AnimatePresence>
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-md'>
        {/* Modal Backdrop click to close */}
        <button
          type='button'
          className='absolute inset-0 w-full h-full cursor-default bg-transparent focus:outline-none'
          onClick={closeWizard}
          aria-label='Close dialog'
        />

        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className='relative w-full max-w-xl overflow-hidden border bg-cream-50/95 border-gold-500/30 rounded-xl shadow-2xl z-10 flex flex-col max-h-[90vh]'
        >
          {/* Header */}
          <div className='flex items-center justify-between p-5 border-b border-gold-500/10'>
            <div>
              <h3 className='font-serif text-2xl font-semibold text-charcoal-900'>
                {targetFaceId ? 'Claim Face Tag' : 'Claim Photo Uploads'}
              </h3>
              <p className='text-xs text-charcoal-500 font-sans mt-0.5'>
                Verify your identity to lock in photo claims
              </p>
            </div>
            <button
              onClick={closeWizard}
              className='p-1 rounded-full text-charcoal-400 hover:text-charcoal-800 hover:bg-charcoal-400/10 transition-colors'
              aria-label='Close modal'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          {/* Sandbox Toggle Panel */}
          <div className='bg-gold-500/5 px-5 py-2 flex items-center justify-between border-b border-gold-500/10 text-xs'>
            <span className='flex items-center gap-1.5 font-medium text-gold-700'>
              <Code className='w-3.5 h-3.5' />
              Developer Sandbox Sandbox OTP Mode
            </span>
            <button
              onClick={() => toggleSandboxMode(!sandboxMode)}
              className={`px-2 py-0.5 rounded-full font-semibold transition-all ${
                sandboxMode
                  ? 'bg-gold-500 text-cream-50 shadow-sm'
                  : 'bg-charcoal-200 text-charcoal-600'
              }`}
            >
              {sandboxMode ? 'Active' : 'Inactive'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className='mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2 animate-shake'>
              <AlertTriangle className='w-4 h-4 shrink-0 mt-0.5' />
              <span>{error}</span>
            </div>
          )}

          {/* Body content */}
          <div className='p-6 overflow-y-auto flex-1 font-sans'>
            {/* STEP 1: Enter Name & Email */}
            {step === 1 && (
              <form onSubmit={handleSendOtp} className='space-y-4'>
                <div className='text-sm text-charcoal-600 leading-relaxed mb-4'>
                  {targetFaceId ? (
                    <span>
                      Claiming face cluster for <strong>"{targetFaceName}"</strong>. Please confirm
                      your guest name and email address to receive a verification code.
                    </span>
                  ) : (
                    <span>
                      Claim photos you previously uploaded to the wedding archive. Enter your name
                      and the email address used during upload to authenticate.
                    </span>
                  )}
                </div>

                <div className='space-y-3'>
                  <div>
                    <label
                      htmlFor='claim-guest-name'
                      className='block text-xs font-semibold text-charcoal-700 mb-1'
                    >
                      Guest Name
                    </label>
                    <div className='relative'>
                      <User className='absolute left-3 top-2.5 w-4 h-4 text-charcoal-400' />
                      <input
                        id='claim-guest-name'
                        type='text'
                        required
                        placeholder='e.g. Austin Bask'
                        value={displayName}
                        onChange={e => setInputs({ displayName: e.target.value })}
                        className='w-full pl-9 pr-4 py-2 text-sm border border-charcoal-200 rounded-lg bg-white/70 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-charcoal-800'
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor='claim-guest-email'
                      className='block text-xs font-semibold text-charcoal-700 mb-1'
                    >
                      Email Address
                    </label>
                    <div className='relative'>
                      <Mail className='absolute left-3 top-2.5 w-4 h-4 text-charcoal-400' />
                      <input
                        id='claim-guest-email'
                        type='email'
                        required
                        placeholder='guest@example.com'
                        value={email}
                        onChange={e => setInputs({ email: e.target.value })}
                        className='w-full pl-9 pr-4 py-2 text-sm border border-charcoal-200 rounded-lg bg-white/70 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-charcoal-800'
                      />
                    </div>
                  </div>
                </div>

                <button
                  type='submit'
                  disabled={isLoading}
                  className='w-full mt-6 py-2.5 bg-gold-500 hover:bg-gold-600 disabled:bg-gold-300 text-cream-50 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer text-sm'
                >
                  {isLoading ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <>
                      Send Verification Code
                      <ChevronRight className='w-4 h-4' />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {step === 2 && (
              <form onSubmit={handleOtpVerify} className='space-y-4'>
                <div className='text-sm text-charcoal-600 leading-relaxed mb-4'>
                  We've sent a 6-digit verification code to <strong>{email}</strong>. Please enter
                  the code below to verify your identity.
                </div>

                <div className='space-y-3'>
                  <div>
                    <label
                      htmlFor='claim-otp-code'
                      className='block text-xs font-semibold text-charcoal-700 mb-1'
                    >
                      Verification Code
                    </label>
                    <div className='relative'>
                      <ShieldCheck className='absolute left-3 top-2.5 w-4 h-4 text-charcoal-400' />
                      <input
                        id='claim-otp-code'
                        type='text'
                        required
                        maxLength={6}
                        pattern='\d{6}'
                        placeholder='123456'
                        value={otpCode}
                        onChange={e => setInputs({ otpCode: e.target.value.replace(/\D/g, '') })}
                        className='w-full pl-9 pr-4 py-2 text-sm border border-charcoal-200 rounded-lg bg-white/70 tracking-widest font-mono text-center focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-charcoal-800'
                      />
                    </div>
                  </div>

                  {/* Developer Sandbox autocomplete banner */}
                  {sandboxMode && simulatedOtpCode && (
                    <div className='p-3 border border-gold-500/30 bg-gold-500/5 rounded-lg flex flex-col gap-2'>
                      <span className='text-[11px] text-gold-800 font-medium'>
                        <strong>Developer Sandbox Simulation:</strong> We mocked sending an email.
                      </span>
                      <div className='flex items-center justify-between'>
                        <code className='text-xs font-mono font-bold text-gold-600 bg-white px-2 py-0.5 border border-gold-500/10 rounded shadow-sm'>
                          Simulated OTP: {simulatedOtpCode}
                        </code>
                        <button
                          type='button'
                          onClick={handleAutocomplete}
                          className='text-[10px] bg-gold-500 hover:bg-gold-600 text-cream-50 px-2 py-1 rounded font-bold shadow-sm transition-all'
                        >
                          Autocomplete & Verify
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className='flex gap-3 mt-6'>
                  <button
                    type='button'
                    onClick={() => setStep(1)}
                    className='flex-1 py-2.5 border border-charcoal-200 hover:bg-charcoal-100 text-charcoal-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer text-sm'
                  >
                    <ArrowLeft className='w-4 h-4' />
                    Back
                  </button>
                  <button
                    type='submit'
                    disabled={isLoading || otpCode.length !== 6}
                    className='flex-[2] py-2.5 bg-gold-500 hover:bg-gold-600 disabled:bg-gold-300 text-cream-50 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer text-sm'
                  >
                    {isLoading ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      <>
                        Verify Code
                        <ChevronRight className='w-4 h-4' />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Confirm Photos to Claim */}
            {step === 3 && (
              <div className='space-y-4'>
                <div className='text-sm text-charcoal-600 leading-relaxed mb-2'>
                  {photosToClaim.length > 0 ? (
                    <span>
                      We found <strong>{photosToClaim.length}</strong> photo(s) matching your
                      uploads. Select the ones you want to claim under your verified identity.
                    </span>
                  ) : (
                    <span>
                      Confirm your photo claim request. Click below to submit your verified identity
                      claim to Austin & Jordyn's moderation team.
                    </span>
                  )}
                </div>

                {photosToClaim.length > 0 && (
                  <div className='space-y-3'>
                    <div className='flex justify-between items-center text-xs'>
                      <span className='font-semibold text-charcoal-700'>
                        {selectedPhotoIds.length} of {photosToClaim.length} selected
                      </span>
                      <div className='flex gap-2'>
                        <button
                          onClick={() => selectAllPhotos(true)}
                          className='text-gold-600 hover:text-gold-700 font-medium'
                        >
                          Select All
                        </button>
                        <span className='text-charcoal-300'>|</span>
                        <button
                          onClick={() => selectAllPhotos(false)}
                          className='text-charcoal-500 hover:text-charcoal-700 font-medium'
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Photo Grid */}
                    <div className='grid grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto p-1.5 border border-charcoal-200/50 rounded-xl bg-white/50'>
                      {photosToClaim.map(photo => {
                        const isSelected = selectedPhotoIds.includes(photo.id)
                        return (
                          <button
                            key={photo.id}
                            type='button'
                            onClick={() => togglePhotoSelection(photo.id)}
                            className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 ${
                              isSelected
                                ? 'border-gold-500 shadow-md scale-[0.98]'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={photo.thumbnail || photo.url}
                              alt='Thumbnail'
                              className='w-full h-full object-cover'
                            />
                            {/* Checkbox badge overlay */}
                            <div
                              className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-gold-500 text-cream-50 scale-100'
                                  : 'bg-charcoal-900/40 text-transparent scale-0'
                              }`}
                            >
                              <Check className='w-3.5 h-3.5 stroke-[3px]' />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Explicit target photo warning / notice */}
                {targetFaceId && (
                  <div className='p-3 bg-gold-500/5 border border-gold-500/20 rounded-lg flex items-start gap-2.5 text-xs text-gold-800'>
                    <ShieldCheck className='w-4.5 h-4.5 shrink-0 text-gold-500' />
                    <div>
                      <span className='font-semibold block mb-0.5'>Face Tag Claim Linked</span>
                      This will automatically link face clusters tagged as{' '}
                      <strong>"{targetFaceName}"</strong> directly to your verified guest profile.
                    </div>
                  </div>
                )}

                <div className='flex gap-3 mt-6'>
                  <button
                    onClick={() => setStep(2)}
                    className='flex-1 py-2.5 border border-charcoal-200 hover:bg-charcoal-100 text-charcoal-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer text-sm'
                  >
                    <ArrowLeft className='w-4 h-4' />
                    Back
                  </button>
                  <button
                    onClick={submitClaims}
                    disabled={
                      isLoading || (photosToClaim.length > 0 && selectedPhotoIds.length === 0)
                    }
                    className='flex-[2] py-2.5 bg-gold-500 hover:bg-gold-600 disabled:bg-gold-300 text-cream-50 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer text-sm'
                  >
                    {isLoading ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      <>
                        Submit Verified Claim
                        <CheckCircle className='w-4 h-4' />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Success Screen */}
            {step === 4 && (
              <div className='text-center py-6 space-y-4'>
                <div className='flex justify-center'>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className='w-16 h-16 rounded-full bg-gold-500/10 flex items-center justify-center border border-gold-500/20'
                  >
                    <CheckCircle className='w-10 h-10 text-gold-500' />
                  </motion.div>
                </div>

                <div className='space-y-2'>
                  <h4 className='font-serif text-2xl font-semibold text-charcoal-900'>
                    Verification Claim Submitted!
                  </h4>
                  <p className='text-sm text-charcoal-600 leading-relaxed max-w-md mx-auto'>
                    Thank you, <strong>{displayName}</strong>! Your claim has been sent to Austin &
                    Jordyn's admin moderation queue.
                  </p>
                </div>

                <div className='p-4 bg-cream-100/50 rounded-xl max-w-sm mx-auto text-xs text-charcoal-500 border border-gold-500/5'>
                  Once the admin approves, your name will be rendered in a gorgeous gold italic font
                  inside the Photo Lightbox info details panel.
                </div>

                <button
                  onClick={closeWizard}
                  className='w-full max-w-xs mt-6 py-2.5 bg-gold-500 hover:bg-gold-600 text-cream-50 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer text-sm inline-block'
                >
                  Return to Gallery
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
