# Feature Specification: Cimientos de Autenticación y Modelos de Dominio

**Feature Branch**: `001-auth-models-foundation`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Reparar la capa de modelos y el AuthStore (alinear con la API real: playerId, accessToken, refreshToken, accessTokenExpiresIn, isGuest, MatchState, RoundState, WsEvent, enums Suit/TrucoCall) + Feature de Auth completa (Login / Register / Guest) con AuthService de 5 endpoints, componentes UI, refresh automático al expirar el accessToken y rutas /login y /register. Hay prototipo clickable en public/referencias."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar como invitado para jugar al instante (Priority: P1)

Un jugador que llega por primera vez quiere probar el juego sin completar formularios. Pulsa "Jugar como invitado", el sistema le crea una identidad temporal y queda autenticado, listo para entrar a una sala. Si cierra y vuelve, recupera su sesión mientras los tokens sigan vigentes.

**Why this priority**: Es la fricción cero. Habilita la demo, la conversión y el primer "wow" del prototipo. Sin esto, el resto de la app no se puede probar. Es también el camino más simple end‑to‑end: prueba que modelos, store, interceptor y refresh funcionan juntos.

**Independent Test**: Desde una pestaña limpia (sin tokens guardados), pulsar el botón de invitado en la pantalla de bienvenida y verificar que: (a) la sesión queda persistida con `playerId`, `accessToken`, `refreshToken` e `isGuest=true`, (b) una llamada protegida posterior incluye el `Authorization: Bearer …` correcto, (c) tras recargar la pestaña la sesión sigue activa.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión previa, **When** elige "Jugar como invitado", **Then** el sistema obtiene una identidad de invitado, persiste los datos de sesión y lo redirige al destino post‑login (lobby principal del prototipo).
2. **Given** un invitado autenticado, **When** recarga la pestaña, **Then** la app reanuda su sesión sin pedirle credenciales mientras el `refreshToken` siga vigente.
3. **Given** un invitado autenticado, **When** pulsa "Salir", **Then** la sesión se invalida en el servidor y se borra del almacenamiento local; cualquier request en vuelo no debe disparar nuevos reintentos contra endpoints protegidos.

---

### User Story 2 - Iniciar sesión con cuenta existente (Priority: P1)

Un usuario registrado vuelve a la app y quiere entrar con sus credenciales para conservar su progreso, ranking y amistades. Introduce identificador y contraseña en la pantalla de login y, si son válidos, queda autenticado igual que un invitado pero con `isGuest=false`.

**Why this priority**: Es el camino feliz del usuario recurrente y la única forma de acceder al estado persistente del jugador. Comparte el 90% de la lógica con el flujo invitado (mismo `AuthResponse`, mismo store), así que validarlo asegura que la solución es coherente.

**Independent Test**: Con un usuario previamente registrado en el backend, completar el formulario de `/login` y verificar que los tokens se almacenan, se redirige al lobby y que un endpoint protegido responde 200 con el token emitido.

**Acceptance Scenarios**:

1. **Given** un usuario con credenciales válidas en `/login`, **When** envía el formulario, **Then** se persisten `playerId`, `accessToken`, `refreshToken`, `accessTokenExpiresIn`, `isGuest=false`, y se redirige al destino protegido solicitado (o al lobby por defecto).
2. **Given** un usuario con credenciales inválidas, **When** envía el formulario, **Then** ve un mensaje de error claro y no técnico, los campos quedan editables y no se persiste ningún token.
3. **Given** una llamada protegida cuyo `accessToken` ha expirado, **When** el cliente la dispara, **Then** el sistema obtiene un nuevo `accessToken` usando el `refreshToken` y reintenta la llamada original una sola vez, de forma transparente para el usuario.
4. **Given** que el `refreshToken` también es rechazado, **When** se intenta refrescar, **Then** la sesión se cierra, se purgan los datos locales y se redirige a `/login` mostrando un aviso de sesión expirada.

---

### User Story 3 - Crear una cuenta nueva (Priority: P2)

Un visitante (anónimo o invitado actual) quiere convertirse en usuario registrado para conservar su progreso. Completa el formulario de registro y, al confirmarse el alta, queda autenticado en la misma sesión sin tener que pasar por login.

