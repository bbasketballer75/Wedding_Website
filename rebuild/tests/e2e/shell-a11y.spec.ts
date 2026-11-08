import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Browser-level accessibility gate for the rebuilt shell (Wave 2, W2-3).
 *
 * The spec drives the production build (playwright.config.ts builds + serves it
 * on 5175) and exercises the catch-all 404 shell at `/people`, which is the one
 * route that mounts the full shared chrome (Header + main + Footer) in Wave 1/2.
 *
 * Contract:
 *  - axe: zero CRITICAL violations in every viewport/theme (strict, no exception);
 *    zero SERIOUS violations except ONE documented inherited defect described below;
 *    the light theme must be completely clean (0 violations of any impact).
 *  - keyboard: skip link is the first Tab stop and activation moves focus to the
 *    named <main>; the desktop header order is logo -> 5 nav links -> theme toggle,
 *    and the toggle flips the theme with both Enter and Space; on mobile the
 *    hamburger opens the menu with Space, Escape closes it and restores focus to
 *    the trigger, and a second activation also closes it with focus retained.
 *  - landmarks: exactly one <main>, with an accessible name, plus the banner and
 *    contentinfo landmarks.
 *
 * Determinism: no sleeps anywhere — role/state expectations poll (`expect`), the
 * context blocks service workers and emulates `prefers-reduced-motion: reduce`
 * (the shell collapses CSS transitions under it), and every test waits for
 * `document.fonts.ready` plus `waitForEntranceMotion` before scanning/measuring.
 *
 * Why the motion settle matters to axe: the shell's framer-motion entrance
 * animations (header 0.45s, page 0.6s) keep inline `opacity` < 1 for a moment
 * after first paint. axe measures computed colours, so a half-transparent page
 * produces blended foreground/background pairs and false `color-contrast`
 * failures on every heading/paragraph/button. The gate must scan the settled
 * page, never the entrance frame.
 */

const NOT_FOUND_PATH = '/people'
const HEADER_SELECTOR = '[data-testid="public-header"]'
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }

/**
 * The single documented SERIOUS axe exception (owner-approved, Wave 2).
 *
 * Inherited frozen defect (risk register R27): the frozen 404 page hard-codes
 * the light `cream-50` surface while the DARK theme palette is applied to the
 * shared shell. On `/people` in the dark theme this mismatches two regions:
 *  - the fixed header uses light-on-light nav labels (`--ui-muted` /
 *    `--ui-accent-strong` over the cream page), and
 *  - the 404 main content's secondary "Back to Home" button uses the dark
 *    theme `--ui-accent-strong` gold on the cream page (1.38:1).
 * axe reports both as `color-contrast` (impact: serious), 5 nodes total.
 *
 * Why it is tolerated instead of fixed: fixing it changes 404 dark-theme
 * pixels, which the parity gate forbids until cutover. It is a deliberate,
 * owner-approved post-cutover visual change (R27), NOT part of the greenfield
 * port. The exception is deliberately narrow:
 *  - only the `color-contrast` rule,
 *  - only on this route and the dark theme,
 *  - only when EVERY contrast failure on the page is inside the two known
 *    mismatched regions (`[data-testid="public-header"]` + `#main-content`);
 *    a contrast node anywhere else (e.g. the footer) still fails.
 * Any other serious rule, route, theme or region still fails the gate.
 */
const DOCUMENTED_DARK_CONTRAST_EXCEPTION = {
  ruleId: 'color-contrast',
  route: NOT_FOUND_PATH,
  theme: 'dark',
  regions: [HEADER_SELECTOR, '#main-content'],
} as const

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' })

