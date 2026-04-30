import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'

// Safe sessionStorage wrapper per D-01 (matching downloadStore pattern)
const safeSessionStorage = {
  getItem: (name: string): string | null => {
    try {
      return sessionStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      sessionStorage.setItem(name, value)
    } catch {
      // Quota exceeded - skip caching, fallback to memory-only
    }
  },
  removeItem: (name: string): void => {
    try {
      sessionStorage.removeItem(name)
    } catch {}
  },
}

export type ClaimStep = 'idle' | 'email_entry' | 'verification_sent' | 'code_entry' | 'claimed'
export type VerificationMethod = 'magic_link' | 'code' | null

export interface ClaimablePhoto {
  id: string
  guest_name: string
  guest_email: string
  photo_urls: string[]
  thumbnail?: string
  created_at: string
}

export interface ClaimState {
  step: ClaimStep
  email: string | null
  verificationMethod: VerificationMethod
  claimablePhotos: ClaimablePhoto[]
  attributedEmail: string | null
  setStep: (step: ClaimStep) => void
  setEmail: (email: string) => void
  setVerificationMethod: (method: VerificationMethod) => void
  setClaimablePhotos: (photos: ClaimablePhoto[]) => void
  completeClaim: () => void
  reset: () => void
}

export const useClaimStore = create<ClaimState>()(
  devtools(
    persist(
      (set, get) => ({
        step: 'idle',
        email: null,
        verificationMethod: null,
        claimablePhotos: [],
        attributedEmail: null,
        setStep: (step) => set({ step }),
        setEmail: (email) => set({ email }),
        setVerificationMethod: (method) => set({ verificationMethod: method }),
        setClaimablePhotos: (photos) => set({ claimablePhotos: photos }),
        completeClaim: () => set({ step: 'claimed', attributedEmail: get().email }),
        reset: () =>
          set({
            step: 'idle',
            email: null,
            verificationMethod: null,
            claimablePhotos: [],
          }),
      }),
      {
        name: 'claim-store',
        storage: createJSONStorage(() => safeSessionStorage),
        partialize: (state) => ({ attributedEmail: state.attributedEmail }),
      }
    ),
    { name: 'claim-store' }
  )
)
