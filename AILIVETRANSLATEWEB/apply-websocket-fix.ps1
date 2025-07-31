# WebSocket Azure Speech SDK Fix Application Script

Write-Host "🔧 Applying WebSocket Azure Speech SDK Fix..." -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Checking required files..." -ForegroundColor Yellow
if (-not (Test-Path "fix-azure-websocket.js")) {
    Write-Host "❌ Error: fix-azure-websocket.js not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path "update-server-with-fix.js")) {
    Write-Host "❌ Error: update-server-with-fix.js not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ All required files found" -ForegroundColor Green
Write-Host ""

Write-Host "🔄 Updating server with fix..." -ForegroundColor Yellow
try {
    node update-server-with-fix.js
    if ($LASTEXITCODE -ne 0) {
        throw "Node script failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Error applying fix: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Fix applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart your server: npm start" -ForegroundColor White
Write-Host "2. Test the connection using enhanced-test-connection.html" -ForegroundColor White
Write-Host "3. Check the logs for any remaining issues" -ForegroundColor White
Write-Host ""
Write-Host "📖 For detailed instructions, see WEBSOCKET_FIX_GUIDE.md" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to continue" 