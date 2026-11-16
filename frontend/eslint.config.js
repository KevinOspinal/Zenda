// @ts-check
// Reglas de ESLint para revisar la calidad del código.
//
// La base la genera Nuxt (`nuxt prepare`) en .nuxt/eslint.config.mjs: incluye las reglas
// de Vue y reconoce las funciones que Nuxt importa solo (ref, useToast, defineAppConfig...).
import prettier from 'eslint-config-prettier';
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      // En la app no se escribe en la consola: podría mostrar datos de la sesión o de clientes.
      'no-console': 'warn',
      // Nada de v-html: un texto que venga del API podría inyectar código en la página.
      'vue/no-v-html': 'error',
      // useNow de VueUse 15 cambia en cada cuadro si no recibe un scheduler (ver useAhora).
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='useNow']",
          message: 'Usa useAhora(cadaMs): useNow sin scheduler se actualiza en cada cuadro.',
        },
      ],
    },
  },
  // useAhora es el único lugar donde se llama a useNow, con su scheduler.
  {
    files: ['app/composables/useAhora.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // Desactiva las reglas de estilo que maneja Prettier (al final, para que gane).
  prettier,
);
