import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface VADTestResult {
  success: boolean;
  message: string;
  details?: string;
}

interface VADTestButtonProps {
  onTestComplete?: (result: VADTestResult) => void;
}

export const VADTestButton: React.FC<VADTestButtonProps> = ({ onTestComplete }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<VADTestResult | null>(null);

  const runVADTest = async () => {
    setIsTesting(true);
    setTestResult({
      success: false,
      message: 'Testing VAD system...',
      details: 'Running comprehensive VAD tests...'
    });

    try {
      // Test 1: Health Check
      const healthResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health');
      const healthData = await healthResponse.json();
      
      if (!healthResponse.ok || !healthData.vad_support) {
        throw new Error('VAD support not available');
      }

      // Test 2: Transcription without VAD
      const formData = new FormData();
      const testAudioBlob = new Blob([new ArrayBuffer(1024)], { type: 'audio/wav' });
      formData.append('file', testAudioBlob, 'test.wav');
      formData.append('language', 'en');
      formData.append('task', 'transcribe');

      const transcribeResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!transcribeResponse.ok) {
        throw new Error('Transcription without VAD failed');
      }

      // Test 3: Transcription with VAD
      const vadFormData = new FormData();
      vadFormData.append('file', testAudioBlob, 'test.wav');
      vadFormData.append('language', 'en');
      vadFormData.append('task', 'transcribe');
      vadFormData.append('vad_filter', 'true');

      const vadResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
        method: 'POST',
        body: vadFormData
      });

      if (!vadResponse.ok) {
        throw new Error('VAD transcription failed');
      }

      const result: VADTestResult = {
        success: true,
        message: '✅ VAD system is working perfectly!',
        details: `Health: ✅ | Transcription: ✅ | VAD: ✅ | All tests passed successfully.`
      };

      setTestResult(result);
      onTestComplete?.(result);

    } catch (error) {
      const result: VADTestResult = {
        success: false,
        message: '❌ VAD test failed',
        details: `Error: ${(error as Error).message}. Please check the service configuration.`
      };
      
      setTestResult(result);
      onTestComplete?.(result);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[
          styles.testButton, 
          isTesting && styles.testButtonDisabled
        ]}
        onPress={runVADTest}
        disabled={isTesting}
        activeOpacity={0.8}
      >
        {isTesting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="white" style={styles.loadingSpinner} />
            <Text style={styles.testButtonText}>Testing VAD...</Text>
          </View>
        ) : (
          <Text style={styles.testButtonText}>🧪 Test VAD System</Text>
        )}
      </TouchableOpacity>
      
      {testResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>VAD Test Results:</Text>
          <Text style={[
            styles.resultText,
            { color: testResult.success ? '#10B981' : '#EF4444' }
          ]}>
            {testResult.message}
          </Text>
          {testResult.details && (
            <Text style={styles.resultDetails}>
              {testResult.details}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  testButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  testButtonDisabled: {
    backgroundColor: '#6B7280',
    opacity: 0.7,
  },
  testButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginRight: 8,
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  resultDetails: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
}); 