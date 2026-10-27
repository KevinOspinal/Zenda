// @ts-check
// Estado de la conexión del dispositivo: con o sin red, y si el tiempo real está conectado.
// Alimenta el indicador de la barra superior (En vivo, Reconectando o Sin conexión).
export const useConexionStore = defineStore('conexion', () => {
  /** El navegador tiene red. */
  const enLinea = useOnline();
  /** El tiempo real (Socket.IO) está conectado y recibiendo eventos. */
  const socketConectado = ref(false);
  /** Se está conectando o reintentando la conexión del tiempo real. */
  const reconectando = ref(false);

  const estado = computed(() =>
    estadoDeConexion({
      enLinea: enLinea.value,
      socketConectado: socketConectado.value,
      reconectando: reconectando.value,
    }),
  );

  return { enLinea, socketConectado, reconectando, estado };
});
