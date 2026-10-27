// @ts-check
// Configuración de Nuxt: app de una sola página (SPA), módulos, tema y conexión con el API.
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  // Fija el comportamiento de Nuxt y sus módulos al de esta fecha, aunque se actualicen.
  compatibilityDate: '2026-10-27',

  // App con sesión, instalable y offline: no necesita renderizado en el servidor.
  ssr: false,

  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint'],

  // Tailwind, Nuxt UI y los ajustes propios del tema (ver app/assets/css/main.css).
  css: ['~/assets/css/main.css'],

  // Los componentes se usan por su nombre de archivo, sin la carpeta como prefijo:
  // components/mesas/TarjetaMesa.vue es <TarjetaMesa>. Por eso cada nombre debe ser único.
  components: [{ path: '~/components', pathPrefix: false }],

  // El backend acepta peticiones de este origen (CORS_ORIGENES en backend/.env).
  devServer: { port: 3001 },

  runtimeConfig: {
    public: {
      // Dirección del API. En cada ambiente se cambia con la variable NUXT_PUBLIC_API_URL.
      apiUrl: 'http://localhost:3000',
      // Muestra el enlace "Registrar mi negocio". En producción se apaga con
      // NUXT_PUBLIC_REGISTRO_HABILITADO=false (el backend también lo cierra allí).
      registroHabilitado: true,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es-CO' },
      title: 'Zenda',
      meta: [
        { name: 'description', content: 'Administración para restaurantes y cafeterías' },
        // Color de la barra del navegador en el celular: el esmeralda de la marca (700).
        { name: 'theme-color', content: '#047857' },
      ],
    },
  },

  icon: {
    // Los íconos se empaquetan con la app en lugar de pedirse a internet al usarlos:
    // cargan al instante y funcionan sin conexión. Se buscan en todo el código de app/,
    // incluidos los .js (por ejemplo, utils/estados.js define el ícono de cada estado).
    clientBundle: {
      scan: { globInclude: ['app/**/*.{vue,js}'] },
    },
  },

  devtools: { enabled: true },
});
