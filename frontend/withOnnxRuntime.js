const { withMainApplication, withSettingsGradle, withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withOnnxAndroidFix(config) {
  // 1. Force settings.gradle to manually recognize the node_modules location
  config = withSettingsGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("onnxruntime-react-native")) {
      contents += `\ninclude ':onnxruntime-react-native'\nproject(':onnxruntime-react-native').projectDir = new File(rootProject.projectDir, '../node_modules/onnxruntime-react-native/android')\n`;
      config.modResults.contents = contents;
    }
    return config;
  });

  // 2. Add the dependency mapping to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("project(':onnxruntime-react-native')")) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation project(':onnxruntime-react-native')`
      );
      config.modResults.contents = contents;
    }
    return config;
  });

  // 3. Force inject into MainApplication package lists
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (config.modResults.language === 'kt') {
      if (!contents.includes('OnnxruntimePackage')) {
        contents = contents.replace(
          /package .*\n/,
          `$&import ai.onnxruntime.reactnative.OnnxruntimePackage;\n`
        );
        // Fallback target injection for React Native package builders
        contents = contents.replace(
          /val packages: List<ReactPackage> = PackageList\(this\)\.packages\.toMutableList\(\)\.apply\s*\{/,
          `$& \n        add(OnnxruntimePackage())`
        );
        config.modResults.contents = contents;
      }
    }
    return config;
  });
};
