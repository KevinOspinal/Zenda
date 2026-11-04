<!--
  Precuenta de un pedido abierto, como sale en una impresora térmica (58 u 80 mm) o en PDF: la
  cuenta que se lleva a la mesa antes de cobrar. Lleva los datos del negocio, los productos, el
  total, la propina sugerida (voluntaria, Ley 1935 de 2018) y cómo pagar por Bre-B, con el QR
  del banco y la llave. Siempre negro sobre blanco: es papel, no depende del tema.
  No es un recibo ni una factura: así lo dice al final, para que nadie la presente como pago.
  ⚠️ Pendiente de validar con un contador: el contenido y las leyendas.
-->
<script setup>
const props = defineProps({
  /** Pedido completo (forma del API), con su total y su propina sugerida. */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Negocio de GET /negocios/actual: sus datos y el cobro por Bre-B. */
  negocio: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Cuándo se imprimió (ISO). */
  fecha: { type: String, required: true },
  /** Ancho del papel en milímetros: "80" o "58". */
  ancho: { type: String, default: '80' },
});

/** Nombre del impuesto según el régimen del negocio. */
const NOMBRES_IMPUESTO = Object.freeze({
  responsable_inc: 'Impoconsumo (INC)',
  franquicia_iva: 'IVA',
});

const lineas = computed(() => lineasDelRecibo(props.pedido));
const tipo = computed(() => tipoDelPedido(props.pedido));
const valorDomicilio = computed(() => aDecimal(props.pedido.valorDomicilio ?? 0));
const tieneImpuestos = computed(() => !aDecimal(props.pedido.impuestos ?? 0).isZero());
const nombreImpuesto = computed(
  () =>
    NOMBRES_IMPUESTO[
      /** @type {keyof typeof NOMBRES_IMPUESTO} */ (props.negocio.regimenImpuesto)
    ] ?? 'Impuesto',
);
// La propina sugerida la calcula el API (solo en pedidos de mesa). Aquí solo se suma para
// mostrar el total con propina; lo que se cobre lo valida el API al cobrar.
const propinaSugerida = computed(() => aDecimal(props.pedido.propinaSugerida ?? 0));
const totalConPropina = computed(() => aDecimal(props.pedido.total).plus(propinaSugerida.value));
const conBreB = computed(() => tieneCobroBreB(props.negocio));
</script>

<template>
  <!-- Área imprimible: 72 mm en papel de 80 mm y 48 mm en papel de 58 mm. -->
  <article
    class="space-y-2 bg-white p-[3mm] font-mono leading-snug text-black"
    :class="ancho === '58' ? 'w-[54mm] text-[10px]' : 'w-[78mm] text-[12px]'"
  >
    <header class="space-y-0.5 text-center">
      <p class="text-[1.25em] font-bold uppercase">{{ negocio.nombre }}</p>
      <p>NIT {{ negocio.nit }}</p>
      <p v-if="negocio.direccion">{{ negocio.direccion }}</p>
      <p v-if="negocio.ciudad">{{ negocio.ciudad }}</p>
      <p v-if="negocio.telefono">Tel. {{ negocio.telefono }}</p>
    </header>

    <section class="space-y-0.5 border-t border-dashed border-black pt-2">
      <p class="text-center text-[1.2em] font-bold">PRECUENTA</p>
      <p>Fecha: {{ formatearFechaYHora(fecha) }}</p>
      <p>
        Pedido: {{ nombreDelPedido(pedido) }}
        <template v-if="tipo !== 'mesa'">({{ TIPOS_PEDIDO[tipo].etiqueta }})</template>
      </p>
    </section>

    <section class="space-y-1 border-t border-dashed border-black pt-2">
      <div v-for="linea in lineas" :key="linea.id">
        <p class="flex justify-between gap-2">
          <span>{{ formatearCantidad(linea.cantidad) }} x {{ linea.nombre }}</span>
          <span class="shrink-0">{{ formatearPesos(linea.valor) }}</span>
        </p>
        <p v-if="linea.opciones" class="ps-3">{{ linea.opciones }}</p>
        <p v-if="linea.notas" class="ps-3">{{ linea.notas }}</p>
      </div>
      <p v-if="valorDomicilio.greaterThan(0)" class="flex justify-between gap-2">
        <span>Domicilio</span>
        <span class="shrink-0">{{ formatearPesos(valorDomicilio) }}</span>
      </p>
    </section>

    <section class="space-y-0.5 border-t border-dashed border-black pt-2">
      <template v-if="tieneImpuestos">
        <p class="flex justify-between gap-2">
          <span>Base</span>
          <span>{{ formatearPesos(pedido.subtotal, { conCentavos: true }) }}</span>
        </p>
        <p class="flex justify-between gap-2">
          <span>{{ nombreImpuesto }}</span>
          <span>{{ formatearPesos(pedido.impuestos, { conCentavos: true }) }}</span>
        </p>
      </template>
      <p class="flex justify-between gap-2 text-[1.2em] font-bold">
        <span>TOTAL</span>
        <span>{{ formatearPesos(pedido.total) }}</span>
      </p>
      <template v-if="propinaSugerida.greaterThan(0)">
        <p class="flex justify-between gap-2">
          <span>
            Propina sugerida
            <template v-if="negocio.propinaSugerida">
              ({{ formatearPorcentaje(negocio.propinaSugerida) }})
            </template>
          </span>
          <span>{{ formatearPesos(propinaSugerida) }}</span>
        </p>
        <p class="flex justify-between gap-2 font-bold">
          <span>Total con propina</span>
          <span>{{ formatearPesos(totalConPropina) }}</span>
        </p>
        <p class="pt-1 text-center">
          La propina es voluntaria: puedes aceptarla, cambiar el valor o no darla.
        </p>
      </template>
    </section>

    <section
      v-if="conBreB"
      class="space-y-1 border-t border-dashed border-black pt-2 text-center"
      data-bloque="bre-b"
    >
      <p class="font-bold">PAGA CON BRE-B</p>
      <CodigoQr
        v-if="negocio.qrBreB"
        :contenido="negocio.qrBreB"
        etiqueta="QR para pagar con Bre-B"
        class="mx-auto"
        :class="ancho === '58' ? 'w-[30mm]' : 'w-[36mm]'"
      />
      <p v-if="negocio.llaveBreB">
        Llave: <span class="font-bold">{{ negocio.llaveBreB }}</span>
      </p>
      <p>Desde la app de tu banco. Muestra el comprobante al pagar.</p>
    </section>

    <footer class="border-t border-dashed border-black pt-2 text-center font-bold">
      <p>Este documento no es una factura ni un recibo de pago.</p>
    </footer>
  </article>
</template>
