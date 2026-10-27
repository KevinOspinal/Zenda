// @ts-check
// Esquemas Zod de categorías y productos.
import { z } from 'zod';
import {
  alMenosUnCampo,
  esquemaBooleanoEnUrl,
  esquemaId,
  esquemaMonto,
  textoObligatorio,
} from '../../lib/esquemas.js';

// ───────────────────────────── Categorías ─────────────────────────────

const camposCategoria = {
  nombre: textoObligatorio(60),
  // Posición en el menú: 0 se muestra primero.
  orden: z.number().int().min(0).max(1000),
};

/** POST /categorias */
export const esquemaCrearCategoria = z.object({
  ...camposCategoria,
  orden: camposCategoria.orden.default(0),
});

/** PATCH /categorias/:id */
export const esquemaActualizarCategoria = alMenosUnCampo(z.object(camposCategoria).partial());

// ───────────────────────────── Productos ─────────────────────────────

const camposProducto = {
  categoriaId: esquemaId,
  nombre: textoObligatorio(80),
  descripcion: z.string().trim().max(300).nullable(),
  // Precio final del menú, con el impuesto incluido.
  precio: esquemaMonto,
  tipoImpuesto: z.enum(['impoconsumo', 'iva', 'exento']),
  controlaStock: z.boolean(),
  activo: z.boolean(),
};

/** POST /productos */
export const esquemaCrearProducto = z.object({
  ...camposProducto,
  descripcion: camposProducto.descripcion.optional(),
  controlaStock: camposProducto.controlaStock.default(false),
  activo: camposProducto.activo.default(true),
});

/**
 * PATCH /productos/:id
 * El stock no se edita aquí: cambia solo con movimientos de inventario (ventas, compras, ajustes).
 */
export const esquemaActualizarProducto = alMenosUnCampo(z.object(camposProducto).partial());

/** GET /productos?categoriaId=...&activo=true */
export const esquemaFiltrosProductos = z.object({
  categoriaId: esquemaId.optional(),
  activo: esquemaBooleanoEnUrl.optional(),
});