/** Deterministic shell boot: load the 404, wait for chrome, fonts and motion. */
async function gotoShell(page: Page, { theme = 'dark' }: { theme?: 'dark' | 'light' } = {}) {
  if (theme === 'light') {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ui-store',
        JSON.stringify({ state: { currentTheme: 'light' }, version: 0 })
      )
    })
  }
  const response = await page.goto(NOT_FOUND_PATH, { waitUntil: 'load' })
  expect(response?.status(), 'the SPA catch-all serves the built index.html').toBe(200)
  await expect(page.getByTestId('public-header')).toBeVisible()
  await expect(page.getByTestId('public-footer')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.evaluate(() => document.fonts.ready)
  await waitForEntranceMotion(page)
}

/**
 * The shell's framer-motion entrance animations (header 0.45s, page 0.6s) leave
 * inline `opacity` < 1 while running. axe must not measure a half-transparent
 * page (it would compute blend colours and report false contrast failures), so
 * wait for every motion-controlled element to reach its final state.
 */
async function waitForEntranceMotion(page: Page) {
  await page.waitForFunction(() => {
    const animated = [...document.querySelectorAll<HTMLElement>('[style*="opacity"]')]
    if (animated.length === 0) return false
    return animated.every(
      element => Number.parseFloat(window.getComputedStyle(element).opacity) >= 0.999
    )
  })
}

function formatViolations(
  severity: string,
  violations: ReadonlyArray<{ id: string; impact?: string | null; nodes: unknown[] }>
): string {
  if (violations.length === 0) return 'none'
  return violations
    .map(
      violation =>
        `${severity}:${violation.id}:${violation.impact}:${violation.nodes.length}node(s)`
    )
    .join(', ')
}

/**
 * Count axe `color-contrast` nodes inside the given regions. Comparing this
 * with the full-page count proves "every contrast failure is inside the
 * documented regions" without relying on brittle CSS-selector resolution of
 * axe node targets.
 */
async function countColorContrastNodes(page: Page, regions: readonly string[]) {
  let builder = new AxeBuilder({ page }).withRules('color-contrast')
  for (const region of regions) builder = builder.include(region)
  const results = await builder.analyze()
  return results.violations
    .filter(violation => violation.id === 'color-contrast')
    .reduce((count, violation) => count + violation.nodes.length, 0)
}

/**
 * Dark-theme gate: critical is strict; serious may only be the documented
 * inherited header/404 contrast exception, and only when the full-page
 * contrast node set is entirely contained in the documented regions.
 */
async function expectDarkThemeGate(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const critical = results.violations.filter(violation => violation.impact === 'critical')
  expect(
    critical.map(violation => `${violation.id} (${violation.nodes.length} node(s))`),
    `critical axe violations: ${formatViolations('critical', critical)}`
  ).toEqual([])

  const allContrastNodes = results.violations
    .filter(violation => violation.id === 'color-contrast')
    .reduce((count, violation) => count + violation.nodes.length, 0)
  const knownRegionContrastNodes = await countColorContrastNodes(
    page,
    DOCUMENTED_DARK_CONTRAST_EXCEPTION.regions
  )
  const everyContrastFailureIsInKnownRegions =
    allContrastNodes > 0 && allContrastNodes === knownRegionContrastNodes

  const blockingSerious: string[] = []
  const documented: string[] = []
  for (const violation of results.violations) {
    if (violation.impact !== 'serious') continue
    const isDocumented =
      violation.id === DOCUMENTED_DARK_CONTRAST_EXCEPTION.ruleId &&
      DOCUMENTED_DARK_CONTRAST_EXCEPTION.route === NOT_FOUND_PATH &&
      DOCUMENTED_DARK_CONTRAST_EXCEPTION.theme === 'dark' &&
      everyContrastFailureIsInKnownRegions
    if (isDocumented) {
      documented.push(`${violation.id}:${violation.nodes.length}node(s)`)
    } else {
      blockingSerious.push(`${violation.id} (${violation.help})`)
    }
  }
  expect(
    blockingSerious,
    `serious axe violations outside the documented exception: ${blockingSerious.join('; ')}`
  ).toEqual([])

  test.info().annotations.push({
    type: 'axe',
    description:
      `/people dark (${page.viewportSize()?.width}px): critical=${critical.length}, ` +
      `serious-tolerated=${documented.join('+') || '0'} ` +
      `(contrast nodes in documented regions: ${knownRegionContrastNodes}/${allContrastNodes}), ` +
      `serious-blocking=${blockingSerious.length}, all-violations=${results.violations.length}`,
  })
}

