-- ============================================================================
-- contracts/schema/fixtures.sql — synthetic, anonymised local fixtures
--
-- Purpose
--   Seed the LOCAL Supabase database (post `supabase db reset`) with enough
--   synthetic rows to render every screen of the archive: home, film, gallery
--   (all four albums), photo viewer (likes/comments/faces), people, upload
--   status, guestbook (+replies/reactions data), guest-share showcase, print,
--   activity feed, admin dashboard/analytics, moderation queues, editorial
--   slots, claims and the face-review pipeline.
--
-- Guarantees
--   * NO production data, NO real guest names/emails/media. Every identity is
--     "Fixture ..." and every address is @fixtures.example (RFC 2606 reserved).
--   * Media paths point at files that exist in the frozen checkout
--     (`public/images/**`, `public/video/**`) so a local render is fully
--     offline; none of those bytes are copied by this file.
--   * Fixed UUIDs / timestamps => stable snapshots; idempotent (re-running
--     deletes the fixture rows first, then re-inserts).
--   * Does not touch auth.users, storage.objects, or any production system.
--
-- Apply (canonical local flow)
--   npx supabase db reset --workdir tmp/supabase-sandbox
--   docker exec -i supabase_db_theporadas-workbench psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < contracts/schema/fixtures.sql
--   (or, for a host with the default stack: `supabase db reset` then
--    `psql "$(supabase status -o env | grep DB_URL)" -f contracts/schema/fixtures.sql`)
--
-- Known, deliberate non-coverage
--   * auth.users are NOT seeded (no credentials in the repo). For admin screens,
--     create a local user and run `select public.promote_to_admin('<uuid>')`.
--     See contracts/schema/INVENTORY.md §9.
--   * The broken guestbook submit RPC is never called here (see rpc.md §3);
--     guestbook rows are inserted directly, as the app's fallback path does.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Idempotent cleanup of previous fixture application
-- ----------------------------------------------------------------------------
delete from public.activity_log
where source_id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000006',
  'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000008',
  'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000012',
  'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000003',
  'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002',
  'f7000000-0000-4000-8000-000000000003', 'f7000000-0000-4000-8000-000000000004'
);

delete from public.moderation_audit_log  where id::text like 'f9000000-0000-4000-8000-%';
delete from public.site_editorial_feature_history where id::text like 'f8000000-0000-4000-8000-%';
delete from public.site_editorial_features where id::text like 'f7000000-0000-4000-8000-%';
delete from public.guest_share_tokens    where id::text like 'f6000000-0000-4000-8000-%';
delete from public.guest_face_tagging_batches where id::text like 'f5000000-0000-4000-8000-%';
delete from public.photo_claims          where id::text like 'f1000000-0000-4000-8000-%';
delete from public.media_review_faces    where id::text like 'f4000000-0000-4000-8000-%';
delete from public.media_review_clusters where id::text like 'f3000000-0000-4000-8000-%';
delete from public.media_review_batches  where id::text like 'f2000000-0000-4000-8000-%';
delete from public.guest_identities      where id::text like 'f0000000-0000-4000-8000-%';
delete from public.guestbook_comments    where id::text like 'e0000000-0000-4000-8000-%';
delete from public.guestbook_messages    where id::text like 'd0000000-0000-4000-8000-%';
delete from public.guest_uploads         where id::text like 'c0000000-0000-4000-8000-%';
delete from public.photo_comments        where id::text like 'b0000000-0000-4000-8000-%';
delete from public.photo_likes           where session_id like 'fixture-session-%'
                                            or photo_key like 'a0000000-0000-4000-8000-%';
delete from public.photos                where id::text like 'a0000000-0000-4000-8000-%';
delete from public.rate_limit_logs       where id::text like 'fb000000-0000-4000-8000-%';

