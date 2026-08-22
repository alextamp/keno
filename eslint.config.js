// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // functions/lib is tsc's compiled output (functions/src -> lib), not
    // source — same reason dist/ is excluded above. .expo is Expo's own
    // generated cache/type dir.
    ignores: ["dist/*", "functions/lib/*", "functions/node_modules/*", ".expo/*"],
  }
]);
