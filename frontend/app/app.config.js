// Tema de Nuxt UI: cada nombre es una paleta de Tailwind.
// Marca en índigo (moderno y de confianza, elegido por el usuario) con violeta de acento y
// grises fríos (slate) de fondo.
// Usa siempre estos nombres (color="primary", "warning"...) y no las paletas directas,
// así el modo oscuro y un cambio de marca funcionan solos.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo', // marca y acción principal
      secondary: 'violet', // acciones secundarias y acentos
      success: 'green', // listo, cuadrado, pagado
      info: 'sky', // información y avisos en vivo
      warning: 'amber', // en preparación, ocupado, atención
      error: 'rose', // anulado, faltante, errores
      neutral: 'slate', // fondos, bordes y textos
    },
  },
});
