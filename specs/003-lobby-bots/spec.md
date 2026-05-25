# Feature Specification: Lobby post-login y creación de partida contra bots

**Feature Branch**: `003-lobby-bots`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "quiero que luego de hacer el login, se muestre un lobby, en donde por el momento, lo unico que va a haber va a ser una opcion para crear una partida contra bots, eso te llevaria a otra pantalla en donde te muestran todos los bots disponibles, hay una opcion de a cuantas aprtidas, y un boton para crear la partida, hay que pensarle una buena ux ui a esto, lo mejor que se me ocurre, ya que son muchos bots, es que haya un Bottom action bar o algo del estilo donde pueda seleccionar a cuantas partidas se juega y el cta para crear la partida, no hagas nada de suscripcion a sockets por ahora, porque es algo mas complejo para el futuro"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso al lobby tras iniciar sesión (Priority: P1)

Tras autenticarse exitosamente, el jugador aterriza automáticamente en un lobby que actúa como hub de modos de juego. Por el momento el lobby presenta una única acción visible y destacada: **"Jugar contra bots"**. El lobby comunica al jugador que está en sesión (su nombre de usuario visible) y le ofrece una salida explícita para cerrar sesión.

**Why this priority**: Es el destino obligado post-login y la puerta de entrada a cualquier modo de juego. Sin lobby el flujo de autenticación queda colgado en un destino sin sentido.

**Independent Test**: Iniciar sesión con un usuario válido y verificar que se redirige a `/lobby`, que la opción "Jugar contra bots" es visible y accionable, y que existe una opción de cerrar sesión que devuelve al login.

**Acceptance Scenarios**:

1. **Given** un usuario sin sesión activa, **When** completa el login correctamente, **Then** es redirigido al lobby y ve la tarjeta/acción "Jugar contra bots".
2. **Given** un usuario ya autenticado, **When** abre la URL raíz o la del lobby directamente, **Then** ve el lobby sin tener que volver a loguearse.
3. **Given** un usuario en el lobby, **When** pulsa "Cerrar sesión", **Then** se limpia la sesión y es redirigido al login.
4. **Given** un usuario sin sesión, **When** intenta abrir directamente la URL del lobby, **Then** es redirigido a `/auth/login`.

---

### User Story 2 - Selección de bot y configuración de la partida (Priority: P1)

Desde el lobby el jugador elige "Jugar contra bots" y accede a una pantalla de configuración de partida. En esa pantalla ve un listado/galería con todos los bots disponibles (potencialmente muchos) y selecciona **1 bot** como oponente (modalidad 1 vs 1). En la parte inferior persiste una **bottom action bar** fija que contiene un selector de **formato de serie** ("mejor de 1 / 3 / 5 partidas") y el botón primario para **Crear partida**. El CTA permanece visible y al alcance del pulgar durante todo el scroll de la lista de bots.

> Recordatorio de reglas: cada partida individual de truco-to-three se gana llegando a **exactamente 3 puntos** (pasarse pierde). Esta feature solo configura cuántas partidas integran la serie; la mecánica de scoring vive en la pantalla de partida.

**Why this priority**: Es la razón de ser de la feature: dejar al usuario armar y lanzar la partida. Sin esto el lobby es decorativo.

**Independent Test**: Entrar a la pantalla de bots, recorrer la lista, seleccionar 1 bot oponente, ajustar el selector de formato de serie en la bottom bar, presionar "Crear partida" y verificar que se invoca la creación con los parámetros elegidos.

**Acceptance Scenarios**:

1. **Given** el usuario abrió "Jugar contra bots", **When** la pantalla termina de cargar, **Then** ve un listado de bots y la bottom action bar fija con el selector de formato de serie (default "mejor de 3") y el botón "Crear partida" deshabilitado hasta seleccionar 1 bot.
2. **Given** la lista de bots, **When** el usuario toca una tarjeta de bot, **Then** ese bot queda marcado como seleccionado y cualquier otro bot previamente seleccionado se deselecciona automáticamente (selección única).
3. **Given** el usuario seleccionó 1 bot, **When** mira la bottom bar, **Then** el botón "Crear partida" está habilitado y el formato elegido se muestra de forma legible (p. ej. "Mejor de 3").
4. **Given** el usuario tiene un bot seleccionado, **When** toca otra tarjeta de bot, **Then** la selección se mueve al nuevo bot sin necesidad de deseleccionar manualmente el anterior.
5. **Given** la configuración es válida, **When** el usuario presiona "Crear partida", **Then** se dispara la creación con el bot y el formato de serie elegidos, se muestra un indicador de carga y, al completarse, el usuario es navegado a la pantalla de la partida creada.
6. **Given** la creación de partida falla (error del backend o de red), **When** se recibe el error, **Then** se muestra un mensaje claro y el botón vuelve a estar habilitado para reintentar sin perder la selección hecha.
7. **Given** el usuario está en la pantalla de configuración, **When** pulsa el botón de volver, **Then** regresa al lobby conservando su sesión.

