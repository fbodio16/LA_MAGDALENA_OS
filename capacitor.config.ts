import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrowater.lamagdalenaos',
  appName: 'LA MAGDALENA OS',
  webDir: 'apps/web',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  },
  server: {
    iosScheme: 'capacitor'
  }
};

export default config;
