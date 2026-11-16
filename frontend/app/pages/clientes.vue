<!--
  Clientes a cuyo nombre se factura, como la agenda del celular. Solo los datos necesarios para
  la factura (Ley 1581 de 2012).

  - Arriba, el buscador (también con la tecla /): encuentra al instante por nombre, documento
    (con o sin puntos) o correo, y resalta lo que coincide. Se puede ver solo a los que no
    tienen correo (la factura electrónica no les llega).
  - La lista va en orden alfabético, por letra; con muchos clientes, un índice salta a cada
    letra.
  - Tocar un cliente abre al lado su ficha en tablet horizontal y PC (PanelCliente) y una hoja
    desde abajo en el celular: la factura, el contacto (copiar, escribir, llamar, WhatsApp) y
    el documento. «Editar» cambia la ficha por el formulario en el mismo lugar. Sin cliente
    elegido, ese lado muestra cuántos tienen correo para la factura (ResumenClientes).
  - Si lo buscado no existe, se registra con lo que se escribió (nombre o documento).
-->
<script setup>
definePageMeta({ seccion: 'clientes' });

/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const vista = useVistaDeClientes();
const { estadoCarga, errorCarga, hayMas, resaltados, busqueda, textoBuscado } = vista;
const { buscandoEnElApi, soloSinCorreo, todos, cuantosSinCorreo, visibles, grupos } = vista;
const { elegidoId, elegido, cargar, verTodos } = vista;
cargar();

// ── Ficha (al lado en PC, hoja de abajo en el celular) ──
/** ver: la ficha · editar: el formulario del elegido · nuevo: registrar uno. */
const modo = ref(/** @type {'ver' | 'editar' | 'nuevo'} */ ('ver'));
const inicial = ref(/** @type {{ nombre?: string, numeroDocumento?: string } | null} */ (null));
const hojaAbierta = ref(false);
const panelVisible = computed(() => modo.value === 'nuevo' || Boolean(elegido.value));

/** @param {Cliente} cliente */
function elegir(cliente) {
  // En PC, tocar otra vez el mismo cliente cierra la ficha.
  if (pantallaGrande.value && elegidoId.value === cliente.id && modo.value === 'ver') {
    cerrar();
    return;
  }
  elegidoId.value = cliente.id;
  modo.value = 'ver';
  if (!pantallaGrande.value) hojaAbierta.value = true;
}

/** @param {{ nombre?: string, numeroDocumento?: string } | null} [datos] */
function registrar(datos = null) {
  elegidoId.value = null;
  inicial.value = datos;
  modo.value = 'nuevo';
  if (!pantallaGrande.value) hojaAbierta.value = true;
}

/** Registrar con lo que se buscó: un número va al documento; lo demás, al nombre. */
function registrarLoBuscado() {
  const texto = textoBuscado.value;
  registrar(/^[\d.\s]+$/.test(texto) ? { numeroDocumento: texto } : { nombre: texto });
}

function cerrar() {
  elegidoId.value = null;
  modo.value = 'ver';
  hojaAbierta.value = false;
}

function cancelar() {
  if (modo.value === 'nuevo') cerrar();
  else modo.value = 'ver';
}

/** @param {Cliente} cliente */
function alGuardar(cliente) {
  const eraNuevo = modo.value === 'nuevo';
  vista.alGuardar(cliente);
  elegidoId.value = cliente.id;
  modo.value = 'ver';
  toast.add({
    title: eraNuevo ? 'Cliente registrado' : 'Cambios guardados',
    description: cliente.nombre,
    icon: 'i-lucide-circle-check',
    color: 'success',
  });
}

/**
 * El documento ya estaba registrado: se abre la ficha de ese cliente.
 * @param {Cliente} cliente
 */
function irAlExistente(cliente) {
  vista.alGuardar(cliente);
  elegidoId.value = cliente.id;
  modo.value = 'ver';
}

watch(pantallaGrande, (grande) => {
  if (grande) hojaAbierta.value = false;
  else if (panelVisible.value) hojaAbierta.value = true;
});
// Al cerrar la hoja del celular, se olvida el cliente elegido.
watch(hojaAbierta, (abierta) => {
  if (!abierta && !pantallaGrande.value) {
    elegidoId.value = null;
    modo.value = 'ver';
  }
});

// ── Teclado: / busca; Escape cierra la ficha si no se está editando ──
const buscador = useTemplateRef('buscador');
defineShortcuts({
  '/': () => buscador.value?.inputRef?.focus(),
});
onKeyStroke('Escape', () => {
  if (pantallaGrande.value && modo.value === 'ver') cerrar();
});

