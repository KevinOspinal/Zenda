<!--
  Navegación inferior para el celular, al alcance del pulgar.
  Muestra hasta 5 secciones; si el rol tiene más, las primeras 4 y un botón "Más" que abre
  el resto en un panel desde abajo.
-->
<script setup>
/** @typedef {import('~/utils/roles.js').Seccion} Seccion */

const props = defineProps({
  secciones: { type: /** @type {import('vue').PropType<Seccion[]>} */ (Array), required: true },
});

/** Más de 5 botones ya no caben cómodos en un celular. */
const MAXIMO_VISIBLES = 5;

const hayMas = computed(() => props.secciones.length > MAXIMO_VISIBLES);
const visibles = computed(() =>
  hayMas.value ? props.secciones.slice(0, MAXIMO_VISIBLES - 1) : props.secciones,
);
const enMas = computed(() => (hayMas.value ? props.secciones.slice(MAXIMO_VISIBLES - 1) : []));

const masAbierto = ref(false);
const ruta = useRoute();
/** "Más" se marca cuando la pantalla actual es una de las secciones que guarda. */
const masActivo = computed(() => enMas.value.some((s) => ruta.path.startsWith(s.ruta)));
</script>

<template>
  <nav
    aria-label="Navegación principal"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-default/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
  >
    <ul
      class="mx-auto grid max-w-lg"
      :style="{
        gridTemplateColumns: `repeat(${visibles.length + (hayMas ? 1 : 0)}, minmax(0, 1fr))`,
      }"
    >
      <li v-for="seccion in visibles" :key="seccion.id">
        <NuxtLink v-slot="{ href, navigate, isActive }" :to="seccion.ruta" custom>
          <a
            :href="href"
            class="flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors"
            :class="isActive ? 'text-primary' : 'text-muted hover:text-default'"
            :aria-current="isActive ? 'page' : undefined"
            @click="navigate"
          >
            <span
              class="grid h-8 w-14 place-items-center rounded-full transition-colors"
              :class="isActive && 'bg-primary/10'"
            >
              <UIcon :name="seccion.icono" class="size-6" />
            </span>
            {{ seccion.etiqueta }}
          </a>
        </NuxtLink>
      </li>

      <li v-if="hayMas">
        <button
          type="button"
          class="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors"
          :class="masActivo ? 'text-primary' : 'text-muted hover:text-default'"
          @click="masAbierto = true"
        >
          <span
            class="grid h-8 w-14 place-items-center rounded-full transition-colors"
            :class="masActivo && 'bg-primary/10'"
          >
            <UIcon name="i-lucide-layout-grid" class="size-6" />
          </span>
          Más
        </button>
      </li>
    </ul>

    <UDrawer v-model:open="masAbierto" title="Más secciones">
      <template #body>
        <ul class="grid grid-cols-3 gap-3">
          <li v-for="seccion in enMas" :key="seccion.id">
            <NuxtLink v-slot="{ href, navigate, isActive }" :to="seccion.ruta" custom>
              <a
                :href="href"
                class="flex flex-col items-center gap-2 rounded-xl p-4 text-center text-sm font-medium ring-1 transition"
                :class="
                  isActive ? 'bg-primary/10 text-primary ring-primary' : 'text-toned ring-default'
                "
                :aria-current="isActive ? 'page' : undefined"
                @click="
                  (evento) => {
                    navigate(evento);
                    masAbierto = false;
                  }
                "
              >
                <UIcon :name="seccion.icono" class="size-7" />
                {{ seccion.etiqueta }}
              </a>
            </NuxtLink>
          </li>
        </ul>
      </template>
    </UDrawer>
  </nav>
</template>
