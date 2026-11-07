// @ts-check
// Carga un menú (sus categorías, productos y grupos de opciones) en un negocio a través del
// API, con la cuenta del dueño o de un administrador, o lo pone al día si la carta cambió.
// Sirve para dejar listo el menú de un negocio (el piloto o un demo) sin escribirlo producto
// por producto. Pasa por las mismas validaciones que la app.
//
// Uso, desde la carpeta backend:
//   node scripts/cargar-menu.js https://URL-DEL-API                    (La Industria)
//   node scripts/cargar-menu.js https://URL-DEL-API --menu centenario  (Restaurante Centenario)
// Los menús que hay están en prisma/datos/menus.js.
//
// - Pide el NIT, el correo y la contraseña (la contraseña no se muestra al escribirla).
// - Compara la carta con lo que el negocio ya tiene (ver scripts/cambiosDelMenu.js), muestra
//   qué va a crear y qué va a cambiar, y pide confirmación antes de tocar algo.
// - Lo que ya no está en la carta se muestra aparte y solo se retira si se confirma también:
//   los productos se desactivan (las ventas pasadas no cambian) y se borran los grupos de
//   opciones que ya no usa ningún producto activo.
// - Se puede repetir: si la carta ya está al día, no cambia nada. Si se corta a la mitad, al
//   correrlo otra vez sigue donde quedó.
// - Los cambios de precio quedan en la auditoría del negocio, igual que si se hicieran en la app.
// - El impuesto de los productos y opciones nuevos sale del régimen del negocio (ver
//   src/config/impuestos.js); el de los que ya existen no se cambia.
// - Los productos se crean sin controlar inventario: el negocio lo activa desde Menú cuando
//   registre sus cantidades reales.
import { createInterface } from 'node:readline/promises';
import { MENUS } from '../prisma/datos/menus.js';
import { IMPUESTO_POR_REGIMEN } from '../src/config/impuestos.js';
import { calcularCambios, normalizar } from './cambiosDelMenu.js';

/** @typedef {import('../prisma/datos/menus.js').MenuParaCargar} MenuParaCargar */
/** @typedef {import('./cambiosDelMenu.js').CambiosDelMenu} CambiosDelMenu */

const [urlArgumento = '', ...demasArgumentos] = process.argv.slice(2);
const urlApi = urlArgumento.replace(/\/+$/, '');
const nombreMenu = leerOpcion(demasArgumentos, '--menu') ?? 'la-industria';

/**
 * Valor de una opción de la línea de comandos: "--menu centenario" o "--menu=centenario".
 * @param {string[]} argumentos
 * @param {string} opcion
 * @returns {string | undefined}
 */
function leerOpcion(argumentos, opcion) {
  const indice = argumentos.findIndex((a) => a === opcion || a.startsWith(`${opcion}=`));
  if (indice === -1) return undefined;
  const argumento = argumentos[indice];
  return argumento === opcion ? argumentos[indice + 1] : argumento.slice(opcion.length + 1);
}

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

/**
 * Revisa la carta antes de tocar el API: cada producto debe nombrar grupos de opciones que
 * existan en el mismo menú. Así un error en los datos no deja el menú cargado a medias.
 * @param {MenuParaCargar} menu
 */
function revisarMenu(menu) {
  const grupos = new Set(menu.grupos.map((grupo) => normalizar(grupo.nombre)));
  for (const categoria of menu.categorias) {
    for (const producto of categoria.productos) {
      const faltante = (producto.grupos ?? []).find((nombre) => !grupos.has(normalizar(nombre)));
      if (faltante) {
        throw new Error(`${producto.nombre} usa el grupo "${faltante}", que no está en el menú`);
      }
    }
  }
}

