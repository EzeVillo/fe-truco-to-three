import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../dist/cloudflare/', import.meta.url);
const publicUrl = 'https://truco.ezevillo.com/';
const html = await readFile(new URL('index.html', root), 'utf8');
const worker = JSON.parse(await readFile(new URL('ngsw.json', root), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
const manifestUrl = new URL('manifest.webmanifest', publicUrl);

assert.ok(html.includes('<base href="/">'), 'El base href debe usar la raíz del subdominio');
assert.ok(
  html.includes(`rel="canonical" href="${publicUrl}"`),
  'El canonical debe usar el dominio público',
);
assert.equal(worker.index, '/index.html', 'El índice offline debe usar la raíz');
assert.ok(
  Object.keys(worker.hashTable).every((path) => path.startsWith('/') && !path.startsWith('//')),
  'La PWA debe usar rutas locales de su propio origen',
);
assert.equal(
  new URL(manifest.scope, manifestUrl).href,
  publicUrl,
  'El scope debe cubrir exclusivamente el subdominio del juego',
);
assert.equal(
  new URL(manifest.start_url, manifestUrl).href,
  publicUrl,
  'El inicio de la PWA debe abrir el juego',
);
await access(new URL('ngsw-worker.js', root));

console.log(
  `Build verificado: base, canonical, PWA y ${Object.keys(worker.hashTable).length} archivos en la raíz del subdominio.`,
);
