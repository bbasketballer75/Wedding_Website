# Set GitHub Secrets from .env file
# Run this after you've added secret values to .env

Write-Host "🔐 Setting GitHub Secrets from .env file..." -ForegroundColor Cyan
Write-Host ""

# Read .env file
$envFile = Get-Content .env -Raw

# Function to extract value from .env
function Get-EnvValue {
    param([string]$key)
    
    if ($envFile -match "(?m)^$key=(.*)$") {
        $value = $matches[1].Trim()
        # Remove quotes if present
        $value = $value -replace '^["'']|["'']$', ''
        return $value
    }
    return $null
}

# Function to set secret if value exists
function Set-GitHubSecret {
    param(
        [string]$secretName,
        [string]$envKey,
        [bool]$required = $false
    )
    
    $value = Get-EnvValue -key $envKey
    
    if ($value -and $value -ne "") {
        Write-Host "✓ Setting $secretName..." -ForegroundColor Green
        $value | gh secret set $secretName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $secretName set successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to set $secretName" -ForegroundColor Red
        }
    } else {
        if ($required) {
            Write-Host "⚠ $secretName is REQUIRED but not found in .env" -ForegroundColor Yellow
        } else {
            Write-Host "⊘ Skipping $secretName (not in .env)" -ForegroundColor Gray
        }
    }
}

Write-Host "📦 REQUIRED SECRETS (Netlify)" -ForegroundColor Cyan
Write-Host "─────────────────────────────────" -ForegroundColor Gray

Set-GitHubSecret -secretName "NETLIFY_AUTH_TOKEN" -envKey "NETLIFY_AUTH_TOKEN" -required $true
Set-GitHubSecret -secretName "NETLIFY_SITE_ID" -envKey "NETLIFY_SITE_ID" -required $true
Set-GitHubSecret -secretName "NETLIFY_STAGING_SITE_ID" -envKey "NETLIFY_STAGING_SITE_ID" -required $true

Write-Host ""
Write-Host "🔒 OPTIONAL SECRETS" -ForegroundColor Cyan
Write-Host "─────────────────────────────────" -ForegroundColor Gray

# Security Scanning
Set-GitHubSecret -secretName "SNYK_TOKEN" -envKey "SNYK_TOKEN"

# Code Quality
Set-GitHubSecret -secretName "SONAR_TOKEN" -envKey "SONAR_TOKEN"
Set-GitHubSecret -secretName "SONAR_HOST_URL" -envKey "SONAR_HOST_URL"

# Notifications
Set-GitHubSecret -secretName "SLACK_WEBHOOK_URL" -envKey "SLACK_WEBHOOK_URL"

# Gemini (if present)
Set-GitHubSecret -secretName "APP_ID" -envKey "GITHUB_APP_ID"
Set-GitHubSecret -secretName "APP_PRIVATE_KEY" -envKey "GITHUB_APP_PRIVATE_KEY"

Write-Host ""
Write-Host "─────────────────────────────────" -ForegroundColor Gray
Write-Host "✅ Done! Check results above." -ForegroundColor Green
Write-Host ""
Write-Host "To verify secrets were added:" -ForegroundColor Cyan
Write-Host "  gh secret list" -ForegroundColor White
Write-Host ""
