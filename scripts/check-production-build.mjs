import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../dist/netlify/truco-a-3/', import.meta.url);
const publicUrl = 'https://ezevillo.com/truco-a-3/';
const html = await readFile(new URL('index.html', root), 'utf8');
const worker = JSON.parse(await readFile(new URL('ngsw.json', root), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
const manifestUrl = new URL('manifest.webmanifest', publicUrl);

assert.ok(html.includes('<base href="/truco-a-3/">'), 'El base href debe conservar la subruta');
assert.ok(
  html.includes(`rel="canonical" href="${publicUrl}"`),
  'El canonical debe usar el dominio público',
);
assert.equal(worker.index, '/truco-a-3/index.html', 'El índice offline debe estar bajo la subruta');
assert.ok(
  Object.keys(worker.hashTable).every((path) => path.startsWith('/truco-a-3/')),
  'La PWA no debe cachear archivos fuera de /truco-a-3/',
);
assert.equal(
  new URL(manifest.scope, manifestUrl).href,
  publicUrl,
  'El scope no debe cubrir el portfolio',
);
assert.equal(
  new URL(manifest.start_url, manifestUrl).href,
  publicUrl,
  'El inicio de la PWA debe abrir el juego',
);
await access(new URL('ngsw-worker.js', root));

console.log(
  `Build verificado: base, canonical, PWA y ${Object.keys(worker.hashTable).length} archivos bajo /truco-a-3/.`,
);
