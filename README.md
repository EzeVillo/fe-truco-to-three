# FeTrucoToThree

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.12.

## Diseño Responsivo

La aplicación soporta dos tamaños de pantalla. El ancho mínimo soportado es **360 px**.

| Nombre  | Resolución de referencia | Rango de ancho   |
|---------|--------------------------|------------------|
| Mobile  | 360 × 780                | 360 px – 1023 px |
| Desktop | 1440 × 900               | 1024 px+         |

> El modo paisaje en mobile (landscape) no es un caso de uso contemplado en este proyecto.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Partidas privadas

- El anfitrión crea la partida desde `http://localhost:4200/lobby/online`.
- Desde la sala de espera puede copiar el código o compartir el enlace directo.
- El enlace canónico de invitación es `http://localhost:4200/join/{joinCode}` y abre el flujo de unión con el código cargado.
- Si quien abre el enlace no está logueado, el front lo manda a autenticación y después vuelve al mismo `join` para completar la entrada a la sala.

## Reglas de la variante

- El lobby muestra una sección con las reglas especiales del Truco a 3 puntos.
- El contenido visible se basa en `docs/REGLAS_VARIANTE.md` y vive en el frontend, sin pedir reglas al backend.
- El lobby ofrece un CTA de reglas que navega a `/lobby/reglas`.

## Audios de cantos

Los cantos de partida usan grabaciones locales ubicadas en `public/audio/calls/`. Para reemplazar una voz, mantener el mismo nombre de archivo:

```text
envido.mp3
falta-envido.mp3
me-voy-al-mazo.mp3
no-quiero.mp3
quiero.mp3
quiero-y-me-voy-al-mazo.mp3
real-envido.mp3
retruco.mp3
truco.mp3
vale-cuatro.mp3
```

Recomendaciones de grabacion: usar archivos cortos, recortar silencios iniciales y finales, y normalizar el volumen para que todos los cantos suenen parejos. Estos audios son assets del frontend; no cambian el contrato documentado en `docs/CONTRATOS_API.md`.

## Perfil y logros

- Los usuarios registrados tienen perfil publico en `/profile/{username}` con estadisticas agregadas y logros desbloqueados.
- El header muestra el `username` registrado y permite abrir el perfil propio.
- Los invitados no tienen perfil de logros propio.
- Las partidas contra bots no generan tracking ni avisos de logros.
- Cuando el backend informa un logro desbloqueado en tiempo real, el front muestra un aviso global y actualiza el perfil propio si esta abierto.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
