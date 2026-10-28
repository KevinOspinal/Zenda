<!--
  Crear o editar un producto del menú: categoría, nombre, descripción, precio (con el
  impuesto incluido), impuesto según el régimen del negocio, si controla inventario y si
  está activo. Las reglas copian las del backend; un cambio de precio queda en la auditoría.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Producto a editar; sin él, se crea uno nuevo. */
  producto: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
  categorias: {
    type: /** @type {import('vue').PropType<{ id: string, nombre: string }[]>} */ (Array),
    required: true,
  },
  /** Categoría propuesta para un producto nuevo. */
  categoriaInicial: { type: String, default: '' },
});

const emit = defineEmits({
  /** @param {any} _producto */
  guardado: (_producto) => true,
  cancelar: () => true,
});

const sesion = useSesionStore();
const permitidos = computed(() => impuestosPermitidos(sesion.negocio?.regimenImpuesto));

const esquema = z.object({
  categoriaId: z.string().min(1, 'Elige la categoría'),
  nombre: z.string().trim().min(1, 'Escribe el nombre').max(80),
  descripcion: z.string().trim().max(300),
  precio: z.string().refine((valor) => esMontoValido(valor), 'Escribe el precio en pesos'),
  tipoImpuesto: z.enum(['impoconsumo', 'iva', 'exento']),
  controlaStock: z.boolean(),
  activo: z.boolean(),
});

const datos = reactive({
  categoriaId: props.producto?.categoriaId ?? props.categoriaInicial ?? '',
  nombre: props.producto?.nombre ?? '',
  descripcion: props.producto?.descripcion ?? '',
  precio: props.producto ? montoComoTexto(props.producto.precio) : '',
  tipoImpuesto: props.producto?.tipoImpuesto ?? permitidos.value[0],
  controlaStock: props.producto?.controlaStock ?? false,
  activo: props.producto?.activo ?? true,
});
const error = ref('');

const opcionesCategoria = computed(() =>
  props.categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre })),
);
const opcionesImpuesto = computed(() =>
  permitidos.value.map((tipo) => ({
    value: tipo,
    label: TIPOS_IMPUESTO[tipo].etiqueta,
    description: TIPOS_IMPUESTO[tipo].descripcion,
  })),
);
const cambiaPrecio = computed(
  () =>
    props.producto &&
    esMontoValido(datos.precio) &&
    !aDecimal(datos.precio).equals(props.producto.precio),
);

async function guardar() {
  error.value = '';
  const cuerpo = { ...datos, descripcion: datos.descripcion.trim() || null };
  try {
    const guardado = props.producto
      ? await useApi().patch(`/productos/${props.producto.id}`, cuerpo)
      : await useApi().post('/productos', cuerpo);
    emit('guardado', guardado);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
    <UFormField label="Categoría" name="categoriaId">
      <USelect v-model="datos.categoriaId" :items="opcionesCategoria" size="lg" class="w-full" />
    </UFormField>
    <UFormField label="Nombre" name="nombre">
      <UInput v-model="datos.nombre" size="lg" class="w-full" placeholder="IND Classic Artesanal" />
    </UFormField>
    <UFormField label="Descripción" name="descripcion" hint="Opcional">
      <UTextarea
        v-model="datos.descripcion"
        :rows="2"
        autoresize
        class="w-full"
        placeholder="Carne artesanal, queso y vegetales"
      />
    </UFormField>
    <UFormField
      label="Precio"
      name="precio"
      help="El que paga el cliente, con el impuesto incluido."
    >
      <CampoDinero v-model="datos.precio" etiqueta="Precio" />
    </UFormField>
    <UAlert
      v-if="cambiaPrecio"
      color="info"
      variant="subtle"
      icon="i-lucide-tag"
      title="El cambio de precio queda registrado en la auditoría"
      description="Los pedidos ya tomados conservan el precio con el que se vendieron."
    />
    <UFormField v-if="permitidos.length > 1" label="Impuesto" name="tipoImpuesto">
      <URadioGroup v-model="datos.tipoImpuesto" :items="opcionesImpuesto" variant="card" />
    </UFormField>
    <!-- Un negocio sin factura electrónica no cobra impuestos: no hay nada que elegir. -->
    <p v-else class="flex items-start gap-2 rounded-lg bg-elevated p-3 text-sm text-muted">
      <UIcon name="i-lucide-receipt-text" class="mt-0.5 size-4 shrink-0" />
      Sin impuesto: el negocio no factura electrónicamente (no es responsable de IVA ni del impuesto
      al consumo).
    </p>
    <USwitch
      v-model="datos.controlaStock"
      size="lg"
      label="Controla inventario"
      description="Cada venta descuenta una unidad (por ejemplo, bebidas embotelladas)."
    />
    <USwitch
      v-model="datos.activo"
      size="lg"
      label="Disponible en el menú"
      description="Si lo apagas, no aparece para tomar pedidos."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error"
      role="alert"
    />

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        label="Cancelar"
        @click="emit('cancelar')"
      />
      <UButton
        type="submit"
        size="lg"
        loading-auto
        icon="i-lucide-check"
        :label="producto ? 'Guardar cambios' : 'Crear producto'"
      />
    </div>
  </UForm>
</template>
