// ─── Admin User & Session ────────────────────────────────────────────────────

export const adminUser = {
  id: 'mock-admin-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'admin@test.wedding',
  email_confirmed_at: '2025-01-01T00:00:00.000Z',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  user_metadata: { role: 'admin' },
  app_metadata: { provider: 'email', providers: ['email'] },
  identities: [],
}

export const adminSession = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token',
  user: adminUser,
}

// ─── Pending Guest Uploads ────────────────────────────────────────────────────

export const pendingUploads = [
  {
    id: 'upload-pending-1',
    guest_name: 'Riley Thompson',
    guest_email: 'riley@example.com',
    message: 'Captured a few special moments from our table!',
    photo_urls: ['/images/engagement/PoradaProposal-29.webp', '/images/engagement/PoradaProposal-11.webp'],
    video_urls: [],
    status: 'pending',
    created_at: '2025-05-11T09:00:00.000Z',
  },
  {
    id: 'upload-pending-2',
    guest_name: 'Sam Garcia',
    guest_email: 'sam@example.com',
    message: 'Love these photos from the reception!',
    photo_urls: ['/images/engagement/PoradaProposal-150.webp'],
    video_urls: [],
    status: 'pending',
    created_at: '2025-05-11T10:30:00.000Z',
  },
  {
    id: 'upload-pending-3',
    guest_name: 'Alex Chen',
    guest_email: 'alex@example.com',
    message: '',
    photo_urls: ['/images/engagement/PoradaProposal-181.webp'],
    video_urls: ['https://mock-storage.example.com/video-1.mp4'],
    status: 'pending',
    created_at: '2025-05-11T11:00:00.000Z',
  },
]

// ─── Guestbook Messages (Admin view) ─────────────────────────────────────────

export const adminGuestbookMessages = [
  {
    id: 'gb-msg-1',
    name: 'Sarah Mitchell',
    email: 'sarah@example.com',
    content: 'Your vows made the whole room disappear for a second.',
    media_url: null,
    reactions: { love: 12, clap: 4 },
    created_at: '2025-05-12T18:00:00.000Z',
    comments: [],
  },
  {
    id: 'gb-msg-2',
    name: 'Mike Chen',
    email: 'mike@example.com',
    content: 'The dance floor was wild in the best way possible.',
    media_url: null,
    reactions: { fire: 8 },
    created_at: '2025-05-13T18:00:00.000Z',
    comments: [],
  },
  {
    id: 'gb-msg-3',
    name: 'Aunt Patricia',
    email: 'patricia@example.com',
    content: 'We sent a quick video hello from our table right after the toasts.',
    media_url: null,
    reactions: { love: 9 },
    created_at: '2025-05-14T18:00:00.000Z',
    comments: [],
  },
]

// ─── Moderation Audit Log ─────────────────────────────────────────────────────

export const auditLogEntries = [
  {
    id: 'audit-1',
    entity_type: 'guest_upload',
    entity_id: 'upload-pending-1',
    action: 'upload_approved_published',
    actor_id: 'mock-admin-id',
    actor_email: 'admin@test.wedding',
    actor_name: 'Admin',
    summary: "Approved Riley Thompson's upload and published to gallery.",
    metadata: { guest_name: 'Riley Thompson' },
    created_at: '2025-05-12T09:00:00.000Z',
  },
  {
    id: 'audit-2',
    entity_type: 'guestbook_message',
    entity_id: 'gb-msg-2',
    action: 'guestbook_message_deleted',
    actor_id: 'mock-admin-id',
    actor_email: 'admin@test.wedding',
    actor_name: 'Admin',
    summary: 'Deleted guestbook message from Mike Chen.',
    metadata: { guest_name: 'Mike Chen' },
    created_at: '2025-05-13T10:00:00.000Z',
  },
  {
    id: 'audit-3',
    entity_type: 'guest_upload',
    entity_id: 'upload-pending-2',
    action: 'upload_rejected',
    actor_id: 'mock-admin-id',
    actor_email: 'admin@test.wedding',
    actor_name: 'Admin',
    summary: "Rejected upload from Sam Garcia.",
    metadata: { guest_name: 'Sam Garcia' },
    created_at: '2025-05-13T12:00:00.000Z',
  },
]

// ─── Featured Editorial Slots ─────────────────────────────────────────────────

export const featuredSlots = [
  {
    id: 'feat-1',
    slot: 'home_moment_of_the_week',
    is_active: true,
    title: 'The First Dance',
    summary: 'A quiet moment before the lights came on.',
    badge_label: 'Moment of the Week',
    cta_label: 'See the photo',
    source_url: null,
    source_type: 'custom',
    created_at: '2025-05-15T00:00:00.000Z',
    updated_at: '2025-05-15T00:00:00.000Z',
  },
  {
    id: 'feat-2',
    slot: 'home_newest_standout_upload',
    is_active: false,
    title: null,
    summary: null,
    badge_label: 'Standout Upload',
    cta_label: null,
    source_url: null,
    source_type: 'custom',
    created_at: '2025-05-15T00:00:00.000Z',
    updated_at: '2025-05-15T00:00:00.000Z',
  },
  {
    id: 'feat-3',
    slot: 'home_featured_guestbook_note',
    is_active: false,
    title: null,
    summary: null,
    badge_label: 'Featured Note',
    cta_label: null,
    source_url: null,
    source_type: 'custom',
    created_at: '2025-05-15T00:00:00.000Z',
    updated_at: '2025-05-15T00:00:00.000Z',
  },
  {
    id: 'feat-4',
    slot: 'film_featured_guest_video',
    is_active: false,
    title: null,
    summary: null,
    badge_label: 'Film Feature',
    cta_label: null,
    source_url: null,
    source_type: 'custom',
    created_at: '2025-05-15T00:00:00.000Z',
    updated_at: '2025-05-15T00:00:00.000Z',
  },
]

// ─── Dashboard stats (aggregated counts returned by supabase queries) ─────────

export const dashboardPhotosCount = [{ count: 42 }]
export const dashboardPendingCount = [{ count: 3 }]
export const dashboardMessagesCount = [{ count: 18 }]
export const dashboardApprovedUploadsCount = [{ count: 7 }]
