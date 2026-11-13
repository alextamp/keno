const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase v10 uses package.json exports which Metro's experimental resolver
// handles incorrectly, causing "component not registered" errors.
config.resolver.unstable_enablePackageExports = false;

// posthog-react-native's survey UI imports `@posthog/core/surveys`, a
// subpath export that only resolves with package-exports support on — the
// opposite of the Firebase fix above. Rather than re-enable it globally
// (and bring back the Firebase bug), turn it on just for this one package.
//
// SDK 58 (React Native 0.88, expo, expo-router) moved more entry points
// behind package exports (`react-native/setup-env`, `expo/dom/global`…).
// So every request is resolved the old way first — which is what keeps
// Firebase working — and only if that fails is it retried with package
// exports on.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (moduleName.startsWith('@posthog/core')) {
    return resolve({ ...context, unstable_enablePackageExports: true }, moduleName, platform);
  }
  try {
    return resolve(context, moduleName, platform);
  } catch (err) {
    try {
      return resolve({ ...context, unstable_enablePackageExports: true }, moduleName, platform);
    } catch {
      throw err;
    }
  }
};

// NOTE: Sentry's withSentryConfig() metro wrapper (source map upload) isn't
// wired in here — it broke dev bundling (missing debug ID error) and is only
// needed for symbolicated stack traces on production builds. Revisit when
// setting up the actual production EAS build.
module.exports = config;
