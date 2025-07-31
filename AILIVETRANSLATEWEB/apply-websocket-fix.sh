#!/bin/bash

echo "🔧 Applying WebSocket Azure Speech SDK Fix..."
echo

echo "📋 Checking required files..."
if [ ! -f "fix-azure-websocket.js" ]; then
    echo "❌ Error: fix-azure-websocket.js not found"
    exit 1
fi

if [ ! -f "update-server-with-fix.js" ]; then
    echo "❌ Error: update-server-with-fix.js not found"
    exit 1
fi

echo "✅ All required files found"
echo

echo "🔄 Updating server with fix..."
node update-server-with-fix.js

if [ $? -ne 0 ]; then
    echo "❌ Error applying fix"
    exit 1
fi

echo
echo "✅ Fix applied successfully!"
echo
echo "🚀 Next steps:"
echo "1. Restart your server: npm start"
echo "2. Test the connection using enhanced-test-connection.html"
echo "3. Check the logs for any remaining issues"
echo
echo "📖 For detailed instructions, see WEBSOCKET_FIX_GUIDE.md"
echo 