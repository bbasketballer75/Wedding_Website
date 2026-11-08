/**
 * `HTMLMediaElement.play()` returns a promise in modern browsers; the frozen
 * app tolerated older browsers that return `undefined`. This helper keeps that
 * tolerance and swallows autoplay rejections exactly like the frozen page
 * (`playAttempt.catch(() => {})`), without tripping the strict
 * no-floating-promises / no-misused-promises rules.
 */
export function attemptPlay(video: HTMLVideoElement | null | undefined): void {
  if (!video) {
    return
  }

  const playAttempt: unknown = video.play()

  if (playAttempt && typeof (playAttempt as { catch?: unknown }).catch === 'function') {
    void (playAttempt as Promise<void>).catch(() => {})
  }
}
