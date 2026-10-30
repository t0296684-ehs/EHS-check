// 作業檢點 PWA：程式檔「有網路先抓新的、沒網路用手機裡的」（v0.7.1 起，改版後打開 App 就是新版）；Google 後端一律不快取
var CACHE = 'chk-v0.28.1';
var FILES = ['./', './index.html', './qrcode.js', './plat.js', './sup.js', './push.js', './cons.js', './app.js', './check.js', './manifest.json', './icon-192.png', './xiaoen.jpg', './icon-512.png'];
// 畫面翻譯檔：抓不到也不影響安裝（App 會退回中文）
var OPTIONAL = ['./i18n.js', './i18n_dict.js'].concat(['explode', 'flame', 'oxid', 'gas', 'corrode', 'skull', 'health', 'warn', 'env'].map(function (k) { return './ghs-' + k + '.svg'; })).concat(['W021', 'W008', 'M018', 'W016', 'W015', 'W012', 'W014', 'M016', 'W023'].map(function (k) { return './iso-' + k + '.svg'; }));   // 10/19：高風險作業卡的 ISO 7010 安全標誌   // 10/15：GHS 圖也先存進手機，沒網路照樣顯示
self.addEventListener('install', function (e) {
  // cache:'reload'：不拿瀏覽器 HTTP 暫存的舊檔（GitHub Pages 會暫存 10 分鐘）
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (u) { return new Request(u, { cache: 'reload' }); })).then(function () {
      return Promise.all(OPTIONAL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
    });
  }));
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
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(e.request).then(function (r) {             // 抓到就存進手機（原本沒存，網路一不穩圖就破）
        if (r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request.url, cp); }); }
        return r;
      });
    }));
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

// ── 手機推播（10/28，push.js 開啟）：後端只叫醒手機不帶內容；這裡用 App 存在手機的網址與權杖去拿最新幾則未讀來顯示 ──
function swCfg() {
  return new Promise(function (ok) {
    try {
      var rq = indexedDB.open('ehs-push', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
      rq.onsuccess = function () { try { var g = rq.result.transaction('kv').objectStore('kv').get('cfg'); g.onsuccess = function () { ok(g.result || null); }; g.onerror = function () { ok(null); }; } catch (e) { ok(null); } };
      rq.onerror = function () { ok(null); };
    } catch (e) { ok(null); }
  });
}
self.addEventListener('push', function (e) {
  var generic = { title: '員和環安衛系統', body: '您有新通知，點這裡打開 App 看', tag: 'ehs-new' };
  e.waitUntil(swCfg().then(function (c) {
    if (!c || !c.url || !c.token) return [generic];
    return fetch(c.url, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'pushPeek', token: c.token, appVer: c.ver, rid: 'push' + Date.now() }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var l = (j && j.success && j.data && j.data.list) || [];
        if (self.navigator && self.navigator.setAppBadge && j && j.data) try { self.navigator.setAppBadge(j.data.unread || 0); } catch (x) {}
        return l.length ? l.map(function (x) { return { title: x.title || '員和環安衛系統', body: x.body || '', tag: x.id }; }) : [generic];
      }).catch(function () { return [generic]; });
  }).then(function (list) {
    return Promise.all(list.slice(0, 3).map(function (n) {
      return self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: './icon-192.png', badge: './icon-192.png', data: { url: './' } });
    }));
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) if ('focus' in ws[i]) return ws[i].focus();
    return self.clients.openWindow('./');
  }));
});
