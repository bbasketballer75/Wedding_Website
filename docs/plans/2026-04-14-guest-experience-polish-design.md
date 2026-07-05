# Guest Experience Polish — Full Sweep Design

## Goal

Make every guest-facing page feel beautiful, polished, and emotionally resonant — dramatic and cinematic on first impression (Home, Film), warm and intimate deeper in (Gallery, Guestbook, Upload, People).

## Approach

Full Sweep: fix every rough edge AND add one signature moment per page. No time pressure — launch when it's truly beautiful.

## Design Philosophy

**Two-tone emotional arc:** Home and Film are cinematic and dramatic. Gallery, Guestbook, Upload, and People are warm, intimate, and personal. The transition between these registers is intentional.

**Skeleton screens everywhere:** Gallery, Guestbook, and Film chapter list all get content-shaped shimmer skeletons using the existing `shimmer` keyframe. No flash of blank white.

**Micro-interaction baseline:** Every interactive element gets a response — `--ease-luxury` hover lift, gold border on focus, gentle scale press on click. All use existing Tailwind tokens.

**Empty states with warmth:** Script-font invitations (Allura) instead of blank lists when no content exists.

**Scroll-reveal standard:** New sections use `fadeUp` at 0.6s `--ease-luxury`, children staggered at 0.08s intervals.

---

## Page Designs

### Home Page

**Cinematic scroll-lock opening sequence**
After the hero video fades, add a short scroll-locked "chapter title" moment: site title and date dissolve in with a thin gold rule beneath, then the page unlocks. Costs ~80px of scroll depth, creates a true "act break" between hero and content.

**Section dividers with meaning**
Between each section, use `ElegantDivider` (existing component) with `float` keyframe on a small gold botanical/ring/dot glyph. Replaces hard cuts with breathing room and visual rhythm.

**AnniversaryCountdown glow pulse**
The seconds digit gets a `pulse-soft` shimmer — draws the eye to the live ticking without being distracting.

**FeaturedNoteSection entrance**
Featured guestbook note card enters with `scaleIn` from 0.95 scale on a cream-to-white gradient background — feels like a physical notecard being presented.

---

### Film Page

**Dramatic poster reveal on entry**
Film poster fills the viewport on arrival, holds for ~1.2s, then slides upward revealing the player. Uses existing poster image + a `motion.div` with `y` exit animation. No new assets needed.

**Chapter navigation polish**
Replace chapter tabs with a horizontal timeline strip: gold progress indicator slides as the film plays. Chapter names in Allura (script), timestamps in Newsreader (display). Active chapter gets `shadow-gold`.

**Scroll-triggered family film reveal**
Family film cards enter with `slideInRight` stagger as guests scroll past the main player — like credits rolling in.

**Video player focus mode**
When play is pressed, surrounding UI (header, chapter strip) fades to 20% opacity. On pause, fades back. Pure cinematic focus on the film. Uses `isPlaying` state toggle + CSS transition on wrapper.

---

### Gallery Page

**Skeleton loading grid**
12-cell skeleton grid mirroring actual photo layout (alternating portrait/landscape aspect ratios), shimmer animation via existing `shimmer` keyframe. No flash of empty content.

**Staggered photo entrance**
Photos enter with `fadeUp` staggered at 0.04s per card, capped at first 12. Subsequent infinite-scroll additions use `scaleIn` from 0.97.

**Collection switching transition**
Outgoing photos exit left (`x: -20, opacity: 0`), incoming enter from right (`x: 20` → default). Soft lateral wipe reinforcing album navigation.

**Lightbox polish**

- Crossfade transition between photos (no hard cut)
- Caption/metadata slides up from bottom on entry
- Swipe gesture support on mobile
- Subtle vignette overlay around lightbox edges for a darkroom feel

**Cover card active state depth**
Active collection card: `scale(1.02)`. Inactive cards: `scale(0.98)`. Makes selection feel physical.

---

### Guestbook Page

**Skeleton message cards**
4–6 content-shaped skeletons while messages load: circle for avatar, wide line for name, 2–3 narrow lines for message body. All shimmer. Zero layout shift when real content arrives.

**Message card entrance**
Cards enter with `fadeUp` stagger at 0.06s per card. Real-time new arrivals slide in from top with `scaleIn` + brief gold border flash — a subtle "someone just wrote this" signal.

**Submission celebration moment**
On accepted submission: submit button morphs to a gold checkmark (scale + opacity), warm toast fires ("Your message has been added — thank you!"), form fades out for 1.5s then fades back in. Uses existing toast infrastructure.

**Warm empty state**
Allura script: _"Be the first to leave a memory"_ with a small inline gold feather SVG and arrow pointing to the form.

**Form focus polish**
Text area and name field get `ring-2 ring-gold-300` on focus — consistent with design system, replaces default browser outline.

---

### Upload Page

**Drop zone personality**
On hover: dashed gold border becomes solid, background shifts `cream-50` → `gold-50/30`, upload icon gets `float` animation. Makes dragging a file feel like placing a gift.

**File queue card polish**
Each queued file enters with `slideInRight`. Progress bar uses `gold-400` fill with shimmer overlay. Error: rose border flash. Success: gold checkmark pulse.

**Confetti celebration on completion**
When all files finish uploading: 20–30 small gold and cream CSS-only particles burst for ~2 seconds. Followed by Newsreader warm message: _"Your memories are safe with us — thank you for sharing."_

**Upload count encouragement**
Below drop zone: _"47 guests have shared memories so far"_ (live count from Supabase). Social proof that invites participation.

**Mobile tap alternative**
On mobile, drop zone transforms into a prominent gold "Choose Photos" button — same personality, tap-friendly.

---

### People Page

**Hero introduction header**
Eyebrow chip: "The Wedding Party" in small caps. Newsreader heading: _"The people who made it beautiful."_ Instrument Sans subtext (2 lines). `fadeUp` on mount. Sets emotional tone before grid appears.

**Card depth on hover**
Avatar scales to 1.08, gold ring appears around avatar circle, name shifts `charcoal-700` → `charcoal-900`, collection pills fade muted → full opacity. The card "wakes up." Transition: `--ease-luxury` at 200ms.

**Click-through affordance**
On card hover: small gold arrow slides in from bottom-right (`opacity: 0, x: -4` → `opacity: 1, x: 0`), signaling the card leads to that person's gallery photos.

**Warm photo count copy**
_"23 photos together"_ instead of _"23 photos"_ — makes it feel like a relationship, not a database count.

---

## Tech Stack

- **Framer Motion** — all page/section/card animations (already used in 82 files)
- **Tailwind CSS v4** — existing design tokens (gold, cream, charcoal, luxury easing, shimmer keyframe)
- **CSS keyframes** — confetti particles on Upload (no library)
- **Inline SVG** — feather glyph for Guestbook empty state
- **Supabase** — live upload count query for Upload page
- **No new dependencies**

---

## Implementation Order (suggested)

1. Cross-cutting: skeleton component + micro-interaction baseline
2. Home: scroll-lock sequence + section dividers + countdown pulse
3. Film: poster reveal + chapter strip + focus mode
4. Gallery: skeletons + staggered entrance + collection transition + lightbox polish
5. Guestbook: skeletons + submission celebration + empty state + form focus
6. Upload: drop zone + confetti + upload count + mobile alternative
7. People: hero header + card depth + click affordance + copy
