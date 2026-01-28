const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-plugin-prettier');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Global ignores
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'mochawesome-report/**',
      'foundry/**',
      '*.sol',
      'tests/rpc/*-edsl.test.ts',
      'eslint.config.js',
      'commitlint.config.js',
    ],
  },
  {
    plugins: {
      prettier: prettier,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    files: ['src/**/*.ts'],
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // Quote consistency
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],

      // TypeScript specific rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      // General code quality
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Async/Promise handling (important for blockchain)
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',

      // Security considerations
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Test files configuration - no project dependency
    files: ['tests/**/*.ts', '!tests/rpc/*-edsl.test.ts'],
    plugins: {
      prettier: prettier,
    },
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
      'no-console': 'off', // Allow console in tests
      '@typescript-eslint/no-explicit-any': 'off', // More flexible in tests
      '@typescript-eslint/no-non-null-assertion': 'off', // Tests can be more assertive
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'off', // Allow for test assertions
      'prefer-const': 'error',
      'no-var': 'error',
    },
  }
);
