<!--
  Recibo de venta como sale en una impresora térmica (58 u 80 mm) o en PDF: los datos del
  negocio con que se emitió, el número y la fecha, los productos, el total, cómo se pagó con
  su cambio, y las leyendas. Siempre negro sobre blanco: es papel, no depende del tema.
  ⚠️ Pendiente de validar con un contador: el contenido y las leyendas.
-->
<script setup>
const props = defineProps({
  /** Pedido completo con su `recibo` (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Ancho del papel en milímetros: "80" o "58". */
  ancho: { type: String, default: '80' },
});

const encabezado = computed(() => props.pedido.recibo?.encabezado ?? {});
const lineas = computed(() => lineasDelRecibo(props.pedido));
const pagos = computed(() => pagosDelRecibo(props.pedido));
const valorDomicilio = computed(() => aDecimal(props.pedido.valorDomicilio ?? 0));
const propina = computed(() => aDecimal(props.pedido.propina ?? 0));
const tipo = computed(() => tipoDelPedido(props.pedido));
const cliente = computed(() => props.pedido.cliente ?? null);
</script>

<template>
  <!-- Área imprimible: 72 mm en papel de 80 mm y 48 mm en papel de 58 mm. -->
  <article
    class="space-y-2 bg-white p-[3mm] font-mono leading-snug text-black"
    :class="ancho === '58' ? 'w-[54mm] text-[10px]' : 'w-[78mm] text-[12px]'"
  >
    <header class="space-y-0.5 text-center">
      <p class="text-[1.25em] font-bold uppercase">{{ encabezado.nombre }}</p>
      <p>NIT {{ encabezado.nit }}</p>
      <p v-if="encabezado.direccion">{{ encabezado.direccion }}</p>
      <p v-if="encabezado.ciudad">{{ encabezado.ciudad }}</p>
      <p v-if="encabezado.telefono">Tel. {{ encabezado.telefono }}</p>
      <p>No responsable de IVA ni del impuesto al consumo</p>
    </header>

    <section class="space-y-0.5 border-t border-dashed border-black pt-2">
      <p class="text-center font-bold">
        RECIBO DE VENTA No. {{ numeroDeRecibo(pedido.recibo.numero) }}
      </p>
      <p>Fecha: {{ formatearFechaYHora(pedido.recibo.emitidoEn) }}</p>
      <p>
        Pedido: {{ nombreDelPedido(pedido) }}
        <template v-if="tipo !== 'mesa'">({{ TIPOS_PEDIDO[tipo].etiqueta }})</template>
      </p>
      <p v-if="cliente">
        Cliente: {{ cliente.nombre }} · {{ cliente.tipoDocumento.toUpperCase() }}
        {{ cliente.numeroDocumento }}
      </p>
      <p v-if="pedido.entrega">Entregar en: {{ pedido.entrega.direccion }}</p>
      <p v-if="pedido.estado === 'anulado'" class="py-1 text-center text-[1.25em] font-bold">
        *** ANULADO ***
      </p>
    </section>

    <section class="space-y-1 border-t border-dashed border-black pt-2">
      <div v-for="linea in lineas" :key="linea.id">
        <p class="flex justify-between gap-2">
          <span>{{ formatearCantidad(linea.cantidad) }} x {{ linea.nombre }}</span>
          <span class="shrink-0">{{ formatearPesos(linea.valor) }}</span>
        </p>
        <p v-if="linea.notas" class="ps-3">{{ linea.notas }}</p>
      </div>
      <p v-if="valorDomicilio.greaterThan(0)" class="flex justify-between gap-2">
        <span>Domicilio</span>
        <span class="shrink-0">{{ formatearPesos(valorDomicilio) }}</span>
      </p>
    </section>

    <section class="space-y-0.5 border-t border-dashed border-black pt-2">
      <p class="flex justify-between gap-2 text-[1.2em] font-bold">
        <span>TOTAL</span>
        <span>{{ formatearPesos(pedido.total) }}</span>
      </p>
      <template v-if="propina.greaterThan(0)">
        <p class="flex justify-between gap-2">
          <span>Propina voluntaria</span>
          <span>{{ formatearPesos(propina) }}</span>
        </p>
        <p class="flex justify-between gap-2 font-bold">
          <span>Total pagado</span>
          <span>{{ formatearPesos(totalPagadoDelRecibo(pedido)) }}</span>
        </p>
      </template>
      <div v-for="pago in pagos" :key="pago.id">
        <p class="flex justify-between gap-2">
          <span>{{ METODOS_PAGO[pago.metodo].etiqueta }}</span>
          <span>{{ formatearPesos(pago.monto) }}</span>
        </p>
        <template v-if="pago.cambio">
          <p class="flex justify-between gap-2 ps-3">
            <span>Recibido</span>
            <span>{{ formatearPesos(pago.recibido) }}</span>
          </p>
          <p class="flex justify-between gap-2 ps-3">
            <span>Cambio</span>
            <span>{{ formatearPesos(pago.cambio) }}</span>
          </p>
        </template>
      </div>
    </section>

    <footer class="space-y-1 border-t border-dashed border-black pt-2 text-center">
      <p>Este recibo no es una factura electrónica.</p>
      <p v-if="encabezado.pieRecibo" class="font-bold">{{ encabezado.pieRecibo }}</p>
    </footer>
  </article>
</template>
