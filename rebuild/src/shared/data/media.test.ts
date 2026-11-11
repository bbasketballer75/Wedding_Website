import { describe, expect, it } from 'vitest'
import {
  createMediaPaths,
  DEV_MEDIA_PROXY_PREFIX,
  OFFLOADED_MEDIA_PREFIXES,
  mediaPaths,
} from './media'

const CDN = 'https://media.wedding.theporadas.com'
const SITE = 'https://www.theporadas.com'

const prod = createMediaPaths({ mediaBaseUrl: CDN, siteUrl: SITE, isDev: false })
const dev = createMediaPaths({ mediaBaseUrl: CDN, siteUrl: SITE, isDev: true })
const local = createMediaPaths({ mediaBaseUrl: undefined, siteUrl: undefined, isDev: false })

describe('media path contract (frozen src/utils/media.ts semantics)', () => {
  it('offloads only the three frozen prefixes', () => {
    expect([...OFFLOADED_MEDIA_PREFIXES]).toEqual(['/video/', '/background_audio/', '/media/'])

    expect(prod.getMediaPath('/video/main.mp4')).toBe(`${CDN}/video/main.mp4`)
    expect(prod.getMediaPath('/background_audio/song.mp3')).toBe(`${CDN}/background_audio/song.mp3`)
    expect(prod.getMediaPath('/media/_thumbs/Engagement/Photos/a.webp')).toBe(
      `${CDN}/media/_thumbs/Engagement/Photos/a.webp`
    )
  })

  it('keeps non-offloaded assets same-origin (/images stays local)', () => {
    expect(prod.getMediaPath('/images/engagement/PoradaProposal-29.webp')).toBe(
      '/images/engagement/PoradaProposal-29.webp'
    )
    expect(prod.getMediaPath('/icons/icon-96x96.png')).toBe('/icons/icon-96x96.png')
    expect(prod.getMediaPath('/captions/main.vtt')).toBe('/captions/main.vtt')
  })

  it('returns the same-origin path when no VITE_MEDIA_BASE_URL is configured', () => {
    expect(local.getMediaPath('/video/main.mp4')).toBe('/video/main.mp4')
    expect(local.getMediaPath('media/_thumbs/a.webp')).toBe('/media/_thumbs/a.webp')
  })

  it('adds the leading slash for relative input before deciding to offload', () => {
    expect(prod.getMediaPath('video/main.mp4')).toBe(`${CDN}/video/main.mp4`)
  })

  it('uses the dev proxy only for dev mode with a configured CDN', () => {
    expect(dev.getMediaPath('/video/main.mp4')).toBe(`${DEV_MEDIA_PROXY_PREFIX}/video/main.mp4`)
    expect(dev.getMediaPath('/media/_thumbs/a.webp')).toBe(
      `${DEV_MEDIA_PROXY_PREFIX}/media/_thumbs/a.webp`
    )
    // Non-offloaded paths never take the proxy in dev either.
    expect(dev.getMediaPath('/images/a.webp')).toBe('/images/a.webp')
  })

  it('never sanitises path segments (preserves + and spaces)', () => {
    expect(prod.getMediaPath('/media/_thumbs/Bach+ette/Photos/PXL_20240816.webp')).toBe(
      `${CDN}/media/_thumbs/Bach+ette/Photos/PXL_20240816.webp`
    )
    expect(prod.getMediaPath('/media/Guest Uploads/Wedding Day/a.webp')).toBe(
      `${CDN}/media/Guest Uploads/Wedding Day/a.webp`
    )
    expect(dev.getMediaPath('/media/_thumbs/Bach+ette/a.webp')).toBe(
      `${DEV_MEDIA_PROXY_PREFIX}/media/_thumbs/Bach+ette/a.webp`
    )
  })

  it('passes absolute URLs through untouched', () => {
    const absolute = 'https://media.wedding.theporadas.com/guest-uploads/photos/a.jpg'
    expect(prod.getMediaPath(absolute)).toBe(absolute)
    expect(dev.getMediaPath(absolute)).toBe(absolute)
    expect(prod.getAbsoluteMediaUrl(absolute)).toBe(absolute)
  })

  it('strips only the leading slash and collapses empty segments for remote paths', () => {
    expect(prod.toRemoteMediaPath('/video/main.mp4')).toBe('video/main.mp4')
    expect(prod.toRemoteMediaPath('//video//main.mp4')).toBe('video/main.mp4')
    expect(prod.toRemoteMediaPath('')).toBe('')
  })

  it('builds absolute URLs from VITE_SITE_URL and returns the path without it', () => {
    expect(prod.getAbsoluteUrl('/film')).toBe(`${SITE}/film`)
    expect(prod.getAbsoluteUrl('film')).toBe(`${SITE}/film`)
    expect(local.getAbsoluteUrl('/film')).toBe('/film')
    expect(prod.getAbsoluteUrl('https://example.test/x')).toBe('https://example.test/x')
  })

  it('getAbsoluteMediaUrl composes media resolution + site origin', () => {
    expect(prod.getAbsoluteMediaUrl('/video/main.mp4')).toBe(`${CDN}/video/main.mp4`)
    expect(prod.getAbsoluteMediaUrl('/images/a.webp')).toBe(`${SITE}/images/a.webp`)
    expect(local.getAbsoluteMediaUrl('/images/a.webp')).toBe('/images/a.webp')
  })

  it('ships an app-wide resolver that is same-origin without a CDN env value', () => {
    // Vitest runs without VITE_MEDIA_BASE_URL, so the default resolver must not
    // invent a CDN origin (offline + parity safety).
    expect(mediaPaths.getMediaPath('/video/main.mp4')).toBe('/video/main.mp4')
  })
})
