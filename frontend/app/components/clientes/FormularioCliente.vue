<!--
  Formulario para registrar o editar un cliente (a cuyo nombre se factura). Solo se piden los
  datos necesarios para la factura (Ley 1581 de 2012). Las reglas copian las del backend.

  - El tipo de documento se elige con botones de ícono (cédula, NIT, cédula de extranjería,
    pasaporte u otro).
  - El número se puede escribir con puntos o espacios: se quitan al guardar, y abajo se ve
    cómo quedará ("CC 1.234.567.890").
  - Si ese documento ya está registrado, lo avisa mientras se escribe y ofrece ir a ese
    cliente (evento `existente`): el backend no deja repetirlo.
  - Sin correo, recuerda que la factura electrónica no le llegará.
  Lo usan la pantalla de clientes y la caja (SelectorCliente).
-->
<script setup>
import { z } from 'zod';

/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

const props = defineProps({
  /** Cliente a editar. Sin él, se registra uno nuevo. */
  cliente: { type: /** @type {import('vue').PropType<Cliente | null>} */ (Object), default: null },
  /** Datos con los que empieza un cliente nuevo (por ejemplo, lo que se buscó). */
  inicial: {
    type: /** @type {import('vue').PropType<{ nombre?: string, numeroDocumento?: string } | null>} */ (
      Object
    ),
    default: null,
  },
  /** Texto del botón para ir al cliente que ya tiene ese documento. */
  textoExistente: { type: String, default: 'Ver su ficha' },
  /**
   * Botones pegados abajo mientras se baja: para la ficha al lado de la lista y la hoja del
   * celular, donde el formulario se desplaza solo.
   */
  botonesFijos: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {Cliente} _cliente */
  guardado: (_cliente) => true,
  cancelar: () => true,
  /** @param {Cliente} _cliente El que ya tiene ese documento. */
  existente: (_cliente) => true,
});

const clientes = useClientesStore();

/** Los botones del tipo de documento, como los recibe URadioGroup. */
const TIPOS = ORDEN_TIPOS_DE_DOCUMENTO.map((tipo) => ({
  value: tipo,
  label: tipo === 'otro' ? 'Otro' : TIPOS_DE_DOCUMENTO[tipo].sigla,
  icon: TIPOS_DE_DOCUMENTO[tipo].icono,
}));

const esquema = z
  .object({
    tipoDocumento: z.enum(ORDEN_TIPOS_DE_DOCUMENTO),
    numeroDocumento: z
      .string()
      .transform(limpiarNumeroDeDocumento)
      .pipe(
        z
          .string()
          .regex(/^[A-Za-z0-9]{3,20}$/, 'De 3 a 20 letras o números, sin guiones ni símbolos'),
      ),
    nombre: z.string().trim().min(1, 'Escribe el nombre').max(120),
    email: z.union([
      z.literal(''),
      z.string().trim().toLowerCase().pipe(z.email('Revisa el correo: falta algo')),
    ]),
    telefono: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(/^\+?[0-9 ]{7,20}$/, 'Solo números (de 7 a 20), con + al inicio si es de otro país'),
    ]),
  })
  .refine(
    (datos) =>
      !TIPOS_DE_DOCUMENTO[datos.tipoDocumento].numerico || /^\d+$/.test(datos.numeroDocumento),
    { path: ['numeroDocumento'], message: 'La cédula y el NIT solo llevan números' },
  );

const datos = reactive({
  tipoDocumento: props.cliente?.tipoDocumento ?? 'cc',
  numeroDocumento: props.cliente?.numeroDocumento ?? props.inicial?.numeroDocumento ?? '',
  nombre: props.cliente?.nombre ?? props.inicial?.nombre ?? '',
  email: props.cliente?.email ?? '',
  telefono: props.cliente?.telefono ?? '',
});
const error = ref('');

const tipo = computed(() => TIPOS_DE_DOCUMENTO[datos.tipoDocumento]);
const numeroLimpio = computed(() => limpiarNumeroDeDocumento(datos.numeroDocumento));
/** Cómo se verá el documento, mientras se escribe. */
const vistaPrevia = computed(() =>
  numeroLimpio.value.length >= 3
    ? etiquetaDeDocumento({
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: numeroLimpio.value,
      })
    : '',
);

// ── ¿Ya está registrado? Se pregunta al API mientras se escribe el número. ──
const duplicado = ref(/** @type {Cliente | null} */ (null));
watchDebounced(
  () => [datos.tipoDocumento, numeroLimpio.value],
  async ([tipoDocumento, numero]) => {
    if (numero.length < 3) {
      duplicado.value = null;
      return;
    }
    try {
      const encontrados = await clientes.buscar(numero);
      duplicado.value = clienteConDocumento(
        encontrados,
        {
          tipoDocumento: /** @type {Cliente['tipoDocumento']} */ (tipoDocumento),
          numeroDocumento: numero,
        },
        props.cliente?.id ?? null,
      );
    } catch {
      // Si no se puede revisar, el backend igual lo rechaza al guardar.
      duplicado.value = null;
    }
  },
  { debounce: 400, immediate: Boolean(props.inicial?.numeroDocumento) },
);

