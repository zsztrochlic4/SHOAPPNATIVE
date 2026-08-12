const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const config = getDefaultConfig(__dirname)

// functions/src/_shared is the gitignored, regenerated copy of the shared
// coach/safety source that the Cloud Functions BUILD consumes (sync-shared).
// The app never imports it, and on Windows/OneDrive its link entries make
// Metro's file map fail (EINVAL readlink) — exclude the whole functions tree
// from the app bundler.
const functionsDir = path.join(__dirname, 'functions').replace(/[\\/]/g, '[\\\\/]')
config.resolver.blockList = new RegExp(`${functionsDir}[\\\\/].*`)

// `react-native-purchases` (RevenueCat) is native-only and has no web build, but
// Metro still statically resolves the lazy import in src/lib/iap.ts on web and
// fails the bundle. Web uses the Stripe paywall and never calls IAP, so alias the
// package to a harmless stub when bundling for web.
const iapWebStub = path.join(__dirname, 'src', 'lib', 'iap.web-stub.js')
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-purchases') {
    return { type: 'sourceFile', filePath: iapWebStub }
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
