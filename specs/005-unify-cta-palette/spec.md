# Feature Specification: Unificación de paleta en CTAs, modales y selectores del lobby vs-bot

**Feature Branch**: `005-unify-cta-palette`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "la tarea anterior si bien soluciono un poco el loby, el modal al precionar salir, sigue teniendo una paleta que desentona, lo mismo con el volver de la pagina vs-bot, el crear partida, y el mejor de 1/3/5 tambien tiene un color muy poco llamativo, podrias solucionar esto, y hacer que no se repitan estas cosas"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modal de salida del lobby con paleta coherente (Priority: P1)

Cuando el jugador presiona "Salir" desde el lobby o desde la página de configuración vs-bot, aparece un modal de confirmación. Hoy ese modal usa colores que no pertenecen al sistema visual de la aplicación (botones grises/neutros de stock, fondos planos), lo que rompe la continuidad visual con la pantalla desde la que se invoca. El jugador debe percibir que el modal "pertenece" al producto y distinguir con claridad la acción destructiva ("Salir") de la acción segura ("Cancelar").

**Why this priority**: Es el punto de fricción más visible reportado por el usuario y afecta la confianza en una acción destructiva. Si el modal desentona, el jugador duda y la decisión se vuelve incómoda.

**Independent Test**: Abrir el lobby o la página vs-bot, presionar "Salir", verificar visualmente que los colores, tipografía, bordes y radios del modal son consistentes con el resto de la app y que el botón primario ("Cancelar/Seguir jugando") y el destructivo ("Salir") tienen jerarquía clara.

**Acceptance Scenarios**:

1. **Given** el jugador está en el lobby vs-bot, **When** presiona "Salir", **Then** se abre un modal cuyo fondo, bordes, tipografía y botones usan exclusivamente los tokens visuales del sistema (no aparecen grises planos ni acentos ajenos a la paleta).
2. **Given** el modal de salida está abierto, **When** el jugador lo observa, **Then** la acción destructiva está claramente diferenciada visualmente de la acción de retorno seguro, sin requerir leer el texto para distinguirlas.
3. **Given** el modal de salida está abierto, **When** el jugador presiona la acción de cancelar, **Then** vuelve al estado anterior sin que ningún elemento visual del modal haya parecido fuera de lugar.

---

### User Story 2 - Botón "Volver" de la página vs-bot integrado al sistema visual (Priority: P1)

El botón "Volver" en la página de configuración vs-bot usa una paleta que desentona del resto de la pantalla (gris/neutro stock). Debe verse como parte del producto y comunicar su función secundaria sin perder presencia.

**Why this priority**: Es el control de navegación más prominente de la página y el primer elemento que el usuario nota junto al título. Si desentona, contamina la percepción de toda la pantalla.

**Independent Test**: Navegar a la página vs-bot y verificar que el botón "Volver" comparte la familia visual con los demás controles de la pantalla y con los botones equivalentes en otras páginas del producto.

**Acceptance Scenarios**:

1. **Given** el jugador está en la página vs-bot, **When** observa el botón "Volver", **Then** su color, borde y tipografía pertenecen al sistema visual y se identifica como acción secundaria (no compite con el CTA principal).
2. **Given** el jugador compara el botón "Volver" de vs-bot con cualquier otro botón de retorno del producto, **When** los observa juntos, **Then** se ven como variantes del mismo componente, no como elementos de diseños distintos.

---

### User Story 3 - CTA "Crear partida" con jerarquía visual fuerte (Priority: P1)

El botón "Crear partida" en la página vs-bot debe ser el elemento más llamativo de la pantalla porque concentra la acción principal del flujo. Hoy su color es poco llamativo y compite/pierde frente a otros elementos.

**Why this priority**: Es el CTA del flujo principal. Si no destaca, la pantalla pierde su propósito.

**Independent Test**: Abrir la página vs-bot tras configurar la partida y verificar que el botón "Crear partida" es inequívocamente el foco visual primario de la pantalla.

**Acceptance Scenarios**:

1. **Given** el jugador entra a la página vs-bot, **When** mira la pantalla sin leer el texto, **Then** identifica el botón "Crear partida" como la acción principal en menos de un segundo.
2. **Given** el botón "Crear partida" está habilitado, **When** se compara con cualquier otro botón en pantalla, **Then** su contraste y prominencia son visiblemente superiores.
3. **Given** el botón "Crear partida" está deshabilitado (configuración incompleta), **When** el jugador lo observa, **Then** su estado deshabilitado se distingue claramente del habilitado sin perder coherencia con el sistema visual.

---

### User Story 4 - Selector "Mejor de 1 / 3 / 5" con color expresivo del producto (Priority: P2)

El selector del formato de serie ("Mejor de 1", "Mejor de 3", "Mejor de 5") usa hoy un color apagado que no comunica que es un control interactivo destacado. Debe verse como parte del sistema visual del producto y que la opción seleccionada tenga énfasis claro.

