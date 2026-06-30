# Truco API - Contratos para Frontend

Este es el **índice** de los contratos que expone el backend para el equipo de FE. El contenido
está dividido por dominio en la carpeta [`contratos/`](contratos/):

- REST HTTP (request/response)
- Autenticacion (JWT)
- WebSocket/STOMP (eventos en tiempo real)
- Estados, enums y formato de errores

Las reglas del juego y la variante a 3 puntos se documentan en [`REGLAS_JUEGO.md`](REGLAS_JUEGO.md)
y
[`REGLAS_VARIANTE.md`](REGLAS_VARIANTE.md). La pantalla de reglas accesible desde el lobby del
frontend usa contenido local y no agrega un contrato de backend.

Base URL (local):

- `http://localhost:8080`

## Índice de contratos

| Documento                                                            | Contenido                                                                                                                      |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| [00 · Convenciones generales](contratos/00-convenciones.md)          | Autenticacion y reglas generales, tokens, salas públicas/privadas, contrato de errores, enums y valores permitidos             |
| [01 · Auth](contratos/01-auth.md)                                    | Registro, login, invitado, refresh de sesión, identidad y logout                                                               |
| [02 · Matches](contratos/02-matches.md)                              | Crear/unirse/listar partidas, jugar, cantos, spectate, rematch y temporizador de turno                                         |
| [03 · Leagues](contratos/03-leagues.md)                              | Crear/unirse/listar ligas, iniciar y estado                                                                                    |
| [04 · Copas](contratos/04-copas.md)                                  | Crear/unirse/listar copas, bracket, estados y avance automático                                                                |
| [05 · Chat](contratos/05-chat.md)                                    | Enviar y obtener mensajes, chat por recurso padre                                                                              |
| [06 · Social](contratos/06-social.md)                                | Amistades, invitaciones sociales y expiración configurable                                                                     |
| [07 · Perfil, presencia y campaña](contratos/07-perfil-presencia.md) | Perfil de jugador, logros, historial de partidas, presencia/reconexión y modo campaña                                          |
| [08 · Bots](contratos/08-bots.md)                                    | Listar bots, partida vs bot, bot-vs-bot y quick match                                                                          |
| [09 · WebSocket / STOMP](contratos/09-websocket.md)                  | Transporte: conexión, auth, suscripciones, envelope y `stateVersion`. Los `eventType`/payloads viven en el doc de cada dominio |
| [10 · Flujos y notas para FE](contratos/10-flujos-fe.md)             | Flujo de autenticación recomendado y notas para el frontend                                                                    |
