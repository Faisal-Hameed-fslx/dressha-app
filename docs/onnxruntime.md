# onnxruntime-react-native Setup

This project uses `onnxruntime-react-native` through a custom Expo config plugin.

## Files that must stay in place

- `frontend/app.json`
- `frontend/plugins/withOnnxruntimeReactNative.js`
- `frontend/android/app/build.gradle`

## What the plugin does

- Adds the Android `onnxruntime-react-native` dependency to `frontend/android/app/build.gradle`
- Adds the iOS pod entry to `Podfile` during Expo prebuild

## Android setup checklist

1. Keep this plugin entry in `frontend/app.json`:

```json
"plugins": [
  "./plugins/withOnnxruntimeReactNative"
]
```

1. Keep the generated dependency line in `frontend/android/app/build.gradle`:

```groovy
implementation project(':onnxruntime-react-native')
```

1. If you regenerate native projects, run:

```bash
npx expo prebuild --clean
```

1. Rebuild Android after prebuild:

```bash
npx expo run:android
```

## If the build fails

Check these first:

- The plugin file exists at `frontend/plugins/withOnnxruntimeReactNative.js`
- `frontend/app.json` still points to `./plugins/withOnnxruntimeReactNative`
- `frontend/android/app/build.gradle` is still Groovy, not Kotlin DSL
- You re-ran Expo prebuild after changing native files

## Notes

- Do not manually remove the generated `implementation project(':onnxruntime-react-native')` line.
- Rebuild the app after native changes so Gradle and Expo pick up the plugin output.
