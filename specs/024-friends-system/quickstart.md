# Quickstart: Sistema de amigos (MVP solo amistades)

**Feature**: 024-friends-system

## Prerrequisitos

- Backend de truco-to-three corriendo en `http://localhost:8080` con la capa social habilitada.
- Dos cuentas **registradas** (no guest) para probar el flujo completo (enviar/recibir).
- `pnpm install` ejecutado.

## Levantar el front

```bash
pnpm start   # http://localhost:4200
```

## Flujo manual de verificación

1. Iniciá sesión con la cuenta A (registrada). En el header debe aparecer el acceso a **Amigos**
   (no debe verse con cuenta guest → verifica FR-014 / SC-006).
2. Entrá a `/friends`. Se cargan las tres pestañas (Amigos, Recibidas, Enviadas) con su estado
   vacío/poblado.
3. En "Agregar amigo", ingresá el username de la cuenta B y enviá. Debe aparecer en **Enviadas**.
   - Probá ingresar tu propio username → bloqueado con mensaje claro (FR-003).
   - Probá un username inexistente → error de copy del front, sin entrada duplicada (FR-004/FR-015).
4. En otra sesión/navegador, iniciá con la cuenta B → en `/friends` la solicitud aparece en
   **Recibidas** sin recargar (FR-012).
5. Aceptá desde B. En A, la cuenta B debe pasar a **Amigos** en < 3 s sin recargar (SC-002), y
   desaparecer de **Enviadas**.
6. Desde A o B, eliminá la amistad → desaparece de **Amigos** en ambas sesiones (FR-011, US3).
7. Repetí enviando y luego **Cancelando** desde A → desaparece de Enviadas y de Recibidas de B
   (US4).
8. Probá responsive a 360 px (DevTools) → sin desbordes, controles accesibles (SC-005).

## Verificación automática

```bash
pnpm lint          # ESLint TS/HTML
pnpm lint:styles   # tokens --t3-… (sin colores hardcodeados)
pnpm lint:themes   # botones t3-btn (sin Material crudos)
pnpm lint:hover    # :hover gateado
pnpm test          # unit + contract (incluye el contract test social si se agrega)
pnpm build         # compila sin errores
```

## Puntos de atención (guardarraíles)

- **Errores**: toda copy de error sale de `getErrorCopy('SOCIAL', err)`; nunca `ApiError.message`.
- **SCSS**: solo `var(--t3-…)`. Si falta un token, agregarlo primero en `src/styles.scss`.
- **Botones**: `t3-btn t3-btn--primary | --neutral | --destructive` (Eliminar/Rechazar usan
  `--destructive`).
- **Hover**: cualquier `:hover` que cambie apariencia va dentro de `@media (hover: hover)`.
- **WS**: la suscripción a `/user/queue/social` solo se activa para usuarios registrados.
