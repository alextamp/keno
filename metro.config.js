const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase v10 uses package.json exports which Metro's experimental resolver
// handles incorrectly, causing "component not registered" errors.
config.resolver.unstable_enablePackageExports = false;

// NOTE: Sentry's withSentryConfig() metro wrapper (source map upload) isn't
// wired in here — it broke dev bundling (missing debug ID error) and is only
// needed for symbolicated stack traces on production builds. Revisit when
// setting up the actual production EAS build.
module.exports = config;
