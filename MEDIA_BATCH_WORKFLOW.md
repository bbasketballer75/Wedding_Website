# Wedding Media Batch Workflow

## Purpose

This workflow prepares, publishes, and reviews a wedding media batch for the live gallery.

It is intentionally local-first and review-first:

- originals stay untouched
- exact duplicates and similar shots are surfaced for curation
- live-photo pairs are grouped
- face clusters are generated for manual naming
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

Publish optimized media plus import rows into the live archive:

```bash
npm run media:batch:publish -- "C:/path/to/working-root"
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

## Notes

- Exact duplicates after the first file in each group are copied into `organized/Review/Exact Duplicates`.
- The face stage uses local model files from `node_modules`, so it does not need a remote model download.
- `media:batch:publish` uploads optimized outputs to the configured remote media bucket and writes non-engagement photo rows into `photos` using relative `/media/...` paths.
- `media:batch:review:push` stores crops and review artifacts in the private `media-review-artifacts` bucket plus the admin staging tables.
- The hardcoded engagement gallery remains the editorial overlay, so publish intentionally skips `Engagement` rows from the batch manifest.
- If you change the source batch, rerun the whole workflow so the cluster and manifest IDs stay aligned.
