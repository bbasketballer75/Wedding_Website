# Wedding Media Batch Workflow

## Purpose

This workflow prepares, publishes, and reviews a wedding media batch for the live gallery.

It is intentionally local-first and review-first:

- originals stay untouched
- exact duplicates and similar shots are surfaced for curation
- live-photo pairs are grouped
- face clusters are generated for manual naming
- external digiKam face tags can replace the local face-cluster stage
- confirmed names flow into an import-ready manifest
- publish and review staging happen only when you run the explicit post-prep commands

## Source Layout

The current workflow is tuned for these top-level folders:

- `Mr. and Mrs. Porada - MikaylaByersPhotography`
- `Guest-Shared Wedding Gallery`
- `Bachelor+ette`

Other folders still process, but they land in review/unsorted paths and usually need manual cleanup.

## Main Command

Run the full local prep flow:

```bash
npm run media:batch:prepare -- "C:/path/to/source-root" "C:/path/to/working-root"
```

The working root will be populated with:

- `catalog/`
- `faces/`
- `organized/`
- `optimized/`
- `publish/`

`media:batch:prepare` still runs the built-in local face detector. If digiKam is your source of truth for people tags, use the manual workflow below so the imported XMP metadata replaces the auto-generated face stage.

## Stage Commands

Catalog only:

```bash
npm run media:batch:catalog -- "C:/path/to/source-root" "C:/path/to/working-root/catalog"
```

Analyze catalog output:

```bash
npm run media:batch:analyze -- "C:/path/to/source-root" "C:/path/to/working-root/catalog"
```

Generate face clusters and the editable review file:

```bash
npm run media:batch:faces -- "C:/path/to/source-root" "C:/path/to/working-root"
```

Import confirmed face names and regions from digiKam XMP metadata after tagging the `organized/` folder:

```bash
npm run media:batch:faces:digikam -- "C:/path/to/working-root"
```

Copy originals into a review-friendly organized structure:

```bash
npm run media:batch:organize -- "C:/path/to/source-root" "C:/path/to/working-root"
```

Build display and thumbnail assets:

```bash
npm run media:batch:optimize -- "C:/path/to/working-root/organized" "C:/path/to/working-root/optimized"
```

Export the import-ready manifest after review:

```bash
npm run media:batch:export -- "C:/path/to/working-root"
```

Export currently published guest-upload photos into a local digiKam tagging root:

```bash
npm run media:guest:tag:export -- "C:/path/to/guest-tagging-root"
```

Publish optimized media plus import rows into the live archive:

```bash
npm run media:batch:publish -- "C:/path/to/working-root"
```

Sync confirmed guest face tags from a digiKam guest-tagging root back into the live gallery rows:

```bash
npm run media:guest:tag:sync -- "C:/path/to/guest-tagging-root"
```

Push the private face-review bundle into admin staging:

```bash
npm run media:batch:review:push -- "C:/path/to/working-root"
```

Score the current run against a labeled evaluation fixture:

```bash
npm run media:batch:evaluate -- "C:/path/to/working-root" "C:/path/to/evaluation-fixture.json"
```

## Generated Artifacts

### `catalog/`

- `wedding-master-inventory.json`: base media inventory with capture date, location, quality hints, and source/collection suggestions
- `wedding-master-inventory.csv`: spreadsheet-friendly inventory
- `wedding-master-summary.md`: per-folder summary
- `wedding-master-analysis.json`: duplicate groups, similar-shot groups, live-photo groups, cover candidates, and story groups
- `wedding-master-analysis.md`: readable analysis report
- `wedding-master-inventory.enriched.json`: inventory annotated with duplicate/similar/live-photo/cover memberships

### `faces/`

- `face-detections.json`: raw detected faces per image
- `face-clusters.json`: grouped face clusters
- `face-annotations-by-photo.json`: per-photo face coordinates for later import
- `face-review.json`: editable naming and merge file
- `face-clusters.md`: readable review summary
- `crops/<cluster-id>/`: face crop thumbnails grouped by cluster

When you use `media:batch:faces:digikam`, these files are regenerated from digiKam metadata and marked confirmed automatically.

### `organized/`

- `organization-manifest.json`: copy manifest linking source media to organized outputs
- `organization-summary.md`: review summary

### `optimized/`

- `optimized-manifest.json`: optimized outputs plus source linkage
- `optimized-summary.md`: payload summary
- optimized display `.webp` files
- `_thumbs/` thumbnail `.webp` files

### `publish/`

- `wedding-photo-import-manifest.json`: import-ready rows using confirmed metadata only
- `wedding-photo-import-manifest.md`: readable summary
- `wedding-photo-publish-report.json`: remote upload and `photos` sync report
- `wedding-photo-publish-report.md`: readable publish summary
- `wedding-photo-review-push-report.json`: admin staging upload report
- `wedding-photo-review-push-report.md`: readable staging summary
- `wedding-photo-evaluation-report.json`: regression-style scoring report
- `wedding-photo-evaluation-report.md`: readable evaluation summary
- `guest-photo-tagging-export-report.json`: guest-photo export report for digiKam tagging
- `guest-photo-tagging-export-report.md`: readable guest-photo export summary
- `guest-photo-face-sync-report.json`: metadata-only guest face sync report
- `guest-photo-face-sync-report.md`: readable metadata-only guest face sync summary

