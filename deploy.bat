@echo off
echo.
echo ==========================================
echo   Austin ^& Jordyn - Wedding Website
echo   Deployment Script
echo ==========================================
echo.

echo [1/4] Checking build...
if not exist "dist\index.html" (
    echo ERROR: Build not found. Running build...
    call npm run build
    if errorlevel 1 (
        echo BUILD FAILED!
        pause
        exit /b 1
    )
)
echo ✓ Build exists

echo.
echo [2/4] Choose deployment target:
echo.
echo 1. Netlify (Recommended)
echo 2. Vercel
echo 3. Cloudflare Pages
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" goto netlify
if "%choice%"=="2" goto vercel
if "%choice%"=="3" goto cloudflare
goto invalid

:netlify
echo.
echo [3/4] Deploying to Netlify...
netlify deploy --prod --dir=dist
goto done

:vercel
echo.
echo [3/4] Deploying to Vercel...
npx vercel --prod
goto done

:cloudflare
echo.
echo [3/4] Deploying to Cloudflare Pages...
npx wrangler pages publish dist
goto done

:invalid
echo Invalid choice!
pause
exit /b 1

:done
echo.
echo [4/4] Deployment complete!
echo.
echo ==========================================
echo   Check the URL above ^^^
echo ==========================================
echo.
pause
