# ============================================
# Supabase Setup Script for Wedding Website
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Supabase CLI Setup for Wedding Website" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if npx is available
if (!(Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: npx is not available. Please install Node.js." -ForegroundColor Red
    exit 1
}

Write-Host "Available commands:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Link to remote project:" -ForegroundColor Yellow
Write-Host "   npm run supabase:link" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Push database schema to remote:" -ForegroundColor Yellow
Write-Host "   npm run supabase:db:push:dry" -ForegroundColor Gray
Write-Host "   npm run supabase:db:push" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start local development:" -ForegroundColor Yellow
Write-Host "   npm run supabase:start" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Stop local development:" -ForegroundColor Yellow
Write-Host "   npm run supabase:stop" -ForegroundColor Gray
Write-Host ""
Write-Host "5. View status:" -ForegroundColor Yellow
Write-Host "   npm run supabase:status" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "First-time setup steps:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Link your project" -ForegroundColor Green
Write-Host "   npm run supabase:link" -ForegroundColor Gray
Write-Host ""
Write-Host "Step 2: Start the local stack" -ForegroundColor Green
Write-Host "   npm run supabase:start" -ForegroundColor Gray
Write-Host ""
Write-Host "Step 3: Verify local URLs" -ForegroundColor Green
Write-Host "   Frontend auth URL: http://127.0.0.1:5173" -ForegroundColor Gray
Write-Host "   Supabase Studio:   http://127.0.0.1:54323" -ForegroundColor Gray
Write-Host ""
Write-Host "Step 4: Dry-run remote migrations before pushing" -ForegroundColor Green
Write-Host "   npm run supabase:db:push:dry" -ForegroundColor Gray
Write-Host ""
Write-Host "Note:" -ForegroundColor Yellow
Write-Host "   If the hosted pooler starts throwing auth circuit-breaker errors," -ForegroundColor Gray
Write-Host "   use a password-backed CLI push instead of retrying temp-role login." -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

# Optionally run link command
$response = Read-Host "`nDo you want to link to the remote project now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nLinking to remote project..." -ForegroundColor Green
    npm run supabase:link
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nLink successful!" -ForegroundColor Green
        
        $startResponse = Read-Host "`nDo you want to start the local Supabase stack now? (y/n)"
        if ($startResponse -eq 'y' -or $startResponse -eq 'Y') {
            Write-Host "`nStarting local Supabase..." -ForegroundColor Green
            npm run supabase:start
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nLocal Supabase started successfully!" -ForegroundColor Green
                Write-Host "`nNext steps:" -ForegroundColor Cyan
                Write-Host "1. Run 'npm run supabase:status' to confirm service health" -ForegroundColor Yellow
                Write-Host "2. Run 'npm run dev' to test locally against the app" -ForegroundColor Yellow
                Write-Host "3. Use 'npm run supabase:db:push:dry' before any remote migration push" -ForegroundColor Yellow
            } else {
                Write-Host "`nLocal start failed. Check Docker and the CLI output above." -ForegroundColor Red
            }
        }
    } else {
        Write-Host "`nLink failed. Make sure you're logged in to Supabase CLI." -ForegroundColor Red
        Write-Host "Run: npx supabase login" -ForegroundColor Yellow
    }
}

Write-Host "`nDone!" -ForegroundColor Green
