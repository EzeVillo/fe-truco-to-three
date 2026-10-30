export default {
  // Existing files are served directly before this handler is invoked.
  async fetch(request, env) {
    const url = new URL(request.url);
    const navigation =
      request.headers.get('sec-fetch-mode') === 'navigate' ||
      request.headers.get('accept')?.includes('text/html');
    const filename = url.pathname.split('/').at(-1);
    if (['GET', 'HEAD'].includes(request.method) && navigation && !filename.includes('.')) {
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }
    return new Response('Not found', { status: 404 });
  },
};
