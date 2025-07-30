const fs = require('fs');
const { execSync } = require('child_process');

// Test audio file path
const audioFilePath = './AILIVETRANSLATEWEB/audiotest/Recording (2).wav';

async function analyzeAudioFile() {
  try {
    console.log('🔍 Analyzing audio file:', audioFilePath);
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      console.error('❌ Audio file not found:', audioFilePath);
      return;
    }
    
    // Get file stats
    const stats = fs.statSync(audioFilePath);
    console.log('📁 File stats:', {
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2) + ' KB',
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
      created: stats.birthtime,
      modified: stats.mtime
    });
    
    // Read first 44 bytes (WAV header)
    const header = fs.readFileSync(audioFilePath, { start: 0, end: 43 });
    console.log('📋 WAV Header (first 44 bytes):', header.toString('hex'));
    
    // Parse WAV header
    const riff = header.toString('ascii', 0, 4);
    const fileSize = header.readUInt32LE(4);
    const wave = header.toString('ascii', 8, 12);
    const fmt = header.toString('ascii', 12, 16);
    const fmtSize = header.readUInt32LE(16);
    const audioFormat = header.readUInt16LE(20);
    const channels = header.readUInt16LE(22);
    const sampleRate = header.readUInt32LE(24);
    const byteRate = header.readUInt32LE(28);
    const blockAlign = header.readUInt16LE(32);
    const bitsPerSample = header.readUInt16LE(34);
    
    console.log('🎵 WAV Header Analysis:');
    console.log('  - RIFF:', riff);
    console.log('  - File Size:', fileSize, 'bytes');
    console.log('  - WAVE:', wave);
    console.log('  - FMT:', fmt);
    console.log('  - Format Size:', fmtSize);
    console.log('  - Audio Format:', audioFormat, '(1 = PCM)');
    console.log('  - Channels:', channels);
    console.log('  - Sample Rate:', sampleRate, 'Hz');
    console.log('  - Byte Rate:', byteRate, 'bytes/sec');
    console.log('  - Block Align:', blockAlign);
    console.log('  - Bits Per Sample:', bitsPerSample);
    
    // Calculate duration
    const dataSize = fileSize - 36; // Total size - header size
    const duration = dataSize / byteRate;
    console.log('⏱️ Calculated Duration:', duration.toFixed(2), 'seconds');
    
    // Read a sample of audio data for analysis
    const sampleSize = Math.min(10000, stats.size - 44); // Read up to 10KB of audio data
    const audioData = fs.readFileSync(audioFilePath, { start: 44, end: 44 + sampleSize - 1 });
    
    console.log('📊 Audio Data Sample Analysis:');
    console.log('  - Sample Size:', audioData.length, 'bytes');
    
    // Analyze PCM data (assuming 16-bit)
    if (bitsPerSample === 16) {
      const samples = new Int16Array(audioData.buffer);
      let sum = 0;
      let maxAmplitude = 0;
      let zeroCrossings = 0;
      
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        sum += sample * sample;
        maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        
        if (i > 0 && ((samples[i] >= 0 && samples[i-1] < 0) || (samples[i] < 0 && samples[i-1] >= 0))) {
          zeroCrossings++;
        }
      }
      
      const rms = Math.sqrt(sum / samples.length);
      const averageAmplitude = rms;
      const dynamicRange = maxAmplitude;
      const zeroCrossingRate = zeroCrossings / samples.length;
      
      console.log('🔍 Audio Quality Analysis (Sample):');
      console.log('  - Average Amplitude:', averageAmplitude.toFixed(2));
      console.log('  - Dynamic Range:', dynamicRange);
      console.log('  - Zero Crossing Rate:', (zeroCrossingRate * 100).toFixed(2) + '%');
      console.log('  - Sample Count:', samples.length);
    }
    
    // Try to use ffprobe if available
    try {
      console.log('🔧 Using ffprobe for detailed analysis...');
      const ffprobeOutput = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${audioFilePath}"`, { encoding: 'utf8' });
      const ffprobeData = JSON.parse(ffprobeOutput);
      
      console.log('📋 FFprobe Analysis:');
      console.log('  - Format:', ffprobeData.format.format_name);
      console.log('  - Duration:', ffprobeData.format.duration, 'seconds');
      console.log('  - Bit Rate:', ffprobeData.format.bit_rate, 'bps');
      console.log('  - Size:', ffprobeData.format.size, 'bytes');
      
      if (ffprobeData.streams && ffprobeData.streams[0]) {
        const stream = ffprobeData.streams[0];
        console.log('  - Codec:', stream.codec_name);
        console.log('  - Sample Rate:', stream.sample_rate, 'Hz');
        console.log('  - Channels:', stream.channels);
        console.log('  - Bits Per Sample:', stream.bits_per_sample);
      }
    } catch (ffprobeError) {
      console.log('⚠️ FFprobe not available, using basic analysis');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing audio file:', error);
  }
}

// Run the analysis
analyzeAudioFile(); 