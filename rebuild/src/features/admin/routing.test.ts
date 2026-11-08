import { describe, expect, it } from 'vitest'
import { adminPathForSection, adminSectionFromPathname, parseAdminLoginFrom } from './routing'

describe('adminSectionFromPathname', () => {
  it('maps the ten admin paths to their sections and defaults to dashboard', () => {
    expect(adminSectionFromPathname('/admin')).toBe('dashboard')
    expect(adminSectionFromPathname('/admin/')).toBe('dashboard')
    expect(adminSectionFromPathname('/admin/photos')).toBe('photos')
    expect(adminSectionFromPathname('/admin/albums')).toBe('albums')
    expect(adminSectionFromPathname('/admin/review')).toBe('review')
    expect(adminSectionFromPathname('/admin/claims')).toBe('claims')
    expect(adminSectionFromPathname('/admin/guestbook')).toBe('guestbook')
    expect(adminSectionFromPathname('/admin/audit')).toBe('audit')
    expect(adminSectionFromPathname('/admin/analytics')).toBe('analytics')
    expect(adminSectionFromPathname('/admin/settings')).toBe('settings')
  })

  it('treats unknown or malformed admin paths as the dashboard', () => {
    expect(adminSectionFromPathname('/admin/unknown')).toBe('dashboard')
    // Sub-paths inherit their parent section (frozen `getAdminRouteMeta` used startsWith).
    expect(adminSectionFromPathname('/admin/photos/extra')).toBe('photos')
    expect(adminSectionFromPathname('/elsewhere')).toBe('dashboard')
  })
})

describe('adminPathForSection', () => {
  it('returns canonical paths', () => {
    expect(adminPathForSection('dashboard')).toBe('/admin')
    expect(adminPathForSection('photos')).toBe('/admin/photos')
    expect(adminPathForSection('settings')).toBe('/admin/settings')
  })
})

describe('parseAdminLoginFrom', () => {
  it('honours admin targets from the login URL', () => {
    expect(parseAdminLoginFrom('')).toBe('/admin')
    expect(parseAdminLoginFrom('?from=/admin/photos')).toBe('/admin/photos')
    expect(parseAdminLoginFrom('?from=%2Fadmin%2Faudit%3Fpage%3D2')).toBe('/admin/audit?page=2')
  })

  it('rejects open-redirect and login-loop targets', () => {
    expect(parseAdminLoginFrom('?from=https://evil.example/admin')).toBe('/admin')
    expect(parseAdminLoginFrom('?from=//evil.example')).toBe('/admin')
    expect(parseAdminLoginFrom('?from=/gallery')).toBe('/admin')
    expect(parseAdminLoginFrom('?from=/admin/login')).toBe('/admin')
    expect(parseAdminLoginFrom('?from=/admin/login/extra')).toBe('/admin')
  })
})
