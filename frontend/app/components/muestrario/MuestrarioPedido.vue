<!--
  Muestrario: tomar un pedido con productos reales de La Industria (temporal, Fase 0).
  Simula también la cocina: después de enviar, los platos pasan a "Preparando" y "Listo".
  Aquí el total se suma en pantalla porque no hay API; en la app real lo da el backend.
-->
<script setup>
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const { vibrate, isSupported } = useVibrate({ pattern: [40, 60, 40] });

/** Parte del menú de La Industria (precios con impuesto incluido). */
const MENU = [
  {
    id: 'c1',
    nombre: 'Hamburguesas',
    productos: [
      { id: 'p1', nombre: 'IND Classic Artesanal', descripcion: null, precio: '12000' },
      { id: 'p2', nombre: 'IND Bacon Artesanal', descripcion: 'Tocineta', precio: '14000' },
      {
        id: 'p3',
        nombre: 'Suggar Daddy Artesanal',
        descripcion: 'Maduro guayabo, tocineta, queso campesino',
        precio: '20000',
      },
      {
        id: 'p4',
        nombre: 'IND Monster Angus',
        descripcion: '3 carnes, 3 quesos y tocineta',
        precio: '50000',
      },
    ],
  },
  {
    id: 'c2',
    nombre: 'Salchipapas',
    productos: [
      {
        id: 'p5',
        nombre: 'Salchi Classic 1P',
        descripcion: 'Papa criolla, salchicha, ripio',
        precio: '10000',
      },
      {
        id: 'p6',
        nombre: 'Salchi Caleña 1P',
        descripcion: 'Maduro guayabo, tocineta, queso en maicitos',
        precio: '17000',
      },
      {
        id: 'p7',
        nombre: 'La Texana 2P',
        descripcion: 'Pulled pork, pico e gallo, guacamole, doritos',
        precio: '40000',
      },
    ],
  },
  {
    id: 'c3',
    nombre: 'Perros',
    productos: [
      { id: 'p8', nombre: 'Perro Clasic', descripcion: null, precio: '15000' },
      { id: 'p9', nombre: 'Choriperro Bacon', descripcion: 'Tocineta, chorizo', precio: '17000' },
    ],
  },
  {
    id: 'c4',
    nombre: 'Bebidas',
    productos: [
      { id: 'p10', nombre: 'Gaseosa personal 400 ml', descripcion: null, precio: '4000' },
      { id: 'p11', nombre: 'Jugo Hit', descripcion: null, precio: '7000' },
      { id: 'p12', nombre: 'Agua', descripcion: null, precio: '2000' },
    ],
  },
];

/** Todos los productos, cada uno con el ícono y el tono de su categoría. */
const PRODUCTOS = MENU.flatMap((categoria, posicion) =>
  categoria.productos.map((producto) => ({
    ...producto,
    categoriaId: categoria.id,
    apariencia: aparienciaDeCategoria(categoria.nombre, posicion),
  })),
);

// 1. Menú: categoría activa o búsqueda.
const categoriaActiva = ref(MENU[0].id);
const busqueda = ref('');
const productosVisibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  return texto
    ? PRODUCTOS.filter((p) => p.nombre.toLowerCase().includes(texto))
    : PRODUCTOS.filter((p) => p.categoriaId === categoriaActiva.value);
});

// 2. Cuenta: ítems con la forma que envía el API.
const items = ref(/** @type {any[]} */ ([]));
let siguienteId = 1;

/**
 * Agrega un producto. Si ya hay uno igual (mismas notas) que todavía no se ha enviado a la
 * cocina, suma la cantidad en lugar de crear otra línea.
 * @param {(typeof PRODUCTOS)[number]} producto
 * @param {{ cantidad?: number, notas?: string }} [opciones]
 */
function agregar(producto, { cantidad = 1, notas = '' } = {}) {
  const igual = items.value.find(
    (i) => i.productoId === producto.id && (i.notas ?? '') === notas && !i.enviadoACocina,
  );
  if (igual) {
    igual.cantidad = aDecimal(igual.cantidad).plus(cantidad).toString();
    return;
  }
  items.value.push({
    id: `item-${siguienteId++}`,
    productoId: producto.id,
    cantidad: String(cantidad),
    precioUnitario: producto.precio,
    notas: notas || null,
    estadoCocina: 'pendiente',
    producto: { nombre: producto.nombre },
    // Solo del ejemplo: marca lo que ya se envió, para no enviarlo dos veces.
    enviadoACocina: false,
  });
}

/** @param {string} productoId */
const cantidadDe = (productoId) =>
  sumar(items.value.filter((i) => i.productoId === productoId).map((i) => i.cantidad)).toNumber();
const totalProductos = computed(() => sumar(items.value.map((i) => i.cantidad)).toNumber());
const total = computed(() =>
  sumar(items.value.map((i) => aDecimal(i.precioUnitario).times(i.cantidad))),
);
const hayPendientes = computed(() => items.value.some((i) => !i.enviadoACocina));

/**
 * Quita un ítem con la opción de deshacer.
 * @param {any} item
 */
function quitar(item) {
  const posicion = items.value.findIndex((i) => i.id === item.id);
  items.value.splice(posicion, 1);
  toast.add({
    title: `Quitaste ${item.producto.nombre}`,
    icon: 'i-lucide-trash-2',
    color: 'neutral',
    actions: [
      {
        label: 'Deshacer',
        icon: 'i-lucide-undo-2',
        color: 'neutral',
        variant: 'outline',
        onClick: () => items.value.splice(posicion, 0, item),
      },
    ],
  });
}

