// @ts-check
// Carga el menú de La Industria en un negocio a través del API, con la cuenta del dueño o de
// un administrador. Sirve para dejar listo el menú de un negocio nuevo (por ejemplo, el piloto)
// sin escribirlo producto por producto. Pasa por las mismas validaciones que la app.
//
// Uso, desde la carpeta backend:
//   node scripts/cargar-menu.js https://URL-DEL-API
//
// - Pide el NIT, el correo y la contraseña (la contraseña no se muestra al escribirla).
// - Antes de crear algo, muestra el negocio y lo que va a cargar, y pide confirmación.
// - Se puede repetir: una categoría con el mismo nombre, o un producto con el mismo nombre en
//   su categoría, no se vuelve a crear.
// - El impuesto de cada producto sale del régimen del negocio (ver src/config/impuestos.js).
// - Las bebidas se crean sin controlar inventario: el negocio lo activa desde Menú cuando
//   registre sus cantidades reales.
import { createInterface } from 'node:readline/promises';
import { menuLaIndustria as menu } from '../prisma/datos/menuLaIndustria.js';
import { IMPUESTO_POR_REGIMEN } from '../src/config/impuestos.js';

const urlApi = (process.argv[2] ?? '').replace(/\/+$/, '');

/**
 * Llama al API y devuelve su respuesta. Si responde con error, lanza el mensaje del API.
 * @param {string} ruta
 * @param {{ metodo?: string, token?: string, cuerpo?: unknown }} [opciones]
 * @returns {Promise<any>}
 */
async function llamar(ruta, { metodo = 'GET', token, cuerpo } = {}) {
  const respuesta = await fetch(`${urlApi}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }).catch(() => {
    throw new Error(`no hay conexión con ${urlApi}. Revisa la URL y tu internet`);
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(datos?.error?.message ?? `El API respondió ${respuesta.status}`);
  }
  return datos;
}

/**
 * Pregunta algo en la terminal y devuelve la respuesta.
 * @param {string} texto
 */
async function preguntar(texto) {
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
 * Pregunta sin mostrar lo que se escribe (para la contraseña).
 * @param {string} texto
 * @returns {Promise<string>}
 */
function preguntarOculto(texto) {
  const entrada = process.stdin;
  // Sin terminal (por ejemplo, con la entrada redirigida) no hay nada que ocultar.
  if (!entrada.isTTY) return preguntar(texto);

  // En modo "raw" la terminal no muestra las teclas: se leen una por una.
  process.stdout.write(texto);
  entrada.setRawMode(true);
  entrada.resume();
  return new Promise((resolver) => {
    let valor = '';
    /** @param {Buffer} datos */
    function alEscribir(datos) {
      for (const tecla of datos.toString('utf8')) {
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
        // Borrar la última letra o agregar la nueva.
        valor = tecla === '\u007f' || tecla === '\b' ? valor.slice(0, -1) : valor + tecla;
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

/**
 * Compara nombres sin importar mayúsculas, tildes ni espacios de más.
 * @param {string} nombre
 */
function normalizar(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function cargarMenu() {
  if (!/^https?:\/\/.+/.test(urlApi)) {
    throw new Error(
      'Indica la URL del API. Ejemplo: node scripts/cargar-menu.js https://zenda.seenode.app',
    );
  }
  console.log(`Cargar el menú de La Industria en ${urlApi}\n`);

  // 1. Iniciar sesión con la cuenta del dueño o de un administrador.
  const nit = await preguntar('NIT del negocio (solo números): ');
  const email = await preguntar('Correo: ');
  const password = await preguntarOculto('Contraseña: ');
  const { tokenAcceso: token } = await llamar('/auth/login', {
    metodo: 'POST',
    cuerpo: { nit, email, password },
  });

  // 2. Mostrar en qué negocio se va a cargar y pedir confirmación.
  const { negocio, usuario } = await llamar('/auth/yo', { token });
  const tipoImpuesto = IMPUESTO_POR_REGIMEN[negocio.regimenImpuesto] ?? 'exento';
  const totalProductos = menu.reduce((suma, categoria) => suma + categoria.productos.length, 0);
  console.log(
    `\nNegocio: ${negocio.nombre} (NIT ${negocio.nit}). Entraste como ${usuario.nombre}.`,
  );
  console.log(
    `Se cargarán ${menu.length} categorías y ${totalProductos} productos, con impuesto "${tipoImpuesto}".`,
  );
  if ((await preguntar('¿Continuar? (s/n): ')).toLowerCase() !== 's') {
    console.log('No se cargó nada.');
    return;
  }

  // 3. Lo que ya existe, para no duplicarlo si el script se repite.
  /** @type {{ id: string, nombre: string }[]} */
  const categorias = await llamar('/categorias', { token });
  /** @type {{ categoriaId: string, nombre: string }[]} */
  const productos = await llamar('/productos', { token });

  // 4. Crear las categorías (en el orden de la carta) y sus productos.
  let creados = 0;
  let omitidos = 0;
  for (const [orden, categoria] of menu.entries()) {
    let enElApi = categorias.find((c) => normalizar(c.nombre) === normalizar(categoria.nombre));
    if (!enElApi) {
      enElApi = await llamar('/categorias', {
        metodo: 'POST',
        token,
        cuerpo: { nombre: categoria.nombre, orden },
      });
    }
    const categoriaId = /** @type {{ id: string }} */ (enElApi).id;
    console.log(`\n${categoria.nombre}`);

    for (const producto of categoria.productos) {
      const yaExiste = productos.some(
        (p) =>
          p.categoriaId === categoriaId && normalizar(p.nombre) === normalizar(producto.nombre),
      );
      if (yaExiste) {
        omitidos += 1;
        console.log(`  · ${producto.nombre} (ya existía)`);
        continue;
      }
      await llamar('/productos', {
        metodo: 'POST',
        token,
        cuerpo: {
          categoriaId,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio,
          tipoImpuesto,
        },
      });
      creados += 1;
      console.log(`  ✓ ${producto.nombre}`);
    }
  }

  console.log(`\nListo: ${creados} productos creados y ${omitidos} que ya existían.`);
}

try {
  await cargarMenu();
} catch (error) {
  console.error(`\nNo se pudo cargar el menú: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
