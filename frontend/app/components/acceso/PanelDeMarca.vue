<!--
  Panel de la marca en el ingreso y el registro (solo en pantallas grandes): qué es Zenda en
  una frase, tres beneficios y tarjetas de ejemplo de la app que flotan despacio.
  Las tarjetas son una ilustración con datos de ejemplo (por eso van ocultas para los lectores
  de pantalla) y usan los mismos chips de estado que la app. Solo se mueven si el dispositivo
  no pide reducir el movimiento.
-->
<script setup>
/** Lo que resuelve Zenda, en tres líneas. */
const BENEFICIOS = Object.freeze([
  { icono: 'i-lucide-layout-grid', texto: 'Mesas, pedidos y cocina conectados en tiempo real' },
  { icono: 'i-lucide-bike', texto: 'Domicilios con mapa y control del dinero' },
  { icono: 'i-lucide-chart-column', texto: 'Caja con arqueo y reportes al día' },
]);
</script>

<template>
  <aside
    class="relative isolate flex-col justify-between gap-10 overflow-hidden bg-primary-900 p-10 text-primary-50 xl:p-14"
  >
    <!-- Fondo: dos brillos suaves y una cuadrícula de puntos que se desvanece (decorativo). -->
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
      <div class="absolute -top-32 -left-24 size-112 rounded-full bg-primary-500/30 blur-3xl" />
      <div
        class="absolute -right-24 -bottom-16 size-104 rounded-full bg-secondary-500/25 blur-3xl"
      />
      <div
        class="absolute inset-0 bg-[radial-gradient(var(--ui-color-primary-200)_1px,transparent_1px)] opacity-15 [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />
    </div>

    <LogoZenda sobre-marca class="motion-safe:animate-aparecer" />

    <!-- Qué es Zenda. -->
    <div class="max-w-lg space-y-8 motion-safe:animate-aparecer motion-safe:[animation-delay:80ms]">
      <div class="space-y-4">
        <p class="text-sm font-semibold tracking-wide text-primary-200 uppercase">
          Para restaurantes y cafeterías
        </p>
        <h2 class="text-4xl leading-tight font-bold tracking-tight text-balance xl:text-5xl">
          Tu restaurante en orden, del pedido al cobro.
        </h2>
        <p class="text-lg text-pretty text-primary-100">
          Mesas, cocina, caja y domicilios en una sola app: en el celular, la tablet o el PC.
        </p>
      </div>
      <ul class="space-y-3">
        <li v-for="beneficio in BENEFICIOS" :key="beneficio.icono" class="flex items-center gap-3">
          <span
            class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50/10 ring-1 ring-primary-50/15"
          >
            <UIcon :name="beneficio.icono" class="size-5" />
          </span>
          <span>{{ beneficio.texto }}</span>
        </li>
      </ul>
    </div>

    <!-- Tarjetas de ejemplo de la app. El contenedor de afuera entra; el de adentro flota. -->
    <div aria-hidden="true" class="relative h-60 max-w-lg select-none xl:h-64">
      <div
        class="absolute top-0 left-0 motion-safe:animate-aparecer motion-safe:[animation-delay:200ms]"
      >
        <div
          class="w-60 rounded-xl bg-default p-4 shadow-2xl ring-1 ring-default motion-safe:animate-flotar"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="font-bold text-highlighted">Mesa 4</p>
            <ChipEstado :apariencia="ESTADOS_COCINA.listo" tamano="sm" />
          </div>
          <p class="mt-1 text-sm text-muted">2 × Hamburguesa doble</p>
        </div>
      </div>

      <div
        class="absolute top-14 right-0 motion-safe:animate-aparecer motion-safe:[animation-delay:320ms]"
      >
        <div
          class="w-56 rounded-xl bg-default p-4 shadow-2xl ring-1 ring-default motion-safe:animate-flotar motion-safe:[animation-delay:-2.5s]"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-muted">Mesa 7</p>
            <ChipEstado :apariencia="ESTADOS_PEDIDO.pagado" tamano="sm" />
          </div>
          <p class="cifra mt-1 text-2xl font-bold text-highlighted">
            {{ formatearPesos('38000') }}
          </p>
          <p class="cifra text-xs text-muted">Efectivo · cambio {{ formatearPesos('12000') }}</p>
        </div>
      </div>

      <div
        class="absolute bottom-0 left-12 motion-safe:animate-aparecer motion-safe:[animation-delay:440ms]"
      >
        <div
          class="w-64 rounded-xl bg-default p-4 shadow-2xl ring-1 ring-default motion-safe:animate-flotar motion-safe:[animation-delay:-5s]"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="font-bold text-highlighted">#15 · Juan</p>
            <ChipEstado :apariencia="ETAPAS_DOMICILIO.en_camino" tamano="sm" />
          </div>
          <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-map-pin" class="size-4" />
            Calle 10 # 5-20
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>
