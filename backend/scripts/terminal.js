// @ts-check
// Preguntas en la terminal para los scripts (cargar-menu.js, crear-administrador-zenda.js): una
// respuesta normal o una oculta, para contraseñas y cadenas de conexión.
import { createInterface } from 'node:readline/promises';

/**
 * Pregunta algo en la terminal y devuelve la respuesta.
 * @param {string} texto
 */
export async function preguntar(texto) {
  // Una interfaz por pregunta: así, entre preguntas, la terminal queda libre para
  // leer la contraseña sin que readline la muestre.
  const consola = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await consola.question(texto)).trim();
  } finally {
    consola.close();
  }
}

/**
 * Pregunta sin mostrar lo que se escribe (para contraseñas y cadenas de conexión).
 * @param {string} texto
 * @returns {Promise<string>}
 */
export function preguntarOculto(texto) {
  const entrada = process.stdin;
  // Sin terminal (por ejemplo, con la entrada redirigida) no hay nada que ocultar.
  if (!entrada.isTTY) return preguntar(texto);

  // En modo "raw" la terminal no muestra las teclas: se leen una por una y se muestra un *
  // por cada letra, para saber cuántas van.
  process.stdout.write(texto);
  entrada.setRawMode(true);
  entrada.resume();
  return new Promise((resolver) => {
    let valor = '';
    /** @param {Buffer} datos */
    function alEscribir(datos) {
      // Fuera las teclas especiales (flechas, Inicio, Supr) y las marcas que algunas
      // terminales agregan al pegar: no son parte de la contraseña.
      // eslint-disable-next-line no-control-regex -- esas teclas empiezan con el carácter ESC.
      const teclas = datos.toString('utf8').replace(/\x1b\[[0-9;]*[~A-Za-z]|\x1bO./g, '');
      for (const tecla of teclas) {
        if (tecla === '\r' || tecla === '\n') {
          terminar();
          resolver(valor);
          return;
        }
        if (tecla === '\u0003') {
          // Ctrl+C: cancelar sin cargar nada.
          terminar();
          process.exit(130);
        }
        if (tecla === '\u007f' || tecla === '\b') {
          // Borrar la última letra (y su *).
          if (valor) process.stdout.write('\b \b');
          valor = valor.slice(0, -1);
        } else if (tecla >= ' ') {
          valor += tecla;
          process.stdout.write('*');
        }
      }
    }
    function terminar() {
      entrada.off('data', alEscribir);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write('\n');
    }
    entrada.on('data', alEscribir);
  });
}