---

### User Story 3 - Exploración cómoda del catálogo de bots (Priority: P2)

Al haber muchos bots disponibles, el jugador necesita poder identificarlos y diferenciarlos rápidamente. Cada bot muestra al menos un nombre y un identificador visual (avatar o inicial), y la lista usa una grilla responsiva: tarjetas grandes en una columna en mobile y varias columnas en desktop. La bottom action bar no tapa el contenido (se considera padding inferior al final del scroll) y respeta el área segura del dispositivo.

**Why this priority**: Buena UX, pero la feature ya entrega valor sin búsqueda/filtros avanzados; estos pueden ser iteración posterior.

**Independent Test**: Cargar la pantalla con un set realista de bots (≥ 12), verificar que se puede hacer scroll sin que la bottom bar oculte el último ítem, que la grilla se adapta al pasar de mobile a desktop y que cada tarjeta de bot es identificable sin confusión.

**Acceptance Scenarios**:

1. **Given** la pantalla de bots con ≥ 12 bots, **When** el usuario hace scroll hasta el final, **Then** la última tarjeta es totalmente visible (no queda tapada por la bottom action bar).
2. **Given** un viewport mobile (360–1023 px), **When** se renderiza la lista, **Then** las tarjetas se muestran en una grilla optimizada para una columna o doble columna compacta y el tap target de cada tarjeta es ≥ 44 px de alto.
3. **Given** un viewport desktop (≥ 1024 px), **When** se renderiza la lista, **Then** las tarjetas se distribuyen en varias columnas aprovechando el ancho disponible.

---

### Edge Cases

- **No hay bots disponibles**: la pantalla muestra un estado vacío con mensaje explícito ("No hay bots disponibles en este momento") y el botón "Crear partida" permanece deshabilitado.
- **Carga lenta del catálogo de bots**: se muestra un skeleton/spinner mientras se obtienen los bots; la bottom bar puede estar visible pero el CTA permanece deshabilitado.
- **Error al obtener el catálogo de bots**: se muestra un mensaje de error con opción "Reintentar".
- **Token expirado en cualquier request**: comportamiento global del interceptor — limpia el `AuthStore` y redirige a `/auth/login` sin mostrar mensaje al usuario.
- **Doble tap en "Crear partida"**: el botón se deshabilita inmediatamente al primer tap para evitar crear partidas duplicadas.
- **Selector de partidas en valor por defecto**: si el usuario no toca el selector, se usa un valor por defecto sensato y el botón puede habilitarse en cuanto la selección de bots sea válida.
- **Cambio de orientación / resize**: la bottom action bar siempre permanece anclada al borde inferior visible.
- **Usuario navega "atrás" desde la pantalla de bots**: la selección no se persiste entre visitas (decisión de simplicidad para la primera versión).

## Requirements *(mandatory)*

### Functional Requirements

#### Lobby

- **FR-001**: El sistema DEBE redirigir al usuario al lobby (`/lobby`) inmediatamente después de un login exitoso.
- **FR-002**: El lobby DEBE ser accesible únicamente para usuarios autenticados; los no autenticados DEBEN ser redirigidos a `/auth/login`.
- **FR-003**: La aplicación DEBE renderizar un **header global compartido** en todas las pantallas (logueadas y no logueadas). El header DEBE mostrar siempre la marca/título de la app. Cuando hay sesión activa, DEBE además mostrar el nombre del usuario autenticado y la acción "Salir" (cerrar sesión); cuando no hay sesión, esos elementos NO se muestran. El header NO desaparece al navegar entre pantallas post-login (lobby, configuración de partida vs bots, etc.).
- **FR-003a**: La acción "Salir" del header DEBE abrir un **diálogo global de confirmación** ("¿Cerrar sesión?" con botones "Cancelar" y "Salir"). Solo al confirmar se limpia el `AuthStore` y se redirige a `/auth/login`. Este comportamiento aplica de forma global a todo logout iniciado por el usuario en cualquier pantalla.
- **FR-003b**: El header global DEBE estar **sticky/fijo al borde superior** del viewport en todas las pantallas y tamaños (mobile y desktop). Permanece visible durante todo el scroll. En la pantalla de configuración de partida vs bots, esto significa que el área scrolleable de la lista queda acotada entre el header fijo (arriba) y la bottom action bar fija (abajo); ambos deben respetar safe areas y no tapar contenido.
- **FR-004**: El lobby DEBE mostrar, en esta versión, una única acción primaria etiquetada "Jugar contra bots" que navegue a la pantalla de configuración de partida vs bots.
- **FR-005**: El lobby DEBE estar diseñado de forma extensible para alojar más modos de juego en el futuro (sin requerir rediseño visual estructural cuando se agreguen).

