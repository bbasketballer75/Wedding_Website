import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AdminLayout } from './admin/AdminLayout'

/* Legacy spotlight editor retired.
function _FeaturedContentManagerLegacy() {
  const [featuresBySlot, setFeaturesBySlot] = useState<Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: null }),
      {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>
    )
  )
  const [drafts, setDrafts] = useState<Record<SiteEditorialFeatureSlot, EditorialDraft>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: createEditorialDraft(definition.slot) }),
      {} as Record<SiteEditorialFeatureSlot, EditorialDraft>
    )
  )
  const [historyBySlot, setHistoryBySlot] = useState<Record<SiteEditorialFeatureSlot, SiteEditorialFeatureHistoryEntry[]>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: [] }),
      {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeatureHistoryEntry[]>
    )
  )
  const [candidateSearchBySlot, setCandidateSearchBySlot] = useState<Record<SiteEditorialFeatureSlot, string>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: '' }),
      {} as Record<SiteEditorialFeatureSlot, string>
    )
  )
  const [recentUploads, setRecentUploads] = useState<ModerationUpload[]>([])
  const [recentMessages, setRecentMessages] = useState<GuestbookMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSlot, setSavingSlot] = useState<SiteEditorialFeatureSlot | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SiteEditorialFeatureSlot>('home_newest_standout_upload')
  const { addToast } = useToast()
  const { user } = useAuthStore()
  const actor = getAdminAuditActor(user)

  const loadEditorialState = useCallback(async () => {
    setLoading(true)
    const [featuresResult, uploadsResult, messagesResult, historyResult] = await Promise.all([
      fetchSiteEditorialFeatures(),
      supabase.from('guest_uploads').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('guestbook_messages').select('*').order('created_at', { ascending: false }).limit(20),
      fetchSiteEditorialFeatureHistory(),
    ])

    const featuresError = featuresResult.error
    const uploadsError = uploadsResult.error
    const messagesError = messagesResult.error
    const historyError = historyResult.error

    if (featuresError || uploadsError || messagesError || historyError) {
      addToast('Failed to load featured content settings', 'error')
      setLoading(false)
      return
    }

    const features = (featuresResult.data || []) as SiteEditorialFeature[]
    const bySlot = editorialSlotDefinitions.reduce((acc, definition) => {
      acc[definition.slot] = features.find((feature) => feature.slot === definition.slot) || null
      return acc
    }, {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>)

    setFeaturesBySlot(bySlot)
    setDrafts(
      editorialSlotDefinitions.reduce((acc, definition) => {
        acc[definition.slot] = createEditorialDraft(definition.slot, bySlot[definition.slot])
        return acc
      }, {} as Record<SiteEditorialFeatureSlot, EditorialDraft>)
    )
    setHistoryBySlot(
      editorialSlotDefinitions.reduce((acc, definition) => {
        acc[definition.slot] = ((historyResult.data as SiteEditorialFeatureHistoryEntry[] | null) || [])
          .filter((entry) => entry.slot === definition.slot)
        return acc
      }, {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeatureHistoryEntry[]>)
    )
    setRecentUploads(((uploadsResult.data as ModerationUpload[] | null) || []))
    setRecentMessages(((messagesResult.data as GuestbookMessage[] | null) || []))
    setLoading(false)
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEditorialState()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadEditorialState])

  function updateDraft(slot: SiteEditorialFeatureSlot, patch: Partial<EditorialDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [slot]: {
        ...previous[slot],
        ...patch,
      },
    }))
  }

  function updateCandidateSearch(slot: SiteEditorialFeatureSlot, value: string) {
    setCandidateSearchBySlot((previous) => ({
      ...previous,
      [slot]: value,
    }))
  }

  function applyQuickAction(slot: SiteEditorialFeatureSlot) {
    if (slot === 'home_newest_standout_upload' || slot === 'film_featured_guest_video') {
      const candidate = recentUploads.find((upload) =>
        slot === 'film_featured_guest_video'
          ? upload.status === 'approved' && (upload.video_urls?.length || 0) > 0
          : upload.status === 'approved'
      )

      if (!candidate) {
        addToast('No recent upload matches that quick action yet.', 'warning')
        return
      }

      updateDraft(slot, {
        sourceType: 'guest_upload',
        sourceId: candidate.id,
        sourceLabel: candidate.guest_name,
        sourceUrl: slot === 'film_featured_guest_video' ? '/film' : '/gallery?collection=Guest%20Uploads',
        title: candidate.message?.trim() || (slot === 'film_featured_guest_video' ? `Featured clip from ${candidate.guest_name}` : `Newest standout upload from ${candidate.guest_name}`),
        summary:
          candidate.message?.trim() ||
          (slot === 'film_featured_guest_video'
            ? 'A guest-shot angle from the room, ready to lead the highlight lane.'
            : 'A guest contribution worth surfacing as one of the first things returning visitors see.'),
        badgeLabel: slot === 'film_featured_guest_video' ? 'Featured guest clip' : 'Guest upload',
        memoryTrail:
          slot === 'film_featured_guest_video'
            ? ((candidate.memory_trail as MemoryTrailId | null) || 'dance-floor')
            : ((candidate.memory_trail as MemoryTrailId | null) || 'dance-floor'),
      })
      return
    }

    if (slot === 'home_featured_guestbook_note') {
      const candidate = recentMessages[0]
      if (!candidate) {
        addToast('No guestbook note is available for that quick action yet.', 'warning')
        return
      }

      updateDraft(slot, {
        sourceType: 'guestbook_message',
        sourceId: candidate.id,
        sourceLabel: candidate.name,
        sourceUrl: `/guestbook?message=${candidate.id}`,
        title: `A note from ${candidate.name}`,
        summary: candidate.content.slice(0, 180),
        badgeLabel: 'Featured note',
        memoryTrail: 'family',
      })
      return
    }

    updateDraft(slot, {
      sourceType: 'film_chapter',
      sourceId: 'the-ceremony',
      sourceLabel: 'The Ceremony',
      sourceUrl: '/film?moment=the-ceremony',
      title: 'The ceremony, back at the center of the week',
      summary: 'A one-click way back into the vows, the room holding its breath, and the part of the day that still feels most surreal.',
      badgeLabel: 'Film moment',
      memoryTrail: 'ceremony',
    })
  }

  async function handleSave(slot: SiteEditorialFeatureSlot) {
    const draft = drafts[slot]
    if (!draft.title.trim()) {
      addToast('Featured content needs a title before it can be saved.', 'error')
      return
    }

    setSavingSlot(slot)
    const previousFeature = featuresBySlot[slot]
    const result = await upsertSiteEditorialFeature({
      slot,
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      trail: draft.trail.trim() || null,
      memoryTrail: draft.memoryTrail || null,
      badgeLabel: draft.badgeLabel.trim() || null,
      ctaLabel: draft.ctaLabel.trim() || null,
      sourceType: draft.sourceType,
      sourceId: draft.sourceId.trim() || null,
      sourceLabel: draft.sourceLabel.trim() || null,
      sourceUrl: draft.sourceUrl.trim() || null,
      startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      isActive: draft.isActive,
      displayOrder: editorialSlotDefinitions.findIndex((definition) => definition.slot === slot),
      actor: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
      },
      metadata: {
        slot,
      },
    })

    if (result.error || !result.data) {
      addToast('Could not save the featured content slot.', 'error')
      setSavingSlot(null)
      return
    }

    setFeaturesBySlot((previous) => ({
      ...previous,
      [slot]: result.data as SiteEditorialFeature,
    }))
    setDrafts((previous) => ({
      ...previous,
      [slot]: createEditorialDraft(slot, result.data as SiteEditorialFeature),
    }))
    const { data: historyEntry, error: historyError } = await recordSiteEditorialFeatureHistory({
      slot,
      featureId: (result.data as SiteEditorialFeature).id,
      changeSummary: `Updated ${editorialSlotDefinitions.find((definition) => definition.slot === slot)?.label || slot}.`,
      actor,
      previousFeature: serializeEditorialFeatureForHistory(previousFeature),
      nextFeature: serializeEditorialFeatureForHistory(result.data as SiteEditorialFeature),
    })

    if (historyError) {
      addToast('Featured slot saved, but the editorial history entry could not be recorded.', 'warning')
    } else if (historyEntry) {
      setHistoryBySlot((previous) => ({
        ...previous,
        [slot]: [historyEntry, ...(previous[slot] || [])],
      }))
    }
    addToast('Featured content slot saved.', 'success')
    setSavingSlot(null)
  }

  const selectedDefinition =
    editorialSlotDefinitions.find((definition) => definition.slot === selectedSlot) || editorialSlotDefinitions[0]
  const selectedDraft = drafts[selectedSlot] || createEditorialDraft(selectedSlot)
  const selectedFeature = featuresBySlot[selectedSlot]
  const selectedHistory = historyBySlot[selectedSlot] || []
  const selectedCandidateSearch = candidateSearchBySlot[selectedSlot] || ''
  const selectedIsSaving = savingSlot === selectedSlot

  const activeSlotCount = Object.values(featuresBySlot).filter((feature) => feature?.is_active).length
  const approvedUploadsCount = recentUploads.filter((upload) => upload.status === 'approved').length
  const guestbookCount = recentMessages.length
  const normalizedCandidateSearch = selectedCandidateSearch.trim().toLowerCase()
  const filteredUploadCandidates = recentUploads
    .filter((upload) => upload.status === 'approved')
    .filter((upload) =>
      selectedSlot === 'film_featured_guest_video' ? (upload.video_urls?.length || 0) > 0 : true
    )
    .filter((upload) => {
      if (!normalizedCandidateSearch) return true
      const haystack = `${upload.guest_name} ${upload.guest_email} ${upload.message || ''}`.toLowerCase()
      return haystack.includes(normalizedCandidateSearch)
    })
    .slice(0, 6)
  const filteredGuestbookCandidates = recentMessages
    .filter((message) => {
      if (!normalizedCandidateSearch) return true
      const haystack = `${message.name} ${message.email} ${message.content}`.toLowerCase()
      return haystack.includes(normalizedCandidateSearch)
    })
    .slice(0, 6)
  const activeSourceCount =
    selectedDraft.sourceType === 'guest_upload'
      ? filteredUploadCandidates.length
      : selectedDraft.sourceType === 'guestbook_message'
        ? filteredGuestbookCandidates.length
        : selectedDraft.sourceType === 'film_chapter'
          ? filmChapterFeatureOptions.length
          : 1

  function applyGuestUploadSelection(upload: ModerationUpload) {
    updateDraft(selectedSlot, {
      sourceType: 'guest_upload',
      sourceId: upload.id,
      sourceLabel: upload.guest_name,
      sourceUrl: selectedSlot === 'film_featured_guest_video' ? '/film' : '/gallery?collection=Guest%20Uploads',
      title:
        upload.editorial_title?.trim() ||
        upload.message?.trim() ||
        (selectedSlot === 'film_featured_guest_video'
          ? `Featured clip from ${upload.guest_name}`
          : `Standout upload from ${upload.guest_name}`),
      summary:
        upload.editorial_summary?.trim() ||
        upload.message?.trim() ||
        (selectedSlot === 'film_featured_guest_video'
          ? 'A guest-shot angle worth highlighting right under the main film.'
          : 'A guest contribution worth putting near the top of the story right now.'),
      badgeLabel:
        selectedSlot === 'film_featured_guest_video'
          ? 'Featured guest clip'
          : 'Guest upload',
      memoryTrail: (upload.memory_trail as MemoryTrailId | null) || selectedDefinition.defaultMemoryTrail || '',
    })
  }

  function applyGuestbookSelection(message: GuestbookMessage) {
    updateDraft(selectedSlot, {
      sourceType: 'guestbook_message',
      sourceId: message.id,
      sourceLabel: message.name,
      sourceUrl: `/guestbook?message=${message.id}`,
      title: `A note from ${message.name}`,
      summary: message.content.slice(0, 180),
      badgeLabel: 'Featured note',
      memoryTrail: 'family',
    })
  }

  function applyFilmChapterSelection(option: (typeof filmChapterFeatureOptions)[number]) {
    updateDraft(selectedSlot, {
      sourceType: 'film_chapter',
      sourceId: option.value,
      sourceLabel: option.label.replace('Film chapter: ', ''),
      sourceUrl: `/film?moment=${option.value}`,
      title: option.label.replace('Film chapter: ', ''),
      summary: 'A direct path back into one chapter of the film without asking guests to restart the full feature.',
      badgeLabel: 'Film moment',
      memoryTrail: selectedDefinition.defaultMemoryTrail || '',
    })
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gold-100 bg-white px-6 py-12 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-gold-500" />
        <p className="mt-4 text-charcoal-500">Loading featured content slots...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Featured Content</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Use this like a small editorial desk, not a CMS. Choose one public slot, decide what should feel alive on
          the site right now, and save that single spotlight before moving to the next one.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.4rem] border border-gold-100 bg-white px-5 py-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Live now</p>
          <p className="mt-3 text-3xl font-display text-charcoal-900">{activeSlotCount}</p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">
            Editorial slots are currently active across Home and Film.
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-gold-100 bg-white px-5 py-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Ready sources</p>
          <p className="mt-3 text-3xl font-display text-charcoal-900">{approvedUploadsCount}</p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">
            Approved uploads are ready to become a standout card or featured clip.
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-gold-100 bg-white px-5 py-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Keepsake notes</p>
          <p className="mt-3 text-3xl font-display text-charcoal-900">{guestbookCount}</p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">
            Recent guestbook messages are available if you want a softer homepage moment.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-[1.6rem] border border-gold-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Featured overview</p>
            <h3 className="mt-2 text-xl font-display text-charcoal-900">Pick the next spotlight.</h3>
            <p className="mt-2 text-sm leading-6 text-charcoal-600">
              Choose a slot first, then make one clean editorial decision at a time.
            </p>
          </div>
          <Button variant="secondary" onClick={() => applyQuickAction(selectedSlot)} disabled={selectedIsSaving}>
            {getQuickActionLabel(selectedSlot)}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {editorialSlotDefinitions.map((definition) => (
            <FeaturedSlotOverviewCard
              key={definition.slot}
              definition={definition}
              draft={drafts[definition.slot]}
              feature={featuresBySlot[definition.slot]}
              isSelected={selectedSlot === definition.slot}
              onSelect={() => setSelectedSlot(definition.slot)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <section className="space-y-6 rounded-[1.6rem] border border-gold-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold-700">Selected slot</p>
              <h3 className="mt-2 text-2xl font-display text-charcoal-900">{selectedDefinition.label}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-charcoal-500">{selectedDefinition.description}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${
                selectedDraft.isActive
                  ? 'border-sage-200 bg-sage-100 text-charcoal-700'
                  : 'border-charcoal-200 bg-charcoal-50 text-charcoal-500'
              }`}
            >
              {selectedDraft.isActive ? 'Active on site' : 'Saved as draft'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor={`${selectedSlot}-source-type`}>Source type</Label>
                <select
                  id={`${selectedSlot}-source-type`}
                  value={selectedDraft.sourceType}
                  onChange={(event) =>
                    updateDraft(selectedSlot, {
                      sourceType: event.target.value as SiteEditorialFeatureSourceType,
                      sourceId: '',
                      sourceLabel: '',
                    })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                >
                  {Object.entries(editorialSourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-[1.15rem] border border-gold-100 bg-cream-50/70 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Selection status</p>
                <p className="mt-2 text-sm font-medium text-charcoal-900">
                  {selectedDraft.sourceId ? 'Source selected' : 'Choose a source next'}
                </p>
                <p className="mt-1 text-sm leading-6 text-charcoal-600">
                  Picking a source fills in the story fields so you can refine instead of starting from scratch.
                </p>
              </div>
            </div>

            {(selectedDraft.sourceType === 'guest_upload' || selectedDraft.sourceType === 'guestbook_message') && (
              <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Source picker</p>
                    <p className="mt-2 text-sm font-medium text-charcoal-900">
                      {selectedDraft.sourceType === 'guest_upload' ? 'Search approved uploads' : 'Search guestbook notes'}
                    </p>
                  </div>
                  <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700">
                    {activeSourceCount} results
                  </span>
                </div>

                <div className="mt-4">
                  <Input
                    id={`${selectedSlot}-source-search`}
                    value={selectedCandidateSearch}
                    onChange={(event) => updateCandidateSearch(selectedSlot, event.target.value)}
                    placeholder={
                      selectedDraft.sourceType === 'guest_upload'
                        ? 'Search by guest name, email, or note'
                        : 'Search by guest name or note'
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3">
                  {selectedDraft.sourceType === 'guest_upload' &&
                    filteredUploadCandidates.map((candidate) => (
                      <FeaturedSourceResultCard
                        key={candidate.id}
                        title={candidate.guest_name}
                        subtitle={
                          candidate.message?.trim() ||
                          (((candidate.video_urls?.length || 0) > 0)
                            ? 'Guest upload ready to spotlight.'
                            : 'Approved upload with no custom note yet.')
                        }
                        meta={`${new Date(candidate.created_at).toLocaleDateString()} · ${
                          ((candidate.video_urls?.length || 0) > 0) ? 'Has video' : 'Photo upload'
                        }`}
                        isSelected={selectedDraft.sourceId === candidate.id}
                        onClick={() => applyGuestUploadSelection(candidate)}
                      />
                    ))}
                  {selectedDraft.sourceType === 'guestbook_message' &&
                    filteredGuestbookCandidates.map((candidate) => (
                      <FeaturedSourceResultCard
                        key={candidate.id}
                        title={candidate.name}
                        subtitle={candidate.content}
                        meta={`${new Date(candidate.created_at).toLocaleDateString()} · ${candidate.type}`}
                        isSelected={selectedDraft.sourceId === candidate.id}
                        onClick={() => applyGuestbookSelection(candidate)}
                      />
                    ))}
                  {activeSourceCount === 0 && (
                    <div className="rounded-[1rem] border border-dashed border-gold-200 bg-white/85 px-4 py-4 text-sm text-charcoal-500">
                      No matches yet. Try a broader search or use the latest recommended source.
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedDraft.sourceType === 'film_chapter' && (
              <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Source picker</p>
                <p className="mt-2 text-sm font-medium text-charcoal-900">Choose a film chapter</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {filmChapterFeatureOptions.map((option) => (
                    <FeaturedSourceResultCard
                      key={option.value}
                      title={option.label.replace('Film chapter: ', '')}
                      subtitle="Use this chapter as the featured return path."
                      meta={`/film?moment=${option.value}`}
                      isSelected={selectedDraft.sourceId === option.value}
                      onClick={() => applyFilmChapterSelection(option)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedDraft.sourceType === 'custom' && (
              <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Custom source</p>
                <div className="mt-4">
                  <Label htmlFor={`${selectedSlot}-source-id-custom`}>Custom source key</Label>
                  <Input
                    id={`${selectedSlot}-source-id-custom`}
                    value={selectedDraft.sourceId}
                    onChange={(event) => updateDraft(selectedSlot, { sourceId: event.target.value })}
                    placeholder="Optional custom identifier"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor={`${selectedSlot}-title`}>Title</Label>
                <Input
                  id={`${selectedSlot}-title`}
                  value={selectedDraft.title}
                  onChange={(event) => updateDraft(selectedSlot, { title: event.target.value })}
                  placeholder="Card headline"
                />
              </div>
              <div>
                <Label htmlFor={`${selectedSlot}-memory-trail`}>Memory trail</Label>
                <select
                  id={`${selectedSlot}-memory-trail`}
                  value={selectedDraft.memoryTrail}
                  onChange={(event) => updateDraft(selectedSlot, { memoryTrail: event.target.value as MemoryTrailId | '' })}
                  className="mt-2 h-11 w-full rounded-xl border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                >
                  <option value="">No shared trail</option>
                  {memoryTrails.map((trail) => (
                    <option key={trail.id} value={trail.id}>
                      {trail.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor={`${selectedSlot}-summary`}>Summary</Label>
              <Textarea
                id={`${selectedSlot}-summary`}
                value={selectedDraft.summary}
                onChange={(event) => updateDraft(selectedSlot, { summary: event.target.value })}
                rows={3}
                placeholder="Short editorial summary for the public card."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <Label htmlFor={`${selectedSlot}-badge-label`}>Badge label</Label>
                <Input
                  id={`${selectedSlot}-badge-label`}
                  value={selectedDraft.badgeLabel}
                  onChange={(event) => updateDraft(selectedSlot, { badgeLabel: event.target.value })}
                  placeholder="Featured note, Guest upload..."
                />
              </div>
              <div>
                <Label htmlFor={`${selectedSlot}-cta-label`}>CTA label</Label>
                <Input
                  id={`${selectedSlot}-cta-label`}
                  value={selectedDraft.ctaLabel}
                  onChange={(event) => updateDraft(selectedSlot, { ctaLabel: event.target.value })}
                  placeholder="Open it, Play clip..."
                />
              </div>
              <div>
                <Label htmlFor={`${selectedSlot}-trail-text`}>Eyebrow text</Label>
                <Input
                  id={`${selectedSlot}-trail-text`}
                  value={selectedDraft.trail}
                  onChange={(event) => updateDraft(selectedSlot, { trail: event.target.value })}
                  placeholder="Now unfolding, Keepsake note..."
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm text-charcoal-600">
                <input
                  type="checkbox"
                  checked={selectedDraft.isActive}
                  onChange={(event) => updateDraft(selectedSlot, { isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-gold-300 text-gold-600 focus:ring-gold-500/30"
                />
                Make this slot active on the public site
            </label>

            <details className="rounded-[1.25rem] border border-gold-100 bg-white/90 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-charcoal-900">
                Advanced settings
                <ChevronDown className="h-4 w-4 text-charcoal-400" />
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <Label htmlFor={`${selectedSlot}-starts-at`}>Starts at</Label>
                    <Input
                      id={`${selectedSlot}-starts-at`}
                      type="datetime-local"
                      value={selectedDraft.startsAt}
                      onChange={(event) => updateDraft(selectedSlot, { startsAt: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${selectedSlot}-ends-at`}>Ends at</Label>
                    <Input
                      id={`${selectedSlot}-ends-at`}
                      type="datetime-local"
                      value={selectedDraft.endsAt}
                      onChange={(event) => updateDraft(selectedSlot, { endsAt: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <Label htmlFor={`${selectedSlot}-source-label`}>Source label override</Label>
                    <Input
                      id={`${selectedSlot}-source-label`}
                      value={selectedDraft.sourceLabel}
                      onChange={(event) => updateDraft(selectedSlot, { sourceLabel: event.target.value })}
                      placeholder="Optional public-facing source label"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${selectedSlot}-source-url`}>Source URL override</Label>
                    <Input
                      id={`${selectedSlot}-source-url`}
                      value={selectedDraft.sourceUrl}
                      onChange={(event) => updateDraft(selectedSlot, { sourceUrl: event.target.value })}
                      placeholder="Optional deep link for the public card"
                    />
                  </div>
                </div>
              </div>
            </details>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSave(selectedSlot)} disabled={selectedIsSaving}>
                {selectedIsSaving ? 'Saving...' : 'Save featured slot'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => updateDraft(selectedSlot, createEditorialDraft(selectedSlot, featuresBySlot[selectedSlot]))}
                disabled={selectedIsSaving}
              >
                Reset changes
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <FeaturedSlotPreviewCard slot={selectedSlot} draft={selectedDraft} />

          {selectedFeature && (
            <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Current live row</p>
              <p className="mt-2 text-sm font-medium text-charcoal-900">
                Updated {formatAuditTimestamp(selectedFeature.updated_at)}
                {selectedFeature.updated_by_email ? ` by ${selectedFeature.updated_by_email}` : ''}
              </p>
              <p className="mt-2 text-sm leading-6 text-charcoal-600">
                {selectedFeature.title}
                {selectedFeature.summary ? ` — ${selectedFeature.summary}` : ''}
              </p>
            </div>
          )}

          <details className="rounded-[1.25rem] border border-gold-100 bg-white/90 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-charcoal-900">
              Slot history
              <ChevronDown className="h-4 w-4 text-charcoal-400" />
            </summary>
            <div className="mt-4">
              <EditorialHistoryList entries={selectedHistory} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
*/

// Main Admin Component with Auth Check
export default function Admin() {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500" />
      </div>
    )
  }

  // Redirect if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/admin/login" replace state={{ from: redirectTo }} />
  }

  return <AdminLayout />
}
