# Building Connectly as a Native Mobile App

Connectly uses **Capacitor** to wrap the React app into a native iOS/Android app.

## Prerequisites

- Node.js 18+
- For iOS: macOS + Xcode 14+ + Apple Developer account ($99/yr)
- For Android: Android Studio + Google Play Developer account ($25 one-time)

## Setup (one-time)

```bash
cd frontend

# Install Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/push-notifications @capacitor/splash-screen @capacitor/status-bar

# Build the web app first
npm run build

# Initialize Capacitor (already configured via capacitor.config.ts)
npx cap add ios
npx cap add android
```

## Building & Running

```bash
# After every frontend change:
npm run build
npx cap sync

# Open in Xcode (iOS)
npx cap open ios

# Open in Android Studio
npx cap open android
```

## Deploying to App Store / Play Store

### iOS
1. Open in Xcode: `npx cap open ios`
2. Set your Team in Signing & Capabilities
3. Product → Archive
4. Distribute App → App Store Connect
5. Submit for review in App Store Connect

### Android
1. Open in Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle/APK
3. Upload to Google Play Console → Production

## App Store Assets Needed
- App icon: 1024×1024 PNG (no alpha)
- Screenshots: 6.7" iPhone, 6.5" iPhone, 12.9" iPad
- Description, keywords, privacy policy URL

## App IDs
- iOS Bundle ID: `com.connectly.app`  
- Android Package: `com.connectly.app`

Change these in `capacitor.config.ts` → `appId` to match your Apple/Google developer accounts.
