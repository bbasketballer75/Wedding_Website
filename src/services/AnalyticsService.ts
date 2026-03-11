const gaId = import.meta.env.VITE_GA_ID?.trim()

function hasAnalytics() {
  return Boolean(gaId)
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    window.gtag = (command: string, ...args: unknown[]) => {
      window.dataLayer?.push([command, ...args])
    }
  }
}

export function initAnalytics() {
  if (!hasAnalytics() || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  ensureDataLayer()

  if (!document.querySelector(`script[data-ga-id="${gaId}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    script.dataset.gaId = gaId
    document.head.appendChild(script)
  }

  window.gtag?.('js', new Date())
  window.gtag?.('config', gaId, {
    anonymize_ip: true,
    send_page_view: false,
  })
}

export function trackPageView(path: string, title?: string) {
  if (!hasAnalytics() || typeof window === 'undefined') {
    return
  }

  window.gtag?.('config', gaId, {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  })
}