**Why this priority**: Es el control de configuración más visible de la página vs-bot. Si pasa desapercibido, el jugador no nota que puede cambiar el formato y queda con la opción por defecto sin saberlo.

**Independent Test**: Abrir la página vs-bot y verificar que las tres opciones del selector son legibles, claramente interactivas y que la opción seleccionada tiene énfasis visual inequívoco usando colores del sistema.

**Acceptance Scenarios**:

1. **Given** el jugador ve por primera vez el selector "Mejor de N", **When** observa la pantalla, **Then** identifica que es un control con tres opciones seleccionables sin necesidad de leer instrucciones.
2. **Given** una opción del selector está seleccionada, **When** se compara con las no seleccionadas, **Then** el estado seleccionado destaca con color del sistema (no un gris neutro ni un tono apagado).
3. **Given** el jugador cambia la selección, **When** toca otra opción, **Then** el feedback visual del cambio es inmediato y usa los mismos colores del sistema que el estado seleccionado original.

---

### User Story 5 - Guardarraíl que impide que estas inconsistencias reaparezcan (Priority: P1)

Las disonancias reportadas por el usuario (modal genérico, botón "Volver" gris stock, CTAs apagados, selectores neutros) se originan en que componentes de UI de terceros y estilos puntuales se introducen sin pasar por el sistema visual del producto. El proyecto debe contar con un mecanismo automático que detecte y bloquee la introducción de colores fuera del sistema o el uso de componentes "crudos" sin tematizar en pantallas del producto.

**Why this priority**: El usuario explícitamente pide "que no se repitan estas cosas". Sin un guardarraíl, cada nueva pantalla puede volver a introducir el mismo problema y la corrección actual es solo un parche temporal.

**Independent Test**: Intentar agregar un color hardcodeado o un componente sin tematizar a una pantalla del producto y verificar que el guardarraíl impide que el cambio sea aceptado (falla en la verificación local automatizada).

**Acceptance Scenarios**:

1. **Given** un desarrollador introduce un color literal en un archivo de estilos de feature, **When** ejecuta la verificación local que el proyecto corre antes de aceptar cambios, **Then** la verificación falla con un mensaje claro indicando el archivo, la línea y el valor ofensor.
2. **Given** un desarrollador usa un componente de UI de terceros sin la variante tematizada del producto en una pantalla del producto, **When** se ejecuta la verificación local de consistencia visual, **Then** la verificación falla o señala el componente como no conforme.
3. **Given** las pantallas alcanzadas por esta feature (modal de salida, página vs-bot, lobby), **When** se realiza una auditoría visual automatizada o asistida, **Then** ninguna pantalla presenta colores fuera del sistema.

---

### Edge Cases

- **Modal sobre fondo oscuro**: el backdrop del modal debe contrastar con el contenido sin recurrir a negros/grises planos ajenos al sistema.
- **Selector "Mejor de N" con una opción deshabilitada o no disponible**: el estado deshabilitado debe ser visualmente distinto tanto del seleccionado como del seleccionable, usando solo tokens del sistema.
- **Botón "Crear partida" durante la transición a la partida**: el estado "cargando/creando" debe mantener la jerarquía visual y la coherencia de paleta (no caer a un spinner gris stock).
- **Mobile a 360 px de ancho**: todos los CTAs y el modal deben mantener legibilidad, jerarquía y contraste sin solapamientos.
- **Modal con texto largo**: el modal de salida debe mantener la paleta coherente incluso si el contenido crece o se internacionaliza.
- **Re-renderizado de la página vs-bot al volver desde el modal**: el botón "Volver" y los CTAs no deben "parpadear" a colores no tematizados antes de aplicar los estilos finales.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El modal de confirmación de "Salir" del lobby/vs-bot MUST usar exclusivamente colores, tipografía, radios y sombras del sistema visual del producto, sin grises ni acentos genéricos de stock.
- **FR-002**: El modal de "Salir" MUST diferenciar visualmente la acción destructiva de la acción de cancelar/retornar mediante color y peso visual coherentes con el sistema (no por contraste arbitrario).
- **FR-003**: El botón "Volver" de la página vs-bot MUST compartir familia visual (color, forma, tipografía) con los demás botones de navegación secundaria del producto.
- **FR-004**: El CTA "Crear partida" MUST ser el elemento de mayor prominencia visual de la página vs-bot cuando está habilitado, usando el color/énfasis primario del sistema.
- **FR-005**: El CTA "Crear partida" MUST tener un estado deshabilitado claramente distinguible del habilitado y coherente con el sistema visual.
- **FR-006**: El selector "Mejor de 1 / 3 / 5" MUST destacar la opción seleccionada con un color expresivo del sistema visual, no con grises neutros ni tonos apagados.
- **FR-007**: El selector "Mejor de 1 / 3 / 5" MUST comunicar visualmente que las tres opciones son interactivas y mutuamente excluyentes, sin requerir leer texto auxiliar.
- **FR-008**: El selector "Mejor de N" MUST seguir respetando las reglas de dominio del producto (formatos válidos 1, 3 y 5; no se ofrecen otros valores).
- **FR-009**: Los cambios visuales MUST mantenerse coherentes en mobile (desde 360 px) y desktop (1024 px+), las dos resoluciones soportadas por el producto.
- **FR-010**: El proyecto MUST contar con una verificación local automatizada que falle si se introducen colores literales en archivos de estilos de las features del producto.
- **FR-011**: El proyecto MUST documentar la regla de que los componentes interactivos prominentes (modales de confirmación, CTAs principales, selectores de configuración del flujo principal) deben usar variantes tematizadas del sistema, no componentes "crudos" sin estilizar.
- **FR-012**: La verificación de consistencia visual MUST ejecutarse antes de aceptar cambios localmente (paso de verificación previo a integrar el cambio al historial del proyecto).
- **FR-013**: Las pantallas alcanzadas (modal de salida, lobby, página vs-bot) MUST quedar libres de cualquier color fuera del sistema al finalizar la feature, verificable mediante una auditoría visual.
- **FR-014**: Los textos visibles de los CTAs, del modal y del selector MUST permanecer sin cambios funcionales respecto a la implementación previa (el alcance de esta feature es visual y de guardarraíl, no de copy).

