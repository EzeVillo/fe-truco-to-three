# Quickstart — Probar la partida privada por código

Cómo verificar el MVP de punta a punta, en local. Requiere el backend corriendo en
`http://localhost:8080` y el front en `http://localhost:4200` (`pnpm start`).

## Requisitos previos

- Backend up (matches/auth/WS).
- **Dos sesiones de usuario distintas**: usar dos navegadores o un navegador + ventana de incógnito,
  cada una autenticada con un usuario diferente (login, registro o invitado).

## Flujo feliz (US1 + US2 + US3)

1. **Anfitrión** (sesión A): `Lobby → Crear partida online`. Elegir formato (ej. Mejor de 3) y crear.
2. Verificar que aparece la **sala de espera** con el **código** destacado y un botón **Copiar**, y
   el texto "Esperando rival…". (SC-002: < 30 s)
3. **Invitado** (sesión B): `Lobby → Unirme con código`. Pegar el código y unirse.
4. Verificar que el invitado entra a la sala y ve al anfitrión; y que en la sesión A el **anfitrión ve
   al rival** y se **habilita Iniciar** sin recargar. (SC-003: < 3 s)
5. **Anfitrión**: pulsar **Iniciar**. Ambas sesiones deben transicionar al **tablero** y poder jugar
   la primera mano. (FR-007, SC-005)
6. Jugar hasta el final y verificar que el resultado/serie y la revancha se comportan igual que contra
   bots. (FR-008)

## Casos de salida y cancelación (US4)

- **Anfitrión sale antes de iniciar**: en la sala, pulsar **Salir**. La partida queda cancelada; si el
  invitado estaba presente, debe ver un **aviso** y volver al lobby. (FR-009/FR-010)
- **Invitado sale antes de iniciar**: el invitado pulsa **Salir**; el anfitrión debe volver a
  "Esperando rival…" conservando el **mismo código** para que entre otra persona. (FR-009)

## Casos de error (FR-011)

- **Código inexistente**: unirse con un código inventado → mensaje "Ese código no corresponde a
  ninguna partida" y posibilidad de reintentar (sin pantalla rota).
- **Partida llena**: con la partida ya con dos jugadores, un tercero intenta unirse con el mismo
  código → mensaje de que no hay lugar.
- **Jugador ocupado**: estando ya en una partida activa, intentar crear o unirse → mensaje de
  impedimento, sin estado inconsistente.
- **Autounión**: el anfitrión intenta unirse a su propio código → impedido (ya está dentro).

## Reconexión (FR-013)

- En la sala de espera, cortar la red (o cerrar/reabrir la pestaña en la misma sesión) y volver: la
  sala debe mostrar el estado real (rival presente o no; o aviso si ya no existe). El **código debe
  seguir visible/copiable** para el anfitrión (mitigación `sessionStorage`, D5).

## Verificación automatizada

```bash
pnpm lint            # ESLint
pnpm lint:styles     # tokens CSS en SCSS de feature
pnpm lint:themes     # CTAs tematizados (no mat-*-button)
pnpm test            # unit + contract (incluye private-match.contract.spec.ts)
pnpm build           # compilación Angular
```

El contract test falla si los DTOs/eventos divergen de `docs/CONTRATOS_API.md`
(§4.1/§4.2/§4.5/§4.13/§4.14/§9.6).
