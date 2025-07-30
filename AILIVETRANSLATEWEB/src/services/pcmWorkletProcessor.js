// ✅ PCM AudioWorklet Processor for Raw PCM Audio Recording
// Replaces deprecated ScriptProcessorNode for optimal Azure Speech Service compatibility

class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Buffer for accumulating PCM data
    this.pcmBuffer = new Float32Array(0);
    this.targetChunkSize = 16000; // 1 second at 16kHz sample rate
    
    console.log('✅ PCMWorkletProcessor initialized for Raw PCM recording');
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Only process if we have input audio
    if (input && input.length > 0) {
      const inputChannel = input[0]; // Mono channel
      
      if (inputChannel && inputChannel.length > 0) {
        // Accumulate PCM data
        const newBuffer = new Float32Array(this.pcmBuffer.length + inputChannel.length);
        newBuffer.set(this.pcmBuffer);
        newBuffer.set(inputChannel, this.pcmBuffer.length);
        this.pcmBuffer = newBuffer;
        
        // Send chunk when we have enough data (1 second optimal for Azure)
        if (this.pcmBuffer.length >= this.targetChunkSize) {
          const chunkToSend = this.pcmBuffer.slice(0, this.targetChunkSize);
          this.pcmBuffer = this.pcmBuffer.slice(this.targetChunkSize);
          
          // Convert Float32 to Int16 for Azure Speech Service
          const int16Chunk = new Int16Array(chunkToSend.length);
          for (let i = 0; i < chunkToSend.length; i++) {
            const sample = Math.max(-1, Math.min(1, chunkToSend[i]));
            int16Chunk[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          }
          
          // Send to main thread
          this.port.postMessage({
            type: 'pcmData',
            data: int16Chunk.buffer,
            size: int16Chunk.length * 2 // Size in bytes
          });
        }
      }
    }
    
    // Keep the processor alive
    return true;
  }

  static get parameterDescriptors() {
    return [];
  }
}

// Register the processor
registerProcessor('pcm-worklet-processor', PCMWorkletProcessor); 