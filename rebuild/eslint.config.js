import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Greenfield lint contract (see docs/rebuild/QUALITY_BAR.md).
 *
 * ESLint is pinned to 9 because eslint-plugin-jsx-a11y@6.10.2 caps at ^9
 * (measured in Wave 0 / A2). Revisit when the plugin ships ESLint 10 support.
 * typescript-eslint resolves the project's `typescript` package, which is the
 * TS 6 compatibility build; typechecking itself uses TS 7 (`@typescript/native`).
 */
export default tseslint.config(
  {
    ignores: [
      'supabase/functions/**',
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      // Generated static assets (service worker, manifest, robots, sitemap,
      // icons). They are produced by scripts/generate-sitemap.mjs and guarded by
      // its --check drift gate, not by the app's lint rules.
      'public',
      'package-lock.json',
      // Plain-JS config file; it is not part of the TS project that type-aware
      // linting resolves.
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map(config => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Plain-JS build/maintenance scripts run under Node (console, process).
    files: ['**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier
)
