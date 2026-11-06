# Identidad visual de Truco a 3

Actualización: 2026-11-05.

El emblema conserva las tres cartas tradicionales (1 de espada, 1 de basto y 7 de
espada) y el nombre completo. El monograma T3 es una versión independiente,
pensada para el header y el favicon, donde las cartas perderían legibilidad.
La paleta sigue los tokens del producto: verde `#062618`, dorado `#e8b73a` y
marfil `#e6e9e5`.

## Maestros

- `logo-master.png`: emblema completo, 1024 × 1024, transparencia exterior.
- `t3-master.png`: monograma, 1024 × 1024, transparencia exterior.

Las ilustraciones se generaron con la herramienta integrada de generación de
imágenes, tomando las cartas reales del proyecto como referencia. Son imágenes
ráster, no SVG ni una reproducción exacta de los naipes. Los prompts finales
están en [prompts.md](prompts.md).

El recorte circular y el aro se normalizaron durante la exportación para quitar
los píxeles sueltos del perímetro generado. Los archivos maestros conservan el
resultado de esa normalización.

## Exportaciones de la aplicación

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `public/logo.png` | 1024 × 1024 | Emblema de alta resolución |
| `public/icon2.png` | 512 × 512 | Portada, login y registro |
| `public/icon.png` | 256 × 256 | Header y favicon |
| `public/logo2.png` | 1200 × 630 | Open Graph y Twitter |
| `public/icons/icon-180.png` | 180 × 180 | Acceso directo de iOS |
| `public/icons/icon-192.png` | 192 × 192 | Instalación PWA |
| `public/icons/icon-512.png` | 512 × 512 | Instalación PWA |

Los íconos instalables tienen fondo opaco y el monograma contenido en el 80 %
central, respetando la zona segura circular de los íconos maskable. La tarjeta
social usa el emblema, texto y composición deterministas; no requiere generar
otra ilustración.

## Regeneración

En Windows, desde la raíz del repositorio:

```powershell
./scripts/generate-brand-assets.ps1
```

Este comando usa los maestros guardados, `System.Drawing` y las fuentes Georgia
y Segoe UI instaladas en Windows. Exporta los siete archivos y luego llama a
`generate-pwa-icons.ps1`, que también puede ejecutarse por separado.

Los parámetros opcionales `-LogoSource` e `-IconSource` importan las imágenes de
la generación original. Sus recortes están calibrados para esa pareja de
imágenes de 1254 × 1254; hay que revisarlos si se importa una composición nueva.

Las cartas de `public/cards/` y el meme del servidor no forman parte de esta
renovación.
