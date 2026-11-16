<!--
  Chips para ver solo un rol, cada uno con su ícono y cuántas personas tiene («Todos» los
  muestra todos). Van en una sola línea que se desliza de lado si no caben; el borde que
  tiene más chips se desvanece, para que se note que hay más.
-->
<script setup>
defineProps({
  /** Los roles que tienen alguna cuenta, con cuántas (ver conteoPorRol). */
  roles: {
    type: /** @type {import('vue').PropType<{ rol: import('~/utils/roles.js').Rol, cantidad: number }[]>} */ (
      Array
    ),
    required: true,
  },
  /** Cuántas cuentas hay en total. */
  total: { type: Number, required: true },
});

/** Rol elegido, o null para ver todos. */
const rolElegido = defineModel({
  type: /** @type {import('vue').PropType<import('~/utils/roles.js').Rol | null>} */ (String),
  default: null,
});

// El desvanecido de cada borde se quita al llegar a ese extremo (o si todo cabe).
const fila = useTemplateRef('fila');
const { arrivedState } = useScroll(fila);
const DESVANECIDO = '2rem';
const mascara = computed(() => {
  const izquierda = arrivedState.left ? '0px' : DESVANECIDO;
  const derecha = arrivedState.right ? '0px' : DESVANECIDO;
  const degradado = `linear-gradient(to right, transparent, #000 ${izquierda}, #000 calc(100% - ${derecha}), transparent)`;
  return { maskImage: degradado, WebkitMaskImage: degradado };
});

/**
 * Elige un rol (o todos) y deja su chip completo a la vista, por si estaba a medias en el borde.
 * @param {import('~/utils/roles.js').Rol | null} rol
 * @param {MouseEvent} evento
 */
function elegir(rol, evento) {
  rolElegido.value = rol;
  const chip = /** @type {HTMLElement | null} */ (evento.currentTarget);
  chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

const CHIP =
  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:transition-none';
const ELEGIDO = 'border-primary bg-primary/10 text-primary';
const NORMAL = 'border-default bg-default text-toned hover:bg-elevated';
</script>

<template>
  <div
    ref="fila"
    role="group"
    aria-label="Ver un rol"
    class="-mx-1 flex gap-2 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    :style="mascara"
  >
    <button
      type="button"
      :class="[CHIP, rolElegido === null ? ELEGIDO : NORMAL]"
      :aria-pressed="rolElegido === null"
      @click="elegir(null, $event)"
    >
      <UIcon name="i-lucide-users" class="size-4" />
      Todos
      <span class="cifra rounded-full bg-elevated px-1.5 text-xs text-muted">{{ total }}</span>
    </button>
    <button
      v-for="{ rol, cantidad } in roles"
      :key="rol"
      type="button"
      :class="[CHIP, rolElegido === rol ? ELEGIDO : NORMAL]"
      :aria-pressed="rolElegido === rol"
      @click="elegir(rolElegido === rol ? null : rol, $event)"
    >
      <UIcon :name="ROLES[rol].icono" class="size-4" />
      {{ ROLES[rol].etiqueta }}
      <span class="cifra rounded-full bg-elevated px-1.5 text-xs text-muted">{{ cantidad }}</span>
    </button>
  </div>
</template>
