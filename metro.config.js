const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// إضافة دعم للمكتبات Native
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

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