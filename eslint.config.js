const { defineConfig } = require('eslint/config')
const tsParser = require('@typescript-eslint/parser')
const reactHooks = require('eslint-plugin-react-hooks')

module.exports = defineConfig([
  {
    ignores: [
      '.check-out/**',
      '.sweep-out/**',
      '.expo/**',
      'dist/**',
      'node_modules/**',
      // Onboarding is intentionally frozen for this hardening pass.
      'src/screens/Onboarding.tsx',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
])
