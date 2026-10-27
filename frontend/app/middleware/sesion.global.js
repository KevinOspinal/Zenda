// @ts-check
// Protege todas las páginas: se ejecuta antes de cada navegación.
// 1. Al abrir la app, recupera la sesión guardada (mientras tanto se ve la pantalla de carga).
// 2. Lleva a cada usuario a donde puede estar según su rol (ver redireccionNecesaria).
//
// Las páginas lo configuran con definePageMeta:
//   { publica: true }        → se ve sin sesión (ingreso y registro).
//   { seccion: 'reportes' }  → solo la ven los roles de esa sección (utils/roles.js).
export default defineNuxtRouteMiddleware(async (destino) => {
  const sesion = useSesionStore();

  // 1. Solo la primera vez: intentar recuperar la sesión guardada en el dispositivo.
  if (sesion.estado === 'nueva') await sesion.restaurar();

  // 2. Decidir si puede entrar o a dónde llevarlo.
  const redireccion = redireccionNecesaria({
    ruta: destino.path,
    publica: destino.meta.publica === true,
    seccion: /** @type {string | undefined} */ (destino.meta.seccion),
    rol: sesion.activa ? sesion.rol : null,
  });
  if (redireccion && redireccion !== destino.path) {
    return navigateTo(redireccion, { replace: true });
  }
});