// 3. Paneles: cuenta (celular) y producto con cantidad y notas.
const cuentaAbierta = ref(false);
const personalizando = ref(false);
const productoElegido = ref(/** @type {(typeof PRODUCTOS)[number] | null} */ (null));
/** @param {(typeof PRODUCTOS)[number]} producto */
function personalizar(producto) {
  productoElegido.value = producto;
  personalizando.value = true;
}

// 4. Enviar a cocina y simular cómo avanza.
const temporizadores = [];
onBeforeUnmount(() => temporizadores.forEach(clearTimeout));

function enviarACocina() {
  cuentaAbierta.value = false;
  const enviados = items.value.filter((i) => !i.enviadoACocina);
  enviados.forEach((i) => (i.enviadoACocina = true));
  toast.add({
    title: 'Enviado a cocina',
    description: `Mesa 4 · ${enviados.length} línea(s)`,
    icon: 'i-lucide-chef-hat',
    color: 'success',
  });

  temporizadores.push(
    setTimeout(() => {
      enviados.forEach((i) => (i.estadoCocina = 'preparando'));
      toast.add({
        title: 'La cocina empezó a preparar',
        description: 'Mesa 4',
        icon: 'i-lucide-flame',
        color: 'warning',
      });
    }, 3000),
  );
  temporizadores.push(
    setTimeout(() => {
      enviados[0].estadoCocina = 'listo';
      if (isSupported.value) vibrate();
      toast.add({
        title: '¡Listo para llevar!',
        description: `Mesa 4 · ${enviados[0].producto.nombre}`,
        icon: 'i-lucide-bell-ring',
        color: 'info',
      });
    }, 7000),
  );
}
</script>

<template>
  <SeccionMuestrario
    id="pedido"
    titulo="Tomar un pedido"
    descripcion="Toca un producto para agregarlo; con el botón de nota eliges cantidad y notas para la cocina. Envía a cocina y mira cómo avanza: en 3 segundos empieza a prepararse y en 7 el primer plato está listo."
  >
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-4 lg:col-span-2">
        <UInput
          v-model="busqueda"
          icon="i-lucide-search"
          size="xl"
          class="w-full"
          placeholder="Buscar en el menú"
          aria-label="Buscar en el menú"
        />

        <div
          v-if="!busqueda"
          class="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Categorías"
        >
          <UButton
            v-for="categoria in MENU"
            :key="categoria.id"
            :label="categoria.nombre"
            :icon="iconoDeCategoria(categoria.nombre)"
            size="lg"
            class="shrink-0"
            :color="categoriaActiva === categoria.id ? 'primary' : 'neutral'"
            :variant="categoriaActiva === categoria.id ? 'solid' : 'soft'"
            :aria-pressed="categoriaActiva === categoria.id"
            @click="categoriaActiva = categoria.id"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <TarjetaProducto
            v-for="producto in productosVisibles"
            :key="producto.id"
            :producto="producto"
            :apariencia="producto.apariencia"
            :cantidad="cantidadDe(producto.id)"
            @agregar="agregar(producto)"
            @personalizar="personalizar(producto)"
          />
        </div>
        <UEmpty
          v-if="!productosVisibles.length"
          icon="i-lucide-search-x"
          title="No encontramos ese producto"
          :description="`Nada en el menú coincide con “${busqueda}”.`"
        />
      </div>

      <!-- Tablet horizontal y PC: la cuenta fija a la derecha. -->
      <aside class="hidden lg:block" aria-label="Cuenta de la Mesa 4">
        <div
          class="sticky top-32 flex h-[34rem] flex-col rounded-xl bg-default p-5 ring-1 ring-default"
        >
          <h3 class="mb-2 text-lg font-bold text-highlighted">Cuenta · Mesa 4</h3>
          <PanelCuenta
            :items="items"
            :total="total"
            :puede-enviar="hayPendientes"
            @quitar="quitar"
            @enviar="enviarACocina"
          />
        </div>
      </aside>
    </div>

    <!-- Celular: barra fija abajo que abre la cuenta. -->
    <Transition
      enter-from-class="translate-y-4 opacity-0"
      enter-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <div v-if="items.length && !pantallaGrande" class="sticky bottom-4 z-10">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-5 py-4 text-inverted shadow-lg transition active:scale-[0.98]"
          @click="cuentaAbierta = true"
        >
          <span class="flex items-center gap-2 font-semibold">
            <UIcon name="i-lucide-receipt" class="size-5" />
            Ver cuenta · {{ totalProductos }} {{ totalProductos === 1 ? 'producto' : 'productos' }}
          </span>
          <CifraAnimada :valor="total" class="text-lg font-bold" />
        </button>
      </div>
    </Transition>

    <UDrawer
      v-model:open="cuentaAbierta"
      title="Cuenta · Mesa 4"
      description="Lo que la cocina aún no empieza se puede quitar."
    >
      <template #body>
        <PanelCuenta
          :items="items"
          :total="total"
          :puede-enviar="hayPendientes"
          @quitar="quitar"
          @enviar="enviarACocina"
        />
      </template>
    </UDrawer>

    <PersonalizarProducto
      v-model:abierto="personalizando"
      :producto="productoElegido"
      :apariencia="productoElegido?.apariencia ?? null"
      @agregar="({ producto, cantidad, notas }) => agregar(producto, { cantidad, notas })"
    />
  </SeccionMuestrario>
</template>