## Review Workflow

1. Run `catalog`, `analyze`, and `faces`.
2. Review duplicate groups and similar-shot groups in `catalog/`.
3. Open face crops under `faces/crops/`.
4. Edit `faces/face-review.json`.
5. Fill in `confirmedName` only when a cluster is trustworthy.
6. Use `mergeIntoClusterId` when two clusters are the same person.
7. Leave uncertain people as pending so they do not flow into the import manifest.
8. Re-run `media:batch:export` after review changes.
9. Run `media:batch:publish` to sync remote media plus non-engagement `photos` rows.
10. Run `media:batch:review:push` to load the pending face-review batch into `/admin/review`.
11. Open `/admin/review` to confirm names, request splits, merge clusters, sync manifest metadata, and apply confirmed face tags.
12. Run `media:batch:evaluate` against your labeled fixture when you tune thresholds.

## digiKam Workflow

Use this when you want face detection, grouping, and naming to happen outside the website.

1. Run `npm run media:batch:catalog -- "<source-root>" "<working-root>/catalog"`.
2. Run `npm run media:batch:analyze -- "<source-root>" "<working-root>/catalog"`.
3. Run `npm run media:batch:organize -- "<source-root>" "<working-root>"`.
4. Open digiKam and add `<working-root>/organized` as the collection root.
5. In digiKam, open `Settings -> Configure digiKam -> Metadata` and enable:
   - `Image Tags`
   - `Face Tags (including face areas)`
6. Run `Tools -> Detect and Recognize Faces`.
7. Use the `People` view to confirm or rename faces in bulk.
8. Run `Item -> Write Metadata to Files` or `Album -> Write Metadata to Files`.
9. Run `npm run media:batch:faces:digikam -- "<working-root>"`.
10. Run `npm run media:batch:optimize -- "<working-root>/organized" "<working-root>/optimized"`.
11. Run `npm run media:batch:export -- "<working-root>"`.
12. Run `npm run media:batch:publish -- "<working-root>"`.

### digiKam Notes

- The importer reads adjacent XMP sidecars first and then falls back to embedded XMP when it can.
- Exact-duplicate review copies under `organized/Review/Exact Duplicates` are skipped automatically.
- Imported digiKam names become confirmed `faces` metadata automatically in the publish manifest.
- Re-run `media:batch:faces:digikam` any time you change names in digiKam and write metadata again.

## Guest Upload Tagging Loop

Use this when approved guest-upload photos should go through the guest face-tagging workflow and then stage a cleanup pass in `/admin/review` without re-uploading media.

1. Approve guest uploads into the gallery from `/admin/photos`.
2. Run `npm run media:guest:tag:export -- "<working-root>"` or use the `Guest Face Tagging` panel in `/admin/photos` to download a guest tagging batch.
3. Open the extracted `organized/` folder in digiKam.
4. Detect and recognize faces, confirm names in `People`, and run `Album -> Write Metadata to Files`.
5. Run `npm run media:batch:faces:digikam -- "<working-root>"`.
6. Run `npm run media:guest:review:push -- "<working-root>"`.
7. Open `/admin/review` and use the staged guest-upload batch to review, confirm, or clean up names.
8. Use `Apply Confirmed Faces` in `/admin/review` to write the confirmed names back into the live `photos.faces` metadata.

### Guest Loop Notes

- the browser export downloads photos from approved `guest_uploads`, not the full wedding archive.
- the export cross-references the live `photos` table by URL when those guest uploads are already published, so professional imports stay out of this queue.
- duplicate-only and video-only approvals are skipped automatically.
- `media:guest:review:push` stages guest-upload face review into the same admin review tables used by `/admin/review`.
- `Apply Confirmed Faces` is now the primary path for pushing confirmed guest names back into the live gallery.
- this loop is metadata-only; it does not re-upload optimized media objects.
- the local `media:guest:tag:sync` command still exists as a fallback path if you need to bypass `/admin/review` and sync digiKam metadata directly.

## Notes

- Exact duplicates after the first file in each group are copied into `organized/Review/Exact Duplicates`.
- The face stage uses local model files from `node_modules`, so it does not need a remote model download.
- The digiKam importer reads MWG/XMP face regions and preserves face boxes alongside hotspot centers in `photos.faces`.
- `media:batch:publish` uploads optimized outputs to the configured remote media bucket and writes non-engagement photo rows into `photos` using relative `/media/...` paths.
- `media:batch:review:push` stores crops and review artifacts in the private `media-review-artifacts` bucket plus the admin staging tables.
- The hardcoded engagement gallery remains the editorial overlay, so publish intentionally skips `Engagement` rows from the batch manifest.
- If you change the source batch, rerun the whole workflow so the cluster and manifest IDs stay aligned.
