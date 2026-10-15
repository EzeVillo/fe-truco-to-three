# Truco en ezevillo.com/truco-a-3

## Arquitectura

```text
ezevillo.com/                  → sitio actual / futuro portfolio
ezevillo.com/truco-a-3/*        → sitio Netlify del juego (mismo equipo)
                                /truco-a-3/* en el origen
frontend → truco-api.ezevillodev.workers.dev → api-truco-to-three.onrender.com
```

El proxy de Netlify sólo entrega el frontend. Cloudflare Worker `truco-api` recibe
REST y WebSocket por HTTPS/WSS, limita por IP/ruta y reenvía al origen en Render.
No se reservan `/api`, `/ws`, `/assets` o la raíz del dominio del portfolio para el juego.
No se modifican el DNS ni el Worker de IBIT.

El frontend usa `https://truco-api.ezevillodev.workers.dev` en `environment.prod.ts`.
Render exige una clave privada del Worker cuando `TRUCO_GATEWAY_ENABLED=true`; esa
clave no se incluye en el frontend ni reemplaza el JWT del usuario. Los probes exactos
de salud conservan acceso directo para Render. No llamar al origen como fallback:
permitiría saltear el rate limiter y se rechaza con `403`.

Límites iniciales por minuto/IP: general 300, login 10, registro 5, invitados 10,
refresh 60 y apertura WebSocket/info SockJS 20. Los contadores son aproximados y por
ubicación de Cloudflare. No se cuentan preflights ni frames WebSocket ya abiertos;
el chat mantiene su cooldown. El `429` incluye `Retry-After: 60` expuesto por CORS y
se muestra con copia controlada del frontend, sin reintentos automáticos de POST.

## Configuración publicada

Migración publicada el 15 de octubre de 2026 en el equipo Netlify `ezevillo`:

| Sitio Netlify | Función | Repositorio y rama |
| --- | --- | --- |
| `ezevillo-truco-a-3` | Origen del juego: `https://ezevillo-truco-a-3.netlify.app/truco-a-3/` | `fe-truco-to-three`, `master` |
| `neon-macaron-a52e5c` | Dueño de `ezevillo.com`; conserva IBIT y Git Review y añade el proxy de Truco | `ibit-to-btc`, `main` |

Ambos sitios tienen publicación continua desde GitHub. El build del juego en Netlify
verifica el prefijo y la PWA. La regla del dominio principal vive en el `netlify.toml`
de `ibit-to-btc`; su publicación conservó los hashes de los archivos de contenido,
el código de la función de tasas y su horario. Sólo cambiaron la configuración de rutas
y un manifiesto interno de Netlify. No se publicó el portfolio local.

