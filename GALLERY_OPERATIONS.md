# Gallery Operations

## Purpose

This is the lightweight operating guide for keeping the live gallery intentional after launch.

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

1. Approve guest uploads that should become public.
2. Make sure the approved record has useful metadata:
   - caption
   - category
   - tags
   - location
3. Use that metadata to guide collection placement:
   - engagement / proposal -> `Engagement`
   - bach / bachelor / bachelorette / ette -> `Bach+ette`
   - everything else defaults into `Wedding Day`
4. Keep `source=guest` intact so the gallery still labels the item as a guest upload.
5. Re-check the gallery after approval to make sure the item appears in the expected tabs.

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
