# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Express INSAM — a React Native (Expo) delivery driver mobile app. Drivers log in, go online to receive orders, manage delivery lifecycle (accept → pickup → start → complete), and track earnings. Pure JavaScript (no TypeScript).

## Build & Run Commands

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS simulator
npm run web        # Run in browser
npx expo prebuild  # Generate native projects (used in CI)
```

No test runner or linter is configured.

## Architecture

### Entry Point & Navigation

`App.js` wraps everything in `AuthProvider` (Context API). `AppNavigator` switches between:
- **Auth stack**: `LoginScreen` (unauthenticated)
- **Main tabs** (authenticated): Dashboard, History, Profile
- **DeliveryDetailScreen**: pushed on top of tabs

### API Layer (`src/services/api.js`)

Axios instance with environment-aware base URL:
- Dev iOS: `http://localhost:8002/api`
- Dev Android: `http://10.0.2.2:8002/api`
- Production: `https://restaurant.iues-insambot.com/api`

Request interceptor injects Bearer token from AsyncStorage. Response interceptor auto-logs out on 401.

### Services

| Service | Purpose |
|---------|---------|
| `authService.js` | Login (driver role only), logout, session persistence via AsyncStorage |
| `deliveryService.js` | CRUD for deliveries, status transitions, driver stats, profile updates |
| `locationService.js` | Continuous GPS tracking (5-sec interval via expo-location), sends updates to API |

### State Management

AuthContext (React Context API) for auth state. Screens use local `useState`. No Redux or external state library.

## CI/CD

Codemagic (`codemagic.yaml`) with four workflows:
- `react-native-android` / `react-native-ios`: Production builds via EAS, deploy to Play Store (internal) / TestFlight
- `react-native-development`: Dev APK on push to `develop`
- `standalone-apk`: Production APK via Gradle

## Key Conventions

- Platform detection uses `__DEV__` and `Platform.OS` for API URL selection
- Auth tokens stored in AsyncStorage under key `token`, user data under `user`
- Login restricted to users with `role === 'livreur'`
- Location permissions: foreground + background, with `FOREGROUND_SERVICE_LOCATION`
- App is portrait-only, light theme, primary color `#FF6B35`
- Bundle ID: `com.chrisdev237.expressinsam`