**Why this priority**: Es la puerta de entrada para usuarios nuevos comprometidos. Depende de la P1 (mismo modelo de respuesta y persistencia), por eso queda como P2: el sistema puede tener valor sin esta historia (se podría registrar desde un backoffice), pero no escalará socialmente sin ella.

**Independent Test**: Desde `/register`, completar el formulario con datos válidos y nuevos, enviar, y verificar que la respuesta produce la misma sesión autenticada que el login, con `isGuest=false`.

**Acceptance Scenarios**:

1. **Given** un visitante en `/register` con datos válidos y únicos, **When** envía el formulario, **Then** se crea la cuenta, se persiste la sesión y se redirige al lobby.
2. **Given** un visitante que intenta registrarse con un identificador ya en uso, **When** envía el formulario, **Then** ve un error de "ya existe" en el campo apropiado y puede corregirlo sin perder los demás datos.
3. **Given** un formulario con datos no válidos (campos requeridos vacíos, contraseña demasiado corta, formato incorrecto), **When** el usuario intenta enviar, **Then** la validación se muestra inline antes de cualquier llamada al backend.

---

### Edge Cases

- **Token expirado mientras hay múltiples requests en vuelo**: el sistema debe disparar el refresh **una sola vez** y poner en cola las requests pendientes para reanudarlas con el nuevo token; no debe generar N refresh paralelos ni N redirecciones a login.
- **Refresh devuelve error mientras el usuario está mirando una pantalla protegida**: la app debe limpiar el estado y redirigir a `/login` preservando la URL deseada para volver post‑login.
- **Almacenamiento local manipulado o corrupto** (tokens parciales, JSON inválido): al inicializar la app, los datos inválidos se descartan y el usuario es tratado como no autenticado, sin pantallas en blanco ni errores visibles.
- **Logout durante una request en vuelo**: las respuestas que lleguen después del logout deben ser ignoradas y no deben sobrescribir el estado limpio del store.
- **Doble click en "Iniciar sesión" o "Registrarme"**: los formularios deben bloquearse mientras una petición está pendiente para evitar envíos duplicados.
- **Invitado que cierra sesión**: su identidad temporal se descarta; no se intenta "recordarlo" en un próximo arranque.
- **Reloj del cliente desincronizado**: el cálculo de expiración no debe depender exclusivamente de la hora local; el refresh proactivo es una optimización, pero el refresh reactivo ante un 401 es la red de seguridad real.
- **Backend devuelve un payload con campos faltantes o nuevos**: el parsing debe tolerar campos extra (forward‑compatible) y fallar de forma controlada (sin login) ante la ausencia de campos obligatorios.

## Requirements *(mandatory)*

### Functional Requirements

**Modelos de dominio (cimientos)**

- **FR-001**: El sistema DEBE definir un modelo `AuthResponse` que represente exactamente la respuesta de autenticación del backend, con al menos: `playerId`, `accessToken`, `refreshToken`, `accessTokenExpiresIn` e `isGuest`. La definición DEBE ser la única fuente de verdad consumida por la capa de autenticación.
- **FR-002**: El sistema DEBE eliminar o reemplazar cualquier modelo previo que represente la sesión de manera incompleta (por ejemplo, basado únicamente en `token` y `username`), garantizando que ningún consumidor compile contra el modelo viejo.
- **FR-003**: El sistema DEBE definir modelos de dominio del juego necesarios para que las features posteriores compilen contra contratos correctos, incluyendo `MatchState`, `RoundState`, eventos de WebSocket (`WsEvent` o equivalente discriminado por `eventType`) y los enumerados de palo de carta y de cantos/respuestas de truco (con los valores **case‑sensitive** que define el contrato `docs/CONTRATOS_API.md`).
- **FR-004**: Los enumerados DEBEN exponer los valores tal como los acepta el backend (mayúsculas, sin acentos), de modo que el código de aplicación pueda compararlos y serializarlos sin transformaciones ad‑hoc dispersas.

**Persistencia de sesión (AuthStore)**

