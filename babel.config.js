/**
 * Babel configuration.
 *
 * Path aliases are declared in BOTH tsconfig.json (for the type checker and the
 * editor) and here (for the bundler at runtime). They must be kept in sync — if
 * they drift, code type-checks but fails to resolve at runtime.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@/core': './src/core',
            '@/features': './src/features',
            '@/shared': './src/shared',
            '@/theme': './src/theme',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // react-native-reanimated/plugin must remain LAST once Reanimated is
      // added in Phase 2. Adding plugins after it silently breaks worklets.
    ],
  };
};
