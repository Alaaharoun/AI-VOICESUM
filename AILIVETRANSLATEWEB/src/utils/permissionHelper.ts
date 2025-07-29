/**
 * Web Permission Helper
 * Handles microphone permissions for web applications
 */

export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  unknown: boolean;
}

export class WebPermissionHelper {
  private static instance: WebPermissionHelper;
  private permissionCache: Map<string, PermissionStatus> = new Map();

  static getInstance(): WebPermissionHelper {
    if (!WebPermissionHelper.instance) {
      WebPermissionHelper.instance = new WebPermissionHelper();
    }
    return WebPermissionHelper.instance;
  }

  /**
   * Check if microphone permission is granted
   */
  async checkMicrophonePermission(): Promise<PermissionStatus> {
    try {
      // Check if permissions API is available
      if (!navigator.permissions) {
        console.warn('Permissions API not available, falling back to getUserMedia');
        return this.checkPermissionViaGetUserMedia();
      }

      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      const status: PermissionStatus = {
        granted: result.state === 'granted',
        denied: result.state === 'denied',
        unknown: result.state === 'prompt'
      };

      // Cache the result
      this.permissionCache.set('microphone', status);

      // Listen for permission changes
      result.addEventListener('change', () => {
        const newStatus: PermissionStatus = {
          granted: result.state === 'granted',
          denied: result.state === 'denied',
          unknown: result.state === 'prompt'
        };
        this.permissionCache.set('microphone', newStatus);
      });

      return status;
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return this.checkPermissionViaGetUserMedia();
    }
  }

  /**
   * Fallback method to check permission via getUserMedia
   */
  private async checkPermissionViaGetUserMedia(): Promise<PermissionStatus> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      const status: PermissionStatus = {
        granted: true,
        denied: false,
        unknown: false
      };
      
      this.permissionCache.set('microphone', status);
      return status;
    } catch (error) {
      console.error('Error checking permission via getUserMedia:', error);
      
      const status: PermissionStatus = {
        granted: false,
        denied: true,
        unknown: false
      };
      
      this.permissionCache.set('microphone', status);
      return status;
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission(): Promise<PermissionStatus> {
    try {
      console.log('🎤 Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Audio track stopped after permission request');
      });
      
      const status: PermissionStatus = {
        granted: true,
        denied: false,
        unknown: false
      };
      
      this.permissionCache.set('microphone', status);
      console.log('✅ Microphone permission granted');
      
      return status;
    } catch (error) {
      console.error('❌ Error requesting microphone permission:', error);
      
      const status: PermissionStatus = {
        granted: false,
        denied: true,
        unknown: false
      };
      
      this.permissionCache.set('microphone', status);
      return status;
    }
  }

  /**
   * Get cached permission status
   */
  getCachedPermissionStatus(): PermissionStatus | null {
    return this.permissionCache.get('microphone') || null;
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Check if permission is already granted (from cache or current state)
   */
  async isPermissionGranted(): Promise<boolean> {
    const cached = this.getCachedPermissionStatus();
    if (cached) {
      return cached.granted;
    }
    
    const status = await this.checkMicrophonePermission();
    return status.granted;
  }

  /**
   * Get permission status as string for UI display
   */
  async getPermissionStatusString(): Promise<'granted' | 'denied' | 'unknown'> {
    const status = await this.checkMicrophonePermission();
    
    if (status.granted) return 'granted';
    if (status.denied) return 'denied';
    return 'unknown';
  }
}

// Export singleton instance
export const permissionHelper = WebPermissionHelper.getInstance(); 