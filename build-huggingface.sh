
# Build script for Hugging Face production fix
echo "🚀 Building app with Hugging Face fix..."

# Clear caches
echo "📋 Clearing caches..."
npm run clean || echo "No clean script found"
npx expo start --clear || echo "Expo clear failed"

# Install dependencies
echo "📋 Installing dependencies..."
npm install

# Build the app
echo "📋 Building app..."
npm run build || npx expo build || echo "Build command not found"

# Start development server
echo "📋 Starting development server..."
echo "Run: npx expo start"
echo "Then test on your device!"
