import React, { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import NoiseOverlay from '../ui/NoiseOverlay'
import SkipLink from '../ui/SkipLink'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  useEffect(() => {
    // Disable smooth scroll in tests to prevent viewport conflicts
    if (navigator.webdriver) {
      return
    }

    const lenis = new Lenis({
      duration: 1.4,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      gestureOrientation: 'vertical',
      smoothWheel: true,
      syncTouch: false,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    return () => lenis.destroy()
  }, [])

  return (
    <>
      <SkipLink />
      <NoiseOverlay />
      <main id='main' className='flex-grow w-full min-h-screen relative flex flex-col'>
        {children}
      </main>
    </>
  )
}

export default Layout
