const https = require('https');
const WebSocket = require('ws');

class RenderConnectionMonitor {
  constructor() {
    this.isMonitoring = false;
    this.checkInterval = 30000; // 30 seconds
    this.connectionHistory = [];
    this.maxHistoryLength = 100;
  }
  
  async checkHealth() {
    const timestamp = new Date().toISOString();
    const result = {
      timestamp,
      httpHealth: false,
      websocketConnection: false,
      pingPong: false,
      serverStatus: 'unknown',
      responseTime: 0
    };
    
    // HTTP Health Check
    const httpStart = Date.now();
    try {
      const healthResponse = await new Promise((resolve, reject) => {
        const req = https.get('https://ai-voicesum.onrender.com/health', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const healthData = JSON.parse(data);
              result.httpHealth = true;
              result.serverStatus = healthData.status;
              resolve(healthData);
            } catch (e) {
              result.httpHealth = true;
              resolve({ status: 'ok', response: data });
            }
          });
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('HTTP timeout'));
        });
      });
      
      result.responseTime = Date.now() - httpStart;
    } catch (error) {
      console.log(`❌ [${timestamp}] HTTP Health Check failed: ${error.message}`);
    }
    
    // WebSocket Connection Check
    try {
      const wsTest = await new Promise((resolve) => {
        const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ connected: false, pingPong: false });
        }, 10000);
        
        ws.on('open', () => {
          result.websocketConnection = true;
          
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'ping' }));
          }, 1000);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'pong') {
              result.pingPong = true;
              clearTimeout(timeout);
              ws.close();
              resolve({ connected: true, pingPong: true });
            }
          } catch (e) {
            // Ignore non-JSON messages
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ connected: false, pingPong: false, error: error.message });
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          resolve({ connected: true, pingPong: result.pingPong });
        });
      });
      
      if (!wsTest.connected) {
        result.websocketConnection = false;
        result.pingPong = false;
      }
    } catch (error) {
      console.log(`❌ [${timestamp}] WebSocket test failed: ${error.message}`);
    }
    
    return result;
  }
  
  logResult(result) {
    const status = result.httpHealth && result.websocketConnection ? '✅' : '❌';
    const pingStatus = result.pingPong ? '🏓' : '⚠️';
    
    console.log(`${status} [${result.timestamp}] HTTP: ${result.httpHealth ? 'OK' : 'FAIL'}, WS: ${result.websocketConnection ? 'OK' : 'FAIL'}, Ping: ${pingStatus}, Response: ${result.responseTime}ms`);
    
    // Add to history
    this.connectionHistory.push(result);
    if (this.connectionHistory.length > this.maxHistoryLength) {
      this.connectionHistory.shift();
    }
  }
  
  getStatistics() {
    if (this.connectionHistory.length === 0) {
      return { total: 0, success: 0, failure: 0, uptime: 0 };
    }
    
    const total = this.connectionHistory.length;
    const success = this.connectionHistory.filter(r => r.httpHealth && r.websocketConnection).length;
    const failure = total - success;
    const uptime = (success / total * 100).toFixed(2);
    
    return { total, success, failure, uptime };
  }
  
  printStatistics() {
    const stats = this.getStatistics();
    console.log('\n📊 === إحصائيات المراقبة ===');
    console.log(`📈 Total Checks: ${stats.total}`);
    console.log(`✅ Successful: ${stats.success}`);
    console.log(`❌ Failed: ${stats.failure}`);
    console.log(`📊 Uptime: ${stats.uptime}%`);
    
    if (stats.total > 0) {
      const recentResults = this.connectionHistory.slice(-10);
      const recentSuccess = recentResults.filter(r => r.httpHealth && r.websocketConnection).length;
      const recentUptime = (recentSuccess / recentResults.length * 100).toFixed(2);
      console.log(`📈 Recent Uptime (last 10): ${recentUptime}%`);
    }
  }
  
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring is already running');
      return;
    }
    
    this.isMonitoring = true;
    console.log('🚀 بدء مراقبة الاتصال مع Render...');
    console.log(`⏰ فحص كل ${this.checkInterval / 1000} ثانية`);
    console.log('📊 اضغط Ctrl+C لإيقاف المراقبة وعرض الإحصائيات\n');
    
    const checkAndLog = async () => {
      if (!this.isMonitoring) return;
      
      const result = await this.checkHealth();
      this.logResult(result);
      
      if (this.isMonitoring) {
        setTimeout(checkAndLog, this.checkInterval);
      }
    };
    
    // Start first check immediately
    checkAndLog();
  }
  
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('\n🛑 إيقاف مراقبة الاتصال');
    this.printStatistics();
  }
}

// تشغيل المراقبة
if (require.main === module) {
  const monitor = new RenderConnectionMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🔄 إيقاف المراقبة...');
    monitor.stopMonitoring();
    process.exit(0);
  });
  
  // Start monitoring
  monitor.startMonitoring();
}

module.exports = { RenderConnectionMonitor }; 