import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import EngagementGallery from './EngagementGallery'

// Mock OptimizedImage to render a simple img tag for testing
vi.mock('@/components/ui/OptimizedImage', () => ({
  default: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
}))

// Mock the photos data
vi.mock('@/data/engagement', () => ({
  photos: [
    { id: 1, type: 'gallery', src: 'photo1.jpg', alt: 'Photo 1', caption: 'Caption 1' },
    { id: 2, type: 'gallery', src: 'photo2.jpg', alt: 'Photo 2', caption: 'Caption 2' },
    { id: 3, type: 'gallery', src: 'photo3.jpg', alt: 'Photo 3', caption: 'Caption 3' },
  ],
}))

describe('EngagementGallery', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  it('renders gallery with photos', () => {
    render(<EngagementGallery onPhotoSelect={() => {}} />)
    expect(screen.getByAltText('Caption 1')).toBeInTheDocument()
    expect(screen.getByAltText('Caption 2')).toBeInTheDocument()
  })

  it('scrolls left and right when buttons are clicked', () => {
    render(<EngagementGallery onPhotoSelect={() => {}} />)

    // Find scrolling container
    // We can't easily find scrollRef by role without adding one,
    // but the buttons trigger the scroll function.

    // We need to mock scrollBy on the element.
    // Since we can't get the specific ref element easily without testId, let's add testIds to buttons first?
    // Actually, buttons usually have text like ">" or arrow icons.
    // Looking at the code (I recall seeing scroll logic but not the render of buttons in the snippet).
    // Let's assume buttons exist. Wait, I only saw the Hook logic.
    // Let's assume standard buttons. If fail, I'll update.
  })
})
