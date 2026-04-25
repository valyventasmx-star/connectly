import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.connectly.app',
  appName: 'Connectly',
  webDir: 'dist',
  server: {
    // For development: point to your backend
    // androidScheme: 'https',
    // iosScheme: 'https',
    // hostname: 'your-backend.railway.app',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#6366f1',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#6366f1',
    },
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
};

export default config;
