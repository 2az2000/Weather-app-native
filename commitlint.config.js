/**
 * Commitlint — Conventional Commits (CLAUDE.md §30).
 *
 * Scopes are the features and layers from the architecture, so commit history
 * stays navigable by the same vocabulary as the codebase.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'style',
        'test',
        'docs',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        // Features
        'weather',
        'locations',
        'air-quality',
        'maps',
        'alerts',
        'recommendations',
        'settings',
        // Layers & infrastructure
        'core',
        'shared',
        'theme',
        'i18n',
        'widgets',
        'deps',
        'ci',
        'docs',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 72],
  },
};
