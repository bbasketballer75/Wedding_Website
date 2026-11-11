/**
 * Pure layout/ordering helpers for the family tree, extracted from the frozen
 * `src/components/family-tree/FamilyTree.tsx` (row chunking, the pinned couple
 * order, the pinned bridesmaid order).
 *
 * Kept outside the component so the ordering contract is unit-testable without
 * rendering 20 avatar cards.
 */
import { WEDDING_PARTY, type WeddingPartyPerson } from '../filmContent'

/** Frozen inline style: parents always render two per row. */
export const PARENT_GRID_STYLE = { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } as const

/** Frozen `chunkRows`: 7 -> 2/3/2, 6 -> 3/3, 5 -> 2/3, else pairs. */
export function chunkRows(people: readonly WeddingPartyPerson[]): WeddingPartyPerson[][] {
  if (people.length === 7) {
    return [people.slice(0, 2), people.slice(2, 5), people.slice(5, 7)]
  }
  if (people.length === 6) {
    return [people.slice(0, 3), people.slice(3, 6)]
  }
  if (people.length === 5) {
    return [people.slice(0, 2), people.slice(2, 5)]
  }

  const rows: WeddingPartyPerson[][] = []
  for (let index = 0; index < people.length; index += 2) {
    rows.push(people.slice(index, index + 2))
  }
  return rows
}

/** Bride on the left, groom on the right (frozen `orderedCouple`). */
export function orderCouple(
  couple: readonly WeddingPartyPerson[] = WEDDING_PARTY.couple
): WeddingPartyPerson[] {
  const ordered = [
    couple.find(person => person.side === 'bride'),
    couple.find(person => person.side === 'groom'),
  ]
  return ordered.filter((person): person is WeddingPartyPerson => person !== undefined)
}

/** Frozen pinned order: Maria (officiant + bridesmaid), then Lexi (matron of honor). */
export const PINNED_BRIDESMAID_ORDER = ['bm3', 'moh'] as const

export function orderBridesmaids(
  bridesmaids: readonly WeddingPartyPerson[] = WEDDING_PARTY.bridesmaids
): WeddingPartyPerson[] {
  const pinned = PINNED_BRIDESMAID_ORDER.map(id =>
    bridesmaids.find(person => person.id === id)
  ).filter((person): person is WeddingPartyPerson => person !== undefined)
  const pinnedIds = new Set<string>(PINNED_BRIDESMAID_ORDER)
  const remaining = bridesmaids.filter(person => !pinnedIds.has(person.id))
  return [...pinned, ...remaining]
}

/** Everyone the tree can open in the detail modal. */
export function allPartyPeople(
  party: {
    couple: readonly WeddingPartyPerson[]
    parents: readonly WeddingPartyPerson[]
    bridesmaids: readonly WeddingPartyPerson[]
    groomsmen: readonly WeddingPartyPerson[]
  } = WEDDING_PARTY
): WeddingPartyPerson[] {
  return [...party.couple, ...party.parents, ...party.bridesmaids, ...party.groomsmen]
}
