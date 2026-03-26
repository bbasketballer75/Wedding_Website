# Feature & Card Logic Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cut noise and reorder sections across Film, Gallery, Guestbook, and Upload so every page flows the way guests actually use it.

**Architecture:** Four independent page edits — no shared state, no new components, no new files. Each task is a surgical cut or move within a single file. TypeScript check after each task.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion, Supabase

---

## Task 1: Film — Extract family tree from hero into its own section

**Files:**
- Modify: `src/pages/Film.tsx`

**Context:**
The hero `editorial-panel` currently wraps three things: hero text, the family tree `motion.div`, and the cinematic video player `div#wedding-video`. All three live inside one `<div className="relative">` inside the outer `motion.div`. The goal is to close the hero panel after the hero text, and give the family tree its own standalone `<section>` between the hero and the video player.

**Current structure (simplified):**
```
<section pt-32>
  <motion.div className="editorial-panel">    ← hero panel
    <blobs />
    <div className="relative">
      <div className="max-w-3xl">             ← hero text
        eyebrow, h1, body, metadata pills
      </div>
      <motion.div className="mt-10">          ← family tree (EXTRACT THIS)
        <div className="editorial-panel">header text</div>
        <div className="editorial-panel"><FamilyTree /></div>
      </motion.div>
      <div id="wedding-video" className="mt-10 cinematic-panel"> ← video (EXTRACT THIS)
        ...
      </div>
    </div>
  </motion.div>
</section>
```

**Target structure:**
```
<section pt-32 pb-10>              ← hero only, reduced bottom padding
  <motion.div className="editorial-panel">
    <blobs />
    <div className="max-w-3xl">   ← hero text only
      eyebrow, h1, body, metadata pills
    </div>
  </motion.div>
</section>

<section px-4 pb-10>              ← family tree section
  <motion.div whileInView>
    <div className="editorial-panel">header text</div>
    <div className="mt-5 editorial-panel"><FamilyTree /></div>
  </motion.div>
</section>

<section px-4 pb-16>              ← video player section
  <div id="wedding-video" className="cinematic-panel">
    ...
  </div>
</section>
```

**Step 1: Replace the hero section JSX**

In `src/pages/Film.tsx`, find and replace the entire first `<section>` (lines ~648–795, from `<section className="px-4 pb-16 pt-32 sm:pt-36">` through the closing `</section>` of that section) with:

```tsx
      <section className="px-4 pb-10 pt-32 sm:pt-36">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            data-testid="film-hero"
            className="editorial-panel px-6 py-8 sm:px-8 sm:py-10 lg:px-10"
          >
            <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-gold-200/30 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blush-200/35 blur-3xl" />

            <div className="relative max-w-3xl">
              <span className="eyebrow-chip">
                <Sparkles className="h-3.5 w-3.5" />
                Our wedding film
              </span>

              <h1 className="mt-6 max-w-3xl text-5xl text-charcoal-900 sm:text-6xl lg:text-7xl">
                The day as it felt, not just as it looked.
              </h1>

              <p className="mt-5 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                Start here if you are only opening one page. This is the full arc of May 10, 2025:
                the nerves, the vows, the speeches, the laughter, and the dance floor blur that still
                feels impossible to forget.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-charcoal-500">
                <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                  Saturday, May 10, 2025
                </span>
                <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                  The Lodge at Indian Lake
                </span>
                <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                  {MAIN_FILM_RUNTIME_LABEL} feature film
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <div className="editorial-panel px-6 py-6 sm:px-8">
              <span className="eyebrow-chip">Meet the family and friends</span>
              <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                The people who held the day together.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                Before you hit play, take a moment to meet the family and friends woven into every
                chapter of the film. It makes the speeches, reactions, and little glances land even harder.
              </p>
            </div>

            <div className="mt-5 editorial-panel px-2 py-4 sm:px-4">
              <FamilyTree />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <div
            id="wedding-video"
            data-testid="film-player-section"
            className="cinematic-panel px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9"
          >
            <div className="grid gap-6">
              <p className="text-sm text-cinematic-muted">
                {MAIN_FILM_RUNTIME_LABEL} feature film
                <span className="mx-2 text-gold-300/55">•</span>
                {chapters.length} chapters
                <span className="mx-2 text-gold-300/55">•</span>
                Captions available
              </p>

              <motion.div
                id="wedding-film-player"
                initial={{ opacity: 0, scale: 0.985 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="scroll-mt-28"
              >
                <VideoPlayer
                  src={getMediaPath('/video/main.mp4')}
                  title="Austin & Jordyn's Wedding"
                  chapters={chapters}
                  poster={MAIN_FILM_POSTER}
                  captionsSrc={getMediaPath('/video/main.vtt')}
                  previewStartTime={44}
                  storageKey={MAIN_FILM_PROGRESS_KEY}
                  onEnded={() => setDidFinishMainFilm(true)}
                  className="aspect-video ring-1 ring-white/10"
                  requireLandscapeOnPhone
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.15 }}
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <h3 className="text-sm uppercase tracking-[0.28em] text-gold-300/82">
                    Chapter guide
                  </h3>
                  <p className="text-sm text-cinematic-muted">
                    Jump back in only when you need a specific section.
                  </p>
                </div>
                <div className="overflow-x-auto pb-2 hide-scrollbar">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.label}
                        type="button"
                        onClick={() => jumpToChapter(chapter.time)}
                        className="group cinematic-card min-h-[4.8rem] px-3 py-2.5 text-left transition-colors duration-200 hover:border-gold-300/35 hover:bg-white/8 sm:min-h-[5.1rem] sm:px-3.5 sm:py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/72">
                              {formatChapterTime(chapter.time)}
                            </p>
                            <p className="mt-1.5 text-[0.9rem] font-semibold leading-5 text-cinematic-primary sm:text-[0.96rem]">
                              {chapter.label}
                            </p>
                          </div>
                          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-300/72 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/pages/Film.tsx
git commit -m "refactor(film): extract family tree and video player into own sections"
```

