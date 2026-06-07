---
name: audio-architecture
description: Cómo y dónde engancha el audio de partida (SFX de cartas/cantos + música de fondo) respetando el delay por rol.
metadata:
  type: project
---

El audio de partida se sincroniza solo con lo visual gracias a la cola de eventos:
`MatchEventQueueService` aplica cada evento post-delay (local=0ms, rival/espectador=600ms
vía `match-event-delays.config.ts`) y recién ahí `match-state.service` emite `matchEvent$`.
Por eso cualquier SFX disparado al recibir `matchEvent$` ya queda en sync con la carta/canto
apareciendo — no hay que manejar delays a mano.

- **SFX cantos (truco/envido/quiero/…)**: `MatchCallAudioService.playForEvent()` +
  `resolveMatchCallAudioPath()`. Assets en `public/audio/calls/`.
- **SFX carta tirada**: `MatchCallAudioService.playCardThrow()`, disparado en `CARD_PLAYED`
  desde `handleMatchEvent` (match-screen) y `handleCallDisplay` (spectate-screen).
  **OJO**: NO agregar `CARD_PLAYED` a `resolveMatchCallAudioPath` — un contract test exige
  que devuelva `null` para `CARD_PLAYED` (es SFX genérico, no un canto).
- **Música de fondo**: `BackgroundMusicService` (loop, sólo en partida/espectador).
  start/stop en ngOnInit/ngOnDestroy de match-screen y spectate-screen. Default ON a volumen
  bajo (0.15), persistido en localStorage (`t3.bgMusic.*`). Control (icono mute + slider) en
  el menú hamburguesa de `global-header`, visible sólo si `inMatch() || isSpectating()`.
  Autoplay bloqueado: si `play()` es rechazado, reintenta al primer pointerdown/keydown.
  **iOS**: `HTMLMediaElement.volume` es read-only en WebKit (iPhone, Safari y Chrome) —
  asignarlo no hace nada y el slider quedaría inerte. Por eso el audio se enruta por la Web
  Audio API y el volumen se controla con un `GainNode` (`gain.gain.value`), con fallback a
  `audio.volume` cuando no hay Web Audio (desktop/tests). El AudioContext arranca `suspended`
  y se hace `resume()` en el gesto de unlock.

Todo el audio es no-bloqueante: siempre envuelto en try/catch, nunca debe romper el flujo
visual de la partida.
