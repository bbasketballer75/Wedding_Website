import { useUIStore } from '@/stores'
import { motion } from 'framer-motion'
import React, { useEffect, useState } from 'react'

const SunIcon = () => (
  <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
    />
  </svg>
)

const MoonIcon = () => (
  <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z'
    />
  </svg>
)

const SystemIcon = () => (
  <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
    />
  </svg>
)

const DarkModeToggle: React.FC = () => {
  const { currentTheme: theme, setCurrentTheme: setTheme } = useUIStore()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) {
    return <div className='w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse' />
  }

  const themes = [
    { value: 'light', icon: SunIcon, label: 'Light' },
    { value: 'system', icon: SystemIcon, label: 'System' },
    { value: 'dark', icon: MoonIcon, label: 'Dark' },
  ]

  const currentIndex = themes.findIndex(t => t.value === theme) ?? 0
  const nextTheme = themes[(currentIndex + 1) % themes.length]

  const handleCycleTheme = () => {
    setTheme(nextTheme.value as 'light' | 'dark' | 'system')
  }

  const CurrentIcon = themes[currentIndex].icon

  return (
    <div className='relative group'>
      <button
        onClick={handleCycleTheme}
        className='relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-gold)'
        aria-label={`Current theme: ${themes[currentIndex].label}. Click to change theme.`}
      >
        <motion.div
          key={theme}
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className='text-gray-700 dark:text-gray-300'
        >
          <CurrentIcon />
        </motion.div>
      </button>

      {/* Tooltip */}
      <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap'>
        {themes[currentIndex].label} theme
      </div>
    </div>
  )
}

// Theme selector dropdown component
export const ThemeSelector: React.FC = () => {
  const { currentTheme: theme, setCurrentTheme: setTheme } = useUIStore()
  const [isOpen, setIsOpen] = useState(false)

  const themes = [
    { value: 'light', icon: SunIcon, label: 'Light' },
    { value: 'system', icon: SystemIcon, label: 'System' },
    { value: 'dark', icon: MoonIcon, label: 'Dark' },
  ]

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-gold)'
      >
        {themes.find(t => t.value === theme)?.icon && (
          <div className='text-gray-700 dark:text-gray-300'>
            {(() => {
              const Icon = themes.find(t => t.value === theme)?.icon
              return Icon ? React.createElement(Icon) : null
            })()}
          </div>
        )}
        <span className='text-sm text-gray-700 dark:text-gray-300'>
          {themes.find(t => t.value === theme)?.label}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
        </svg>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className='absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50'
        >
          {themes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => {
                setTheme(value as 'light' | 'dark' | 'system')
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                theme === value
                  ? 'bg-gray-100 dark:bg-gray-700 text-(--color-gold)'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <Icon />
              <span>{label}</span>
              {theme === value && (
                <svg className='w-4 h-4 ml-auto' fill='currentColor' viewBox='0 0 20 20'>
                  <path
                    fillRule='evenodd'
                    d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default DarkModeToggle