#### Pantalla de configuración de partida vs bots

- **FR-006**: El sistema DEBE obtener y mostrar el listado completo de bots disponibles al ingresar a la pantalla.
- **FR-007**: Cada bot DEBE mostrar como mínimo: un identificador visual (avatar o iniciales con color) y un nombre legible.
- **FR-008**: El usuario DEBE poder seleccionar **exactamente 1 bot** como oponente (modalidad 1 vs 1), con feedback visual claro de qué bot está seleccionado. La selección es de tipo radio: tocar otro bot reemplaza la selección previa.
- **FR-009**: El sistema NO DEBE permitir crear la partida sin un bot seleccionado, y NO DEBE permitir más de un bot seleccionado simultáneamente.
- **FR-010**: La pantalla DEBE presentar una **bottom action bar** fija al borde inferior, presente durante todo el scroll, que contiene:
  - Un selector de **formato de serie** con tres opciones: **Mejor de 1**, **Mejor de 3** (default), **Mejor de 5**.
  - Un botón primario "Crear partida".
- **FR-011**: El botón "Crear partida" DEBE permanecer deshabilitado mientras no haya un bot seleccionado o el catálogo esté vacío, y habilitarse en cuanto haya 1 bot seleccionado (el formato de serie siempre tiene valor por su default).
- **FR-012**: Al pulsar "Crear partida" el sistema DEBE enviar la solicitud de creación con el bot seleccionado y el formato de serie elegido, mostrando un indicador de carga y deshabilitando el botón hasta recibir respuesta.
- **FR-013**: En caso de éxito en la creación, el sistema DEBE navegar al jugador a la vista de la partida recién creada.
- **FR-014**: En caso de error en la creación, el sistema DEBE mostrar un mensaje comprensible **proveniente de un catálogo de copy controlado por el front** (nunca el `message` crudo del backend) y permitir reintentar sin perder la selección actual. El catálogo DEBE mapear, como mínimo:
  - **401 / token expirado** → manejado por el interceptor global: limpia el `AuthStore` y redirige a `/auth/login` sin mensaje al usuario.
  - **403** → "No tenés permiso para crear esta partida".
  - **404 bot inexistente** → "El bot ya no está disponible, actualizá la lista". Recarga el catálogo automáticamente y limpia la selección.
  - **409 / 422 validación** → "La configuración elegida no es válida". Botón vuelve a habilitarse.
  - **5xx / error de red / timeout / offline** → "No pudimos crear la partida. Reintentá en unos segundos".
  - **Cualquier otro código no catalogado** → fallback genérico "Ocurrió un error inesperado. Reintentá".
- **FR-014a**: Para la carga del catálogo de bots, el sistema DEBE aplicar el mismo principio (copy del front, nunca `ApiError.message`): 401 → manejado globalmente por el interceptor (redirect silencioso a `/auth/login`); 403 → "No tenés permiso para ver los bots"; 5xx/red → "No pudimos cargar los bots. Reintentá"; otros → fallback genérico. La acción "Reintentar" reintenta la carga.
- **FR-014b**: El front NO DEBE mostrar al usuario ningún texto proveniente del backend (campo `message` u otros). Los detalles crudos pueden registrarse en `console.error` o telemetría.
- **FR-015**: La pantalla DEBE ofrecer una acción visible para volver al lobby.
- **FR-016**: El layout DEBE cumplir el sistema responsivo del proyecto: mobile 360–1023 px y desktop ≥ 1024 px, sin soporte de landscape mobile. La bottom action bar DEBE respetar el safe area inferior y no tapar el último elemento del listado.
- **FR-017**: Esta feature NO DEBE suscribirse a WebSockets ni STOMP. La comunicación con el backend para esta versión se hace exclusivamente vía HTTP.
- **FR-018**: El sistema DEBE manejar el estado "catálogo vacío" mostrando un mensaje explícito y dejando el CTA deshabilitado.
- **FR-019**: El sistema DEBE manejar el estado "error de carga del catálogo" con un mensaje claro y opción de reintentar.

### Key Entities *(include if feature involves data)*

