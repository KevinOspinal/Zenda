// @ts-check
// Pruebas de la documentación Swagger: que se sirva, que cada ruta del API esté
// documentada (y que no haya documentación de rutas que ya no existen), que cada endpoint
// tenga la información mínima para entenderlo y que diga exactamente quién puede usarlo.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { ROLES } from '../src/config/roles.js';
import { documentoOpenApi } from '../src/docs/openapi.js';
import { MODULOS } from '../src/rutas.js';

const app = createApp();
const METODOS_HTTP = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Rutas reales registradas en Express, en formato OpenAPI: "post /pedidos/{id}/cobrar".
 * @returns {string[]}
 */
function rutasDeExpress() {
  const rutas = ['get /health'];
  for (const [prefijo, router] of MODULOS) {
    for (const capa of router.stack) {
      if (!capa.route) continue;
      // "/:id/items/:itemId" → "/{id}/items/{itemId}"; la raíz "/" no agrega nada.
      const ruta = capa.route.path === '/' ? '' : capa.route.path.replace(/:(\w+)/g, '{$1}');
      for (const metodo of Object.keys(/** @type {any} */ (capa.route).methods)) {
        rutas.push(`${metodo} ${prefijo}${ruta}`);
      }
    }
  }
  return rutas.sort();
}

/**
 * Roles que deja pasar cada ruta real según su permitirRoles, con la clave de
 * rutasDeExpress: "post /usuarios" → ['administrador_zenda']. Un permitirRoles del router
 * (router.use) aplica a todas sus rutas. Las rutas sin permitirRoles no aparecen: las abre a
 * todos los roles o revisan el rol dentro del servicio.
 * @returns {Map<string, string[]>}
 */
function rolesDeExpress() {
  const roles = new Map();
  for (const [prefijo, router] of MODULOS) {
    /** @type {string[] | undefined} */
    let delRouter;
    for (const capa of /** @type {any[]} */ (router.stack)) {
      if (!capa.route) {
        delRouter = capa.handle.rolesPermitidos ?? delRouter;
        continue;
      }
      const deLaRuta = capa.route.stack.map((/** @type {any} */ c) => c.handle.rolesPermitidos);
      const listas = [delRouter, ...deLaRuta].filter(Boolean);
      if (listas.length === 0) continue;
      // Si hay varias listas, pasa quien esté en todas.
      const permitidos = ROLES.filter((rol) => listas.every((lista) => lista.includes(rol)));
      const ruta = capa.route.path === '/' ? '' : capa.route.path.replace(/:(\w+)/g, '{$1}');
      for (const metodo of Object.keys(capa.route.methods)) {
        roles.set(`${metodo} ${prefijo}${ruta}`, permitidos);
      }
    }
  }
  return roles;
}

/** @param {string[]} roles */
const enOrden = (roles) => [...roles].sort().join(', ');

/** Operaciones documentadas: [clave, operación]. */
function operacionesDocumentadas() {
  return Object.entries(documentoOpenApi.paths).flatMap(([ruta, metodos]) =>
    Object.entries(metodos)
      .filter(([metodo]) => METODOS_HTTP.includes(metodo))
      .map(([metodo, operacion]) => [`${metodo} ${ruta}`, operacion]),
  );
}

describe('documentación Swagger', () => {
  it('sirve la interfaz en /docs y el documento en /docs/openapi.json', async () => {
    const interfaz = await request(app).get('/docs/');
    const documento = await request(app).get('/docs/openapi.json');

    expect(interfaz.status).toBe(200);
    expect(interfaz.text).toContain('swagger-ui');
    expect(documento.status).toBe(200);
    expect(documento.body.openapi).toBe('3.1.0');
  });

  it('documenta exactamente las rutas que existen: ni una de más ni una de menos', () => {
    const documentadas = operacionesDocumentadas()
      .map(([clave]) => clave)
      .sort();

    expect(documentadas).toEqual(rutasDeExpress());
  });

  it('cada endpoint tiene grupo, resumen, descripción con roles y una respuesta exitosa', () => {
    for (const [clave, operacion] of operacionesDocumentadas()) {
      const codigos = Object.keys(operacion.responses);

      expect(operacion.tags, clave).toHaveLength(1);
      expect(operacion.summary, clave).toBeTruthy();
      expect(operacion.description, clave).toMatch(/Público|Quién puede usarlo/);
      expect(
        codigos.some((codigo) => codigo.startsWith('2')),
        `${clave} sin respuesta exitosa`,
      ).toBe(true);
    }
  });

  it('los endpoints protegidos documentan el 401 y los públicos no piden token', () => {
    for (const [clave, operacion] of operacionesDocumentadas()) {
      const publica = Array.isArray(operacion.security) && operacion.security.length === 0;
      if (publica) {
        expect(operacion.description, clave).toContain('Público');
      } else {
        expect(operacion.responses, clave).toHaveProperty('401');
      }
    }
  });

  it('cada grupo usado está declarado y cada referencia a un error existe', () => {
    const grupos = new Set(documentoOpenApi.tags.map((tag) => tag.name));
    const errores = new Set(Object.keys(documentoOpenApi.components.responses));

    for (const [clave, operacion] of operacionesDocumentadas()) {
      expect(grupos.has(operacion.tags[0]), `${clave}: grupo ${operacion.tags[0]}`).toBe(true);
      for (const respuesta of Object.values(operacion.responses)) {
        if (respuesta.$ref) {
          expect(errores.has(respuesta.$ref.split('/').pop()), `${clave}: ${respuesta.$ref}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('cada ruta documenta exactamente los roles que la pueden usar', () => {
    // La lectura de los permisos funciona: un caso conocido.
    expect(rolesDeExpress().get('post /usuarios')).toEqual(['administrador_zenda']);
    expect(rolesDeExpress().get('get /reportes/resumen')).toEqual([
      'administrador_zenda',
      'dueno',
      'administrador',
    ]);

    const documentadas = new Map(operacionesDocumentadas());
    const diferencias = [...rolesDeExpress()]
      .filter(([clave, roles]) => {
        const documentados = documentadas.get(clave)?.['x-roles'];
        return !documentados || enOrden(documentados) !== enOrden(roles);
      })
      .map(
        ([clave, roles]) =>
          `${clave}: la ruta deja pasar a ${enOrden(roles)}; Swagger dice ` +
          `${enOrden(documentadas.get(clave)?.['x-roles'] ?? [])}`,
      );

    expect(diferencias).toEqual([]);
  });

  it('el administrador de Zenda puede todo lo que puede el dueño', () => {
    const enLasRutas = [...rolesDeExpress()];
    const enSwagger = operacionesDocumentadas().map(([clave, operacion]) => [
      clave,
      operacion['x-roles'] ?? [],
    ]);
    const sinElAdministradorDeZenda = [...enLasRutas, ...enSwagger]
      .filter(([, roles]) => roles.includes('dueno') && !roles.includes('administrador_zenda'))
      .map(([clave]) => clave);

    expect(sinElAdministradorDeZenda).toEqual([]);
  });
});