---

## Task 2: Film — Move guest highlights before the CTA

**Files:**
- Modify: `src/pages/Film.tsx`

**Context:**
Currently: Parent Dances → CTA ("After the film") → Guest Highlights.
Target: Parent Dances → Guest Highlights → CTA.

**Step 1: Swap the two sections**

Find the CTA section (starts with `<section className="px-4 pb-20">`), which ends just before `{guestHighlights.length > 0 && (`. The guest highlights block is:

```tsx
      {guestHighlights.length > 0 && (
        <section className="px-4 pb-16">
          ...
        </section>
      )}
```

Move this entire `{guestHighlights.length > 0 && (...)}` block to appear **before** the CTA `<section className="px-4 pb-20">`.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/pages/Film.tsx
git commit -m "refactor(film): move guest highlights above the after-the-film CTA"
```

---

## Task 3: Gallery — Remove the redundant "on screen" count badge

**Files:**
- Modify: `src/pages/Gallery.tsx`

**Context:**
The header already shows `{filteredPhotos.length} visible`. Inside the results panel there is a second badge showing `{displayedItems.length} on screen`. Remove the second one.

**Step 1: Delete the "on screen" badge**

Find and remove this block (inside the results section, above `data-testid="gallery-results"`):

```tsx
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500">
              <Images className="h-4 w-4 text-gold-500" />
              {displayedItems.length} on screen
            </div>
```

The surrounding `<div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">` also becomes a simpler `<div className="mb-5">` since it no longer needs justify-between. Simplify it:

```tsx
          <div className="mb-5">
            <h2 className="font-display text-3xl text-charcoal-900 sm:text-4xl">
              {selectedCollection}
            </h2>
          </div>
```

**Step 2: Check if `Images` import is still used**

`Images` is still used in the header visible count badge — keep the import.

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/pages/Gallery.tsx
git commit -m "refactor(gallery): remove redundant on-screen count badge"
```

---

## Task 4: Gallery — Demote face recognition out of the control bar

**Files:**
- Modify: `src/pages/Gallery.tsx`

**Context:**
`FaceRecognition` is currently the third column of an `xl:grid-cols-[minmax(0,1fr)_auto_auto]` grid alongside the search input and view-mode toggle. Remove it from that grid and place it as a subtle secondary element in a new row below the control bar's existing content.

**Step 1: Remove FaceRecognition from the inline grid**

Find the grid div:
```tsx
                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
```

Change to two columns and remove the third `<div>`:
```tsx
                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
```

Remove this block entirely:
```tsx
                  <div className="justify-self-start xl:justify-self-end">
                    <FaceRecognition onPhotoFilter={handleFaceFilter} detectedFaces={detectedFaces} />
                  </div>
