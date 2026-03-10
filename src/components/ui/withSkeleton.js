import { Skeleton } from './Skeleton'
import React from 'react'

/**
 * Higher-order component for skeleton loading
 * @param {React.ComponentType} Component - The component to wrap
 * @param {React.ReactNode} skeleton - The skeleton component to show during loading
 */
export const withSkeleton = (Component, skeleton) => {
  return ({ isLoading, ...props }) => {
    if (isLoading) {
      return skeleton || <Skeleton variant='rectangular' height='200px' />
    }
    return <Component {...props} />
  }
}

export default withSkeleton
