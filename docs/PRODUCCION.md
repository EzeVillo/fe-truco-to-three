# Truco en ezevillo.com/truco-a-3

## Arquitectura

```text
ezevillo.com/                  → sitio actual / futuro portfolio
ezevillo.com/truco-a-3/*        → sitio Netlify del juego (mismo equipo)
                                /truco-a-3/* en el origen
frontend → HTTPS REST / WSS STOMP → api-truco-to-three.onrender.com
```

El proxy de Netlify sólo entrega el frontend. El backend conserva su ingreso HTTPS/WSS
en Render. No se agrega un gateway ni se reservan `/api`, `/ws`, `/assets` o la raíz
del dominio del portfolio para este juego.

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

`baseHref` vive en la configuración `netlify`, sin modificar el desarrollo local. El build
anterior de GitHub Pages conserva `/fe-truco-to-three/` mediante su argumento de CLI.
Los enlaces de invitación resuelven contra `document.baseURI`, para conservar el prefijo
del sitio donde se abrió la app. Los metadatos y el sitemap apuntan al dominio nuevo.

El manifest usa `start_url` y `scope` relativos a su ubicación. El worker se registra junto
a la aplicación, bajo `/truco-a-3/`; no debe registrarse en `/ngsw-worker.js` ni con scope `/`.
Verificar en el build que `ngsw.json` sólo contiene URLs bajo `/truco-a-3/`. Se revalidan
los archivos para permitir actualizaciones de la PWA.

## Proxy en el sitio que posee ezevillo.com

Usar `hosting/netlify-portfolio.example.toml` y reemplazar el origen por el sitio real
recién creado, en el **mismo equipo de Netlify**. Conservar `/truco-a-3/` en el destino.
La regla va antes de un catch-all y preserva todas las otras rutas del sitio.

El portfolio local `../ezevillo` aún no es el sitio publicado: su README advierte que
el deploy actual de la raíz también sirve IBIT y Git Review. No reemplazar ese deploy
por el portfolio sin trasladar previamente sus reglas y recursos. Para esta migración,
agregar únicamente el proxy de Truco al deploy actual; no modificar el HTML de la raíz.
Cuando se publique el portfolio, trasladar también esta regla.

Netlify no interpola variables de entorno dentro del campo `to` de los redirects TOML.
No publicar el ejemplo con un origen inventado o el placeholder sin reemplazar.
El `/robots.txt` del juego está bajo su subruta y no reemplaza el del portfolio;
se puede registrar `https://ezevillo.com/truco-a-3/sitemap.xml` en Search Console.

## Backend

Conservar las URLs HTTPS/WSS actuales hasta que se provisione y verifique cualquier
dominio nuevo de API. El origen que debe autorizar el backend es `https://ezevillo.com`,
sin path. Durante la transición también se conserva `https://ezevillo.github.io`.
La variable `TRUCO_ALLOWED_ORIGINS` se comparte entre CORS y WebSocket.

El backend tiene su guía en `docs/PRODUCCION.md` del repositorio `api-truco-to-three`: el perfil `prod`
debe estar activo al compilar el nativo y al ejecutarlo. Publicar esa imagen antes de
considerar aplicados los cambios de logging y exposición de diagnósticos.

## Publicación y rollback

1. Tests, lint y build de ambos repos; verificar los archivos generados.
2. Preparar los orígenes autorizados del backend y publicar su imagen verificada.
3. Crear el sitio del juego en Netlify; publicar `dist/netlify` con `netlify.toml`.
4. Incorporar el proxy al sitio actual de `ezevillo.com`, conservando sus otras rutas.
5. La validación visual y de navegación la hace el usuario, según `AGENTS.md`.
6. Mantener GitHub Pages durante la transición. Ante un fallo, revertir el proxy al deploy
   anterior; no reemplazar la raíz del dominio ni modificar el DNS para apuntar al juego.

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
