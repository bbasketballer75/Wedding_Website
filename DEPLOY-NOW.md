# 🚀 DEPLOY NOW - Step by Step

## Option 1: Netlify (Easiest - Recommended)

### Step 1: Open terminal in project folder
```bash
cd C:\Users\bbask\Coding_Projects\Wedding_Website_Clean
```

### Step 2: Deploy to Netlify
```bash
netlify deploy --prod --dir=dist
```

### Step 3: Authenticate (First time only)
- A browser window will open
- Click "Authorize"
- Login with GitHub/Google/Email
- Return to terminal

### Step 4: Follow prompts
```
? This folder isn't linked to a site yet. What would you like to do?
> Create & configure a new site

? Site name (optional): austin-jordyn-wedding

? Publish directory: dist
```

### Step 5: Get your URL
After deployment, you will see:
```
Website URL: https://austin-jordyn-wedding-abc123.netlify.app
```

### Step 6: Configure custom domain (Optional)
```bash
netlify open
# Then go to Site settings > Domain management
```

---

## Option 2: Vercel (Alternative)

### Step 1: Deploy
```bash
cd C:\Users\bbask\Coding_Projects\Wedding_Website_Clean
npx vercel --prod
```

### Step 2: Authenticate (First time only)
- Follow browser prompts
- Login with GitHub/Google/Email

### Step 3: Confirm settings
```
? Set up and deploy "C:\Users\bbask\Coding_Projects\Wedding_Website_Clean"? [Y/n] y
? Which scope? [your-username]
? Link to existing project? [n]
? What is your project named? [austin-jordyn-wedding]
```

---

## Option 3: Cloudflare Pages (Best Performance)

### Using Wrangler CLI:
```bash
cd C:\Users\bbask\Coding_Projects\Wedding_Website_Clean
npx wrangler pages publish dist
```

### Or Manual Upload:
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Create new Pages project
3. Upload the `dist/` folder

---

## Option 4: GitHub Pages (Free)

### Step 1: Create GitHub repo
1. Go to github.com
2. Create new repository
3. Upload this project

### Step 2: Enable GitHub Pages
1. Go to repo Settings > Pages
2. Source: Deploy from a branch
3. Branch: main / (root)

---

## ✅ Post-Deployment Checklist

After deploying, verify:

- [ ] Site loads at the provided URL
- [ ] Homepage shows Austin & Jordyn
- [ ] Film page plays video
- [ ] Gallery shows photos
- [ ] Upload page has form
- [ ] Guestbook shows messages
- [ ] Mobile view works
- [ ] Share buttons work
- [ ] Download buttons work

---

## 🔧 Troubleshooting

### "Not authorized" error
```bash
netlify logout
netlify login
# Then try deploy again
```

### "Command not found" error
```bash
npm install -g netlify-cli
```

### Build fails on deploy
```bash
npm run build
# Check dist/ folder exists
ls dist/
```

---

## 🎉 Your Site Will Be Live At:

**Temporary URL:** `https://[site-name]-[random].netlify.app`

**Custom Domain:** `https://austinandjordyn.com` (after configuration)

---

## 📱 Share With Guests

Once deployed, send this message to your guests:

```
🎊 Our wedding photos and video are ready!

💍 View them here: [YOUR-URL]
📸 Share your own photos on the site
💌 Leave us a message in the guestbook

Thank you for celebrating with us!
- Austin & Jordyn
```

---

## Need Help?

1. Check DEPLOYMENT_CHECKLIST.md for full details
2. Run tests: `npm run test:e2e`
3. Preview locally: `npm run preview`

---

**Ready to deploy! Choose an option above and run the commands.** 🚀💍