- **FR-005**: El store de autenticación DEBE guardar como mínimo `playerId`, `accessToken`, `refreshToken` y `isGuest`, y exponer señales para consultar "¿hay sesión?", "¿es invitado?" y los valores individuales.
- **FR-006**: El store DEBE persistir los datos de sesión entre recargas de pestaña, y restaurarlos al iniciar la app si están completos y válidos en forma.
- **FR-007**: El store DEBE ofrecer una operación atómica de "limpiar sesión" que borre todos los campos persistidos y notifique a la app de la nueva ausencia de sesión en el mismo ciclo de cambio.

**Servicio de Auth**

- **FR-008**: La aplicación DEBE exponer un servicio de autenticación con operaciones para los cinco flujos del backend: registro de cuenta, inicio de sesión, alta de invitado, refresco de token y cierre de sesión.
- **FR-009**: Tras una respuesta exitosa de registro, login o alta de invitado, el servicio DEBE poblar el store con la sesión recibida en un único paso, antes de resolver la operación al llamador.
- **FR-010**: La operación de cierre de sesión DEBE intentar notificar al backend y, en todo caso, limpiar el store y los datos persistidos localmente; un fallo de red en logout NO debe dejar al usuario "atrapado" en sesión.

**Refresh automático**

- **FR-011**: Cuando una llamada protegida reciba una respuesta que indique expiración del `accessToken`, el sistema DEBE intentar un refresh usando el `refreshToken` actual y reintentar **una sola vez** la llamada original con el nuevo token, de forma transparente para el código de aplicación.
- **FR-012**: Mientras haya un refresh en curso, todas las demás llamadas protegidas que reciban el mismo error de expiración DEBEN esperar al resultado del refresh en lugar de disparar refresh adicionales; al finalizar el refresh exitoso, esas llamadas DEBEN reintentarse con el nuevo token.
- **FR-013**: Si el refresh falla (token inválido, expirado, revocado o error de red persistente tras la política de reintento normal), el sistema DEBE cerrar la sesión, redirigir al usuario a `/login` y preservar la URL original para retomarla tras un nuevo login exitoso.
- **FR-014**: Las llamadas al endpoint de autenticación (login, register, guest, refresh) NO DEBEN ser interceptadas por la lógica de "añadir Bearer" ni por la de "refrescar al 401", para evitar bucles.

**Interfaz de usuario y rutas**

- **FR-015**: La aplicación DEBE exponer una ruta pública `/login` con un formulario para iniciar sesión.
- **FR-016**: La aplicación DEBE exponer una ruta pública `/register` con un formulario para crear una cuenta nueva.
- **FR-017**: La pantalla de bienvenida o de login DEBE ofrecer una acción visible "Jugar como invitado" que dispare el flujo de alta de invitado sin pedir datos.
- **FR-018**: El acceso a rutas protegidas estando sin sesión DEBE redirigir a `/login` y, tras un login exitoso, volver a la ruta originalmente solicitada.
- **FR-019**: Estando autenticado, abrir `/login` o `/register` DEBE redirigir al lobby (no se muestran formularios de auth a usuarios ya autenticados).
- **FR-020**: Los formularios DEBEN validar inline los campos requeridos antes de enviar, mostrar errores devueltos por el backend en lenguaje claro, y bloquear el botón de envío mientras la petición esté en curso.

**Coherencia visual**

- **FR-021**: Las pantallas de login, registro y bienvenida DEBEN respetar las pautas visuales y de copy del prototipo en `public/referencias/Truco a 3 - Prototipo clickable.html` (paleta, tipografía, jerarquía y textos), aceptando adaptaciones menores propias del paso a componentes reales.

### Key Entities *(include if feature involves data)*

