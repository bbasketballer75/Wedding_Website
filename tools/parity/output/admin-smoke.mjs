import { runCompare } from '../compare.mjs'
import { adminCaptureRoutes } from '../config.mjs'

const extraRoutes = adminCaptureRoutes().filter(route => route.id === 'admin-photos')
const { summary } = await runCompare({
  legacyUrl: 'http://127.0.0.1:4174',
  rebuildUrl: 'http://127.0.0.1:4175',
  routes: 'admin-photos',
  matrix: 'desktop',
  themes: 'dark',
  wave: 9,
  extraRoutes,
  outDir: 'tools/parity/output/admin-smoke',
  report: false,
})
for (const shot of summary.shots) {
  console.log(
    JSON.stringify(
      {
        key: shot.key,
        status: shot.status,
        reasons: shot.failureReasons,
        legacy: {
          adminAuth: shot.legacy.adminAuth,
          finalUrl: shot.legacy.finalUrl,
          httpStatus: shot.legacy.httpStatus,
          height: shot.legacy.pageHeightPx,
        },
        rebuild: {
          adminAuth: shot.rebuild.adminAuth,
          finalUrl: shot.rebuild.finalUrl,
          httpStatus: shot.rebuild.httpStatus,
          height: shot.rebuild.pageHeightPx,
        },
        pixelRatio: shot.pixelDiff?.ratio,
        textDiff: shot.textDiff?.status,
        textDiffFields: (shot.textDiff?.differences ?? []).map(d => d.field),
      },
      null,
      1
    )
  )
}
