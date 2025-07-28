const fs = require('fs');
const path = require('path');

class HuggingFaceDeploymentPreparer {
  constructor() {
    this.baseDir = __dirname;
    this.sourceDir = path.join(this.baseDir, 'faster_whisper_service');
    this.deployDir = path.join(this.baseDir, 'huggingface_deploy');
  }

  async prepareFiles() {
    console.log('🚀 تحضير الملفات للرفع إلى Hugging Face Spaces...');
    
    // إنشاء مجلد النشر
    if (!fs.existsSync(this.deployDir)) {
      fs.mkdirSync(this.deployDir, { recursive: true });
    }

    // نسخ الملفات المطلوبة
    const filesToCopy = [
      'app.py',
      'Dockerfile',
      'requirements.txt',
      'README.md'
    ];

    console.log('\n📁 نسخ الملفات المطلوبة...');
    
    for (const file of filesToCopy) {
      const sourcePath = path.join(this.sourceDir, file);
      const destPath = path.join(this.deployDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`  ✅ ${file}`);
      } else {
        console.log(`  ❌ ${file} - غير موجود`);
      }
    }

    // إنشاء ملف README.md محسن
    await this.createEnhancedReadme();
    
    // إنشاء ملف .gitignore
    await this.createGitignore();
    
    // إنشاء ملف docker-compose.yml للتطوير المحلي
    await this.createDockerCompose();
    
    console.log('\n✅ تم تحضير الملفات بنجاح!');
    console.log(`📁 الملفات في: ${this.deployDir}`);
    