### Key Entities *(include if feature involves data)*

- **Token visual del sistema**: unidad atómica de la paleta del producto (color primario, color destructivo, color de superficie, color de borde, radios, sombras, espaciados). Es la única fuente válida para valores visuales en las pantallas del producto.
- **Componente tematizado**: variante de un componente de UI (botón, modal, selector) que aplica tokens del sistema y queda registrada como la forma "oficial" de ese componente para el producto.
- **Verificación de consistencia visual**: proceso automatizado que recorre los estilos de features y detecta colores fuera del sistema o componentes sin tematizar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los CTAs, modales y selectores en las pantallas alcanzadas (modal de salida, lobby, página vs-bot) usan exclusivamente tokens del sistema visual, verificado por auditoría automatizada con cero hallazgos.
- **SC-002**: Un usuario que vea por primera vez la página vs-bot identifica el botón "Crear partida" como la acción principal en menos de 2 segundos, sin leer el texto del botón.
- **SC-003**: Un usuario presenta el modal de "Salir" y describe los dos botones como "del mismo producto" sin notar diferencias de estilo respecto al lobby.
- **SC-004**: Un usuario que ve por primera vez el selector "Mejor de N" reconoce que es un control con tres opciones seleccionables y cuál está seleccionada, sin instrucciones.
- **SC-005**: Cualquier intento de introducir un color fuera del sistema en un archivo de estilos de feature es detectado y bloqueado por la verificación local antes de integrarse al historial del proyecto, con tasa de detección del 100% en pruebas dirigidas.
- **SC-006**: La feature no introduce regresiones funcionales: todos los flujos de "Salir", "Volver", "Crear partida" y cambio de formato de serie siguen comportándose como antes (cero regresiones reportadas en verificación manual del flujo principal).
- **SC-007**: La cobertura del guardarraíl alcanza al 100% de los archivos de estilos bajo las pantallas del producto (no solo a las pantallas alcanzadas por esta feature).

## Assumptions

- El sistema visual del producto ya está definido mediante tokens y esta feature consume los tokens existentes; si falta algún token necesario (p. ej., una variante de superficie para el modal o un color de énfasis para el selector), se agrega al sistema antes de consumirlo en las pantallas.
- "El modal al presionar salir" se refiere al modal de confirmación que aparece tras presionar el botón "Salir" tanto en el lobby como en la página vs-bot; si hubiera variantes distintas en cada origen, ambas se alinean a la misma paleta.
- La forma del CTA principal ("Crear partida") permanece (mismo tamaño, posición, layout); cambia solo su tratamiento visual para ganar prominencia.
- El selector "Mejor de N" mantiene exactamente las tres opciones 1/3/5 dictadas por las reglas del producto; no se introducen formatos nuevos.
- El alcance de la feature es las pantallas del flujo vs-bot (lobby + página de configuración + modal de salida); pantallas de autenticación u otras quedan fuera de esta entrega, aunque el guardarraíl se aplica de forma transversal a todas las features.
- "Que no se repitan estas cosas" se interpreta como la introducción de una verificación automatizada que corra localmente antes de integrar cambios y que cubra al menos el chequeo de colores literales en estilos de features; las verificaciones adicionales (componentes sin tematizar, contrastes) son deseables pero pueden quedar como mejoras incrementales si exceden el alcance razonable de esta entrega.
- El producto se sigue diseñando mobile-first con escala a desktop a partir de 1024 px; no se introducen breakpoints intermedios ni soporte landscape mobile.
