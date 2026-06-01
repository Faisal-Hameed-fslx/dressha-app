# Dressha App

Dressha is a React Native + Expo fashion assistant with a Node/Express backend. It includes outfit design, saved fits, stories, public feed, weather-based suggestions, AI features, Cloudinary uploads, and Android builds.

## Project Structure

- `frontend/` - Expo React Native app
- `backend/` - Express/MongoDB API server

## What the app does

- Outfit designer and outfit preview
- Save outfits and auto-create stories
- Public feed and weekly popular feed
- Weather-based outfit suggestions
- Local weather suggestion notifications
- Story viewer with expiry support
- Profile, settings, and notification preferences
- Cloudinary image upload support
- Optional AI / embedding features in backend

## Requirements

- Expo Version 54
- Node.js 18+ recommended
- npm
- Android Studio + Android SDK for Android builds
- MongoDB connection
- Cloudinary account and API credentials
- Expo account if you build/run with Expo tooling

## Backend Setup

1. Open the backend folder:

```bash
cd backend
```

1. Install dependencies:

```bash
npm install
```

1. Create a `.env` file in `backend/` with your values. Typical variables used by the project include:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
Cloudinary_Name=your_cloud_name
Cloudinary_API_KEY=your_cloudinary_api_key
Cloudinary_API_Secret=your_cloudinary_api_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OPENAI_API_KEY=optional_if_used
WEATHER_API_KEY=optional_openweathermap_key
STORY_WEBHOOK_URL=optional
STORY_WEBHOOK_KEY=optional
PUSH_PROVIDER=expo
```

The frontend Google sign-in screens read the client IDs from the backend config endpoint, so keep those IDs in `backend/.env` and you do not need a separate frontend `.env` for them.

1. Start the backend:

```bash
npm run dev
```

or

```bash
npm start
```

The backend runs on port `3000` by default.

## Frontend Setup

1. Open the frontend folder:

```bash
cd frontend
```

1. Install dependencies:

```bash
npm install
```

The frontend does not require a separate `.env` file in the current setup. It uses `frontend/store/run.js` for the backend URL, so that file controls the API host unless you change it later. Make sure the backend URL is correct there. In run.js change const localHost = 'http://10.244.124.128:3000'; to const localHost = 'http://localhost:3000'; or your backend's actual URL.

1. Start Expo:

```bash
npx expo start
```

1. Run on Android:

```bash
npx expo run:android
```

If you use a dev build or native Android project, make sure Android Studio/SDK is installed.

## Android Build Notes

The Android project is already wired for Google services / Firebase in:

- `frontend/android/build.gradle`
- `frontend/android/app/build.gradle`
- `frontend/android/app/google-services.json`

### What was changed for Firebase / push support

- Added Google services Gradle plugin classpath in `frontend/android/build.gradle`
- Applied `com.google.gms.google-services` in `frontend/android/app/build.gradle`
- Added Firebase messaging dependency via Firebase BoM
- Added `google-services.json` in `frontend/android/app/`

### If you want to use your own package name later

`com.malikawang.dressha` is the example Android application/package ID used by this project. If you want to change it to your own, update these files together:

- `frontend/app.json` -> `expo.android.package`
- `frontend/android/app/build.gradle` -> `namespace` and `defaultConfig.applicationId`
- `frontend/android/app/google-services.json` -> the `package_name` inside the Firebase config must match the new ID
- Firebase Console -> add a new Android app entry with the same package name

After changing the package name, rebuild the Android app so the new Firebase config is picked up.

### If you want Android push notifications to work

You must still ensure:

- `frontend/android/app/google-services.json` matches your Android application ID
- Firebase project has Android app configured correctly
- FCM is enabled in Firebase console
- Expo push token registration is configured with the correct EAS project ID in the app

## onnxruntime-react-native Build Notes

This project uses a custom Expo config plugin for `onnxruntime-react-native`:

- `frontend/plugins/withOnnxruntimeReactNative.js`
- `frontend/app.json` -> `plugins` includes `./plugins/withOnnxruntimeReactNative`
- `frontend/android/app/build.gradle` already includes `implementation project(':onnxruntime-react-native')`

For a shorter checklist, see [docs/onnxruntime.md](docs/onnxruntime.md).

### Setup checklist

If you are setting the project up from scratch, make sure all of these are present:

1. `frontend/app.json` includes the plugin entry:

```json
"plugins": [
  "./plugins/withOnnxruntimeReactNative"
]
```

1. `frontend/android/app/build.gradle` contains the generated dependency line:

```groovy
implementation project(':onnxruntime-react-native')
```

1. Run Expo prebuild when native files are regenerated:

```bash
npx expo prebuild --clean
```

1. Rebuild Android after prebuild:

```bash
npx expo run:android
```

### What the plugin does

- Adds the Android `onnxruntime-react-native` dependency to `android/app/build.gradle`
- Adds the iOS pod entry to `Podfile` during prebuild

### If onnxruntime build fails

Check the following first:

- The plugin file exists at `frontend/plugins/withOnnxruntimeReactNative.js`
- `frontend/app.json` still references the plugin
- `frontend/android/app/build.gradle` is still Groovy, not Kotlin DSL
- You re-ran `npx expo prebuild --clean` after native changes
- You are using the same Android package name as the Firebase config if push notifications are also enabled

### What you need to keep in place

- Keep `frontend/app.json` pointing to `./plugins/withOnnxruntimeReactNative`
- Keep `frontend/android/app/build.gradle` as a Groovy Gradle file
- Do not manually remove the generated `implementation project(':onnxruntime-react-native')` line
- Re-run Expo prebuild if you change native Android/iOS project files

### Android build changes needed for onnxruntime

Usually you do not need to add extra manual Android code beyond the plugin. For a clean build, make sure:

- `frontend/app.json` still contains the onnxruntime plugin entry
- `frontend/android/app/build.gradle` still has the generated onnxruntime dependency line
- `frontend/android/build.gradle` and `frontend/android/app/build.gradle` remain Groovy files
- You rebuild after prebuild or package-name changes

If you ever regenerate Android from scratch, run:

```bash
npx expo prebuild --clean
```

Then rebuild Android again:

```bash
npm run android
```

### If you want to rebuild Android after changes

From the `frontend/` folder:

```bash
npx expo prebuild --clean
```

Then build again:

```bash
npx expo run:android
```

If you already have the Android folder generated and only changed Java/Kotlin/Gradle files, a normal rebuild from Android Studio or `expo run:android` is usually enough.

## Weather Notifications

Weather suggestions are designed to work with the free path by using local notifications and backend-driven suggestion logic.

Current behavior:

- The app stores the last searched/shared location
- Weather suggestions are generated from backend data
- Notification preferences live in the settings screen
- You can enable/disable weather suggestions from Settings

## Local Notifications vs Push Notifications

### Local notifications

- Free
- No Firebase / FCM required for delivery
- Work on the device itself
- Best for the free setup

### Push notifications

- Need Firebase/FCM on Android
- Can deliver while the app is closed
- Require provider credentials and proper Android setup

If you want the free setup only, keep local notifications and skip push registration.

## Useful Scripts

### Frontend

```bash
npm start
npm run android
npm run ios
npm run web
npm run lint
npm run format
```

### Backend

```bash
npm run dev
npm start
```

## Troubleshooting

### `SERVICE_NOT_AVAILABLE` when registering push

This usually means Android push credentials are not fully configured. Check:

- Firebase project setup
- `google-services.json` package name
- Expo project ID / token registration
- App rebuild after changing Firebase config

### Weather suggestions toggle fails

Make sure:

- You are signed in
- Backend is running
- Backend `.env` values are set
- MongoDB is connected

### Images or feed not loading

Check:

- Backend API URL in `frontend/store/run`
- Cloudinary credentials
- MongoDB connection

## Recommended Run Order

1. Start MongoDB
2. Start backend
3. Start frontend
4. Run on Android device/emulator

## Notes

- The app uses Expo, React Native, React Navigation, Zustand, Axios, and Cloudinary.
- The backend uses Express, Mongoose, Agenda, Luxon, Axios, JWT, and optional AI/image features.
- Notification UI was shifted toward a free/local setup where possible.
- `com.malikawang.dressha` is a placeholder example package name and can be replaced before release.

## License

For license see `LICENSE` file provided in the project.
