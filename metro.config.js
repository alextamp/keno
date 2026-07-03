const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase v10 uses package.json exports which Metro's experimental resolver
// handles incorrectly, causing "component not registered" errors.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
