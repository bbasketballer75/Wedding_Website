# 🎊 Austin & Jordyn - Wedding Website

## 🚀 Quick Deployment Guide

### Step 1: Verify Build
```bash
cd C:\Users\bbask\Coding_Projects\Wedding_Website_Clean
npm run build
```

### Step 2: Test Locally
```bash
npm run preview
# Open http://localhost:4173
```

### Step 3: Deploy to Production

#### Option A: Netlify (Recommended)
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
npx wrangler pages publish dist
```

### Step 4: Configure Domain
1. Add custom domain in hosting dashboard
2. Update DNS records
3. Wait for SSL certificate

---

## ✅ Pre-Flight Checklist

- [ ] `npm run build` succeeds
- [ ] `dist/` folder contains all files
- [ ] E2E tests passing (run: `npm run test:e2e`)
- [ ] Site loads at preview URL
- [ ] All pages accessible
- [ ] Photos display correctly
- [ ] Video player works
- [ ] Mobile responsive

---

## 📊 Build Stats

| Metric | Value |
|--------|-------|
| JS Bundle | ~325 KB (gzipped) |
| CSS Bundle | ~140 KB (gzipped) |
| Total Build | ~628 KB |
| Build Time | ~11s |

---

## 📁 Project Structure

```
Wedding_Website_Clean/
├── dist/              # Production build (deploy this)
├── public/            # Static assets (images, videos)
├── src/               # Source code
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── hooks/         # Custom hooks
│   └── utils/         # Utilities
├── tests/e2e/         # E2E tests
├── index.html         # Entry HTML
├── package.json       # Dependencies
└── vite.config.js     # Build config
```

---

## 🎯 Features Included

### Core
- ✅ Home page with hero video
- ✅ Wedding film player with chapters
- ✅ Photo gallery (4 view modes)
- ✅ Guest photo upload
- ✅ Guestbook with reactions

### Advanced
- ✅ Face recognition ("Find Me")
- ✅ Voice & video recording
- ✅ Social sharing
- ✅ Photo download
- ✅ Timeline view
- ✅ Map view
- ✅ Infinite scroll
- ✅ Sort options

### Technical
- ✅ PWA ready
- ✅ Responsive design
- ✅ Keyboard navigation
- ✅ Accessibility support

---

## 🔧 Troubleshooting

### Build fails
```bash
npm ci          # Clean install
npm run build   # Try again
```

### Tests timeout
```bash
# Start server manually
npm run preview &

# Run tests
npm run test:e2e
```

### Port in use
```bash
# Kill process on port 4173
npx kill-port 4173
```

---

## 📞 Support

For issues:
1. Check DEPLOYMENT_CHECKLIST.md
2. Review test results
3. Check browser console for errors

---

**Ready to deploy!** 🎉💍