- **AuthResponse**: representación canónica de la sesión devuelta por el backend. Atributos clave: `playerId` (identidad estable del jugador), `accessToken` (credencial de corta duración para llamadas protegidas), `refreshToken` (credencial de larga duración para obtener nuevos accessToken), `accessTokenExpiresIn` (duración del accessToken en segundos), `isGuest` (si la sesión corresponde a un invitado).
- **AuthSession (estado en el store)**: subconjunto persistido derivado de `AuthResponse`, suficiente para reanudar al usuario tras recarga: `playerId`, `accessToken`, `refreshToken`, `isGuest`. Otros datos derivados (por ejemplo, momento estimado de expiración) pueden mantenerse en memoria.
- **MatchState / RoundState**: representación del estado de una partida y de su ronda activa, conforme al contrato de la API. Necesarios como cimiento para que features futuras compilen contra los nombres y formas correctas (no se consumen en esta feature, pero quedan definidos).
- **WsEvent**: unión discriminada de eventos recibidos por WebSocket (por ejemplo, eventos de partida, lobby, social, logros), identificados por un campo `eventType`. Igual que MatchState/RoundState, queda definido aquí para cimentar el resto.
- **Enumerados de juego**: `Suit` (palos: `COPA`, `ESPADA`, `BASTO`, `ORO`) y los cantos/respuestas de truco y envido (por ejemplo, `QUIERO`, `NO_QUIERO`, `FALTA_ENVIDO`, etc.), respetando exactamente los literales **case‑sensitive** del contrato.
- **Credenciales de login / Datos de registro**: formularios de entrada del usuario; sus campos exactos los define el contrato del backend, pero conceptualmente cubren identificador, secreto, y, en registro, los datos mínimos para crear la cuenta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante puede pasar de cargar la app a estar dentro del lobby como invitado en **menos de 10 segundos** y en **no más de 2 clics** desde la pantalla inicial.
- **SC-002**: Un usuario registrado puede completar el login y aterrizar en el lobby en **menos de 30 segundos** desde que la pantalla de login es interactiva, asumiendo que conoce sus credenciales.
- **SC-003**: Durante una sesión activa, **el 100% de las llamadas protegidas** que recibirían un error de expiración se resuelven satisfactoriamente sin intervención del usuario gracias al refresh transparente (medido sobre los flujos cubiertos por las historias P1 y P2).
- **SC-004**: Frente a un `refreshToken` rechazado, el usuario llega a `/login` con un aviso comprensible en **menos de 2 segundos** desde el fallo, y al volver a iniciar sesión retoma la ruta que estaba intentando visitar.
- **SC-005**: La capa de modelos queda alineada al contrato: una búsqueda en el repositorio del literal `username` como identidad de sesión, o de campos de `AuthResponse` ausentes en el backend, **no devuelve resultados** fuera de documentación o pruebas históricas.
- **SC-006**: Ningún componente fuera de la capa de auth necesita conocer cómo se obtiene o refresca el token: el resto del código consume sesión y dispara HTTP sin saber del `refreshToken` (verificable por revisión: cero referencias a `refreshToken` fuera del store, el servicio de auth y el interceptor).
- **SC-007**: Tras un cierre de sesión, no queda en almacenamiento local ningún dato de sesión (`playerId`, `accessToken`, `refreshToken`, `isGuest`).

## Assumptions

- El backend descrito en `docs/CONTRATOS_API.md` y servido en `http://localhost:8080/api` está disponible durante el desarrollo, y su contrato es la referencia autoritativa para nombres de campos, enumerados y códigos de estado.
- Existe un interceptor HTTP en la app que ya añade el `Authorization: Bearer …` a las llamadas protegidas; esta feature lo extiende con la lógica de refresh reactivo, no lo reemplaza por completo.
- El almacenamiento persistente disponible es el del navegador del usuario (per‑origin); no se contempla en esta feature un mecanismo de "recordarme" entre dispositivos.
- La recuperación de contraseña, el login federado (Google, Apple, etc.) y la verificación por email quedan **fuera de alcance** de esta feature y se tratarán por separado.
- El idioma de la interfaz es español rioplatense, consistente con el prototipo.
- Los textos finales (copy) de errores y CTAs pueden ajustarse durante la implementación; lo que esta spec fija es el comportamiento, no la redacción literal.
- La identidad de invitado es local al backend (no anónima/sin servidor): cada alta de invitado genera credenciales reales que el backend reconoce hasta que expiran o se cierran.
- El prototipo `public/referencias/Truco a 3 - Prototipo clickable.html` se usa como referencia de UX/UI para login, registro y bienvenida; no es un contrato cerrado y puede haber ajustes menores en la implementación.
