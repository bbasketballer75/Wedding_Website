/**
 * Public primitive API for the greenfield app.
 *
 * Every export below is a faithful port of a live frozen
 * `src/components/ui/*` module (see the Wave-2 W2-1 task evidence for the
 * inventory). Frozen file paths map 1:1:
 *
 *   Button          -> src/components/ui/Button.tsx
 *   Card family     -> src/components/ui/Card.tsx
 *   Badge           -> src/components/ui/Badge.tsx
 *   Input           -> src/components/ui/Input.tsx
 *   Textarea        -> src/components/ui/Textarea.tsx
 *   Label           -> src/components/ui/Label.tsx
 *   Avatar          -> src/components/ui/Avatar.tsx
 *   Skeleton family -> src/components/ui/Skeleton.tsx
 *   SocialPlatformIcon -> src/components/ui/SocialPlatformIcon.tsx
 *   RevealText      -> src/components/ui/RevealText.tsx
 *   ChapterTitle    -> src/components/ui/ChapterTitle.tsx
 *   OptimizedImage  -> src/components/ui/OptimizedImage.tsx
 *   PageLoader      -> src/components/ui/PageLoader.tsx
 */

// Button
export { Button, ButtonLink, type ButtonProps, type ButtonLinkProps } from './Button'
export { buttonVariants, type ButtonVariants } from './buttonVariants'

// Card
export {
  Card,
  GlassCard,
  PolaroidCard,
  MemoryCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
  type GlassCardProps,
  type PolaroidCardProps,
  type MemoryCardProps,
} from './Card'

// Badge
export { Badge, type BadgeProps } from './Badge'
export { badgeVariants, type BadgeVariants } from './badgeVariants'

// Form primitives
export { Input, type InputProps } from './Input'
export { Textarea, type TextareaProps } from './Textarea'
export { Label, type LabelProps } from './Label'

// Avatar
export { Avatar, type AvatarProps } from './Avatar'

// Skeletons
export {
  Skeleton,
  PhotoSkeleton,
  GallerySkeleton,
  TextSkeleton,
  CardSkeleton,
  ListSkeleton,
  type SkeletonProps,
  type PhotoSkeletonProps,
  type GallerySkeletonProps,
  type TextSkeletonProps,
  type ListSkeletonProps,
} from './Skeleton'

// Icons / editorial helpers
export {
  SocialPlatformIcon,
  type SocialPlatform,
  type SocialPlatformIconProps,
} from './SocialPlatformIcon'
export { RevealText, type RevealTextProps } from './RevealText'
export { ChapterTitle, type ChapterTitleProps } from './ChapterTitle'

// Images
export {
  OptimizedImage,
  ResponsiveImage,
  ProgressiveImage,
  type OptimizedImageProps,
  type ResponsiveImageProps,
} from './OptimizedImage'

// Loading
export { PageLoader } from './PageLoader'
