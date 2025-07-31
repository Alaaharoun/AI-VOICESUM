@echo off
echo 🔧 Applying WebSocket Azure Speech SDK Fix...
echo.

echo 📋 Checking required files...
if not exist "fix-azure-websocket.js" (
    echo ❌ Error: fix-azure-websocket.js not found
    pause
    exit /b 1
)

if not exist "update-server-with-fix.js" (
    echo ❌ Error: update-server-with-fix.js not found
    pause
    exit /b 1
)

echo ✅ All required files found
echo.

echo 🔄 Updating server with fix...
node update-server-with-fix.js

if %errorlevel% neq 0 (
    echo ❌ Error applying fix
    pause
    exit /b 1
)

echo.
echo ✅ Fix applied successfully!
echo.
echo 🚀 Next steps:
echo 1. Restart your server: npm start
echo 2. Test the connection using enhanced-test-connection.html
echo 3. Check the logs for any remaining issues
echo.
echo 📖 For detailed instructions, see WEBSOCKET_FIX_GUIDE.md
echo.

pause 