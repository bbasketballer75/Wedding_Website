import React from 'react'
import { ANIMATION_DURATIONS } from '@/config/constants'

// Higher-order component for lazy loading
export const withLazyLoad = (Component, options = {}) => {
  const LazyComponent = React.lazy(Component)

  return props => {
    const LazyLoadComponent = React.lazy(() => import('./LazyLoad'))
    return (
      <LazyLoadComponent {...options}>
        <LazyComponent {...props} />
      </LazyLoadComponent>
    )
  }
}

// Preload utility
export const preloadComponent = componentImport => {
  const component = React.lazy(componentImport)
  // Trigger the import to start loading
  component.preload?.()
  return component
}