-- ----------------------------------------------------------------------------
-- 1. photos — 12 rows across the four product albums
--    (thumbnail = the existing local file; download_url stands in for the
--     original-bytes URL; faces power /people and the face overlay)
-- ----------------------------------------------------------------------------
insert into public.photos
  (id, url, thumbnail, caption, category, location, date, likes, photographer,
   is_professional, tags, faces, created_at, album, album_sort_order, download_url)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    '/images/engagement/PoradaProposal-29.webp',
    '/images/engagement/PoradaProposal-29.webp',
    'The proposal on the lighthouse steps', 'Engagement', 'Point Reyes, CA',
    '2025-02-14T17:30:00Z', 42, 'Fixture Photographer', true,
    array['proposal', 'engagement', 'coast'],
    '[{"id":"face-a1","name":"Austin","x":0.42,"y":0.31,"box":{"left":0.32,"top":0.2,"width":0.2,"height":0.22}},{"id":"face-a2","name":"Jordyn","x":0.58,"y":0.34,"box":{"left":0.49,"top":0.23,"width":0.19,"height":0.21}}]'::jsonb,
    '2025-02-15T09:00:00Z', 'Engagement', 1,
    '/images/engagement/PoradaProposal-29.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    '/images/engagement/PoradaProposal-146.webp',
    '/images/engagement/PoradaProposal-146.webp',
    'She said yes', 'Engagement', 'Point Reyes, CA',
    '2025-02-14T17:35:00Z', 57, 'Fixture Photographer', true,
    array['engagement', 'couple', 'joy'],
    '[{"id":"face-b1","name":"Austin","x":0.40,"y":0.42,"box":{"left":0.30,"top":0.3,"width":0.2,"height":0.24}},{"id":"face-b2","name":"Jordyn","x":0.60,"y":0.44,"box":{"left":0.51,"top":0.32,"width":0.18,"height":0.23}}]'::jsonb,
    '2025-02-15T09:01:00Z', 'Engagement', 2,
    '/images/engagement/PoradaProposal-146.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    '/images/engagement/PoradaProposal-309.webp',
    '/images/engagement/PoradaProposal-309.webp',
    'Golden hour on the cliffs', 'Engagement', 'Point Reyes, CA',
    '2025-02-14T18:10:00Z', 31, 'Fixture Photographer', true,
    array['engagement', 'landscape', 'golden-hour'],
    '[{"id":"face-c1","name":"Austin","x":0.44,"y":0.55,"box":{"left":0.35,"top":0.42,"width":0.18,"height":0.2}},{"id":"face-c2","name":"Jordyn","x":0.56,"y":0.56,"box":{"left":0.48,"top":0.43,"width":0.17,"height":0.19}}]'::jsonb,
    '2025-02-15T09:02:00Z', 'Engagement', 3,
    '/images/engagement/PoradaProposal-309.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    '/images/rings/jordyns_ring1.webp',
    '/images/rings/jordyns_ring1.webp',
    'The ring, up close', 'Engagement', null,
    '2025-02-15T12:00:00Z', 18, 'Fixture Photographer', true,
    array['ring', 'details'], '[]'::jsonb,
    '2025-02-15T09:03:00Z', 'Engagement', 4,
    '/images/rings/jordyns_ring1.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000005',
    '/images/shared-gallery-new/20250511_180812-0b9c.webp',
    '/images/shared-gallery-new/20250511_180812-0b9c.webp',
    'Bach+ette weekend in Nashville', 'Bach+ette', 'Nashville, TN',
    '2025-04-12T21:00:00Z', 24, null, false,
    array['bach', 'friends', 'night-out'],
    '[{"id":"face-d1","name":"Jordyn","x":0.5,"y":0.4,"box":{"left":0.4,"top":0.28,"width":0.2,"height":0.24}}]'::jsonb,
    '2025-04-13T10:00:00Z', 'Bach+ette', 1,
    '/images/shared-gallery-new/20250511_180812-0b9c.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000006',
    '/images/shared-gallery-new/20250511_180812-0f19.webp',
    '/images/shared-gallery-new/20250511_180812-0f19.webp',
    'Dancing at the honky tonk', 'Bach+ette', 'Nashville, TN',
    '2025-04-12T22:30:00Z', 12, null, false,
    array['bach', 'dance'], '[]'::jsonb,
    '2025-04-13T10:01:00Z', 'Bach+ette', 2,
    '/images/shared-gallery-new/20250511_180812-0f19.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000007',
    '/images/shared-gallery-new/20250511_181413-2d20.webp',
    '/images/shared-gallery-new/20250511_181413-2d20.webp',
    'The bridesmaids toast', 'Bach+ette', 'Nashville, TN',
    '2025-04-13T19:30:00Z', 9, null, false,
    array['bach', 'toast'], '[]'::jsonb,
    '2025-04-14T09:00:00Z', 'Bach+ette', 3,
    '/images/shared-gallery-new/20250511_181413-2d20.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000008',
    '/images/shared-gallery-new/20250511_180812-29ee.webp',
    '/images/shared-gallery-new/20250511_180812-29ee.webp',
    'First look', 'Wedding Day', 'Fixture Vineyard, CA',
    '2025-05-11T16:45:00Z', 88, 'Fixture Photographer', true,
    array['wedding-day', 'first-look'],
    '[{"id":"face-e1","name":"Austin","x":0.35,"y":0.45,"box":{"left":0.25,"top":0.32,"width":0.2,"height":0.25}},{"id":"face-e2","name":"Jordyn","x":0.65,"y":0.45,"box":{"left":0.55,"top":0.32,"width":0.2,"height":0.25}}]'::jsonb,
    '2025-05-12T08:00:00Z', 'Wedding Day', 1,
    '/images/shared-gallery-new/20250511_180812-29ee.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000009',
    '/images/shared-gallery-new/20250511_180812-3321.webp',
    '/images/shared-gallery-new/20250511_180812-3321.webp',
    'The ceremony', 'Wedding Day', 'Fixture Vineyard, CA',
    '2025-05-11T17:30:00Z', 73, 'Fixture Photographer', true,
    array['wedding-day', 'ceremony'],
    '[{"id":"face-f1","name":"Austin","x":0.4,"y":0.4,"box":{"left":0.3,"top":0.28,"width":0.2,"height":0.24}},{"id":"face-f2","name":"Jordyn","x":0.6,"y":0.4,"box":{"left":0.5,"top":0.28,"width":0.2,"height":0.24}}]'::jsonb,
    '2025-05-12T08:01:00Z', 'Wedding Day', 2,
    '/images/shared-gallery-new/20250511_180812-3321.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000010',
    '/images/shared-gallery-new/20250511_180812-3414.webp',
    '/images/shared-gallery-new/20250511_180812-3414.webp',
    'First dance', 'Wedding Day', 'Fixture Vineyard, CA',
    '2025-05-11T20:15:00Z', 64, 'Fixture Photographer', true,
    array['wedding-day', 'dance'],
    '[{"id":"face-g1","name":"Austin","x":0.45,"y":0.5,"box":{"left":0.35,"top":0.36,"width":0.19,"height":0.24}},{"id":"face-g2","name":"Jordyn","x":0.57,"y":0.5,"box":{"left":0.47,"top":0.36,"width":0.19,"height":0.24}}]'::jsonb,
    '2025-05-12T08:02:00Z', 'Wedding Day', 3,
    '/images/shared-gallery-new/20250511_180812-3414.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000011',
    '/images/shared-gallery-new/20250511_181413-2d20.webp',
    '/images/shared-gallery-new/20250511_181413-2d20.webp',
    'Guest photo: confetti exit', 'Guest Uploads', 'Fixture Vineyard, CA',
    '2025-05-11T21:45:00Z', 5, 'Fixture Guest Alpha', false,
    array['guest-upload', 'confetti'], '[]'::jsonb,
    '2025-05-13T09:00:00Z', 'Guest Uploads', 1,
    '/images/shared-gallery-new/20250511_181413-2d20.webp'
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    '/images/shared-gallery-new/20250511_181413-6b51.webp',
    '/images/shared-gallery-new/20250511_181413-6b51.webp',
    'Guest photo: the getaway car', 'Guest Uploads', 'Fixture Vineyard, CA',
    '2025-05-11T22:30:00Z', 2, 'Fixture Guest Beta', false,
    array['guest-upload', 'getaway'], '[]'::jsonb,
    '2025-05-13T09:01:00Z', 'Guest Uploads', 2,
    '/images/shared-gallery-new/20250511_181413-6b51.webp'
  );

