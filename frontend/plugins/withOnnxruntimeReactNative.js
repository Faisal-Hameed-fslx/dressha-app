const configPlugin = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');

const withOnnxruntimeReactNative = (config) => {
  config = configPlugin.withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('Cannot add onnxruntime-react-native dependency: android/app/build.gradle is not groovy');
    }

    gradleConfig.modResults.contents = generateCode.mergeContents({
      src: gradleConfig.modResults.contents,
      newSrc: "    implementation project(':onnxruntime-react-native')",
      tag: 'onnxruntime-react-native',
      anchor: /^dependencies[ \t]*\{$/,
      offset: 1,
      comment: '    // onnxruntime-react-native',
    }).contents;

    return gradleConfig;
  });

  config = configPlugin.withDangerousMod(config, [
    'ios',
    (iosConfig) => {
      const path = require('path');
      const fs = require('fs');
      const podFilePath = path.join(iosConfig.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podFilePath)) {
        return iosConfig;
      }

      const contents = fs.readFileSync(podFilePath, { encoding: 'utf-8' });
      const updatedContents = generateCode.mergeContents({
        src: contents,
        newSrc: "  pod 'onnxruntime-react-native', :path => '../node_modules/onnxruntime-react-native'",
        tag: 'onnxruntime-react-native',
        anchor: /^target.+do$/,
        offset: 1,
        comment: '  # onnxruntime-react-native',
      }).contents;
      fs.writeFileSync(podFilePath, updatedContents);

      return iosConfig;
    },
  ]);

  return config;
};

module.exports = withOnnxruntimeReactNative;
