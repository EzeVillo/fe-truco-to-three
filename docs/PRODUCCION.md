# Truco en truco.ezevillo.com

Estado comprobado el 3 de noviembre de 2026. El frontend está publicado en la
raíz de `https://truco.ezevillo.com/`, con su propio origen y almacenamiento.
No se conserva `/truco-a-3/`, no hay proxy del portfolio y no se mantienen
redirects ni publicación en Netlify/GitHub Pages.

```text
truco.ezevillo.com → ezevillo-truco-a-3 (archivos estáticos y fallback de Angular)
frontend → truco-api.ezevillodev.workers.dev → api-truco-to-three.onrender.com
```

## Build y verificación

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm test --watch=false
pnpm test:hosting
pnpm run build:cloudflare
pnpm run cloudflare:check
```

Angular compila con `baseHref=/` en `dist/cloudflare/`. El checker verifica
canonical, manifest y paths del service worker. La PWA usa scope `/` únicamente
en su subdominio. Los enlaces de invitación se resuelven contra `document.baseURI`.
No se agregan migraciones de sesiones, caches ni instalaciones anteriores.

Cloudflare sirve primero los archivos. El handler interviene ante rutas de
Angular solicitadas como HTML; assets faltantes, JSON y escrituras responden
404. Los headers de seguridad/revalidación se generan después del build.

## Estado y publicaciones siguientes

La zona DNS y el Custom Domain están activos. El usuario configuró los secretos
de Actions `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; el workflow de `master`
publicó correctamente el frontend. Para publicaciones manuales autorizadas,
ejecutar `pnpm run cloudflare:deploy` después del build.

El gateway está actualizado y Render ya aplica
`TRUCO_ALLOWED_ORIGINS=https://truco.ezevillo.com,https://localhost,capacitor://localhost`.
Se verificaron CORS, REST sin sesión, SockJS y apertura/respuesta WebSocket sin
autenticación. Render conservó la misma imagen y los secretos existentes.
El estado del backend se documenta en su propio `docs/PRODUCCION.md`.

Los builds antiguos de Netlify están detenidos. La retirada de sus sitios se
coordina desde `../portfolio/docs/cloudflare-migration.md`.

## Validación pendiente

Completar login, invitaciones, recargas en rutas profundas, eventos de partida,
cartas, audio, manifest y actualización de PWA. La comprobación WebSocket sin
sesión no demuestra esos flujos. Las pruebas del repo son automatizadas;
el agente no abre el navegador ni levanta el dev server.

La API conserva su gateway, su rate limiter y su origen Java en Render. No usar
el `onrender.com` directo como fallback. La clave privada del gateway sigue
fuera del cliente; el JWT del usuario conserva su función de autenticación.
