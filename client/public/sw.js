// Only handle navigation. Authenticated API responses never enter a worker cache.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET' ||
      new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="hi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>मतदाता खोज</title><main style="font:1.1rem system-ui;padding:2rem"><h1>जालिया मतदाता खोज</h1><p>इंटरनेट से जुड़कर सूची खोलें।</p><a href="/">फिर कोशिश करें</a></main></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )));
});
