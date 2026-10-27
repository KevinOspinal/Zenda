<!--
  Ventas por canal: cuánto se vendió en mesa, en mostrador y a domicilio, y por dónde llegaron
  los pedidos (en el local, WhatsApp, teléfono u otro). Cada fila lleva su ícono, una barra de
  un solo tono (frente a la mayor del grupo), el número de ventas y el total.
-->
<script setup>
const props = defineProps({
  /** Ventas por tipo de pedido (resumen del API): siempre los 3 tipos, en orden fijo. */
  porTipo: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Ventas por origen (resumen del API): siempre los 4 orígenes, en orden fijo. */
  porOrigen: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
});

/**
 * Filas de un grupo listas para mostrar, con el largo de su barra frente a la mayor.
 * @param {any[]} grupo
 * @param {Readonly<Record<string, { etiqueta: string, icono: string }>>} apariencias
 * @param {'tipo' | 'origen'} campo
 */
function filasDe(grupo, apariencias, campo) {
  const mayor = grupo.reduce(
    (maximo, fila) => Decimal.max(maximo, aDecimal(fila.total)),
    aDecimal(0),
  );
  return grupo.map((fila) => ({
    clave: fila[campo],
    ...apariencias[fila[campo]],
    ventas: fila.ventas,
    total: fila.total,
    largo: mayor.isZero() ? 0 : aDecimal(fila.total).dividedBy(mayor).times(100).toNumber(),
  }));
}

const grupos = computed(() => [
  { titulo: 'Por tipo de pedido', filas: filasDe(props.porTipo, TIPOS_PEDIDO, 'tipo') },
  { titulo: 'Por dónde llegaron', filas: filasDe(props.porOrigen, ORIGENES_PEDIDO, 'origen') },
]);
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <header>
      <h2 class="text-lg font-semibold text-highlighted">Ventas por canal</h2>
      <p class="text-sm text-muted">En mesa, en mostrador o a domicilio, y por dónde llegaron.</p>
    </header>

    <div class="grid gap-5 sm:grid-cols-2">
      <div v-for="grupo in grupos" :key="grupo.titulo" class="space-y-3">
        <h3 class="text-sm font-medium text-muted">{{ grupo.titulo }}</h3>
        <ul class="space-y-3">
          <li v-for="fila in grupo.filas" :key="fila.clave" class="space-y-1.5">
            <div class="flex items-center gap-2">
              <UIcon :name="fila.icono" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate font-medium text-highlighted">
                {{ fila.etiqueta }}
              </span>
              <span class="cifra text-right text-sm">
                <span class="font-semibold text-highlighted">{{ formatearPesos(fila.total) }}</span>
                <span class="text-muted">
                  · {{ fila.ventas }} {{ fila.ventas === 1 ? 'venta' : 'ventas' }}
                </span>
              </span>
            </div>
            <!-- Barra: cuadrada al inicio y redondeada al final, como pide la guía de gráficas. -->
            <div class="ms-6 h-2 rounded-e bg-elevated" aria-hidden="true">
              <div class="h-full rounded-e bg-primary" :style="{ width: `${fila.largo}%` }" />
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
