import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gjcodess.flip7companion',
  appName: 'Flip7 Companion',
  webDir: 'dist',

  plugins: {
    SystemBars: {
      // LIGHT describes the background: use dark text/icons on our light UI.
      style: 'LIGHT'
    }
  }
};

export default config;
