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

module.exports = withNativeWind(config, { input: './global.css' })
