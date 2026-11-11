import { useEffect, useState } from 'react'

/**
 * Frozen `src/components/photo-viewer/useVerifiedNames.ts`, made injectable.
 *
 * The frozen hook fetched verified identities from Supabase whenever the
 * lightbox opened. The rebuild has no data layer inside this feature, so the
 * loader is injected (the Lead wires `shared/data`); the default loader returns
 * no names, which keeps tests and the pre-data build deterministic.
 *
 * Normalization is the frozen contract: `display_name.trim().toLowerCase()`.
 */
export type VerifiedNamesLoader = () => Promise<string[]>

export function normalizeVerifiedNames(names: readonly string[]): string[] {
  return names.map(name => name.trim().toLowerCase()).filter(Boolean)
}

export function isVerifiedName(name: string, verifiedNames: readonly string[]): boolean {
  return verifiedNames.includes(name.trim().toLowerCase())
}

export function useVerifiedNames(
  isOpen: boolean,
  loadVerifiedNames: VerifiedNamesLoader = () => Promise.resolve([])
): string[] {
  const [verifiedNames, setVerifiedNames] = useState<string[]>([])

  useEffect(() => {
    let mounted = true

    async function loadVerified() {
      try {
        const names = await loadVerifiedNames()
        if (mounted) {
          setVerifiedNames(normalizeVerifiedNames(names))
        }
      } catch (error) {
        // Frozen behavior: log and keep an empty set (badges simply absent).
        console.error('Error loading verified identities in Lightbox:', error)
      }
    }

    if (isOpen) {
      void loadVerified()
    }

    return () => {
      mounted = false
    }
  }, [isOpen, loadVerifiedNames])

  return verifiedNames
}