```

**Step 2: Add FaceRecognition as a subtle row below the existing content**

Inside the control bar `<div data-testid="gallery-control-bar">`, after the grid div (and before the `{hasActiveFilters && ...}` block), add:

```tsx
                <div className="mt-3 flex items-center border-t border-charcoal-900/6 pt-3">
                  <FaceRecognition onPhotoFilter={handleFaceFilter} detectedFaces={detectedFaces} />
                </div>
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/pages/Gallery.tsx
git commit -m "refactor(gallery): demote face recognition below control bar"
```

---

## Task 5: Guestbook — Strip MessageCard to name, date, note

**Files:**
- Modify: `src/pages/Guestbook.tsx`

**Context:**
`MessageCard` currently renders: avatar + name + date, type badge, voice/video media player, text content, comments thread, reaction picker, reply form. Strip it to: avatar + name + date, text content.

**Step 1: Replace the MessageCard component**

Find `function MessageCard({` and replace the entire component (through its closing `}`) with:

```tsx
function MessageCard({
  message,
  isHighlighted = false,
}: {
  message: Message
  isHighlighted?: boolean
}) {
  const displayContent = getDisplayContent(message)

  return (
    <motion.article
      id={`guestbook-message-${message.id}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5 transition-all duration-300 sm:px-6 sm:py-6',
        isHighlighted && 'ring-2 ring-gold-400/40 shadow-[0_0_40px_-10px_rgba(198,156,78,0.25)]'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar fallback={message.name} size="lg" className="ring-2 ring-gold-400/30" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{message.name}</h3>
          <p className="mt-1 text-sm text-white/45">{message.timestamp}</p>
        </div>
      </div>

      {displayContent && (
        <div className="mt-5 rounded-xl bg-white/6 px-4 py-4">
          <p className="text-base leading-7 text-white/75">{displayContent}</p>
        </div>
      )}
    </motion.article>
  )
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: errors for unused `onReact`/`onReply` props passed to `<MessageCard>` — fix in Task 6.

---

## Task 6: Guestbook — Remove filter tabs, simplify state and data logic

**Files:**
- Modify: `src/pages/Guestbook.tsx`

**Context:**
With only text notes and no reactions/comments, we can remove: the filter sidebar card, `filter` state, `formType`/`mediaBlob` state, `handleReact`/`handleReply` functions, `totalReplies`/`counts` computed values, the comments fallback fetch, and the filter-specific empty state. The feed header and empty states also get simplified.

**Step 1: Remove state declarations**

Remove these state lines (inside `export default function Guestbook()`):
```tsx
  const [formType, setFormType] = useState<'text' | 'voice' | 'video'>('text')
  const [filter, setFilter] = useState<'all' | 'text' | 'voice' | 'video'>('all')
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
```

**Step 2: Simplify the data-fetch `useEffect`**

Replace the entire fetch `useEffect` with a version that only fetches messages (no comments):

```tsx
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const { data: rpcData, error: rpcError } = await supabase.rpc('get_guestbook_messages_with_comments')
        if (!rpcError && Array.isArray(rpcData)) {
          setMessages(rpcData.map(mapSupabaseMessage))
          return
        }

        const { data, error } = await supabase
          .from('guestbook_messages')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          setLoadError('Having trouble loading notes right now — yours will still go through below.')
          setMessages([])
          return
        }

        setMessages((data || []).map((message) => mapSupabaseMessage({ ...message, comments: [] })))
      } catch {
        setLoadError('Having trouble reaching the guestbook — your note will still go through below.')
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchMessages()
  }, [])
```

**Step 3: Remove filter-reset useEffect**

Remove:
```tsx
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [filter, messages.length])
```

Replace with:
```tsx
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [messages.length])
```

**Step 4: Simplify the searchParams useEffect**

Remove the `setFilter('all')` line from the `searchParams` useEffect:
```tsx
  useEffect(() => {
    const requestedMessageId = searchParams.get('message')
    if (!requestedMessageId) {
      setHighlightedMessageId(null)
      return
    }
    setHighlightedMessageId(requestedMessageId)
  }, [searchParams])
```

**Step 5: Replace openComposer**

Replace:
```tsx
  const openComposer = (nextType?: 'text' | 'voice' | 'video') => {
    if (nextType) setFormType(nextType)
    setShowForm(true)
    setSubmitError(null)
    setIsSubmitted(false)
  }
```

With:
```tsx
  const openComposer = () => {
    setShowForm(true)
    setSubmitError(null)
    setIsSubmitted(false)
  }
