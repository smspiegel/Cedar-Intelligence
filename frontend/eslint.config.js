// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      'import/no-unresolved': ['error', { ignore: [
        '^@clerk/expo(?:/.*)?$', '^@clerk/expo-native-components$',
        '^@expo-google-fonts/manrope$', '^liquid-glass-react$',
      ] }],
    },
  },
]);
