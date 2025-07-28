// Detailed diagnostic script for production Hugging Face issue
// This will help identify the exact cause of "undefined is not a function"

const fs = require('fs');
const path = require('path');

class ProductionDiagnostic {
  constructor() {
    this.issues = [];
    this.solutions = [];
  }

  addIssue(issue, solution) {
    this.issues.push(issue);
    this.solutions.push(solution);
  }

  async runFullDiagnostic() {
    console.log('🔍 Running Full Production Diagnostic...\n');
    
    await this.checkFileStructure();
    await this.checkMethodDefinitions();
    await this.checkImports();
    await this.checkBuildConfiguration();
    await this.checkEnvironmentVariables();
    await this.checkDependencies();
    
    this.printReport();
  }

  async checkFileStructure() {
    console.log('📋 1. Checking File Structure...');
    
    const requiredFiles = [
      'services/speechService.ts',
      'services/transcriptionEngineService.ts',
      'services/audioProcessor.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file} exists`);
      } else {
        console.log(`  ❌ ${file} missing`);
        this.addIssue(
          `Missing file: ${file}`,
          `Create the missing file or check if it was moved/deleted`
        );
      }
    }
  }

  async checkMethodDefinitions() {
    console.log('\n📋 2. Checking Method Definitions...');
    
    const speechServicePath = path.join(__dirname, 'services', 'speechService.ts');
    if (!fs.existsSync(speechServicePath)) {
      console.log('  ❌ SpeechService file not found');
      return;
    }
    
    const content = fs.readFileSync(speechServicePath, 'utf8');
    
    // Check for method definitions
    const methods = [
      'transcribeWithHuggingFace',
      'transcribeWithAssemblyAI',
      'transcribeAudio'
    ];
    
    for (const method of methods) {
      if (content.includes(method)) {
        console.log(`  ✅ ${method} method found`);
      } else {
        console.log(`  ❌ ${method} method missing`);
        this.addIssue(
          `Missing method: ${method}`,
          `Add the ${method} method to SpeechService class`
        );
      }
    }
    
    // Check for proper method calls
    if (content.includes('this.transcribeWithHuggingFace')) {
      console.log('  ✅ transcribeWithHuggingFace is properly called');
    } else {
      console.log('  ❌ transcribeWithHuggingFace not properly called');
      this.addIssue(
        'transcribeWithHuggingFace not properly called',
        'Ensure the method is called with this.transcribeWithHuggingFace'
      );
    }
  }

  async checkImports() {
    console.log('\n📋 3. Checking Imports...');
    
    const speechServicePath = path.join(__dirname, 'services', 'speechService.ts');
    if (!fs.existsSync(speechServicePath)) {
      console.log('  ❌ SpeechService file not found');
      return;
    }
    
    const content = fs.readFileSync(speechServicePath, 'utf8');
    
    // Check for required imports
    const imports = [
      'import { AudioProcessor }',
      'import { transcriptionEngineService',
      'export class SpeechService'
    ];
    
    for (const importStatement of imports) {
      if (content.includes(importStatement)) {
        console.log(`  ✅ ${importStatement} found`);
      } else {
        console.log(`  ❌ ${importStatement} missing`);
        this.addIssue(
          `Missing import: ${importStatement}`,
          `Add the missing import statement`
        );
      }
    }
  }

  async checkBuildConfiguration() {
    console.log('\n📋 4. Checking Build Configuration...');
    
    const configFiles = [
      'app.config.js',
      'package.json',
      'tsconfig.json',
      'metro.config.js'
    ];
    
    for (const file of configFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file} exists`);
        
        // Check specific configurations
        if (file === 'package.json') {
          const content = fs.readFileSync(filePath, 'utf8');
          const packageJson = JSON.parse(content);
          
          if (packageJson.dependencies && packageJson.dependencies['@supabase/supabase-js']) {
            console.log('    ✅ Supabase dependency found');
          } else {
            console.log('    ❌ Supabase dependency missing');
            this.addIssue(
              'Missing Supabase dependency',
              'Run: npm install @supabase/supabase-js'
            );
          }
        }
      } else {
        console.log(`  ❌ ${file} missing`);
      }
    }
  }

  async checkEnvironmentVariables() {
    console.log('\n📋 5. Checking Environment Variables...');
    
    const envFiles = [
      '.env',
      '.env.local',
      '.env.production'
    ];
    
    for (const envFile of envFiles) {
      const filePath = path.join(__dirname, envFile);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${envFile} exists`);
        
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('SUPABASE_URL') && content.includes('SUPABASE_ANON_KEY')) {
          console.log('    ✅ Supabase environment variables found');
        } else {
          console.log('    ❌ Supabase environment variables missing');
          this.addIssue(
            'Missing Supabase environment variables',
            'Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file'
          );
        }
      } else {
        console.log(`  ⚠️ ${envFile} not found (this might be normal)`);
      }
    }
  }

  async checkDependencies() {
    console.log('\n📋 6. Checking Dependencies...');
    
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log('  ❌ package.json not found');
      return;
    }
    
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    
    const requiredDeps = [
      '@supabase/supabase-js',
      'react-native',
      'expo'
    ];
    
    for (const dep of requiredDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        console.log(`  ✅ ${dep} dependency found`);
      } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        console.log(`  ✅ ${dep} dev dependency found`);
      } else {
        console.log(`  ❌ ${dep} dependency missing`);
        this.addIssue(
          `Missing dependency: ${dep}`,
          `Install the missing dependency: npm install ${dep}`
        );
      }
    }
  }

  printReport() {
    console.log('\n📊 Diagnostic Report:');
    console.log('====================');
    
    if (this.issues.length === 0) {
      console.log('✅ No issues found! The problem might be:');
      console.log('   - Build cache issue (try: npm run clean && npm run build)');
      console.log('   - Metro bundler cache (try: npx expo start --clear)');
      console.log('   - Device cache (try: uninstall and reinstall app)');
      console.log('   - Network connectivity issue');
    } else {
      console.log(`❌ Found ${this.issues.length} issue(s):`);
      
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. Issue: ${issue}`);
        console.log(`   Solution: ${this.solutions[index]}`);
      });
    }
    
    console.log('\n🔧 Recommended Actions:');
    console.log('======================');
    console.log('1. Clear build cache: npm run clean');
    console.log('2. Clear Metro cache: npx expo start --clear');
    console.log('3. Rebuild the app: npm run build');
    console.log('4. Test on device: npm run start');
    console.log('5. Check console logs for detailed error messages');
  }
}

// Create a simple test to verify the fix
function createSimpleTest() {
  console.log('\n📋 Creating Simple Test...');
  
  const testContent = `
// Simple test to verify Hugging Face functionality
console.log('🧪 Testing Hugging Face setup...');

// Test 1: Check if SpeechService exists
try {
  const { SpeechService } = require('./services/speechService');
  console.log('✅ SpeechService imported successfully');
  
  // Test 2: Check if methods exist
  if (typeof SpeechService.transcribeAudio === 'function') {
    console.log('✅ transcribeAudio method exists');
  } else {
    console.log('❌ transcribeAudio method missing');
  }
  
  // Test 3: Check if transcribeWithHuggingFace exists (private method)
  console.log('ℹ️ transcribeWithHuggingFace is a private method (not directly accessible)');
  
} catch (error) {
  console.error('❌ Import error:', error.message);
}

// Test 4: Check transcriptionEngineService
try {
  const { transcriptionEngineService } = require('./services/transcriptionEngineService');
  console.log('✅ transcriptionEngineService imported successfully');
  
  if (typeof transcriptionEngineService.getCurrentEngine === 'function') {
    console.log('✅ getCurrentEngine method exists');
  } else {
    console.log('❌ getCurrentEngine method missing');
  }
  
} catch (error) {
  console.error('❌ Import error:', error.message);
}

console.log('\\n🎯 Test completed!');
`;

  const testPath = path.join(__dirname, 'simple-test.js');
  fs.writeFileSync(testPath, testContent, 'utf8');
  console.log('✅ Simple test created: simple-test.js');
}

// Run diagnostic
async function runDiagnostic() {
  const diagnostic = new ProductionDiagnostic();
  await diagnostic.runFullDiagnostic();
  createSimpleTest();
}

if (require.main === module) {
  runDiagnostic().catch(console.error);
}

module.exports = {
  ProductionDiagnostic,
  runDiagnostic
}; 