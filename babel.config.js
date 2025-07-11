module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // دعم React Native Reanimated
      'react-native-reanimated/plugin',
      // دعم Expo Router
      'expo-router/babel',
      // تحسين الأداء
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  };
}; 