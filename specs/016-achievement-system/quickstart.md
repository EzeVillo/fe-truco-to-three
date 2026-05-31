# Quickstart: Sistema de logros

## Preconditions

- Backend local disponible en `http://localhost:8080`.
- Contratos actualizados en `docs/CONTRATOS_API.md`.
- Dependencias instaladas con `pnpm install`.

## Development Flow

1. Actualizar modelos de auth para incluir `username` en sesiones registradas y soportar sesiones legacy sin username.
2. Agregar rehidratacion de identidad actual cuando una sesion registrada persistida no tenga username.
3. Agregar modelos de perfil/logros y contrato WebSocket de perfil.
4. Crear servicio REST de perfil y mapeo de errores de perfil.
5. Crear catalogo visible de logros y fallback para codigos desconocidos.
6. Crear pagina de perfil y ruta `/profile/:username`.
7. Actualizar header para mostrar username y link a perfil propio en usuarios registrados.
8. Agregar servicio global de notificaciones de logros para `/user/queue/profile`.
9. Inicializar el servicio desde el shell autenticado de la aplicacion.
10. Agregar tests unitarios y de contrato enfocados.

## Verification

Ejecutar siempre el set completo permitido por el proyecto:

```bash
pnpm test
pnpm lint
pnpm lint:styles
pnpm lint:themes
pnpm build
```

No ejecutar tests por clase individual.

## Manual Acceptance

1. Login con usuario registrado.
2. Verificar que el header muestra el username.
3. Abrir el perfil propio desde el header.
4. Verificar stats, logros o estado vacio.
5. Abrir `/profile/<otro-usuario>` con un usuario existente.
6. Abrir `/profile/<usuario-inexistente>` y verificar copy de no encontrado.
7. Iniciar sesion como invitado y verificar que no aparece acceso a perfil propio.
8. Provocar o simular `ACHIEVEMENT_UNLOCKED` y verificar notificacion visible.
9. Confirmar que partidas contra bots no generan aviso ni logro visible.