// ── Índice por letra (con muchos clientes) ──
const conIndice = computed(() => !textoBuscado.value && grupos.value.length >= 5);
/** @param {string} letra */
function irALetra(letra) {
  document.getElementById(`letra-${letra}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Posición de cada cliente en la lista, para la cascada de entrada. */
const posicion = computed(
  () =>
    new Map(
      grupos.value
        .flatMap((grupo) => grupo.clientes)
        .map((cliente, indice) => [cliente.id, indice]),
    ),
);
/** Retraso de la cascada: las primeras doce filas, una tras otra. */
const retraso = (/** @type {string} */ id) => `${Math.min(posicion.value.get(id) ?? 0, 11) * 25}ms`;
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted">A nombre de quién se factura: solo los datos que pide la factura.</p>
      <UButton size="lg" icon="i-lucide-user-plus" label="Nuevo cliente" @click="registrar()" />
    </div>

    <!-- Cargando: el buscador y las filas con su forma. -->
    <div v-if="estadoCarga === 'cargando' || estadoCarga === 'sin_cargar'" class="space-y-4">
      <USkeleton class="h-11 w-full rounded-lg sm:w-96" />
      <div class="space-y-px overflow-hidden rounded-2xl ring-1 ring-default">
        <USkeleton v-for="n in 6" :key="n" class="h-16 rounded-none" />
      </div>
    </div>

    <UEmpty
      v-else-if="estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los clientes"
      :description="errorCarga"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <!-- La lista a la izquierda y, en tablet horizontal y PC, la ficha a la derecha. -->
    <div v-else class="lg:relative lg:flex lg:items-start lg:gap-6">
      <div class="min-w-0 flex-1 space-y-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <UInput
            ref="buscador"
            v-model="busqueda"
            type="search"
            icon="i-lucide-search"
            size="lg"
            placeholder="Nombre, documento o correo"
            aria-label="Buscar cliente"
            aria-keyshortcuts="/"
            :loading="buscandoEnElApi"
            class="w-full sm:w-96"
          >
            <template #trailing>
              <UButton
                v-if="busqueda"
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                aria-label="Borrar la búsqueda"
                @click="busqueda = ''"
              />
              <UKbd v-else value="/" class="hidden lg:inline-flex" />
            </template>
          </UInput>
          <p class="cifra text-sm text-muted" aria-live="polite">
            {{ visibles.length }} de {{ todos.length }}
            {{ todos.length === 1 ? 'cliente' : 'clientes' }}
          </p>
          <button
            v-if="cuantosSinCorreo"
            type="button"
            class="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-[background-color,border-color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:transition-none"
            :class="
              soloSinCorreo
                ? 'border-warning bg-warning/10 text-warning'
                : 'border-default text-toned hover:bg-elevated'
            "
            :aria-pressed="soloSinCorreo"
            @click="soloSinCorreo = !soloSinCorreo"
          >
            <UIcon name="i-lucide-mail-x" class="size-4" />
            Sin correo
            <span class="cifra rounded-full bg-elevated px-1.5 text-xs text-muted">
              {{ cuantosSinCorreo }}
            </span>
          </button>
        </div>

        <p v-if="hayMas && !textoBuscado" class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-info" class="size-4 shrink-0" />
          Ves los primeros {{ todos.length }} por nombre: busca para encontrar a los demás.
        </p>

        <!-- Índice: salta a cada letra. -->
        <nav v-if="conIndice" aria-label="Ir a una letra" class="flex flex-wrap gap-1">
          <UButton
            v-for="grupo in grupos"
            :key="grupo.letra"
            color="neutral"
            variant="soft"
            size="sm"
            :label="grupo.letra"
            class="min-w-9 justify-center font-bold"
            @click="irALetra(grupo.letra)"
          />
        </nav>

        <UEmpty
          v-if="!todos.length"
          icon="i-lucide-contact"
          title="Aún no hay clientes"
          description="Registra a quien pida la factura a su nombre."
          :actions="[
            { label: 'Nuevo cliente', icon: 'i-lucide-user-plus', onClick: () => registrar() },
          ]"
        />
        <UEmpty
          v-else-if="!visibles.length"
          icon="i-lucide-search-x"
          :title="textoBuscado ? `No encontramos «${textoBuscado}»` : 'Nadie por aquí'"
          :description="
            buscandoEnElApi
              ? 'Buscando entre todos los clientes…'
              : 'Revisa cómo lo escribiste o regístralo ahora.'
          "
          :actions="[
            textoBuscado
              ? {
                  label: `Registrar a «${textoBuscado}»`,
                  icon: 'i-lucide-user-plus',
                  onClick: registrarLoBuscado,
                }
              : { label: 'Ver todos', icon: 'i-lucide-users', onClick: verTodos },
          ]"
        />

        <!-- overflow-clip (y no hidden): las letras se quedan pegadas arriba al bajar. -->
        <div v-else class="@container overflow-clip rounded-2xl bg-default ring-1 ring-default">
          <section
            v-for="grupo in grupos"
            :id="grupo.letra ? `letra-${grupo.letra}` : undefined"
            :key="grupo.letra || 'todos'"
            class="scroll-mt-20"
          >
            <h2
              v-if="grupo.letra"
              class="sticky top-16 z-[2] border-y border-default bg-elevated/90 px-4 py-1 text-xs font-bold tracking-wider text-muted backdrop-blur first:border-t-0"
            >
              {{ grupo.letra }}
            </h2>
            <TransitionGroup
              tag="ul"
              name="tarjeta"
              type="transition"
              appear
              appear-from-class="tarjeta-aparece-desde"
              appear-active-class="tarjeta-aparece-activa"
              class="relative divide-y divide-default"
              @before-leave="fijarAlSalir"
            >
              <FilaCliente
                v-for="cliente in grupo.clientes"
                :key="cliente.id"
                :style="{ '--retraso': retraso(cliente.id) }"
                :cliente="cliente"
                :busqueda="textoBuscado"
                :resaltado="resaltados.has(cliente.id)"
                :seleccionado="pantallaGrande && elegidoId === cliente.id"
                @seleccionar="elegir"
              />
            </TransitionGroup>
          </section>
        </div>
      </div>

      <!--
        Columna derecha (tablet horizontal y PC), siempre en su lugar para que la lista no
        cambie de ancho: la ficha del elegido o, sin elegido, el resumen. Se queda a la vista
        al bajar.
      -->
      <div v-if="pantallaGrande" class="sticky top-22 w-80 shrink-0 xl:w-96">
        <Transition name="paso" mode="out-in">
          <PanelCliente
            v-if="panelVisible"
            :cliente="elegido"
            :modo="modo"
            :inicial="inicial"
            @cerrar="cerrar"
            @editar="modo = 'editar'"
            @cancelar="cancelar"
            @guardado="alGuardar"
            @existente="irAlExistente"
          />
          <ResumenClientes
            v-else
            :total="todos.length"
            :sin-correo="cuantosSinCorreo"
            :filtrando="soloSinCorreo"
            :parcial="hayMas"
            @filtrar="(solo) => (soloSinCorreo = solo)"
          />
        </Transition>
      </div>
    </div>

    <!-- Celular: la misma ficha (o el formulario) en una hoja desde abajo. -->
    <USlideover
      v-if="!pantallaGrande"
      v-model:open="hojaAbierta"
      side="bottom"
      :title="modo === 'nuevo' ? 'Nuevo cliente' : (elegido?.nombre ?? '')"
      :description="
        modo === 'nuevo'
          ? 'A nombre de quién se factura'
          : elegido
            ? etiquetaDeDocumento(elegido)
            : ''
      "
      :ui="{ content: 'max-h-[92dvh]' }"
    >
      <template #body>
        <Transition name="paso" mode="out-in">
          <FichaCliente
            v-if="modo === 'ver' && elegido"
            :key="`ver-${elegido.id}`"
            :cliente="elegido"
            @editar="modo = 'editar'"
          />
          <FormularioCliente
            v-else-if="modo !== 'ver'"
            :key="modo === 'nuevo' ? 'nuevo' : `editar-${elegido?.id}`"
            :cliente="modo === 'nuevo' ? null : elegido"
            :inicial="modo === 'nuevo' ? inicial : null"
            botones-fijos
            @guardado="alGuardar"
            @cancelar="cancelar"
            @existente="irAlExistente"
          />
        </Transition>
      </template>
      <template v-if="modo === 'ver' && elegido" #footer>
        <UButton
          block
          size="xl"
          color="primary"
          variant="soft"
          icon="i-lucide-pencil"
          label="Editar"
          @click="modo = 'editar'"
        />
      </template>
    </USlideover>
  </div>
</template>