-- ----------------------------------------------------------------------------
-- 2. photo engagement — likes (3 sessions) + visible/hidden comments
-- ----------------------------------------------------------------------------
insert into public.photo_likes (id, photo_key, session_id, created_at) values
  ('ab000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'fixture-session-alpha', '2026-09-01T12:00:00Z'),
  ('ab000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'fixture-session-beta',  '2026-09-01T12:01:00Z'),
  ('ab000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'fixture-session-alpha', '2026-09-01T12:02:00Z'),
  ('ab000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000008', 'fixture-session-gamma', '2026-09-01T12:03:00Z'),
  ('ab000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000009', 'fixture-session-gamma', '2026-09-01T12:04:00Z'),
  ('ab000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000010', 'fixture-session-beta',  '2026-09-01T12:05:00Z');

insert into public.photo_comments
  (id, photo_key, author, content, created_at, session_id, is_hidden,
   hidden_at, hidden_by_user_id, hidden_reason)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Fixture Guest Alpha', 'Such a beautiful moment — congratulations!', '2026-09-02T10:00:00Z',
   'fixture-session-alpha', false, null, null, null),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'Fixture Guest Beta', 'This one belongs on the wall.', '2026-09-02T10:05:00Z',
   'fixture-session-beta', false, null, null, null),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000008',
   'Fixture Family', 'Best day ever.', '2026-09-02T10:10:00Z',
   'fixture-session-gamma', false, null, null, null),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Fixture Hidden Comment', 'Synthetic hidden comment for the moderation UI.', '2026-09-02T10:15:00Z',
   'fixture-session-delta', true, '2026-09-03T09:00:00Z', null, 'fixture hidden reason');