```

Update all call sites from `openComposer('text')` → `openComposer()`.

**Step 6: Remove handleReact and handleReply functions**

Delete `handleReact` (lines ~480–527) and `handleReply` (lines ~529–560) entirely.

**Step 7: Simplify handleSubmit**

Replace the try block inside `handleSubmit` with a version that hardcodes type as `'text'` and removes the media upload path:

```tsx
    try {
      const normalizedContent = content.trim()

      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_guestbook_message_with_rate_limit', {
        p_name: name,
        p_email: email,
        p_content: normalizedContent,
        p_type: 'text',
        p_media_url: undefined,
        p_max_requests: 3,
        p_window_minutes: 1,
      })

      if (!rpcError && rpcData) {
        const result = rpcData as { success: boolean; message_id: string; error_message: string }

        if (!result.success) {
          addToast(result.error_message || 'Just a moment before the next one.', 'warning')
          setIsSubmitting(false)
          return
        }

        setMessages((previous) => [
          { id: result.message_id, name, content: normalizedContent, type: 'text', mediaUrl: undefined, reactions: [], comments: [], timestamp: 'Just now' },
          ...previous,
        ])
      } else {
        const { data, error } = await supabase
          .from('guestbook_messages')
          .insert([{ name, email, content: normalizedContent, type: 'text', media_url: null, reactions: {} }])
          .select()

        if (error) throw error
        if (data?.[0]) setMessages((previous) => [mapSupabaseMessage(data[0]), ...previous])
      }

      setVisibleCount(INITIAL_VISIBLE_MESSAGES)
      setIsSubmitted(true)

      window.setTimeout(() => {
        setShowForm(false)
        setIsSubmitted(false)
        setName('')
        setEmail('')
        setContent('')
      }, 2200)
    } catch {
      setSubmitError("Something didn't go through — give it another try.")
    }
```

**Step 8: Simplify computed values**

Replace:
```tsx
  const filteredMessages = messages.filter((message) => (filter === 'all' ? true : message.type === filter))
  const visibleMessages = filteredMessages.slice(0, visibleCount)
  const hasMoreMessages = filteredMessages.length > visibleCount
  const totalReplies = messages.reduce((total, message) => total + message.comments.length, 0)
  const featuredMessage = messages[0]
  const counts = {
    all: messages.length,
    text: messages.filter((message) => message.type === 'text').length,
    voice: messages.filter((message) => message.type === 'voice').length,
    video: messages.filter((message) => message.type === 'video').length,
  }
```

With:
```tsx
  const visibleMessages = messages.slice(0, visibleCount)
  const hasMoreMessages = messages.length > visibleCount
  const featuredMessage = messages[0]
```

**Step 9: Remove the filter sidebar card from the JSX**

Find and delete the third sidebar card — the one with `data-testid="guestbook-filters"` and the "Browse" heading containing the four filter buttons.

**Step 10: Update the feed header**

Replace the conditional feed title:
```tsx
                    {filter === 'all' ? 'Everyone who left a note' : filter === 'text' ? 'Written notes' : filter === 'voice' ? 'Voice messages' : 'Video messages'}
```
With:
```tsx
                    Everyone who left a note
```

Remove the `totalReplies` badge block from the feed header stats area:
```tsx
                  {totalReplies > 0 && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/60">
                      <MessageCircle className="h-4 w-4 text-gold-400" />
                      {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
                    </div>
                  )}
```

**Step 11: Update MessageCard call site**

Find:
```tsx
                    <MessageCard
                      key={message.id}
                      message={message}
                      isHighlighted={highlightedMessageId === message.id}
                      onReact={handleReact}
                      onReply={handleReply}
                    />
```

Replace with:
```tsx
                    <MessageCard
                      key={message.id}
                      message={message}
                      isHighlighted={highlightedMessageId === message.id}
                    />
