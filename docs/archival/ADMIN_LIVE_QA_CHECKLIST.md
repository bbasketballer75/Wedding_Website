# Admin Live QA Checklist

Use this checklist only with a real Supabase admin account. Keep credentials in an ignored local
environment file and run `npm run verify:admin:live` before manual checks.

## Automated Smoke

- [ ] Set `ADMIN_SMOKE_EMAIL` and `ADMIN_SMOKE_PASSWORD` locally.
- [ ] Run `npm run verify:admin:live`.
- [ ] Confirm the script reaches `/admin` and sees the admin header/sign-out control.

## Manual Moderation Flow

- [ ] Sign in at `/admin/login`.
- [ ] Open `/admin/photos` and approve one pending upload.
- [ ] Reject one pending upload with a clear reason.
- [ ] Open `/admin/guestbook` and delete or hide a test guestbook message.
- [ ] Open `/admin/featured` and save one featured-content slot.
- [ ] Open `/admin/audit` and confirm the moderation actions are visible.
- [ ] Sign out and confirm `/admin` redirects back to `/admin/login`.

## Notes

- Do not use the Supabase service-role key in browser or local Playwright flows.
- If no safe pending content exists, create test content first and remove it during cleanup.
