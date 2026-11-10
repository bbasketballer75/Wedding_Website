import { describe, expect, it } from 'vitest'
import { createMockClient } from '@/shared/data/test-support/mock-client'
import {
  createGuestPhotosApi,
  guestPhotosApi,
  mapGuestUpload,
  selectApprovedUploads,
} from './guest-photos-api'
import { mapGuestUploadRow, type GuestUpload } from '@/shared/data/guestUploads'

function uploadRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'upload-1',
    guest_name: 'Jamie Rivera',
    guest_email: 'jamie@example.com',
    message: 'From our table',
    photo_urls: ['/images/guest/a.webp', '/images/guest/b.webp'],
    video_urls: [],
    status: 'approved',
    created_at: '2025-05-12T18:00:00.000Z',
    video_visibility: 'archive_only',
    memory_trail: null,
    editorial_title: null,
    editorial_summary: null,
    featured_rank: null,
    photo_fingerprints: [],
    video_fingerprints: [],
    rejection_reason: null,
    ...overrides,
  }
}

function toGuestUpload(row: Record<string, unknown>): GuestUpload {
  return mapGuestUploadRow(row as Parameters<typeof mapGuestUploadRow>[0])
}

describe('mapGuestUpload', () => {
  it('maps the typed GuestUpload row to the feature seam 1:1', () => {
    const mapped = mapGuestUpload(toGuestUpload(uploadRow()))
    expect(mapped).toEqual({
      id: 'upload-1',
      guestName: 'Jamie Rivera',
      message: 'From our table',
      createdAt: '2025-05-12T18:00:00.000Z',
      photoUrls: ['/images/guest/a.webp', '/images/guest/b.webp'],
      status: 'approved',
    })
  })

  it('defaults a missing date to the frozen empty string and keeps a null message', () => {
    const mapped = mapGuestUpload(toGuestUpload(uploadRow({ created_at: null, message: null })))
    expect(mapped.createdAt).toBe('')
    expect(mapped.message).toBeNull()
  })

  it('defensively filters to approved uploads only', () => {
    const uploads = [
      mapGuestUpload(toGuestUpload(uploadRow())),
      mapGuestUpload(toGuestUpload(uploadRow({ id: 'upload-2', status: 'pending' }))),
      mapGuestUpload(toGuestUpload(uploadRow({ id: 'upload-3', status: 'rejected' }))),
    ]
    expect(selectApprovedUploads(uploads).map(upload => upload.id)).toEqual(['upload-1'])
  })
})

describe('createGuestPhotosApi', () => {
  it('queries the approved guest_uploads read and returns approved rows in order', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_uploads: {
          data: [
            uploadRow(),
            uploadRow({ id: 'upload-2', guest_name: 'Alex', status: 'pending' }),
            uploadRow({ id: 'upload-3', guest_name: 'Riley' }),
          ],
        },
      },
    })

    const uploads = await createGuestPhotosApi(client).loadApprovedUploads()

    expect(uploads.map(upload => upload.id)).toEqual(['upload-1', 'upload-3'])
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'eq',
      args: ['status', 'approved'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('keeps the frozen stats/photo inputs (photo urls + approved status)', async () => {
    const { client } = createMockClient({ tables: { guest_uploads: { data: [uploadRow()] } } })
    const uploads = await createGuestPhotosApi(client).loadApprovedUploads()
    expect(uploads[0]?.photoUrls).toHaveLength(2)
    expect(uploads[0]?.status).toBe('approved')
  })

  it('propagates read errors so the page renders the frozen error state', async () => {
    const { client } = createMockClient({
      tables: { guest_uploads: { error: new Error('network down') } },
    })
    await expect(createGuestPhotosApi(client).loadApprovedUploads()).rejects.toBeTruthy()
  })

  it('exposes the default router-facing adapter', () => {
    expect(typeof guestPhotosApi.loadApprovedUploads).toBe('function')
  })
})
