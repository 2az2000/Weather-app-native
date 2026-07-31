/**
 * Babel configuration.
 *
 * Path aliases are declared in THREE places — tsconfig.json (type checker and
 * editor), here (bundler), and jest.config.js (tests). They must be kept in
 * sync; if they drift, code type-checks but fails to resolve at runtime.
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
          // module-resolver matches these as PREFIXES, so a single entry
          // covers both `@/theme` and `@/theme/tokens/radii`.
          alias: {
            '@/core': './src/core',
            '@/features': './src/features',
            '@/shared': './src/shared',
            '@/theme': './src/theme',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],

      // MUST BE LAST. Reanimated 4 moved the worklet transform into
      // react-native-worklets — `react-native-reanimated/plugin` no longer
      // exists. Any plugin listed after this one silently breaks worklets.
      'react-native-worklets/plugin',
    ],
  };
};
