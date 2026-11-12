const rulesUrl = 'https://truco.ezevillo.com/reglas';
const rulesTitle = 'Reglas de Truco a 3 puntos exactos';
const rulesDescription =
  'Aprendé a jugar Truco a 3. Conocé las reglas del punto exacto, el envido y el truco, y qué pasa si te pasás de 3 puntos.';

export default {
  // Existing files are served directly before this handler is invoked.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Not found', { status: 404 });
    }

    if (url.pathname === '/reglas/') {
      return Response.redirect(rulesUrl + url.search, 301);
    }

    if (url.pathname === '/reglas') {
      const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      if (!page.ok) return page;

      const content = (value) => ({
        element(element) {
          element.setAttribute('content', value);
        },
      });
      return new HTMLRewriter()
        .on('title', { element: (element) => element.setInnerContent(rulesTitle) })
        .on('link[rel="canonical"]', { element: (element) => element.setAttribute('href', rulesUrl) })
        .on('meta[property="og:url"]', content(rulesUrl))
        .on('meta[property="og:title"]', content(rulesTitle))
        .on('meta[name="twitter:title"]', content(rulesTitle))
        .on('meta[name="description"]', content(rulesDescription))
        .on('meta[property="og:description"]', content(rulesDescription))
        .on('meta[name="twitter:description"]', content(rulesDescription))
        .transform(page);
    }

    const navigation =
      request.headers.get('sec-fetch-mode') === 'navigate' ||
      request.headers.get('accept')?.includes('text/html');
    const filename = url.pathname.split('/').at(-1);
    if (navigation && !filename.includes('.')) {
      const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      const response = new Response(page.body, page);
      response.headers.set('X-Robots-Tag', 'noindex');
      return response;
    }
    return new Response('Not found', { status: 404 });
  },
};