GitHub Pages se deshabilitó y su API devuelve `404`; el workflow anterior está eliminado.
Render tiene el perfil `prod` y los CORS sin GitHub Pages. El release nativo comprueba
readiness contra PostgreSQL, logging sin cuerpos y rechazo de acceso directo al activar
la protección del gateway en runtime. El código de producción está en el
[PR 33 del backend](https://github.com/EzeVillo/api-truco-to-three/pull/33), cuya integración
requiere la revisión exigida por GitHub antes de futuras releases desde `master`.

## Build del sitio del juego

```powershell
pnpm install --frozen-lockfile
pnpm run build:netlify
```

`netlify.toml` publica `dist/netlify`, cuyo único contenido de aplicación está dentro de
`truco-a-3/`. Se conservan los prefijos tanto en el sitio origen como en el proxy, lo que
permite probar el mismo path en el subdominio Netlify y en el dominio público.

El fallback de Angular está acotado a `/truco-a-3/*`; los archivos existentes se sirven
normalmente y las rutas de navegación reciben `/truco-a-3/index.html`. No usar `force`
en el fallback del sitio hijo: devolvería HTML en lugar de JavaScript, imágenes o el worker.

`baseHref` vive en la configuración `netlify`, sin modificar el desarrollo local.
Netlify es el único destino de publicación web; se elimina el workflow de GitHub Pages.
Los enlaces de invitación resuelven contra `document.baseURI`, para conservar el prefijo
del sitio donde se abrió la app. Los metadatos y el sitemap apuntan al dominio nuevo.

El manifest usa `start_url` y `scope` relativos a su ubicación. El worker se registra junto
a la aplicación, bajo `/truco-a-3/`; no debe registrarse en `/ngsw-worker.js` ni con scope `/`.
Verificar en el build que `ngsw.json` sólo contiene URLs bajo `/truco-a-3/`. Se revalidan
los archivos para permitir actualizaciones de la PWA.

## Proxy en el sitio que posee ezevillo.com

`hosting/netlify-portfolio.example.toml` contiene las reglas activas, con el origen real
`ezevillo-truco-a-3.netlify.app`, en el **mismo equipo de Netlify**. Conservar `/truco-a-3/`
en el destino. La regla va antes de un catch-all y preserva todas las otras rutas del sitio.

El portfolio local `../ezevillo` aún no es el sitio publicado: su README advierte que
el deploy actual de la raíz también sirve IBIT y Git Review. No reemplazar ese deploy
por el portfolio sin trasladar previamente sus reglas y recursos. Para esta migración,
agregar únicamente el proxy de Truco al deploy actual; no modificar el HTML de la raíz.
Cuando se publique el portfolio, trasladar también esta regla.

Netlify no interpola variables de entorno dentro del campo `to` de los redirects TOML.
Si se cambia el sitio origen, actualizar ambas reglas con el hostname real antes de publicar.
El `/robots.txt` del juego está bajo su subruta y no reemplaza el del portfolio;
se puede registrar `https://ezevillo.com/truco-a-3/sitemap.xml` en Search Console.

## Backend

La API pública es el Worker; el origen que debe autorizar el backend es `https://ezevillo.com`,
sin path. La configuración final no autoriza el sitio anterior de GitHub Pages.
La variable `TRUCO_ALLOWED_ORIGINS` se comparte entre CORS y WebSocket.
Actualizar también su valor **en el servicio de Render**, porque la variable externa
prevalece sobre el YAML del backend. La herramienta MCP de Render actualiza las variables
y dispara un redespliegue para aplicarlas; verificar ese deploy y no duplicarlo manualmente.

El backend tiene su guía en `docs/PRODUCCION.md` del repositorio `api-truco-to-three`: el perfil `prod`
debe estar activo al compilar el nativo y al ejecutarlo. Publicar esa imagen antes de
considerar aplicados los cambios de logging y exposición de diagnósticos.

## Publicación y rollback

1. Tests, lint y build de ambos repos; verificar los archivos generados.
2. Preparar los orígenes autorizados del backend y publicar su imagen verificada.
3. Publicar el Worker y su secreto; publicar el FE que usa su URL y sólo entonces
   activar `TRUCO_GATEWAY_ENABLED` junto a `TRUCO_GATEWAY_SECRET` en Render. La clave
   debe coincidir con `GATEWAY_SECRET` de Cloudflare y ser independiente del JWT.
   El Worker y sus comandos están en `gateway/` del repo backend.
4. Incorporar el proxy al sitio actual de `ezevillo.com`, conservando sus otras rutas.
5. La validación visual y de navegación la hace el usuario, según `AGENTS.md`.
6. Cuando el nuevo sitio esté publicado, despublicar GitHub Pages desde la configuración
   del repositorio o con `gh api --method DELETE repos/EzeVillo/fe-truco-to-three/pages`.
   Verificar por la API de GitHub que Pages ya no esté habilitado. El workflow anterior
   debe permanecer desactivado durante la transición y eliminado al integrar este cambio.
7. Ante un fallo, restaurar un deploy anterior de Netlify. Si el frontend anterior llama
   directo a Render, primero desactivar temporalmente la protección del gateway en Render;
   eso abre el bypass y debe revertirse al terminar la incidencia. No reactivar la publicación
   en GitHub Pages, reemplazar la raíz del dominio ni modificar el DNS para apuntar al juego.

El cambio de `ezevillo.github.io` a `ezevillo.com` implica un nuevo origen: las sesiones y
preferencias guardadas en localStorage no se transfieren automáticamente. Los usuarios
registrados pueden volver a iniciar sesión; un invitado no conserva su sesión anterior.
Las instalaciones previas de la PWA siguen asociadas al origen anterior.

## Verificación sin navegador

```powershell
pnpm lint
pnpm lint:styles
pnpm lint:themes
pnpm lint:hover
pnpm lint:audio
pnpm test --watch=false
pnpm run build:netlify
```

No se levanta el dev server ni se hacen pruebas manuales en runtime desde el agente.

## Referencias

- [Proxies entre sitios Netlify](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
- [Orden de redirects](https://docs.netlify.com/manage/routing/redirects/overview/)
- [Ingreso HTTPS de Render](https://render.com/docs/web-services)
- [AOT y perfiles](https://docs.spring.io/spring-boot/how-to/aot.html)
