# contracts/fixtures/ — deterministic API fixtures

These files are PORTED, not invented. `tools/extract-content/fixtures.mjs` bundles the frozen
end-to-end mocks (`tests/e2e/support/mockData.ts`, `adminMockData.ts`, plus the inline
`guest_share_tokens` / `guest_identities` responses in `publicSite.ts`) and writes them here so the
parity harness and rebuild tests can consume plain JSON without Playwright or TypeScript.

Regenerate (and verify determinism) with:

```bash
node tools/extract-content/fixtures.mjs          # write
node tools/extract-content/fixtures.mjs --check  # exit 1 if the committed files drifted
```

## Endpoint → fixture map

| Fixture             | Source mock                                                                                                 | Represents                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `photos.json`       | `mockData.galleryPhotos`                                                                                    | `GET /rest/v1/photos` (6 rows, verbatim)                                                  |
| `guestbook.json`    | `mockData.guestbookMessagesWithComments`, `adminMockData.adminGuestbookMessages`, `guestbookSubmitResponse` | `GET` guestbook RPC/table feed (public full copy + admin view copy) + submit RPC response |
| `guestUploads.json` | `mockData.approvedGuestUploads`, `adminMockData.pendingUploads`, `mockData.guestUploadInsertResponse`       | public approved feed, admin pending queue, insert response                                |
| `activity.json`     | `mockData.mockActivityLog`                                                                                  | `GET /rest/v1/activity_log`                                                               |
| `editorial.json`    | `adminMockData.featuredSlots`                                                                               | `GET /rest/v1/site_editorial_features` (four slots)                                       |
| `claims.json`       | `mockPendingClaims`, `mockApprovedClaims`, `mockRejectedClaims`                                             | `GET /rest/v1/photo_claims` by status                                                     |
| `guestTokens.json`  | inline mocks in `publicSite.ts`                                                                             | `guest_share_tokens` lookup, `guest_identities` (with/without claims)                     |
| `adminSession.json` | `adminMockData.adminSession/adminUser/auditLogEntries/dashboard*Count`, `adminSite.ts` storage-key shape    | seeded admin auth session + dashboard counts + moderation audit log                       |

## Deliberate differences from the Playwright helpers

1. **No test runner coupling.** Arrays that the mocks export verbatim are copied verbatim; the only
   reshaping is grouping related responses under one object (e.g. `guestUploads.approved` vs
   `.pending`) because the required fixture set has one file per resource family.
2. **`adminSession.session.expires_at` is pinned.** The Playwright helper computes it from
   `Date.now()`, which would make a committed artifact change on every run. It is pinned to one hour
   after `contracts/ui.json.fixedNow` — the single shared capture clock. Everything else in
   `adminSession.json` is the mock verbatim.
3. **`adminSession.storageKey`** is derived exactly like `adminSite.ts` does it:
   `` `sb-${projectRef}-auth-token` `` from the frozen test's default Supabase URL. This is the
   public project ref already shipped in the build (not a secret); it is needed to seed
   `localStorage` in a real browser.
4. **`guestTokens.invalidToken`** is the _path_ token value (`invalid-token`), i.e. the value a
   visitor would see in `/guest/invalid-token`. The Playwright mock matches the PostgREST query
   value `eq.invalid-token`; the `eq.` prefix is transport, not data.

## Invariants

- Values are IDENTICAL to the frozen e2e mocks (byte values for numbers/strings, same ordering).
- No real guest data, emails, tokens, or credentials: every value here is synthetic and already
  committed in `tests/e2e/support/`.
- Regenerating on the unchanged frozen app produces byte-identical files (the script's `--check`
  mode is the regression gate).
