// @ts-check
// Lista de módulos del API con el prefijo en el que se montan.
//
// Está en un solo lugar para que app.js los registre y para que la prueba de la
// documentación compruebe que ninguna ruta quedó sin documentar en Swagger.
import { rutasAuditoria } from './modules/auditoria/auditoria.routes.js';
import { rutasAuth } from './modules/auth/auth.routes.js';
import { rutasCaja } from './modules/caja/caja.routes.js';
import { rutasClientes } from './modules/clientes/clientes.routes.js';
import { rutasInventario } from './modules/inventario/inventario.routes.js';
import { rutasCategorias, rutasMenu, rutasProductos } from './modules/menu/menu.routes.js';
import { rutasMesas } from './modules/mesas/mesas.routes.js';
import { rutasNegocios } from './modules/negocios/negocios.routes.js';
import { rutasPedidos } from './modules/pedidos/pedidos.routes.js';
import { rutasReportes } from './modules/reportes/reportes.routes.js';
import { rutasUsuarios } from './modules/usuarios/usuarios.routes.js';

/** @type {ReadonlyArray<[prefijo: string, rutas: import('express').Router]>} */
export const MODULOS = Object.freeze([
  ['/negocios', rutasNegocios],
  ['/auth', rutasAuth],
  ['/usuarios', rutasUsuarios],
  ['/menu', rutasMenu],
  ['/categorias', rutasCategorias],
  ['/productos', rutasProductos],
  ['/mesas', rutasMesas],
  ['/clientes', rutasClientes],
  ['/caja', rutasCaja],
  ['/pedidos', rutasPedidos],
  ['/inventario', rutasInventario],
  ['/reportes', rutasReportes],
  ['/auditoria', rutasAuditoria],
]);
