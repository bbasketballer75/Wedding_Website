# Clean Git History - Remove .windsurf/ folder from all commits
# This script uses BFG Repo-Cleaner to remove sensitive data from git history

Write-Host "🔒 Git History Cleanup Script" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
  Write-Host "❌ Error: Not in a git repository!" -ForegroundColor Red
  exit 1
}

# Step 1: Download BFG Repo-Cleaner
Write-Host "📦 Step 1: Downloading BFG Repo-Cleaner..." -ForegroundColor Yellow
$bfgUrl = "https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
$bfgPath = "bfg.jar"

if (-not (Test-Path $bfgPath)) {
  try {
    Invoke-WebRequest -Uri $bfgUrl -OutFile $bfgPath
    Write-Host "✓ BFG downloaded successfully" -ForegroundColor Green
  }
  catch {
    Write-Host "❌ Failed to download BFG: $_" -ForegroundColor Red
    exit 1
  }
}
else {
  Write-Host "✓ BFG already exists" -ForegroundColor Green
}

# Step 2: Check Java installation
Write-Host ""
Write-Host "☕ Step 2: Checking Java installation..." -ForegroundColor Yellow
try {
  $javaVersion = java -version 2>&1
  Write-Host "✓ Java is installed: $($javaVersion[0])" -ForegroundColor Green
}
catch {
  Write-Host "❌ Java is not installed!" -ForegroundColor Red
  Write-Host "   Please install Java from: https://www.java.com/download/" -ForegroundColor Yellow
  exit 1
}

# Step 3: Create backup
Write-Host ""
Write-Host "💾 Step 3: Creating backup..." -ForegroundColor Yellow
$backupDir = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
try {
  git clone --mirror . "../$backupDir"
  Write-Host "✓ Backup created at: ../$backupDir" -ForegroundColor Green
}
catch {
  Write-Host "⚠ Warning: Backup failed, continuing anyway..." -ForegroundColor Yellow
}

# Step 4: Commit any pending changes
Write-Host ""
Write-Host "📝 Step 4: Committing pending changes..." -ForegroundColor Yellow
git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "chore: Prepare for history cleanup"
  Write-Host "✓ Changes committed" -ForegroundColor Green
}
else {
  Write-Host "✓ No pending changes" -ForegroundColor Green
}

# Step 5: Run BFG to remove .windsurf folder
Write-Host ""
Write-Host "🧹 Step 5: Removing .windsurf/ from history..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray

try {
  java -jar bfg.jar --delete-folders .windsurf --no-blob-protection .
  Write-Host "✓ BFG completed successfully" -ForegroundColor Green
}
catch {
  Write-Host "❌ BFG failed: $_" -ForegroundColor Red
  exit 1
}

# Step 6: Clean up repository
Write-Host ""
Write-Host "🧽 Step 6: Cleaning up repository..." -ForegroundColor Yellow

Write-Host "   Expiring reflog..." -ForegroundColor Gray
git reflog expire --expire=now --all

Write-Host "   Running garbage collection..." -ForegroundColor Gray
git gc --prune=now --aggressive

Write-Host "✓ Repository cleaned" -ForegroundColor Green

# Step 7: Show what will be pushed
Write-Host ""
Write-Host "📊 Step 7: Repository status..." -ForegroundColor Yellow
$repoSize = (Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "   Repository size: $([math]::Round($repoSize, 2)) MB" -ForegroundColor Gray

# Step 8: Force push warning
Write-Host ""
Write-Host "⚠️  IMPORTANT: Force Push Required" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "The git history has been cleaned locally." -ForegroundColor White
Write-Host "To remove secrets from GitHub, you must force push:" -ForegroundColor White
Write-Host ""
Write-Host "   git push --force origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  WARNING: This will rewrite history on GitHub!" -ForegroundColor Red
Write-Host "   - Any collaborators will need to re-clone" -ForegroundColor Yellow
Write-Host "   - Open PRs may need to be recreated" -ForegroundColor Yellow
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Do you want to force push now? (yes/no)"

if ($confirmation -eq "yes") {
  Write-Host ""
  Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
    
  try {
    git push --force origin main
    Write-Host ""
    Write-Host "✅ SUCCESS! Git history cleaned and pushed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Go to GitHub security alerts" -ForegroundColor White
    Write-Host "2. Verify the secret is no longer detected" -ForegroundColor White
    Write-Host "3. Close the security alert" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Your repository is now clean!" -ForegroundColor Green
  }
  catch {
    Write-Host ""
    Write-Host "❌ Force push failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can manually force push with:" -ForegroundColor Yellow
    Write-Host "   git push --force origin main" -ForegroundColor Cyan
  }
}
else {
  Write-Host ""
  Write-Host "⏸️  Force push skipped." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "When ready, run:" -ForegroundColor White
  Write-Host "   git push --force origin main" -ForegroundColor Cyan
  Write-Host ""
}

Write-Host ""
Write-Host "📝 Cleanup complete!" -ForegroundColor Green
