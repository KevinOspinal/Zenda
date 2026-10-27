// @ts-check
// Reglas de ESLint para revisar la calidad del código.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
    },
  },
  {
    // Los scripts de terminal sí deben escribir en la consola.
    files: ['prisma/seed.js'],
    rules: { 'no-console': 'off' },
  },
  // Desactiva las reglas de estilo que maneja Prettier.
  prettier,
];
