import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../cloudflare/worker.mjs';

test('Las navegaciones de acceso reciben el índice con noindex y conservan el método', async () => {
  for (const method of ['GET', 'HEAD']) {
    let received;
    const response = await worker.fetch(
      new Request('https://truco.ezevillo.com/login?ref=test', {
        method,
        headers: { Accept: 'text/html' },
      }),
      {
        ASSETS: {
          fetch: async (request) => {
            received = request;
            return new Response(null, { status: 200 });
          },
        },
      },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.equal(received.url, 'https://truco.ezevillo.com/');
    assert.equal(received.method, method);
  }
});
test('Los assets faltantes y las escrituras no reciben HTML de la aplicación', async () => {
  for (const [path, method, accept] of [
    ['/missing.js', 'GET', '*/*'],
    ['/missing.js', 'GET', 'text/html'],
    ['/auth/login', 'POST', 'text/html'],
    ['/auth/login', 'GET', 'application/json'],
  ]) {
    const response = await worker.fetch(
      new Request(`https://truco.ezevillo.com${path}`, { method, headers: { Accept: accept } }),
      {},
    );
    assert.equal(response.status, 404);
  }
});
