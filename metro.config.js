const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// إضافة دعم للمكتبات Native
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// إضافة alias للمكتبات المفقودة
config.resolver.alias = {
  ...config.resolver.alias,
  path: require.resolve('path-browserify'),
};

// إضافة node_modules إلى مسارات الحل
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths || [],
  require.resolve('path-browserify'),
];

// تحسين الأداء
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// إضافة دعم للملفات الكبيرة
config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];

// تحسين الذاكرة
config.maxWorkers = 2;

module.exports = config; 