async function cargarMenu() {
  if (!/^https?:\/\/.+/.test(urlApi)) {
    throw new Error(
      'Indica la URL del API. Ejemplo: node scripts/cargar-menu.js https://zenda.seenode.app',
    );
  }
  const menu = MENUS[nombreMenu];
  if (!menu) {
    throw new Error(
      `no hay un menú "${nombreMenu}". Los que hay: ${Object.keys(MENUS).join(', ')}`,
    );
  }
  revisarMenu(menu);
  console.log(`Cargar el menú de ${menu.negocio} en ${urlApi}\n`);

  // 1. Iniciar sesión con la cuenta del dueño o de un administrador.
  const nit = await preguntar('NIT del negocio (solo números): ');
  const email = await preguntar('Correo: ');
  const password = await preguntarOculto('Contraseña: ');
  const { tokenAcceso: token } = await llamar('/auth/login', {
    metodo: 'POST',
    cuerpo: { nit, email, password },
  });

  // 2. Lo que el negocio ya tiene, y qué hay que cambiar para que quede como la carta.
  const { negocio, usuario } = await llamar('/auth/yo', { token });
  const tipoImpuesto = IMPUESTO_POR_REGIMEN[negocio.regimenImpuesto] ?? 'exento';
  console.log(
    `\nNegocio: ${negocio.nombre} (NIT ${negocio.nit}). Entraste como ${usuario.nombre}.`,
  );
  const [categorias, productos, grupos] = await Promise.all([
    llamar('/categorias', { token }),
    llamar('/productos', { token }),
    llamar('/grupos-opciones', { token }),
  ]);
  const cambios = calcularCambios(menu, { categorias, productos, grupos }, tipoImpuesto);

  // 3. Mostrar los cambios y pedir confirmación. Lo que ya no está en la carta se confirma
  //    aparte, porque retira productos que el negocio puede seguir vendiendo.
  const hayCambios = [...cambios.grupos, ...cambios.categorias, ...cambios.productos].some(
    (cambio) => cambio.accion !== 'igual',
  );
  const hayQueRetirar = cambios.productosARetirar.length + cambios.gruposARetirar.length > 0;
  mostrarCambios(cambios, tipoImpuesto);
  if (!hayCambios && !hayQueRetirar) {
    console.log('\nLa carta ya está al día: no hay nada que cambiar.');
    return;
  }
  if (hayCambios && (await preguntar('\n¿Aplicar los cambios? (s/n): ')).toLowerCase() !== 's') {
    console.log('No se cambió nada.');
    return;
  }
  const retirar =
    hayQueRetirar &&
    (await preguntar(`\n¿${preguntaParaRetirar(cambios)}? (s/n): `)).toLowerCase() === 's';
  if (!hayCambios && !retirar) {
    console.log('No se cambió nada.');
    return;
  }

  // 4. Grupos de opciones y categorías primero: los productos los necesitan.
  /** Id de cada grupo y de cada categoría en el API, por su nombre normalizado. */
  const idsDeGrupos = new Map();
  for (const cambio of cambios.grupos) {
    let id = cambio.id;
    if (cambio.accion === 'crear') {
      ({ id } = await llamar('/grupos-opciones', { metodo: 'POST', token, cuerpo: cambio.cuerpo }));
    } else if (cambio.accion === 'actualizar') {
      await llamar(`/grupos-opciones/${id}`, { metodo: 'PUT', token, cuerpo: cambio.cuerpo });
    }
    idsDeGrupos.set(normalizar(cambio.grupo.nombre), id);
  }
  const idsDeCategorias = new Map();
  for (const cambio of cambios.categorias) {
    let id = cambio.id;
    if (cambio.accion === 'crear') {
      ({ id } = await llamar('/categorias', {
        metodo: 'POST',
        token,
        cuerpo: { nombre: cambio.nombre, orden: cambio.orden },
      }));
    } else if (cambio.accion === 'actualizar') {
      await llamar(`/categorias/${id}`, {
        metodo: 'PATCH',
        token,
        cuerpo: { orden: cambio.orden },
      });
    }
    idsDeCategorias.set(normalizar(cambio.nombre), id);
  }

  // 5. Productos: crear los nuevos y enviar a los demás solo lo que les cambia.
  for (const cambio of cambios.productos) {
    const { producto } = cambio;
    const categoriaId = idsDeCategorias.get(normalizar(cambio.categoria));
    const gruposOpciones = producto.grupos?.map((nombre) => idsDeGrupos.get(normalizar(nombre)));
    if (cambio.accion === 'crear') {
      await llamar('/productos', {
        metodo: 'POST',
        token,
        cuerpo: {
          categoriaId,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio,
          tipoImpuesto,
          gruposOpciones: gruposOpciones ?? [],
        },
      });
    } else if (cambio.accion === 'actualizar') {
      const campos = new Set(cambio.campos);
      await llamar(`/productos/${cambio.id}`, {
        metodo: 'PATCH',
        token,
        cuerpo: {
          ...(campos.has('activo') && { activo: true }),
          ...(campos.has('precio') && { precio: producto.precio }),
          ...(campos.has('categoria') && { categoriaId }),
          ...(campos.has('descripcion') && { descripcion: producto.descripcion }),
          ...(campos.has('grupos') && { gruposOpciones }),
        },
      });
    }
  }

  // 6. Retirar lo que ya no está en la carta, si se confirmó.
  if (retirar) {
    for (const { id } of cambios.productosARetirar) {
      await llamar(`/productos/${id}`, { metodo: 'PATCH', token, cuerpo: { activo: false } });
    }
    for (const { id } of cambios.gruposARetirar) {
      await llamar(`/grupos-opciones/${id}`, { metodo: 'DELETE', token });
    }
  }

  const contar = (/** @type {string} */ accion) =>
    cambios.productos.filter((cambio) => cambio.accion === accion).length;
  const retirados = retirar ? `, ${cambios.productosARetirar.length} desactivados` : '';
  console.log(
    `\nListo: ${contar('crear')} productos creados, ${contar('actualizar')} actualizados${retirados}.`,
  );
}

