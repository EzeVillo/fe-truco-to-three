# Truco en truco.ezevillo.com

Configuración preparada el 2 de noviembre de 2026. El frontend se publica en la
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

## Pendiente para publicar

1. Configurar la zona DNS en Cloudflare y los secretos de Actions
   `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` de la cuenta existente.
2. Publicar desde `master` con su workflow o `pnpm run cloudflare:deploy` después
   del build. Wrangler declara el Custom Domain `truco.ezevillo.com`.
3. Publicar la configuración del gateway y el backend de producción preparados
   en el `master` del backend. En Render fijar
   `TRUCO_ALLOWED_ORIGINS=https://truco.ezevillo.com,https://localhost,capacitor://localhost`;
   el valor externo prevalece sobre YAML y se comparte entre REST y WebSocket.
   Conservar los orígenes exactos de Capacitor y los secretos existentes.
4. Verificar login, invitaciones, recargas en rutas profundas, WebSocket, cartas,
   audio, manifest y actualización de PWA. Las pruebas del repo son automatizadas;
   no se abre el navegador ni se levanta el dev server durante la preparación.
5. Desactivar la publicación antigua de Netlify. La guía común está en
   `../portfolio/docs/cloudflare-migration.md`.

La API conserva su gateway, su rate limiter y su origen Java en Render. No usar
el `onrender.com` directo como fallback. La clave privada del gateway sigue
fuera del cliente; el JWT del usuario conserva su función de autenticación.
