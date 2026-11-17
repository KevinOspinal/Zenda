<!--
  Ficha de un cliente, en la vista rápida (tablet horizontal y PC) y en la hoja de abajo del
  celular:
  1. Factura electrónica: a qué correo le llega o, si no tiene, el aviso de que no le llegará
     con el botón para agregarlo.
  2. Contacto: el correo (copiar y escribir) y el teléfono (llamar y WhatsApp).
  3. Documento: el tipo y el número con puntos, para copiarlo.
  Editar lo hace quien la muestra (evento `editar`).
-->
<script setup>
/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

const props = defineProps({
  cliente: { type: /** @type {import('vue').PropType<Cliente>} */ (Object), required: true },
});

const emit = defineEmits({ editar: () => true });

const tipo = computed(() => TIPOS_DE_DOCUMENTO[props.cliente.tipoDocumento]);
const documento = computed(() =>
  formatearDocumento(props.cliente.tipoDocumento, props.cliente.numeroDocumento),
);
const llamar = computed(() => enlaceParaLlamar(props.cliente.telefono));
const whatsApp = computed(() => enlaceDeWhatsApp(props.cliente.telefono));

// Qué se copió hace un momento (para marcar ese botón con un chulo).
const {
  copy,
  copied,
  isSupported: puedeCopiar,
} = useClipboard({ legacy: true, copiedDuring: 2000 });
const copiado = ref(/** @type {'correo' | 'documento' | null} */ (null));
/**
 * @param {'correo' | 'documento'} que
 * @param {string} texto
 */
function copiar(que, texto) {
  copiado.value = que;
  copy(texto);
}
/** @param {'correo' | 'documento'} que */
const recienCopiado = (que) => copied.value && copiado.value === que;
</script>

<template>
  <div class="space-y-5">
    <!-- 1. Factura electrónica -->
    <div
      v-if="cliente.email"
      class="flex items-start gap-3 rounded-xl bg-success/5 p-3 ring-1 ring-success/20"
    >
      <UIcon name="i-lucide-mail-check" class="mt-0.5 size-5 shrink-0 text-success" />
      <!-- El correo va en su propia línea, entero o con «…»: nunca partido a la mitad. -->
      <div class="min-w-0 flex-1 text-sm">
        <p class="text-toned">La factura electrónica le llega a</p>
        <p class="truncate font-semibold text-highlighted" :title="cliente.email">
          {{ cliente.email }}
        </p>
      </div>
    </div>
    <UAlert
      v-else
      color="warning"
      variant="subtle"
      icon="i-lucide-mail-x"
      title="Sin correo: la factura electrónica no le llegará"
      description="Pídele su correo la próxima vez que pida factura."
      :actions="[
        {
          label: 'Agregar correo',
          icon: 'i-lucide-plus',
          color: 'warning',
          variant: 'soft',
          onClick: () => emit('editar'),
        },
      ]"
    />

    <!-- 2. Contacto -->
    <section class="space-y-2">
      <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Contacto</h3>
      <!-- @container: en la ficha angosta, WhatsApp queda solo con su ícono. -->
      <dl class="@container divide-y divide-default rounded-xl ring-1 ring-default">
        <div class="flex items-center gap-3 px-3 py-2">
          <dt class="sr-only">Correo</dt>
          <UIcon name="i-lucide-mail" class="size-4 shrink-0 text-muted" />
          <dd
            class="min-w-0 flex-1 truncate text-sm"
            :class="cliente.email ? 'text-highlighted' : 'text-dimmed'"
            :title="cliente.email ?? undefined"
          >
            {{ cliente.email ?? 'Sin correo' }}
          </dd>
          <template v-if="cliente.email">
            <UButton
              v-if="puedeCopiar"
              color="neutral"
              variant="ghost"
              square
              :aria-label="recienCopiado('correo') ? 'Correo copiado' : 'Copiar el correo'"
              @click="copiar('correo', cliente.email)"
            >
              <UIcon
                :key="String(recienCopiado('correo'))"
                :name="recienCopiado('correo') ? 'i-lucide-check' : 'i-lucide-copy'"
                class="size-4"
                :class="recienCopiado('correo') && 'text-success motion-safe:animate-marcar'"
              />
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              square
              icon="i-lucide-send"
              :to="`mailto:${cliente.email}`"
              :aria-label="`Escribirle a ${cliente.email}`"
            />
          </template>
        </div>
        <div class="flex items-center gap-3 px-3 py-2">
          <dt class="sr-only">Teléfono</dt>
          <UIcon name="i-lucide-phone" class="size-4 shrink-0 text-muted" />
          <dd
            class="cifra min-w-0 flex-1 truncate text-sm"
            :class="cliente.telefono ? 'text-highlighted' : 'text-dimmed'"
          >
            {{ cliente.telefono ? formatearTelefono(cliente.telefono) : 'Sin teléfono' }}
          </dd>
          <UButton
            v-if="whatsApp"
            color="success"
            variant="soft"
            size="sm"
            icon="i-lucide-message-circle"
            :to="whatsApp"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Escribirle por WhatsApp a ${cliente.nombre}`"
          >
            <span class="hidden @[20rem]:inline">WhatsApp</span>
          </UButton>
          <UButton
            v-if="llamar"
            color="neutral"
            variant="ghost"
            square
            icon="i-lucide-phone-call"
            :to="llamar"
            :aria-label="`Llamar a ${cliente.nombre}`"
          />
          <UButton
            v-if="!cliente.telefono"
            color="neutral"
            variant="link"
            size="sm"
            label="Agregar"
            @click="emit('editar')"
          />
        </div>
      </dl>
    </section>

    <!-- 3. Documento -->
    <section class="space-y-2">
      <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Documento</h3>
      <div class="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-default">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated text-toned">
          <UIcon :name="tipo.icono" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs text-muted">{{ tipo.nombre }}</p>
          <p class="cifra truncate font-semibold tracking-wide text-highlighted">
            {{ documento }}
          </p>
        </div>
        <UButton
          v-if="puedeCopiar"
          color="neutral"
          variant="ghost"
          square
          :aria-label="recienCopiado('documento') ? 'Documento copiado' : 'Copiar el documento'"
          @click="copiar('documento', cliente.numeroDocumento)"
        >
          <UIcon
            :key="String(recienCopiado('documento'))"
            :name="recienCopiado('documento') ? 'i-lucide-check' : 'i-lucide-copy'"
            class="size-4"
            :class="recienCopiado('documento') && 'text-success motion-safe:animate-marcar'"
          />
        </UButton>
      </div>
    </section>
  </div>
</template>
