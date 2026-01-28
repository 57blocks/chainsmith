// @ts-check
/* eslint-env node */

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // new feature
        'fix', // bug fix
        'docs', // documentation
        'style', // formatting
        'refactor', // refactoring
        'test', // testing
        'chore', // build/tools
        'perf', // performance optimization
        'ci', // CI/CD
        'build', // build
        'revert', // revert
      ],
    ],
    'subject-max-length': [2, 'always', 100],
    'subject-case': [0], // disable case checking
    'header-max-length': [2, 'always', 100],
  },
};