-- ----------------------------------------------------------------------------
-- 3. media-review pipeline — one batch, two clusters, three faces
-- ----------------------------------------------------------------------------
insert into public.media_review_batches
  (id, batch_key, label, status, source_root, working_root, artifact_bucket,
   artifact_prefix, artifact_paths, notes, cluster_count, detection_count,
   pushed_by_user_id, pushed_by_email, created_at, updated_at)
values
  ('f2000000-0000-4000-8000-000000000001', 'fixture-batch-2026-11',
   'Fixture face-review batch', 'in_review', '/fixtures/source', '/fixtures/working',
   'media-review-artifacts', 'fixtures/batch-01',
   '{"manifest":"fixtures/batch-01/manifest.json","clusters":"fixtures/batch-01/clusters.json"}'::jsonb,
   'Synthetic batch for admin review screens.', 2, 3, null, 'fixture-admin@fixtures.example',
   '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z');

insert into public.media_review_clusters
  (id, batch_id, cluster_id, review_status, confirmed_name, merge_into_cluster_id,
   split_requested, split_notes, sample_thumbnail_path, member_count,
   average_quality_score, source_record_ids, members, metadata, created_at, updated_at)
values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
   'cluster-fixture-01', 'pending', null, null, false, null,
   'media/_thumbs/Engagement/Photos/PoradaProposal-29.webp', 2, 0.92,
   array['fixture-record-0001', 'fixture-record-0002'],
   '[{"faceId":"face-0001","sourceRelativePath":"professional/photos/fixture-0001.jpg","x":0.42,"y":0.31,"box":{"x":0.42,"y":0.31,"width":0.2,"height":0.22}},{"faceId":"face-0002","sourceRelativePath":"professional/photos/fixture-0002.jpg","x":0.4,"y":0.42,"box":{"x":0.4,"y":0.42,"width":0.2,"height":0.24}}]'::jsonb,
   '{"fixture":true}'::jsonb, '2026-09-10T08:01:00Z', '2026-09-10T08:01:00Z'),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001',
   'cluster-fixture-02', 'confirmed', 'Fixture Guest Alpha', null, true,
   'Synthetic split request for the review UI.',
   'media/_thumbs/Wedding Day/Photos/20250511_180812-29ee.webp', 1, 0.81,
   array['fixture-record-0003'],
   '[{"faceId":"face-0003","sourceRelativePath":"professional/photos/fixture-0003.jpg","x":0.5,"y":0.4,"box":{"x":0.5,"y":0.4,"width":0.18,"height":0.2}}]'::jsonb,
   '{"fixture":true}'::jsonb, '2026-09-10T08:02:00Z', '2026-09-10T08:02:00Z');

