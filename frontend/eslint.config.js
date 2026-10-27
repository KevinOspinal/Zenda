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
    },
  },
  // Desactiva las reglas de estilo que maneja Prettier (al final, para que gane).
  prettier,
);