- **Bot**: Oponente controlado por IA disponible para seleccionar. Atributos mínimos para la UI: identificador único, nombre legible, identificador visual (avatar o iniciales). Puede incluir atributos opcionales descriptivos (p. ej. dificultad, estilo de juego) si el backend los expone.
- **ConfiguraciónDePartidaVsBots**: Conjunto formado por (a) el bot oponente seleccionado y (b) el formato de serie elegido (mejor de 1 / 3 / 5 partidas). Es la entrada a la operación "Crear partida". Nota de dominio: cada partida individual de la serie se gana llegando a 3 puntos exactos (pasarse pierde); esa mecánica no se configura desde esta pantalla.
- **Partida (referencia)**: Entidad resultante de la creación; el detalle pertenece a otras features. En esta feature solo se requiere conocer su identificador para navegar a ella.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los logins exitosos terminan en el lobby con la acción "Jugar contra bots" visible sin scroll en mobile (360 × 780) y desktop (1440 × 900).
- **SC-002**: Un usuario nuevo puede llegar desde el login hasta presionar "Crear partida" con una selección válida en menos de **60 segundos**.
- **SC-003**: En la pantalla de configuración de partida, el CTA "Crear partida" permanece visible al usuario durante el 100 % del tiempo (no se oculta al hacer scroll).
- **SC-004**: La pantalla soporta catálogos de al menos **30 bots** sin degradación perceptible en el scroll (mantiene 60 fps en dispositivos mobile de gama media).
- **SC-005**: ≥ 95 % de los intentos de creación de partida con configuración válida terminan en la navegación exitosa a la vista de partida (excluyendo errores atribuibles al backend).
- **SC-006**: Los errores recuperables (catálogo no disponible, fallo al crear) muestran un mensaje accionable en ≤ 1 segundo desde recibir la respuesta del servidor.
- **SC-007**: 0 regresiones en el flujo de autenticación existente.

## Assumptions

- El backend expone (o expondrá antes de implementar) un endpoint HTTP para listar bots disponibles y otro para crear partidas vs bots; ambos protegidos por el JWT actual e interceptables por el `jwtInterceptor` ya existente.
- El selector de formato de serie ofrece tres opciones cerradas: **Mejor de 1**, **Mejor de 3** (default) y **Mejor de 5**. No se exponen otras variantes en esta versión.
- La modalidad disponible en esta versión es **1 vs 1** (usuario + 1 bot). Otros formatos de mesa (1v1v1, 2v2) quedan fuera de alcance.
- La regla "una partida individual se gana llegando a 3 puntos exactos, pasarse pierde" es de dominio del producto y queda documentada en `CLAUDE.md`; esta feature solo configura el formato de serie, no la mecánica de scoring intra-partida.
- No se contempla en esta versión: búsqueda/filtros de bots, favoritos, partidas privadas con código, invitación a humanos, ni reconexión a partida en curso.
- No se contempla en esta versión: suscripción a `/topic/public-match-lobby` ni a colas `/user/queue/match` — esos canales se integrarán en una feature posterior.
- La sesión y el token siguen gestionados por el `AuthStore` existente; esta feature solo lo consume.
- Diseño mobile-first siguiendo el sistema responsivo ya establecido (mobile 360–1023 px, desktop ≥ 1024 px), sin sub-breakpoints intermedios.
- La selección de bots y el valor del selector de partidas no se persisten entre visitas a la pantalla (estado local efímero).
- La acción "Cerrar sesión" en el lobby reutiliza la limpieza de estado del `AuthStore` y vuelve a `/auth/login`.

## Aclaraciones resueltas (2026-05-24)

- **Formato de mesa**: 1 vs 1. El usuario selecciona exactamente 1 bot como oponente.
- **Selector "a cuántas partidas"**: Formato de serie con opciones **Mejor de 1 / Mejor de 3 / Mejor de 5**, default **Mejor de 3**. Cada partida individual de la serie se gana llegando a **3 puntos exactos** (regla de dominio documentada en `CLAUDE.md`, no configurable desde esta pantalla).

## Clarifications

### Session 2026-05-24

- Q: ¿Header global compartido en todas las pantallas, header por pantalla o híbrido? → A: Header global estándar con marca/título siempre presente; nombre de usuario y acción "Salir" se muestran únicamente cuando hay sesión activa.
- Q: ¿Granularidad de mensajes de error del BE en la UI? → A: Catálogo específico mapeado por código HTTP/`errorCode` con fallback genérico; **nunca mostrar el `message` crudo del backend** (regla global del proyecto, registrada en memoria como `error-messaging`).
- Q: ¿Comportamiento ante 401 (sesión expirada)? → A: Global y silencioso — el interceptor limpia el `AuthStore` y redirige a `/auth/login` ante cualquier 401, sin mostrar mensaje al usuario.
- Q: ¿Confirmación al pulsar "Salir"? → A: Sí, diálogo global de confirmación "¿Cerrar sesión?" (Cancelar / Salir). Patrón aplicable a toda la app, no solo a esta feature.
- Q: ¿Comportamiento del header global durante scroll? → A: Sticky/fijo al borde superior en todas las pantallas y viewports (mobile y desktop); siempre visible, coherente con la bottom action bar fija.