insert into public.media_review_faces
  (id, batch_id, face_id, cluster_id, source_record_id, source_relative_path,
   photo_url, thumbnail_url, thumbnail_object_path, x, y, box, quality_score,
   review_status, confirmed_name, person_key, notes, metadata, created_at, updated_at)
values
  ('f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
   'face-0001', 'cluster-fixture-01', 'fixture-record-0001',
   'professional/photos/fixture-0001.jpg', '/images/engagement/PoradaProposal-29.webp',
   '/images/engagement/PoradaProposal-29.webp',
   'media/_thumbs/Engagement/Photos/PoradaProposal-29.webp', 0.42, 0.31,
   '{"x":0.42,"y":0.31,"width":0.2,"height":0.22}'::jsonb, 0.94, 'pending', null,
   null, null, '{"fixture":true}'::jsonb, '2026-09-10T08:03:00Z', '2026-09-10T08:03:00Z'),
  ('f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001',
   'face-0002', 'cluster-fixture-02', 'fixture-record-0002',
   'professional/photos/fixture-0002.jpg', '/images/engagement/PoradaProposal-146.webp',
   '/images/engagement/PoradaProposal-146.webp',
   'media/_thumbs/Engagement/Photos/PoradaProposal-146.webp', 0.4, 0.42,
   '{"x":0.4,"y":0.42,"width":0.2,"height":0.24}'::jsonb, 0.88, 'confirmed',
   'Fixture Guest Alpha', 'fixture-person-alpha', 'Confirmed by fixture.',
   '{"fixture":true}'::jsonb, '2026-09-10T08:04:00Z', '2026-09-10T08:04:00Z'),
  ('f4000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001',
   'face-0003', null, 'fixture-record-0003',
   'professional/photos/fixture-0003.jpg', '/images/shared-gallery-new/20250511_180812-29ee.webp',
   '/images/shared-gallery-new/20250511_180812-29ee.webp',
   'media/_thumbs/Wedding Day/Photos/20250511_180812-29ee.webp', 0.5, 0.4,
   '{"x":0.5,"y":0.4,"width":0.18,"height":0.2}'::jsonb, 0.77, 'ignored', null,
   null, 'Synthetic ignored face.', '{"fixture":true}'::jsonb, '2026-09-10T08:05:00Z',
   '2026-09-10T08:05:00Z');

-- ----------------------------------------------------------------------------
-- 4. guest uploads — approved / approved-video / pending / rejected
--    c…02 is inserted pending and then approved so the activity trigger runs.
-- ----------------------------------------------------------------------------
insert into public.guest_uploads
  (id, guest_name, guest_email, message, photo_urls, video_urls, status, created_at,
   video_visibility, memory_trail, editorial_title, editorial_summary, featured_rank,
   photo_fingerprints, video_fingerprints, rejection_reason)
values
  ('c0000000-0000-4000-8000-000000000001', 'Fixture Guest Alpha', 'alpha@fixtures.example',
   'Synthetic approved photo upload.', array['/images/shared-gallery-new/20250511_181413-2d20.webp'],
   array[]::text[], 'pending', '2026-09-05T10:00:00Z', 'guest_highlights', 'ceremony',
   'Confetti at the exit', 'The kind of guest photo the album was made for.', 1,
   array['fixture-fingerprint-alpha'], array[]::text[], null),
  ('c0000000-0000-4000-8000-000000000002', 'Fixture Guest Beta', 'beta@fixtures.example',
   'Synthetic approved video upload.', array[]::text[], array['/video/christine.mp4'],
   'approved', '2026-09-05T11:00:00Z', 'featured', 'family',
   'A toast from the family', 'Fixture featured guest video for the film page.', 2,
   array[]::text[], array['fixture-video-fingerprint-beta'], null),
  ('c0000000-0000-4000-8000-000000000003', 'Fixture Guest Gamma', 'gamma@fixtures.example',
   'Synthetic pending upload for the moderation queue.',
   array['/images/shared-gallery-new/20250511_181413-6b51.webp'],
   array[]::text[], 'pending', '2026-09-06T10:00:00Z', 'archive_only', 'dance-floor',
   null, null, null, array['fixture-fingerprint-gamma'], array[]::text[], null),
  ('c0000000-0000-4000-8000-000000000004', 'Fixture Guest Delta', 'delta@fixtures.example',
   'Synthetic rejected upload.', array['/images/shared-gallery-new/20250511_180812-0f19.webp'],
   array[]::text[], 'rejected', '2026-09-06T11:00:00Z', 'archive_only', null,
   null, null, null, array['fixture-fingerprint-delta'], array[]::text[],
   'Fixture rejection reason (out-of-focus duplicate).');

