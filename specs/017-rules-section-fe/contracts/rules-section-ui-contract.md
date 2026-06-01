# UI Contract: Sección de reglas de variante en lobby

## Alcance

Este contrato define el comportamiento visible de la sección de reglas de variante. No define
endpoints, DTOs remotos ni WebSocket.

## Ubicación

- El lobby muestra un CTA de reglas junto a los CTAs existentes.
- El CTA navega a `/lobby/reglas`.
- El contenido completo de reglas aparece en la página dedicada de reglas.

## Contenido obligatorio

La sección debe representar todos estos bloques:

1. Objetivo del game: llegar exactamente a `3`; pasarse de `3` pierde.
2. Falta envido: si se quiere, otorga los puntos que le faltan al rival para llegar a `3`.
3. "Quiero y me voy al mazo": el rival gana el truco cantado en ese momento.
4. Cierre automático por ancho de espada: primera mano parda y ancho en segunda; portador ganó primera y juega ancho en segunda; tercera mano; luego no se puede cantar truco.
5. Restricción del jugador mano para irse al mazo en la primera mano: permitido solo si el envido ya fue resuelto o el truco ya fue cantado.

## Interacción esperada

- El usuario puede leer o escanear los bloques desde la página de reglas.
- El usuario puede volver desde la página de reglas al lobby.
- La página no muestra un bloque visual de "Claves".
- Si se usan controles colapsables, todo el contenido debe ser accesible con teclado.
- La sección no debe bloquear los CTAs existentes para jugar contra bots o jugar online.

## Responsividad

- En `360 px` de ancho, títulos, listas y valores críticos deben ser legibles sin solapamiento.
- En desktop, la sección debe mantener jerarquía visual clara y no expandir líneas hasta longitudes incómodas.
- Solo se usa el breakpoint permitido de proyecto: `@media (min-width: 1024px)`.

## Verificación mínima

- Test de componente: renderiza los bloques obligatorios y valores críticos.
- Test de lobby: el lobby incluye un CTA que navega a `/lobby/reglas`.
- Test de página: `/lobby/reglas` renderiza el contenido completo y permite volver al lobby.
