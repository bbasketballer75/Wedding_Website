---
phase: "15"
plan: "01"
subsystem: "activity-feed"
tags:
  - "database"
  - "backend"
  - "zustand"
dependency_graph:
  requires: []
  provides:
    - "activity_log table"
    - "fetchActivityFeed function"
    - "fetchActivityItem function"
    - "activityFeedStore"
  affects:
    - "Phase 15-02 (Activity Feed UI)"
tech_stack:
  added:
    - "activity_log PostgreSQL table with triggers"
    - "ActivityLogItem TypeScript interface"
    - "fetchActivityFeed/fetchActivityItem query functions"
    - "activityFeedStore Zustand store with sessionStorage persistence"
  patterns:
    - "Zustand persist middleware with custom sessionStorage adapter"
    - "PostgreSQL triggers for cross-table activity propagation"
    - "Supabase Realtime publication for activity_log"
key_files:
  created:
    - "supabase/migrations/20260430000100_activity_log_table.sql"
    - "src/stores/activityFeedStore.ts"
  modified:
    - "src/lib/supabase.ts"
    - "src/stores/index.ts"
decisions:
  - "Used AFTER UPDATE trigger on guest_uploads (not AFTER INSERT) to capture status change to 'approved'"
  - "Used AFTER INSERT trigger on guestbook_messages since messages are already approved by default"
  - "Used custom sessionStorage adapter in Zustand persist to isolate filter preference from main UI store"
metrics:
  duration: 177
  completed_date: "2026-04-30T04:22:48Z"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
---

# Phase 15 Plan 01: Activity Feed Data Layer Summary

## Objective
Create the database foundation for the activity feed: activity_log table, triggers on source tables, Supabase query functions, and Zustand store.

## Completed Tasks

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Create activity_log migration with triggers | 0ac6fde2 | supabase/migrations/20260430000100_activity_log_table.sql |
| Task 2: Add activity query functions to supabase.ts | 84005b78 | src/lib/supabase.ts |
| Task 3: Create activityFeedStore Zustand store | b0c723e8 | src/stores/activityFeedStore.ts, src/stores/index.ts |

## What Was Built

### 1. activity_log Table Migration
- **Table**: `activity_log` with columns: id, type, source_id, source_type, display_name, thumbnail_url, content_preview, created_at
- **Index**: `idx_activity_log_created_at` on (created_at DESC)
- **Trigger function**: `trigger_activity_log_insert()` handles inserts for all three source tables
- **Triggers**:
  - `guest_uploads_after_approve` — AFTER UPDATE fires when status changes to 'approved'
  - `guestbook_messages_after_insert` — AFTER INSERT fires on every new guestbook message
  - `site_editorial_features_after_insert` — AFTER INSERT fires when is_active = true
- **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE activity_log`

### 2. Supabase Query Functions
- **ActivityLogItem interface**: TypeScript type with all activity log fields
- **fetchActivityFeed(limit?)**: Returns `Promise<ActivityLogItem[]>` ordered by created_at DESC
- **fetchActivityItem(sourceType, sourceId)**: Returns `Promise<ActivityLogItem | null>` for specific item lookup

### 3. activityFeedStore Zustand Store
- **ActivityFilterType**: `'all' | 'photos' | 'guestbook' | 'moments'`
- **State fields**: items, hasMore, isLoading, activeFilter, newItemsCount, newItems
- **Actions**: setItems, prependItems, setHasMore, setIsLoading, setActiveFilter, addNewItems, clearNewItems
- **Persistence**: activeFilter persists to sessionStorage via custom adapter

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new security surface introduced. All activity log inserts are server-side only via database triggers. Client can only read via fetchActivityFeed/fetchActivityItem which are subject to existing RLS policies.

## Verification Results

- [x] Migration file contains "CREATE TABLE activity_log"
- [x] Migration file contains "CREATE TRIGGER" (3 triggers present)
- [x] Migration file contains "ALTER PUBLICATION supabase_realtime ADD TABLE activity_log"
- [x] guest_uploads trigger only fires when status = 'approved' (using AFTER UPDATE with WHEN condition)
- [x] site_editorial_features trigger only fires when is_active = true (using WHEN condition)
- [x] ActivityLogItem interface exists with all required fields
- [x] fetchActivityFeed returns Promise<ActivityLogItem[]>
- [x] fetchActivityItem returns Promise<ActivityLogItem | null>
- [x] activityFeedStore.ts exports ActivityFilterType
- [x] src/stores/index.ts exports activityFeedStore

## TDD Gate Compliance

Not a TDD plan (type: execute) — no RED/GREEN/REFACTOR cycle required.

## Self-Check

- [x] All 3 commits present
- [x] All files exist on disk
- [x] All acceptance criteria met
