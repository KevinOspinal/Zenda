<!--
  Crear, editar o eliminar un grupo de opciones (término, adiciones, quitar ingredientes):
  su nombre, cuántas opciones puede elegir el cliente y la lista de opciones con su precio
  extra. Las reglas copian las del backend; los cambios de precio quedan en la auditoría y
  las ventas pasadas conservan lo que se vendió.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Grupo a editar (como lo entrega GET /grupos-opciones); sin él, se crea uno nuevo. */
  grupo: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
  /** Plantilla para empezar un grupo nuevo (ver PLANTILLAS_DE_GRUPO). */
  plantilla: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
  /** Orden para un grupo nuevo (al final de la lista). */
  ordenNuevo: { type: Number, default: 0 },
});

const emit = defineEmits({
  /** @param {any} _grupo */
  guardado: (_grupo) => true,
  eliminado: () => true,
  cancelar: () => true,
});

const sesion = useSesionStore();
const permitidos = computed(() => impuestosPermitidos(sesion.negocio?.regimenImpuesto));

let ultimaClave = 0;
/**
 * Opción lista para el formulario. La clave identifica la fila aunque la opción sea nueva.
 * @param {{ id?: string, nombre?: string, precioExtra?: string, tipoImpuesto?: string, activo?: boolean }} [opcion]
 */
function filaDeOpcion(opcion = {}) {
  ultimaClave += 1;
  return {
    clave: ultimaClave,
    id: opcion.id,
    nombre: opcion.nombre ?? '',
    precioExtra:
      opcion.precioExtra && !aDecimal(opcion.precioExtra).isZero()
        ? montoComoTexto(opcion.precioExtra)
        : '',
    // Por defecto, el impuesto del régimen del negocio (como los productos).
    tipoImpuesto: opcion.tipoImpuesto ?? permitidos.value[0],
    activo: opcion.activo ?? true,
  };
}

const base = props.grupo ?? props.plantilla;
const datos = reactive({
  nombre: base?.nombre ?? '',
  forma: base ? formaDeElegir(base) : 'varias_opcionales',
  minimo: /** @type {number | undefined} */ (base?.minimo ?? 0),
  maximo: /** @type {number | null | undefined} */ (base?.maximo ?? null),
  opciones: props.grupo
    ? props.grupo.opciones.map(filaDeOpcion)
    : (props.plantilla?.opciones ?? ['']).map((/** @type {string} */ nombre) =>
        filaDeOpcion({ nombre }),
      ),
});
const error = ref('');
const confirmandoEliminar = ref(false);

// Una forma común fija el mínimo y el máximo; la personalizada deja escribirlos.
watch(
  () => datos.forma,
  (forma) => {
    const elegida = FORMAS_DE_ELEGIR.find((f) => f.value === forma);
    if (elegida?.minimo === undefined) return;
    datos.minimo = elegida.minimo;
    datos.maximo = elegida.maximo;
  },
);

const esquema = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe el nombre del grupo').max(60),
    minimo: z.number('Escribe el mínimo').int().min(0).max(MAXIMO_OPCIONES_POR_GRUPO),
    maximo: z.number().int().min(1, 'Debe ser 1 o más').max(MAXIMO_OPCIONES_POR_GRUPO).nullish(),
    opciones: z
      .array(
        z.object({
          nombre: z.string().trim().min(1, 'Escribe el nombre').max(60),
          precioExtra: z
            .string()
            .refine((valor) => valor === '' || esMontoValido(valor), 'Escribe el precio en pesos'),
          activo: z.boolean(),
        }),
      )
      .min(1, 'Agrega al menos una opción')
      .max(MAXIMO_OPCIONES_POR_GRUPO),
  })
  .superRefine((grupo, contexto) => {
    if (typeof grupo.maximo === 'number' && grupo.maximo < grupo.minimo) {
      contexto.addIssue({ code: 'custom', path: ['maximo'], message: 'Es menor que el mínimo' });
    }
    const disponibles = grupo.opciones.filter((opcion) => opcion.activo).length;
    if (grupo.minimo > disponibles) {
      contexto.addIssue({
        code: 'custom',
        path: ['opciones'],
        message: `Se deben elegir ${grupo.minimo} y solo hay ${disponibles} disponibles`,
      });
    }
    const nombres = grupo.opciones.map((opcion) => opcion.nombre.trim().toLowerCase());
    nombres.forEach((nombre, indice) => {
      if (nombre && nombres.indexOf(nombre) !== indice) {
        contexto.addIssue({
          code: 'custom',
          path: ['opciones', indice, 'nombre'],
          message: 'Ya hay otra opción con este nombre',
        });
      }
    });
  });