/** Light-theme gate: completely clean — zero violations of any impact. */
async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const summary = results.violations.map(
    violation => `${violation.id}:${violation.impact}:${violation.nodes.length}node(s)`
  )
  expect(summary, `axe violations in the light theme: ${summary.join(', ')}`).toEqual([])
  test.info().annotations.push({
    type: 'axe',
    description: `/people light (${page.viewportSize()?.width}px): 0 violations`,
  })
}

async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused()
  await expect
    .poll(
      () =>
        locator.evaluate(element => {
          const styles = window.getComputedStyle(element)
          const outlineWidth = Number.parseFloat(styles.outlineWidth || '0')
          if (styles.outlineStyle !== 'none' && outlineWidth > 0) return true
          const shadow = styles.boxShadow
          if (!shadow || shadow === 'none') return false
          return [...shadow.matchAll(/rgba?\(([^)]+)\)/g)].some(match => {
            const values = match[1]
            if (values === undefined) return false
            const parts = values.split(',').map(part => Number.parseFloat(part.trim()))
            const alpha = parts.length === 4 ? (parts[3] ?? 0) : 1
            return Number.isFinite(alpha) && alpha > 0
          })
        }),
      { message: 'the focused element exposes a visible focus indicator' }
    )
    .toBe(true)
}

const bodyOverflow = (page: Page) => page.evaluate(() => document.body.style.overflow)

/* -------------------------------------------------------------------------- */
/* axe                                                                        */
/* -------------------------------------------------------------------------- */

test.describe('axe — 404 shell accessibility scan', () => {
  test.describe('desktop 1440x900', () => {
    test.use({ viewport: DESKTOP_VIEWPORT })

    test('light theme is clean (0 violations of any impact)', async ({ page }) => {
      await gotoShell(page, { theme: 'light' })
      await expectNoAxeViolations(page)
    })

    test('dark theme has no critical and only the documented header contrast', async ({ page }) => {
      await gotoShell(page, { theme: 'dark' })
      await expectDarkThemeGate(page)
    })
  })

  test.describe('mobile 390x844', () => {
    test.use({ viewport: MOBILE_VIEWPORT })

    test('light theme is clean (0 violations of any impact)', async ({ page }) => {
      await gotoShell(page, { theme: 'light' })
      await expectNoAxeViolations(page)
    })

    test('dark theme has no critical and only the documented header contrast', async ({ page }) => {
      await gotoShell(page, { theme: 'dark' })
      await expectDarkThemeGate(page)
    })
  })
})

/* -------------------------------------------------------------------------- */
/* keyboard                                                                   */
/* -------------------------------------------------------------------------- */

test.describe('keyboard — skip link and main landmark', () => {
  test.use({ viewport: DESKTOP_VIEWPORT })

  test('skip link is the first Tab stop and moves focus to the named main landmark', async ({
    page,
  }) => {
    await gotoShell(page)

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skipLink).toBeFocused()
    // sr-only until focused, then rendered in the top-left corner.
    await expect(skipLink).toBeVisible()
    await expectVisibleFocus(skipLink)

    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
    await expect(page.getByRole('main')).toHaveAccessibleName('Page content')
  })
})

