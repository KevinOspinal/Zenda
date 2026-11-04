// @ts-check
// Códigos QR: leer el que viene en una foto o captura (el QR de cobro que el banco le dio al
// negocio) y volver a dibujarlo a partir de su contenido.
// Se guarda el contenido y no la imagen: así sale nítido en cualquier pantalla y en el papel de
// la impresora térmica, y pesa unos pocos caracteres.
import { encode } from 'uqr';

/**
 * Cuadros negros del QR de un texto, como un solo trazo SVG (un rectángulo por cada tramo
 * negro de cada fila). Incluye un margen blanco alrededor, que los lectores necesitan.
 * @param {string} contenido
 * @returns {{ tamano: number, trazo: string }} `tamano` en cuadros, para el viewBox del SVG.
 */
export function dibujoDeQr(contenido) {
  // Corrección de errores M: el QR se sigue leyendo aunque el papel quede un poco manchado.
  const { data, size } = encode(contenido, { ecc: 'M', border: 2 });
  const tramos = [];
  for (let fila = 0; fila < size; fila += 1) {
    let columna = 0;
    while (columna < size) {
      if (!data[fila]?.[columna]) {
        columna += 1;
        continue;
      }
      const inicio = columna;
      while (data[fila]?.[columna]) columna += 1;
      tramos.push(`M${inicio} ${fila}h${columna - inicio}v1h${inicio - columna}z`);
    }
  }
  return { tamano: size, trazo: tramos.join('') };
}

/**
 * Lee el QR de una imagen ya convertida en píxeles (RGBA, como los da un canvas).
 * @param {Uint8ClampedArray} pixeles
 * @param {number} ancho
 * @param {number} alto
 * @returns {Promise<string | null>} El contenido del QR, o null si no se encontró ninguno.
 */
export async function leerQrDePixeles(pixeles, ancho, alto) {
  // El lector se carga solo cuando se necesita: únicamente lo usa la configuración del dueño.
  const { default: jsQR } = await import('jsqr');
  const resultado = jsQR(pixeles, ancho, alto, { inversionAttempts: 'attemptBoth' });
  return resultado?.data || null;
}

/** Tamaños (en píxeles, del lado más largo) con que se intenta leer una imagen. */
const TAMANOS_DE_LECTURA = [1200, 700];

/**
 * Lee el QR de una foto o captura de pantalla. Se intenta en dos tamaños: una captura grande
 * se lee mejor reducida, y una foto pequeña, sin reducir.
 * @param {Blob} archivo
 * @returns {Promise<string | null>} El contenido del QR, o null si no se encontró ninguno.
 */
export async function leerQrDeImagen(archivo) {
  const imagen = await createImageBitmap(archivo);
  try {
    for (const maximo of TAMANOS_DE_LECTURA) {
      const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
      const ancho = Math.max(1, Math.round(imagen.width * escala));
      const alto = Math.max(1, Math.round(imagen.height * escala));
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      const contexto = lienzo.getContext('2d', { willReadFrequently: true });
      if (!contexto) return null;
      contexto.drawImage(imagen, 0, 0, ancho, alto);
      const { data } = contexto.getImageData(0, 0, ancho, alto);
      const contenido = await leerQrDePixeles(data, ancho, alto);
      if (contenido) return contenido;
    }
    return null;
  } finally {
    imagen.close();
  }
}
