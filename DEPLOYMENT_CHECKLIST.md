# 🚀 Wedding Website - Deployment Checklist

## Pre-Deployment Verification

### ✅ Build Verification
- [ ] Run `npm run build` - builds successfully
- [ ] Check `dist/` folder exists with all assets
- [ ] Verify no build errors or warnings
- [ ] Check bundle size (< 500KB gzipped JS)

### ✅ Code Quality
- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run format:check` - all files formatted
- [ ] Run `npm audit` - address critical vulnerabilities

### ✅ Content Verification
- [ ] All 247 photos are in `public/images/`
- [ ] Wedding video files are in `public/video/`
- [ ] Fonts loading correctly
- [ ] No placeholder images remaining

### ✅ SEO & Meta
- [ ] Title tags correct on all pages
- [ ] Meta descriptions present
- [ ] Open Graph tags for social sharing
- [ ] Favicon configured
- [ ] Sitemap generated
- [ ] robots.txt configured

---

## Testing

### ✅ E2E Tests
- [ ] Run `npm run test:e2e` - all tests pass
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile (iPhone, Android)
- [ ] Test on tablet (iPad)

### ✅ Manual Testing Checklist
- [ ] Homepage loads and shows couple names
- [ ] Navigation works between all pages
- [ ] Film player plays video
- [ ] Gallery displays photos (all 4 views)
- [ ] Face recognition modal opens
- [ ] Photo lightbox works with navigation
- [ ] Download photo works
- [ ] Share modal opens
- [ ] Guestbook displays messages
- [ ] Can open "Leave a Message" form
- [ ] Upload page has drag & drop zone
- [ ] 404 page shows for invalid URLs

### ✅ Responsive Testing
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### ✅ Performance
- [ ] Lighthouse score > 90 (Performance)
- [ ] Lighthouse score > 90 (Accessibility)
- [ ] Lighthouse score > 90 (Best Practices)
- [ ] Lighthouse score > 90 (SEO)
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s

---

## Environment Setup

### ✅ Domain & Hosting
- [ ] Domain registered (e.g., austinandjordyn.com)
- [ ] DNS configured
- [ ] SSL certificate enabled (HTTPS)
- [ ] Hosting platform selected (Netlify/Vercel/Cloudflare)

### ✅ Environment Variables
```bash
# Create .env file with:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_URL=https://your-domain.com
```

---

## Deployment Steps

### 1. Build for Production
```bash
npm ci              # Clean install
npm run build       # Production build
npm run preview     # Test locally
```

### 2. Deploy to Hosting

#### Option A: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

#### Option B: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### Option C: Cloudflare Pages
```bash
# Connect GitHub repo to Cloudflare Pages
# Or use Wrangler CLI
npx wrangler pages publish dist
```

### 3. Post-Deployment Verification
- [ ] Site loads at custom domain
- [ ] HTTPS working (no mixed content warnings)
- [ ] All pages accessible
- [ ] Assets loading (images, fonts, videos)
- [ ] No console errors

---

## Post-Launch Tasks

### ✅ Monitoring
- [ ] Google Analytics configured
- [ ] Error tracking (Sentry) - optional
- [ ] Uptime monitoring

### ✅ Backup
- [ ] Source code backed up (GitHub)
- [ ] Photo assets backed up
- [ ] Database backed up (if using Supabase)

### ✅ Guest Communication
- [ ] Share link with guests
- [ ] Send announcement message:
```
"Our wedding photos and video are ready! 
💍 View them here: https://your-domain.com
📸 Share your own photos on the site!
💌 Leave us a message in the guestbook!
```

---

## Rollback Plan

If issues occur after deployment:
1. Keep previous `dist/` folder backup
2. Revert DNS if needed
3. Check hosting platform rollback options
4. Monitor error logs

---

## Quick Reference

### Build Commands
```bash
npm run build        # Production build
npm run preview      # Preview locally
npm run test:e2e     # Run E2E tests
npm run lint         # Check code quality
```

### Deployment Check
```bash
curl -I https://your-domain.com  # Check HTTPS
```

---

**Ready to deploy!** 🎉💍