    return true;
  }

  async createEnhancedReadme() {
    const readmeContent = `# Faster Whisper API

High-performance speech-to-text service using Faster Whisper, optimized for Hugging Face Spaces.

## 🚀 Features

- **Fast Transcription**: Using Faster Whisper for high-performance speech-to-text
- **Multiple Languages**: Support for Arabic, English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean
- **Audio Formats**: WAV, MP3, M4A, FLAC, OGG, WEBM
- **CORS Enabled**: Ready for web applications
- **Error Handling**: Comprehensive error handling and validation
- **File Size Limit**: 25MB maximum file size

## 📡 API Endpoints

### Health Check
\`\`\`bash
GET /health
\`\`\`

**Response:**
\`\`\`json
{
  "status": "healthy",
  "model_loaded": true,
  "service": "faster-whisper",
  "auth_required": false,
  "auth_configured": false
}
\`\`\`

### Transcribe Audio
\`\`\`bash
POST /transcribe
\`\`\`

**Parameters:**
- \`file\`: Audio file (required)
- \`language\`: Language code (optional, e.g., "en", "ar", "es")
- \`task\`: "transcribe" or "translate" (default: "transcribe")

**Example:**
\`\`\`bash
curl -X POST https://alaaharoun-faster-whisper-api.hf.space/transcribe \\
  -F "file=@audio.wav" \\
  -F "language=en" \\
  -F "task=transcribe"
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "text": "transcribed text here",
  "language": "en",
  "language_probability": 0.95
}
\`\`\`

### Root Endpoint
\`\`\`bash
GET /
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Faster Whisper Service is running"
}
\`\`\`

## 🛠️ Local Development

### Prerequisites
- Python 3.9+
- FFmpeg
- Docker (optional)

### Installation
\`\`\`bash
# Clone the repository
git clone <repository-url>
cd faster-whisper-api

# Install dependencies
pip install -r requirements.txt

# Run locally
uvicorn app:app --host 0.0.0.0 --port 7860
\`\`\`

### Using Docker
\`\`\`bash
# Build the image
docker build -t faster-whisper-api .

# Run the container
docker run -p 7860:7860 faster-whisper-api
\`\`\`

## 🌐 Hugging Face Spaces

This service is deployed on Hugging Face Spaces at:
\`https://alaaharoun-faster-whisper-api.hf.space\`

### Usage from Web Applications
\`\`\`javascript
// Health check
const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health');
const health = await response.json();

// Transcribe audio
const formData = new FormData();
formData.append('file', audioBlob, 'audio.wav');
formData.append('language', 'en');

const transcribeResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
  method: 'POST',
  body: formData
});
const result = await transcribeResponse.json();
\`\`\`

## 📊 Supported Languages

| Language | Code | Language | Code |
|----------|------|----------|------|
| English | en | Arabic | ar |
| Spanish | es | French | fr |
| German | de | Italian | it |
| Portuguese | pt | Russian | ru |
| Chinese | zh | Japanese | ja |
| Korean | ko | | |

## 🔧 Configuration

### Environment Variables
- \`API_TOKEN\`: API token for authentication (optional)
- \`REQUIRE_AUTH\`: Enable authentication (default: false)

### Model Configuration
- **Model**: Whisper base model
- **Compute Type**: int8 (optimized for speed)
- **Language Detection**: Automatic

## 📈 Performance

- **Processing Speed**: ~2-3x faster than original Whisper
- **Memory Usage**: Optimized for Hugging Face Spaces
- **Concurrent Requests**: Supported
- **File Size Limit**: 25MB

## 🚨 Error Handling

The service includes comprehensive error handling:

- **File Validation**: Checks file format and size
- **Model Loading**: Validates model availability
- **Network Errors**: Proper timeout and retry logic
- **CORS Support**: Ready for cross-origin requests

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for Hugging Face Spaces**
`;

    const readmePath = path.join(this.deployDir, 'README.md');
    fs.writeFileSync(readmePath, readmeContent);
    console.log('  ✅ README.md محسن');
  }

  async createGitignore() {
    const gitignoreContent = `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# Virtual Environment
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Audio files (for testing)
*.wav
*.mp3
*.m4a
*.flac
*.ogg
*.webm

# Temporary files
temp/
tmp/
*.tmp

# Hugging Face
.huggingface/
`;

    const gitignorePath = path.join(this.deployDir, '.gitignore');
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log('  ✅ .gitignore');
  }

  async createDockerCompose() {
    const dockerComposeContent = `version: '3.8'

services:
  faster-whisper-service:
    build: .
    ports:
      - "7860:7860"
    environment:
      - PYTHONUNBUFFERED=1
    volumes:
      # Optional: Mount a directory for audio files
      - ./audio_files:/app/audio_files
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7860/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
`;

    const dockerComposePath = path.join(this.deployDir, 'docker-compose.yml');
    fs.writeFileSync(dockerComposePath, dockerComposeContent);
    console.log('  ✅ docker-compose.yml');
  }

  async createDeploymentScript() {
    const deployScriptContent = `#!/bin/bash

echo "🚀 Deploying to Hugging Face Spaces..."

# Check if files exist
if [ ! -f "app.py" ]; then
    echo "❌ app.py not found!"
    exit 1
fi

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found!"
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo "❌ requirements.txt not found!"
    exit 1
fi

echo "✅ All required files found"

# Test local build (optional)
echo "🔧 Testing local build..."
docker build -t faster-whisper-test .

if [ $? -eq 0 ]; then
    echo "✅ Local build successful"
else
    echo "❌ Local build failed"
    exit 1
fi

echo "📋 Files ready for deployment:"
echo "  - app.py"
echo "  - Dockerfile"
echo "  - requirements.txt"
echo "  - README.md"
echo "  - .gitignore"
echo "  - docker-compose.yml"

echo ""
echo "🚀 Next steps:"
echo "1. Create a new Space on Hugging Face"
echo "2. Choose 'Docker' as SDK"
echo "3. Upload these files or connect to Git repository"
echo "4. Wait for build to complete"
echo "5. Test the endpoints"

echo ""
echo "📊 Test commands:"
echo "curl https://your-space-name.hf.space/health"
echo "curl -X POST https://your-space-name.hf.space/transcribe -F 'file=@test.wav'"
`;

    const deployScriptPath = path.join(this.deployDir, 'deploy.sh');
    fs.writeFileSync(deployScriptPath, deployScriptContent);
    
    // Make it executable
    try {
      fs.chmodSync(deployScriptPath, '755');
    } catch (error) {
      console.log('  ⚠️ Could not make deploy.sh executable');
    }
    
    console.log('  ✅ deploy.sh');
  }

  async runPreparation() {
    console.log('🚀 تحضير الملفات للرفع إلى Hugging Face Spaces...\n');
    
    try {
      await this.prepareFiles();
      await this.createDeploymentScript();
      
      console.log('\n📋 ملخص الملفات المحضرة:');
      const files = fs.readdirSync(this.deployDir);
      files.forEach(file => {
        console.log(`  📄 ${file}`);
      });
      
      console.log('\n🎯 الخطوات التالية:');
      console.log('1. اذهب إلى مجلد النشر:');
      console.log(`   cd ${this.deployDir}`);
      console.log('');
      console.log('2. ارفع الملفات إلى Hugging Face Spaces:');
      console.log('   - اذهب إلى https://huggingface.co/spaces');
      console.log('   - انقر على "Create new Space"');
      console.log('   - اختر "Docker"');
      console.log('   - ارفع الملفات أو اربط بـ Git repository');
      console.log('');
      console.log('3. انتظر اكتمال البناء');
      console.log('');
      console.log('4. اختبر الخدمة:');
      console.log('   curl https://your-space-name.hf.space/health');
      
      return true;
    } catch (error) {
      console.error('❌ خطأ في تحضير الملفات:', error);
      return false;
    }
  }
}

// Run the preparation
async function main() {
  const preparer = new HuggingFaceDeploymentPreparer();
  await preparer.runPreparation();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = HuggingFaceDeploymentPreparer; 