-- Fire the approve transition trigger for the first upload (activity feed coverage).
update public.guest_uploads
set status = 'approved'
where id = 'c0000000-0000-4000-8000-000000000001';

-- ----------------------------------------------------------------------------
-- 5. guestbook — 3 notes + 2 replies (reactions live in jsonb, like production)
-- ----------------------------------------------------------------------------
insert into public.guestbook_messages
  (id, name, email, content, media_url, reactions, created_at, ip_address, rate_limited)
values
  ('d0000000-0000-4000-8000-000000000001', 'Fixture Guest Alpha', 'alpha@fixtures.example',
   'Synthetic guestbook note: congratulations to the both of you!',
   null, '{"heart":5,"clap":2}'::jsonb, '2026-09-07T09:00:00Z', '203.0.113.10', false),
  ('d0000000-0000-4000-8000-000000000002', 'Fixture Guest Beta', 'beta@fixtures.example',
   'Synthetic guestbook note: thank you for a beautiful evening.',
   null, '{"heart":3}'::jsonb, '2026-09-07T09:05:00Z', '203.0.113.10', false),
  ('d0000000-0000-4000-8000-000000000003', 'Fixture Family', 'family@fixtures.example',
   'Synthetic guestbook note: we love you both.',
   '/images/couple/austin.webp', '{"cry":2,"heart":8}'::jsonb, '2026-09-07T09:10:00Z',
   '203.0.113.11', false);

insert into public.guestbook_comments (id, message_id, author, content, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Fixture Reply One', 'Synthetic reply on the first fixture note.', '2026-09-07T10:00:00Z'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002',
   'Fixture Reply Two', 'Synthetic reply on the second fixture note.', '2026-09-07T10:05:00Z');

-- ----------------------------------------------------------------------------
-- 6. guest identities + photo claims (pending / approved / rejected)
-- ----------------------------------------------------------------------------
insert into public.guest_identities
  (id, email, session_id, display_name, is_verified, created_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'alpha@fixtures.example',
   'fixture-session-alpha', 'Fixture Guest Alpha', true, '2026-09-08T09:00:00Z'),
  ('f0000000-0000-4000-8000-000000000002', 'beta@fixtures.example',
   'fixture-session-beta', 'Fixture Guest Beta', false, '2026-09-08T09:05:00Z');

insert into public.photo_claims
  (id, guest_identity_id, photo_id, face_id, claim_type, status, rejection_reason,
   created_at, updated_at)
values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', null, 'upload', 'approved', null,
   '2026-09-08T10:00:00Z', '2026-09-08T10:05:00Z'),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001',
   'face', 'pending', null, '2026-09-08T10:10:00Z', '2026-09-08T10:10:00Z'),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000009', null, 'upload', 'rejected',
   'Fixture claim rejection reason.', '2026-09-08T10:20:00Z', '2026-09-08T10:25:00Z');

-- ----------------------------------------------------------------------------
-- 7. guest face-tagging batches (prepared/synced pipeline)
-- ----------------------------------------------------------------------------
insert into public.guest_face_tagging_batches
  (id, batch_key, label, status, exportable_upload_count, exportable_photo_count,
   synced_photo_count, skipped_photo_count, last_error, notes, metadata,
   created_by_user_id, created_by_email, synced_by_user_id, synced_by_email,
   last_synced_at, created_at, updated_at)
