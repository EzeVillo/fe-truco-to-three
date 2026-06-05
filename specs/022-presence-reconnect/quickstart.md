# Quickstart: Presencia y reconexion de usuario

## Prerrequisitos

- Backend local corriendo en `http://localhost:8080`.
- Frontend con dependencias instaladas via `pnpm install`.
- Un usuario autenticado disponible.
- Contrato `docs/CONTRATOS_API.md` con seccion 7.6 presente.

## Probar arranque en frio con partida activa

1. Iniciar el frontend:

   ```bash
   pnpm start
   ```

2. Crear o unirse a una partida humana hasta que el usuario quede ocupado.
3. Abrir otra pestana con la misma sesion en `/lobby` o `/profile/:username`.
4. Refrescar la pestana secundaria.
5. Resultado esperado: la pestana termina en `/match/:matchId` de la partida activa.

## Probar idempotencia

1. Estar en `/match/:matchId` correcto.
2. Forzar una nueva verificacion o recibir un push de presencia con el mismo match.
3. Resultado esperado: no hay navegacion duplicada, reinicio visual ni perdida de estado local.

## Probar usuario libre

1. Finalizar o abandonar la ocupacion activa.
2. Navegar a `/lobby` o `/lobby/reglas`.
3. Refrescar.
4. Resultado esperado: la aplicacion permanece en la ruta elegida.

## Probar revancha abierta

1. Terminar un match casual que abre revancha.
2. Ir a otra ruta autenticada o abrir una segunda pestana.
3. Refrescar.
4. Resultado esperado: la aplicacion vuelve al match de origen y muestra el flujo de revancha existente.

## Probar multi-sesion

1. Abrir dos pestanas con el mismo usuario.
2. Desde una pestana crear o unirse a una partida reconectable.
3. Resultado esperado: ambas pestanas terminan en el mismo match activo.

## Verificaciones automaticas

```bash
pnpm test
pnpm lint
pnpm build
```

Si se agrega SCSS o template nuevo, correr tambien:

```bash
pnpm lint:styles
pnpm lint:themes
pnpm lint:hover
```
