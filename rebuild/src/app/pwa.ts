/**
 * Production-only PWA/install layer (Wave 8 W8-1).
 *
 * PARITY CONTRACT: the frozen app's static head is compared tag-by-tag after
 * hydration, so the rebuild's `index.html` must stay byte-identical to the
 * frozen head. Every NEW install tag (manifest link, `mobile-web-app-capable`
 * additions that are not in the frozen head, apple meta, icon links) is
 * therefore injected at runtime and ONLY when the production build opts in via
 * `VITE_ENABLE_PWA=1`. Parity/preview builds leave the flag unset and emit the
 * frozen head verbatim.
 */

import { registerServiceWorker, type ServiceWorkerStatus } from './seo/registerServiceWorker'

export const PWA_ENV_FLAG = 'VITE_ENABLE_PWA'

export interface PwaDocument {
  createElement: (tagName: 'link' | 'meta') => HTMLLinkElement | HTMLMetaElement
  head: { appendChild: (node: Node) => Node }
  querySelector: (selectors: string) => Element | null
}

export type PwaStatus = 'disabled' | ServiceWorkerStatus

export function isPwaEnabled(
  env: Record<string, string | boolean | undefined> | undefined
): boolean {
  return env?.[PWA_ENV_FLAG] === '1'
}

function appendOnce(
  documentRef: PwaDocument,
  selector: string,
  create: () => HTMLLinkElement | HTMLMetaElement
): void {
  if (documentRef.querySelector(selector)) return
  documentRef.head.appendChild(create())
}

/**
 * Inject the install metadata the frozen head does not carry. No-op unless the
 * PWA flag is enabled; safe to call repeatedly (each tag is added once).
 */
export function applyInstallMeta({
  enabled,
  documentRef,
}: {
  enabled: boolean
  documentRef?: PwaDocument
}): boolean {
  if (!enabled) return false
  try {
    const doc = documentRef ?? (typeof document === 'undefined' ? undefined : document)
    if (!doc) return false

    // The frozen head already carries the manifest link, mobile-web-app-capable
    // and application-name tags; only genuinely-new install metadata is added
    // here at runtime (parity/preview builds stay frozen-head-identical).
    appendOnce(doc, 'meta[name="apple-mobile-web-app-capable"]', () => {
      const meta = doc.createElement('meta') as HTMLMetaElement
      meta.name = 'apple-mobile-web-app-capable'
      meta.content = 'yes'
      return meta
    })
    return true
  } catch {
    return false
  }
}

export interface InitPwaOptions {
  enabled?: boolean
  env?: Record<string, string | boolean | undefined>
  documentRef?: PwaDocument
  isDev?: boolean
  isE2E?: boolean
  navigatorRef?: Navigator
  register?: (scriptUrl: string, options?: RegistrationOptions) => Promise<unknown>
  getRegistrations?: () => Promise<ReadonlyArray<{ unregister: () => Promise<unknown> }>>
}

/**
 * Boot the PWA layer. Returns the effective status so tests/ops can assert that
 * a parity build ("disabled") performs no DOM mutation and registers no worker.
 */
export async function initPwa(options: InitPwaOptions = {}): Promise<PwaStatus> {
  try {
    const env =
      options.env ?? (typeof import.meta.env === 'undefined' ? undefined : import.meta.env)
    const enabled = options.enabled ?? isPwaEnabled(env)
    if (!enabled) return 'disabled'

    applyInstallMeta({
      enabled: true,
      ...(options.documentRef ? { documentRef: options.documentRef } : {}),
    })

    return await registerServiceWorker({
      isDev: options.isDev ?? Boolean(import.meta.env.DEV),
      isE2E:
        options.isE2E ??
        (typeof window !== 'undefined' && Boolean((window as { __E2E__?: boolean }).__E2E__)),
      ...(options.navigatorRef ? { navigatorRef: options.navigatorRef } : {}),
      ...(options.register ? { register: options.register } : {}),
      ...(options.getRegistrations ? { getRegistrations: options.getRegistrations } : {}),
    })
  } catch {
    return 'failed'
  }
}