values
  ('f5000000-0000-4000-8000-000000000001', 'fixture-tagging-batch-01',
   'Fixture guest face tagging batch', 'synced', 4, 12, 10, 2, null,
   'Synthetic tagging batch for the admin pipeline screens.',
   '{"fixture":true,"algorithm":"fixture"}'::jsonb, null, 'fixture-admin@fixtures.example',
   null, 'fixture-admin@fixtures.example', '2026-09-11T10:00:00Z',
   '2026-09-10T10:00:00Z', '2026-09-11T10:00:00Z');

-- ----------------------------------------------------------------------------
-- 8. guest share tokens — one per fixture guest (drives /guest/:token)
-- ----------------------------------------------------------------------------
insert into public.guest_share_tokens (id, guest_email, token, created_at) values
  ('f6000000-0000-4000-8000-000000000001', 'alpha@fixtures.example',
   'fixture-share-token-alpha-0001', '2026-09-09T09:00:00Z'),
  ('f6000000-0000-4000-8000-000000000002', 'beta@fixtures.example',
   'fixture-share-token-beta-0002', '2026-09-09T09:01:00Z');

-- ----------------------------------------------------------------------------
-- 9. editorial features — one row per slot + history entries
--    (active + open-ended window; the insert trigger mirrors them into the
--     activity feed)
-- ----------------------------------------------------------------------------
insert into public.site_editorial_features
  (id, slot, title, summary, trail, source_type, source_id, source_label, source_url,
   is_active, display_order, metadata, updated_by_user_id, updated_by_email,
   created_at, updated_at, memory_trail, badge_label, cta_label, starts_at, ends_at)
values
  ('f7000000-0000-4000-8000-000000000001', 'home_newest_standout_upload',
   'A confetti exit worth framing', 'Fixture standout guest upload for the home page.',
   null, 'guest_upload', 'c0000000-0000-4000-8000-000000000001', 'Fixture Guest Alpha',
   '/images/shared-gallery-new/20250511_181413-2d20.webp', true, 1,
   '{"fixture":true}'::jsonb, null, 'fixture-admin@fixtures.example',
   '2026-09-12T09:00:00Z', '2026-09-12T09:00:00Z', 'ceremony', 'New', 'View photo', null, null),
  ('f7000000-0000-4000-8000-000000000002', 'home_featured_guestbook_note',
   'The note everyone is reading', 'Fixture featured guestbook note for the home page.',
   null, 'guestbook_message', 'd0000000-0000-4000-8000-000000000001',
   'Fixture Guest Alpha', null, true, 2, '{"fixture":true}'::jsonb, null,
   'fixture-admin@fixtures.example', '2026-09-12T09:01:00Z', '2026-09-12T09:01:00Z',
   null, 'Featured', 'Read note', null, null),
  ('f7000000-0000-4000-8000-000000000003', 'home_moment_of_the_week',
   'Moment of the week', 'Fixture custom editorial moment.', null, 'custom', null,
   null, '/images/engagement/PoradaProposal-309.webp', true, 3,
   '{"fixture":true}'::jsonb, null, 'fixture-admin@fixtures.example',
   '2026-09-12T09:02:00Z', '2026-09-12T09:02:00Z', 'engagement-season', 'Pick',
   'See moment', null, null),
  ('f7000000-0000-4000-8000-000000000004', 'film_featured_guest_video',
   'A family toast', 'Fixture featured guest video for the film page.', null,
   'guest_upload', 'c0000000-0000-4000-8000-000000000002', 'Fixture Guest Beta',
   '/video/christine.mp4', true, 4, '{"fixture":true}'::jsonb, null,
   'fixture-admin@fixtures.example', '2026-09-12T09:03:00Z', '2026-09-12T09:03:00Z',
   'family', 'Guests', 'Watch film', null, null);

insert into public.site_editorial_feature_history
  (id, slot, feature_id, actor_user_id, actor_email, actor_name, change_summary,
   previous_feature, next_feature, created_at)
