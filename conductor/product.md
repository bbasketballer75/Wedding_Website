# Product Guide

## Initial Concept

Austin & Jordyn's Wedding Website - A custom-built, interactive web application serving as a permanent post-wedding archive to share their story, host their wedding gallery, and preserve guestbook memories.

## Product Vision & Goals

To provide a beautiful, seamless, and permanent digital archive of Austin and Jordyn's wedding. The platform allows the extended circle of family, friends, and guests to relive the wedding day, browse and download photos, and leave messages.

## Target Audience

- **Public & Extended Circle:** Friends, family members, and well-wishers who want to view the wedding highlights, read about the couple, and explore gallery media.

## Core Features & Capabilities

1. **Interactive Gallery:**
   - High-performance, optimized image and video loading (masonry layouts, virtualized lists).
   - Face-tagging navigation (synchronized with DigiKam metadata).
   - Batch downloads of photo albums.
2. **Guestbook Engagement:**
   - Digital guestbook for signing and leaving messages.
   - Ability for guests to upload their own photos from the celebration.
3. **Story Preservation:**
   - Story timeline detailing Austin and Jordyn's journey.
   - Interactive maps of the wedding and reception locations.

## Gallery Access & Security

- **Publicly Open:** The site is publicly accessible, allowing easy browsing and direct downloading of all gallery media by visitors without requiring mandatory login credentials.

## Media Storage & Hosting Infrastructure

- **Cost-Effective Storage Architecture:**
  - Leverage Supabase Storage for critical website assets, database-driven images, and small files.
  - Integrate cost-effective object storage (such as AWS S3 or Cloudflare R2) for high-resolution images and video archives, utilizing the S3 client for optimized and economical data retrieval.
