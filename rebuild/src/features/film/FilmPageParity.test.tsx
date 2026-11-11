import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import renderedFilm from '../../../../contracts/content/rendered/film.json'
import { useEditorialFeatures } from '@/shared/data/hooks'
import { installFilmTestEnvironment } from './test-utils/testEnvironment'
import { renderFilmPage } from './test-utils/renderFilmPage'

vi.mock('@/shared/data/hooks', () => ({
  useEditorialFeatures: vi.fn(),
}))

const useEditorialFeaturesMock = vi.mocked(useEditorialFeatures)

/**
 * Text/DOM parity against the frozen rendered oracle
 * (`contracts/content/rendered/film.json`, desktop capture).
 *
 * Lines that depend on network/mock state are excluded from the static-copy
 * assertion: the chapter list body (the oracle captured a one-cue media stub),
 * the player's control readouts, and the editorial error banner (the frozen
 * capture got a Supabase mock error, the rebuild gets an empty slot list).
 */
const DYNAMIC_ORACLE_LINES = new Set(
  [
    55, // "45:53 feature film•N chapters•Captions available"
    56,
    57,
    58,
    59,
    60,
    61,
    62,
    63, // player control readouts
    66,
    67, // live chapter rows
    71,
    72, // editorial error banner (mock-dependent)
  ].map(String)
)

function normalize(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Case-insensitive comparison for the copy lines only: the oracle captured
 * `innerText` in a real browser, where CSS `text-transform: uppercase` on
 * eyebrow labels is reflected in the text; jsdom has no computed style, so it
 * exposes the source case. Browser parity compares the real innerText bytes —
 * this unit guard only proves the copy is present.
 */
function comparable(value: string): string {
  return normalize(value).toLowerCase()
}

describe('FilmPage parity against the frozen rendered oracle', () => {
  beforeEach(() => {
    installFilmTestEnvironment()
    window.localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<!doctype html><html><body>app shell</body></html>'),
        })
      )
    )
    useEditorialFeaturesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useEditorialFeatures>)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('matches the oracle headings exactly', async () => {
    const { container } = await renderFilmPage()
    await screen.findByRole('heading', { level: 1 })

    const headings = [...container.querySelectorAll('h1, h2')].map(heading => ({
      level: Number(heading.tagName.slice(1)),
      text: normalize(heading.textContent ?? ''),
    }))

    expect(headings).toEqual(renderedFilm.snapshots.desktop.headings)
  })

  it('matches the oracle image src order (family tree portraits)', async () => {
    const { container } = await renderFilmPage()
    await screen.findByRole('heading', { level: 1 })

    const images = [...container.querySelectorAll('img')].map(img => img.getAttribute('src'))

    expect(images).toEqual(renderedFilm.snapshots.desktop.images)
  })

  it('renders every static copy line from the oracle', async () => {
    const { container } = await renderFilmPage()
    await screen.findByRole('heading', { level: 1 })

    const visibleText = comparable(container.textContent ?? '')
    const expectedLines = renderedFilm.snapshots.desktop.mainText.filter(
      (_line, index) => !DYNAMIC_ORACLE_LINES.has(String(index))
    )

    expect(expectedLines.length).toBeGreaterThan(50)
    const missing = expectedLines.filter(line => !visibleText.includes(comparable(line)))
    expect(missing).toEqual([])
  })

  it('keeps the frozen section order (hero -> tree -> player -> dances -> next steps)', async () => {
    const { container } = await renderFilmPage()
    await screen.findByRole('heading', { level: 1 })

    const hero = container.querySelector('[data-testid="film-hero"]')
    const playerSection = container.querySelector('[data-testid="film-player-section"]')
    const treeHeading = screen.getByRole('heading', {
      level: 2,
      name: 'The people who held the day together.',
    })
    const parentDances = screen.getByRole('heading', { level: 2, name: 'Watch the parent dances.' })
    const nextSteps = screen.getByRole('heading', { level: 2, name: 'Where to next' })

    if (!hero || !playerSection) {
      throw new Error('expected hero and player sections')
    }

    const precedes = (first: Element, second: Element): boolean =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(precedes(hero, treeHeading)).toBe(true)
    expect(precedes(treeHeading, playerSection)).toBe(true)
    expect(precedes(playerSection, parentDances)).toBe(true)
    expect(precedes(parentDances, nextSteps)).toBe(true)
  })
})
