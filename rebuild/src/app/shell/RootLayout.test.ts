import { describe, expect, it } from 'vitest'
import { pageTitle } from './RootLayout'

describe('pageTitle', () => {
  it('maps every frozen public route to its shell announcement title', () => {
    expect(pageTitle('/')).toBe('Home')
    expect(pageTitle('/film')).toBe('Wedding Film')
    expect(pageTitle('/gallery')).toBe('Photo Gallery')
    expect(pageTitle('/upload')).toBe('Share Memories')
    expect(pageTitle('/guestbook')).toBe('Guestbook')
    expect(pageTitle('/guest-photos')).toBe('Guest Memories')
    expect(pageTitle('/activity')).toBe('Activity')
    expect(pageTitle('/admin/login')).toBe('Admin Login')
    expect(pageTitle('/print')).toBe('Memory Book')
  })

  it('labels guest albums by prefix and leaves nested admin paths unlabeled', () => {
    expect(pageTitle('/guest/valid-showcase-token')).toBe('Guest Album')
    expect(pageTitle('/admin')).toBe('Admin Dashboard')
    expect(pageTitle('/admin/albums')).toBeUndefined()
  })

  it('leaves retired and unknown paths unlabeled (the shell falls back)', () => {
    expect(pageTitle('/people')).toBeUndefined()
    expect(pageTitle('/does-not-exist')).toBeUndefined()
  })
})
