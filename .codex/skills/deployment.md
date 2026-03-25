# Skill: Deployment and Operations

## Overview

This skill enables Codex to manage deployments to Netlify and Cloudflare, and handle operational tasks for the wedding website.

## Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cloudflare    │────▶│    Netlify      │────▶│    Supabase     │
│   (DNS + CDN)   │     │  (Frontend)     │     │  (Backend)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │              ┌─────────────────┐             │
        └─────────────▶│  Cloudflare R2  │◀────────────┘
                       │  (Media Storage)│
                       └─────────────────┘
```

## Netlify Deployment

### Configuration

Netlify config is in `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

### Deployment Methods

#### 1. Git-based Deployment (Recommended)

1. Connect GitHub repo to Netlify
2. Auto-deploys on push to main branch
3. Preview deploys for pull requests

#### 2. CLI Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Link to site
netlify link

# Deploy
netlify deploy --prod
```

#### 3. Manual Build + Deploy

```bash
# Build locally
npm run build

# Verify build
npm run preview

# Deploy (if configured)
netlify deploy --prod --dir=dist
```

### Environment Variables

Set in Netlify Dashboard → Site settings → Environment variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MEDIA_BASE_URL=https://media.wedding.theporadas.com
VITE_SENTRY_DSN=your-sentry-dsn
```

## Pre-deployment Checklist

### Verification Commands

```bash
# Full release verification
npm run verify:release

# This runs:
# 1. npm run verify:env       - Check environment variables
# 2. npm run verify:secrets   - Verify repo secrets
# 3. npm run verify:supabase  - Test Supabase connection
# 4. npm run lint             - Lint code
# 5. npx tsc --noEmit         - Type check
# 6. npm run test:run         - Run unit tests
# 7. npm run build            - Production build
# 8. npm run test:e2e:public  - Run E2E tests
```

### Manual Checks

```bash
# 1. Type checking
npx tsc --noEmit

# 2. Linting
npm run lint

# 3. Tests
npm run test:run

# 4. Build
npm run build

# 5. Preview build
npm run preview

# 6. E2E tests against preview
npm run test:e2e:public
```

## Cloudflare Configuration

### DNS Settings

```
Type    Name                    Value                           TTL
A       @                       75.2.60.5 (Netlify)             Auto
CNAME   www                     wedding-site.netlify.app        Auto
CNAME   media                   cdn.cloudflare.com              Auto
```

### Page Rules

```
URL: www.theporadas.com/*
Settings:
  - Always Use HTTPS: ON
  - Security Level: High
  - Browser Cache TTL: 4 hours
```

### R2 Media Storage

Configuration in Cloudflare Dashboard:

```bash
# Bucket: wedding-media
# Public URL: https://media.wedding.theporadas.com

# CORS Policy:
[
  {
    "AllowedOrigins": ["https://www.theporadas.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"]
  }
]
```

## Supabase Production Settings

### Database

```sql
-- Ensure RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Rate Limiting

Configure in Supabase Dashboard → Database → Extensions:

```sql
-- Enable pg_net for webhooks (if needed)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Connection pooling
-- Dashboard → Database → Connection pooling
-- Max connections: 200
-- Pool size: 15
```

### Backup Strategy

```bash
# Daily automated backups (included)
# Point-in-time recovery (7 days on Pro)

# Manual backup via CLI
supabase db dump -f backup.sql
```

## Rollback Procedures

### Quick Rollback (Netlify)

```bash
# Via CLI
netlify deploy --prod --dir=dist-previous

# Via Dashboard
# Site → Deploys → Select previous deploy → Publish deploy
```

### Database Rollback

```bash
# Restore from backup
supabase db restore backup.sql

# Or use Dashboard
# Database → Backups → Select backup → Restore
```

## Monitoring and Alerts

### Sentry Integration

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
})
```

### Netlify Analytics

Enabled in Dashboard → Analytics:
- Page views
- Unique visitors
- Top pages
- Geographic data

### Uptime Monitoring

```bash
# Verify deployed site
npm run verify:deployed

# Or manually check
curl -s -o /dev/null -w "%{http_code}" https://www.theporadas.com
```

## Common Operations

### Clear CDN Cache

```bash
# Cloudflare Purge Cache
# Dashboard → Caching → Configuration → Purge Everything

# Or via API
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### Database Maintenance

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Vacuum (auto-vacuum usually handles this)
VACUUM ANALYZE photos;
```

### Media Operations

```bash
# Upload media batch
npm run media:batch:catalog
npm run media:batch:organize
npm run media:batch:optimize
npm run media:batch:publish

# Sync guest photo tags
npm run media:guest:tag:sync
```

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Environment Issues

```bash
# Verify env vars
npm run verify:env

# Check Supabase connection
npm run verify:supabase
```

### Performance Issues

```bash
# Analyze bundle
npm run build:analyze

# Check Lighthouse score
npx lighthouse https://www.theporadas.com --output=json
```

## Security Checklist

- [ ] Environment variables not in code
- [ ] Service role key never in frontend
- [ ] RLS policies properly configured
- [ ] HTTPS enforced
- [ ] Security headers set
- [ ] Dependencies updated (`npm audit`)
- [ ] Sentry monitoring active
- [ ] Regular backups verified
