// 作業檢點 PWA：程式檔「有網路先抓新的、沒網路用手機裡的」（v0.7.1 起，改版後打開 App 就是新版）；Google 後端一律不快取
var CACHE = 'chk-v0.8.0';
var FILES = ['./', './index.html', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  // cache:'reload'：不拿瀏覽器 HTTP 暫存的舊檔（GitHub Pages 會暫存 10 分鐘）
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (u) { return new Request(u, { cache: 'reload' }); })); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  var code = e.request.mode === 'navigate' || /\.(html|js|json)$/.test(u.pathname) || /\/$/.test(u.pathname);
  if (!code) {                                           // 圖示：先用手機裡的
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || fetch(e.request); }));
    return;
  }
  // 程式檔：先抓網路（最多等 4 秒），抓到就更新手機裡的；沒網路或太慢就用手機裡的
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    var fromCache = function () { return caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./index.html'); }); };
    var timer = setTimeout(function () { fromCache().then(function (hit) { if (!done && hit) { done = true; resolve(hit); } }); }, 4000);
    var req; try { req = new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }); } catch (x) { req = e.request; }   // 開頁面（navigate）的請求不能直接加參數，另建一個
    fetch(req).then(function (r) {
      clearTimeout(timer);
      if (r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request.url, cp); }); }
      if (!done) { done = true; resolve(r); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  }));
});
