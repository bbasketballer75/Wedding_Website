# Clean git history and push fresh
Write-Host "🧹 Creating clean git history..." -ForegroundColor Cyan

# Create a new orphan branch (no history)
git checkout --orphan clean-main

# Add all files
git add .

# Create initial commit
git commit -m "feat: Complete wedding website with CI/CD pipeline

- Full React wedding website with post-wedding focus
- Complete CI/CD with GitHub Actions
- Netlify deployment configured
- Security scanning (Snyk, SonarCloud)
- Performance monitoring
- PWA support with offline functionality
- Comprehensive testing suite
- All secrets configured in GitHub"

# Delete old main branch
git branch -D main

# Rename clean-main to main
git branch -m main

# Force push to replace history
Write-Host "⚠ This will replace remote history. Proceeding..." -ForegroundColor Yellow
git push -f origin main

Write-Host "✅ Clean history pushed!" -ForegroundColor Green