test.describe('keyboard — desktop header', () => {
  test.use({ viewport: DESKTOP_VIEWPORT })

  test('Tab walks the frozen header order and the theme toggle works with Enter and Space', async ({
    page,
  }) => {
    await gotoShell(page)

    const header = page.getByTestId('public-header')
    const expectedOrder = [
      header.getByRole('link', { name: 'A&J' }),
      header.getByRole('link', { name: /Watch Film/ }),
      header.getByRole('link', { name: /Gallery/ }),
      header.getByRole('link', { name: /Guestbook/ }),
      header.getByRole('link', { name: /Share/ }),
      header.getByRole('link', { name: /Memory Book/ }),
    ]
    // First Tab goes to the skip link; the header follows.
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
    for (const destination of expectedOrder) {
      await page.keyboard.press('Tab')
      await expect(destination).toBeFocused()
      await expectVisibleFocus(destination)
    }

    const themeToggle = page.getByRole('button', { name: 'Switch to Light theme' })
    await page.keyboard.press('Tab')
    await expect(themeToggle).toBeFocused()
    await expectVisibleFocus(themeToggle)

    // Enter flips dark -> light and the accessible name announces the next theme.
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const lightToggle = page.getByRole('button', { name: 'Switch to Dark theme' })
    await expect(lightToggle).toBeFocused()

    // Space flips it back.
    await page.keyboard.press('Space')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Switch to Light theme' })).toBeFocused()
  })
})

test.describe('keyboard — mobile menu', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('Space opens the menu, Escape closes it, focus returns to the trigger', async ({ page }) => {
    await gotoShell(page)

    // Skip link -> logo -> hamburger (the desktop nav and toggle are hidden here).
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'A&J' })).toBeFocused()
    await page.keyboard.press('Tab')
    const trigger = page.getByRole('button', { name: 'Open menu' })
    await expect(trigger).toBeFocused()
    await expectVisibleFocus(trigger)

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await expect.poll(() => bodyOverflow(page), { message: 'body scroll is locked' }).toBe('hidden')

    const overlayNav = page.getByTestId('public-header').getByRole('navigation')
    await expect(overlayNav).toBeVisible()
    await expect(overlayNav.getByRole('link')).toHaveCount(5)

    // Tab moves into the overlay; Escape then closes it and returns focus.
    await page.keyboard.press('Tab')
    const firstOverlayLink = overlayNav.getByRole('link').first()
    await expect(firstOverlayLink).toBeFocused()

    await page.keyboard.press('Escape')
    const restoredTrigger = page.getByRole('button', { name: 'Open menu' })
    await expect(restoredTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(restoredTrigger).toBeFocused()
    await expect(overlayNav).toHaveCount(0)
    await expect.poll(() => bodyOverflow(page), { message: 'body scroll is unlocked' }).toBe('')
  })

  test('a second activation closes the menu and keeps focus on the trigger', async ({ page }) => {
    await gotoShell(page)

    const trigger = page.getByRole('button', { name: 'Open menu' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await expect(page.getByTestId('public-header').getByRole('navigation')).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
    await expect(page.getByTestId('public-header').getByRole('navigation')).toHaveCount(0)
    await expect.poll(() => bodyOverflow(page), { message: 'body scroll is unlocked' }).toBe('')
  })
})

/* -------------------------------------------------------------------------- */
/* landmarks                                                                  */
/* -------------------------------------------------------------------------- */

test.describe('landmarks', () => {
  test.use({ viewport: DESKTOP_VIEWPORT })

  test('the shell exposes exactly one named main landmark plus banner and contentinfo', async ({
    page,
  }) => {
    await gotoShell(page)

    await expect(page.locator('main')).toHaveCount(1)
    const main = page.getByRole('main')
    await expect(main).toHaveCount(1)
    await expect(main).toHaveAccessibleName('Page content')
    await expect(page.getByRole('banner')).toHaveCount(1)
    await expect(page.getByRole('contentinfo')).toHaveCount(1)
    // The banner (header) must precede the main landmark in DOM order.
    const headerBeforeMain = await page.evaluate(() => {
      const header = document.querySelector('header')
      const main = document.querySelector('main')
      return (
        header !== null &&
        main !== null &&
        Boolean(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    })
    expect(headerBeforeMain).toBe(true)
  })
})
