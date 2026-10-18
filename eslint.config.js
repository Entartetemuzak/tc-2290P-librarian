import js from '@eslint/js';
import globals from 'globals';
import { configs, plugins } from 'eslint-config-airbnb-extended';

const javascriptConfig = [
  { name: 'js/config', ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
];

const reactConfig = [
  plugins.react,
  plugins.reactHooks,
  plugins.reactA11y,
  ...configs.react.recommended,
];

const typescriptConfig = [
  plugins.typescriptEslint,
  ...configs.base.typescript,
  ...configs.react.typescript,
];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  ...javascriptConfig,
  ...reactConfig,
  ...typescriptConfig,
  {
    name: 'project/browser-globals',
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    name: 'project/react-19',
    rules: {
      // React 19 with the automatic JSX runtime does not need React in scope.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  {
    name: 'project/config-files',
    files: ['vite.config.ts', 'eslint.config.js'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  {
    name: 'project/tests',
    files: ['src/**/*.test.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
];
