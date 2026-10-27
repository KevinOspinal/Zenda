// @ts-check
// Conexión en tiempo real (Socket.IO) con el backend. Hay una sola por dispositivo:
// - se conecta cuando hay una sesión activa y se desconecta al salir;
// - siempre usa el token de acceso vigente (auth es una función que lo lee en cada intento);
// - la reconexión y el indicador los maneja manejarConexion (utils/tiempoReal.js).
//
// Las pantallas y stores escuchan eventos con useTiempoReal():
//   useTiempoReal().on(EVENTOS_EN_VIVO.MESA_ESTADO, (datos) => { ... })
import { io } from 'socket.io-client';

export default defineNuxtPlugin(() => {
  const sesion = useSesionStore();
  const conexion = useConexionStore();
  const { apiUrl } = useRuntimeConfig().public;

  const socket = io(apiUrl, {
    autoConnect: false,
    auth: (entregar) => entregar({ token: sesion.tokenAcceso }),
  });
  manejarConexion(socket, { sesion, conexion });

  // Conectar cuando hay sesión; desconectar al salir (no se escuchan eventos sin sesión).
  watch(
    () => sesion.activa,
    (activa) => {
      if (activa) {
        conexion.reconectando = true;
        socket.connect();
      } else {
        socket.disconnect();
      }
    },
    { immediate: true },
  );

  return { provide: { socket } };
});
