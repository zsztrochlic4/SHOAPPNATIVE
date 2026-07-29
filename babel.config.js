module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin powers react-native-reanimated 4 and MUST be
    // the last plugin in the list.
    plugins: ['react-native-worklets/plugin'],
  }
}
