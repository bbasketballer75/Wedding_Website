import type { ReactNode } from 'react'

/**
 * Route transition wrapper. Values mirror the frozen app (opacity + 20px rise,
 * 0.5s, easing [0.16, 1, 0.3, 1]) — now expressed as a CSS enter animation instead
 * of framer-motion.
 *
 * Why: framer-motion is a 46.4 KiB gzip chunk that index.html module-preloaded on the
 * critical path of every page, for four enter animations in the shell. The shell is
 * now plain markup plus CSS.
 *
 * What changed visually: only the ENTER animation survives. framer-motion's exit
 * animation requires keeping the node mounted after React removes it, which a route
 * wrapper cannot do. Content therefore appears immediately and rises into place,
 * which is also better for LCP than starting at opacity 0.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className='shell-enter-up'>{children}</div>
}