async function guardar() {
  error.value = '';
  // Los campos opcionales vacíos se envían como null.
  const cuerpo = {
    tipoDocumento: datos.tipoDocumento,
    numeroDocumento: numeroLimpio.value,
    nombre: datos.nombre.trim(),
    email: datos.email.trim().toLowerCase() || null,
    telefono: datos.telefono.trim() || null,
  };
  try {
    const guardado = props.cliente
      ? await clientes.actualizar(props.cliente.id, cuerpo)
      : await clientes.crear(cuerpo);
    emit('guardado', guardado);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <!-- @container: correo y teléfono van lado a lado solo si el formulario es ancho. -->
  <UForm :schema="esquema" :state="datos" class="@container space-y-5" @submit="guardar">
    <UFormField label="Tipo de documento" name="tipoDocumento" :help="tipo.nombre">
      <URadioGroup
        v-model="datos.tipoDocumento"
        :items="TIPOS"
        variant="card"
        orientation="horizontal"
        indicator="hidden"
        :ui="{
          fieldset: 'grid grid-cols-5 gap-1.5',
          item: 'min-h-16 justify-center p-2 transition-[background-color,border-color] duration-150 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/10 has-data-[state=checked]:text-primary',
          icon: 'size-5',
          label: 'text-xs font-semibold text-inherit',
        }"
      />
    </UFormField>

    <UFormField
      :label="datos.tipoDocumento === 'nit' ? 'Número de NIT' : 'Número de documento'"
      name="numeroDocumento"
      :help="
        vistaPrevia
          ? `Se verá así: ${vistaPrevia}`
          : 'Puedes escribirlo con puntos: los quitamos al guardar.'
      "
    >
      <UInput
        v-model="datos.numeroDocumento"
        size="lg"
        class="w-full"
        :icon="tipo.icono"
        :inputmode="tipo.numerico ? 'numeric' : 'text'"
        autocomplete="off"
      />
    </UFormField>

    <Transition
      enter-from-class="opacity-0 -translate-y-1"
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
    >
      <UAlert
        v-if="duplicado"
        color="warning"
        variant="subtle"
        icon="i-lucide-user-check"
        :title="`Ya está registrado: ${duplicado.nombre}`"
        :description="`${etiquetaDeDocumento(duplicado)}. No se puede registrar dos veces.`"
        :actions="[
          {
            label: textoExistente,
            color: 'warning',
            variant: 'soft',
            trailingIcon: 'i-lucide-arrow-right',
            onClick: () => duplicado && emit('existente', duplicado),
          },
        ]"
      />
    </Transition>

    <UFormField
      :label="datos.tipoDocumento === 'nit' ? 'Razón social' : 'Nombre completo'"
      name="nombre"
    >
      <UInput v-model="datos.nombre" size="lg" class="w-full" autocomplete="off" />
    </UFormField>

    <div class="grid gap-4 @md:grid-cols-2">
      <UFormField label="Correo" name="email" hint="Para la factura">
        <UInput
          v-model="datos.email"
          type="email"
          size="lg"
          class="w-full"
          icon="i-lucide-mail"
          inputmode="email"
          autocomplete="off"
        />
      </UFormField>
      <UFormField label="Teléfono" name="telefono" hint="Opcional">
        <UInput
          v-model="datos.telefono"
          type="tel"
          size="lg"
          class="w-full"
          icon="i-lucide-phone"
          inputmode="tel"
          autocomplete="off"
        />
      </UFormField>
    </div>
    <p v-if="!datos.email.trim()" class="-mt-2 flex items-start gap-1.5 text-sm text-muted">
      <UIcon name="i-lucide-mail-x" class="mt-0.5 size-4 shrink-0 text-warning" />
      Sin correo, la factura electrónica no le llegará.
    </p>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error"
      role="alert"
    />

    <!--
      Con `botones-fijos`, los botones se quedan abajo a la vista aunque el formulario sea
      largo. La sombra sólida tapa el margen interior del contenedor que se desplaza: lo de
      abajo no se asoma.
    -->
    <div
      class="flex justify-end gap-2"
      :class="
        botonesFijos &&
        'sticky bottom-0 z-10 border-t border-default bg-default pt-3 shadow-[0_1.5rem_0_0_var(--ui-bg)]'
      "
    >
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
        :icon="cliente ? 'i-lucide-check' : 'i-lucide-user-plus'"
        :label="cliente ? 'Guardar cambios' : 'Registrar cliente'"
      />
    </div>
  </UForm>
</template>
