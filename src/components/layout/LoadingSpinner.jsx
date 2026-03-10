import { CardSkeleton, GallerySkeleton, ListSkeleton, TextSkeleton } from '@/components/ui/Skeleton'
import { colors } from '@/tokens/designTokens'

const LoadingSpinner = ({
  size = 'md',
  variant = 'spinner',
  text = 'Loading...',
  skeletonType = 'card',
}) => {
  const pixelSize = size === 'sm' ? '24px' : size === 'lg' ? '80px' : '48px'

  if (variant === 'skeleton') {
    return (
      <div className='w-full p-4'>
        {skeletonType === 'card' && <CardSkeleton />}
        {skeletonType === 'list' && <ListSkeleton count={3} />}
        {skeletonType === 'gallery' && <GallerySkeleton columns={3} />}
        {skeletonType === 'text' && <TextSkeleton width='100%' />}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '4rem',
        width: '100%',
      }}
    >
      <div
        className='spinner'
        style={{
          width: pixelSize,
          height: pixelSize,
          border: `${size === 'sm' ? '2px' : size === 'lg' ? '4px' : '3px'} solid rgba(0,0,0,0.1)`,
          borderTop: `${size === 'sm' ? '2px' : size === 'lg' ? '4px' : '3px'} solid ${colors.gold[500]}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {text && (
        <p
          style={{
            marginTop: '1rem',
            color: colors.neutral.gray,
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {text}
        </p>
      )}
    </div>
  )
}

export default LoadingSpinner
