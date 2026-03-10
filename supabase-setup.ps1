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
Write-Host "   npx supabase link --project-ref rxzbbtghnrvzubqrbhhx" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Push database schema to remote:" -ForegroundColor Yellow
Write-Host "   npx supabase db push" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start local development:" -ForegroundColor Yellow
Write-Host "   npx supabase start" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Stop local development:" -ForegroundColor Yellow
Write-Host "   npx supabase stop" -ForegroundColor Gray
Write-Host ""
Write-Host "5. View status:" -ForegroundColor Yellow
Write-Host "   npx supabase status" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Open Supabase Studio (local):" -ForegroundColor Yellow
Write-Host "   npx supabase studio" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "First-time setup steps:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Link your project" -ForegroundColor Green
Write-Host "   npx supabase link --project-ref rxzbbtghnrvzubqrbhhx" -ForegroundColor Gray
Write-Host ""
Write-Host "Step 2: Push the schema" -ForegroundColor Green
Write-Host "   npx supabase db push" -ForegroundColor Gray
Write-Host ""
Write-Host "Step 3: Create storage buckets (in Dashboard)" -ForegroundColor Green
Write-Host "   Go to: https://rxzbbtghnrvzubqrbhhx.supabase.co" -ForegroundColor Gray
Write-Host "   Navigate to: Storage → New Bucket" -ForegroundColor Gray
Write-Host "   Create: guest-photos, guest-videos, guest-voice" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

# Optionally run link command
$response = Read-Host "`nDo you want to link to the remote project now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nLinking to remote project..." -ForegroundColor Green
    npx supabase link --project-ref rxzbbtghnrvzubqrbhhx
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nLink successful!" -ForegroundColor Green
        
        $pushResponse = Read-Host "`nDo you want to push the database schema now? (y/n)"
        if ($pushResponse -eq 'y' -or $pushResponse -eq 'Y') {
            Write-Host "`nPushing schema to remote..." -ForegroundColor Green
            npx supabase db push
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nSchema pushed successfully!" -ForegroundColor Green
                Write-Host "`nNext steps:" -ForegroundColor Cyan
                Write-Host "1. Create storage buckets in the Supabase Dashboard" -ForegroundColor Yellow
                Write-Host "2. Run 'npm run dev' to test locally" -ForegroundColor Yellow
                Write-Host "3. Deploy to production" -ForegroundColor Yellow
            } else {
                Write-Host "`nSchema push failed. Check errors above." -ForegroundColor Red
            }
        }
    } else {
        Write-Host "`nLink failed. Make sure you're logged in to Supabase CLI." -ForegroundColor Red
        Write-Host "Run: npx supabase login" -ForegroundColor Yellow
    }
}

Write-Host "`nDone!" -ForegroundColor Green
