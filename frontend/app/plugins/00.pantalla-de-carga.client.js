// @ts-check
// Desvanece la pantalla de carga (app/spa-loading-template.html) cuando la app ya está lista.
// Nuxt la quita de golpe al terminar de cargar; para que no lo haga, se le quita el id con el
// que la busca y aquí se desvanece en 200 ms antes de quitarla. Si la app falla al arrancar,
// también se quita, para que el mensaje de error quede a la vista.

/** Lo que dura el desvanecido (el mismo valor de la transición en la plantilla). */
const DESVANECIDO_MS = 200;

export default defineNuxtPlugin((nuxtApp) => {
  const cargador = document.getElementById('__nuxt-loader');
  if (!cargador) return;
  cargador.removeAttribute('id');

  let quitada = false;
  const quitar = () => {
    if (quitada) return;
    quitada = true;
    cargador.querySelector('.zenda-carga')?.classList.add('zenda-carga--saliendo');
    setTimeout(() => cargador.remove(), DESVANECIDO_MS + 50);
  };

  nuxtApp.hook('app:suspense:resolve', quitar);
  nuxtApp.hook('app:error', quitar);
});
