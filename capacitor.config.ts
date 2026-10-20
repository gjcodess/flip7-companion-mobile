import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gjcodess.flip7companion',
  appName: 'Flip7 Companion',
  webDir: 'dist',
  server: {
    url: 'http://10.0.2.2:5173',
    cleartext: true
  },
  plugins: {
    SystemBars: {
      // LIGHT describes the background: use dark text/icons on our light UI.
      style: 'LIGHT'
    }
  }
};

export default config;
