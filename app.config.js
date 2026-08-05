// Dynamic Expo config. Extends app.json and, for the hosted web build only,
// sets `experiments.baseUrl` so assets resolve under the GitHub Pages sub-path
// (e.g. https://<user>.github.io/sho-app-native/). Locally EXPO_WEB_BASE_URL is
// unset, so `npm run web` keeps serving from the root.

// NATIVE App Check (owner-activated, Step 5): once `@react-native-firebase/app` and
// `@react-native-firebase/app-check` are installed, Expo can resolve their config plugins, so we
// append them and turn on the iOS App Attest capability. Until then this resolves to a no-op, so
// the current JS-SDK-only managed build is byte-for-byte unchanged. See docs/APP_CHECK.md §Native
// and src/lib/appCheckNative.ts. UNTESTED — verify on a real dev/EAS build.
function nativeAppCheck() {
  try {
    require.resolve('@react-native-firebase/app-check/package.json')
    require.resolve('@react-native-firebase/app/package.json')
  } catch {
    return { plugins: [], ios: undefined } // packages not installed yet → no-op
  }
  return {
    plugins: ['@react-native-firebase/app', '@react-native-firebase/app-check'],
    ios: {
      // App Attest capability. Use 'development' for dev builds / the debug provider, 'production'
      // for TestFlight/App Store release builds.
      entitlements: {
        'com.apple.developer.devicecheck.appattest-environment':
          process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : 'development',
      },
    },
  }
}

module.exports = ({ config }) => {
  const nac = nativeAppCheck()
  return {
    ...config,
    experiments: {
      ...(config.experiments || {}),
      baseUrl: process.env.EXPO_WEB_BASE_URL || '',
    },
    plugins: [...(config.plugins || []), ...nac.plugins],
    ios: nac.ios
      ? {
          ...(config.ios || {}),
          entitlements: { ...((config.ios || {}).entitlements || {}), ...nac.ios.entitlements },
        }
      : config.ios,
  }
}
