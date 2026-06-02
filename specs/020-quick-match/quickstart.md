# Quickstart: Quick Match

## Objetivo de verificación

Validar que un jugador puede iniciar Partida rápida desde el lobby, quedar buscando, cancelar, y
navegar automáticamente a la partida cuando el emparejamiento se completa.

## Pasos manuales

1. Iniciar backend local y frontend:

   ```bash
   pnpm start
   ```

2. Entrar con un usuario autenticado.

3. Abrir `/lobby`.

4. Verificar que aparece el CTA **Partida rápida** con la misma estructura que los otros modos.

5. Entrar a **Partida rápida**.

6. Verificar estado inicial:
   - Selector de serie visible.
   - Default **Mejor de 3**.
   - CTA **Buscar rival** visible.
   - Acción para volver al lobby visible.

7. Cambiar el formato a **Mejor de 1** o **Mejor de 5** y presionar **Buscar rival**.

8. Si no hay rival:
   - Ver estado **Buscando rival**.
   - Ver formato elegido.
   - Presionar **Cancelar búsqueda**.
   - Confirmar regreso a estado operable.

9. Con dos sesiones/usuarios:
   - Usuario A entra a Partida rápida con **Mejor de 3**.
   - Usuario B entra a Partida rápida con **Mejor de 3**.
   - Verificar que ambos navegan a `/match/:matchId`.

## Verificación automatizada esperada

```bash
pnpm test
pnpm lint
pnpm lint:styles
pnpm lint:themes
pnpm lint:hover
pnpm build
```

Nota del proyecto: no ejecutar tests por clase; correr la suite completa.

## Casos de regresión

- Lobby sigue navegando a bots, online y reglas.
- Crear partida privada sigue enviando `gamesToPlay` `{1,3,5}`.
- Unirse por código no cambia.
- Match screen carga correctamente al navegar desde quick match.
- Ningún error visible muestra `ApiError.message`.
