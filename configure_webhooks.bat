@echo off
REM Automated GitHub Webhook Configuration Script
REM This opens your browser to the webhook configuration pages with pre-filled values

setlocal enabledelayedexpansion

echo ========================================================
echo GitHub Webhook Configuration Helper
echo ========================================================
echo.
echo This script will open GitHub pages to configure webhooks
echo automatically for your repositories.
echo.
echo Webhook URL to use:
echo   https://ai-code-reviewer.loca.lt/webhook
echo.
echo ========================================================

REM Configuration
set "WEBHOOK_URL=https://ai-code-reviewer.loca.lt/webhook"
set "REPO1_URL=https://github.com/KANISHKA1503/test_reviewer/settings/hooks/new"
set "REPO2_URL=https://github.com/KANISHKA1503/Ai_reviewer/settings/hooks/new"

echo.
echo STEP 1: Configuring test_reviewer repository...
echo.
start "" "%REPO1_URL%"

echo Please fill in the webhook form with:
echo   - Payload URL: %WEBHOOK_URL%
echo   - Content type: application/json
echo   - Events: Pull requests, Push
echo   - Active: Yes
echo   - Click "Add webhook"
echo.
echo Press ENTER when you've completed the first webhook...
pause

echo.
echo STEP 2: Configuring Ai_reviewer repository...
echo.
start "" "%REPO2_URL%"

echo Please fill in the webhook form with:
echo   - Payload URL: %WEBHOOK_URL%
echo   - Content type: application/json
echo   - Events: Pull requests, Push
echo   - Active: Yes
echo   - Click "Add webhook"
echo.
echo Press ENTER when you've completed the second webhook...
pause

echo.
echo ========================================================
echo ✓ Webhook configuration complete!
echo ========================================================
echo.
echo Your agentic AI code reviewer will now automatically
echo detect changes when you:
echo   1. Push code to GitHub
echo   2. Create or update pull requests
echo.
echo Changes will appear in the dashboard automatically!
echo.
pause