/**
 * Muestra en la terminal lo que se va a crear (+), cambiar (~) y retirar (-). Lo que no cambia
 * solo se cuenta, para que la lista se pueda revisar de un vistazo.
 * @param {CambiosDelMenu} cambios
 * @param {string} tipoImpuesto
 */
function mostrarCambios(cambios, tipoImpuesto) {
  /**
   * @param {{ accion: string, detalle: string[] }} cambio
   * @param {string} nombre
   */
  const linea = (cambio, nombre) => {
    const marca = cambio.accion === 'crear' ? '+' : '~';
    const detalle = cambio.detalle.length ? `: ${cambio.detalle.join('; ')}` : '';
    return `  ${marca} ${nombre}${detalle}`;
  };
  /**
   * @param {string} titulo
   * @param {string[]} lineas
   */
  const seccion = (titulo, lineas) => {
    if (lineas.length) console.log(`\n${titulo}\n${lineas.join('\n')}`);
  };
  const cambian = (/** @type {{ accion: string }} */ cambio) => cambio.accion !== 'igual';

  seccion(
    'Grupos de opciones',
    cambios.grupos.filter(cambian).map((cambio) => linea(cambio, cambio.grupo.nombre)),
  );
  seccion(
    'Categorías',
    cambios.categorias.filter(cambian).map((cambio) => linea(cambio, cambio.nombre)),
  );
  // Los productos, agrupados por su categoría en la carta.
  const productos = cambios.productos.filter(cambian);
  const lineasDeProductos = [...new Set(productos.map((cambio) => cambio.categoria))].flatMap(
    (categoria) => [
      `  ${categoria}`,
      ...productos
        .filter((cambio) => cambio.categoria === categoria)
        .map((cambio) => `  ${linea(cambio, cambio.producto.nombre)}`),
    ],
  );
  seccion(`Productos (los nuevos con impuesto "${tipoImpuesto}")`, lineasDeProductos);
  seccion('Ya no están en la carta', [
    ...cambios.productosARetirar.map(({ nombre }) => `  - ${nombre} (producto)`),
    ...cambios.gruposARetirar.map(({ nombre }) => `  - ${nombre} (grupo de opciones)`),
  ]);

  const sinCambios = cambios.productos.length - productos.length;
  console.log(
    `\nResumen: ${productos.filter((c) => c.accion === 'crear').length} productos nuevos, ` +
      `${productos.filter((c) => c.accion === 'actualizar').length} con cambios y ` +
      `${sinCambios} sin cambios.`,
  );
}

/**
 * La pregunta para retirar lo que ya no está en la carta, según lo que haya.
 * @param {CambiosDelMenu} cambios
 */
function preguntaParaRetirar({ productosARetirar, gruposARetirar }) {
  const partes = [];
  if (productosARetirar.length) {
    partes.push(
      `desactivar ${productosARetirar.length === 1 ? 'el producto' : `los ${productosARetirar.length} productos`} que ya no está${productosARetirar.length === 1 ? '' : 'n'} en la carta`,
    );
  }
  if (gruposARetirar.length) {
    partes.push(
      `borrar ${gruposARetirar.length === 1 ? 'el grupo' : `los ${gruposARetirar.length} grupos`} de opciones que ya no se usa${gruposARetirar.length === 1 ? '' : 'n'}`,
    );
  }
  const pregunta = partes.join(' y ');
  return pregunta.charAt(0).toUpperCase() + pregunta.slice(1);
}

try {
  await cargarMenu();
} catch (error) {
  console.error(`\nNo se pudo cargar el menú: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
