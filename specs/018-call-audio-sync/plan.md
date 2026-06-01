# Implementation Plan: Audio sincronizado de cantos

**Branch**: `018-call-audio-sync` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-call-audio-sync/spec.md`

**Note**: Este plan fue generado por `/speckit-plan`. El script Bash oficial de setup no pudo ejecutarse en este entorno porque no existe `/bin/bash`; se reprodujo su salida usando `.specify/feature.json`.

## Summary

Agregar reproduccion de audios locales para todos los cantos presentes en `public/audio/calls/`, iniciando el sonido exactamente cuando el mensaje visual del canto se muestra en pantalla. La integracion se apoya en el flujo existente de eventos de partida ya demorado por `MatchEventQueueService`, por lo que el audio se dispara desde el mismo punto donde `MatchScreenComponent` actualiza `selfCallText` u `opponentCallText`.

La feature no modifica reglas de truco-to-three, scoring, DTOs, endpoints ni contrato WebSocket. Solo agrega una capa de experiencia sonora asociada a eventos visibles.

## Technical Context

**Language/Version**: TypeScript con Angular 21 standalone components.

**Primary Dependencies**: Angular, RxJS, Vitest, Web APIs de audio del navegador (`HTMLAudioElement`).

**Storage**: Assets estaticos en `public/audio/calls/`. No hay persistencia nueva.

**Testing**: `pnpm test` para unit tests existentes y nuevos. No ejecutar tests por clase. Validacion manual con `pnpm start` para sincronizacion perceptible de audio y mensaje.

**Target Platform**: Aplicacion web responsive con minimo 360 px y desktop 1024 px+.

**Project Type**: Frontend Angular.

**Performance Goals**: El inicio de audio para un canto visible debe ocurrir en el mismo tick de aplicacion que la actualizacion del mensaje visual, sin agregar delay perceptible extra.

**Constraints**: No reproducir audio al click de accion; reproducir solo cuando el evento visible ya fue aplicado. El fallo de audio no bloquea UI ni flujo de partida. No agregar NgModules. No introducir SCSS salvo que sea estrictamente necesario; si se agrega, usar tokens `var(--t3-...)`.

**Scale/Scope**: 10 audios locales: `envido.mp3`, `falta-envido.mp3`, `me-voy-al-mazo.mp3`, `no-quiero.mp3`, `quiero.mp3`, `quiero-y-me-voy-al-mazo.mp3`, `real-envido.mp3`, `retruco.mp3`, `truco.mp3`, `vale-cuatro.mp3`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: No se preve SCSS nuevo. Si surge una UI de control de audio en otra feature, debera usar `var(--t3-...)` y verificar con `pnpm lint:styles`.
> - [x] **Validacion de contrato**: No se agregan ni modifican DTOs/endpoints. Se verifico que `docs/CONTRATOS_API.md` ya documenta los eventos `TRUCO_CALLED`, `TRUCO_RESPONDED`, `ENVIDO_CALLED`, `ENVIDO_RESOLVED` y `FOLDED`, y enums `ENVIDO`, `REAL_ENVIDO`, `FALTA_ENVIDO`, `QUIERO`, `NO_QUIERO`, `QUIERO_Y_ME_VOY_AL_MAZO`.
> - [x] **CTAs verticales**: No se agregan CTAs.
> - [x] **Copy de errores**: Los fallos de audio no se muestran como error de backend ni consumen `ApiError.message`; se silencian para no bloquear la partida.
> - [x] **Reglas de juego**: No se toca scoring, series ni `gamesToPlay`.

## Project Structure

### Documentation (this feature)

```text
specs/018-call-audio-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── audio-call-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
public/
└── audio/
    └── calls/
        ├── envido.mp3
        ├── falta-envido.mp3
        ├── me-voy-al-mazo.mp3
        ├── no-quiero.mp3
        ├── quiero.mp3
        ├── quiero-y-me-voy-al-mazo.mp3
        ├── real-envido.mp3
        ├── retruco.mp3
        ├── truco.mp3
        └── vale-cuatro.mp3

src/app/features/match/
├── pages/match-screen/
│   ├── match-screen.component.ts
│   └── match-screen.component.spec.ts
├── services/
│   ├── match-call-audio.service.ts
│   └── match-call-audio.service.spec.ts
└── utils/
    ├── call-display-mapper.ts
    └── call-display-mapper.spec.ts

README.md
```

**Structure Decision**: Mantener el audio dentro de la feature `match` porque depende de eventos visibles de partida y no pertenece al dominio central de reglas. Crear un servicio de aplicacion/presentacion para reproducir audios, sin acoplarlo a `MatchActionsService` ni al reducer de estado. Actualizar `README.md` para documentar nombres de archivos y ubicacion de grabaciones. No actualizar `docs/CONTRATOS_API.md` porque no hay cambios de contrato.

## Phase 0: Research

Ver [research.md](./research.md).

## Phase 1: Design & Contracts

Ver [data-model.md](./data-model.md), [contracts/audio-call-contract.md](./contracts/audio-call-contract.md) y [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

> **Checklist obligatorio para este proyecto (truco-to-three)**:
> - [x] **Tokens CSS**: El diseno no requiere estilos nuevos.
> - [x] **Validacion de contrato**: El contrato backend queda intacto; el contrato interno de esta feature mapea eventos existentes a audios locales.
> - [x] **CTAs verticales**: No aplica.
> - [x] **Copy de errores**: Los fallos de reproduccion son no bloqueantes y no visibles como errores de API.
> - [x] **Reglas de juego**: No aplica cambios de reglas.

## Complexity Tracking

No hay violaciones de constitucion ni complejidad excepcional que justificar.
