# Pre-Launch Checklist

## Production Readiness Status

### ✅ Phase 1: Core Stability (COMPLETE)
- [x] Consolidated Supabase clients (singleton pattern)
- [x] Removed unused Apollo/query code paths from the shipping app
- [x] Fixed live-route TypeScript and accessibility regressions
- [x] Removed mock data fallbacks from the active Supabase flows
- [x] Verification passing (`lint`, `tsc`, `build`, unit tests, E2E)

### ✅ Phase 2: Security & Performance (COMPLETE)
- [x] Implemented rate limiting (client + server)
- [x] Fixed infinite scroll race conditions
- [x] Deprecated misleading CSRF functions
- [x] Row Level Security (RLS) enabled
- [x] Frontend env templates cleaned of service-role key examples

### ✅ Phase 3: Performance Optimization (COMPLETE)
- [x] Lazy loading implemented
- [x] Code splitting active
- [x] All E2E tests passing
- [x] Build successful on Vite 7.3.1
- [x] Media offload path added via `VITE_MEDIA_BASE_URL`

### ✅ Phase 4: Polish & Admin (COMPLETE)
- [x] Accessibility improvements (WCAG 2.1 AA)
- [x] Image optimization (WebP, lazy loading)
- [x] Real-time features working
- [x] Admin dashboard created
- [x] Admin Analytics page implemented
- [x] Admin Settings page implemented

### 🔄 Task A: Quick Fixes (IN PROGRESS)
- [x] Fix placeholder emails in forms (Guestbook, Upload)
- [x] Replace flaky gallery E2E assertions with real page-content checks
- [x] Generate missing PWA and favicon assets
- [ ] Reduce remaining non-blocking lint warnings in utility and worker files

---

## Pre-Launch Tasks

### Infrastructure

- [ ] **Domain Setup**
  - [ ] Purchase/verify domain name
  - [ ] Configure DNS records
  - [ ] Set up SSL certificate (Let's Encrypt or provider)
  - [ ] Test domain resolution

- [ ] **Hosting Configuration**
  - [ ] Deploy to production hosting (Netlify/Vercel)
  - [ ] Configure environment variables on hosting platform
  - [ ] Set up branch deploys (main = production)
  - [ ] Configure build settings (Vite build command)

- [ ] **Supabase Production**
  - [ ] Verify production project settings
  - [ ] Confirm RLS policies active
  - [ ] Set up database backups
  - [ ] Configure connection pooling
  - [ ] Set up log drains for monitoring

### Security (CRITICAL)

- [ ] **Service Role Key Rotation** 🔴 CRITICAL
  - [x] Remove `SUPABASE_SERVICE_ROLE_KEY` from frontend env templates and setup docs
  - [ ] Verify no real service-role value exists in local `.env`
  - [ ] Verify key not in git history if a real value was ever committed
  - [ ] Add server-only secret to deployment or function environment only

- [ ] **Authentication**
  - [ ] Test all auth flows (sign up, sign in, reset password)
  - [ ] Verify email templates are configured
  - [ ] Test OAuth providers if enabled
  - [ ] Review session timeout settings

- [ ] **Data Protection**
  - [ ] Verify RLS policies on ALL tables
  - [ ] Test edge cases for data access
  - [ ] Review storage bucket permissions
  - [ ] Enable audit logging

### Content

- [ ] **Wedding Details**
  - [x] Couple names confirmed in shipping UI
  - [x] Wedding date confirmed in shipping UI (`2025-05-10`)
  - [ ] Update venue information
  - [ ] Verify all event times

- [ ] **Photos**
  - [ ] Upload engagement photos to storage
  - [ ] Verify all photo paths work
  - [ ] Optimize hero/large images
  - [ ] Add alt text for accessibility

- [ ] **Copy & Text**
  - [ ] Proofread all content
  - [ ] Update placeholder text (RSVP, directions, etc.)
  - [ ] Add registry links
  - [ ] Verify contact information

### Functionality

- [ ] **RSVP System**
  - [ ] Test RSVP form submission
  - [ ] Verify email confirmations
  - [ ] Test plus-one handling
  - [ ] Test dietary restrictions field

- [ ] **Guest Uploads**
  - [ ] Test photo upload flow
  - [ ] Verify moderation queue works
  - [ ] Test file type/size limits
  - [ ] Confirm storage bucket permissions

- [ ] **Guestbook**
  - [ ] Test message submission
  - [ ] Verify real-time updates
  - [ ] Test moderation/deletion

### Performance

- [ ] **Core Web Vitals**
  - [ ] LCP (Largest Contentful Paint) < 2.5s
  - [ ] FID (First Input Delay) < 100ms
  - [ ] CLS (Cumulative Layout Shift) < 0.1

- [ ] **Bundle Size**
  - [ ] Verify production build size
  - [ ] Check for unused dependencies
  - [ ] Verify code splitting working

- [ ] **Image Optimization**
  - [ ] All images in WebP format
  - [ ] Lazy loading implemented
  - [ ] Responsive images configured

### SEO & Sharing

- [ ] **Meta Tags**
  - [ ] Title tags on all pages
  - [ ] Meta descriptions
  - [ ] Open Graph tags
  - [ ] Twitter Card tags

- [ ] **Sitemap & Robots**
  - [ ] Generate sitemap.xml
  - [ ] Create robots.txt
  - [ ] Submit to Google Search Console

- [ ] **Social Preview**
  - [ ] Test Facebook sharing
  - [ ] Test Twitter sharing
  - [ ] Verify preview image displays

### Testing

- [ ] **Cross-Browser**
  - [ ] Chrome/Edge
  - [ ] Firefox
  - [ ] Safari (desktop & mobile)
  - [ ] Mobile browsers (iOS Safari, Chrome Android)

- [ ] **Responsive Design**
  - [ ] Desktop (1920x1080)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667)
  - [ ] Test all breakpoints

- [ ] **Accessibility**
  - [ ] Keyboard navigation works
  - [ ] Screen reader compatible
  - [ ] Color contrast verified
  - [ ] Focus indicators visible

### Analytics & Monitoring

- [ ] **Analytics Setup**
  - [ ] Add Google Analytics 4
  - [ ] Configure events (RSVP, uploads, etc.)
  - [ ] Set up conversion goals

- [ ] **Error Tracking**
  - [ ] Add Sentry or similar
  - [ ] Configure error alerts
  - [ ] Test error reporting

- [ ] **Uptime Monitoring**
  - [ ] Set up ping monitoring
  - [ ] Configure downtime alerts

### Post-Launch

- [ ] **Immediate**
  - [ ] Test live site thoroughly
  - [ ] Share with wedding party for feedback
  - [ ] Monitor error logs
  - [ ] Check analytics data flowing

- [ ] **Ongoing**
  - [ ] Monitor guest uploads
  - [ ] Approve photos in admin
  - [ ] Respond to guestbook entries
  - [ ] Update as wedding date approaches

---

## Launch Sign-Off

| Role | Name | Sign-Off | Date |
|------|------|----------|------|
| Developer | | ⬜ | |
| Content Reviewer | | ⬜ | |
| Security Review | | ⬜ | |
| Couple Approval | | ⬜ | |

---

**Checklist Version:** 1.1  
**Last Updated:** 2026-03-10  
**Target Launch Date:** ___
