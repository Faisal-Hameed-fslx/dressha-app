const path = require('path');
const projectRoot = process.cwd();

module.exports = {
  dependencies: {
    'onnxruntime-react-native': {
      root: path.resolve(projectRoot, 'node_modules/onnxruntime-react-native'),
      platforms: {
        android: {
          sourceDir: path.resolve(projectRoot, 'node_modules/onnxruntime-react-native/android'),
          packageImportPath: 'import ai.onnxruntime.reactnative.OnnxruntimePackage;',
          packageInstance: 'new OnnxruntimePackage()',
        },
      },
    },
  },
};
