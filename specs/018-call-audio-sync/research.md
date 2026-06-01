# Research: Audio sincronizado de cantos

## Decision: disparar audio desde el evento visible, no desde la accion del usuario

**Rationale**: El mensaje visual del canto ya aparece en `MatchScreenComponent.handleMatchEvent()` despues de que `MatchEventQueueService` aplica los delays existentes. Reproducir el audio en ese mismo punto garantiza sincronizacion con el texto y evita sonidos para acciones que el backend rechace o que aun no hayan sido confirmadas por el flujo de partida.

**Alternatives considered**:
- Reproducir al presionar botones de accion: rechazado porque se adelanta al delay y puede sonar aunque el backend rechace.
- Reproducir al recibir WebSocket crudo: rechazado porque ignora la cola de delays y los gates por ACK.
- Reproducir desde el reducer: rechazado porque mezcla experiencia sonora con transformacion de estado.

## Decision: crear un servicio de audio dentro de la feature match

**Rationale**: La reproduccion de sonidos es una preocupacion de presentacion/aplicacion, no de dominio. Un servicio dedicado permite mapear claves de canto a assets, reiniciar reproducciones desde el comienzo y encapsular fallos de `play()` sin contaminar componentes con detalles de Web Audio.

**Alternatives considered**:
- Agregar reproduccion directa en `MatchScreenComponent`: viable pero dispersa el mapeo y dificulta testear fallos.
- Servicio global en `core`: rechazado por alcance. La feature actual solo cubre cantos de partida.
- Interfaz abstracta con metodos default: rechazado por guardarrail del proyecto y porque no aporta valor.

## Decision: usar `HTMLAudioElement` para archivos cortos locales

**Rationale**: Los audios son archivos locales cortos, un disparo por evento visible. `HTMLAudioElement` es suficiente, simple de testear con mocks y evita complejidad de Web Audio API. Cada reproduccion debe poner `currentTime = 0` antes de `play()` para repetir el mismo canto desde el inicio.

**Alternatives considered**:
- Web Audio API: rechazado por complejidad innecesaria para sonidos simples.
- Libreria externa de audio: rechazada porque no hace falta sumar dependencia.
- Elementos `<audio>` en template: rechazado porque el flujo depende de eventos de partida, no de estado visual declarativo.

## Decision: tratar fallos de audio como no bloqueantes

**Rationale**: Los navegadores pueden bloquear reproduccion si no hubo interaccion suficiente, puede faltar un asset o fallar la carga. La partida debe continuar: el mensaje visual es la fuente principal y el audio es una mejora de experiencia.

**Alternatives considered**:
- Mostrar error visible si falla audio: rechazado porque interrumpe la partida por una mejora secundaria.
- Reintentar automaticamente en loop: rechazado porque puede causar ruido, duplicados o consumo innecesario.

## Decision: documentar README, no `CONTRATOS_API.md`

**Rationale**: Los assets y sus nombres son convencion del frontend. `docs/CONTRATOS_API.md` ya documenta eventos y enums usados; no hay cambio REST ni WebSocket. El README debe incluir ubicacion y nombres de grabaciones para que el propietario del juego pueda reemplazarlas.

**Alternatives considered**:
- Documentar audios en `CONTRATOS_API.md`: rechazado porque no es contrato backend.
- No documentar: rechazado porque FR-009 exige pautas minimas para preparar grabaciones.
