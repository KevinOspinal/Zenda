// @ts-check
// Datos de ejemplo para la documentación. Son coherentes entre sí (el mismo pedido,
// la misma mesa, el mismo producto en todos los endpoints) y se basan en el seed de
// "La Industria". Los ids son ficticios: en tu base serán otros.

export const ID = Object.freeze({
  negocio: '8eb2dc19-bce7-4ae7-b5f5-7c25a423e2a8',
  dueno: '5b0f3a52-7c1e-4d2b-9a6f-1e2d3c4b5a60',
  cajero: 'cc458104-036b-4b61-9211-d8dca03d2193',
  mesero: 'b10f8a83-f9de-48e6-b15a-75c81076fec8',
  categoria: '3a1d2c4b-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  hamburguesa: '67181655-a001-4cdb-81d2-15c828ac2122',
  gaseosa: '01721d54-3c86-4072-93cf-d55083bab619',
  mesa: 'b4df1c14-ff89-4aab-815f-4ff530cff8ca',
  cliente: '9f8e7d6c-5b4a-4321-8fed-cba987654321',
  turno: '3fc3deb2-0922-4f64-ad51-a0178914779f',
  pedido: '1f37f805-8f8b-4376-bfc7-e87695d2ac69',
  itemHamburguesa: '16d00d78-c49e-4432-8fbc-1cffab8f1f4b',
  itemGaseosa: '72c51c90-9b51-43ae-a798-2da59a6868c0',
  pago: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
  uuidOffline: '492f0a8c-3856-4c64-886e-2b7a74373677',
  domiciliario: '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e',
  entrega: '0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d',
});

/** Un token de ejemplo (recortado). Usa el que te entrega POST /auth/login. */
export const TOKEN_EJEMPLO = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6Ij...';

export const USUARIO_CAJERO = Object.freeze({
  id: ID.cajero,
  nombre: 'Camilo Torres',
  email: 'cajero@laindustria.test',
  rol: 'cajero',
});

export const PRODUCTO_HAMBURGUESA = Object.freeze({
  id: ID.hamburguesa,
  tenantId: ID.negocio,
  categoriaId: ID.categoria,
  nombre: 'IND Classic Artesanal',
  descripcion: 'Carne artesanal, queso y vegetales',
  precio: '12000',
  tipoImpuesto: 'impoconsumo',
  controlaStock: false,
  stock: '0',
  activo: true,
});

export const MESA = Object.freeze({
  id: ID.mesa,
  tenantId: ID.negocio,
  nombre: 'Mesa 1',
  zona: 'Salón',
  capacidad: 4,
  estado: 'libre',
});

export const CLIENTE = Object.freeze({
  id: ID.cliente,
  tenantId: ID.negocio,
  tipoDocumento: 'cc',
  numeroDocumento: '1000000001',
  nombre: 'Ana María Ruiz',
  email: 'ana.ruiz@ejemplo.test',
  telefono: '3001234567',
});

/** Pedido de ejemplo: 2 IND Classic Artesanal ($12.000) + 1 gaseosa personal ($4.000). */
export const PEDIDO = Object.freeze({
  id: ID.pedido,
  tenantId: ID.negocio,
  mesaId: ID.mesa,
  turnoId: ID.turno,
  meseroId: ID.mesero,
  clienteId: null,
  estado: 'abierto',
  tipo: 'mesa',
  origen: 'local',
  numero: 15,
  nombreCliente: null,
  valorDomicilio: '0',
  subtotal: '25925.92',
  impuestos: '2074.08',
  total: '28000',
  ajusteRedondeo: '0',
  propina: '0',
  uuidOffline: ID.uuidOffline,
  abiertoEn: '2026-10-26T22:15:03.120Z',
  enviadoACocinaEn: null,
  cerradoEn: null,
  items: [
    {
      id: ID.itemHamburguesa,
      tenantId: ID.negocio,
      pedidoId: ID.pedido,
      productoId: ID.hamburguesa,
      cantidad: '2',
      precioUnitario: '12000',
      tasaImpuesto: '8',
      estadoCocina: 'pendiente',
      notas: 'Sin cebolla',
      creadoEn: '2026-10-26T22:15:03.140Z',
      producto: { nombre: 'IND Classic Artesanal' },
    },
    {
      id: ID.itemGaseosa,
      tenantId: ID.negocio,
      pedidoId: ID.pedido,
      productoId: ID.gaseosa,
      cantidad: '1',
      precioUnitario: '4000',
      tasaImpuesto: '8',
      estadoCocina: 'pendiente',
      notas: null,
      creadoEn: '2026-10-26T22:15:03.150Z',
      producto: { nombre: 'Gaseosa personal 400 ml' },
    },
  ],
  pagos: [],
  mesa: { id: ID.mesa, nombre: 'Mesa 1', estado: 'ocupada' },
  cliente: null,
  // Solo en negocios que no facturan electrónicamente, después de cobrar.
  recibo: null,
  // 10 % del subtotal (25925.92), en pesos enteros hacia abajo.
  propinaSugerida: '2592.00',
});

/** Rango de fechas de ejemplo para los reportes. */
export const RANGO = Object.freeze({ desde: '2026-10-20', hasta: '2026-10-20' });

/** Domiciliario de ejemplo. */
export const DOMICILIARIO = Object.freeze({
  id: ID.domiciliario,
  tenantId: ID.negocio,
  nombre: 'Pedro Gómez',
  telefono: '3001234567',
  activo: true,
  creadoEn: '2026-10-20T14:00:00.000Z',
});

/**
 * Domicilio de ejemplo: el mismo pedido llevado a una dirección, con $3.000 de domicilio.
 * Los datos de entrega solo los ven el cajero, el administrador y el dueño.
 */
export const PEDIDO_DOMICILIO = Object.freeze({
  ...PEDIDO,
  mesaId: null,
  mesa: null,
  tipo: 'domicilio',
  origen: 'whatsapp',
  nombreCliente: 'Juan',
  valorDomicilio: '3000',
  subtotal: '28925.92',
  total: '31000',
  propinaSugerida: '0.00',
  entrega: {
    id: ID.entrega,
    tenantId: ID.negocio,
    pedidoId: ID.pedido,
    telefono: '3109876543',
    direccion: 'Calle 10 # 5-20, barrio San Antonio',
    indicaciones: 'Apto 302, timbre dañado',
    pagaCon: '50000',
    domiciliarioId: null,
    despachadoEn: null,
    entregadoEn: null,
    domiciliario: null,
  },
});
