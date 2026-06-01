# Quickstart: Audio sincronizado de cantos

## Preparacion

1. Confirmar que los audios existen en `public/audio/calls/`:

```text
envido.mp3
falta-envido.mp3
me-voy-al-mazo.mp3
no-quiero.mp3
quiero.mp3
quiero-y-me-voy-al-mazo.mp3
real-envido.mp3
retruco.mp3
truco.mp3
vale-cuatro.mp3
```

2. Usar `pnpm install` si faltan dependencias.

3. Ejecutar la app con:

```bash
pnpm start
```

## Verificacion manual

1. Abrir una partida en curso.
2. Disparar cantos propios y del rival.
3. Verificar que el audio suene cuando aparece el mensaje visual, no al click del boton.
4. Verificar estos casos:
   - `Truco`, `Retruco`, `Vale cuatro`
   - `Envido`, `Real envido`, `Falta envido`
   - `Quiero`, `No quiero`
   - `Quiero y me voy al mazo`
   - `Me voy al mazo`
5. Quitar temporalmente un archivo de audio y verificar que el mensaje visual sigue apareciendo y la partida continua.

## Verificacion automatizada esperada

Ejecutar todos los tests permitidos del proyecto:

```bash
pnpm test
```

No ejecutar tests por clase. Los tests nuevos deben cubrir:

- Mapeo de evento visible a archivo de audio.
- Reproduccion desde el inicio en eventos repetidos.
- Fallo de `play()` sin error visible ni interrupcion.
- Integracion con `MatchScreenComponent` en el punto donde se setea el texto visible.

## Documentacion

Actualizar `README.md` con la convencion de nombres y ubicacion de audios. No actualizar `docs/CONTRATOS_API.md` salvo que se cambien eventos o enums del backend.
