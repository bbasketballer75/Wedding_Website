import React, { LazyExoticComponent, ComponentType } from 'react'

interface LazyLoadOptions {
  fallback?: React.ReactNode
  delay?: number
  className?: string
}

// Higher-order component for lazy loading
export const withLazyLoad = <P extends object>(
  Component: () => Promise<{ default: ComponentType<P> }>,
  options: LazyLoadOptions = {}
) => {
  const LazyComponent = React.lazy(Component)

  const WithLazyLoad: React.FC<P> = props => {
    const LazyLoadComponent = React.lazy(() => import('./LazyLoad'))
    return (
      <LazyLoadComponent {...options}>
        <LazyComponent {...props} />
      </LazyLoadComponent>
    )
  }

  return WithLazyLoad
}

// Preload utility
export const preloadComponent = <T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): LazyExoticComponent<T> => {
  const component = React.lazy(componentImport)
  // TypeScript doesn't natively know about 'preload' on LazyExoticComponent,
  // but some loaders/patterns add it. We'll cast to any for the call if it's dynamic.
  if ((component as any).preload) {
    ;(component as any).preload()
  }
  return component
}
