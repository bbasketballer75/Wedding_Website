/**
 * Public API for the Home feature. The Lead wires `/` to `HomePage` in
 * `app/router.tsx`; everything else is internal to the feature.
 */
export { HomePage } from './HomePage'
export { useHomeContent } from './useHomeContent'
export type {
  HomeContentState,
  HomeEditorialFeature,
  HomeEditorialSlots,
  HomeGuestPhoto,
  HomeGuestQuote,
} from './useHomeContent'
