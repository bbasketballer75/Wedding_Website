# Gallery Operations

## Purpose

This is the lightweight operating guide for keeping the live gallery intentional after launch.

For large local media prep before import, use `MEDIA_BATCH_WORKFLOW.md`.

## Current Gallery Model

The public gallery is organized around these top-level lanes:

- `All`
- `Professional`
- `Guest Uploads`
- `Engagement`
- `Bach+ette`
- `Wedding Day`

Every item keeps its `source` and also derives a themed `collection`.

That means:

- professional work can still land in `Engagement`, `Bach+ette`, or `Wedding Day`
- guest uploads stay visibly marked as guest content
- guest uploads can still appear inside a themed collection when their metadata supports it

## Ongoing Workflow

1. Open `/admin/photos` and review pending guest uploads.
2. Before approving, fill in the curation fields:
   - caption
   - category
   - tags
   - location
3. Choose the story lane that should publish the upload:
   - engagement / proposal -> `Engagement`
   - bach / bachelor / bachelorette / ette -> `Bach+ette`
   - everything else defaults into `Wedding Day`
   - use `Guest Uploads` when you want it to stay in the general guest lane only
4. Approving now publishes the photo URLs directly into the live `photos` table as `source=guest`.
5. Keep `source=guest` intact so the gallery still labels the item as a guest upload.
6. Re-check the gallery after approval to make sure the item appears in the expected tabs.

## Guest Face Tagging Loop

Once guest uploads are approved and live, you can run them through the external digiKam face-tagging loop:

1. Export the current published guest photos into a local tagging root:

```bash
npm run media:guest:tag:export -- "C:/path/to/guest-tagging-root"
```

2. Open `<guest-tagging-root>/organized` in digiKam.
3. Detect and recognize faces, confirm names in `People`, and run `Album -> Write Metadata to Files`.
4. Re-import those face tags and sync them back into the live gallery:

```bash
npm run media:batch:faces:digikam -- "C:/path/to/guest-tagging-root"
npm run media:guest:tag:sync -- "C:/path/to/guest-tagging-root"
```

5. Reload `/gallery` to verify the new guest face tags and people filters.

## Batch Publish Workflow

For the wedding master archive and people-tag rollout:

1. Run the local prep stages from `MEDIA_BATCH_WORKFLOW.md`.
2. If you are tagging people in digiKam, tag the `organized/` folder there, write metadata to files, and run `npm run media:batch:faces:digikam -- "<working-root>"` before export/publish.
3. Run `npm run media:batch:publish -- "<working-root>"` to upload optimized media and sync non-engagement rows into `photos`.
4. Run `npm run media:batch:review:push -- "<working-root>"` to stage face-review artifacts for the admin app when you still want an in-app review pass.
5. Open `/admin/review` to:
   - confirm names
   - ignore uncertain clusters
   - request splits
   - merge duplicate people clusters
   - sync manifest category/tag suggestions
   - apply confirmed face tags into live `photos.faces`
6. Keep the engagement seed curated in code; the publish command intentionally skips `Engagement` batch rows so the editorial overlay remains intact.

## Curation Guidance

- Use `Professional` for polished photographer coverage and editorial portraits.
- Use `Guest Uploads` for candid phone and personal-camera moments.
- Use `Engagement`, `Bach+ette`, and `Wedding Day` as story lanes, not source lanes.
- Prefer a smaller number of high-signal approved guest moments over flooding the gallery with near-duplicates.

## Verification

After a batch of approvals or new content:

```bash
npm run verify:deployed
npm run test:e2e:public
```

Manual spot-check:

- the collection tabs still make sense
- guest uploads are visibly labeled as guest content
- the themed collections still feel intentional
- empty or partially filled collections still read as polished, not broken
