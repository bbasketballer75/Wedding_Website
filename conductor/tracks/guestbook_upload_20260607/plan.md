# Implementation Plan: Enhance Guestbook and Guest Photo Upload Verification Workflow

This plan outlines the phase-by-phase tasks required to implement the guestbook and photo verification flow, adhering to Test-Driven Development (TDD) principles and the Conductor workflow.

---

## Phase 1: Database Schema & Storage Setup [checkpoint: b9eb063]

- [x] Task: Configure Supabase Database and Storage Policies [1a49e30]
  - [x] Write schema migration file and local tests to validate tables
  - [x] Create `guest_photos` table with fields: `id`, `entry_id`, `url`, `status` (pending/approved/rejected), `created_at`
  - [x] Set up Row Level Security (RLS) policies for insert access (public guest upload) and read/write access (admin only)
  - [x] Configure `guest-uploads` storage bucket RLS policies

- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Schema & Storage Setup' (Protocol in workflow.md)

---

## Phase 2: Guestbook & Photo Upload UI Enhancements

- [ ] Task: Refine Guestbook Form
  - [ ] Write component tests for Guestbook text input and submission states
  - [ ] Implement spam-prevention checks (honeypot fields) and validation in the guestbook submission form

- [ ] Task: Implement Drag-and-Drop Photo Uploader Component
  - [ ] Write component tests for file drop, image resizing, and preview renders
  - [ ] Build React uploader component with client-side image compression (WebP conversion) and multi-file upload progress bar

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Guestbook & Photo Upload UI Enhancements' (Protocol in workflow.md)

---

## Phase 3: Administrative Moderation Dashboard

- [ ] Task: Build Admin Moderation Portal
  - [ ] Write tests for the moderation list component and approval API requests
  - [ ] Create dashboard UI showing grid of pending photos with Approve/Reject actions (accessible only to authenticated administrators)

- [ ] Task: Integrate Guest Photo Metadata Sync Script
  - [ ] Write tests for the syncing script `sync-guest-photo-face-metadata.mjs`
  - [ ] Refine/integrate the script to export approved guest photos and index face tag details

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Administrative Moderation Dashboard' (Protocol in workflow.md)

---

## Phase 4: End-to-End Testing & Verification

- [ ] Task: Write E2E Integration Tests
  - [ ] Create Playwright E2E tests covering the complete guest flow: signing guestbook -> uploading photos -> admin moderation dashboard -> approving photos -> appearing in public gallery
  - [ ] Execute tests locally and verify all checks pass successfully

- [ ] Task: Conductor - User Manual Verification 'Phase 4: End-to-End Testing & Verification' (Protocol in workflow.md)
