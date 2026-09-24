import { useEffect, useState } from 'react'
import { fetchVerifiedIdentities } from '@/lib/supabase'

// Loads the set of verified display names (lowercased) whenever the lightbox opens,
// so claimed faces can be shown with a verified badge.
export function useVerifiedNames(isOpen: boolean): string[] {
  const [verifiedNames, setVerifiedNames] = useState<string[]>([])

  useEffect(() => {
    async function loadVerified() {
      try {
        const identities = await fetchVerifiedIdentities()
        setVerifiedNames(identities.map(i => i.display_name.trim().toLowerCase()))
      } catch (err) {
        console.error('Error loading verified identities in Lightbox:', err)
      }
    }
    if (isOpen) {
      void loadVerified()
    }
  }, [isOpen])

  return verifiedNames
}
