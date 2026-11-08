import { describe, expect, it } from 'vitest'
import * as ui from './index'

/**
 * Public API contract for the primitive barrel. Loading the barrel also proves
 * every module it re-exports is resolvable at test time.
 *
 * `forwardRef`/`memo` components are exotic objects in React 19, so those are
 * asserted as defined; plain function components and the cva helpers are
 * asserted as functions.
 */
describe('shared/ui barrel', () => {
  it('exports the button primitives and their variant helper', () => {
    expect(ui.Button).toBeDefined()
    expect(ui.ButtonLink).toBeTypeOf('function')
    expect(ui.buttonVariants).toBeTypeOf('function')
    expect(ui.buttonVariants({ variant: 'primary' })).toContain('bg-gold-500')
    expect(ui.buttonVariants({ size: 'icon' })).toContain('h-10')
  })

  it('exports the card family', () => {
    expect(ui.Card).toBeDefined()
    expect(ui.GlassCard).toBeDefined()
    expect(ui.PolaroidCard).toBeDefined()
    expect(ui.MemoryCard).toBeDefined()
    expect(ui.CardHeader).toBeDefined()
    expect(ui.CardTitle).toBeDefined()
    expect(ui.CardDescription).toBeDefined()
    expect(ui.CardContent).toBeDefined()
    expect(ui.CardFooter).toBeDefined()
  })

  it('exports badge, form, avatar and skeleton primitives', () => {
    expect(ui.Badge).toBeTypeOf('function')
    expect(ui.badgeVariants).toBeTypeOf('function')
    expect(ui.badgeVariants({ variant: 'outline' })).toContain('border-gold-500/50')
    expect(ui.Input).toBeDefined()
    expect(ui.Textarea).toBeDefined()
    expect(ui.Label).toBeDefined()
    expect(ui.Avatar).toBeDefined()
    expect(ui.Skeleton).toBeTypeOf('function')
    expect(ui.PhotoSkeleton).toBeTypeOf('function')
    expect(ui.GallerySkeleton).toBeTypeOf('function')
    expect(ui.TextSkeleton).toBeTypeOf('function')
    expect(ui.CardSkeleton).toBeTypeOf('function')
    expect(ui.ListSkeleton).toBeTypeOf('function')
  })

  it('exports the live additional primitives ported for the content waves', () => {
    expect(ui.SocialPlatformIcon).toBeTypeOf('function')
    expect(ui.RevealText).toBeTypeOf('function')
    expect(ui.ChapterTitle).toBeTypeOf('function')
    expect(ui.OptimizedImage).toBeDefined()
    expect(ui.ResponsiveImage).toBeTypeOf('function')
    expect(ui.ProgressiveImage).toBeTypeOf('function')
    expect(ui.PageLoader).toBeTypeOf('function')
  })
})
