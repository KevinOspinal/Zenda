// Tema de Nuxt UI: cada nombre es una paleta de Tailwind.
// Estilo "fresco y natural": esmeralda como marca y grises cálidos (stone) de fondo.
// Usa siempre estos nombres (color="primary", "warning"...) y no las paletas directas,
// así el modo oscuro y un cambio de marca funcionan solos.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'emerald', // marca y acción principal
      secondary: 'teal', // acciones secundarias y acentos
      success: 'green', // listo, cuadrado, pagado
      info: 'sky', // información y avisos en vivo
      warning: 'amber', // en preparación, ocupado, atención
      error: 'rose', // anulado, faltante, errores
      neutral: 'stone', // fondos, bordes y textos
    },
  },
});