/** Lo que se envía al API: el grupo completo, con las opciones en su orden. */
function cuerpo() {
  return {
    nombre: datos.nombre.trim(),
    minimo: datos.minimo,
    maximo: datos.maximo ?? null,
    orden: props.grupo?.orden ?? props.ordenNuevo,
    opciones: datos.opciones.map(({ id, nombre, precioExtra, tipoImpuesto, activo }) => ({
      ...(id ? { id } : {}),
      nombre: nombre.trim(),
      precioExtra: precioExtra || '0',
      tipoImpuesto,
      activo,
    })),
  };
}

/** Avisa si alguna opción que ya existía cambia de precio (queda en la auditoría). */
const cambiaPrecio = computed(() =>
  datos.opciones.some((opcion) => {
    const antes = props.grupo?.opciones.find((/** @type {any} */ a) => a.id === opcion.id);
    const ahora = opcion.precioExtra || '0';
    return antes && esMontoValido(ahora) && !aDecimal(ahora).equals(antes.precioExtra);
  }),
);

async function guardar() {
  error.value = '';
  try {
    const guardado = props.grupo
      ? await useApi().put(`/grupos-opciones/${props.grupo.id}`, cuerpo())
      : await useApi().post('/grupos-opciones', cuerpo());
    emit('guardado', guardado);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}

// Si el grupo está en productos, se pide confirmar antes de eliminarlo.
async function eliminar() {
  if (!props.grupo) return;
  if (props.grupo.productos > 0 && !confirmandoEliminar.value) {
    confirmandoEliminar.value = true;
    return;
  }
  error.value = '';
  try {
    await useApi().eliminar(`/grupos-opciones/${props.grupo.id}`);
    emit('eliminado');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-5" @submit="guardar">
    <UFormField
      label="Nombre del grupo"
      name="nombre"
      help="Así lo verá el mesero al tomar el pedido."
    >
      <UInput v-model="datos.nombre" size="lg" class="w-full" placeholder="Término de la carne" />
    </UFormField>

    <UFormField label="¿Cuántas puede elegir el cliente?" name="forma">
      <URadioGroup v-model="datos.forma" :items="FORMAS_DE_ELEGIR" variant="card" />
    </UFormField>
    <div v-if="datos.forma === 'personalizada'" class="flex flex-wrap gap-4">
      <UFormField label="Mínimo" name="minimo" help="0 si es opcional">
        <UInputNumber
          v-model="datos.minimo"
          :min="0"
          :max="MAXIMO_OPCIONES_POR_GRUPO"
          size="lg"
          class="w-36"
        />
      </UFormField>
      <UFormField label="Máximo" name="maximo" help="Vacío si no tiene límite">
        <UInputNumber
          v-model="datos.maximo"
          :min="1"
          :max="MAXIMO_OPCIONES_POR_GRUPO"
          size="lg"
          class="w-36"
          placeholder="Sin límite"
        />
      </UFormField>
    </div>

    <UFormField
      label="Opciones"
      name="opciones"
      help="El precio extra se suma al del plato, con el impuesto incluido."
    >
      <div class="space-y-2">
        <FilaOpcion
          v-for="(opcion, indice) in datos.opciones"
          :key="opcion.clave"
          v-model="datos.opciones[indice]"
          :indice="indice"
          :permitidos="permitidos"
          :puede-quitar="datos.opciones.length > 1"
          @quitar="datos.opciones.splice(indice, 1)"
        />
        <UButton
          block
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-lucide-plus"
          label="Agregar opción"
          :disabled="datos.opciones.length >= MAXIMO_OPCIONES_POR_GRUPO"
          @click="datos.opciones.push(filaDeOpcion())"
        />
      </div>
    </UFormField>

    <UAlert
      v-if="cambiaPrecio"
      color="info"
      variant="subtle"
      icon="i-lucide-tag"
      title="El cambio de precio queda registrado en la auditoría"
      description="Los pedidos ya tomados conservan el precio con el que se vendieron."
    />
    <UAlert
      v-if="confirmandoEliminar"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Se quitará de ${grupo.productos} ${grupo.productos === 1 ? 'producto' : 'productos'}`"
      description="Las ventas pasadas no cambian. Si solo quieres pausarlo, marca sus opciones como agotadas."
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error"
      role="alert"
    />

    <div class="flex flex-wrap justify-between gap-2">
      <UButton
        v-if="grupo"
        color="error"
        :variant="confirmandoEliminar ? 'solid' : 'ghost'"
        size="lg"
        icon="i-lucide-trash-2"
        :label="confirmandoEliminar ? 'Sí, eliminar' : 'Eliminar'"
        loading-auto
        @click="eliminar"
      />
      <div class="ms-auto flex gap-2">
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
          :label="grupo ? 'Guardar cambios' : 'Crear grupo'"
        />
      </div>
    </div>
  </UForm>
</template>