```

**Step 12: Remove the filter-specific empty state**

Find and delete the middle empty state (`messages.length > 0` but `filteredMessages.length === 0`) since there is no filter anymore. The ternary `filteredMessages.length > 0 ? ... : messages.length > 0 ? ... : ...` simplifies to `messages.length > 0 ? ... : ...`.

Update:
```tsx
            ) : filteredMessages.length > 0 ? (
              <>
                ...
              </>
            ) : messages.length > 0 ? (
              <div ...filter empty state...>
                ...
                <Button ... onClick={() => setFilter('all')}>Show everything</Button>
              </div>
            ) : (
              <div ...no messages empty state...>
```

To:
```tsx
            ) : messages.length > 0 ? (
              <>
                ...
              </>
            ) : (
              <div ...no messages empty state...>
```

**Step 13: Clean up unused imports**

Remove from the import list:
- `ReactionPicker, type ReactionType` from `@/components/guestbook/ReactionPicker`
- `AudioPlayer` from wherever it is imported
- `Badge` from `@/components/ui/Badge`
- `MessageCircle` from lucide-react
- `Mic` from lucide-react
- `Video` from lucide-react

Keep: `PenSquare` (used in composer eyebrow), everything else.

**Step 14: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 15: Commit**

```bash
git add src/pages/Guestbook.tsx
git commit -m "refactor(guestbook): simplify to text-only notes, remove reactions/comments/filters"
```

---

## Task 7: Upload — Remove highlight cards and move share panel below the form

**Files:**
- Modify: `src/pages/Upload.tsx`

**Context:**
The hero section currently has a two-column grid: left = hero text + share panel inline, right = three highlight cards. Target: hero = just eyebrow/h1/body/metadata pills. Share panel moves to a standalone section after the submit button.

**Step 1: Strip the hero section**

Find the outer hero `<motion.section>` (has `data-testid` not set, starts with `initial={{ opacity: 0, y: 24 }}`). Inside it, the `<div className="relative grid gap-10 2xl:grid-cols-[...]">` contains:
- `<div>` — hero text + share panel inline
- `<div>` — highlight cards

Replace the entire `<div className="relative grid gap-10 2xl:grid-cols-[...]">` block with just the hero text, removing the share panel from inside it and removing the highlights column entirely:

```tsx
          <div className="relative">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400">
              <Sparkles className="h-3.5 w-3.5" />
              Add your side of the day
            </span>

            <h1 className="mt-6 text-5xl text-white sm:text-6xl">
              Help us fill in the corners we could not see.
            </h1>

            <p className="mt-5 max-w-2xl text-base text-white/55 sm:text-lg">
              Phone photos, shaky dance-floor videos, ceremony candids, quiet table moments:
              the whole archive gets better when your side of the day is part of it too.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-white/50">
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                {selectedPhotoCount > 0 ? formatMediaCount(selectedPhotoCount, 'selected photo') : 'Photos welcome'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                {selectedVideoCount > 0 ? formatMediaCount(selectedVideoCount, 'selected video') : 'Videos welcome'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                Reviewed before posting
              </span>
            </div>
          </div>
```

**Step 2: Remove the uploadHighlights const**

Delete the `const uploadHighlights = [...]` block (lines ~41–58) and its associated imports (`ShieldCheck`, `Clock3` from lucide-react — check if used elsewhere first).

**Step 3: Add share panel after the form's submit button**

The form ends with a `<button type="submit">` section. After the closing `</form>`, and after the `{submitError && ...}` block, add the share panel as a new sibling `<motion.section>`:

```tsx
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-6 sm:px-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">
                Pass the site along
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Send the full site to anyone who still has not watched or browsed yet.
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                These buttons share the site itself. Uploads still happen separately above.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label={shareCopied ? 'Copied' : 'Copy link'}
              >
                {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const body = encodeURIComponent(`${siteShareTitle} — ${siteShareDescription} ${siteShareUrl}`)
                  window.location.href = `sms:?&body=${body}`
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Text it"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteShareUrl)}`)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Share on Facebook"
              >
                <Facebook className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${siteShareTitle} — ${siteShareDescription}`)}&url=${encodeURIComponent(siteShareUrl)}`)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Share on X"
              >
                <Twitter className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const subject = encodeURIComponent(siteShareTitle)
                  const body = encodeURIComponent(`${siteShareDescription}\n\n${siteShareUrl}`)
                  window.location.href = `mailto:?subject=${subject}&body=${body}`
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Share via email"
              >
                <Mail className="h-4 w-4" />
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.share({
                      title: siteShareTitle,
                      text: siteShareDescription,
                      url: siteShareUrl,
                    }).catch(() => {})
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                  aria-label="More share options"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <div className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm">
                <Link2 className="h-4 w-4 text-gold-400" />
                <span className="max-w-[11rem] truncate sm:max-w-[13rem] text-white/40">{siteShareUrl}</span>
              </div>
            </div>
          </div>
        </motion.section>
```

Note: this section is placed OUTSIDE the `<form>` element (after the form's closing tag), as a sibling inside `<div className="mx-auto max-w-6xl px-4">`.

**Step 4: Remove unused imports**

Check if `ShieldCheck`, `Clock3` are still used (they appear in the sidebar "reassurance" section inside the form — keep them). `AlertCircle` may also be there — verify before removing.

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 6: Commit**

```bash
git add src/pages/Upload.tsx
git commit -m "refactor(upload): remove highlight cards, move share panel after form"
```

---

## Final verification

After all tasks complete:

```bash
npx tsc --noEmit
```

Then visually verify each page in the browser:
- `/film` — hero panel is compact, family tree is its own section below, guest highlights appear before the CTA
- `/gallery` — single count badge in header, face recognition is below the control bar
- `/guestbook` — no filter tabs in sidebar, message cards show only name/date/note
- `/upload` — hero leads straight to dropzone, share panel is at the bottom after the form
