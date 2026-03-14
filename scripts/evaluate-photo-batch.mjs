import path from 'node:path'
import {
  assertExists,
  buildMarkdownTable,
  readJson,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const workingRoot = process.argv[2]
const fixtureArg = process.argv[3]

if (!workingRoot) {
  console.error('Usage: node scripts/evaluate-photo-batch.mjs <working-root> [fixture-json]')
  process.exit(1)
}

function combinationPairs(items) {
  const pairs = new Set()

  for (let index = 0; index < items.length; index += 1) {
    for (let candidateIndex = index + 1; candidateIndex < items.length; candidateIndex += 1) {
      const pair = [items[index], items[candidateIndex]].sort().join(' <> ')
      pairs.add(pair)
    }
  }

  return pairs
}

function toGroupPairSet(groups) {
  const set = new Set()

  for (const group of groups) {
    for (const pair of combinationPairs(group)) {
      set.add(pair)
    }
  }

  return set
}

function scoreSets(expectedSet, actualSet) {
  const truePositives = [...expectedSet].filter((item) => actualSet.has(item))
  const falseNegatives = [...expectedSet].filter((item) => !actualSet.has(item))
  const falsePositives = [...actualSet].filter((item) => !expectedSet.has(item))
  const precision = actualSet.size === 0 ? 1 : truePositives.length / actualSet.size
  const recall = expectedSet.size === 0 ? 1 : truePositives.length / expectedSet.size
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

  return {
    expectedCount: expectedSet.size,
    actualCount: actualSet.size,
    matchedCount: truePositives.length,
    missing: falseNegatives,
    unexpected: falsePositives,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1: Number(f1.toFixed(3)),
  }
}

function normalizeLivePhotoPairs(entries) {
  return new Set(
    entries.flatMap((entry) =>
      (entry.stills || []).map((still) => `${entry.clip} => ${still}`),
    ),
  )
}

function scoreCoverCandidates(expected, actual) {
  const buckets = new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})])
  const rows = [...buckets].sort().map((bucketKey) => {
    const expectedList = expected?.[bucketKey] ?? []
    const actualList = actual?.[bucketKey] ?? []
    const matches = expectedList.filter((item) => actualList.includes(item))

    return {
      bucketKey,
      expectedCount: expectedList.length,
      actualCount: actualList.length,
      matchedCount: matches.length,
      missing: expectedList.filter((item) => !actualList.includes(item)),
      unexpected: actualList.filter((item) => !expectedList.includes(item)),
      precision: actualList.length === 0 ? 1 : Number((matches.length / actualList.length).toFixed(3)),
      recall: expectedList.length === 0 ? 1 : Number((matches.length / expectedList.length).toFixed(3)),
    }
  })

  const precision = rows.length === 0 ? 1 : rows.reduce((sum, row) => sum + row.precision, 0) / rows.length
  const recall = rows.length === 0 ? 1 : rows.reduce((sum, row) => sum + row.recall, 0) / rows.length

  return {
    buckets: rows,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
  }
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const fixturePath = fixtureArg
    ? path.resolve(fixtureArg)
    : path.join(absoluteWorkingRoot, 'review', 'evaluation-fixture.json')
  const analysisPath = path.join(absoluteWorkingRoot, 'catalog', 'wedding-master-analysis.json')
  const faceClustersPath = path.join(absoluteWorkingRoot, 'faces', 'face-clusters.json')
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')

  await Promise.all([
    assertExists(analysisPath, 'analysis report'),
    assertExists(faceClustersPath, 'face clusters'),
    assertExists(fixturePath, 'evaluation fixture'),
  ])

  const [analysis, faceClusters, fixture] = await Promise.all([
    readJson(analysisPath),
    readJson(faceClustersPath),
    readJson(fixturePath),
  ])

  const actualDuplicatePairs = toGroupPairSet((analysis.exactDuplicateGroups || []).map((group) => group.files || []))
  const expectedDuplicatePairs = toGroupPairSet(fixture.exactDuplicateGroups || [])

  const actualSimilarPairs = toGroupPairSet(
    (analysis.similarShotGroups || []).map((group) => (group.files || []).map((file) => file.relativePath)),
  )
  const expectedSimilarPairs = toGroupPairSet(fixture.similarShotGroups || [])

  const actualLivePairs = normalizeLivePhotoPairs(analysis.livePhotoGroups || [])
  const expectedLivePairs = normalizeLivePhotoPairs(fixture.livePhotoPairs || [])

  const actualCoverBuckets = Object.fromEntries(
    (analysis.coverCandidates || []).map((bucket) => [
      bucket.bucketKey,
      (bucket.images || []).map((image) => image.relativePath),
    ]),
  )

  const actualFacePairs = toGroupPairSet(
    (faceClusters || []).map((cluster) => (cluster.members || []).map((member) => member.sourceRelativePath)),
  )
  const expectedFacePairs = toGroupPairSet((fixture.faceClusters || []).map((cluster) => cluster.members || []))

  const report = {
    workingRoot: absoluteWorkingRoot,
    fixturePath,
    generatedAt: new Date().toISOString(),
    exactDuplicates: scoreSets(expectedDuplicatePairs, actualDuplicatePairs),
    similarShots: scoreSets(expectedSimilarPairs, actualSimilarPairs),
    livePhotos: scoreSets(expectedLivePairs, actualLivePairs),
    faceClusters: scoreSets(expectedFacePairs, actualFacePairs),
    coverCandidates: scoreCoverCandidates(fixture.coverCandidates || {}, actualCoverBuckets),
  }

  const reportPath = path.join(publishRoot, 'wedding-photo-evaluation-report.json')
  const summaryPath = path.join(publishRoot, 'wedding-photo-evaluation-report.md')

  await writeJson(reportPath, report)
  await writeMarkdown(summaryPath, [
    '# Wedding Photo Batch Evaluation',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    `Fixture: \`${fixturePath}\``,
    '',
    buildMarkdownTable(
      [
        {
          Metric: 'Exact duplicates',
          Precision: report.exactDuplicates.precision,
          Recall: report.exactDuplicates.recall,
          F1: report.exactDuplicates.f1,
        },
        {
          Metric: 'Similar shots',
          Precision: report.similarShots.precision,
          Recall: report.similarShots.recall,
          F1: report.similarShots.f1,
        },
        {
          Metric: 'Live photo pairing',
          Precision: report.livePhotos.precision,
          Recall: report.livePhotos.recall,
          F1: report.livePhotos.f1,
        },
        {
          Metric: 'Face clustering',
          Precision: report.faceClusters.precision,
          Recall: report.faceClusters.recall,
          F1: report.faceClusters.f1,
        },
      ],
      ['Metric', 'Precision', 'Recall', 'F1'],
    ),
    '',
    `Average cover precision: **${report.coverCandidates.precision}**`,
    `Average cover recall: **${report.coverCandidates.recall}**`,
    '',
    '## Follow-up',
    '- Review the JSON report for missing and unexpected pairings before changing thresholds.',
    '- Preserve accepted fixtures so future runs can detect regressions instead of relying on spot checks.',
  ])

  console.log(`Wrote evaluation report to ${reportPath}`)
}

await main()
