// Dynamic Expo config. Extends app.json and, for the hosted web build only,
// sets `experiments.baseUrl` so assets resolve under the GitHub Pages sub-path
// (e.g. https://<user>.github.io/sho-app-native/). Locally EXPO_WEB_BASE_URL is
// unset, so `npm run web` keeps serving from the root.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    baseUrl: process.env.EXPO_WEB_BASE_URL || '',
  },
})
