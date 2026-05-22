import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useClaimStore } from './claimStore'
import * as supabaseLib from '@/lib/supabase'

vi.mock('@/lib/supabase', () => {
  return {
    fetchPotentialPhotosToClaimByEmail: vi.fn().mockResolvedValue([
      { id: 'photo-1', url: 'https://example.com/1.jpg', thumbnail: 'https://example.com/1-t.jpg' },
      { id: 'photo-2', url: 'https://example.com/2.jpg', thumbnail: 'https://example.com/2-t.jpg' },
    ]),
    submitClaims: vi.fn().mockResolvedValue([{ id: 'claim-1' }]),
  }
})

describe('useClaimStore Zustand store', () => {
  beforeEach(() => {
    useClaimStore.getState().closeWizard()
    vi.clearAllMocks()
  })

  it('initializes with correct defaults', () => {
    const state = useClaimStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.step).toBe(1)
    expect(state.displayName).toBe('')
    expect(state.email).toBe('')
    expect(state.otpCode).toBe('')
    expect(state.simulatedOtpCode).toBe('')
    expect(state.sandboxMode).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.photosToClaim).toEqual([])
    expect(state.selectedPhotoIds).toEqual([])
    expect(state.targetPhotoId).toBeNull()
    expect(state.targetFaceId).toBeNull()
    expect(state.targetFaceName).toBeNull()
  })

  it('opens and closes the wizard correctly', () => {
    const store = useClaimStore.getState()

    store.openWizard({
      photoId: 'photo-123',
      faceId: 'face-456',
      faceName: 'Jordyn Bask'
    })

    let state = useClaimStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.step).toBe(1)
    expect(state.displayName).toBe('Jordyn Bask')
    expect(state.targetPhotoId).toBe('photo-123')
    expect(state.targetFaceId).toBe('face-456')
    expect(state.targetFaceName).toBe('Jordyn Bask')

    store.closeWizard()

    state = useClaimStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.displayName).toBe('')
    expect(state.targetPhotoId).toBeNull()
  })

  it('advances steps and updates inputs correctly', () => {
    const store = useClaimStore.getState()
    store.openWizard()

    store.setInputs({ displayName: 'John Doe', email: 'john@example.com' })
    let state = useClaimStore.getState()
    expect(state.displayName).toBe('John Doe')
    expect(state.email).toBe('john@example.com')

    store.setStep(2)
    state = useClaimStore.getState()
    expect(state.step).toBe(2)
  })

  it('sends OTP code and generates simulated code in sandbox mode', async () => {
    const store = useClaimStore.getState()
    store.openWizard()
    store.setInputs({ displayName: 'John Doe', email: 'john@example.com' })

    const promise = store.sendOtp()
    expect(useClaimStore.getState().isLoading).toBe(true)
    
    await promise

    const state = useClaimStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.step).toBe(2)
    expect(state.simulatedOtpCode).toHaveLength(6)
    expect(state.error).toBeNull()
  })

  it('verifies simulated OTP code correctly and fetches matching photos', async () => {
    const store = useClaimStore.getState()
    store.openWizard({ photoId: 'target-photo' })
    store.setInputs({ displayName: 'John Doe', email: 'john@example.com' })

    await store.sendOtp()
    const simulatedCode = useClaimStore.getState().simulatedOtpCode

    store.setInputs({ otpCode: simulatedCode })
    await store.verifyOtp()

    const state = useClaimStore.getState()
    expect(state.step).toBe(3)
    expect(state.photosToClaim).toHaveLength(2)
    expect(state.selectedPhotoIds).toContain('target-photo')
    expect(state.selectedPhotoIds).toContain('photo-1')
    expect(state.selectedPhotoIds).toContain('photo-2')
    expect(state.error).toBeNull()
  })

  it('submits claims and advances to success step', async () => {
    const store = useClaimStore.getState()
    store.openWizard({ photoId: 'target-photo', faceId: 'target-face' })
    store.setInputs({ displayName: 'John Doe', email: 'john@example.com' })

    await store.sendOtp()
    const simulatedCode = useClaimStore.getState().simulatedOtpCode

    store.setInputs({ otpCode: simulatedCode })
    await store.verifyOtp()

    await store.submitClaims()

    const state = useClaimStore.getState()
    expect(state.step).toBe(4)
    expect(state.error).toBeNull()
    expect(supabaseLib.submitClaims).toHaveBeenCalledWith(
      'john@example.com',
      'John Doe',
      [
        { photoId: 'target-photo', faceId: 'target-face', claimType: 'face' },
        { photoId: 'photo-1', faceId: null, claimType: 'upload' },
        { photoId: 'photo-2', faceId: null, claimType: 'upload' },
      ],
      null
    )
  })

  it('toggles selection and select all actions', async () => {
    const store = useClaimStore.getState()
    store.openWizard()
    store.setInputs({ displayName: 'John Doe', email: 'john@example.com' })

    await store.sendOtp()
    const simulatedCode = useClaimStore.getState().simulatedOtpCode

    store.setInputs({ otpCode: simulatedCode })
    await store.verifyOtp()

    let state = useClaimStore.getState()
    expect(state.selectedPhotoIds).toHaveLength(2) // ['photo-1', 'photo-2']

    store.togglePhotoSelection('photo-1')
    state = useClaimStore.getState()
    expect(state.selectedPhotoIds).toEqual(['photo-2'])

    store.selectAllPhotos(false)
    state = useClaimStore.getState()
    expect(state.selectedPhotoIds).toEqual([])

    store.selectAllPhotos(true)
    state = useClaimStore.getState()
    expect(state.selectedPhotoIds).toContain('photo-1')
    expect(state.selectedPhotoIds).toContain('photo-2')
  })
})
