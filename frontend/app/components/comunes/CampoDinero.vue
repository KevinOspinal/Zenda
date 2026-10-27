<!--
  Campo para escribir dinero en pesos, con el teclado numérico del celular.
  Sigue la costumbre colombiana: el punto separa miles ("50.000" son cincuenta mil) y la
  coma separa los centavos. Muestra el valor formateado mientras se escribe y entrega el
  texto que acepta el API ("50000" o "50000.50").
-->
<script setup>
const props = defineProps({
  placeholder: { type: String, default: '0' },
  size: {
    type: /** @type {import('vue').PropType<'md' | 'lg' | 'xl'>} */ (String),
    default: 'xl',
  },
  autofocus: { type: Boolean, default: false },
  /** Nombre accesible si el campo no está dentro de un UFormField con etiqueta. */
  etiqueta: { type: String, default: '' },
});

const valor = defineModel({ type: String, default: '' });

/**
 * Limpia lo escrito: quita los puntos de miles y cualquier letra, y usa la coma como
 * separador decimal (máximo 2 centavos).
 * @param {string | number} texto
 */
function alEscribir(texto) {
  const limpio = String(texto)
    .replace(/\./g, '')
    .replace(/[^\d,]/g, '');
  const [entero = '', ...decimales] = limpio.split(',');
  valor.value = decimales.length ? `${entero}.${decimales.join('').slice(0, 2)}` : entero;
}

/** Lo que se ve en el campo: el valor con coma decimal, como se escribe en Colombia. */
const visible = computed(() => valor.value.replace('.', ','));
const formateado = computed(() =>
  valor.value && esMontoValido(valor.value) ? formatearPesos(valor.value) : '',
);
</script>

<template>
  <UInput
    :model-value="visible"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :size="props.size"
    :placeholder="placeholder"
    :autofocus="autofocus"
    :aria-label="etiqueta || undefined"
    class="w-full"
    :ui="{ base: 'cifra text-lg font-semibold' }"
    @update:model-value="alEscribir"
  >
    <template #leading>
      <span class="font-semibold text-muted">$</span>
    </template>
    <template #trailing>
      <span class="cifra text-sm text-muted">{{ formateado }}</span>
    </template>
  </UInput>
</template>
