<!--
  Cobro con Bre-B (el dueño y el administrador de Zenda): la llave del negocio y el QR de cobro
  que le dio su banco. Salen en la precuenta y en el cobro por transferencia, para que el
  cliente pague desde la app de su banco.
  - El QR se sube como foto o captura. Zenda lee el código en el navegador y guarda solo su
    contenido; después lo dibuja nítido en pantalla y en papel. La imagen no sale del equipo.
  - Cada cambio queda en la auditoría: es por donde entra la plata de las transferencias.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Negocio de GET /negocios/actual. */
  negocio: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});
const emit = defineEmits({
  /** @param {any} _negocio */
  guardado: (_negocio) => true,
});

const toast = useToast();

const esquema = z.object({
  llave: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .refine(
        esLlaveValida,
        'Escribe una llave válida: celular, correo, documento sin puntos, @llave o código de comercio',
      ),
  ]),
});
const datos = reactive({
  llave: props.negocio.llaveBreB ?? '',
  /** Contenido del QR (no la imagen). Vacío si no hay. */
  qr: props.negocio.qrBreB ?? '',
});

const llaveNormalizada = computed(() => normalizarLlave(datos.llave));
const tipo = computed(() => (datos.llave.trim() ? tipoDeLlave(llaveNormalizada.value) : null));
const huboCambios = computed(
  () =>
    (llaveNormalizada.value || null) !== (props.negocio.llaveBreB ?? null) ||
    (datos.qr || null) !== (props.negocio.qrBreB ?? null),
);

// ───── Subir el QR del banco ─────
const selectorDeArchivo = useTemplateRef('selectorDeArchivo');
const leyendo = ref(false);
const errorDelQr = ref('');

/** @param {Event} evento */
async function leerArchivo(evento) {
  const entrada = /** @type {HTMLInputElement} */ (evento.target);
  const archivo = entrada.files?.[0];
  // Se limpia para poder elegir otra vez el mismo archivo si hace falta.
  entrada.value = '';
  if (!archivo) return;
  leyendo.value = true;
  errorDelQr.value = '';
  try {
    const contenido = await leerQrDeImagen(archivo);
    if (!contenido) {
      errorDelQr.value =
        'No encontramos un QR en esa imagen. Prueba con una captura donde se vea completo y nítido.';
    } else if (contenido.length > 512) {
      errorDelQr.value = 'Ese QR es demasiado largo para ser un QR de cobro.';
    } else {
      datos.qr = contenido;
    }
  } catch {
    errorDelQr.value = 'No pudimos abrir esa imagen. Prueba con una foto o captura en JPG o PNG.';
  } finally {
    leyendo.value = false;
  }
}

async function guardar() {
  try {
    const negocio = await useApi().patch('/negocios/actual', {
      llaveBreB: llaveNormalizada.value || null,
      qrBreB: datos.qr || null,
    });
    datos.llave = negocio.llaveBreB ?? '';
    toast.add({
      title: 'Cobro con Bre-B guardado',
      icon: 'i-lucide-circle-check',
      color: 'success',
    });
    emit('guardado', negocio);
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">Cobro con Bre-B</h2>
      <p class="text-sm text-muted">
        Tus clientes te pagan desde la app de cualquier banco. La llave y el QR salen en la
        precuenta y al cobrar por transferencia.
      </p>
    </div>

    <UForm :schema="esquema" :state="datos" class="space-y-5" @submit="guardar">
      <UFormField
        label="Llave Bre-B"
        name="llave"
        hint="Opcional"
        help="La que registraste en tu banco: celular, correo, documento, @llave o código de comercio."
      >
        <UInput
          v-model="datos.llave"
          size="lg"
          class="w-full"
          icon="i-lucide-key-round"
          placeholder="@turestaurante"
          autocomplete="off"
          :ui="{ trailing: 'pe-2' }"
        >
          <template v-if="tipo" #trailing>
            <UBadge color="primary" variant="subtle" :label="tipo.etiqueta" />
          </template>
        </UInput>
      </UFormField>

      <div class="space-y-2">
        <p class="text-sm font-medium text-default">QR de cobro de tu banco</p>
        <input
          ref="selectorDeArchivo"
          type="file"
          accept="image/*"
          class="sr-only"
          aria-label="Imagen del QR de tu banco"
          @change="leerArchivo"
        />

        <div
          v-if="datos.qr"
          class="flex flex-col items-center gap-4 rounded-xl bg-elevated/50 p-4 ring-1 ring-default sm:flex-row"
        >
          <CodigoQr
            :contenido="datos.qr"
            etiqueta="QR de cobro del negocio"
            class="w-36 shrink-0 rounded-lg"
          />
          <div class="space-y-3 text-center sm:text-start">
            <p class="text-sm text-toned">
              Así lo verán tus clientes. Escanéalo con la app de tu banco para comprobar que te
              lleva a tu cuenta.
            </p>
            <UAlert
              v-if="!pareceQrDePago(datos.qr)"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Este QR no parece de cobro"
              description="Revisa que sea el que te dio tu banco para recibir pagos."
            />
            <div class="flex flex-wrap justify-center gap-2 sm:justify-start">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-image-up"
                label="Cambiar"
                :loading="leyendo"
                @click="selectorDeArchivo?.click()"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                label="Quitar"
                @click="datos.qr = ''"
              />
            </div>
          </div>
        </div>

        <button
          v-else
          type="button"
          class="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-default px-4 py-6 text-center transition hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
          :disabled="leyendo"
          @click="selectorDeArchivo?.click()"
        >
          <UIcon
            :name="leyendo ? 'i-lucide-loader-circle' : 'i-lucide-qr-code'"
            class="size-10 text-primary"
            :class="leyendo && 'animate-spin'"
          />
          <span class="font-semibold text-highlighted">
            {{ leyendo ? 'Leyendo el QR…' : 'Subir el QR de mi banco' }}
          </span>
          <span class="text-sm text-muted">
            Una foto o captura donde se vea completo. Lo encuentras en la app de tu banco, en Bre-B
            o en «Cobrar con QR».
          </span>
        </button>

        <p v-if="errorDelQr" class="text-sm font-medium text-error" role="alert">
          {{ errorDelQr }}
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="flex items-center gap-1.5 text-xs text-muted">
          <UIcon name="i-lucide-shield-check" class="size-4" />
          Cada cambio queda en la auditoría.
        </p>
        <UButton
          type="submit"
          size="lg"
          icon="i-lucide-check"
          label="Guardar"
          loading-auto
          :disabled="!huboCambios || leyendo"
        />
      </div>
    </UForm>
  </section>
</template>