values
  ('f8000000-0000-4000-8000-000000000001', 'home_newest_standout_upload',
   'f7000000-0000-4000-8000-000000000001', null, 'fixture-admin@fixtures.example',
   'Fixture Admin', 'Created fixture featured upload', '{}'::jsonb,
   '{"title":"A confetti exit worth framing","source_type":"guest_upload"}'::jsonb,
   '2026-09-12T09:04:00Z'),
  ('f8000000-0000-4000-8000-000000000002', 'home_featured_guestbook_note',
   'f7000000-0000-4000-8000-000000000002', null, 'fixture-admin@fixtures.example',
   'Fixture Admin', 'Created fixture featured note', '{}'::jsonb,
   '{"title":"The note everyone is reading","source_type":"guestbook_message"}'::jsonb,
   '2026-09-12T09:05:00Z');

-- ----------------------------------------------------------------------------
-- 10. moderation audit log — one row per entity type
-- ----------------------------------------------------------------------------
insert into public.moderation_audit_log
  (id, entity_type, entity_id, action, actor_user_id, actor_email, actor_name,
   from_status, to_status, summary, metadata, created_at)
values
  ('f9000000-0000-4000-8000-000000000001', 'guest_upload',
   'c0000000-0000-4000-8000-000000000001', 'upload_approved_published', null,
   'fixture-admin@fixtures.example', 'Fixture Admin', 'pending', 'approved',
   'Fixture upload approved and published.', '{"album":"Guest Uploads"}'::jsonb,
   '2026-09-12T10:00:00Z'),
  ('f9000000-0000-4000-8000-000000000002', 'guestbook_message',
   'd0000000-0000-4000-8000-000000000001', 'guestbook_message_deleted', null,
   'fixture-admin@fixtures.example', 'Fixture Admin', null, null,
   'Fixture audit row for a guestbook moderation review.', '{}'::jsonb,
   '2026-09-12T10:05:00Z'),
  ('f9000000-0000-4000-8000-000000000003', 'photo_claim',
   'f1000000-0000-4000-8000-000000000001', 'claim_approved', null,
   'fixture-admin@fixtures.example', 'Fixture Admin', 'pending', 'approved',
   'Fixture claim approved.', '{}'::jsonb, '2026-09-12T10:10:00Z');

-- ----------------------------------------------------------------------------
-- 11. rate-limit log — one row so the admin/debug view has data
--     (the guestbook submit RPC itself is broken in the baseline; see rpc.md §3)
-- ----------------------------------------------------------------------------
insert into public.rate_limit_logs
  (id, ip_address, action, request_count, window_start, created_at)
values
  ('fb000000-0000-4000-8000-000000000001', '203.0.113.10', 'guestbook_submit', 1,
   '2026-11-08T00:00:00Z', '2026-11-08T00:00:05Z');

commit;

-- ----------------------------------------------------------------------------
-- Verification (read-only; expected values after a clean `db reset` + this file)
--   photos                 12 fixture (+12 seed demo) = 24
--   photo_likes             6
--   photo_comments          4 (3 visible, 1 hidden)
--   media_review_batches    1
--   media_review_clusters   2
--   media_review_faces      3
--   guest_uploads           4 (2 approved, 1 pending, 1 rejected)
--   guestbook_messages      3 fixture (+5 baseline demo) = 8
--   guestbook_comments      2
--   guest_identities        2
--   photo_claims            3 (1 approved, 1 pending, 1 rejected)
--   guest_face_tagging_batches 1
--   guest_share_tokens      2
--   site_editorial_features 4 (all four slots, unique)
--   site_editorial_feature_history 2
--   moderation_audit_log    3
--   activity_log            baseline + trigger rows for fixture guestbook (3),
--                           editorial features (4) and the approved-upload
--                           transition (1)
--   rate_limit_logs         1
-- Fast check:
--   select 'photos' t, count(*) from public.photos
--   union all select 'guestbook_messages', count(*) from public.guestbook_messages
--   union all select 'guest_uploads', count(*) from public.guest_uploads
--   union all select 'photo_claims', count(*) from public.photo_claims
--   union all select 'site_editorial_features', count(*) from public.site_editorial_features;
-- ----------------------------------------------------------------------------
