<!--
  Un texto con lo que coincide con la búsqueda resaltado (sin importar tildes ni mayúsculas),
  para ver de un vistazo por qué apareció cada resultado. Sin búsqueda, es el texto tal cual.
  También recibe los trozos ya calculados (`partes`), por ejemplo los de un documento con
  puntos (ver partesDelDocumento).
-->
<script setup>
const props = defineProps({
  texto: { type: String, default: '' },
  busqueda: { type: String, default: '' },
  /** Trozos ya marcados; si se pasan, no se usan `texto` ni `busqueda`. */
  partes: {
    type: /** @type {import('vue').PropType<{ texto: string, coincide: boolean }[] | null>} */ (
      Array
    ),
    default: null,
  },
});

const trozos = computed(() => props.partes ?? partesResaltadas(props.texto, props.busqueda));
</script>

<template>
  <span
    ><template v-for="(parte, indice) in trozos" :key="indice"
      ><mark
        v-if="parte.coincide"
        class="rounded-[3px] bg-primary/15 text-inherit ring-1 ring-primary/15 dark:bg-primary/25"
        >{{ parte.texto }}</mark
      ><template v-else>{{ parte.texto }}</template></template
    ></span
  >
</template>
