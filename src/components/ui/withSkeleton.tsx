import { Skeleton } from './Skeleton'
import React, { ComponentType } from 'react'

interface WithSkeletonProps {
  isLoading?: boolean;
}

/**
 * Higher-order component for skeleton loading
 * @param Component - The component to wrap
 * @param skeleton - The skeleton component to show during loading
 */
export const withSkeleton = <P extends object>(
  Component: ComponentType<P>,
  skeleton?: React.ReactNode
) => {
  const WrappedComponent: React.FC<P & WithSkeletonProps> = ({ isLoading, ...props }) => {
    if (isLoading) {
      return (skeleton as React.ReactElement) || <Skeleton className='h-[200px] w-full' />
    }
    return <Component {...(props as P)} />
  }

  return WrappedComponent
}

export default withSkeleton
