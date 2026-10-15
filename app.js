/* 員和工業 現場作業檢點 PWA
 * 後端：Google Apps Script（as04293133，Code.gs）
 * 設計：第一次選部門＋選自己＋簽名一次，之後每天開 App 直接勾；送出先存手機再背景上傳；
 *       月底「本月完成送主管」→ 單位負責人手機審核簽名 → 產 PDF → 環安衛審核歸檔。
 * v0.4.0：畫面全面改版（首頁依角色先列「要做的事」、填寫頁進度與跳題、月結月曆、錯誤停留畫面）；
 *         後端呼叫加 rid 比對。後端 API、手機存的資料名稱、送出流程、簽名邏輯都沒有改。
 */
'use strict';
var APP_VERSION = '0.13.18';
// plat.js 跟本檔版本對不上＝新舊檔混用（網路慢時 Service Worker 拿舊檔頂上）：清掉手機裡的程式檔重新載入一次
if (typeof PLAT_VER === 'string' && PLAT_VER !== APP_VERSION) window.addEventListener('load', function () { if (window.platHeal) platHeal(); else location.reload(); });
// 部署後把網址填在這裡，現場人員就不用自己設定；空白時第一次開會請使用者貼上
var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbxXn_HbSkWw8nWxfbTOgnzll6PjBqGGEbizxfgQvZSKLqVhGO8zQFJyBKdAacqiDT5-/exec';
// 每次呼叫帶隨機 rid，回應的 rid 對不上就當連線失敗重送。
// 後端還沒更新（回應完全沒有 rid）時先放行；確認後端每個回應都帶 rid 後可改成 true（沒帶也當失敗）。
var RID_STRICT = true;

var LS = { GAS: 'chk.gas', TOKEN: 'chk.token', ME: 'chk.me', REM: 'chk.remind', DRAFT: 'chk.draft' };
var S = { clockOff: Number(lsGet('chk.clock', 0)) || 0, me: null, page: 'home', arg: {}, stack: [], outbox: [], flushing: false, boot: null, view: null, fill: null,
          title: '', hero: null, topExtra: '', pkgs: null, ff: 'all', mArg: null, mf: 0, mv: 'cal', md: undefined, mErr: null, cm: '' };

// ───────────── 小工具 ─────────────
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
/** 放進 onclick="fn(…)" 的字串參數：JSON 字串再做 HTML 跳脫，名稱裡有引號也不會壞 */
function jsq(s) { return esc(JSON.stringify(String(s == null ? '' : s))); }
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { if (S && S.dev && (k === LS.ME || k === LS.DRAFT)) return; try {   // 開發者模式：不把別人的資料、草稿存進這支手機
   localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function gasUrl() { return lsGet(LS.GAS, '') || DEFAULT_GAS; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
// 手機時間不準（快或慢超過 5 分鐘）就改用系統時間，避免紀錄寫到錯的日子
function nowD() { return new Date(Date.now() + (S.clockOff || 0)); }
function today() { return ymd(nowD()); }
function setClock(serverNow) {
  if (!serverNow) return;
  var off = serverNow - Date.now();
  S.clockOff = Math.abs(off) > 5 * 60000 ? off : 0;
  lsSet('chk.clock', S.clockOff);
}
function wkNames() { return (window.I18N && I18N.wkNames()) || '日一二三四五六'.split(''); }   // 星期：依畫面語言
function wk(s) { return wkNames()[new Date(s + 'T00:00:00').getDay()]; }
function md(s) { return Number(s.slice(5, 7)) + '/' + Number(s.slice(8)); }
function ymLabel(p) { return p.slice(0, 4) + ' 年 ' + Number(p.slice(5)) + ' 月'; }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function hm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function greet() { var h = new Date().getHours(); return h < 11 ? '早安' : h < 18 ? '午安' : '晚安'; }

// 圖示（內嵌 SVG，離線也能顯示）
var ICON = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', minus: '<path d="M6 12h12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', up: '<path d="M12 19V6M6 11l6-6 6 6"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5"/><path d="M12 12v8M9 15l3-3 3 3"/>',
  warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.1"/>', err: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>', back: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  logo: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M8.5 13l2.5 2.5 4.5-5"/>',
  review: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', ret: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.5 7.5L3 21l1.5-5A8.5 8.5 0 1 1 21 12z"/>', home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  refresh: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  wifioff: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8M12 20h.01"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
};
Object.assign(ICON, window.PLAT_ICON || {});
function ic(n, s, w) {
  s = s || 20;
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2.4) +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[n] || ICON.grid || ICON.info) + '</svg>';   // 10/15：圖示名稱打錯或沒定義時用備用圖，不會變空白方塊
}
function pill(cls, icon, text) { return '<span class="pill p-' + cls + '">' + (icon ? ic(icon, 14, 2.8) : '') + esc(text) + '</span>'; }
/** 處理中遮罩（送審、核准、歸檔這類要十幾秒、而且中途關掉會不確定有沒有成功的動作）。 */
var BUSY = null;
function busyOn(title, sub) {
  busyOff();
  var d = document.createElement('div'); d.id = 'busy'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-live', 'assertive');
  d.innerHTML = '<div class="bx"><span class="spin big"></span><b>' + esc(title) + '</b><p class="warn">請不要關閉這個畫面</p>' +
    (sub ? '<p>' + esc(sub) + '</p>' : '') + '<p class="sec2">已經 <span id="busySec">0</span> 秒</p></div>';
  document.body.appendChild(d);
  var t0 = Date.now();
  BUSY = setInterval(function () {
    var sec = Math.round((Date.now() - t0) / 1000), e = $('busySec'); if (e) e.textContent = sec;
    if (sec === 60 && $('busy')) {                     // 一直沒回應：不要永遠擋住畫面，告訴他怎麼確認
      var x = document.createElement('div'); x.className = 'late';
      x.innerHTML = '<p>Google 這次回應特別慢。可以再等一下；若要先離開，稍後回到這個月份看狀態是否已改變，<b>不要重複送出</b>。</p><button class="btn ghost" onclick="busyOff()">先關閉這個提示</button>';
      $('busy').querySelector('.bx').appendChild(x);
    }
  }, 1000);
  window.addEventListener('beforeunload', busyGuard);
}
function busyOff() {
  if (BUSY) clearInterval(BUSY); BUSY = null;
  var d = $('busy'); if (d) d.remove();
  window.removeEventListener('beforeunload', busyGuard);
}
function busyGuard(e) { e.preventDefault(); e.returnValue = '還在處理中，現在離開可能不確定有沒有成功'; return e.returnValue; }
function loading(t) { return '<div class="loading"><span class="spin"></span>' + esc(t) + '</div>'; }
/** 重要錯誤：停留在畫面上的卡片（不會自己消失） */
function errBox(title, msg, btns) {
  if (window.clientErr) clientErr(title + (msg ? '：' + msg : ''));
  return '<div class="box err" role="alert"><div class="r">' + ic('err', 24) + '<div class="bt"><b>' + esc(title) + '</b>' +
    (msg ? '<div class="m">' + esc(msg) + '</div>' : '') + '</div></div>' + (btns || '') + '</div>';
}

var toastTimer = null;
function toast(msg, type, ms) {
  if (type === 'err' && window.clientErr) clientErr(msg);             // 錯誤自動回報（開發者模式看得到哪一步卡住）
  var old = document.querySelector('.toast'); if (old) old.remove();
  var d = document.createElement('div'); d.className = 'toast ' + (type || ''); d.setAttribute('role', 'status');
  d.innerHTML = (type === 'ok' ? ic('check', 20, 3) : type === 'err' ? ic('err', 20) : '') + '<span>' + msg + '</span>';
  document.body.appendChild(d);
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { d.remove(); }, ms || 2600);
}

// ───────────── 後端 ─────────────
// Google 偶爾回 404 或冷啟動很慢：沒連上就重試（2／4／8 秒）；後端明確拒絕（業務錯誤）不重試。
// Google 偶爾會把別的請求的結果回給你：每次呼叫帶隨機 rid，回應的 rid 對不上就當作連線失敗、照上面的規則重送。
function api(action, body, opt) {
  opt = opt || {};
  var url = gasUrl();
  if (!url) return Promise.reject(new Error('還沒設定系統網址'));
  var waits = opt.noRetry ? [] : [2000, 4000, 8000];
  var i = 0;
  // 開發者模式：只讀的動作帶 viewAs（以那位同仁身分看）；會寫入的動作在手機上就攔下，後端也會再擋一次
  var devAs = {};
  if (S.dev && DEV_SELF.indexOf(action) < 0) {
    if (DEV_READ.indexOf(action) < 0) { var de = new Error('開發者模式：這一步會送出資料，已攔下（' + S.dev.name + ' 按下去就會送出）'); de.biz = true; de.dev = true; devBlock(); return Promise.reject(de); }
    devAs = { viewAs: S.dev.name };
  }
  function once() {
    var rid = newId();
    var payload = JSON.stringify(Object.assign({ action: action, token: opt.token === '-' ? '' : (opt.token || lsGet(LS.TOKEN, '')) }, body || {}, { rid: rid, appVer: APP_VERSION }, devAs));
    return fetch(url, { method: 'POST', redirect: 'follow', body: payload }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Google 暫時無法開啟'); }
      if (!j || typeof j !== 'object') throw new Error('Google 暫時無法開啟');
      if (j.rid !== rid && (RID_STRICT || j.rid !== undefined)) throw new Error('連線回應錯亂（rid 不符）');
      if (!j.success && j.update) { var ue = new Error(j.error || 'App 有新版本'); ue.biz = true; ue.update = true; appUpdate(); throw ue; }
      if (!j.success) { var err = new Error(j.error || '系統錯誤'); if (j.retry) err.server = true; else err.biz = true; throw err; }
      if (RC_KEEP.indexOf(action) < 0) rcClear();          // 送出、審核、上傳…成功：看過的畫面暫存全部作廢，下次一定讀最新
      return j.data;
    }).catch(function (e) {
      if (e.biz || i >= waits.length + (e.server ? 2 : 0)) throw e;
      if (i >= waits.length) waits.push(15000);         // 系統忙碌：多等兩次（每次 15 秒）
      if (i === 0 && !opt.quiet) toast('連線不穩，自動重試中…', '', 2000);
      var w = waits[i++];
      return new Promise(function (res) { setTimeout(res, w); }).then(once);
    });
  }
  return once();
}

// ───────────── 讀取暫存（v0.13.7）：看過的畫面先用手機裡的資料立刻畫出來，背景再跟 Google 對一次，有變才重畫 ─────────────
// 任何寫入成功後整個清掉；登入、登出、換人也清掉。開發者模式只放記憶體、不存手機。
var RC_ACT = ['monthView', 'packages', 'tracks', 'eduList', 'eduStats', 'team', 'nextList', 'envMe', 'envMonth', 'consCases', 'chemList', 'patrolInfo', 'bcPeople', 'bcList', 'exportOpts'];
var RC_KEEP = RC_ACT.concat(['me', 'overview', 'bootstrap', 'ping', 'clientLog', 'photoGet', 'eduFile', 'getPdf', 'exportPdf', 'dayView', 'devLogs']);   // 只讀的動作不清暫存
var RC = null, RC_FRESH = 20000, RC_MAX = 40, RC_LS = 'chk.rc';
function rcAll() { if (!RC) { RC = {}; if (!S.dev) try { RC = JSON.parse(localStorage.getItem(RC_LS) || '{}') || {}; } catch (e) { RC = {}; } } return RC; }
function rcSave() {
  var ks = Object.keys(RC).sort(function (a, b) { return RC[b].at - RC[a].at; });
  ks.slice(RC_MAX).forEach(function (k) { delete RC[k]; });
  if (!S.dev) try { localStorage.setItem(RC_LS, JSON.stringify(RC)); } catch (e) { try { localStorage.removeItem(RC_LS); } catch (x) {} }   // 空間不夠：只留記憶體
}
function rcClear() { RC = {}; try { localStorage.removeItem(RC_LS); } catch (e) {} }
function rcKey(action, body) { return (S.dev ? 'dev:' + S.dev.name + '|' : '') + ((S.me && S.me.person && S.me.person.name) || '') + '|' + action + '|' + JSON.stringify(body || {}); }
function rcIdle() { var a = document.activeElement; return !$('busy') && !document.querySelector('.dlg,.pview') && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
/** 只讀的 api：有暫存就馬上回暫存（20 秒內不再問 Google），背景更新完資料有變、而且人還在同一頁沒在打字，就重畫一次。 */
function apiR(action, body, opt) {
  var k = rcKey(action, body), c = rcAll()[k], page = S.page, arg = S.arg;
  var get = function () {
    return api(action, body, Object.assign({ quiet: !!c }, opt || {})).then(function (d) {
      var js = JSON.stringify(d), changed = !c || c.js !== js;
      rcAll()[k] = { at: Date.now(), js: js }; rcSave();
      return { d: d, changed: changed };
    });
  };
  if (!c) return get().then(function (r) { return r.d; });
  if (Date.now() - c.at > RC_FRESH) get().then(function (r) { if (r.changed && S.page === page && S.arg === arg && rcIdle()) render(); }).catch(function () {});
  return Promise.resolve(JSON.parse(c.js));
}
/** 打開 App 後趁空檔先把最常點的畫面讀好（本月月曆、教育訓練、異常追蹤），點進去就不用等。 */
function prefetch() {
  if (S.pf || !S.me || S.dev || S.share || !navigator.onLine || !(S.me.signature && S.me.signature.imageV)) return;
  S.pf = true;
  var per = today().slice(0, 7), q = [], mods = ((window.plat && plat()) || {}).mods || {};
  if (!isEhs()) (S.me.depts || []).slice(0, 2).forEach(function (d) { q.push(['monthView', { deptId: d.id, period: per }]); });
  if (S.me.pendingReview) q.push(['packages', {}]);
  if (mods.edu) q.push(['eduList', {}]);
  if (S.me.tracksOpen) q.push(['tracks', {}]);
  var run = function () { var x = q.shift(); if (x && !S.dev) apiR(x[0], x[1], { quiet: true, noRetry: true }).then(run, run); };
  run();
}

// ───────────── 待上傳區（IndexedDB）─────────────
var DB = null;
function db() {
  if (DB) return Promise.resolve(DB);
  return new Promise(function (res, rej) {
    var q = indexedDB.open('chk_db', 2);
    q.onupgradeneeded = function () {                    // v2：多一個 kv（登入的備份）
      var d = q.result;
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'id' });
    };
    q.onsuccess = function () { DB = q.result; res(DB); };
    q.onerror = function () { rej(q.error); };
  });
}
/** 登入備份（Jason：員工登入一次就好）：權杖同時存在 localStorage 和 IndexedDB；某一邊被清掉，打開 App 時用另一邊補回，不用再輸入啟用碼。 */
function kvTx(mode, fn) {
  return db().then(function (d) { return new Promise(function (res, rej) {
    var t = d.transaction('kv', mode), st = t.objectStore('kv'), out = fn(st);
    t.oncomplete = function () { res(out && out.result); }; t.onerror = function () { rej(t.error); };
  }); });
}
function authSave() { var tok = lsGet(LS.TOKEN, ''); if (!tok || S.dev) return Promise.resolve(); return kvTx('readwrite', function (st) { st.put({ id: 'auth', token: tok, me: lsGet(LS.ME, null), at: Date.now() }); }).catch(function () {}); }
function authClear() { return kvTx('readwrite', function (st) { st.delete('auth'); }).catch(function () {}); }
function authRestore() {
  if (lsGet(LS.TOKEN, '')) return authSave();
  return kvTx('readonly', function (st) { return st.get('auth'); }).then(function (a) {
    if (a && a.token) { lsSet(LS.TOKEN, a.token); if (a.me && !lsGet(LS.ME, null)) lsSet(LS.ME, a.me); }
  }).catch(function () {});
}
function obTx(mode, fn) {
  return db().then(function (d) {
    return new Promise(function (res, rej) {
      var tx = d.transaction('outbox', mode); var r = fn(tx.objectStore('outbox'));
      tx.oncomplete = function () { res(r && 'result' in r ? r.result : undefined); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
function obAll() { return obTx('readonly', function (s) { return s.getAll(); }).then(function (a) { return (a || []).sort(function (x, y) { return x.created - y.created; }); }); }
function obPut(j) { return obTx('readwrite', function (s) { s.put(j); }); }
function obDel(id) { return obTx('readwrite', function (s) { s.delete(id); }); }
function obRefresh() { return obAll().then(function (a) { S.outbox = a; }).catch(function () { S.outbox = []; }); }

var flushTimer = null;
var AUTH_RE = /失效|名單|選擇您的身分/;
function flush() {
  if (S.dev) return Promise.resolve();                               // 開發者模式中不送待上傳（避免帶到別人的身分）
  if (S.flushing || !navigator.onLine || !gasUrl() || !lsGet(LS.TOKEN, '')) return Promise.resolve();   // 登出中先不送，重新登入後換上新的登入再送
  S.flushing = true;
  if (S.page === 'home') render();
  var sent = 0, failed = 0, relogin = '';
  return obAll().then(function (jobs) {
    var p = Promise.resolve(), stop = false;
    jobs.filter(function (j) { return j.status === 'pending'; }).forEach(function (j) {
      p = p.then(function () {
        if (stop) return;
        return api(j.action || 'submitCheck', Object.assign({ submitId: j.id }, j.body), { token: j.token, quiet: true }).then(function () {   // 環保抄表的待上傳 action＝envSubmit
          sent++; return obDel(j.id);
        }).catch(function (e) {
          j.tries = (j.tries || 0) + 1; j.message = e.message;
          if (e.update) { stop = true; j.tries--; return obPut(j); }          // App 要更新：這筆留著，更新後自動補送
          if (e.biz && AUTH_RE.test(e.message)) {          // 登入失效（啟用碼改了等）：紀錄留在手機，重新登入後自動補送
            if (j.token === lsGet(LS.TOKEN, '')) { stop = true; relogin = e.message; return obPut(j); }
            j.status = 'auth'; return obPut(j);            // 別人（之前用這支手機的人）的紀錄：等他本人重新登入，不影響現在的人
          }
          if (e.biz) {                                 // 後端拒收：首頁不能再把這張當成「已上傳」
            j.status = 'error'; failed++;
            var a = S.me && A(j.key); if (a && a.due && j.body.date === today() && !a.due.signer) { a.due.todayDone = false; a.due.todayNoWork = false; }
            return obPut(j);
          }
          stop = true; clearTimeout(flushTimer); flushTimer = setTimeout(flush, 60000);
          return obPut(j);
        });
      });
    });
    return p;
  }).then(function () {
    S.flushing = false;
    if (relogin) return kickToLogin(relogin);
    if (sent) toast(sent === 1 && S.sentMsg ? S.sentMsg : '已上傳 ' + sent + ' 筆檢點', 'ok', S.sentMsg ? 3500 : undefined);
    S.sentMsg = null;
    if (sent || failed) refreshMe();
    return obRefresh();
  }).then(function () { if (S.page === 'home') render(); })
    .catch(function () { S.flushing = false; });
}

/** 首頁最上方：待上傳／上傳失敗（三種狀態一眼分得出來） */
function outboxBlock() {
  var a = S.outbox || []; if (!a.length) return '';
  var pend = a.filter(function (j) { return j.status === 'pending'; });
  var h = '';
  if (pend.length) {
    var msg = (pend.filter(function (j) { return j.message; })[0] || {}).message;
    var why = !navigator.onLine ? '等網路恢復' : S.flushing ? '上傳中…' : (msg ? (/新版本/.test(msg) ? 'App 更新到新版後自動上傳' : /忙碌/.test(msg) ? '系統忙碌，會自動再試' : '沒連上，會自動再試') : '背景上傳中');
    var old = pend.filter(function (j) { return j.created && Date.now() - j.created > 2 * 86400000; }).length;
    h += '<div class="strip info">' + ic('cloud', 24, 2.2) + '<div class="stx"><span><b>待上傳 ' + pend.length + ' 筆</b>・' + why + '</span>' +
      '<small>' + (old ? '<b class="ngt">有 ' + old + ' 筆超過 2 天還沒上傳，請連上網路按「立即上傳」；超過補填期限就不能補登</b>' : '已存在手機，不會不見') + '</small></div>' +
      '<button class="btn sm" onclick="flush()"' + (S.flushing ? ' disabled' : '') + '>立即上傳</button></div>';
  }
  var wait = a.filter(function (j) { return j.status === 'auth'; }), byWho = {};
  wait.forEach(function (j) { var w = j.who || '之前登入的人'; byWho[w] = (byWho[w] || 0) + 1; });
  Object.keys(byWho).forEach(function (w) {
    h += '<div class="strip info">' + ic('cloud', 24, 2.2) + '<div class="stx"><span><b>' + esc(w) + ' 的檢點 ' + byWho[w] + ' 筆</b>・等本人重新登入</span>' +
      '<small>已存在手機，不會不見；' + esc(w) + ' 在這支手機用新的啟用碼登入後自動上傳</small></div></div>';
  });
  a.filter(function (j) { return j.status !== 'pending' && j.status !== 'auth'; }).forEach(function (j) {
    h += errBox(j.label + ' 沒有上傳成功', '原因：' + (j.message || '不明'),
      '<div class="btns"><button class="btn red" onclick="obRetry(' + jsq(j.id) + ')">重試</button>' +
      '<button class="btn redline" onclick="obDrop(' + jsq(j.id) + ')">刪除這筆</button></div>');
  });
  return h;
}
function clockBlock() {
  if (!S.clockOff) return '';
  var m = Math.round(Math.abs(S.clockOff) / 60000), t = m >= 1440 ? Math.round(m / 1440) + ' 天' : m >= 60 ? Math.round(m / 60) + ' 小時' : m + ' 分鐘';
  return '<div class="strip off">' + ic('clock', 24, 2.2) + '<div class="stx"><b>這支手機的時間' + (S.clockOff < 0 ? '快' : '慢') + '了 ' + t + '</b>' +
    '<small>系統已改用正確時間記錄；請到手機「設定 → 日期與時間」開啟自動設定</small></div></div>';
}
function netBlock() {
  if (navigator.onLine) return '';
  return '<div class="strip off">' + ic('wifioff', 24, 2.2) + '<div class="stx"><b>目前沒有網路</b><small>照常檢點，會先存在手機，有網路自動上傳</small></div></div>';
}
/** 登入失效：先把這次登入名下、舊版沒記姓名的待上傳紀錄補上姓名（重新登入後才認得回來），再回登入頁 */
function kickToLogin(msg) {
  var tok = lsGet(LS.TOKEN, ''), name = S.me && S.me.person ? S.me.person.name : (lsGet(LS.ME, null) || { person: {} }).person.name;
  return obAll().then(function (a) {
    return Promise.all(a.filter(function (j) { return !j.who && j.token === tok && name; }).map(function (j) { j.who = name; return obPut(j); }));
  }).catch(function () {}).then(function () {
    lsDel(LS.TOKEN); lsDel(LS.ME); authClear(); rcClear(); S.me = null; S.stack = [];
    go('login', {}, true); toast(esc(msg), 'err');
    return obRefresh();
  });
}
/** 重新登入後：這個人手機裡還沒送出的檢點，換上新的登入再送（舊登入可能因改啟用碼而失效） */
function rebindJobs(name, token) {
  return obAll().then(function (a) {
    var p = Promise.resolve(), n = 0;
    a.forEach(function (j) {
      if (j.who !== name || j.token === token) return;
      if (j.status !== 'pending' && j.status !== 'auth' && !(j.status === 'error' && AUTH_RE.test(j.message || ''))) return;
      j.token = token; j.status = 'pending'; n++;
      p = p.then(function () { return obPut(j); });
    });
    return p.then(function () { return n; });
  }).then(function (n) { if (n) return obRefresh().then(flush); });
}
function obRetry(id) { obAll().then(function (a) { var j = a.filter(function (x) { return x.id === id; })[0]; if (!j) return; j.status = 'pending'; return obPut(j); }).then(obRefresh).then(function () { render(); flush(); }); }
function obDrop(id) { if (!confirm('刪除這筆檢點？刪了手機上就沒有這筆資料了。')) return; obDel(id).then(obRefresh).then(render); }

// ───────────── 資料 ─────────────
function normMe(m) {
  m.assigns = []; m.months = []; m.confirms = []; m.claimable = [];
  var stale = m.today && m.today !== today();      // 手機裡存的是前幾天的狀態（例如隔天一早沒訊號）：今天一律當作還沒做
  m.person.depts = m.depts.map(function (d) { return { id: d.id, name: d.id }; });
  m.depts.forEach(function (d) {
    d.daily.forEach(function (x) {
      if (stale) x = { form: x.form, state: 'todo', signer: '' };
      m.assigns.push({ key: d.id + '|' + x.form + '||', dept: d.id, form: x.form, object: '', kind: '', freq: '作業日', daily: true,
        due: { todayDone: x.state === 'done' || x.state === 'nowork' || x.state === 'sheet', todayNoWork: x.state === 'nowork', state: x.state, signer: x.signer || '' } });
    });
    d.pick.forEach(function (x) {
      if (x.missingEquip) { m.assigns.push({ key: d.id + '|' + x.form + '|?|', dept: d.id, form: x.form, object: '', kind: '', missingEquip: x.missingEquip, freq: '' }); return; }
      m.assigns.push({ key: [d.id, x.form, x.object, x.kind].join('|'), dept: d.id, form: x.form, object: x.object, objectName: x.objectName,
        kind: x.kind, freq: x.freq, pick: true, warnDays: 30, due: { last: x.last, due: x.due, state: x.state } });
    });
    (d.confirms || []).forEach(function (c) { m.confirms.push({ dept: d.id, period: c.period, n: c.n }); });
    (d.claimable || []).forEach(function (c) { var x = Object.assign({ dept: d.id }, c); m.claimable.push(x); });
    d.months.forEach(function (x) { m.months.push({ dept: d.id, unit: d.unit, period: x.period, status: x.status, reason: x.reason, sheetUrl: d.sheetUrl,
      crew: x.crew, submitter: x.submitter, submittedAt: x.submittedAt }); });
  });
  return m;
}
function refreshMe() {
  if (!lsGet(LS.TOKEN, '')) return Promise.resolve();
  return api('me', {}, { quiet: true }).then(function (m) {
    setClock(m.serverNow); S.me = normMe(m); lsSet(LS.ME, m);
    if (m.pendingReview) loadPkgs(true); else S.pkgs = [];
    if (m.person && m.person.role !== '檢點人員') ovLoad(true);
    // 第一次拿到平台資料（剛從舊版升上來）：還停在日常檢點首頁、沒有往下點過，就換到該去的地方（主選單或唯一的功能）
    if (!S.landed) { S.landed = true; var L = landing(); if (S.page === 'home' && !S.stack.length && L !== 'home') return go(L, {}, true); }
    if (['home', 'menu', 'settings', 'pick', 'months', 'notice', 'claim', 'mine'].indexOf(S.page) >= 0) render();
  }).catch(function (e) {
    if (S.dev) return toast(esc(e.message), 'err', 4000);
    if (e.biz && AUTH_RE.test(e.message)) kickToLogin(e.message);
  });
}
/** 主管／環安衛首頁要列出「哪一份待審」：讀 packages 清單 */
var pkgLoading = false;
function loadPkgs(force) {
  if (pkgLoading || (S.pkgs && !force)) return;
  pkgLoading = true;
  apiR('packages', {}, { quiet: true }).then(function (list) { S.pkgs = list || []; if (S.page === 'home') render(); })
    .catch(function () { if (!S.pkgs) S.pkgs = []; }).then(function () { pkgLoading = false; });
}
function A(key) { return (S.me.assigns || []).filter(function (a) { return a.key === key; })[0]; }
/** 表單定義；給日期（或月份）時用那個月生效的版本（表單改版後補填前幾個月用舊版，見後台「表單設定」）。 */
function F(id, d) { var by = d && S.me.formsBy && S.me.formsBy[String(d).slice(0, 7)]; return (by && by[id]) || S.me.forms[id]; }
function aTitle(a) { var f = F(a.form); return f.name + (a.object ? '｜' + a.object : '') + (a.kind ? '｜' + a.kind : ''); }
function isMgr() { return S.me && S.me.person.role === '單位負責人'; }
function mgrOf(dept) { var d = (S.me.depts || []).filter(function (x) { return x.id === dept; })[0]; return d && d.mgr; }
function isEhs() { return S.me && /^環安衛/.test(S.me.person.role); }
function pendingFor(a, date) {
  return !!pendJob(a, date);
}
function pendJob(a, date) {
  // 「auth」＝之前用這支手機的人填好、等他重新登入才上傳：對現在的人也算這張今天已有人填，避免重複填
  return (S.outbox || []).filter(function (j) { return (j.status === 'pending' || j.status === 'auth') && j.key === a.key && j.body.date === date; })[0];
}
function whoLine() {
  if (!S.me) return '';
  if (S.share) return S.share.d ? '代填・' + S.share.d.dept + '・' + md(S.share.d.date) : '代填';
  var ds = S.me.depts.map(function (d) { return d.id; });
  return S.me.person.name + '・' + (ds.length > 2 ? ds.slice(0, 2).join('、') + ' 等 ' + ds.length + ' 個部門' : ds.join('、') || S.me.person.role);
}

// ───────────── 導覽 ─────────────
function go(page, arg, replace) {
  if (!replace && S.page !== page) S.stack.push({ page: S.page, arg: S.arg });
  S.page = page; S.arg = arg || {};
  window.scrollTo(0, 0);
  render(); pgIn(1);
}
function back() { var p = S.stack.pop() || { page: window.landing ? landing() : 'home', arg: {} }; S.page = p.page; S.arg = p.arg; window.scrollTo(0, 0); render(); pgIn(-1); }
/** 換頁的淡入（往前從右邊、返回從左邊滑一點點），跟一般 App 一樣有「換頁了」的感覺；系統設定減少動態效果就不做。 */
function pgIn(dir) {
  var a = $('app'); if (!a || !a.animate) return;
  try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  a.animate([{ opacity: 0.4, transform: 'translateX(' + (dir > 0 ? 14 : -14) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 170, easing: 'ease-out' });
}

function render() {
  var p = S.page;
  if (S.share) { if (['proxy', 'fill', 'psign'].indexOf(p) < 0) { p = 'proxy'; S.page = p; } }
  else if (!gasUrl()) p = 'url';
  else if (!lsGet(LS.TOKEN, '') && p !== 'login') p = 'login';
  else if (p !== 'login' && p !== 'sign' && S.me && !(S.me.signature && S.me.signature.imageV)) { p = 'sign'; if (S.page !== 'sign') { S.page = 'sign'; S.arg = {}; } }
  var fn = PAGES[p] || PAGES.home;
  if (window.trailPush) trailPush(p);
  S.cur = p; S.hero = null; S.topExtra = '';
  $('bar').innerHTML = ''; padBar();
  fn();
  drawTop();
}
function netTag() { var on = navigator.onLine; return '<span class="net' + (on ? '' : ' off') + '" id="net"><i></i>' + (on ? '已連線' : '離線') + '</span>'; }
/** 頁面最上方的常用鈕：通知固定在最右上角（有未讀顯示數字），使用教學、設定在它左邊。 */
function bellBtn() {
  var n = (S.me && S.me.unread) || 0;
  return '<button class="tact" aria-label="通知" onclick="go(\'notice\')">' + ic('bell', 22, 2.3) + '<small>通知</small>' + (n ? '<i class="tbadge">' + (n > 99 ? '99+' : n) + '</i>' : '') + '</button>';
}
function heroTop() {
  return '<div class="htop">' + netTag() + '<span class="htsp"></span>' + (window.menuBtn && S.cur !== 'menu' ? menuBtn() : '') +
    '<button class="tact" aria-label="使用教學" onclick="go(\'guide\')">' + ic('info', 22, 2.3) + '<small>教學</small></button>' +
    '<button class="tact" aria-label="設定" onclick="go(\'settings\')">' + ic('sliders', 22, 2.3) + '<small>設定</small></button>' + bellBtn() + '</div>';
}
function drawTop() {
  var t = $('top');
  if (S.hero) { t.className = 'hero'; t.innerHTML = devBanner() + S.hero; return; }
  var sigBk = S.cur === 'sign' && !!S.me;             // 簽名頁每一步都能回上一步（第一次登入還沒簽完也可以，見 sigBack）
  var showBack = sigBk || (S.stack.length && ['home', 'login', 'url', 'proxy'].indexOf(S.cur) < 0);
  // 沒有「返回」的功能首頁（例：只有一個功能的人直接進來）右上角放「主選單」，任何功能都回得去
  var mb = !showBack && S.me && !S.share && window.menuBtn && ['login', 'url', 'proxy', 'sign', 'psign', 'menu'].indexOf(S.cur) < 0 ? menuBtn() : '';
  t.className = 'topbar';
  t.innerHTML = devBanner() + '<div class="tb">' + (showBack ? '<button class="tb-back" id="back" aria-label="返回" onclick="' + (sigBk ? 'sigBack()' : 'back()') + '">' + ic('back', 24, 2.6) + '</button>' : '<span class="tb-sp"></span>') +
    '<div class="tb-t"><div class="tb-ttl" id="ttl">' + esc(S.title) + '</div>' + (S.me ? '<div class="tb-sub">' + esc(whoLine()) + '</div>' : '') + '</div>' + mb + netTag() + (S.me && !S.share && ['login', 'url', 'proxy', 'sign', 'psign', 'notice'].indexOf(S.cur) < 0 ? bellBtn() : '') + '</div>' + (S.topExtra || '');
}
function setTitle(t) { S.title = t; document.title = t === '員和環安衛系統' ? t : t + '｜員和環安衛系統'; }
function bar(html) { $('bar').innerHTML = '<div class="bar"><div class="in">' + html + '</div></div>'; padBar(); }
function padBar() { var b = $('bar').firstChild; document.documentElement.style.setProperty('--barh', (b ? b.offsetHeight : 0) + 'px'); }

var PAGES = {};
Object.assign(PAGES, window.PLAT_PAGES || {});            // 平台層頁面（plat.js：主選單、環保抄表、施工申請、教育訓練）
// plat.js 沒載到（例如 GitHub 漏傳）：退回只有日常檢點的舊行為，App 照常能用
if (!window.landing) {
  window.landing = function () { return 'home'; }; window.plat = function () { return null; }; window.modOn = function (k) { return k === 'check'; };
  window.menuBtn = function () { return ''; }; window.devBanner = function () { return ''; };
}

// ───────────── 設定網址 ─────────────
PAGES.url = function () {
  setTitle('作業檢點｜設定');
  $('app').innerHTML = '<div class="card"><b>第一次使用</b><div class="muted">請貼上環安衛中心提供的系統網址（結尾是 /exec）。</div>' +
    '<input id="u" class="field" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec"></div>';
  bar('<button class="btn" onclick="saveUrl()">下一步</button>');
};
function saveUrl() {
  var v = $('u').value.trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(v)) return toast('網址格式不對', 'err');
  lsSet(LS.GAS, v); go('login', {}, true);
}

// ───────────── 第一次登入：選部門 → 選自己 → 啟用碼 ─────────────
PAGES.login = function () {
  setTitle('選擇您的身分');
  S.hero = '<div class="hero-in"><div class="brand"><span class="logo">' + '<img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block">' + '</span>員和環安衛系統' +
    '<button class="spcbtn" onclick="S.arg=' + (S.arg && S.arg.spc ? '{}' : '{spc:true}') + ';render()">' + (S.arg && S.arg.spc ? '回同仁登入' : '環安衛登入') + '</button></div>' +
    '<div class="hn"><div class="h1">' + (S.arg && S.arg.spc ? '環安衛中心・示範區' : '第一次使用，請選您是誰') + '</div><div class="hsub">只要選一次，之後打開就直接用</div>' + (window.I18N ? I18N.picker() : '') + '</div></div>';
  var b = S.boot;
  if (!b) {
    $('app').innerHTML = loading('讀取名單中…');
    api('bootstrap').then(function (d) { S.boot = d; render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到名單', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
    return;
  }
  var a = S.arg;
  var step = function (n, done, t) { return '<div class="stepH"><i class="' + (done ? 'done' : '') + '">' + (done ? ic('check', 16, 3.2) : n) + '</i>' + t + '</div>'; };
  // v0.13.11（10/14 Jason）：四大區塊（PU生產、BU生產、PU實驗室、BU實驗室）黃色；環安衛中心、示範區、測試部門藍色另放下面（避免誤觸）。
  // 同群組兩課以上收成一顆，點開／再點收回；群組裡另有「單位負責人」一顆（主管不分課列，登入後在「部門管理」看他管的全部課）。
  var G = b.groups || {}, MGR = '單位負責人';
  var gOf = function (d) { var g = G[d] && G[d].g; return g && b.depts.filter(function (x) { return G[x] && G[x].g === g; }).length > 1 ? g : ''; };
  var spc = function (d) { return d === '環安衛中心' || /^(示範|測試)/.test(d); };
  var top = [];
  b.depts.forEach(function (d) { var g = gOf(d); if (!g) top.push({ d: d, k: d, spc: spc(d) }); else if (!top.some(function (t) { return t.g === g; })) top.push({ g: g, k: g }); });
  var rank = function (t) { return t.spc ? 9 : (/實驗室/.test(t.k) ? 2 : 0) + (/^BU/.test(t.k) ? 1 : 0); };
  top = top.map(function (t, i) { t.i = i; return t; }).sort(function (x, y) { return rank(x) - rank(y) || x.i - y.i; });
  var curG = a.grp || (a.dept ? gOf(a.dept) : '');
  var btn = function (t) {
    if (t.g) {
      var gon = curG === t.g;
      return '<button class="dept grp main' + (gon ? ' on' : '') + '" aria-expanded="' + gon + '" onclick="S.arg=' + (gon ? '{}' : '{grp:' + jsq(t.g) + '}') + ';render()">' + esc(t.g) + ic('chev', 16, 2.8) + '</button>';
    }
    var on = a.dept === t.d, i = b.depts.indexOf(t.d), keep = a.spc ? 'spc:true' : '';
    return '<button class="dept ' + (t.spc ? 'spc' : 'main') + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="S.arg=' + (on ? '{' + keep + '}' : '{' + (keep ? keep + ',' : '') + 'dept:S.boot.depts[' + i + ']}') + ';render()">' + (on ? ic('check', 16, 3.2) : '') + esc(t.d) + '</button>';
  };
  // v0.13.12（10/14 Jason）：環安衛中心、示範區不放在同仁選部門的上面，改由右上角「環安衛登入」進入
  var mains = top.filter(function (t) { return a.spc ? t.spc : !t.spc; });
  var h = step(1, !!(a.dept || a.mgr), '您的部門') + '<div class="depts">' + mains.map(btn).join('') + '</div>';
  if (curG) {
    var pre = function (d) { return d.indexOf(curG + '-') === 0 ? 0 : 1; };    // 名稱是「群組-」開頭的排前面（BU生產-A／B／C 區，再來倉儲部）
    var mem = b.depts.filter(function (d) { return gOf(d) === curG; }).map(function (d, i) { return [d, i]; })
      .sort(function (x, y) { return pre(x[0]) - pre(y[0]) || ((G[x[0]] && G[x[0]].label) < (G[y[0]] && G[y[0]].label) ? -1 : (G[x[0]] && G[x[0]].label) > (G[y[0]] && G[y[0]].label) ? 1 : x[1] - y[1]); }).map(function (x) { return x[0]; });
    h += '<div class="dsub"><div class="dsubh">' + esc(curG) + '</div><div class="depts">' + mem.map(function (d) {
      var on = a.dept === d, i = b.depts.indexOf(d);
      return '<button class="dept' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-dept="' + esc(d) + '" onclick="S.arg={grp:' + jsq(curG) + (on ? '' : ',dept:S.boot.depts[' + i + ']') + '};render()">' + (on ? ic('check', 16, 3.2) : '') + esc((G[d] && G[d].label) || d) + '</button>';
    }).join('') + '<button class="dept mgrb' + (a.mgr ? ' on' : '') + '" aria-pressed="' + !!a.mgr + '" onclick="S.arg={grp:' + jsq(curG) + (a.mgr ? '' : ',mgr:true') + '};render()">' + ic(a.mgr ? 'check' : 'review', 16, 2.8) + MGR + '</button></div></div>';
  }
  var ps = [];
  if (a.mgr && curG) {
    var seenM = {};
    b.depts.filter(function (d) { return gOf(d) === curG; }).forEach(function (d) {
      (b.people[d] || []).forEach(function (p) { if (p.role === MGR && !seenM[p.name]) { seenM[p.name] = 1; ps.push(p); } });
    });
  } else if (a.dept) ps = (b.people[a.dept] || []).filter(function (p) { return !gOf(a.dept) || p.role !== MGR; });
  S.loginPs = ps;
  if (a.dept || a.mgr) {
    h += step(2, a.i != null, '您是') + (ps.length ? '<div class="list">' + ps.map(function (p, i) {
      return '<button class="li' + (a.i === i ? ' sel' : '') + '" aria-pressed="' + (a.i === i) + '" onclick="S.arg.i=' + i + ';render()"><span class="radio"></span><span class="mn"><span class="nm">' + esc(p.name) + '</span><span class="mt">' +
        esc(p.role) + (p.needPin ? '・需要啟用碼' : '') + '</span></span></button>';
    }).join('') + '</div>' : '<div class="box warn"><div class="r">' + ic('info', 22) + '<div class="bt"><b>' + (a.mgr ? '這個部門還沒有單位負責人' : '這個部門的名單還沒建立') + '</b><div class="m">請洽環安衛中心。</div></div></div></div>');
  }
  var sel = a.i != null ? ps[a.i] : null;
  if (sel && sel.needPin) h += step(3, false, '<label for="pin">輸入啟用碼</label>') + '<input id="pin" class="field pin" inputmode="numeric" autocomplete="one-time-code" placeholder="環安衛中心給您的啟用碼">';
  h += '<div id="loginErr"></div>';
  $('app').innerHTML = h;
  if (sel) bar('<button class="btn" id="bindBtn" onclick="doBind()">確認，我是 ' + esc(sel.name) + '</button>');
};
function doBind() {
  var btn = $('bindBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>登入中…';
  var sel = (S.loginPs || [])[S.arg.i];
  var pin = $('pin') ? $('pin').value.trim() : '';
  $('loginErr').innerHTML = '';
  if ($('pin') && !pin) {
    $('loginErr').innerHTML = errBox('還沒輸入啟用碼', '單位負責人、環安衛人員和設了啟用碼的人，登入要輸入環安衛中心給您的 4 位數字。');
    $('pin').classList.add('bad'); $('pin').focus();
    btn.disabled = false; btn.className = 'btn'; btn.textContent = '確認，我是 ' + sel.name;
    return;
  }
  api('bind', { name: sel.name, pin: pin, device: navigator.userAgent.slice(0, 80) }).then(function (d) {
    setClock(d.me.serverNow); rcClear(); lsSet(LS.TOKEN, d.token); lsSet(LS.ME, d.me); authSave(); S.me = normMe(d.me); S.stack = []; S.pf = false;
    S.landed = true; go(d.me.signature ? landing() : 'sign', {}, true);
    toast('歡迎，' + esc(d.me.person.name), 'ok');
    rebindJobs(d.me.person.name, d.token);
  }).catch(function (e) {
    // 登入失敗要停在畫面上（不只 Toast 一閃而過）
    $('loginErr').innerHTML = errBox('登入沒有成功', e.message);
    if ($('pin')) $('pin').classList.add('bad');
    $('loginErr').scrollIntoView({ block: 'center', behavior: 'smooth' });
    btn.disabled = false; btn.className = 'btn'; btn.textContent = '再試一次';
  });
}

// ───────────── 簽名（簽一次，之後自動帶入）─────────────
PAGES.sign = function () {
  setTitle('我的簽名');
  var v = S.arg.step === 'v';
  var has = S.me && S.me.signature;
  var h = '<div class="steps"><div class="' + (v ? 'done' : 'cur') + '"><i></i><span>' + (v ? ic('check', 14, 3.2) + '1 橫式已完成' : '1 橫式簽名') + '</span></div>' +
    '<div class="' + (v ? 'cur' : '') + '"><i></i><span>2 直式簽名</span></div></div>';
  if (v) {
    h += '<div class="h2">在直的框裡，由上往下簽</div><div class="lead">每日檢點表的「檢查人員簽章」在每天那一格，很窄，所以要一個直的簽名。請<b>由上往下</b>簽全名。</div>' +
      '<div class="sigwrap"><div class="sigv"><div class="arw" aria-hidden="true"><span>由</span><span>上</span><span>往</span><span>下</span>' +
      '<svg class="ic" width="28" height="110" viewBox="0 0 28 110" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v98M4 90l10 12 10-12"/></svg></div>' +
      '<canvas id="cv" class="sigbox" aria-label="直式簽名區，由上往下簽"></canvas><span class="sp"></span></div>';
    if (SIG.h) h = h.replace('<div class="sigwrap">', '<div class="card vprev" id="vprev">' + loading('把橫式簽名轉成直式…') + '</div><div class="sigwrap">');
  } else {
    h += '<div class="h2">請用手指簽全名</div><div class="lead">只要簽<b>這一次</b>，存在系統裡，之後每次送出都會自動帶入，不用每天簽。</div>' +
      '<div class="sigwrap"><canvas id="cv" class="sigbox" aria-label="橫式簽名區"></canvas>';
  }
  h += '<div class="right">' + (v && SIG.h ? '<button class="btn ghost sm" id="sigAuto" onclick="sigAutoV()">' + ic('refresh', 18) + '重新自動轉</button>' : '') +
    '<label class="btn ghost sm upl">' + ic('up', 18) + '上傳簽名照片<input type="file" accept="image/*" id="sigFile" onchange="sigUpload(this)" hidden></label>' +
    '<button class="btn ghost sm" onclick="sigClear()">' + ic('refresh', 18) + '清除重簽</button></div></div>' +
    '<div class="muted upnote">也可以在白紙上用黑筆' + (v ? '<b>由上往下</b>' : '') + '簽好、拍照上傳，系統會自動去掉背景。</div>';
  if (!v) h += '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">這個簽名用在定期檢查表與送審。下一步再簽一個直的，給每日檢點表用。</div></div></div></div>';
  if (has) h += '<div class="card"><div class="muted">目前的簽名（按儲存才會換掉）</div><div class="sigimgs"><img src="' + esc(has.image) + '" alt="目前的橫式簽名">' +
    (has.imageV ? '<img class="v" src="' + esc(has.imageV) + '" alt="目前的直式簽名">' : '') + '</div></div>';
  $('app').innerHTML = h;
  // 下方大按鈕旁放「上一步」（10/13 Jason：左上角返回太小，不明顯）
  var bk = v ? '上一步' : (has && has.imageV ? '返回' : '重新選身分');
  bar('<div class="btns r12"><button class="btn ghost" onclick="sigBack()">' + ic('back', 20, 2.6) + bk + '</button>' +
    '<button class="btn" id="sigBtn" onclick="sigNext()">' + (v ? ic('check', 22, 2.8) + '儲存兩個簽名' : '下一步：簽直式' + ic('arrow', 20, 2.6)) + '</button></div>');
  sigInit();
  if (v && SIG.h) setTimeout(sigAutoV, 150);       // 進直式這一步先自動轉一次給本人預覽，確認了才用
  else if (!v && S.arg.keepH && SIG.h) setTimeout(function () { sigPaint(SIG.h); }, 150);   // 從直式回來：剛簽的橫式還在，不用重簽
};
var SIG = { drawn: false };
/**
 * 簽名頁的「返回」：直式 → 回橫式（剛簽的橫式留著）；從設定來重簽 → 回上一頁；
 * 第一次登入還沒簽完 → 回「選擇您的身分」，這支手機的登入作廢，要重新輸入啟用碼（例：選錯人、要改啟用別的帳號）。
 */
function sigBack() {
  if (S.arg.step === 'v') { S.arg = { keepH: 1 }; window.scrollTo(0, 0); return render(); }
  if (S.me && S.me.signature && S.me.signature.imageV) return back();
  if (!confirm('回到第一步「選擇您的身分」？\n\n回去後要重新選部門、選名字，並重新輸入啟用碼。')) return;
  SIG.h = null;
  logoutDo(S.me.person.name, lsGet(LS.TOKEN, ''));
}
/** 把已有的簽名圖放回簽名框（置中縮放），跟手簽一樣可以直接按下一步或清除重簽 */
function sigPaint(url) {
  var cv = $('cv'); if (!cv || !cv.clientWidth) return;
  var img = new Image();
  img.onload = function () {
    var ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight, pad = 10;
    var k = Math.min((W - pad * 2) / img.width, (H - pad * 2) / img.height, 1.5);
    var w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    SIG.drawn = true;
  };
  img.src = url;
}
function sigInit() {
  var cv = $('cv'), ctx;
  function size() {
    var w = cv.clientWidth;
    var hh = cv.clientHeight;
    if (!w || !hh) return setTimeout(size, 100);     // 版面還沒排好就量到 0：稍後重量，不可把寬度設成 0
    if (cv.width === w * 2) return;
    cv.width = w * 2; cv.height = hh * 2;
    ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  }
  size();
  var down = false, last = null;
  function pt(e) { var r = cv.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  function start(e) { e.preventDefault(); size(); down = true; last = pt(e); }
  function move(e) { if (!down) return; e.preventDefault(); var p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; SIG.drawn = true; }
  function end() { down = false; }
  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);
  SIG.drawn = false;
}
/** 上傳簽名照片：去背（白紙→透明、筆跡→深色）、放進簽名框，之後跟手簽一樣裁切縮小再存。 */
function sigUpload(inp) {
  var file = inp.files && inp.files[0]; inp.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type || 'image/')) return toast('請選照片檔（JPG、PNG）', 'err');
  if (file.size > 20 * 1024 * 1024) return toast('照片太大（超過 20 MB），請換一張', 'err');
  var url = URL.createObjectURL(file), img = new Image();
  img.onerror = function () { URL.revokeObjectURL(url); toast('這個檔案打不開，請用 JPG 或 PNG 照片', 'err', 4000); };
  img.onload = function () {
    URL.revokeObjectURL(url);
    var out = sigClean(img);
    if (!out.ok) return toast(out.msg, 'err', 4500);
    var cv = $('cv'), ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight, pad = 10;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
    var k = Math.min((W - pad * 2) / out.c.width, (H - pad * 2) / out.c.height);
    var w = out.c.width * k, h = out.c.height * k;
    ctx.drawImage(out.c, (W - w) / 2, (H - h) / 2, w, h);
    SIG.drawn = true;
    var vert = S.arg.step === 'v';
    if (vert && out.c.width > out.c.height * 1.2) toast('這張看起來是橫的簽名；直式要由上往下簽，請確認後再儲存', 'err', 5000);
    else if (!vert && out.c.height > out.c.width * 1.2) toast('這張看起來是直的簽名；這一步要橫式，請確認後再按下一步', 'err', 5000);
    else toast('已放進簽名框，確認沒問題就按下面的按鈕', 'ok', 3000);
  };
  img.src = url;
}
function sigClean(img) {
  var k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  if (w < 60 || h < 30) return { ok: false, msg: '照片太小，請拍大一點' };
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  var a0 = x.getImageData(0, 0, w, h).data, n = w * h, clear = 0;
  for (var i = 0; i < n; i++) if (a0[i * 4 + 3] < 250) clear++;
  x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);   // 透明處墊白底
  x.globalCompositeOperation = 'source-over';
  var id = x.getImageData(0, 0, w, h), d = id.data, lum = new Uint8Array(n), hist = new Array(256).fill(0);
  for (i = 0; i < n; i++) { var L = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0; lum[i] = L; hist[L]++; }
  // 已去背的 PNG：看得見、不是白色的就是筆跡，不用猜門檻，也不擋「太暗」
  if (clear > n * 0.05) {
    var inkA = 0;
    for (i = 0; i < n; i++) {
      var al = a0[i * 4 + 3];
      if (al >= 25 && lum[i] < 235) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 17; d[i * 4 + 3] = Math.min(255, Math.round(al * 1.3)); inkA++; }
      else d[i * 4 + 3] = 0;
    }
    if (inkA / n < 0.002) return { ok: false, msg: '這張去背圖看不到簽名（可能是白色字或整張透明），請換一張' };
    if (inkA / n > 0.9) return { ok: false, msg: '這張圖幾乎整片都是顏色，看不出簽名，請確認是已去背的簽名檔' };
    x.putImageData(id, 0, 0);
    return { ok: true, c: c };
  }
  // Otsu 自動找門檻：紙張有陰影、偏黃也分得開
  var sum = 0; for (var t = 0; t < 256; t++) sum += t * hist[t];
  var sB = 0, wB = 0, best = 0, th = 128;
  for (t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; var wF = n - wB; if (!wF) break; sB += t * hist[t];
    var mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = t; } }
  th = Math.min(th, 200);
  // 墨跡比例太高＝門檻落在背景裡（例如棋盤格截圖、灰紙）：只在較暗的那一群裡再找一次門檻，最多兩次
  var redo = false;
  for (var tries = 0; tries < 2; tries++) {
    var cnt = 0; for (t = 0; t <= th; t++) cnt += hist[t];
    if (cnt / n <= 0.25) break;
    var s2 = 0, n2 = 0; for (t = 0; t <= th; t++) { s2 += t * hist[t]; n2 += hist[t]; }
    var b2 = 0, w2 = 0, sb2 = 0, th2 = -1;
    for (t = 0; t < th; t++) { w2 += hist[t]; if (!w2) continue; var f2 = n2 - w2; if (!f2) break; sb2 += t * hist[t];
      var m1 = sb2 / w2, m2 = (s2 - sb2) / f2, v2 = w2 * f2 * (m1 - m2) * (m1 - m2); if (v2 > b2) { b2 = v2; th2 = t; } }
    if (th2 < 0) break;
    th = th2; redo = true;
  }
  // 重找過門檻的，門檻附近要是「谷底」（筆跡和背景分得開）；雜訊照片整片連續灰階，谷底不明顯就擋
  if (redo) { var near = 0; for (t = Math.max(0, th - 12); t <= Math.min(255, th + 12); t++) near += hist[t]; if (near / n > 0.03) return { ok: false, msg: '背景太暗或太雜，看不出哪裡是簽名。請在白紙上用黑筆簽，光線亮一點、只拍簽名那一塊' }; }
  var ink = 0;
  for (i = 0; i < n; i++) {
    if (lum[i] <= th) { var a = Math.min(255, Math.round((th - lum[i]) / Math.max(1, th) * 255 * 1.6) + 60); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 17; d[i * 4 + 3] = a; ink++; }
    else d[i * 4 + 3] = 0;
  }
  // 去雜點：四周 8 格幾乎沒有筆跡的孤立點當作紙張雜訊（不然裁切範圍會被撐大、簽名變很小）
  var keep = new Uint8Array(n);
  for (var yy = 1; yy < h - 1; yy++) for (var xx = 1; xx < w - 1; xx++) {
    var q = yy * w + xx; if (!d[q * 4 + 3]) continue;
    var nb = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dy || dx) && d[(q + dy * w + dx) * 4 + 3]) nb++;
    if (nb >= 2) keep[q] = 1;
  }
  ink = 0; for (i = 0; i < n; i++) { if (!keep[i]) d[i * 4 + 3] = 0; else ink++; }
  var r = ink / n;
  if (r < 0.002) return { ok: false, msg: '看不出簽名，請在白紙上用黑筆簽、拍清楚一點' };
  if (r > 0.35) return { ok: false, msg: '背景太暗或太雜，看不出哪裡是簽名。請在白紙上用黑筆簽，光線亮一點、只拍簽名那一塊' };
  x.putImageData(id, 0, 0);
  return { ok: true, c: c };
}
/** 橫式簽名自動轉直式：依字與字之間的空白切開，由上往下疊。切不出 2～5 個字（連筆）就回 null。 */
/** 橫式簽名轉直式：切成 n 段（n＝姓名字數），由上往下疊。
 *  先找字與字之間的空白；碎片（點、撇）併到最近的字；段數比 n 多就把間距最小的兩段合併，比 n 少就在最寬那段「筆跡最少的直線」切開。
 *  回傳 cb(canvas, exact)：exact＝完全靠空白切出來的（比較可靠）；切不出來 cb(null)。 */
function sigToVertical(src, n, cb) {
  var img = new Image();
  img.onload = function () {
    var w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0);
    var d = x.getImageData(0, 0, w, h).data, col = new Array(w).fill(0);
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 40) col[xx]++;
    var segs = [], st = -1, gap = 0, minGap = Math.max(2, Math.round(h * 0.04));
    for (xx = 0; xx <= w; xx++) {
      var on = xx < w && col[xx] > 0;
      if (on) { if (st < 0) st = xx; gap = 0; }
      else if (st >= 0) { gap++; if (gap >= minGap || xx === w) { segs.push([st, xx - gap + 1]); st = -1; gap = 0; } }
    }
    if (!segs.length) return cb(null);
    var minW = w * 0.08;
    for (var i = 0; i < segs.length; i++) if (segs.length > 1 && segs[i][1] - segs[i][0] < minW) {
      var j = i === 0 ? 1 : i === segs.length - 1 ? i - 1 : (segs[i][0] - segs[i - 1][1] < segs[i + 1][0] - segs[i][1] ? i - 1 : i + 1);
      segs[j] = [Math.min(segs[i][0], segs[j][0]), Math.max(segs[i][1], segs[j][1])]; segs.splice(i, 1); i = -1;
    }
    var want = n >= 2 && n <= 4 ? n : 0, exact = !want || segs.length === want;
    if (want) {
      while (segs.length > want) {                        // 太多段：合併間距最小的相鄰兩段
        var bi = 0, bg = Infinity;
        for (i = 0; i < segs.length - 1; i++) { var gg = segs[i + 1][0] - segs[i][1]; if (gg < bg) { bg = gg; bi = i; } }
        segs.splice(bi, 2, [segs[bi][0], segs[bi + 1][1]]);
      }
      var guard = 0;
      while (segs.length < want && guard++ < 10) {        // 太少段：最寬那段在中間一半範圍裡、筆跡最少的直線切開
        var wi = 0; for (i = 1; i < segs.length; i++) if (segs[i][1] - segs[i][0] > segs[wi][1] - segs[wi][0]) wi = i;
        var g0 = segs[wi], need = want - segs.length + 1;          // 這一段還要切成幾個字
        var target = g0[0] + (g0[1] - g0[0]) / need, lo = Math.round(target - (g0[1] - g0[0]) / need * 0.35), hi = Math.round(target + (g0[1] - g0[0]) / need * 0.35);
        var cut = Math.round(target), best = Infinity;
        for (xx = Math.max(g0[0] + 1, lo); xx <= Math.min(g0[1] - 1, hi); xx++) { var s3 = (col[xx - 1] || 0) + col[xx] + (col[xx + 1] || 0); if (s3 < best) { best = s3; cut = xx; } }
        segs.splice(wi, 1, [g0[0], cut], [cut, g0[1]]);
      }
    } else if (segs.length < 2 || segs.length > 5) return cb(null);
    var parts = segs.map(function (g) {
      var y0 = h, y1 = 0;
      for (var yy2 = 0; yy2 < h; yy2++) for (var xx2 = g[0]; xx2 < g[1]; xx2++) if (d[(yy2 * w + xx2) * 4 + 3] > 40) { if (yy2 < y0) y0 = yy2; if (yy2 > y1) y1 = yy2; }
      return y1 >= y0 ? { x: g[0], y: y0, w: g[1] - g[0], h: y1 - y0 + 1 } : null;
    }).filter(Boolean);
    if (parts.length < 2) return cb(null);
    var cw = Math.max.apply(null, parts.map(function (p) { return p.w; })), pad = Math.round(cw * 0.12);
    var o = document.createElement('canvas'); o.width = cw + pad * 2;
    o.height = parts.reduce(function (a, p) { return a + p.h; }, 0) + pad * (parts.length + 1);
    var ox = o.getContext('2d'), y = pad;
    parts.forEach(function (p) { ox.drawImage(c, p.x, p.y, p.w, p.h, pad + (cw - p.w) / 2, y, p.w, p.h); y += p.h + pad; });
    cb(o, exact, parts.length);
  };
  img.onerror = function () { cb(null); };
  img.src = src;
}
function nameLen() { var nm = S.me && S.me.person ? String(S.me.person.name || '').replace(/\s/g, '') : ''; return /^[一-鿿]{2,4}$/.test(nm) ? nm.length : 0; }
/** 進直式這一步（或按「用橫式自動轉」）：先做預覽，本人確認才放進框裡並儲存 */
function sigAutoV() {
  if (!SIG.h) return;
  var box = $('vprev'); if (!box) return;
  box.innerHTML = loading('把橫式簽名轉成直式…');
  sigToVertical(SIG.h, nameLen(), function (o, exact) {
    if (!o) { box.innerHTML = '<div class="muted">這個簽名沒辦法自動轉成直式，請在下面的框裡<b>由上往下</b>簽。</div>'; return; }
    SIG.vprev = o;
    box.innerHTML = '<div class="mr"><b>自動轉成的直式簽名</b></div>' +
      '<div class="muted">請確認<b>每個字都完整、上下順序正確</b>' + (exact ? '' : '（字有連在一起，系統是猜著切的，特別注意）') + '。</div>' +
      '<div class="vpv"><img alt="自動轉成的直式簽名" src="' + o.toDataURL('image/png') + '"></div>' +
      '<div class="btns r12"><button class="btn ghost" onclick="vpNo()">我自己簽</button><button class="btn" onclick="vpYes()">' + ic('check', 20, 2.8) + '用這個直式</button></div>';
  });
}
function vpYes() {
  var o = SIG.vprev; if (!o) return;
  var cv = $('cv'), ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight, pad = 10;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  var k = Math.min((W - pad * 2) / o.width, (H - pad * 2) / o.height), ww = o.width * k, hh = o.height * k;
  ctx.drawImage(o, (W - ww) / 2, (H - hh) / 2, ww, hh);
  SIG.drawn = true;
  $('vprev').innerHTML = '<div class="muted okt">' + ic('check', 18, 3) + ' 已放進直式框，儲存中…</div>';
  sigNext();
}
function vpNo() { SIG.vprev = null; $('vprev').innerHTML = '<div class="muted">好，請在下面的框裡<b>由上往下</b>簽全名；也可以上傳直式簽名照片。</div>'; sigClear(); }
function sigClear() { var cv = $('cv'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); SIG.drawn = false; }
/** 裁到筆跡範圍、縮小、存成透明 PNG（約 5～15 KB）。 */
function sigExport() {
  var cv = $('cv'), ctx = cv.getContext('2d');
  var d = ctx.getImageData(0, 0, cv.width, cv.height).data, x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (var y = 0; y < cv.height; y += 2) for (var x = 0; x < cv.width; x += 2) {
    if (d[(y * cv.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  if (Math.max(x1 - x0, y1 - y0) < 40 || Math.min(x1 - x0, y1 - y0) < 16) return null;
  x0 = Math.max(0, x0 - 8); y0 = Math.max(0, y0 - 8); x1 = Math.min(cv.width, x1 + 8); y1 = Math.min(cv.height, y1 + 8);
  var w = x1 - x0, h = y1 - y0, vert = h > w, k = vert ? Math.min(1, 140 / w, 360 / h) : Math.min(1, 360 / w, 140 / h);
  var o = document.createElement('canvas'); o.width = Math.round(w * k); o.height = Math.round(h * k);
  o.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}
function sigNext() {
  if (!SIG.drawn) return toast('請先簽名', 'err');
  var img = sigExport();
  if (!img) return toast('簽名太小，請簽大一點', 'err');
  if (img.length > 44000) return toast('簽名圖雜點太多，請用白紙黑筆重拍，或直接在框裡簽', 'err', 4500);
  if (S.arg.step !== 'v') { SIG.h = img; S.arg = { step: 'v' }; window.scrollTo(0, 0); return render(); }
  var btn = $('sigBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>儲存中…';
  api('saveSignature', { image: SIG.h, imageV: img }).then(function (r) {
    S.me.signature = { id: r.id, image: SIG.h, imageV: img };
    var raw = lsGet(LS.ME, null); if (raw) { raw.signature = S.me.signature; lsSet(LS.ME, raw); }
    toast('簽名已存', 'ok'); S.stack = []; go(landing(), {}, true);
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); btn.disabled = false; btn.className = 'btn'; btn.textContent = '再試一次'; });
}

// ───────────── 首頁（依角色：先講要做的事）─────────────
function duePill(a) {
  var d = a.due || {};
  if (a.daily) {
    if (pendingFor(a, today())) return pill('info', 'up', '待上傳');
    if (d.todayNoWork) return pill('na', 'minus', '今日無作業');
    if (d.todayDone && d.signer && S.me && d.signer !== S.me.person.name) return pill('ok', 'check', d.signer + ' 已檢點');   // 同事檢點了（輪流、代理、代填）：寫出是誰
    return d.todayDone ? pill('ok', 'check', '已檢點') : pill('warn', 'clock', '今天未檢點');
  }
  return ({ never: pill('na', '', '尚無紀錄'), overdue: pill('ng', 'warn', '已到期'), soon: pill('warn', 'clock', '快到期'), ok: pill('ok', 'check', '期限內') })[d.state] || '';
}
function dueMeta(a) {
  var d = a.due || {};
  return (a.freq || '') + (d.last ? '｜上次 ' + d.last + (d.due ? '｜下次 ' + d.due : '') : '');
}
function goMonth(dept, period) { return "go('month',{dept:" + jsq(dept) + ',period:' + jsq(period) + '})'; }
function pickName(a) { var f = F(a.form); return (f ? f.name : '') + (a.object ? ' ' + a.object : ''); }
function taskHtml(x, i) {
  return '<div class="task' + (i === 0 ? ' first' : '') + (x.red ? ' red' : '') + '"><div class="tx"><span class="tg">' + esc(x.tag) + '</span><span class="tt">' + esc(x.title) + '</span>' +
    (x.meta ? '<span class="tm">' + esc(x.meta) + '</span>' : '') + '</div>' +
    '<button class="btn ' + (i === 0 ? 'big' : 'line') + '" onclick="' + x.on + '">' + esc(x.btn) + (i === 0 ? ic('arrow', 22, 2.6) : '') + '</button></div>';
}
function tile(icon, label, on, extra, sub) {
  return '<button class="tile" onclick="' + on + '"><span class="tr">' + ic(icon, 24, 2.2) + (extra || '') + '</span><b>' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</b></button>';
}
PAGES.home = function () {
  setTitle('員和環安衛系統');
  var m = S.me;
  if (!m) { $('app').innerHTML = loading('載入中…'); return; }
  if (!S.pf) setTimeout(prefetch, 1200);                     // 首頁畫好後趁空檔預讀常點的畫面（一次開 App 只做一次）
  var t = today(), ehs = isEhs(), mgr = isMgr(), multi = m.depts.length > 1;
  var dn = function (d) { return multi ? d + '・' : ''; };
  var tasks = [];
  // 0. 環安衛廣播（未讀的放最上面，點開就是全文）
  (m.notices || []).filter(function (x) { return !x.read && x.type === '廣播'; }).slice(0, 3).forEach(function (x) {
    tasks.push({ red: true, tag: '環安衛中心廣播・' + x.time.slice(5).replace('-', '/'), title: x.title, meta: bcBody(x.body).slice(0, 60), btn: '查看全文', on: "go('notice')" });
  });
  // 0.5 其他未讀通知
  var unreadOther = (m.notices || []).filter(function (x) { return !x.read && x.type !== '廣播'; });
  if (unreadOther.length) tasks.push({ tag: '新通知', title: '有 ' + unreadOther.length + ' 則新通知', meta: unreadOther.slice(0, 2).map(function (x) { return window.I18N ? I18N.tr(x.title) : x.title; }).join(window.I18N && I18N.lang() !== 'zh' ? ' · ' : '、'),   // 兩則標題各自翻譯再接起來（接起來的整句字典比不到）
    btn: '查看通知', on: "go('notice')" });
  // 0.5 一次補填做到一半（中途離開）：接著補
  var bfq = bfGet();
  if (bfq && !ehs) tasks.push({ red: true, tag: '補填中', title: '還有 ' + (bfq.list.length - bfq.i) + ' 張要補填', meta: '下一張：' + md(bfq.list[bfq.i].date) + ' ' + bfq.list[bfq.i].name, btn: '繼續補填', on: 'bfOpen()' });
  // 0.6 環安衛教育訓練還沒看的（只有日常檢點一個功能的人平常都停在這頁，所以在這裡也提醒）
  var eu = (plat() || {}).eduUnread || 0;
  if (!ehs && eu) tasks.push({ tag: '環安衛教育訓練', title: '有 ' + eu + ' 則教育訓練、衛教文宣待完成', meta: '課程看完要按「我已完成」，要確認的按「我已閱讀」', btn: '去看看', on: "go('edu')" });
  // 0.8 異常追蹤：還沒填改善的（檢點人員、單位負責人）
  if (!ehs && m.tracksOpen) tasks.push({ red: true, tag: '異常追蹤', title: '有 ' + m.tracksOpen + ' 件異常待改善', meta: '改善好了填寫處理方式就能結案', btn: '去處理', on: "S.tk=null;go('track')" });
  // 1. 被退回
  if (!ehs) m.months.forEach(function (x) {
    if (x.status === '退回' && !mgrOf(x.dept)) tasks.push({ red: true, tag: dn(x.dept) + '被退回，要修正', title: ymLabel(x.period) + '的檢點紀錄', meta: '退回原因：' + (x.reason || '（未填寫）'), btn: '去修正並重新送出', on: goMonth(x.dept, x.period) });
  });
  // 1.5 試算表填的、還沒在手機確認
  if (!ehs) (m.confirms || []).forEach(function (c) {
    tasks.push({ tag: dn(c.dept) + ymLabel(c.period) + '・試算表填的紀錄', title: c.n + ' 筆還沒在手機確認', meta: '確認後才會帶入您的電子簽名，才能送審',
      btn: '查看並確認', on: goMonth(c.dept, c.period) });
  });
  // 1.8 歸檔收尾沒做完（環安衛）
  if (ehs) (m.archPending || []).forEach(function (x) {
    tasks.push({ red: true, tag: '歸檔收尾還沒完成', title: x.dept + ' ' + ymLabel(x.period), meta: '每張表的 PDF 或通知信還沒做完（每天 09:15 電腦也會自動補做）',
      btn: '繼續完成', on: 'archLoop(' + jsq(x.monthId) + ')' });
  });
  // 2. 待審核（主管／環安衛）
  // v0.13.15：同仁的領取申請要單位負責人核准
  var nReq = 0; (m.depts || []).forEach(function (d) { nReq += d.claimReq || 0; });
  if (nReq) tasks.push({ red: true, tag: '領取申請', title: '有 ' + nReq + ' 件領取申請待您核准', meta: '同仁要負責的表或設備，核准後才會出現在他的手機上', btn: '去核准', on: "go('claimReview')" });
  if (m.pendingReview) {
    var want = ehs ? '待環安衛審核' : '待主管審核';
    var mine = (S.pkgs || []).filter(function (x) { return x.status === want; });
    if (mine.length) mine.forEach(function (x) {
      tasks.push({ tag: ehs ? '單位負責人已核准，待您歸檔' : '待您審核', title: x.dept + ' ' + ymLabel(x.period), meta: (x.submitter || '') + ' ' + (x.submittedAt || '').slice(5, 16) + ' 送出',
        btn: ehs ? '看 PDF 並歸檔' : '開始審核', on: goMonth(x.dept, x.period) });
    });
    else tasks.push({ tag: ehs ? '待您歸檔' : '待您審核', title: '有 ' + m.pendingReview + ' 份等您' + (ehs ? '歸檔' : '審核'),
      meta: ehs ? '單位負責人已簽，請看 PDF 後歸檔' : '檢點人員已鎖定送審', btn: '查看待審核清單', on: "go('packages')" });
    if (S.pkgs == null) loadPkgs();
  }
  // 3. 今天的每日檢點（檢點人員）
  var daily = m.assigns.filter(function (a) { return a.daily && F(a.form); });
  var done = [], todo = [];
  daily.forEach(function (a) { if (pendingFor(a, t) || a.due.todayDone) done.push(a); else todo.push(a); });
  if (!ehs && !mgr) todo.forEach(function (a) {
    var f = F(a.form);
    tasks.push({ tag: dn(a.dept) + '今天的每日檢點', title: f.name, meta: '共 ' + f.items.length + ' 項・沒問題按「全部正常」就好', btn: '開始檢點', on: 'openFill(' + jsq(a.key) + ')' });
  });
  // 4. 已到期的定期檢查
  if (!ehs && !mgr) m.depts.forEach(function (d) {
    var od = m.assigns.filter(function (a) { return a.dept === d.id && a.pick && a.due && a.due.state === 'overdue'; });
    if (od.length) tasks.push({ tag: dn(d.id) + '定期檢查', title: od.length + ' 張已到期', meta: od.slice(0, 2).map(pickName).join('、') + (od.length > 2 ? '…' : ''), btn: '去看看', on: "go('mine')" });
  });
  // 4.5 還沒有任何表（檢點人員）：去領取
  if (!ehs && !mgr && !m.assigns.some(function (a) { return a.daily || a.pick; }))
    tasks.push({ tag: '還沒有指派給您的檢查表', title: '先領取您負責的表或設備', meta: m.claimable.length ? '本課開放 ' + m.claimable.length + ' 項可以領取；領了才會出現在手機上' : '目前沒有可領取的表，請洽環安衛中心',
      btn: '去領取', on: "go('claim')" });
  // 5. 上個月還沒送審：送審期限（預設每月 5 日）前放在下方「月結送審」，過了期限才變成要做的事
  var sDay = m.submitDay || 5, dueTxt = function (p) { var d = new Date(Number(p.slice(0, 4)), Number(p.slice(5)), sDay); return (d.getMonth() + 1) + '/' + d.getDate(); };
  var subs = [];
  if (!ehs) m.months.forEach(function (x) {
    if (x.period < t.slice(0, 7) && x.status === '填寫中' && !mgrOf(x.dept)) {     // 送審是檢點人員的事；主管看「各課執行狀況」
      var mo = Number(x.period.slice(5)), late = Number(t.slice(8)) > sDay;
      if (late) tasks.push({ red: true, tag: dn(x.dept) + '已超過 ' + dueTxt(x.period) + ' 送審期限', title: '送出 ' + mo + ' 月的檢點紀錄', meta: '整課一起送，任一位同仁送出即可', btn: '檢查並送出 ' + mo + ' 月', on: goMonth(x.dept, x.period) });
      else subs.push(x);
    }
  });

  // 頂部
  var say, sub;
  if (ehs) { say = m.pendingReview ? '有 <b>' + m.pendingReview + '</b> 份等您歸檔' : '目前沒有要歸檔的'; sub = m.person.role; }
  else if (mgr) { say = m.pendingReview ? '有 <b>' + m.pendingReview + '</b> 份檢點紀錄等您審核' : (tasks.length ? '還有 <b>' + tasks.length + '</b> 件事要做' : '目前沒有待辦事項'); sub = m.depts.map(function (d) { return d.id; }).join('、') + '・' + m.person.role; }
  else { say = tasks.length ? '今天還有 <b>' + tasks.length + '</b> 件事要做' : '今天的事都做完了'; sub = m.depts.map(function (d) { return d.id; }).join('、') + '・' + Number(t.slice(5, 7)) + ' 月 ' + Number(t.slice(8)) + ' 日（' + wk(t) + '）'; }
  var hs = '<div class="say">' + say + '</div>';
  if (!ehs && !mgr && daily.length) {
    var up = done.filter(function (a) { return pendingFor(a, t); }).length, ok = done.length - up;
    var segs = ''; for (var i = 0; i < daily.length; i++) segs += '<span class="' + (i < ok ? 'ok' : i < ok + up ? 'up' : '') + '"></span>';
    var parts = []; if (ok) parts.push(ok + ' 張已上傳'); if (up) parts.push(up + ' 張待上傳'); if (todo.length) parts.push(todo.length + ' 張還沒做');
    hs += '<div class="dbar" aria-hidden="true">' + segs + '</div><div class="hnote">每日檢點 ' + daily.length + ' 張：' + parts.join('、') + '</div>';
  }
  S.hero = '<div class="hero-in">' + heroTop() + '<div class="hi"><div class="hn"><div class="h1">' + greet() + '，' + esc(m.person.name) + '</div><div class="hsub">' + esc(sub) + '</div></div></div>' +
    '<div class="hs">' + hs + '</div></div>';

  // 內容
  var h = netBlock() + clockBlock() + outboxBlock();
  if (tasks.length) h += '<div class="sec"><span class="sl"><span class="cnt">' + tasks.length + '</span>要做的事</span></div>' + tasks.map(taskHtml).join('');
  else h += '<div class="card calm">' + ic('check', 24, 3) + '目前沒有要做的事</div>';
  if (subs.length) h += '<div class="sec">月結送審<small>' + dueTxt(subs[0].period) + ' 前送出</small></div><div class="list">' + subs.map(function (x) {
    return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '"><span class="mn"><span class="nm">' + esc(dn(x.dept) + ymLabel(x.period)) + '</span>' +
      '<span class="mt">' + (demoDept(x.dept) ? '整課一起送，任一位同仁送出即可' : '先確認沒有漏填（可補填），整課一起送，任一位同仁送出即可') + '</span></span>' + pill('na', 'pen', '可以送審') + '</button>';
  }).join('') + '</div>';

  if (!ehs && !mgr && done.length) {
    h += '<div class="sec">今天已完成</div><div class="list">' + done.map(function (a) {
      var job = pendJob(a, t);
      var dot = job ? '<span class="dotic info">' + ic('up', 16, 3) + '</span>' : a.due.todayNoWork ? '<span class="dotic na">' + ic('minus', 16, 3) + '</span>' : '<span class="dotic ok">' + ic('check', 16, 3.2) + '</span>';
      var other = a.due.signer && a.due.signer !== m.person.name;     // 同課別人已經檢點
      var st = job && job.status === 'auth' ? '<span class="mt inf">' + esc(job.who || '之前登入的人') + ' 已填，等他重新登入後上傳</span>' :
        job ? '<span class="mt inf">已存手機，等待上傳・' + hm(job.created) + '</span>' : a.due.todayNoWork ? '<span class="mt">今日無作業</span>' :
        a.due.state === 'sheet' ? '<span class="mt inf">在試算表填好了，待您確認</span>' :
        other ? '<span class="mt okt">' + esc(a.due.signer) + ' 已檢點</span>' : '<span class="mt okt">已上傳</span>';
      return '<button class="li" onclick="openFill(' + jsq(a.key) + ')">' + dot + '<span class="mn"><span class="nm">' + esc(dn(a.dept) + F(a.form).name) + '</span>' + st + '</span></button>';
    }).join('') + '</div>';
  }
  if (mgr || ehs) h += overviewHtml();

  // 入口
  var tl = '';
  if (!ehs) m.depts.forEach(function (d) {
    var picks = m.assigns.filter(function (a) { return a.dept === d.id && (a.pick || a.missingEquip); });
    if (!picks.length) return;
    var warn = picks.filter(function (a) { return a.due && (a.due.state === 'overdue' || a.due.state === 'soon'); }).length;
    if (!mgr) return;
    tl += tile('clip', '其他檢查表', "go('pick',{dept:" + jsq(d.id) + '})', warn ? pill('warn', '', warn + ' 張快到期') : '', multi ? d.id : '定期、堆高機、烘箱…');
  });
  if (!ehs && !mgr && m.assigns.some(function (a) { return a.daily || a.pick || a.missingEquip; })) {
    var w2 = m.assigns.filter(function (a) { return a.pick && a.due && (a.due.state === 'overdue' || a.due.state === 'soon'); }).length;
    tl = tile('clip', '我的表單', "go('mine')", w2 ? pill('warn', '', w2 + ' 張快到期') : '', '每日、定期檢查與期限') + tl;
  }
  if (!ehs && m.depts.some(function (d) { return m.assigns.some(function (a) { return a.dept === d.id && a.daily; }); }))
    tl += tile('chat', '請人代填', "go('shareMake')", '', '休假時給同事限時連結');
  if (!ehs && !mgr && m.claimable.length) tl += tile('plus', '領取表單', "go('claim')", '', '本課其他表、其他設備');
  if (mgr || ehs) tl += tile('review', '審核紀錄', "go('packages')");
  if (mgr || ehs) tl += tile('swap', '部門管理', "S.team=null;go('team')", '', '人員、表單、設備與負責人');
  if (ehs) tl += tile('bell', '廣播', "S.bc=null;go('bc')", '', '發通知給指定的人');
  tl += tile('warn', '異常追蹤', "S.tk=null;go('track')", m.tracksOpen ? pill('ng', '', m.tracksOpen + ' 件待改善') : '', '異常改善與結案');
  if (!ehs) { var d1 = m.depts.length === 1 ? m.depts[0].id : '';
    if (d1 && demoDept(d1)) tl += tile('cal', '月曆', goMonth(d1, t.slice(0, 7)), '', '本月每天的紀錄');
    else tl += tile('cal', '月曆・補填', d1 ? goMonth(d1, t.slice(0, 7)) : "go('months')", '', d1 ? '本月每天的紀錄，漏填的點日期補' : '選部門看月曆、補填'); }
  tl += tile('review', '月結紀錄', "go('months')");
  tl += tile('clock', '提醒設定', "go('remind')");
  h += '<div class="tiles">' + tl + '</div><div class="ver">v' + APP_VERSION + '</div>';
  $('app').innerHTML = h;
};
// ───────────── 各課執行狀況（環安衛、單位負責人）：一課一張卡，收合時一行看今天進度，展開看每張表與月結 ─────────────
var OV_AT = 0;
function ovOpenGet() { try { return JSON.parse(localStorage.getItem('chk_ov_open') || '{}'); } catch (e) { return {}; } }
function ovOpenSet(o) { try { localStorage.setItem('chk_ov_open', JSON.stringify(o)); } catch (e) {} }
function ovLoad(force) {
  if (!force && (S.ovBusy || Date.now() - OV_AT < 60000)) return;
  S.ovBusy = true;
  api('overview', {}, { quiet: true }).then(function (r) { S.ov = r; S.ovErr = false; OV_AT = Date.now(); S.ovBusy = false; if (S.page === 'home') render(); })
    .catch(function () { S.ovBusy = false; S.ovErr = true; OV_AT = Date.now(); if (S.page === 'home') render(); });
}
function ovSum(d) {
  var c = { done: 0, nowork: 0, todo: 0, ng: 0, n: d.forms.length };
  d.forms.forEach(function (x) { c[x.state]++; if (x.ng) c.ng++; });
  return c;
}
function overviewHtml() {
  ovLoad(false);
  var ov = S.ov, t = today();
  if (!ov && S.ovErr) {                                  // 沒網路或後端還是舊版：照舊列月結進度
    var lastP = (function () { var d = nowD(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ymd(d).slice(0, 7); })();
    var ms = (S.me.months || []).filter(function (x) { return x.period >= lastP || x.status !== '已歸檔'; })
      .sort(function (x, y) { return x.period < y.period ? 1 : x.period > y.period ? -1 : (x.dept < y.dept ? -1 : 1); });
    return ms.length ? '<div class="sec">各部門月結進度<small>連上網路後顯示各課今天的檢點</small></div><div class="list">' + ms.map(monthRow).join('') + '</div>' : '';
  }
  if (!ov) return '<div class="sec">各課執行狀況</div>' + loading('讀取各課今天的檢點…');
  var open = ovOpenGet(), many = ov.depts.length > 3;
  var isOpenOf = function (id) { return id in open ? open[id] : !many; };
  var rank = function (d) { var c = ovSum(d); return c.ng ? 0 : c.todo ? 1 : d.unconf ? 2 : 3; };
  var list = ov.depts.slice().sort(function (a, b) { return rank(a) - rank(b) || (a.id < b.id ? -1 : 1); });
  var tot = { ok: 0, todo: 0, ng: 0 };
  list.forEach(function (d) { var c = ovSum(d); if (c.ng) tot.ng++; if (c.todo) tot.todo++; else if (c.n) tot.ok++; });
  var h = '<div class="sec">各課執行狀況<small>' + md(t) + '（' + wk(t) + '）・' + (ov.today === t ? '' : '更新中・') +
    '<button class="lnk" onclick="ovAll()">' + (ov.depts.some(function (d) { return isOpenOf(d.id); }) ? '全部收合' : '全部展開') + '</button></small></div>';
  if (list.length > 1) h += '<div class="ovsum">' + list.length + ' 個課：' + [tot.ok ? '今日完成 ' + tot.ok : '', tot.todo ? '未完成 ' + tot.todo : '', tot.ng ? '<b class="ngt">有異常 ' + tot.ng + '</b>' : ''].filter(String).join('・') + '</div>';
  // v0.13.10（10/14 Jason：首頁精簡）：同群組兩課以上收成一張群組卡（PU生產 → 製1～製5；BU生產 → A／B／C 區、倉儲部），點開才看到各課
  var card = function (d, inG) {
    var c = ovSum(d), isOpen = isOpenOf(d.id);
    var pv = d.months[0], cur = d.months[1];
    var line = c.n ? '已檢點 ' + c.done + '/' + c.n + (c.nowork ? '・無作業 ' + c.nowork : '') : '沒有在用的每日表';
    if (d.unconf) line += '・待確認 ' + d.unconf;
    var mline = pv.status !== '已歸檔' ? ymLabel(pv.period) + '：' + pv.status : '';
    var pl = c.ng ? pill('ng', 'warn', '異常 ' + c.ng) : c.todo ? pill('warn', 'clock', c.todo + ' 張未檢點') : c.n ? pill('ok', 'check', '今日完成') : '';
    var x = '<div class="ov' + (isOpen ? ' open' : '') + '"><button class="ovh" onclick="ovToggle(' + jsq(d.id) + ')" aria-expanded="' + isOpen + '">' +
      '<span class="chv">' + ic('chev', 18, 2.6) + '</span><span class="mn"><span class="nm">' + esc(inG ? d.label || d.id : d.id) + '</span><span class="mt">' + esc(line) + '</span>' +
      (mline ? '<span class="mt' + (pv.status === '退回' ? ' wn' : '') + '">' + esc(mline) + '</span>' : '') + '</span>' + pl + '</button>';
    if (isOpen) {
      x += '<div class="ovb">' + (d.forms.length ? d.forms.map(function (f) {
        var a = (S.me.assigns || []).filter(function (y) { return y.daily && y.dept === d.id && y.form === f.form; })[0];
        var st = f.state === 'done' ? (f.ng ? pill('ng', 'warn', '異常') : pill('ok', 'check', '已檢點')) : f.state === 'nowork' ? pill('na', 'minus', '無作業') : pill('warn', 'clock', '未檢點');
        var meta = (f.signer ? f.signer + ' 已檢點' : '負責：' + (f.who.join('、') || '—')) + '・本月已填 ' + f.filled + ' 天';
        var inner = '<span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + esc(meta) + '</span></span>' + st;
        return a && !isEhs() ? '<button class="li" onclick="openFill(' + jsq(a.key) + ')">' + inner + '</button>' : '<div class="li">' + inner + '</div>';
      }).join('') : '<div class="li"><span class="mn"><span class="mt">這個課目前沒有在用的每日表</span></span></div>') +
      (S.me.months || []).filter(function (y) { return y.dept === d.id; }).sort(function (a2, b2) { return a2.period < b2.period ? 1 : -1; }).map(monthRow).join('') + '</div>';
    }
    return x + '</div>';
  };
  var gN = {}; list.forEach(function (d) { if (d.g) gN[d.g] = (gN[d.g] || 0) + 1; });
  var seen = {};
  h += '<div class="ovs">' + list.map(function (d) {
    if (!d.g || gN[d.g] < 2) return card(d, false);
    if (seen[d.g]) return ''; seen[d.g] = 1;
    var mem = list.filter(function (y) { return y.g === d.g; }), gid = 'g:' + d.g, gOpen = gid in open ? open[gid] : false;
    var s2 = { n: 0, done: 0, todo: 0, ng: 0, back: 0 };
    mem.forEach(function (y) { var c = ovSum(y); s2.n += c.n; s2.done += c.done; if (c.todo) s2.todo++; if (c.ng) s2.ng++; if (y.months[0].status === '退回') s2.back++; });
    var gl = mem.length + ' 課・已檢點 ' + s2.done + '/' + s2.n + (s2.back ? '・退回 ' + s2.back : '');
    var gp = s2.ng ? pill('ng', 'warn', s2.ng + ' 課異常') : s2.todo ? pill('warn', 'clock', s2.todo + ' 課未完成') : s2.n ? pill('ok', 'check', '今日完成') : '';
    return '<div class="ov' + (gOpen ? ' open' : '') + '"><button class="ovh" onclick="ovToggle(' + jsq(gid) + ')" aria-expanded="' + gOpen + '">' +
      '<span class="chv">' + ic('chev', 18, 2.6) + '</span><span class="mn"><span class="nm">' + esc(d.g) + '</span><span class="mt">' + esc(gl) + '</span></span>' + gp + '</button>' +
      (gOpen ? '<div class="ovg">' + mem.map(function (y) { return card(y, true); }).join('') + '</div>' : '') + '</div>';
  }).join('') + '</div>';
  return h;
}
function ovToggle(id) { var o = ovOpenGet(), many = S.ov && S.ov.depts.length > 3; o[id] = !(id in o ? o[id] : !many); ovOpenSet(o); render(); }
function ovAll() {
  var o = ovOpenGet(), ds = S.ov ? S.ov.depts : [], many = ds.length > 3, n = {};
  var anyOpen = ds.some(function (d) { return d.id in o ? o[d.id] : !many; });
  ds.forEach(function (d) { n[d.id] = !anyOpen; if (d.g) n['g:' + d.g] = !anyOpen; }); ovOpenSet(n); render();
}
function monthRow(x) {
  if (x.crew) return crewRow(x);
  return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '"><span class="mn"><span class="nm">' + esc(x.dept) + '　<span class="nw">' + ymLabel(x.period) + '</span></span>' +
    (x.status === '填寫中' ? '<span class="mt">查看紀錄、鎖定送審</span>' : x.status === '退回' && x.reason ? '<span class="mt wn">' + esc('退回：' + x.reason) + '</span>' : '') + '</span>' + statusPill(x.status) + '</button>';
}

/** 單位負責人：一課一列，列出每位檢點人員這個月填了幾天；送審後才可以點進去審核。 */
var REVIEWABLE = ['待主管審核', '待環安衛審核', '已歸檔'];
function crewRow(x) {
  var crew = (x.crew || []).map(function (c) { return c.name + ' ' + c.days + ' 天'; }).join('、') || '名單沒有檢點人員';
  var sub = x.status === '待主管審核' ? (x.submitter || '') + ' ' + (x.submittedAt || '').slice(5) + ' 送審' : x.status === '退回' ? '退回修正中' + (x.reason ? '：' + x.reason : '') : x.status === '填寫中' ? '尚未送審' : '';
  var head = '<span class="mn"><span class="nm">' + esc(x.dept) + '　<span class="nw">' + ymLabel(x.period) + '</span></span><span class="mt">' + esc(crew) + '</span>' +
    (sub ? '<span class="mt' + (x.status === '退回' ? ' wn' : '') + '">' + esc(sub) + '</span>' : '') + '</span>';
  if (REVIEWABLE.indexOf(x.status) < 0) return '<div class="li off" aria-disabled="true">' + head + statusPill(x.status) + '</div>';
  return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '">' + head + statusPill(x.status) + '</button>';
}

// 月結紀錄清單（首頁入口）
PAGES.months = function () {
  setTitle('月結紀錄');
  var ms = (S.me.months || []).slice().sort(function (x, y) { return x.period < y.period ? 1 : x.period > y.period ? -1 : (x.dept < y.dept ? -1 : 1); });
  $('app').innerHTML = ms.length ? '<div class="list">' + ms.map(monthRow).join('') + '</div>' : '<div class="empty">還沒有月結紀錄</div>';
};

PAGES.pick = function () {
  setTitle('其他檢查表');
  var dept = S.arg.dept;
  var list = S.me.assigns.filter(function (a) { return a.dept === dept && (a.pick || a.missingEquip); });
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">需要做的時候從這裡選一張來填。快到期、已到期的會標出來。</div></div></div></div>', last = null, open = false;
  list.forEach(function (a) {
    var f = F(a.form); if (!f) return;
    if (a.form !== last) { if (open) h += '</div>'; last = a.form; h += '<div class="sec">' + esc(f.name) + '</div><div class="list">'; open = true; }
    if (a.missingEquip) { h += '<div class="li"><span class="mn"><span class="mt">後台還沒建立這個部門的' + esc(a.missingEquip) + '編號，請洽環安衛中心。</span></span></div>'; return; }
    h += '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' +
      esc([a.object ? a.object + (a.objectName ? ' ' + a.objectName : '') : '', a.kind].filter(String).join('｜') || f.name) + '</span>' +
      '<span class="mt">' + esc(dueMeta(a)) + '</span></span>' + duePill(a) + '</button>';
  });
  if (open) h += '</div>';
  if (!list.length) h += '<div class="empty">這個部門沒有其他檢查表</div>';
  $('app').innerHTML = h;
};
// ───────────── 領取表單：本課已開放、還不是自己的表或設備（表單內容只有環安衛中心能改）─────────────
PAGES.claim = function () {
  setTitle('領取表單');
  var list = S.me.claimable || [], multi = S.me.depts.length > 1;
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">這裡是本課已開放、但還沒指派給您的表。按「領取」會送申請給單位負責人，核准後就會出現在首頁。' +
    '要取消領取請洽單位負責人。</div></div></div></div>';
  S.me.depts.forEach(function (d) {
    var mine = list.filter(function (x) { return x.dept === d.id; });
    if (!mine.length) return;
    var fs = mine.filter(function (x) { return x.kind === 'form'; }), es = mine.filter(function (x) { return x.kind === 'equip'; });
    if (fs.length) h += '<div class="sec">' + esc((multi ? d.id + '・' : '') + '檢查表') + '</div><div class="list">' + fs.map(function (x, i) {
      return claimRow(x, x.name, (x.daily ? '每日檢點' : '定期檢查') + '・' + (x.users.length ? '目前使用：' + x.users.join('、') : '目前沒有人使用'), 'f' + i + d.id);
    }).join('') + '</div>';
    if (es.length) h += '<div class="sec">' + esc((multi ? d.id + '・' : '') + '設備（一台一台領）') + '</div><div class="list">' + es.map(function (x, i) {
      return claimRow(x, x.cat + ' ' + x.object + (x.objectName ? '（' + x.objectName + '）' : ''),
        '用到：' + x.forms.join('、') + '・' + (x.users.length ? '目前負責：' + x.users.join('、') : '目前沒有負責人'), 'e' + i + d.id);
    }).join('') + '</div>';
  });
  if (!list.length) h += '<div class="empty">本課開放的表都已經是您的了</div>';
  $('app').innerHTML = h;
};
var CLAIMS = {};
function claimRow(x, title, meta, k) {
  CLAIMS[k] = x;
  return '<div class="li"><span class="mn"><span class="nm">' + esc(title) + '</span><span class="mt">' + esc(meta) + '</span></span>' +
    (x.pending ? pill('warn', 'clock', '待單位負責人核准') : '<button class="btn sm" onclick="claimGo(' + jsq(k) + ')">領取</button>') + '</div>';
}
function claimGo(k) {
  var x = CLAIMS[k]; if (!x) return;
  var what = x.kind === 'equip' ? x.cat + ' ' + x.object : x.name;
  if (!confirm('申請領取「' + what + '」？\n送出後要單位負責人核准，核准了首頁才會出現' + (x.kind === 'equip' ? '這台設備的檢查表' : '這張表') + '。')) return;
  if (!navigator.onLine) return toast('沒有網路，領取要連上網路才能做', 'err', 3500);
  busyOn('領取中…');
  api('claim', x.kind === 'equip' ? { deptId: x.dept, kind: 'equip', cat: x.cat, object: x.object } : { deptId: x.dept, kind: 'form', formId: x.form }).then(function (r) {
    busyOff(); S.me = normMe(r.me); lsSet(LS.ME, r.me);
    toast('已送出申請：' + what + '，等單位負責人核准', 'ok', 3500); render();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
// ───────────── 領取申請（單位負責人核准）─────────────
PAGES.claimReview = function () {
  setTitle('領取申請');
  var cr = S.cr;
  if (!cr) {
    $('app').innerHTML = loading('讀取領取申請…');
    api('claimList', {}).then(function (r) { S.cr = r; if (S.page === 'claimReview') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到領取申請', e.message); });
    return;
  }
  var h = '<div class="muted upnote">同仁申請負責的表或設備。核准後馬上出現在他的手機上，環安衛中心會收到異動通知；退回請寫原因。</div>';
  h += cr.list.length ? '<div class="list">' + cr.list.map(function (x) {
    return '<div class="li"><span class="mn"><span class="nm">' + esc(x.name + '：' + x.what) + '</span><span class="mt">' + esc(x.dept + '・' + x.time.slice(5) + ' 申請') + '</span>' +
      '<span class="mt">' + esc(x.users.length ? '目前負責：' + x.users.join('、') : '目前沒有人負責') + '</span>' +
      '<span class="btns"><button class="btn sm" onclick="claimDecide(' + jsq(x.id) + ',' + jsq('approve') + ')">核准</button><button class="btn sm ghost" onclick="claimDecide(' + jsq(x.id) + ',' + jsq('reject') + ')">退回</button></span></span></div>';
  }).join('') + '</div>' : '<div class="empty">目前沒有待核准的領取申請</div>';
  $('app').innerHTML = h;
};
function claimDecide(id, d) {
  var b = { id: id, decision: d };
  if (d === 'reject') { var why = prompt('退回原因（會通知申請人）', ''); if (why === null) return; b.reason = why; }
  if (!navigator.onLine) return toast('沒有網路，要連上網路才能核准', 'err', 3500);
  busyOn(d === 'approve' ? '核准中…' : '退回中…');
  api('claimDecide', b).then(function (r) {
    busyOff(); S.cr = { list: r.list }; S.me = normMe(r.me); lsSet(LS.ME, r.me);
    toast(d === 'approve' ? '已核准' : '已退回', 'ok', 2500); render();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
// ───────────── 通知區：權責異動、下月異動、月結結果（檢點人員沒有信箱也看得到）─────────────
PAGES.notice = function () {
  setTitle('通知');
  var list = (S.me && S.me.notices) || [];
  var h = '<div class="muted upnote">最近 60 天和您有關的通知。單位負責人、環安衛另外會收到 Email。</div>';
  if (!list.length) h += '<div class="empty">目前沒有通知</div>';
  else h += '<div class="list">' + list.map(function (x) {
    var bc = x.type === '廣播';
    return '<div class="li nt' + (x.read ? '' : ' unread') + (bc ? ' bcn' : '') + '"><span class="mn"><span class="mt">' + esc((bc ? '環安衛中心廣播' : (x.type || '') + (x.dept ? '・' + x.dept : '')) + '・' + x.time.slice(5).replace('-', '/')) + '</span>' +
      '<span class="nm">' + (x.read ? '' : '<i class="ndot"></i>') + esc(x.title) + '</span><span class="mt nb">' + esc(bc ? bcBody(x.body) : x.body) + '</span></span></div>';
  }).join('') + '</div>';
  $('app').innerHTML = h;
  var ids = list.filter(function (x) { return !x.read; }).map(function (x) { return x.id; });
  if (ids.length && navigator.onLine) api('noticeRead', { ids: ids }, { quiet: true }).then(function () {
    list.forEach(function (x) { x.read = true; }); S.me.unread = 0;
    var raw = lsGet(LS.ME, null); if (raw) { (raw.notices || []).forEach(function (x) { x.read = true; }); raw.unread = 0; lsSet(LS.ME, raw); }
  }).catch(function () {});
};

/** 廣播內容最後一行是「——發送人（廣播ID）」：畫面上只留發送人。 */
function bcBody(b) { return String(b || '').replace(/（B\d+[0-9A-Z]{4}）$/, ''); }

// ───────────── 廣播（環安衛）：選對象 → 寫標題內容 → 發送；下面看已發的、誰還沒讀 ─────────────
PAGES.bc = function () {
  setTitle('廣播');
  if (!S.bc) {
    $('app').innerHTML = loading('讀取人員名單…');
    Promise.all([apiR('bcPeople', {}), apiR('bcList', {})]).then(function (r) {
      S.bc = { depts: r[0].depts, list: r[1].list, mode: 'all', depts2: {}, names: {}, mgrOnly: false, title: '', body: '', mail: false, open: {} };
      if (S.page === 'bc') render();
    }).catch(function (e) { $('app').innerHTML = '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(e.message) + '</div></div></div></div>'; });
    return;
  }
  var b = S.bc, h = '';
  h += '<div class="sec">1. 發給誰</div><div class="seg">' + [['all', '全部人員'], ['dept', '指定部門'], ['name', '指定人員']].map(function (t) {
    return '<button class="' + (b.mode === t[0] ? 'on' : '') + '" onclick="S.bc.mode=' + jsq(t[0]) + ';render()">' + t[1] + '</button>'; }).join('') + '</div>';
  if (b.mode === 'dept') h += '<div class="chips wrap">' + b.depts.map(function (d) {
    return '<button class="chip' + (b.depts2[d.id] ? ' on' : '') + '" onclick="S.bc.depts2[' + jsq(d.id) + ']=!S.bc.depts2[' + jsq(d.id) + '];render()">' + esc(d.id) + '・' + d.people.length + ' 人</button>'; }).join('') + '</div>';
  if (b.mode !== 'name') h += '<label class="ck"><input type="checkbox"' + (b.mgrOnly ? ' checked' : '') + ' onchange="S.bc.mgrOnly=this.checked;render()">只發給單位負責人</label>';
  if (b.mode === 'name') h += b.depts.map(function (d) {
    return '<div class="sec">' + esc(d.id) + '</div><div class="card">' + d.people.map(function (x) {
      return '<label class="ck"><input type="checkbox"' + (b.names[x.name] ? ' checked' : '') + ' onchange="S.bc.names[' + jsq(x.name) + ']=this.checked;render()"><span>' + esc(x.name) +
        (x.role !== '檢點人員' ? '<small class="muted">　' + esc(x.role) + '</small>' : '') + '</span></label>'; }).join('') + '</div>'; }).join('');
  h += '<div class="sec">2. 內容</div><div class="card ev"><label class="nl" for="bcT">標題（同仁首頁最上面會顯示）</label>' +
    '<input id="bcT" class="field" maxlength="60" placeholder="例：10/15 消防演練，13:30 前廣場集合" value="' + esc(b.title) + '" oninput="S.bc.title=this.value;bcBar()">' +
    '<label class="nl" for="bcB">內容</label><textarea id="bcB" class="note plain" maxlength="1000" placeholder="時間、地點、要做什麼" oninput="S.bc.body=this.value;bcBar()">' + esc(b.body) + '</textarea>' +
    '<label class="ck"><input type="checkbox"' + (b.mail ? ' checked' : '') + ' onchange="S.bc.mail=this.checked">另外寄 Email 給有信箱的人</label></div>';
  h += '<div class="sec">已發的廣播<small>點一則看誰還沒讀</small></div>' + (b.list.length ? '<div class="list">' + b.list.map(function (x) {
    var rd = x.n - x.unread.length, op = b.open[x.id];
    return '<button class="li" onclick="S.bc.open[' + jsq(x.id) + ']=!S.bc.open[' + jsq(x.id) + '];render()"><span class="mn"><span class="nm">' + esc(x.title) + '</span>' +
      '<span class="mt">' + esc(x.time.slice(5).replace('-', '/') + '・' + x.to + (x.mail ? '・有寄信' : '')) + '</span>' +
      (op ? '<span class="mt nb">' + esc(x.body) + '</span><span class="mt' + (x.unread.length ? ' wn' : '') + '">' + esc(x.unread.length ? '還沒讀：' + x.unread.join('、') : '全部都讀了') + '</span>' : '') + '</span>' +
      pill(rd === x.n ? 'ok' : 'warn', rd === x.n ? 'check' : '', '已讀 ' + rd + '/' + x.n) + '</button>'; }).join('') + '</div>' : '<div class="empty">還沒有發過廣播</div>');
  $('app').innerHTML = h;
  bcBar();
};
function bcCount() {
  var b = S.bc, set = {};
  b.depts.forEach(function (d) { d.people.forEach(function (x) {
    var hit = b.mode === 'all' || (b.mode === 'dept' && b.depts2[d.id]);
    if (b.mode === 'name' ? b.names[x.name] : hit && (!b.mgrOnly || x.role === '單位負責人')) set[x.name] = 1; }); });
  delete set[S.me.person.name];
  return Object.keys(set).length;
}
function bcBar() {
  if (S.page !== 'bc' || !S.bc) return;
  var n = bcCount(), ok = n && S.bc.title.trim() && S.bc.body.trim();
  bar('<button class="btn"' + (ok ? '' : ' disabled') + ' onclick="bcSend()">' + ic('bell', 22, 2.6) + (!n ? '先選要發給誰' : ok ? '發送廣播（' + n + ' 人）' : '寫好標題和內容就能發（' + n + ' 人）') + '</button>');
}
function bcSend() {
  var b = S.bc, n = bcCount();
  if (!confirm('發送「' + b.title.trim() + '」給 ' + n + ' 人？發出後不能收回。')) return;
  if (!navigator.onLine) return toast('沒有網路，廣播要連上網路才能發', 'err', 3500);
  var to = b.mode === 'all' ? { all: true } : b.mode === 'dept' ? { depts: Object.keys(b.depts2).filter(function (k) { return b.depts2[k]; }) } : { names: Object.keys(b.names).filter(function (k) { return b.names[k]; }) };
  if (b.mode !== 'name' && b.mgrOnly) to.roles = ['單位負責人'];
  busyOn('發送中…');
  api('broadcast', { title: b.title, body: b.body, to: to, mail: b.mail }).then(function (r) {
    busyOff(); b.list = r.list; b.title = ''; b.body = ''; toast('已發送給 ' + r.n + ' 人', 'ok', 3000); window.scrollTo(0, 0); render();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}

// ───────────── 異常追蹤：檢點打了異常就自動開案；改善好了填處理方式＋完成日（可附照片）就結案 ─────────────
function tkLoad() { return apiR('tracks', {}).then(function (r) { S.tk = r; S.me.tracksOpen = r.open.length; return r; }); }
function tkDates(x) {
  var d = x.dates.map(md);
  return (d.length > 3 ? d.slice(0, 2).join('、') + '…' + d[d.length - 1] : d.join('、')) + (d.length > 1 ? '（' + d.length + ' 天）' : '');
}
function tkPhotos(ids, label) {
  return ids && ids.length ? '<span class="mt">' + esc(label) + '：' + ids.map(function (id, i) { return '<button class="lnk" onclick="event.stopPropagation();photoView(' + jsq(id) + ')">照片 ' + (i + 1) + '</button>'; }).join('　') + '</span>' : '';
}
function tkTitle(x) { return (x.formName || '').replace(/（[^）]*）$/, '') + (x.object ? '・' + x.object : x.form.indexOf('@') > 0 ? '・' + x.form.split('@')[1] : ''); }
PAGES.track = function () {
  setTitle('異常追蹤');
  if (!S.tk) {
    $('app').innerHTML = loading('讀取異常追蹤…');
    tkLoad().then(function () { if (S.page === 'track') render(); })
      .catch(function (e) { $('app').innerHTML = '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(e.message) + '</div></div></div></div>'; });
    return;
  }
  var tab = S.arg.tab || 'open', list = tab === 'open' ? S.tk.open : S.tk.closed, multi = S.me.depts.length > 1 || isEhs();
  var h = '<div class="seg2" role="tablist"><button class="' + (tab === 'open' ? 'on' : '') + '" onclick="S.arg.tab=\'open\';render()">待改善 ' + S.tk.open.length + '</button>' +
    '<button class="' + (tab === 'closed' ? 'on' : '') + '" onclick="S.arg.tab=\'closed\';render()">已結案 ' + S.tk.closed.length + '</button></div>';
  if (tab === 'open') h += '<div class="muted upnote">檢點時打了「異常」的項目會自動列在這裡。改善好了，點「填寫改善」寫處理方式就能結案。同一個項目還沒結案前再異常，會記在同一件。</div>';
  h += list.length ? list.map(function (x) {
    var head = '<div class="tkh"><span class="nm">' + esc(tkTitle(x)) + '</span>' + (x.state === '已結案' ? pill('ok', 'check', '已結案') : pill('ng', 'warn', x.mark || '異常')) + '</div>';
    var body = '<div class="tki">' + esc(x.item.replace(/^\d+\.\s*/, '')) + '</div>' + (x.note ? '<div class="tkn">' + esc(x.note) + '</div>' : '') +
      '<span class="mt">' + esc((multi ? x.dept + '・' : '') + '發現：' + tkDates(x) + '・' + x.finder) + '</span>' + tkPhotos(x.photos, '異常照片');
    if (x.state === '已結案') body += '<div class="tkf"><b>改善：</b>' + esc(x.fix) + '<span class="mt">' + esc(md(x.fixDate) + ' 完成・' + x.fixer) + '</span>' + tkPhotos(x.fixPhotos, '改善照片') + '</div>';
    else body += '<button class="btn line sm" onclick="go(\'trackFix\',{id:' + jsq(x.id) + '})">' + ic('pen', 18) + '填寫改善</button>';
    return '<div class="card tk">' + head + body + '</div>';
  }).join('') : '<div class="empty">' + (tab === 'open' ? '目前沒有待改善的異常' : '最近 90 天沒有結案的紀錄') + '</div>';
  $('app').innerHTML = h;
};
PAGES.trackFix = function () {
  var x = S.tk && S.tk.open.filter(function (y) { return y.id === S.arg.id; })[0];
  if (!x) return back();
  setTitle('填寫改善');
  if (!S.tf || S.tf.id !== x.id) S.tf = { id: x.id, fix: '', date: today(), pics: [] };
  var tf = S.tf, first = x.dates[0] || today();
  var h = '<div class="card tk"><div class="tkh"><span class="nm">' + esc(tkTitle(x)) + '</span>' + pill('ng', 'warn', x.mark || '異常') + '</div>' +
    '<div class="tki">' + esc(x.item.replace(/^\d+\.\s*/, '')) + '</div>' + (x.note ? '<div class="tkn">' + esc(x.note) + '</div>' : '') +
    '<span class="mt">' + esc('發現：' + tkDates(x) + '・' + x.finder) + '</span>' + tkPhotos(x.photos, '異常照片') + '</div>';
  h += '<div class="card ev"><label class="nl req" for="tfFix">改善措施（做了什麼處理）</label>' +
    '<textarea id="tfFix" class="note plain" placeholder="例：已更換洗眼器加壓閥，試水壓正常" oninput="S.tf.fix=this.value;tfBar()">' + esc(tf.fix) + '</textarea>' +
    '<label class="nl" for="tfDate">改善完成日期</label><input type="date" id="tfDate" class="field" value="' + esc(tf.date) + '" min="' + esc(first) + '" max="' + today() + '" onchange="S.tf.date=this.value">' +
    '<label class="nl' + (x.form === 'PATROL' ? ' req' : '') + '">改善後照片' + (x.form === 'PATROL' ? '（現場巡視缺失要附，會放進查核紀錄附頁）' : '（選填）') + '</label><div class="pics">' + tf.pics.map(function (p, i) {
      return '<div class="pic"><img src="' + esc(p.t) + '" alt="改善照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="S.tf.pics.splice(' + i + ',1);keepY(render)">' + ic('x', 16, 3) + '</button></div>';
    }).join('') + (tf.pics.length < 3 ? '<label class="pic add">' + ic('plus', 26, 2.6) + '<span>拍照／選照片</span><input type="file" accept="image/*" hidden onchange="tfPick(this)"></label>' : '') + '</div></div>';
  $('app').innerHTML = h;
  tfBar();
};
function tfBar() {
  if (S.page !== 'trackFix') return;
  var n = String(S.tf.fix || '').replace(/\s/g, '').length, x = S.tk.open.filter(function (y) { return y.id === S.tf.id; })[0];
  var pic = !(x && x.form === 'PATROL') || S.tf.pics.length > 0, go_ = n >= 5 && pic;   // 現場巡視缺失要附改善後照片
  bar('<button class="btn"' + (go_ ? '' : ' disabled') + ' onclick="tfSave()">' + ic('check', 22, 2.8) + (go_ ? '改善完成，結案' : n < 5 ? '寫好改善措施就能結案（至少 5 個字）' : '附上改善後照片就能結案') + '</button>');
}
function tfPick(inp) {
  var file = inp.files && inp.files[0]; inp.value = '';
  var x = S.tk.open.filter(function (y) { return y.id === S.tf.id; })[0], tf = S.tf;
  photoUp(file, { deptId: x.dept, formId: x.form, purpose: 'fix' }, function (p) { if (S.tf !== tf) return; tf.pics.push(p); keepY(render); tfBar(); });
}
function tfSave() {
  var tf = S.tf;
  if (!navigator.onLine) return toast('沒有網路，結案要連上網路', 'err', 3500);
  busyOn('結案中…');
  api('trackClose', { id: tf.id, fix: tf.fix, fixDate: tf.date, photos: tf.pics.map(function (p) { return p.id; }) }).then(function (r) {
    busyOff(); S.tk = r; S.me.tracksOpen = r.open.length; S.tf = null; toast('已結案', 'ok', 2500); back();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}

// ───────────── 使用教學（App 內直接看）：依身分顯示章節——檢點人員看第 1、2 章，單位負責人多第 3 章，環安衛全部 ─────────────
// 內容跟 PDF 共用 guide/content.json；截圖在 guide/w/*.webp。
function guideRole() { return isEhs() ? 'ehs' : isMgr() ? 'mgr' : 'op'; }
function guideChaps() { return (S.guide.chapters || []).filter(function (c) { return c.roles.indexOf(guideRole()) >= 0 && (!c.mod || modOn(c.mod)); }); }   // c.mod：有那個功能權限才列（例：施工申請）
/** 示範區的人登入：教學不出現補填相關的節、步驟、常見問題（content.json 的 demoHide） */
function guideDemo() { var ds = (S.me && S.me.depts) || []; return ds.length > 0 && ds.every(function (d) { return demoDept(d.id); }); }
function gHide() { return guideDemo() ? (S.guide.demoHide || {}) : {}; }
function gSecsOf(c) { var hs = gHide().secs || []; return c.sections.filter(function (x) { return hs.indexOf(x.no) < 0; }); }
function guideSecs() { var o = []; guideChaps().forEach(function (c) { gSecsOf(c).forEach(function (x) { o.push({ c: c, x: x }); }); }); return o; }
PAGES.guide = function () {
  setTitle('使用教學');
  if (!S.guide) {
    $('app').innerHTML = loading('讀取教學…');
    var gl = window.I18N && I18N.lang() !== 'zh' ? I18N.lang() : '', gget = function (f) {   // GitHub 網頁上傳會把資料夾攤平：先讀根目錄，讀不到再讀 guide/
      var one = function (u) { return fetch(u + '?v=' + APP_VERSION, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
      return one(f).catch(function () { return one('guide/' + f); }); };
    (gl ? gget('content.' + gl + '.json').catch(function () { return gget('content.json'); }) : gget('content.json'))   // 英文／泰文教學；沒有就用中文
      .then(function (j) { S.guide = j; if (S.page === 'guide') render(); })
      .catch(function () { $('app').innerHTML = '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">教學要連上網路才能看，請稍後再試。</div></div></div></div>'; });
    return;
  }
  var id = S.arg.sec;
  if (id === 'faq') return guideFaq();
  if (id) return guideSec(id);
  var h = '<div class="gintro">依您的身分（' + esc(guideRole() === 'ehs' ? '環安衛' : guideRole() === 'mgr' ? '單位負責人' : '檢點人員') + '）列出要看的章節，點一節就能看，每節都有實際畫面。</div>';
  h += guideChaps().map(function (c) {
    return '<div class="gch" style="--c:' + esc(c.color) + '"><div class="gct"><span class="gcn">' + c.no + '</span><span><b>' + esc(c.title) + '</b><small>' + esc(c.who) + '</small></span></div>' +
      '<div class="list">' + gSecsOf(c).map(function (x) {
        return '<button class="li" onclick="gOpen(' + jsq(x.no) + ')"><span class="gno">' + esc(x.no) + '</span><span class="mn"><span class="nm">' + esc(x.title) + '</span></span>' + ic('chev', 18, 2.6) + '</button>';
      }).join('') + '</div></div>';
  }).join('');
  h += '<button class="btn ghost" onclick="gOpen(\'faq\')">' + ic('info', 20, 2.4) + '常見問題</button>';
  $('app').innerHTML = h;
};
function guideSec(id) {
  var all = guideSecs(), i = all.findIndex(function (y) { return y.x.no === id; });
  if (i < 0) return back();
  var c = all[i].c, x = all[i].x;
  setTitle(x.no + ' ' + x.title);
  var h = '<div class="gtag" style="--c:' + esc(c.color) + '">第 ' + c.no + ' 章　' + esc(c.title) + '</div><h2 class="gh">' + esc(x.title) + '</h2>' +
    (x.lead ? '<p class="glead">' + esc(x.lead) + '</p>' : '');
  h += '<div class="gshots">' + x.shots.map(function (s) {
    return '<figure><img src="' + esc(s[0]) + '.webp?v=' + APP_VERSION + '" onerror="this.onerror=null;this.src=\'guide/w/' + esc(s[0]) + '.webp?v=' + APP_VERSION + '\'" alt="' + esc(s[1]) + '" loading="lazy"><figcaption>' + esc(s[1]) + '</figcaption></figure>';
  }).join('') + '</div>' + (x.shots.length > 1 ? '<div class="hint gsw">← 左右滑動看 ' + x.shots.length + ' 張畫面 →</div>' : '');
  var hideSt = (gHide().steps || {})[x.no] || [];
  h += '<ol class="gst">' + x.steps.filter(function (s, k) { return hideSt.indexOf(k) < 0; }).map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';     // 內容是我們自己寫的教學文字（含 <b> 粗體）
  if (x.tip) h += '<div class="box ' + (x.warn ? 'warn' : 'info') + '"><div class="r">' + ic(x.warn ? 'warn' : 'info', 22) + '<div class="bt"><div class="m">' + esc(x.tip) + '</div></div></div></div>';
  $('app').innerHTML = h;
  var prev = all[i - 1], next = all[i + 1];
  bar('<div class="btns r12">' + (prev ? '<button class="btn ghost" onclick="gTo(' + jsq(prev.x.no) + ')">上一節</button>' : '<button class="btn ghost" onclick="back()">目錄</button>') +
    (next ? '<button class="btn" onclick="gTo(' + jsq(next.x.no) + ')">下一節：' + esc(next.x.title.replace(/（.*$/, '')) + '</button>' : '<button class="btn" onclick="gTo(\'faq\')">常見問題</button>') + '</div>');
}
function guideFaq() {
  setTitle('常見問題');
  var hideF = gHide().faq || [];
  $('app').innerHTML = (S.guide.faq || []).filter(function (q, k) { return hideF.indexOf(k) < 0; }).map(function (q) { return '<div class="card gfaq"><b>' + esc(q[0]) + '</b><p>' + esc(q[1]) + '</p></div>'; }).join('') +
    '<div class="muted upnote">還有問題請洽環安衛中心。</div>';
  bar('<button class="btn ghost" onclick="back()">回教學目錄</button>');
}
function gOpen(no) { S.stack.push({ page: S.page, arg: S.arg }); S.arg = { sec: no }; window.scrollTo(0, 0); render(); }
function gTo(no) { S.arg = { sec: no }; window.scrollTo(0, 0); render(); }

// ───────────── 下月負責人：選表單（含設備）→ 左邊本月、右邊下月 → 下個月 1 日自動生效 ─────────────
PAGES.nextOwners = function () {
  setTitle('下月負責人');
  var ds = S.me.depts.filter(function (d) { return mgrOf(d.id); }).map(function (d) { return d.id; });
  if (!S.arg.dept) S.arg.dept = ds[0];
  var nx = S.next && S.next.dept === S.arg.dept ? S.next : null;
  var h = '';
  if (ds.length > 1) h += '<div class="chips">' + ds.map(function (d) { return '<button class="chip' + (d === S.arg.dept ? ' on' : '') + '" onclick="nextDept(' + jsq(d) + ')">' + esc(d) + '</button>'; }).join('') + '</div>';
  if (!nx) {
    $('app').innerHTML = h + loading('讀取本課負責人…');
    apiR('nextList', { deptId: S.arg.dept }).then(function (r) { S.next = r; if (!S.arg.key && r.targets.length) S.arg.key = r.targets[0].key; render(); })
      .catch(function (e) { $('app').innerHTML = h + '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(e.message) + '</div></div></div></div>'; });
    return;
  }
  var mo = Number(nx.month.slice(5)) + ' 月';
  h += '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">先選要變更的表單或設備，右邊勾 ' + mo + ' 起的負責人，按儲存。' + mo + ' 1 日自動生效，當事人會收到 App 通知。這個月照舊。</div></div></div></div>';
  var opt = function (k) { var t = nx.targets.filter(function (x) { return x.kind === k; }); return t.map(function (x) { return '<option value="' + esc(x.key) + '"' + (x.key === S.arg.key ? ' selected' : '') + '>' + esc(x.name) + (x.next ? '（已安排）' : '') + '</option>'; }).join(''); };
  h += '<div class="sec">1. 要變更的表單或設備</div><select class="field" id="nxKey" onchange="nextPick(this.value)">' +
    '<optgroup label="檢查表">' + opt('form') + '</optgroup><optgroup label="設備">' + opt('equip') + '</optgroup></select>';
  var tg = nx.targets.filter(function (x) { return x.key === S.arg.key; })[0], same = false, saved = false;
  if (tg) {
    var want = S.arg.want || (tg.next || tg.now).slice();
    S.arg.want = want;
    if (tg.uses && tg.uses.length) h += '<div class="muted upnote">這台設備會用到：' + esc(tg.uses.join('、')) + '</div>';
    h += '<div class="sec">2. 負責人</div><div class="nxcols"><div class="nxc"><div class="nxh">本月（目前）</div>' +
      (tg.now.length ? tg.now.map(function (n) { return '<div class="nxn">' + esc(n) + '</div>'; }).join('') : '<div class="muted">沒有負責人</div>') + '</div>' +
      '<div class="nxc on"><div class="nxh">' + mo + ' 起</div>' + nx.ops.map(function (n) {
        return '<label class="ck"><input type="checkbox" ' + (want.indexOf(n) >= 0 ? 'checked' : '') + ' onchange="nextTick(' + jsq(n) + ',this.checked)">' + esc(n) + '</label>';
      }).join('') + (nx.ops.length ? '' : '<div class="muted">本課還沒有檢點人員</div>') + '</div></div>';
    same = want.slice().sort().join() === tg.now.slice().sort().join();
    saved = tg.next && want.slice().sort().join() === tg.next.slice().sort().join();
    if (!want.length) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + mo + ' 起沒有負責人＝這' + (tg.kind === 'equip' ? '台設備' : '張表') + '本課不再使用（手機上看不到、不算缺漏）。</div></div></div></div>';
    bar('<button class="btn" id="nxBtn" onclick="nextSave()">' + ic('check', 22, 2.8) + (saved ? '已安排（要改請重新勾選）' : same && tg.next ? '取消下月異動（維持現狀）' : same ? '沒有變更' : '儲存 ' + mo + ' 的安排') + '</button>');
  }
  var plan = nx.targets.filter(function (x) { return x.next; });
  h += '<div class="sec">已安排的下月異動<small>' + mo + ' 1 日生效</small></div>' + (plan.length ? '<div class="list">' + plan.map(function (x) {
    return '<button class="li" onclick="nextPick(' + jsq(x.key) + ')"><span class="mn"><span class="nm">' + esc(x.name) + '</span><span class="mt">' + esc((x.now.join('、') || '（無）') + ' → ' + (x.next.join('、') || '（無）')) + '</span></span></button>';
  }).join('') + '</div>' : '<div class="empty">還沒有安排</div>');
  $('app').innerHTML = h;
  if (tg && $('nxBtn') && (saved || (same && !tg.next))) $('nxBtn').disabled = true;
};
function nextDept(d) { S.arg = { dept: d }; S.next = null; render(); }
function nextPick(k) { S.arg.key = k; S.arg.want = null; window.scrollTo(0, 0); render(); }
function nextTick(n, on) { var w = S.arg.want || []; if (on && w.indexOf(n) < 0) w.push(n); if (!on) w = w.filter(function (x) { return x !== n; }); S.arg.want = w; render(); }
function nextSave() {
  var nx = S.next, tg = nx && nx.targets.filter(function (x) { return x.key === S.arg.key; })[0]; if (!tg) return;
  if (!navigator.onLine) return toast('沒有網路，安排要連上網路才能存', 'err', 3500);
  busyOn('儲存中…');
  api('nextSet', { deptId: nx.dept, target: tg.key, names: S.arg.want || [] }).then(function (r) {
    busyOff(); S.next = r; S.arg.want = null; toast('已儲存，' + Number(r.month.slice(5)) + ' 月 1 日生效；相關人員會收到通知', 'ok', 3500); render();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
// ───────────── 部門管理（單位負責人、環安衛）：人員／表單／設備三個清單；誰負責什麼可以今天起改，或排到下月 1 日 ─────────────
function teamDepts() { return S.me.depts.filter(function (d) { return mgrOf(d.id); }).map(function (d) { return d.id; }); }
function teamLoad(dept) {
  return apiR('team', { deptId: dept }).then(function (r) { S.team = r; S.teamAt = Date.now(); return r; });
}
function perPill(x) {
  return ({ never: pill('na', '', '尚無紀錄'), overdue: pill('ng', 'warn', '已到期'), soon: pill('warn', 'clock', '快到期'), ok: pill('ok', 'check', '期限內') })[x.state] || '';
}
function perLine(x) { return x.freq + (x.last ? '・上次 ' + x.last + (x.due ? '・下次 ' + x.due : '') : '') + (x.evidence ? '・需照片＋紀要' : ''); }
PAGES.team = function () {
  setTitle('部門管理');
  var ds = teamDepts();
  var allOk = ds.length > 1 && !isEhs();                     // 環安衛管全廠，不做「全部」（一次讀太多課）
  if (!S.arg.dept || (S.arg.dept === '*' && !allOk)) S.arg.dept = allOk ? '*' : ds[0];
  if (!S.arg.tab) S.arg.tab = 'people';
  var tm = S.team && S.team.dept === S.arg.dept ? S.team : null;
  var h = '';
  if (ds.length > 1) h += '<div class="chips">' + (allOk ? ['*'] : []).concat(ds).map(function (d) { return '<button class="chip' + (d === S.arg.dept ? ' on' : '') + '" onclick="teamDept(' + jsq(d) + ')">' + esc(d === '*' ? '全部' : d) + '</button>'; }).join('') + '</div>';
  // v0.13.11（10/14 Jason）：管好幾課的主管登入後先看「全部」——他管哪幾課、每課有誰、各負責幾項；點課名進那一課調整
  if (S.arg.dept === '*') {
    var all = S.teamAll && Date.now() - S.teamAll.at < 60000 ? S.teamAll.list : null;
    if (!all) {
      $('app').innerHTML = h + loading('讀取您管理的各課…');
      Promise.all(ds.map(function (d) { return apiR('team', { deptId: d }); })).then(function (rs) { S.teamAll = { at: Date.now(), list: rs }; if (S.page === 'team') render(); })
        .catch(function (e) { $('app').innerHTML = h + '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(e.message) + '</div></div></div></div>'; });
      return;
    }
    var nOps = 0; all.forEach(function (t) { nOps += t.people.filter(function (p) { return p.role === '檢點人員'; }).length; });
    h += '<div class="muted upnote">您管理 ' + all.length + ' 個課、' + nOps + ' 位檢點人員。點課名可以調整那一課的人員、表單、設備。</div>';
    h += all.map(function (t) {
      var nm = {}; t.targets.forEach(function (x) { nm[x.key] = x.name; });
      var ops = t.people.filter(function (p) { return p.role === '檢點人員'; });
      var none = t.targets.filter(function (x) { return !x.now.length; }).length;
      return '<div class="card tmall"><button class="tmh" onclick="teamDept(' + jsq(t.dept) + ')"><span class="mn"><span class="nm">' + esc(t.dept) + '</span><span class="mt">' + esc(ops.length + ' 位檢點人員・' + t.targets.length + ' 項表單或設備') + '</span>' +
        (none ? '<span class="mt wn">' + esc(none + ' 項沒有人負責') + '</span>' : '') + '</span>' + ic('chev', 18, 2.6) + '</button>' +
        (ops.length ? '<div class="list">' + ops.map(function (p) {
          var mine = p.forms.concat(p.equips).map(function (k) { return nm[k]; }).filter(Boolean);
          return '<div class="li"><span class="mn"><span class="nm">' + esc(p.name) + '</span><span class="mt' + (!p.loggedIn || !p.signed ? ' wn' : '') + '">' + esc((p.loggedIn ? '已登入' : '還沒登入') + '・' + (p.signed ? '已簽名' : '還沒簽名') + '・' + (mine.length ? '負責 ' + mine.length + ' 項' : '沒有負責的表')) + '</span></span></div>';
        }).join('') + '</div>' : '<div class="empty">這一課還沒有檢點人員</div>') + '</div>';
    }).join('');
    $('app').innerHTML = h;
    return;
  }
  if (!tm) {
    $('app').innerHTML = h + loading('讀取本課分工…');
    teamLoad(S.arg.dept).then(function () { if (S.page === 'team') render(); })
      .catch(function (e) { $('app').innerHTML = h + '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(e.message) + '</div></div></div></div>'; });
    return;
  }
  var tab = S.arg.tab, forms = tm.targets.filter(function (x) { return x.kind === 'form'; }), eqs = tm.targets.filter(function (x) { return x.kind === 'equip'; });
  var ops = tm.people.filter(function (p) { return p.role === '檢點人員'; });
  h += '<div class="seg" role="tablist">' + [['people', '人員 ' + ops.length], ['form', '表單 ' + forms.length], ['equip', '設備 ' + eqs.length]].map(function (t) {
    return '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'on' : '') + '" onclick="teamTab(' + jsq(t[0]) + ')">' + esc(t[1]) + '</button>';
  }).join('') + '</div>';
  var nameOf = {}; tm.targets.forEach(function (x) { nameOf[x.key] = x.name; });
  if (tab === 'people') {
    h += '<div class="muted upnote">點一位同仁，勾選他負責的表單和設備。人員、表單、設備的新增或停用請洽環安衛中心。</div>';
    h += '<div class="list">' + tm.people.map(function (p) {
      var mine = p.forms.concat(p.equips).map(function (k) { return nameOf[k]; });
      var st = [p.loggedIn ? '已登入' : '還沒登入', p.signed ? '已簽名' : '還沒簽名'].join('・');
      var warn = p.role === '檢點人員' && (!p.loggedIn || !p.signed);
      var inner = '<span class="mn"><span class="nm">' + esc(p.name) + (p.role !== '檢點人員' ? '　<small class="muted">' + esc(p.role) + '</small>' : '') + '</span>' +
        '<span class="mt' + (warn ? ' wn' : '') + '">' + esc(st) + '</span>' +
        (p.role === '檢點人員' ? '<span class="mt">' + esc(mine.length ? '負責 ' + mine.length + ' 項：' + mine.join('、') : '目前沒有負責的表或設備') + '</span>' : '<span class="mt">審核本課紀錄，可代填</span>') + '</span>';
      return p.role === '檢點人員' ? '<button class="li" onclick="go(\'teamPerson\',{dept:' + jsq(tm.dept) + ',name:' + jsq(p.name) + '})">' + inner + '</button>' : '<div class="li">' + inner + '</div>';
    }).join('') + '</div>';
  } else {
    var list = tab === 'form' ? forms : eqs;
    h += '<div class="muted upnote">點一項調整負責人：可以今天起生效，或排到下個月 1 日。</div>';
    h += list.length ? '<div class="list">' + list.map(function (x) {
      var per = (x.periodic || []).map(function (y) { return '<span class="mt">' + esc((x.periodic.length > 1 || x.kind === 'equip' ? y.name + '・' : '') + perLine(y)) + '</span>'; }).join('');
      var worst = (x.periodic || []).map(function (y) { return y.state; }).sort(function (a, b) { return ['overdue', 'never', 'soon', 'ok'].indexOf(a) - ['overdue', 'never', 'soon', 'ok'].indexOf(b); })[0];
      return '<button class="li" onclick="go(\'teamEdit\',{dept:' + jsq(tm.dept) + ',key:' + jsq(x.key) + '})"><span class="mn"><span class="nm">' + esc(x.name) + '</span>' +
        '<span class="mt' + (x.now.length ? '' : ' wn') + '">' + esc((x.daily ? '每日・' : '') + '負責：' + (x.now.join('、') || '沒有人（不使用）')) + '</span>' +
        (x.next ? '<span class="mt inf">' + esc(Number(tm.month.slice(5)) + ' 月起：' + (x.next.join('、') || '沒有人')) + '</span>' : '') + per + '</span>' +
        (worst ? perPill({ state: worst }) : '') + '</button>';
    }).join('') + '</div>' : '<div class="empty">本課沒有' + (tab === 'form' ? '開放的表單' : '設備') + '</div>';
  }
  $('app').innerHTML = h;
};
function teamDept(d) { S.arg = { dept: d, tab: S.arg.tab }; S.team = null; render(); }
function teamTab(t) { S.arg.tab = t; render(); }
PAGES.teamEdit = function () {
  var tm = S.team, tg = tm && tm.targets.filter(function (x) { return x.key === S.arg.key; })[0];
  if (!tg) return back();
  setTitle(tg.kind === 'equip' ? '設備負責人' : '表單負責人');
  var ops = tm.people.filter(function (p) { return p.role === '檢點人員'; }).map(function (p) { return p.name; });
  if (!S.arg.want) S.arg.want = tg.now.slice();
  var want = S.arg.want, mo = Number(tm.month.slice(5)) + ' 月';
  var h = '<div class="card"><div class="mr"><b>' + esc(tg.name) + '</b></div>' +
    (tg.uses && tg.uses.length ? '<div class="muted">用到：' + esc(tg.uses.join('、')) + '</div>' : '') +
    (tg.periodic || []).map(function (y) { return '<div class="muted">' + esc(y.name + '・' + perLine(y)) + ' ' + perPill(y) + '</div>'; }).join('') +
    '<div class="muted">目前負責：' + esc(tg.now.join('、') || '沒有人') + (tg.next ? '；' + mo + '起：' + esc(tg.next.join('、') || '沒有人') : '') + '</div></div>';
  h += '<div class="sec">勾選負責人</div><div class="card">' + ops.map(function (n) {
    return '<label class="ck"><input type="checkbox" ' + (want.indexOf(n) >= 0 ? 'checked' : '') + ' onchange="teamTick(' + jsq(n) + ',this.checked)">' + esc(n) + '</label>';
  }).join('') + (ops.length ? '' : '<div class="muted">本課還沒有檢點人員</div>') + '</div>';
  if (!want.length) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">沒有負責人＝這' + (tg.kind === 'equip' ? '台設備' : '張表') + '本課不再使用（手機上看不到、不算缺漏）。</div></div></div></div>';
  h += '<div class="muted upnote">「今天起」：馬上換人，今天以前的紀錄照舊歸原負責人。「下月起」：這個月照舊，' + mo + ' 1 日自動換。當事人都會收到 App 通知。</div>';
  $('app').innerHTML = h;
  var same = want.slice().sort().join() === tg.now.slice().sort().join();
  bar('<div class="btns r21"><button class="btn" id="teNow" onclick="teamSave(\'now\')"' + (same ? ' disabled' : '') + '>' + ic('check', 22, 2.8) + '今天起生效</button>' +
    '<button class="btn ghost" onclick="teamSave(\'next\')">' + '下月起（' + esc(mo) + '）</button></div>');
};
function teamTick(n, on) { var w = S.arg.want || []; if (on && w.indexOf(n) < 0) w.push(n); if (!on) w = w.filter(function (x) { return x !== n; }); S.arg.want = w; render(); }
function teamSave(when) {
  var tm = S.team, tg = tm && tm.targets.filter(function (x) { return x.key === S.arg.key; })[0]; if (!tg) return;
  if (!navigator.onLine) return toast('沒有網路，調整要連上網路才能存', 'err', 3500);
  var want = S.arg.want || [];
  if (!want.length && !confirm('沒有勾任何人＝這' + (tg.kind === 'equip' ? '台設備' : '張表') + '本課不再使用。確定嗎？')) return;
  busyOn('儲存中…');
  var p = when === 'now' ? api('assignNow', { deptId: tm.dept, target: tg.key, names: want })
                         : api('nextSet', { deptId: tm.dept, target: tg.key, names: want }).then(function () { return teamLoad(tm.dept); });
  p.then(function (r) {
    if (when === 'now') S.team = r;
    busyOff(); toast(when === 'now' ? '已改好，今天起生效；相關人員會收到通知' : '已安排，' + Number(tm.month.slice(5)) + ' 月 1 日生效', 'ok', 3500);
    if (when === 'now') refreshMe();
    back();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
PAGES.teamPerson = function () {
  var tm = S.team, name = S.arg.name;
  if (!tm) return back();
  setTitle(name + ' 的分工');
  if (!S.arg.pick) { S.arg.pick = {}; tm.targets.forEach(function (x) { S.arg.pick[x.key] = x.now.indexOf(name) >= 0; }); }
  var pk = S.arg.pick, sec = function (kind, title) {
    var list = tm.targets.filter(function (x) { return x.kind === kind; });
    if (!list.length) return '';
    return '<div class="sec">' + title + '</div><div class="card">' + list.map(function (x) {
      var others = x.now.filter(function (n) { return n !== name; });
      return '<label class="ck"><input type="checkbox" ' + (pk[x.key] ? 'checked' : '') + ' onchange="S.arg.pick[' + jsq(x.key) + ']=this.checked;render()"><span>' + esc(x.name) +
        (others.length ? '<small class="muted">　也負責：' + esc(others.join('、')) + '</small>' : '') + '</span></label>';
    }).join('') + '</div>';
  };
  var mo = Number(tm.month.slice(5)) + ' 月';
  $('app').innerHTML = '<div class="muted upnote">勾選 ' + esc(name) + ' 負責的表單與設備。同一項可以多人一起負責；取消勾選不會影響其他人。</div>' + sec('form', '表單') + sec('equip', '設備');
  var n = teamPersonDiff().length;
  bar('<div class="btns r21"><button class="btn"' + (n ? '' : ' disabled') + ' onclick="teamPersonSave(\'now\')">' + ic('check', 22, 2.8) + (n ? '今天起生效（' + n + ' 項）' : '沒有變更') + '</button>' +
    '<button class="btn ghost"' + (n ? '' : ' disabled') + ' onclick="teamPersonSave(\'next\')">' + '下月起（' + esc(mo) + '）</button></div>');
};
function teamPersonDiff() {
  var tm = S.team, name = S.arg.name, pk = S.arg.pick || {};
  return tm.targets.filter(function (x) { return !!pk[x.key] !== (x.now.indexOf(name) >= 0); }).map(function (x) {
    var w = x.now.filter(function (n) { return n !== name; }); if (pk[x.key]) w.push(name);
    return { key: x.key, names: w };
  });
}
function teamPersonSave(when) {
  var tm = S.team, ch = teamPersonDiff(); if (!ch.length) return;
  if (!navigator.onLine) return toast('沒有網路，調整要連上網路才能存', 'err', 3500);
  busyOn('儲存中…', '共 ' + ch.length + ' 項');
  var i = 0, step = function () {
    if (i >= ch.length) return teamLoad(tm.dept);
    var c = ch[i++];
    return api(when === 'now' ? 'assignNow' : 'nextSet', { deptId: tm.dept, target: c.key, names: c.names }).then(step);
  };
  step().then(function () {
    busyOff(); toast(when === 'now' ? '已改好 ' + ch.length + ' 項，今天起生效' : '已安排 ' + ch.length + ' 項，' + Number(tm.month.slice(5)) + ' 月 1 日生效', 'ok', 3500);
    if (when === 'now') refreshMe();
    back();
  }).catch(function (e) { busyOff(); toast(esc(e.message) + (i > 1 ? '（前 ' + (i - 1) + ' 項已存）' : ''), 'err', 5000); teamLoad(tm.dept).then(function () { render(); }); });
}

// ───────────── 我的表單（檢點人員）：每日要做的、定期檢查與期限，一頁看完 ─────────────
PAGES.mine = function () {
  setTitle('我的表單');
  var m = S.me, multi = m.depts.length > 1, h = '';
  m.depts.forEach(function (d) {
    var daily = m.assigns.filter(function (a) { return a.dept === d.id && a.daily && F(a.form); });
    var picks = m.assigns.filter(function (a) { return a.dept === d.id && (a.pick || a.missingEquip); });
    if (!daily.length && !picks.length) return;
    if (multi) h += '<div class="sec"><b>' + esc(d.id) + '</b></div>';
    if (daily.length) h += '<div class="sec">每日檢點<small>作業日當天填</small></div><div class="list">' + daily.map(function (a) {
      return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(F(a.form).name) + '</span><span class="mt">' + F(a.form).items.length + ' 項</span></span>' + duePill(a) + '</button>';
    }).join('') + '</div>';
    if (picks.length) {
      h += '<div class="sec">定期檢查<small>期限內找時間做</small></div><div class="list">' + picks.map(function (a) {
        var f = F(a.form); if (!f) return '';
        if (a.missingEquip) return '<div class="li"><span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">後台還沒建立' + esc(a.missingEquip) + '編號，請洽環安衛中心</span></span></div>';
        var ttl = f.name + (a.object ? '・' + a.object + (a.objectName ? ' ' + a.objectName : '') : '') + (a.kind ? '・' + a.kind : '');
        return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(ttl) + '</span><span class="mt">' + esc(dueMeta(a)) + '</span>' +
          (f.evidence ? '<span class="mt inf">要到現場逐項檢查，送出前附' + (f.evidence.photos ? ' ' + f.evidence.photos + ' 張照片' : '') + (f.evidence.summary ? '＋檢查過程紀要' : '') + '</span>' : '') + '</span>' + duePill(a) + '</button>';
      }).join('') + '</div>';
    }
  });
  if (!h) h = '<div class="empty">目前沒有指派給您的表</div>';
  else h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">每年、每兩年的檢查沒有規定哪一天做，在期限內安排時間到現場檢查再填。快到期（30 天內）首頁會提醒。</div></div></div></div>' + h;
  if (m.claimable && m.claimable.length && !isMgr()) h += '<button class="btn ghost" onclick="go(\'claim\')">' + ic('plus', 20, 2.6) + '領取本課其他表或設備</button>';
  $('app').innerHTML = h;
};

// ───────────── 定期檢查佐證：現場照片（拍了就上傳）＋檢查過程紀要 ─────────────
var SUMMARY_MIN = 15;
function evNeed(f, fm) {
  var ev = f && f.evidence; if (!ev) return null;
  var n = (fm.pics || []).length, s = String(fm.sum || '').replace(/\s/g, '').length;
  var o = { pics: Math.max(0, (ev.photos || 0) - n), sum: ev.summary && s < SUMMARY_MIN };
  return o.pics || o.sum ? o : null;
}
function evHtml(f, fm) {
  var ev = f.evidence, pics = fm.pics || [];
  var h = '<div class="sec" id="evSec">檢查佐證<small>' + (ev.photos ? '至少 ' + ev.photos + ' 張照片' : '') + (ev.summary ? (ev.photos ? '＋' : '') + '紀要' : '') + '</small></div><div class="card ev">';
  if (ev.summary) {
    var n = String(fm.sum || '').replace(/\s/g, '').length;
    h += '<label class="nl req" for="evSum">檢查過程紀要（至少 ' + SUMMARY_MIN + ' 字）</label>' +
      '<textarea id="evSum" class="note" placeholder="例：逐一檢查氣罩、導管、排氣機皮帶與軸承，量測控制風速 0.6 m/s，濾袋無破損" oninput="S.fill.sum=this.value;draftSave();evCount();fillBar()">' + esc(fm.sum || '') + '</textarea>' +
      '<div class="hint" id="evCnt">' + n + ' 字' + (n < SUMMARY_MIN ? '・還差 ' + (SUMMARY_MIN - n) + ' 字' : '') + '</div>';
  }
  if (ev.photos) {
    h += '<div class="pics">' + pics.map(function (p, i) {
      return '<div class="pic"><img src="' + esc(p.t) + '" alt="現場照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="evDel(' + i + ')">' + ic('x', 16, 3) + '</button></div>';
    }).join('') + (pics.length < 6 ? '<label class="pic add">' + ic('plus', 26, 2.6) + '<span>拍照／選照片</span><input type="file" accept="image/*" hidden onchange="evPick(this)"></label>' : '') + '</div>' +
      '<div class="hint">拍檢查的部位、量測的儀表讀數或銘牌。照片拍了就上傳，要有網路。</div>';
  }
  return h + '</div>';
}
function evCount() { var el = $('evCnt'); if (!el) return; var n = String(S.fill.sum || '').replace(/\s/g, '').length; el.textContent = n + ' 字' + (n < SUMMARY_MIN ? '・還差 ' + (SUMMARY_MIN - n) + ' 字' : ''); }
function evDel(i) { if (!confirm('移除這張照片？')) return; S.fill.pics.splice(i, 1); draftSave(); var y = window.scrollY; render(); window.scrollTo(0, y); }
/** 照片：壓到長邊 1600 的 JPEG 上傳（拍了就傳，要有網路），另做 240 的縮圖放畫面上。 */
function photoUp(file, body, done) {
  if (!file) return;
  if (!navigator.onLine) return toast('沒有網路，照片要連上網路才能上傳', 'err', 3500);
  if (!/^image\//.test(file.type || 'image/')) return toast('請選照片檔', 'err');
  var url = URL.createObjectURL(file), img = new Image();
  busyOn('照片上傳中…');
  img.onerror = function () { URL.revokeObjectURL(url); busyOff(); toast('這張照片打不開，請重拍', 'err', 3500); };
  img.onload = function () {
    URL.revokeObjectURL(url);
    var sc = function (max, q) { var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      return { u: c.toDataURL('image/jpeg', q), w: c.width, h: c.height }; };
    var big = sc(1600, 0.72), th = sc(240, 0.6);
    var act = body.__api || 'photoUp'; body = Object.assign({}, body); delete body.__api;   // 現場巡視用 patrolPhoto
    api(act, Object.assign({ image: big.u, w: big.w, h: big.h }, body)).then(function (r) { busyOff(); done({ id: r.id, t: th.u }); })
      .catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
  };
  img.src = url;
}
function keepY(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }
function evPick(inp) {
  var file = inp.files && inp.files[0]; inp.value = '';
  var a = A(S.arg.key), fm = S.fill;
  photoUp(file, { deptId: a.dept, formId: a.form }, function (p) {
    if (S.fill !== fm) return;
    fm.pics = (fm.pics || []).concat([p]); draftSave(); keepY(render); toast('已上傳第 ' + fm.pics.length + ' 張', 'ok', 1800);
  });
}
/** 異常項目可附照片（選填，最多 3 張）：跟著這次檢點送出，轉到「異常追蹤」。 */
function ngPicsHtml(fm, seq) {
  var pics = (fm.np || {})[seq] || [];
  return '<div class="pics sm">' + pics.map(function (p, i) {
    return '<div class="pic"><img src="' + esc(p.t) + '" alt="異常照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="ngDel(' + jsq(seq) + ',' + i + ')">' + ic('x', 16, 3) + '</button></div>';
  }).join('') + (pics.length < 3 ? '<label class="pic add">' + ic('plus', 22, 2.6) + '<span>附照片</span><input type="file" accept="image/*" hidden onchange="ngPick(this,' + jsq(seq) + ')"></label>' : '') + '</div>' +
    (navigator.onLine ? '' : '<div class="hint">沒網路可以先送出；照片之後在「異常追蹤」填改善時再附。</div>');
}
function ngPick(inp, seq) {
  var file = inp.files && inp.files[0]; inp.value = '';
  var a = A(S.arg.key), fm = S.fill;
  photoUp(file, { deptId: a.dept, formId: a.form, purpose: 'ng' }, function (p) {
    if (S.fill !== fm) return;
    fm.np = fm.np || {}; fm.np[seq] = (fm.np[seq] || []).concat([p]); draftSave(); keepY(render);
  });
}
function ngDel(seq, i) { if (!confirm('移除這張照片？')) return; S.fill.np[seq].splice(i, 1); draftSave(); keepY(render); }
function photoView(id) {
  busyOn('讀取照片…');
  api('photoGet', { id: id }).then(function (r) {
    busyOff();
    var d = document.createElement('div'); d.className = 'pview'; d.onclick = function () { d.remove(); };
    d.innerHTML = '<img src="' + esc(r.image) + '" alt="現場照片"><span class="muted">點一下關閉</span>';
    document.body.appendChild(d);
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4000); });
}
function deptOf(id) { return id; }
function statusPill(s) {
  var c = { '填寫中': ['na', 'pen'], '待主管審核': ['warn', 'clock'], '待環安衛審核': ['warn', 'clock'], '已歸檔': ['ok', 'check'], '退回': ['ng', 'ret'] }[s] || ['na', ''];
  return pill(c[0], c[1], s);
}

// ───────────── 填寫 ─────────────
function openFill(key, date) {
  var a = A(key); if (!a) return;
  var d = date || today();
  S.fill = (!S.share && lsGet(LS.DRAFT, {})[key + '@' + d]) || { key: key, date: d, r: {}, n: {}, x: {}, noWork: false };
  S.ff = 'all';
  go('fill', { key: key });
  loadDay();
}
function loadDay() {
  if (S.share) return;
  var a = A(S.fill.key), fm = S.fill;
  if (!a.daily || Object.keys(fm.r).length || fm.noWork) return;
  api('dayView', { deptId: a.dept, formId: a.form, date: fm.date }, { quiet: true, noRetry: true }).then(function (d) {
    if (!d || S.page !== 'fill' || S.fill !== fm || Object.keys(fm.r).length) return;
    fm.r = d.results || {}; fm.n = d.notes || {}; fm.noWork = d.noWork;
    if (fm.n['*']) { delete fm.n['*']; }
    render(); toast('已帶出這天在試算表上的內容', '', 1800);
  }).catch(function () {});
}
function draftSave() {
  var f = S.fill; if (!f || S.share) return;
  var all = lsGet(LS.DRAFT, {}); all[f.key + '@' + f.date] = f; lsSet(LS.DRAFT, all);
}
function draftDrop(f) { var all = lsGet(LS.DRAFT, {}); delete all[f.key + '@' + f.date]; lsSet(LS.DRAFT, all); }

function optClass(k) { return { ok: 'ok', ng: 'ng', danger: 'ng', care: 'warn', risk: 'warn', na: 'na' }[k] || 'ok'; }
function optIcon(k) { return { ok: 'check', ng: 'x', warn: 'warn', na: 'minus' }[optClass(k)]; }
function isBad(f, v) { return f.noteFor.indexOf(v) >= 0 || optClass(v) === 'ng'; }
/** 填寫進度：沒勾的、異常的、要寫說明還沒寫的 */
function fillState(f, fm) {
  var todo = [], bad = [], noNote = [];
  f.items.forEach(function (it) {
    var v = fm.r[it.seq];
    if (!v) { todo.push(it.seq); return; }
    if (isBad(f, v)) bad.push(it.seq);
    if (f.noteFor.indexOf(v) >= 0 && !String(fm.n[it.seq] || '').trim()) noNote.push(it.seq);
  });
  return { total: f.items.length, cnt: f.items.length - todo.length, todo: todo, bad: bad, noNote: noNote };
}

PAGES.fill = function () {
  var a = A(S.arg.key); var fm = S.fill;
  if (!a || !fm) return back();
  var f = F(a.form, fm.date);
  setTitle(f.name);
  var t = today(), minD = fillMin() + '-01';
  var st = fillState(f, fm), ff = S.ff;

  // 頂部固定：進度＋只看未勾／異常
  if (!fm.noWork) {
    var pct = Math.round(st.cnt / Math.max(1, st.total) * 100);
    S.topExtra = '<div class="prog"><div class="prog-in"><div class="pt"><span>已勾 <b>' + st.cnt + '</b> / ' + st.total + ' 項</span>' +
      (st.todo.length ? '<span class="pr">還有 ' + st.todo.length + ' 項</span>' : '<span class="pr okt">全部勾完了</span>') + '</div>' +
      '<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + st.total + '" aria-valuenow="' + st.cnt + '"><i class="' + (st.todo.length ? '' : 'full') + '" style="width:' + pct + '%"></i></div>' +
      '<div class="seg" role="tablist"><button role="tab" aria-selected="' + (ff === 'all') + '" class="' + (ff === 'all' ? 'on' : '') + '" onclick="fillFilter(\'all\')">全部 ' + st.total + '</button>' +
      '<button role="tab" aria-selected="' + (ff === 'todo') + '" class="' + (ff === 'todo' ? 'on' : '') + '" onclick="fillFilter(\'todo\')">未勾 ' + st.todo.length + '</button>' +
      '<button role="tab" aria-selected="' + (ff === 'bad') + '" class="ngc' + (ff === 'bad' ? ' on' : '') + '" onclick="fillFilter(\'bad\')">異常 ' + st.bad.length + '</button></div></div></div>';
  }

  var metaTxt = [deptOf(a.dept), a.object, a.kind].filter(String).join('｜');
  var h = bfBanner() + '<div class="meta">' + esc(metaTxt) + '</div>' + (S.share || demoDept(a.dept) || bfCur() ? '<div class="dwrap"><div class="lbl">檢查日期 ' + pill('ok', '', md(fm.date) + '（' + wk(fm.date) + '）') + '</div></div>' :
    '<div class="dwrap"><div class="lbl"><label for="dt">檢查日期</label>' + (fm.date === t ? pill('ok', '', '今天') : pill('warn', '', '補登')) + '</div>' +
    '<input type="date" class="field" id="dt" value="' + esc(fm.date) + '" max="' + t + '" min="' + minD + '" onchange="fillDate(this.value)">' +
    '<div class="hint">要補填其他天，建議從「月曆・補填」點日期；最早到 ' + md(minD) + '</div></div>' +
    (fm.date !== t ? '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>補填 ' + md(fm.date) + '（' + wk(fm.date) + '）的紀錄</b>' +
      '<div class="m">請確認這天確實有做檢查。建議當天檢查、當天填寫，檢查表才有實際作用；補填會記下填寫時間，單位負責人與環安衛看得到。</div></div></div></div>' : ''));
  if (a.daily) {
    h += '<div class="btns r21"><button class="btn navy" onclick="allOk()">' + ic('check', 22, 3) + '全部正常</button>' +
      '<button class="btn ghost" onclick="noWork()">' + (fm.noWork ? '↺ 取消無作業' : '今日無作業') + '</button></div>';
  } else if (f.evidence) {                                  // 每年、每兩年這類要到現場細查的表：不給「全部正常」，逐項勾＋照片＋紀要
    h += '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>請到現場逐項檢查後再勾</b><div class="m">這張表沒有「全部正常」，每一項都要自己勾；送出前要' +
      (f.evidence.photos ? '附 ' + f.evidence.photos + ' 張以上現場照片' : '') + (f.evidence.summary ? (f.evidence.photos ? '、' : '') + '寫檢查過程紀要' : '') + '，單位負責人與環安衛審核時看得到。</div></div></div></div>';
  } else {
    h += '<button class="btn navy" onclick="allOk()">' + ic('check', 22, 3) + '全部正常</button>';
  }
  if (fm.noWork) {
    h += '<div class="box warn"><div class="r">' + ic('info', 22) + '<div class="bt"><b>這一天記為「無作業」</b><div class="m">表上留空白。按下方送出即可；要改回來請按「↺ 取消無作業」。</div></div></div></div>';
  } else {
    var g = null, shown = 0, nextSeq = st.todo[0] || st.noNote[0];
    f.items.forEach(function (it) {
      var v = fm.r[it.seq];
      if (ff === 'todo' && v) return;
      if (ff === 'bad' && !(v && isBad(f, v))) return;
      shown++;
      if (it.group && it.group !== g) { g = it.group; h += '<div class="grp">' + esc(g) + '</div>'; }
      var opts = it.opts || f.opts, needNote = v && f.noteFor.indexOf(v) >= 0;
      var cls = 'item' + (v && isBad(f, v) ? ' bad' : it.seq === nextSeq && st.cnt ? ' next' : '');
      h += '<div class="' + cls + '" id="it' + esc(it.seq) + '"><div class="q"><span class="no">' + esc(it.seq) + '</span><div class="qt">' + esc(it.text) +
        (it.method ? ' <small>（' + esc(it.method) + '）</small>' : '') + '</div>' + (!v && st.cnt ? '<span class="tag">未勾</span>' : '') + '</div>' +
        '<div class="opts n' + Math.min(opts.length, 3) + '">' +
        opts.map(function (o) {
          var on = v === o.k;
          return '<button class="opt ' + optClass(o.k) + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="pick(' + jsq(it.seq) + ',' + jsq(o.k) + ')">' + (on ? ic(optIcon(o.k), 18, 3) : '') + esc(o.label) + '</button>';
        }).join('') + '</div>' +
        (needNote || (fm.n[it.seq] && f.type === '單張') ? '<div class="nwrap"><label class="nl' + (needNote ? ' req' : '') + '" for="n' + esc(it.seq) + '">' + (needNote ? '必填：' : '說明：') + esc(f.noteTitle || '請說明異常狀況與處理方式') + '</label>' +
          '<textarea id="n' + esc(it.seq) + '" class="note' + (needNote ? '' : ' plain') + '" placeholder="' + esc(f.noteTitle || '請說明異常狀況與處理方式') + '" oninput="noteIn(' + jsq(it.seq) + ',this.value)">' + esc(fm.n[it.seq] || '') + '</textarea>' +
          (v && isBad(f, v) && !S.share ? ngPicsHtml(fm, it.seq) : '') + '</div>' : '') +
        '</div>';
    });
    if (!shown) h += '<div class="empty">' + (ff === 'todo' ? '都勾完了，沒有未勾的項目' : '沒有異常的項目') + '</div>';
    if (ff === 'all') (f.extra || []).forEach(function (x, i) {
      h += '<div class="item"><label class="qt" for="x' + i + '">' + esc(x) + '</label><textarea id="x' + i + '" class="note plain" oninput="S.fill.x[' + i + ']=this.value;draftSave()">' + esc(fm.x[i] || '') + '</textarea></div>';
    });
    if (f.evidence && !a.daily) h += evHtml(f, fm);
  }
  h += S.share ? '<div class="box info"><div class="r">' + ic('pen', 22) + '<div class="bt"><b>勾完按送出，下一步請寫姓名並簽名</b><div class="m">代填的檢點要本人當場簽名才算數。</div></div></div></div>'
    : '<div class="sigcard"><img src="' + esc(S.me.signature.image) + '" alt="您的簽名"><div class="stx"><b>送出時自動帶入您的簽名</b>不用再簽</div></div>';
  $('app').innerHTML = h;
  fillBar();
};
/** 底部按鈕永遠告訴使用者下一步：還沒勾 → 跳過去；要寫說明 → 跳過去；都好了 → 送出 */
function fillBar() {
  if (S.page !== 'fill' || !S.fill) return;
  var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date), st = fillState(f, fm), h;
  if (fm.noWork) h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic('check', 22, 2.8) + '送出（今日無作業）</button>';
  else if (st.todo.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.todo[0]) + ')">還有 ' + st.todo.length + ' 項沒勾・跳到第 ' + esc(st.todo[0]) + ' 項' + ic('down', 20, 2.6) + '</button>';
  else if (st.noNote.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.noNote[0]) + ',1)">第 ' + esc(st.noNote[0]) + ' 項要寫說明・跳過去' + ic('down', 20, 2.6) + '</button>';
  else if (!a.daily && evNeed(f, fm)) { var en = evNeed(f, fm);
    h = '<button class="btn navy" onclick="evJump()">' + (en.sum ? '還要寫檢查過程紀要' : '') + (en.sum && en.pics ? '、' : '') + (en.pics ? '還要 ' + en.pics + ' 張照片' : '') + '・跳過去' + ic('down', 20, 2.6) + '</button>'; }
  else h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic('check', 22, 2.8) + st.total + ' 項都勾好了，送出這張（' + md(fm.date) + '）</button>';
  bar(h);
}
function evJump() { if (S.ff !== 'all') { S.ff = 'all'; render(); } var el = $('evSec'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); var ta = $('evSum'); if (ta && evNeed(F(A(S.arg.key).form), S.fill).sum) setTimeout(function () { ta.focus({ preventScroll: true }); }, 400); }
function fillFilter(v) { S.ff = v; window.scrollTo(0, 0); render(); }
function jumpTo(seq, note) {
  var el = $('it' + seq);
  if (!el && S.ff !== 'all') { S.ff = 'all'; render(); el = $('it' + seq); }
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1200);
  if (note) { var ta = el.querySelector('textarea'); if (ta) setTimeout(function () { ta.focus({ preventScroll: true }); }, 400); }
}
function noteIn(seq, v) { S.fill.n[seq] = v; draftSave(); fillBar(); }
function fillDate(v) {
  var t = today();
  if (!v || v > t) { toast('不能選未來的日期', 'err'); return render(); }
  S.fill = lsGet(LS.DRAFT, {})[S.fill.key + '@' + v] || { key: S.fill.key, date: v, r: {}, n: {}, x: {}, noWork: false };
  render(); loadDay();
}
function pick(seq, k) {
  S.fill.r[seq] = k; S.fill.noWork = false; draftSave();
  var y = window.scrollY; render(); window.scrollTo(0, y);
  var f = F(A(S.arg.key).form, S.fill && S.fill.date);
  if (f.noteFor.indexOf(k) >= 0 && !String(S.fill.n[seq] || '').trim()) {     // 選到要說明的選項：直接把游標放進說明框
    var ta = $('n' + seq); if (ta) ta.focus({ preventScroll: true });
  }
}
function allOk() {
  var a = A(S.arg.key), f = F(a.form, S.fill && S.fill.date);
  f.items.forEach(function (it) { var opts = it.opts || f.opts; if (!S.fill.r[it.seq] || S.fill.r[it.seq] === 'na') S.fill.r[it.seq] = S.fill.r[it.seq] === 'na' ? 'na' : opts[0].k; });
  S.fill.noWork = false; draftSave(); render();
  toast('已勾「' + esc((f.items[0].opts || f.opts)[0].label) + '」，有異常的請個別改', '', 2200);
}
function noWork() { S.fill.noWork = !S.fill.noWork; draftSave(); render(); }

function submitFill() {
  var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date);
  if (!fm.noWork) {
    for (var i = 0; i < f.items.length; i++) {
      var it = f.items[i], v = fm.r[it.seq];
      if (!v) { jumpTo(it.seq); return toast('第 ' + esc(it.seq) + ' 項還沒勾', 'err'); }
      if (f.noteFor.indexOf(v) >= 0 && !String(fm.n[it.seq] || '').trim()) { jumpTo(it.seq, 1); return toast('第 ' + esc(it.seq) + ' 項請寫說明', 'err'); }
    }
    if (!a.daily && evNeed(f, fm)) { evJump(); return toast('請補上檢查佐證（照片、紀要）', 'err'); }
  }
  if (S.share) { draftSave(); return go('psign', { key: a.key }); }
  if (S.dev) return devBlock('這張檢點表');                         // 開發者模式：前面的檢查都照真的跑，到送出這一步攔下
  var btn = $('fillBtn'); if (btn) { btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>存到手機中…'; }
  var extra = {};
  (f.extra || []).forEach(function (x, i) { if (fm.x[i]) extra[x] = fm.x[i]; });
  var body = { deptId: a.dept, formId: a.form, object: a.object || '', kind: a.kind || '', date: fm.date,
               results: fm.noWork ? {} : fm.r, notes: fm.noWork ? {} : fm.n, extra: extra, noWork: fm.noWork };
  if (f.evidence && !a.daily) { body.summary = fm.sum || ''; body.photos = (fm.pics || []).map(function (p) { return p.id; }); }
  if (!fm.noWork && fm.np) { body.ngPhotos = {}; Object.keys(fm.np).forEach(function (k) { if (isBad(f, fm.r[k]) && fm.np[k].length) body.ngPhotos[k] = fm.np[k].map(function (p) { return p.id; }); }); }
  var nBad = fm.noWork ? 0 : f.items.filter(function (it) { return isBad(f, fm.r[it.seq]); }).length;
  var job = { id: newId(), token: lsGet(LS.TOKEN, ''), who: S.me && S.me.person ? S.me.person.name : '', key: a.key, body: body, created: Date.now(), status: 'pending',
              label: f.name + ' ' + md(fm.date) };
  obPut(job).then(function () {
    draftDrop(fm);
    // 畫面立即更新為「待上傳」，真正結果以後端為準
    if (fm.date === today() && a.daily) { a.due.todayDone = true; a.due.todayNoWork = fm.noWork; }
    S.fill = null; S.stack = []; S.page = 'home'; S.arg = {};
    return obRefresh();
  }).then(function () {
    if (bfAfterSave(a.key, body.date)) { flush(); return; }       // 一次補填：直接帶出下一張
    window.scrollTo(0, 0); render();
    var left = (S.me.assigns || []).filter(function (x) { return x.daily && x.due && !x.due.todayDone && !pendingFor(x, today()); }).length;
    var msg = f.name + ' ' + md(body.date) + (body.date === today() && left ? '・今天還有 ' + left + ' 張' : '') + '（當天要改可以再打開這張）';
    S.sentMsg = '已送出 ' + msg;                          // 上傳成功時顯示這一句（不要被「已上傳 1 筆」蓋掉）
    if (nBad) { msg += '；' + nBad + ' 項異常已轉到「異常追蹤」'; S.sentMsg = '已送出 ' + msg; }
    toast((navigator.onLine ? '已送出 ' : '已存在手機，有網路自動上傳：') + msg, 'ok', nBad ? 5000 : 3500); flush();
  }).catch(function (e) {
    toast('手機存檔失敗：' + esc(e.message), 'err', 5000);
    if (btn) { btn.disabled = false; btn.className = 'btn'; btn.textContent = '再送一次'; }
  });
}

// ───────────── 月份檢視／送出／審核 ─────────────
PAGES.month = function () {
  var a = S.arg;
  setTitle(deptOf(a.dept) + ' ' + ymLabel(a.period));
  if (S.mArg !== a) { S.mArg = a; S.mf = S.mKeep ? S.mKeep.mf : 0; S.mv = S.mKeep ? S.mKeep.mv : 'cal'; S.mKeep = null; S.md = undefined; S.mErr = null; S.cm = ''; }
  $('app').innerHTML = monthNav(a.period) + loading('讀取這個月的紀錄中…');
  apiR('monthView', { deptId: a.dept, period: a.period }).then(function (v) {
    if (S.page !== 'month' || S.arg !== a) return;
    S.view = v; monthRender();
  }).catch(function (e) { $('app').innerHTML = errBox('讀不到這個月的資料', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
};
function dayBad(f, r) {
  if (!r || r.noWork) return false;
  return Object.keys(r.results || {}).some(function (k) { var x = r.results[k]; return x === '?' || f.noteFor.indexOf(x) >= 0; });
}
function seeLate(v) { return !!(mgrOf(v.dept) || isEhs()); }     // 補登資訊只給單位負責人、環安衛看
/** 月份加減：'2026-10' ± k 個月 */
function addM(per, k) { var d = new Date(Number(per.slice(0, 4)), Number(per.slice(5)) - 1 + k, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
/** 可以補填的最早月份（後台「可補填月數」，預設本月＋前 3 個月） */
function fillMin() { return addM(today().slice(0, 7), -((S.me && S.me.fillMonths) || 1)); }
var MNAV_BACK = 12;                                              // 月曆最多往前翻 12 個月（看得到；能不能改看補填期限）
function mCanGo(per) { var cur = today().slice(0, 7); return per <= cur && per >= addM(cur, -MNAV_BACK); }
function mGo(k) {
  var a = S.arg, np = addM(a.period, k);
  if (!mCanGo(np)) return toast(k > 0 ? '已經是本月' : '只能往前看 ' + MNAV_BACK + ' 個月', '', 2000);
  S.mSlide = k; S.mKeep = { mf: S.mf, mv: S.mv };
  go('month', { dept: a.dept, period: np }, true);
}
function monthNav(per) {
  var p0 = addM(per, -1), p1 = addM(per, 1);
  var btn = function (k, p) {
    var ok = mCanGo(p);
    return '<button class="btn ghost mnb" aria-label="' + (k < 0 ? '上個月' : '下個月') + '"' + (ok ? ' onclick="mGo(' + k + ')"' : ' disabled') + '>' +
      (k < 0 ? ic('back', 22, 2.8) + Number(p.slice(5)) + ' 月' : Number(p.slice(5)) + ' 月' + ic('right', 22, 2.8)) + '</button>';
  };
  return '<div class="mnav">' + btn(-1, p0) + '<b>' + ymLabel(per) + '</b>' + btn(1, p1) + '</div>';
}
/** 月曆左右滑換月：往左滑＝下個月、往右滑＝上個月（同 Google 日曆） */
function mSwipe() {
  var el = $('app'), x0 = null, y0 = 0;
  el.ontouchstart = function (e) { if (S.page !== 'month' || !e.target.closest('.calcard')) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  el.ontouchend = function (e) {
    if (x0 === null || S.page !== 'month') return;
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) mGo(dx < 0 ? 1 : -1);
  };
}
function monthRender() {
  if ($('cm')) S.cm = $('cm').value;
  var v = S.view, forms = S.me.forms, mm = v.model, boss = mgrOf(v.dept), ehs = isEhs();
  var late = seeLate(v) ? (mm.late || {}) : {};
  var h = monthNav(v.period);
  if (S.mErr) h += errBox(S.mErr.t, S.mErr.m, S.mErr.btn || '');
  h += '<div class="card"><div class="mr"><b>本月狀態</b>' + statusPill(v.status) + '</div>' +
    (v.status === '退回' ? '<div class="box err" role="alert"><div class="r">' + ic('ret', 22) + '<div class="bt"><b>退回原因</b><div class="m">' + esc(v.reason) + '</div></div></div></div>' : '') +
    (v.sheetUrl ? '<a class="link" href="' + esc(v.sheetUrl) + '" target="_blank" rel="noopener">' + ic('ext', 18, 2.2) +
      (v.status === '填寫中' || v.status === '退回' ? '在 Google 試算表檢視／編輯' : '在 Google 試算表檢視（已鎖定，不能修改）') + '</a>' : '') +
    (v.status === '填寫中' || v.status === '退回' ? '<div class="muted sm2">在試算表填的內容，要回到這裡按「確認」才會帶入電子簽名、才能送審。</div>' : '') + '</div>';
  h += confirmBlock(v);
  h += bfButton(v);                                              // 一次補填全部漏填
  var pend = (S.outbox || []).filter(function (j) { return j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period; });
  if (pend.length) h += '<div class="strip info">' + ic('cloud', 24, 2.2) + '<div class="stx"><span>手機裡還有 <b>' + pend.length + ' 筆</b>這個月的檢點沒上傳完</span><small>上傳完才會出現在下面</small></div>' +
    '<button class="btn sm" onclick="flush().then(function(){render()})">立即上傳</button></div>';
  if ((v.status === '填寫中' || v.status === '退回') && v.problems.length) {
    h += '<div class="box warn"><div class="r">' + ic('warn', 24) + '<div class="bt"><b>送出前還要補 ' + v.problems.length + ' 個地方</b></div></div>' +
      '<div class="list">' + v.problems.slice(0, 20).map(function (p) { return '<div class="li" style="min-height:52px"><span class="mn"><span class="nm" style="font-weight:500">' + esc(p) + '</span></span></div>'; }).join('') +
      (v.problems.length > 20 ? '<div class="li" style="min-height:44px"><span class="mt">…還有 ' + (v.problems.length - 20) + ' 個</span></div>' : '') + '</div></div>';
  }
  var dl = mm.daily.filter(function (x) { return forms[x.form]; });
  if (dl.length) {
    if (S.mf >= dl.length) S.mf = 0;
    var x = dl[S.mf], f = forms[x.form];
    if (S.md === undefined) { S.md = null; for (var d0 = 1; d0 <= 31; d0++) if (dayBad(f, x.days[d0])) { S.md = d0; break; }
      if (S.md === null && !ehs && !boss && (v.status === '填寫中' || v.status === '退回')) S.md = blankDays(x, v.period)[0] || null; }
    h += '<div class="seg2" role="tablist"><button role="tab" aria-selected="' + (S.mv === 'cal') + '" class="' + (S.mv === 'cal' ? 'on' : '') + '" onclick="mView(\'cal\')">月曆</button>' +
      '<button role="tab" aria-selected="' + (S.mv === 'grid') + '" class="' + (S.mv === 'grid' ? 'on' : '') + '" onclick="mView(\'grid\')">表格（逐項）</button></div>';
    if (dl.length > 1) h += '<div class="chips">' + dl.map(function (y, i) {
      var fy = forms[y.form], nb = Object.keys(y.days).filter(function (k) { return dayBad(fy, y.days[k]); }).length;
      return '<button class="chip' + (i === S.mf ? ' on' : '') + '" aria-pressed="' + (i === S.mf) + '" onclick="mForm(' + i + ')">' + esc(y.name) + (nb ? '<span class="bdg">異常 ' + nb + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    else h += '<div class="sec">' + esc(x.name) + '</div>';
    var days = Object.keys(x.days).map(function (k) { return x.days[k]; });
    var nBad = Object.keys(x.days).filter(function (k) { return dayBad(f, x.days[k]); }).length, nLate = Object.keys(late[x.form] || {}).length;
    var stats = '<div class="stats"><span>檢點 <b>' + days.filter(function (d) { return !d.noWork; }).length + '</b> 天</span><span>無作業 <b>' + days.filter(function (d) { return d.noWork; }).length + '</b> 天</span>' +
      (nBad ? '<span class="ng">異常 <b>' + nBad + '</b> 天</span>' : '') + (nLate ? '<span class="wn">補登 <b>' + nLate + '</b> 天</span>' : '') + '</div>';
    var blanks = blankDays(x, v.period), canEdit = (v.status === '填寫中' || v.status === '退回') && !ehs && v.period >= fillMin();
    if (canEdit && blanks.length) stats += '<div class="blankl">' + ic('pen', 16, 2.4) + '平日沒紀錄 ' + blanks.length + ' 天（' + blanks.slice(0, 10).join('、') + (blanks.length > 10 ? '…' : '') + ' 號）：點日期可以補填</div>';
    if (S.mv === 'cal') h += '<div class="card calcard' + (S.mSlide ? (S.mSlide > 0 ? ' slideL' : ' slideR') : '') + '">' + stats + calHtml(f, x, v.period, late[x.form]) + '</div>' + dayDetail(f, x, v.period, late[x.form]);
    else h += '<div class="card">' + stats + '</div>' + gridHtml(f, x, v.period, seeLate(v) ? late[x.form] : null);
  }
  if (mm.periodic.length) h += '<div class="sec">定期檢查（本月）</div>';
  mm.periodic.forEach(function (x) { h += sheetHtml(forms[x.form], x); });
  if (!mm.daily.length && !mm.periodic.length) h += '<div class="empty">這個月沒有資料。</div>';
  $('app').innerHTML = h;
  S.mSlide = 0; mSwipe();

  var thisMonth = v.period === today().slice(0, 7);
  if ((v.status === '填寫中' || v.status === '退回') && !ehs && thisMonth) {
    var nx = new Date(Number(v.period.slice(0, 4)), Number(v.period.slice(5)), 1);
    bar('<button class="btn" disabled>' + Number(v.period.slice(5)) + ' 月還沒結束，' + (nx.getMonth() + 1) + '/1 起才能送審</button>');
  } else if (v.status === '待主管審核' && !boss && !ehs && v.submitter === S.me.person.name) {
    bar('<button class="btn redline" onclick="withdrawMonth()">' + ic('ret', 20, 2.4) + '撤回送審（主管還沒審核，可以撤回修改）</button>');
  } else if ((v.status === '填寫中' || v.status === '退回') && !ehs) {
    bar(v.problems.length ? '<button class="btn" disabled>補完 ' + v.problems.length + ' 個地方，才能送單位負責人</button>'
      : '<button class="btn" id="smBtn" onclick="submitMonth()">' + ic('check', 22, 2.8) + '本月完成，鎖定送單位負責人</button>');
  } else if (v.status === '待主管審核' && boss && !ehs) {
    bar('<label class="nl" for="cm">意見（可不填；退回是整個月退給本課，要改哪裡請當面說明）</label><textarea id="cm" class="note plain" placeholder="意見（可不填）">' + esc(S.cm) + '</textarea>' +
      '<div class="btns r12"><button class="btn redline" onclick="doReview(\'return\')">退回</button><button class="btn" onclick="doReview(\'approve\')">' + ic('pen', 22) + '核准並簽名</button></div>');
  } else if (v.status === '待環安衛審核' && ehs) {
    bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic('pdf', 20, 2.2) + '開啟 PDF</button>' +
      '<div class="btns r12"><button class="btn redline" onclick="doEhs(\'return\')">退回</button><button class="btn" onclick="doEhs(\'approve\')">' + ic('check', 22, 2.8) + '核准歸檔</button></div>');
  } else if (v.status === '已歸檔' || v.status === '待環安衛審核') {
    bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic('pdf', 20, 2.2) + '開啟 PDF</button>');
  }
}
/** 這個月在試算表填的（或手機送出後在試算表被改過的），輪到我確認的列出來，一鍵確認帶入簽名。 */
function myUnconf(v) {
  var me = S.me.person.name, out = [];
  if (isEhs() || !(v.status === '填寫中' || v.status === '退回')) return out;
  v.model.daily.forEach(function (x) {
    var f = F(x.form, v.period); if (!f) return;
    Object.keys(x.days).forEach(function (d) {
      var r = x.days[d], byMgr = mgrOf(v.dept) && (v.gone || []).indexOf(r.signer) >= 0;
      if (!r.unconf || !(r.signer === me || r.noWork || byMgr)) return;
      var nb = Object.keys(r.results || {}).filter(function (k) { return f.noteFor.indexOf(r.results[k]) >= 0; }).length;
      out.push({ d: Number(d), t: Number(v.period.slice(5)) + '/' + d + ' ' + f.name + (byMgr ? '（' + r.signer + '，已不在名單）' : ''), s: r.noWork ? '無作業' : (nb ? '異常 ' + nb + ' 項' : '全部正常'), ch: r.unconf === 'changed',
        key: byMgr ? '' : v.dept + '|' + x.form + '||', date: v.period + '-' + pad(Number(d)) });
    });
  });
  (v.model.periodic || []).forEach(function (x) {
    if (x.unconf && (x.signer === me || (mgrOf(v.dept) && (v.gone || []).indexOf(x.signer) >= 0))) out.push({ d: Number(x.date.slice(8)), t: x.date.slice(5).replace('-', '/') + ' ' + x.name + (x.object ? ' ' + x.object : ''), s: '定期檢查', ch: x.unconf === 'changed' });
  });
  return out.sort(function (a, b) { return a.d - b.d; });
}
function confirmBlock(v) {
  var a = myUnconf(v); if (!a.length) return '';
  return '<div class="box info cfm"><div class="r">' + ic('pen', 24) + '<div class="bt"><b>在試算表填的 ' + a.length + ' 筆，請確認</b>' +
    '<div class="m">內容沒錯就按最下面「已全數確認無誤」，會記成您檢點的並帶入電子簽名；哪一筆要改，點那一筆「前往修改」，改好送出就算確認。</div></div></div>' +
    '<div class="list">' + a.map(function (x) {
      var inner = '<span class="mn"><span class="nm">' + esc(x.t) + '</span><span class="mt' + (x.ch ? ' wn' : '') + '">' + esc(x.s) + (x.ch ? '・手機送出後在試算表被改過' : '') + '</span></span>';
      return x.key ? '<button class="li" style="min-height:56px" onclick="openFill(' + jsq(x.key) + ',' + jsq(x.date) + ')">' + inner + '<span class="go">前往修改' + ic('arrow', 16, 2.6) + '</span></button>'
        : '<div class="li" style="min-height:56px">' + inner + '<span class="mt">要改請到試算表</span></div>';
    }).join('') + '</div>' +
    '<button class="btn navy" id="cfBtn" onclick="confirmFill()">' + ic('check', 20, 2.8) + '已全數確認無誤（' + a.length + ' 筆，帶入我的簽名）</button></div>';
}
function confirmFill() {
  var v = S.view, b = $('cfBtn'); if (b) { b.disabled = true; b.className = 'btn busy'; b.innerHTML = '<span class="spin"></span>確認中…'; }
  api('confirmFill', { deptId: v.dept, period: v.period }).then(function (r) {
    toast('已確認 ' + r.count + ' 筆', 'ok'); refreshMe(); render();
  }).catch(function (e) { S.mErr = { t: '確認沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
}
function withdrawMonth() {
  var v = S.view, why = prompt('撤回原因（例如：漏填 28 號）？撤回後可以修改，改好再重新送審。');
  if (why === null) return;
  busyOn('撤回中…', '');
  api('withdrawMonth', { monthId: v.monthId, reason: why }).then(function () {
    busyOff(); toast('已撤回，可以修改了', 'ok'); refreshMe(); render();
  }).catch(function (e) { busyOff(); S.mErr = { t: '撤回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
}
function mView(x) { S.mv = x; monthRender(); }
function mForm(i) { S.mf = i; S.md = undefined; monthRender(); }
function mDay(d) {
  S.md = S.md === d ? null : d; monthRender();
  var el = $('dday'); if (el && S.md) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
/** 月曆：一眼看出哪天正常、異常、無作業、沒紀錄；點日期看細節 */
function calHtml(f, x, period, late) {
  var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), n = new Date(y, mo, 0).getDate(), first = new Date(y, mo - 1, 1).getDay(), td = today();
  var h = '<div class="calw">' + wkNames().map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div><div class="cal">';
  for (var i = 0; i < first; i++) h += '<span></span>';
  var anyLate = false, anyMiss = false, anyUc = false;
  for (var d = 1; d <= n; d++) {
    var r = x.days[d], date = period + '-' + pad(d), dow = (first + d - 1) % 7, future = date > td, cls = 'cd', mark = '', lab;
    if (r && r.noWork) { cls += ' nw'; mark = '<small>無</small>'; lab = '無作業'; }
    else if (r && dayBad(f, r)) { cls += ' bad'; mark = ic('x', 12, 3.6); lab = '有異常'; }
    else if (r) { cls += ' ok'; mark = ic('check', 12, 3.6); lab = '正常'; }
    else if (!future && dow > 0 && dow < 6 && !(S.view && demoDept(S.view.dept)) && !(S.me && S.me.startPeriod && period < S.me.startPeriod)) { cls += ' miss'; lab = '沒有紀錄'; anyMiss = true; }
    else lab = '沒有紀錄';
    if (r && r.unconf) { cls += ' uc'; anyUc = true; mark = '<small class="ucl">待確認</small>'; lab += '、試算表填的待確認'; }
    if (late && late[d]) { cls += ' late'; anyLate = true; if (!r || !dayBad(f, r)) mark = '<small class="lt">補登</small>'; lab += '、補登'; }
    if (S.md === d) cls += ' sel';
    h += '<button class="' + cls + '" aria-label="' + mo + '/' + d + ' ' + lab + '"' + (future ? ' disabled' : ' onclick="mDay(' + d + ')"') + '>' + d + mark + '</button>';
  }
  h += '</div><div class="legend"><span><i style="background:var(--okbg)"></i>✓ 正常</span><span><i style="background:var(--ng)"></i>✕ 有異常</span><span><i style="background:#E2E6EB"></i>無作業</span>' +
    (anyMiss ? '<span><i style="border:2px dashed #B5BEC9"></i>平日沒紀錄</span>' : '') + (anyLate ? '<span><i style="box-shadow:inset 0 0 0 2px var(--orange)"></i>補登</span>' : '') +
    (anyUc ? '<span><i style="border:2px dashed #1A5FB4"></i>試算表填的待確認</span>' : '') + '</div>';
  return h;
}
function optLabel(f, seq, k) {
  var it = f.items.filter(function (x) { return x.seq === seq; })[0];
  var o = ((it && it.opts) || f.opts).filter(function (x) { return x.k === k; })[0];
  return o ? o.label : k;
}
/** 示範區（「示範」開頭的部門）：給勞檢看的，只示範當天檢點流程——不出現任何補填、補登的入口或提示 */
function demoDept(d) { return /^示範/.test(String(d || '')); }
/** 上班日：週一～五，扣掉後台「設定 → 國定假日」 */
function workDay(date) { var dw = new Date(date + 'T12:00:00').getDay(); return dw > 0 && dw < 6 && ((S.me && S.me.holidays) || []).indexOf(date) < 0; }
/** 平日（週一～五）沒有紀錄、且不是未來的日子（示範區、系統啟用前的月份不算） */
function blankDays(x, period) {
  if (S.view && demoDept(S.view.dept)) return [];
  if (S.me && S.me.startPeriod && period < S.me.startPeriod) return [];   // 系統正式啟用以前（紙本時期）不標漏填、不出一次補填

  var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), n = new Date(y, mo, 0).getDate(), td = today(), out = [];
  for (var d = 1; d <= n; d++) { var date = period + '-' + pad(d); if (date <= td && workDay(date) && !x.days[d]) out.push(d); }
  return out;
}
/** 月曆點到的那天：可不可以補填／修改（本月或上個月、還沒送審、這張表現在是指派給我的） */
function dayAction(x, period, d) {
  var v = S.view, date = period + '-' + pad(d), t = today();
  if (isEhs() || !(v.status === '填寫中' || v.status === '退回') || date > t || (demoDept(v.dept) && date !== t)) return '';
  var minD = fillMin() + '-01';
  if (date < minD) return '<div class="muted">超過補填期限（只能補到 ' + Number(minD.slice(5, 7)) + ' 月 1 日），要更正請洽環安衛中心。</div>';
  var a = (S.me.assigns || []).filter(function (y) { return y.daily && y.dept === v.dept && y.form === x.form; })[0];
  if (!a) return '';
  var r = x.days[d], me = S.me.person.name;
  if (!r) return '<button class="btn' + (date === t ? '' : ' amber') + '" onclick="openFill(' + jsq(a.key) + ',' + jsq(date) + ')">' + ic('pen', 20, 2.4) + (date === t ? '填寫今天' : '補填這天（' + md(date) + '）') + '</button>';
  if (r.signer === me || (r.noWork && !mgrOf(v.dept))) return '<button class="btn ghost" onclick="openFill(' + jsq(a.key) + ',' + jsq(date) + ')">' + ic('pen', 20, 2.4) + '修改這天</button>';
  return '';
}
function dayDetail(f, x, period, late) {
  var d = S.md; if (!d) return '';
  var r = x.days[d], date = period + '-' + pad(d), mo = Number(period.slice(5));
  var h = '<div class="card dday" id="dday"><div class="mr"><b>' + mo + '/' + d + '（' + wk(date) + '）</b>' + (r && r.signer ? '<span>檢查人員 ' + esc(r.signer) + '</span>' : '') + '</div>';
  if (!r) h += '<div class="muted">這天沒有紀錄。</div>';
  else if (r.noWork) h += '<div class="muted">這天記為「無作業」。</div>';
  else {
    var bads = f.items.filter(function (it) { var k = r.results[it.seq]; return k === '?' || (k && f.noteFor.indexOf(k) >= 0); });
    bads.forEach(function (it) {
      var k = r.results[it.seq], note = (r.notes || {})[it.seq];
      h += '<div class="dbad">' + ic('x', 20, 3) + '<div><b>' + esc('第 ' + it.seq + ' 項 ' + it.text + '：' + (k === '?' ? '?' : optLabel(f, it.seq, k))) + '</b>' + (note ? '<span>說明：' + esc(note) + '</span>' : '') + '</div></div>';
    });
    if ((r.notes || {})['*']) h += '<div class="muted">備註：' + esc(r.notes['*']) + '</div>';
    var ok = f.items.length - bads.length;
    h += '<div class="muted">' + (bads.length ? '其餘 ' + ok + ' 項正常' : '全部 ' + ok + ' 項正常') + '</div>';
  }
  if (r && r.proxy && seeLate(S.view)) h += '<div class="muted" style="color:var(--orT)">' + esc(r.proxy) + '，簽名為代填人當場手寫（只有主管與環安衛看得到）</div>';
  if (late && late[d]) h += '<div class="muted" style="color:var(--orT)">補登：' + esc(String(late[d]).slice(5, 16)) + ' 登錄（只有主管與環安衛看得到）</div>';
  return h + dayAction(x, period, d) + '</div>';
}
function markOf(f, seq, k) {
  var it = f.items.filter(function (x) { return x.seq === seq; })[0];
  var o = ((it && it.opts) || f.opts).filter(function (x) { return x.k === k; })[0];
  return o ? o.mark : '';
}
function gridHtml(f, x, period, late) {
  var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), days = new Date(y, mo, 0).getDate();
  var by = x.days;
  var h = '<div class="grid"><table><tr><th class="t">項目</th>';
  for (var d = 1; d <= days; d++) h += '<th' + (late && late[d] ? ' class="late" title="' + esc(late[d]) + ' 登錄"' : '') + '>' + d + '</th>';
  h += '</tr>';
  f.items.forEach(function (it) {
    h += '<tr><td class="t">' + esc(it.seq) + '. ' + esc(it.text) + '</td>';
    for (var d = 1; d <= days; d++) {
      var r = by[d], k = r && !r.noWork ? r.results[it.seq] : '';
      var bad = k && (f.noteFor.indexOf(k) >= 0 || k === '?');
      h += '<td' + (bad ? ' class="bad"' : '') + '>' + esc(k === '?' ? '?' : k ? markOf(f, it.seq, k) : '') + '</td>';
    }
    h += '</tr>';
  });
  h += '<tr><td class="t">檢查人員</td>';
  for (var d2 = 1; d2 <= days; d2++) { var r2 = by[d2]; h += '<td style="font-size:11px">' + (r2 ? (r2.noWork ? '無' : esc((r2.signer || '?').slice(-2))) : '') + '</td>'; }
  h += '</tr></table></div>';
  var notes = [];
  Object.keys(by).forEach(function (d) { var n = by[d].notes || {}; Object.keys(n).forEach(function (k) { notes.push(mo + '/' + d + (k === '*' ? '' : ' 第' + k + '項') + '：' + n[k]); }); });
  if (late) Object.keys(late).forEach(function (d) { notes.push(mo + '/' + d + ' 補登（' + String(late[d]).slice(5, 16) + ' 登錄，只有主管與環安衛看得到）'); });
  if (notes.length) h += '<div class="box warn"><div class="m">' + notes.map(esc).join('<br>') + '</div></div>';
  return h;
}
function sheetHtml(f, r) {
  var h = '<div class="card sheet"><div class="mr"><b>' + esc(r.name) + '</b></div><div class="muted">' + esc([r.object, r.kind, r.date, r.signer].filter(String).join('｜')) + '</div>';
  r.items.forEach(function (it) {
    var k = r.results[it.seq], bad = k && f && (f.noteFor.indexOf(k) >= 0 || k === '?');
    h += '<div class="sr"><div>' + esc(it.text) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</div>' +
      pill(bad ? 'ng' : k ? 'ok' : 'na', bad ? 'x' : k ? 'check' : '', it.result || '未填') + '</div>';
  });
  r.extra.forEach(function (e) { h += '<div class="ex"><b>' + esc(e.k) + '</b>：' + esc(e.v) + '</div>'; });
  if (r.summary) h += '<div class="ex"><b>檢查過程紀要</b>：' + esc(r.summary) + '</div>';
  if (r.photos && r.photos.length) h += '<div class="ex"><b>現場照片</b>：' + r.photos.map(function (id, i) { return '<button class="lnk" onclick="photoView(' + jsq(id) + ')">照片 ' + (i + 1) + '</button>'; }).join('　') + '</div>';
  return h + '</div>';
}
function submitMonth() {
  var v = S.view;
  var pend = (S.outbox || []).filter(function (j) { return j.status === 'pending' && j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period; });
  if (pend.length) {
    S.mErr = { t: '還不能送審', m: '手機裡還有 ' + pend.length + ' 筆這個月的檢點沒上傳完，上傳完才能送。',
               btn: '<button class="btn navy" onclick="S.mErr=null;flush().then(function(){render()})">立即上傳</button>' };
    monthRender(); window.scrollTo(0, 0); return;
  }
  var y0 = Number(v.period.slice(0, 4)), m0 = Number(v.period.slice(5)), nd = new Date(y0, m0, 0).getDate(), lines = [], blanks = [];
  v.model.daily.forEach(function (x) {
    var f = F(x.form, v.period); if (!f) return;
    var work = 0, nw = 0, blank = [];
    for (var d = 1; d <= nd; d++) { var r = x.days[d]; if (r && r.noWork) nw++; else if (r) work++; else if (workDay(v.period + '-' + pad(d)) && !demoDept(v.dept)) blank.push(d); }
    if (blank.length) blanks.push(f.name + '：' + blank.map(function (d) { return m0 + '/' + d; }).join('、'));
    lines.push('・' + f.name + '：檢點 ' + work + ' 天、無作業 ' + nw + ' 天' + (blank.length ? '、平日空白 ' + blank.length + ' 天（' + blank.slice(0, 8).join('、') + (blank.length > 8 ? '…' : '') + ' 號）' : ''));
  });
  if (v.model.periodic.length) lines.push('・定期檢查 ' + v.model.periodic.length + ' 份');
  if (!S.smOk) { S.smLines = lines; S.smBlank = blanks; return go('smConfirm', { dept: v.dept, period: v.period }); }
  S.smOk = false;
  var btn = $('smBtn'); if (btn) { btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>送出中…'; }
  busyOn('鎖定送審中…', '要檢查整個月的紀錄並鎖定試算表，約 10～30 秒');
  api('submitMonth', { deptId: v.dept, period: v.period }).then(function (r) {
    busyOff();
    S.mErr = null;
    toast('已鎖定送審', 'ok');
    var link = location.origin + location.pathname + '?r=' + r.monthId;
    var text = v.dept + ' ' + ymLabel(v.period) + ' 作業檢點已完成，請審核簽名：' + link;
    $('app').innerHTML = '<div class="sent"><span class="bigck">' + ic('check', 40, 3) + '</span><b>已送給單位負責人</b><p>' + esc(v.dept + ' ' + ymLabel(v.period)) +
      ' 已鎖定送審。<br>單位負責人打開檢點系統就會看到，也可以順手傳個訊息提醒他。</p></div>';
    bar('<button class="btn" onclick="shareTo(' + jsq(text) + ')">' + ic('chat', 22, 2.4) + '用 LINE／訊息通知主管</button>' +
      '<button class="btn ghost" onclick="S.stack=[];go(\'home\',{},true);refreshMe()">' + ic('home', 20, 2.2) + '回首頁</button>');
  }).catch(function (e) {
    busyOff();
    S.mErr = { t: '送審沒有成功', m: e.message };
    monthRender(); window.scrollTo(0, 0);
  });
}
/** 送審確認頁：逐表摘要、平日空白、鎖定後不能改的說明，勾「我已確認」才能送 */
PAGES.smConfirm = function () {
  var v = S.view; if (!v) return back();
  setTitle('送出 ' + ymLabel(v.period));
  var h = '<div class="h2">送出前請確認</div><div class="lead">' + esc(v.dept + '・' + ymLabel(v.period)) + '，整課一起送，送出後由單位負責人審核。</div>' +
    '<div class="card"><div class="muted">這個月的紀錄</div>' + (S.smLines || []).map(function (l) { return '<div class="sml">' + esc(l.replace(/^・/, '')) + '</div>'; }).join('') + '</div>' +
    '<div class="box warn"><div class="r">' + ic('warn', 24) + '<div class="bt"><b>送出後就鎖定</b><div class="m">App 和試算表都不能再修改，<b>除非單位負責人退回補正</b>。單位負責人還沒審核前，送出的人可以自己撤回。</div></div></div></div>' +
    // 10/14 Jason：上班日空白又沒選「今日無作業」→ 列出日期，確認真的沒運作才送
    (demoDept(v.dept) ? '' : (S.smBlank || []).length ? '<div class="box warn"><div class="r">' + ic('warn', 24) + '<div class="bt"><b>這幾天是上班日，但沒有紀錄、也沒選「今日無作業」</b>' +
      (S.smBlank || []).map(function (l) { return '<div class="m">・' + esc(l) + '</div>'; }).join('') +
      '<div class="m">請確認這幾天確實沒有運作；如果是漏填，請先回月曆點那天補填。</div></div></div></div>' :
      '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">上班日都有紀錄或已選「今日無作業」。</div></div></div></div>') +
    '<label class="ck smck"><input type="checkbox" id="smChk" onchange="$(\'smGo\').disabled=!this.checked">' +
      ((S.smBlank || []).length && !demoDept(v.dept) ? '上面幾天確實沒有運作（不是漏填），仍要送出 ' + Number(v.period.slice(5)) + ' 月的紀錄' : '我已確認 ' + Number(v.period.slice(5)) + ' 月的紀錄沒有漏填，要送給單位負責人') + '</label>';
  $('app').innerHTML = h;
  bar('<button class="btn ghost" onclick="back()">' + ic('cal', 20, 2.2) + (demoDept(v.dept) ? '回月曆' : '回月曆補填') + '</button><button class="btn" id="smGo" disabled onclick="smGo()">' + ic('check', 22, 2.8) + '確認送出</button>');
};
function smGo() { S.smOk = true; S.page = 'month'; S.stack.pop(); S.arg = S.mArg; submitMonth(); }
function shareTo(text) {
  if (navigator.share) navigator.share({ text: text }).catch(function () {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('已複製，貼到 LINE 給主管', 'ok'); });
  else prompt('複製這段傳給主管：', text);
}

function doReview(action) {
  var cm = ($('cm') || {}).value || '';
  S.cm = cm;
  if (action === 'return' && !confirm('把 ' + S.view.dept + ' ' + ymLabel(S.view.period) + ' 整個月退回給本課？\n\n退回後檢點人員可以修改，改好再重新送審。要改哪裡請當面說明。')) return;
  if (action === 'approve') {
    if (!S.me.signature) return go('sign');
    if (!confirm('核准 ' + S.view.dept + ' ' + ymLabel(S.view.period) + ' 的檢點紀錄？\n會帶入您的簽名並產生 PDF。')) return;
  }
  bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === 'approve' ? '簽名並產生 PDF 中，約 10～30 秒…' : '退回中…') + '</div>');
  busyOn(action === 'approve' ? '簽名並產生 PDF 中…' : '退回中…', action === 'approve' ? '約 10～30 秒' : '');
  api('review', { monthId: S.view.monthId, decision: action, comment: cm }).then(function (r) {
    busyOff();
    toast(action === 'approve' ? '已核准，PDF 已產生' : '已退回', 'ok', 3000);
    S.stack = []; S.cm = ''; go('home', {}, true); refreshMe();
  }).catch(function (e) { busyOff(); S.mErr = { t: action === 'approve' ? '核准沒有成功' : '退回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
}
function doEhs(action) {
  var why = '';
  if (action === 'return') { why = prompt('退回原因（可不填）？整個月會退回給本課。'); if (why === null) return; }
  else if (!confirm('確認歸檔？')) return;
  bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === 'approve' ? '歸檔中…' : '退回中…') + '</div>');
  busyOn(action === 'approve' ? '歸檔中…' : '退回中…', '');
  var mid = S.view.monthId;
  api('ehsReview', { monthId: mid, decision: action, comment: why }).then(function () {
    if (action === 'approve') return archLoop(mid);
    busyOff(); toast('已退回', 'ok'); S.stack = []; go('home', {}, true); refreshMe();
  }).catch(function (e) { busyOff(); S.mErr = { t: action === 'approve' ? '歸檔沒有成功' : '退回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
}
/** 歸檔收尾：分表 PDF 與通知信分段做，一直呼叫到完成；中途關掉，首頁會出現「繼續完成歸檔」。 */
function archLoop(mid) {
  busyOn('歸檔收尾中…', '產生每張表的 PDF、寄通知信');
  var round = function () {
    return api('archiveWork', { monthId: mid }).then(function (r) {
      var sub = document.querySelector('#busy .bx p:not(.warn):not(.sec2)');
      if (sub && r.total) sub.textContent = '每張表的 PDF：' + r.made + ' / ' + r.total + (r.done ? '，寄通知信' : '');
      if (r.done) return r;
      return new Promise(function (res) { setTimeout(res, r.busy ? 8000 : 300); }).then(round);
    });
  };
  return round().then(function () {
    busyOff(); toast('已歸檔，PDF 與通知信都完成了', 'ok', 3000); S.stack = []; go('home', {}, true); refreshMe();
  }).catch(function (e) {
    busyOff(); toast(esc('已歸檔，但收尾沒做完：' + e.message + '（首頁可以繼續）'), 'err', 6000); S.stack = []; go('home', {}, true); refreshMe();
  });
}
function openPdf(id) {
  var w = window.open('', '_blank');
  toast('PDF 下載中…');
  api('getPdf', { monthId: id }).then(function (r) {
    var bin = atob(r.base64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([u], { type: 'application/pdf' }));
    if (w) w.location = url; else location.href = url;
  }).catch(function (e) { if (w) w.close(); toast(esc(e.message), 'err', 4000); });
}

PAGES.packages = function () {
  setTitle('待審核');
  $('app').innerHTML = loading('讀取中…');
  apiR('packages', {}).then(function (list) {
    if (S.page !== 'packages') return;
    S.pkgs = list;
    var want = isEhs() ? '待環安衛審核' : '待主管審核';
    var mine = list.filter(function (x) { return x.status === want; });
    var rest = list.filter(function (x) { return x.status !== want; }).slice(0, 12);
    var row = function (x) {
      return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '"><span class="mn"><span class="nm">' +
        esc(x.dept) + '　<span class="nw">' + ymLabel(x.period) + '</span></span><span class="mt">' + esc(x.submitter) + ' 送出 ' + esc((x.submittedAt || '').slice(5, 16)) + '</span></span>' + statusPill(x.status) + '</button>';
    };
    $('app').innerHTML = '<div class="sec"><span class="sl"><span class="cnt' + (mine.length ? '' : ' z') + '">' + mine.length + '</span>待您審核</span></div>' +
      (mine.length ? '<div class="list">' + mine.map(row).join('') + '</div>' : '<div class="empty">目前沒有</div>') +
      (rest.length ? '<div class="sec">最近</div><div class="list">' + rest.map(row).join('') + '</div>' : '');
  }).catch(function (e) { $('app').innerHTML = errBox('讀不到審核清單', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
};

// ───────────── 代填連結 ─────────────
PAGES.shareMake = function () {
  setTitle('請人代填');
  var m = S.me, ds = m.depts.filter(function (d) { return m.assigns.some(function (a) { return a.dept === d.id && a.daily; }); });
  if (!S.arg.dept && ds.length === 1) S.arg.dept = ds[0].id;
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>休假或沒辦法檢點時用</b><div class="m">產生一個連結傳給同事，同事用手機打開就能填<b>那一天</b>的每日檢點表，不用裝 App、不用登入。送出時要寫姓名並當場簽名。連結只在那一天有效。</div></div></div></div>';
  if (ds.length > 1) h += '<div class="sec">哪一課</div><div class="depts">' + ds.map(function (d, i) {
    var on = S.arg.dept === d.id;
    return '<button class="dept' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="S.arg={dept:' + jsq(d.id) + '};render()">' + (on ? ic('check', 16, 3.2) : '') + esc(d.id) + '</button>';
  }).join('') + '</div>';
  var L = S.arg.link, t = today();
  if (!L && S.arg.dept) {
    var days = [0, 1, 2, 3, 4, 5, 6, 7].map(function (n) { var d = nowD(); d.setDate(d.getDate() + n); return ymd(d); });
    if (!S.arg.date) S.arg.date = t;
    h += '<div class="sec">哪一天要代填</div><div class="depts">' + days.map(function (d, i) {
      var on = S.arg.date === d, lab = i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '後天' : md(d) + '（' + wk(d) + '）';
      return '<button class="dept' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="S.arg.date=' + jsq(d) + ';render()">' + (on ? ic('check', 16, 3.2) : '') + esc(lab) + '</button>';
    }).join('') + '</div>';
  }
  if (L) {
    h += '<div class="card"><div class="mr"><b>' + esc(L.dept) + '　' + md(L.date) + ' 代填連結</b>' + pill('ok', 'check', '已產生') + '</div>' +
      '<div class="muted">只能在 ' + md(L.date) + '（' + wk(L.date) + '）當天使用，填那天的每日檢點表，23:59 失效。</div>' +
      '<div class="cprow"><input class="field" id="shareUrl" readonly value="' + esc(L.url) + '" onclick="this.select()">' +
      '<button class="btn navy sm" id="cpBtn" onclick="copyShare()">' + ic('check', 18, 2.6) + '複製網址</button></div></div>';
  }
  h += '<div id="shareErr"></div>';
  $('app').innerHTML = h;
  if (L) bar('<button class="btn" onclick="shareTo(' + jsq('請幫忙填 ' + L.dept + ' ' + md(L.date) + '（' + wk(L.date) + '）的每日檢點表，那天打開這個連結就能填：' + L.url) + ')">' + ic('chat', 22, 2.4) + '用 LINE／訊息傳給同事</button>');
  else if (S.arg.dept) bar('<button class="btn" id="mkBtn" onclick="shareMake()">' + ic('ext', 22, 2.2) + '產生' + (S.arg.date === t ? '今天' : ' ' + md(S.arg.date) + ' ') + '的代填連結</button>');
};
function copyShare() {
  var el = $('shareUrl'), txt = el.value, done = function () { var b = $('cpBtn'); if (b) b.innerHTML = ic('check', 18, 2.6) + '已複製'; toast('網址已複製，可以貼給同事', 'ok'); };
  var old = function () { el.removeAttribute('readonly'); el.select(); el.setSelectionRange(0, txt.length); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} el.setAttribute('readonly', ''); if (ok) done(); else toast('這支手機不讓 App 自動複製，請長按網址選「拷貝」', 'err', 4000); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, old); else old();
}
function shareMake() {
  var btn = $('mkBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>產生中，約 3～5 秒…';
  api('shareCreate', { deptId: S.arg.dept, date: S.arg.date || today() }).then(function (r) {
    if (!r.url) r.url = location.origin + location.pathname + '#share=' + r.token;
    S.arg = { dept: S.arg.dept, date: S.arg.date, link: r }; render();
  }).catch(function (e) { $('shareErr').innerHTML = errBox('沒有產生連結', e.message); btn.disabled = false; btn.className = 'btn'; btn.textContent = '再試一次'; });
}
/** 代填模式：用連結打開，不登入；畫面只有這一課今天的每日表。 */
function shareMe(d) {
  return { person: { name: '', role: '代填' }, depts: [{ id: d.dept, mgr: false }], forms: d.forms, months: [], signature: null,
           assigns: d.daily.map(function (x) { return { key: d.dept + '|' + x.form + '||', dept: d.dept, form: x.form, object: '', kind: '', daily: true, freq: '作業日', due: { state: x.state } }; }) };
}
PAGES.proxy = function () {
  setTitle('代填每日檢點');
  var sh = S.share;
  if (!sh.d) {
    $('app').innerHTML = loading('讀取連結中…');
    api('shareOpen', { share: sh.token }, { token: '-' }).then(function (d) { sh.d = d; S.me = shareMe(d); render(); })
      .catch(function (e) { $('app').innerHTML = errBox(e.biz ? '這個連結不能用' : '連不上系統', e.message) + (e.biz ? '' : '<button class="btn navy" onclick="render()">再試一次</button>'); });
    return;
  }
  var d = sh.d;
  S.hero = '<div class="hero-in"><div class="brand"><span class="logo">' + '<img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block">' + '</span>員和環安衛系統</div>' +
    '<div class="hn"><div class="h1">代填 ' + esc(d.dept) + '</div><div class="hsub">' + md(d.date) + '（' + wk(d.date) + '）的每日檢點・' + esc(d.creator) + ' 請您幫忙・今天 23:59 前有效</div></div></div>';
  var h = '';
  if (d.locked) h += errBox('這個月已經送審', '不能再填，請洽單位負責人。');
  h += '<div class="sec">今天的每日檢點表</div><div class="list">' + d.daily.map(function (x) {
    var f = d.forms[x.form], key = d.dept + '|' + x.form + '||';
    var done = x.state === 'done' || x.state === 'nowork';
    var st = x.state === 'done' ? '<span class="mt okt">' + esc(x.signer) + ' 已檢點</span>' : x.state === 'nowork' ? '<span class="mt">今日無作業</span>' : '<span class="mt">共 ' + f.items.length + ' 項</span>';
    var pl = x.state === 'done' ? pill('ok', 'check', '已檢點') : x.state === 'nowork' ? pill('na', 'minus', '無作業') : pill('warn', 'clock', '還沒檢點');
    return done && x.signer !== sh.name ? '<div class="li off" aria-disabled="true"><span class="mn"><span class="nm">' + esc(f.name) + '</span>' + st + '</span>' + pl + '</div>'
      : '<button class="li" ' + (d.locked ? 'disabled ' : '') + 'onclick="openFill(' + jsq(key) + ',' + jsq(d.date) + ')"><span class="mn"><span class="nm">' + esc(f.name) + '</span>' + st + '</span>' + pl + '</button>';
  }).join('') + '</div>';
  h += '<div class="muted" style="margin-top:12px">已經有人檢點的表不能再改。填錯了請告訴 ' + esc(d.creator) + ' 或單位負責人。</div>';
  $('app').innerHTML = h;
};
PAGES.psign = function () {
  var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date);
  if (!fm) return back();
  setTitle('簽名送出');
  var h = '<div class="h2">' + esc(f.name) + '</div><div class="lead">' + esc(S.share.d.dept) + '・' + md(fm.date) + (fm.noWork ? '・今日無作業' : '') + '</div>' +
    '<label class="nl req" for="pname">您的姓名</label><input id="pname" class="field" maxlength="20" autocomplete="name" placeholder="請寫全名" value="' + esc(S.share.name || '') + '" oninput="S.share.name=this.value">';
  if (!fm.noWork) h += '<div class="h2" style="margin-top:16px">在直的框裡，由上往下簽全名</div>' +
    '<div class="sigwrap"><div class="sigv"><div class="arw" aria-hidden="true"><span>由</span><span>上</span><span>往</span><span>下</span>' +
    '<svg class="ic" width="28" height="110" viewBox="0 0 28 110" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v98M4 90l10 12 10-12"/></svg></div>' +
    '<canvas id="cv" class="sigbox" aria-label="直式簽名區，由上往下簽"></canvas><span class="sp"></span></div>' +
    '<div class="right"><button class="btn ghost sm" onclick="sigClear()">' + ic('refresh', 18) + '清除重簽</button></div></div>';
  h += '<div id="psErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="psBtn" onclick="proxySubmit()">' + ic('check', 22, 2.8) + '簽名並送出</button>');
  if (!fm.noWork) sigInit();
};
function proxySubmit() {
  var a = A(S.arg.key), fm = S.fill, sh = S.share;
  var name = ($('pname').value || '').trim(); sh.name = name;
  if (name.length < 2) { $('pname').classList.add('bad'); $('pname').focus(); return toast('請寫您的姓名', 'err'); }
  var img = '';
  if (!fm.noWork) {
    if (!SIG.drawn) return toast('請先簽名', 'err');
    img = sigExport(); if (!img) return toast('簽名太小，請簽大一點', 'err');
  }
  var btn = $('psBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>送出中…';
  fm.submitId = fm.submitId || newId();
  api('shareSubmit', { share: sh.token, submitId: fm.submitId, name: name, formId: a.form, results: fm.noWork ? {} : fm.r, notes: fm.noWork ? {} : fm.n,
                       noWork: fm.noWork, imageV: img }, { token: '-' }).then(function () {
    draftDrop(fm); S.fill = null; sh.d = null; S.stack = []; S.page = 'proxy'; S.arg = {};
    render(); toast('已送出，謝謝您', 'ok', 3000);
  }).catch(function (e) {
    if (!$('psErr')) return toast(esc(e.message), 'err', 5000);
    $('psErr').innerHTML = errBox('送出沒有成功', e.message);
    btn.disabled = false; btn.className = 'btn'; btn.textContent = '再送一次';
  });
}

// ───────────── 提醒（加到手機行事曆，手機自己會跳通知）─────────────
function remDefault(a) {
  if (a.daily) return { on: false, time: '08:30', days: [1, 2, 3, 4, 5] };
  if (a.freq === '每月') return { on: false, time: '09:00', dom: 25 };
  return { on: false, time: '09:00', before: a.warnDays || 30 };
}
// ───────────── 通知信設定（10/13 Jason：不想收的信可以關；App 裡的通知照常）─────────────
var MAIL_KINDS = [
  ['archive', '歸檔完成信（附 PDF）', '每月紀錄歸檔後寄給您，附有您簽名的檢點表（單位負責人附整份）'],
  ['review', '送審、待審核、退回通知信', '有紀錄等您審核或歸檔、您送審的月份被退回時寄給您'],
  ['status', '每月送審狀況信', '每月寄上個月各課的送審狀況（單位負責人、環安衛）'],
  ['notice', '其他通知信', '負責人異動、異常追蹤、教育訓練等']
];
PAGES.mailPref = function () {
  setTitle('通知信設定');
  if (!S.mailOff) S.mailOff = (S.me.mailOff || []).slice();
  var boss = isMgr() || isEhs();
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>這裡只管要不要寄 Email 到公司信箱</b><div class="m">App 裡的「通知」照常都會收到，不能關。打勾＝要寄，取消打勾＝不寄。</div></div></div></div>';
  if (S.me.hasEmail === false) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">名單上沒有登記您的 Email，目前本來就不會收到信；要收信請洽環安衛中心。</div></div></div></div>';
  h += MAIL_KINDS.filter(function (k) { return boss || k[0] !== 'status'; }).map(function (k) {
    var on = S.mailOff.indexOf(k[0]) < 0;
    return '<div class="ritem"><label class="ck"><input type="checkbox" id="mk_' + k[0] + '" ' + (on ? 'checked' : '') + ' onchange="mailKind(' + jsq(k[0]) + ',this.checked)"><span>' + esc(k[1]) +
      '<small class="muted" style="display:block;font-weight:400">' + esc(k[2]) + '</small></span></label></div>';
  }).join('');
  if (boss) h += '<div class="muted sm2">關掉「送審、待審核」信後，有紀錄要審核時只會在 App 首頁和通知看到，請記得定期打開 App。</div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="mpBtn" onclick="mailSave()">' + ic('check', 22, 2.8) + '儲存</button>');
};
function mailKind(k, on) { S.mailOff = S.mailOff.filter(function (x) { return x !== k; }); if (!on) S.mailOff.push(k); }
function mailSave() {
  var btn = $('mpBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>儲存中…';
  api('mailPref', { off: S.mailOff }).then(function (r) {
    S.me.mailOff = r.off; S.mailOff = null;
    var raw = lsGet(LS.ME, null); if (raw) { raw.mailOff = r.off; lsSet(LS.ME, raw); }
    toast('已儲存', 'ok'); back();
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); btn.disabled = false; btn.className = 'btn'; btn.textContent = '再試一次'; });
}

PAGES.remind = function () {
  setTitle('提醒設定');
  var R = lsGet(LS.REM, {});
  var list = (S.me.assigns || []).filter(function (a) { return !a.missingEquip && F(a.form); });
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>時間到，手機會自己跳通知</b><div class="m">勾選要提醒的項目後按下方按鈕，會下載一個行事曆檔，用手機的「行事曆」開啟加入（不用開著 App）。之後要改，先到行事曆刪掉舊的再重新加入。</div></div></div></div>';
  var row = function (key, title, freq, r) {
    var x = '<div class="ritem"><label class="ck"><input type="checkbox" ' + (r.on ? 'checked' : '') +
      ' onchange="remSet(' + jsq(key) + ',\'on\',this.checked)"><span>' + esc(title) + '</span></label>';
    if (r.on) {
      x += '<div class="ropts">';
      if (freq === '作業日') {
        x += '<span>每週</span>' + [1, 2, 3, 4, 5, 6].map(function (d) {
          var on = r.days.indexOf(d) >= 0;
          return '<button class="dchip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="remDay(' + jsq(key) + ',' + d + ')">' + '一二三四五六'.charAt(d - 1) + '</button>';
        }).join('');
      } else if (freq === '每月' || freq === 'review' || freq === 'close') {
        x += '<span>每月</span><select class="field auto" aria-label="每月幾號" onchange="remSet(' + jsq(key) + ',\'dom\',Number(this.value))">' +
          [-1].concat(Array.from({ length: 28 }, function (_, i) { return i + 1; })).map(function (d) {
            return '<option value="' + d + '"' + (r.dom === d ? ' selected' : '') + '>' + (d === -1 ? '最後一天' : d + ' 日') + '</option>';
          }).join('') + '</select>';
      } else {
        x += '<span>到期前</span><input class="field auto num" type="number" aria-label="到期前幾天" value="' + esc(r.before) + '" onchange="remSet(' + jsq(key) + ',\'before\',Number(this.value))"><span>天</span>';
      }
      x += '<input class="field auto" type="time" aria-label="提醒時間" value="' + esc(r.time) + '" onchange="remSet(' + jsq(key) + ',\'time\',this.value)"></div>';
    }
    return x + '</div>';
  };
  if (!isEhs()) list.forEach(function (a) { var r = Object.assign(remDefault(a), R[a.key] || {}); h += row(a.key, a.dept + '｜' + aTitle(a) + '（' + (a.daily ? '每個作業日' : a.freq) + '）', a.daily ? '作業日' : a.freq, r); });
  if (!isEhs() && !isMgr()) h += row('close', '月底送單位負責人', 'close', Object.assign({ on: false, time: '16:00', dom: -1 }, R.close || {}));
  if (isMgr() || isEhs()) h += row('review', '每月審核檢點紀錄', 'review', Object.assign({ on: false, time: '09:00', dom: isEhs() ? 8 : 3 }, R.review || {}));
  $('app').innerHTML = h;
  bar('<button class="btn" onclick="makeIcs()">' + ic('cal', 22, 2.4) + '加到手機行事曆</button>');
};
function remGet(key) {
  var R = lsGet(LS.REM, {}); var a = A(key);
  return Object.assign(a ? remDefault(a) : key === 'close' ? { on: false, time: '16:00', dom: -1 } : { on: false, time: '09:00', dom: isEhs() ? 8 : 3 }, R[key] || {});
}
function remSet(key, k, v) { var R = lsGet(LS.REM, {}); R[key] = remGet(key); R[key][k] = v; lsSet(LS.REM, R); var y = window.scrollY; render(); window.scrollTo(0, y); }
function remDay(key, d) { var r = remGet(key); var i = r.days.indexOf(d); if (i >= 0) r.days.splice(i, 1); else r.days.push(d); remSet(key, 'days', r.days.sort()); }

function icsDate(s, t) { return s.replace(/-/g, '') + 'T' + t.replace(':', '') + '00'; }
function makeIcs() {
  var ev = [], now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', url = location.origin + location.pathname;
  var t = today(), tomorrow = ymd(new Date(Date.now() + 86400000));
  var add = function (uid, title, start, time, rrule) {
    ev.push(['BEGIN:VEVENT', 'UID:' + uid + '@yuanhe-check', 'DTSTAMP:' + now, 'DTSTART;TZID=Asia/Taipei:' + icsDate(start, time), 'DURATION:PT10M',
      rrule ? 'RRULE:' + rrule : '', 'SUMMARY:' + title, 'DESCRIPTION:' + url, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + title,
      'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].filter(String).join('\r\n'));
  };
  (S.me.assigns || []).filter(function (a) { return !a.missingEquip && F(a.form); }).forEach(function (a) {
    var r = remGet(a.key); if (!r.on) return;
    var title = '作業檢點：' + aTitle(a), uid = a.key.replace(/[^\w-]/g, '_') + '_' + S.me.person.id;
    if (a.daily) {
      if (!r.days.length) return;
      add(uid, title, t, r.time, 'FREQ=WEEKLY;BYDAY=' + r.days.map(function (d) { return ['MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d - 1]; }).join(','));
    } else if (a.freq === '每月') add(uid, title, t, r.time, 'FREQ=MONTHLY;BYMONTHDAY=' + r.dom);
    else {
      var due = a.due && a.due.due ? a.due.due : tomorrow;
      var d = new Date(due + 'T00:00:00'); d.setDate(d.getDate() - (r.before || 0));
      var when = ymd(d) < tomorrow ? tomorrow : ymd(d);
      add(uid + '_' + when, title + '（期限 ' + (a.due && a.due.due ? a.due.due : '請盡快') + '）', when, r.time, '');
    }
  });
  ['close', 'review'].forEach(function (k) {
    var r = remGet(k); if (!r.on) return;
    if (k === 'close' && (isMgr() || isEhs())) return;
    if (k === 'review' && !(isMgr() || isEhs())) return;
    add(k + '_' + S.me.person.id, k === 'close' ? '作業檢點：月底送單位負責人' : '作業檢點：審核上月檢點紀錄', t, r.time, 'FREQ=MONTHLY;BYMONTHDAY=' + r.dom);
  });
  if (!ev.length) return toast('請先勾選要提醒的項目', 'err');
  var tz = ['BEGIN:VTIMEZONE', 'TZID:Asia/Taipei', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE'].join('\r\n');
  var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yuanhe EHS//Check//ZH', 'CALSCALE:GREGORIAN', tz].concat(ev).concat(['END:VCALENDAR']).join('\r\n');
  var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '作業檢點提醒.ics';
  document.body.appendChild(a); a.click(); a.remove();
  toast('已下載，請用行事曆開啟加入', 'ok', 3500);
}

// ───────────── 設定 ─────────────
PAGES.settings = function () {
  setTitle('設定');
  var m = S.me;
  $('app').innerHTML = (window.I18N ? '<div class="card"><div class="muted">語言</div>' + I18N.picker() + '<div class="mt" style="margin-top:6px">PDF 與試算表一律中文</div></div>' : '') +
    '<div class="card"><div class="kv"><div>姓名</div><div><b>' + esc(m.person.name) + '</b></div><div>身分</div><div>' + esc(m.person.role) +
    '</div><div>部門</div><div>' + esc(m.depts.map(function (d) { return d.id; }).join('、')) + '</div></div></div>' +
    '<div class="card"><div class="muted">我的簽名（送出時自動帶入）</div>' + (m.signature ? '<div class="sigimgs"><img src="' + esc(m.signature.image) + '" alt="橫式簽名"><img class="v" src="' + esc(m.signature.imageV) + '" alt="直式簽名"></div>' : '<div>尚未簽名</div>') +
    '<div><button class="btn ghost sm" onclick="go(\'sign\',{})">' + ic('pen', 18) + '重新簽名</button></div></div>' +
    '<div class="list">' +
    (isEhs() ? '<button class="li" onclick="go(\'exportData\')">' + ic('pdf', 22, 2.2) + '<span class="mn"><span class="nm">資料匯出</span><span class="mt">自己選部門、月份、表單，下載檢點紀錄 PDF</span></span><span class="chev">' + ic('right', 18) + '</span></button>' : '') +
    (isEhs() ? '<button class="li" onclick="sysReset()">' + ic('refresh', 22, 2.2) + '<span class="mn"><span class="nm">系統重新整理</span><span class="mt">後台試算表被動到、名單或資料讀不到時按（不刪資料）</span></span></button>' : '') +
    '<button class="li" onclick="go(\'mailPref\')">' + ic('mail', 22, 2.2) + '<span class="mn"><span class="nm">通知信設定</span><span class="mt">不想收的 Email 可以關掉</span></span><span class="chev">' + ic('right', 18) + '</span></button>' +
    '<button class="li" onclick="go(\'remind\')">' + ic('bell', 22, 2.2) + '<span class="mn"><span class="nm">提醒設定</span></span><span class="chev">' + ic('right', 18) + '</span></button>' +
    '<button class="li" onclick="refreshMe().then(function(){toast(\'已更新\',\'ok\')})">' + ic('refresh', 22, 2.2) + '<span class="mn"><span class="nm">重新讀取設定</span><span class="mt">環安衛中心改了表單或指派後按這裡</span></span></button>' +
    '<button class="li" onclick="logout()" style="color:var(--ngT)">' + ic('logout', 22, 2.2) + '<span class="mn"><span class="nm">換人使用／登出這支手機</span><span class="mt">換別人抄表時用；手機裡沒上傳的檢點會先保留</span></span></button>' +
    '</div><div class="ver">v' + APP_VERSION + '</div>';
};
// ───────────── 資料匯出（環安衛）：每月歸檔照常自動做；這裡隨時挑部門、月份、表單下載 ─────────────
function ymAdd(ym, n) { var d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
PAGES.exportData = function () {
  setTitle('資料匯出');
  $('app').innerHTML = loading('讀取中…');
  apiR('exportOpts', {}).then(function (o) {
    if (S.page !== 'exportData') return;
    S.expOpt = o;
    if (!S.exp) { var lm = ymAdd(today().slice(0, 7), -1); S.exp = { depts: [], forms: o.forms.map(function (f) { return f.id; }), from: lm, to: lm, unsigned: false }; }
    expRender();
  }).catch(function (e) { $('app').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
};
function expRender() {
  var o = S.expOpt, x = S.exp, units = [];
  o.depts.forEach(function (d) { if (units.indexOf(d.unit) < 0) units.push(d.unit); });
  var ck = function (kind, v, label) { return '<label class="ck"><input type="checkbox" ' + (x[kind].indexOf(v) >= 0 ? 'checked' : '') + ' onchange="expPick(' + jsq(kind) + ',' + jsq(v) + ',this.checked)"><span>' + esc(label) + '</span></label>'; };
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>每月核准後照常自動歸檔</b><div class="m">這裡是另外要資料時用（例如勞檢、稽核要看某幾個月或某幾張表）。一個部門一個月一份 PDF，多份會打包成 zip 下載。</div></div></div></div>';
  h += '<div class="card"><div class="muted">月份</div><div class="ropts"><input type="month" class="field" value="' + esc(x.from) + '" onchange="S.exp.from=this.value"><span>到</span><input type="month" class="field" value="' + esc(x.to) + '" onchange="S.exp.to=this.value"></div></div>';
  units.forEach(function (u) {
    var ds = o.depts.filter(function (d) { return d.unit === u; });
    h += '<div class="ritem"><div class="sec"><span class="sl">' + esc(u) + '</span><button class="btn ghost sm" onclick="expAll(\'depts\',' + jsq(u) + ')">全選／全不選</button></div>' + ds.map(function (d) { return ck('depts', d.dept, d.dept); }).join('') + '</div>';
  });
  h += '<div class="ritem"><div class="sec"><span class="sl">檢點表</span><button class="btn ghost sm" onclick="expAll(\'forms\',\'\')">全選／全不選</button></div>' + o.forms.map(function (f) { return ck('forms', f.id, f.name); }).join('') + '</div>';
  h += '<div class="ritem"><label class="ck"><input type="checkbox" ' + (x.unsigned ? 'checked' : '') + ' onchange="S.exp.unsigned=this.checked"><span>也匯出還沒核准歸檔的月份' +
    '<small class="muted" style="display:block;font-weight:400">PDF 上不會有單位負責人簽名，檔名註明「未簽核」</small></span></label></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" onclick="expRun()">' + ic('pdf', 22, 2.8) + '產生 PDF</button>');
}
function expPick(kind, v, on) { var a = S.exp[kind].filter(function (y) { return y !== v; }); if (on) a.push(v); S.exp[kind] = a; }
function expAll(kind, unit) {
  var all = kind === 'forms' ? S.expOpt.forms.map(function (f) { return f.id; }) : S.expOpt.depts.filter(function (d) { return d.unit === unit; }).map(function (d) { return d.dept; });
  var has = all.every(function (v) { return S.exp[kind].indexOf(v) >= 0; });
  S.exp[kind] = S.exp[kind].filter(function (v) { return all.indexOf(v) < 0; }).concat(has ? [] : all);
  expRender();
}
function expRun() {
  var x = S.exp, months = [];
  if (!x.depts.length) return toast('請勾選部門', 'err');
  if (!x.forms.length) return toast('請勾選檢點表', 'err');
  if (!x.from || !x.to || x.from > x.to) return toast('月份範圍不對', 'err');
  for (var m = x.from; m <= x.to && months.length < 120; m = ymAdd(m, 1)) months.push(m);
  var jobs = []; x.depts.forEach(function (d) { months.forEach(function (mm) { jobs.push({ dept: d, period: mm }); }); });
  if (jobs.length > S.expOpt.max) return toast('一次最多 ' + S.expOpt.max + ' 份（部門數 × 月數），目前 ' + jobs.length + ' 份，請縮小範圍', 'err', 5000);
  var files = [], skip = 0, i = 0;
  busyOn('產生 PDF 中…', '共 ' + jobs.length + ' 份，一份約 10～40 秒');
  var step = function () {
    if (i >= jobs.length) return Promise.resolve();
    var j = jobs[i++], t = $('busy') && $('busy').querySelector('b'); if (t) t.textContent = '產生 PDF 中…（' + i + '/' + jobs.length + '）' + j.dept + ' ' + ymLabel(j.period);
    return api('exportPdf', { dept: j.dept, period: j.period, forms: x.forms, unsigned: x.unsigned }).then(function (r) {
      if (r.empty) skip++; else files.push({ name: r.name, bytes: b64bytes(r.base64) });
      return step();
    });
  };
  step().then(function () {
    busyOff();
    if (!files.length) return alert('選的範圍沒有任何紀錄' + (x.unsigned ? '' : '（還沒核准歸檔的月份沒有算進來）'));
    var one = files.length === 1;
    saveFile(one ? new Blob([files[0].bytes], { type: 'application/pdf' }) : mkZip(files), one ? files[0].name : '作業檢點紀錄_匯出_' + today().replace(/-/g, '') + '.zip');
    toast('已下載 ' + files.length + ' 份' + (skip ? '（' + skip + ' 份沒有紀錄，略過）' : ''), 'ok', 4000);
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 5000); });
}
function b64bytes(b) { var bin = atob(b), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function saveFile(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
/** 不壓縮的 zip（PDF 本來就壓過），檔名用 UTF-8。 */
function mkZip(files) {
  var T = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  var enc = new TextEncoder(), parts = [], cen = [], off = 0, csz = 0;
  files.forEach(function (f) {
    var nm = enc.encode(f.name), d = f.bytes, crc = 0xFFFFFFFF;
    for (var i = 0; i < d.length; i++) crc = T[(crc ^ d[i]) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    var h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    var e = new DataView(new ArrayBuffer(46));
    e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x0800, true); e.setUint16(14, 0x21, true);
    e.setUint32(16, crc, true); e.setUint32(20, d.length, true); e.setUint32(24, d.length, true); e.setUint16(28, nm.length, true); e.setUint32(42, off, true);
    cen.push(new Uint8Array(e.buffer), nm); csz += 46 + nm.length;
    off += 30 + nm.length + d.length;
  });
  var z = new DataView(new ArrayBuffer(22));
  z.setUint32(0, 0x06054b50, true); z.setUint16(8, files.length, true); z.setUint16(10, files.length, true); z.setUint32(12, csz, true); z.setUint32(16, off, true);
  return new Blob(parts.concat(cen, [new Uint8Array(z.buffer)]), { type: 'application/zip' });
}
/** 環安衛：系統重新整理（修後台表頭、清快取、重建人員指派與功能權限、補表頭保護與名單篩選；不刪資料） */
function sysReset() {
  if (!confirm('系統重新整理？\n\n會檢查並修好後台試算表的表頭、清掉暫存、重建人員指派與功能權限。不會刪任何資料，約 10～30 秒。')) return;
  busyOn('重新整理中…');
  api('sysReset', {}).then(function (o) {
    busyOff();
    alert('完成（沒有刪任何資料）\n\n' + (o.heads.length ? '修好表頭：' + o.heads.join('、') : '表頭都正常') + '\n重建：' + o.steps.join('、'));
    return refreshMe();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 5000); });
}
function logout() {
  var name = S.me.person.name, tok = lsGet(LS.TOKEN, '');
  var mine = (S.outbox || []).filter(function (j) { return j.token === tok && (j.status === 'pending' || j.status === 'error'); });
  if (mine.length && navigator.onLine && !S.flushing) {        // 先試著把自己的送完再登出
    toast('先上傳您還沒送出的 ' + mine.length + ' 筆…', '', 2500);
    return flush().then(function () { return obRefresh(); }).then(function () {
      var left = (S.outbox || []).filter(function (j) { return j.token === tok && j.status === 'pending'; });
      if (left.length) logoutNow(name, tok, left.length); else logoutNow(name, tok, 0);
    });
  }
  logoutNow(name, tok, mine.filter(function (j) { return j.status === 'pending'; }).length);
}
function logoutNow(name, tok, left) {
  if (!confirm(left ? '還有 ' + left + ' 筆檢點沒上傳，登出後要「' + name + '」本人重新登入才會上傳（資料留在這支手機）。確定登出？' : '登出 ' + name + '？')) return;
  logoutDo(name, tok);
}
function logoutDo(name, tok) {
  obAll().then(function (a) {                                  // 記下是誰的：重新登入後 rebindJobs 換上新登入補送
    return Promise.all(a.filter(function (j) { return j.token === tok && !j.who; }).map(function (j) { j.who = name; return obPut(j); }));
  }).catch(function () {}).then(function () {
    api('logout', {}, { quiet: true, noRetry: true }).catch(function () {});   // 讓伺服器端這支手機的登入作廢
    lsDel(LS.TOKEN); lsDel(LS.ME); authClear(); rcClear(); S.me = null; S.boot = null; S.pkgs = null; S.stack = []; go('login', {}, true);
    return obRefresh();
  });
}

// ───────────── 啟動 ─────────────
window.addEventListener('online', function () { render(); if (!S.share) flush(); });
window.addEventListener('offline', function () { render(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !S.share) { flush(); refreshMe(); } });

/** 開場 LOGO：畫面第一次畫好、且至少播完 1.3 秒才收起；最慢 3 秒一定收。 */
function splashDone() {
  var s = document.getElementById('splash');
  if (!s || s.getAttribute('data-done')) return;
  s.setAttribute('data-done', '1');
  var wait = Math.max(0, 1300 - (Date.now() - (window.SPLASH_T0 || 0)));
  setTimeout(function () { s.className = 'out'; setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 450); }, wait);
}
/** 註冊 Service Worker；回到 App 時順便檢查有沒有新版，換新版後在首頁自動重新載入（填寫中不打斷）。 */
var SW_RELOAD = false;
/** 後端說 App 太舊：在安全的畫面重新載入新版（填寫、簽名、代填中先不打斷，回到首頁等畫面再換）。待上傳的檢點在 IndexedDB、草稿在手機裡，重新載入不會丟。 */
var SAFE_PAGES = ['home', 'menu', 'edu', 'eduItem', 'eduRead', 'eduStats', 'chem', 'cons', 'envMonth', 'patrol', 'login', 'url', 'notice', 'months', 'claim', 'claimReview', 'pick', 'mine', 'team', 'track', 'guide', 'settings', 'remind', 'packages'];
function appUpdate() {
  if (S.updating) return;
  var last = 0; try { last = Number(sessionStorage.getItem('chk_upd') || 0); } catch (e) {}
  if (Date.now() - last < 120000) {                     // 剛重新載入過還是舊版：GitHub 可能還在發布，過一下再試，不要一直重整
    S.updWait = true; toast('新版本還在發布中，1～2 分鐘後會自動再試', '', 4000);
    setTimeout(function () { S.updWait = false; }, 60000);
    return;
  }
  S.updating = true;
  updAsk();
}
/** 有新版本：在安全的畫面跳出「請重新開啟 App」視窗，同仁按下才重新開啟（填寫中先不打斷，回到首頁等畫面再跳）。文字跟著語言切換。 */
function updAsk() {
  if ($('updDlg')) return;
  if (SAFE_PAGES.indexOf(S.page) < 0 || $('busy')) {
    if (!S.updNote) { S.updNote = true; toast('App 有新版本：這張填完送出、回到首頁後請重新開啟', '', 5000); }
    return setTimeout(updAsk, 2000);
  }
  var d = document.createElement('div'); d.id = 'updDlg'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-live', 'assertive');
  d.innerHTML = '<div class="bx">' + ic('refresh', 40, 2.4) + '<b>App 有新版本</b><p>請按下方按鈕重新開啟 App，完成更新。</p>' +
    '<p class="sec2">手機裡還沒上傳的紀錄都會保留，更新後自動上傳。</p><button class="btn" id="updGo">重新開啟 App</button></div>';
  document.body.appendChild(d);
  $('updGo').onclick = updGo;
}
function updGo() {
  var d = $('updDlg'); if (d) d.remove();
  try { sessionStorage.setItem('chk_upd', String(Date.now())); } catch (e) {}
  busyOn('更新到新版…', '手機裡還沒上傳的檢點會保留，更新後自動上傳');
  // 自己要重新載入：先拿掉「還在處理中」的離開警告，否則 Android 會跳「要離開網站嗎」
  var done = function () { setTimeout(function () { window.removeEventListener('beforeunload', busyGuard); location.reload(); }, 800); };
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }).then(done, done);
  else done();
}
function swReg() {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    setInterval(function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); }, 30 * 60000);
  }).catch(function () {});
  var had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!had || SW_RELOAD) return;                       // 第一次安裝不用重載
    SW_RELOAD = true;
    updAsk();
  });
}
/** 請瀏覽器把這個 App 的資料（待上傳、草稿、登入）列為保存，不要在空間不足或久沒開時自動清掉。 */
function keepStorage() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {} }
// ───────────── 一次補填全部（Jason 10/12：補完一張要再點日期很麻煩）─────────────
// 月份頁按「一次補填全部漏填」→ 把這個月我負責、平日沒紀錄的（日期 × 表）排成待辦 → 一張一張帶出，送出後自動跳下一張。
// 待辦存在手機（chk.bf），中途關掉 App 也接得回來；首頁有「補填中，還有 N 張」。
var BF_KEY = 'chk.bf';
function bfGet() { var b = lsGet(BF_KEY, null); return b && b.list && b.i < b.list.length ? b : null; }
function bfSet(b) { if (b) lsSet(BF_KEY, b); else lsDel(BF_KEY); }
function bfCollect(v) {
  if (isEhs() || !(v.status === '填寫中' || v.status === '退回') || demoDept(v.dept)) return [];
  var t = today(), minD = fillMin() + '-01', out = [];
  (v.model.daily || []).forEach(function (x) {
    var f = S.me.forms[x.form]; if (!f) return;
    var a = (S.me.assigns || []).filter(function (y) { return y.daily && y.dept === v.dept && y.form === x.form; })[0];
    if (!a) return;
    blankDays(x, v.period).forEach(function (d) {
      var date = v.period + '-' + pad(d);
      if (date < minD || date >= t || pendingFor(a, date)) return;
      out.push({ key: a.key, date: date, name: f.name });
    });
  });
  return out.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : p.name < q.name ? -1 : 1; });
}
function bfButton(v) {
  var list = bfCollect(v); if (!list.length) return '';
  var days = list.map(function (x) { return x.date; }).filter(function (d, i, a) { return a.indexOf(d) === i; });
  return '<div class="card bfc"><div class="mr"><b>漏填 ' + list.length + ' 張</b><span class="muted">' + days.length + ' 天：' + esc(days.slice(0, 6).map(md).join('、') + (days.length > 6 ? '…' : '')) + '</span></div>' +
    '<button class="btn" onclick="bfStart()">' + ic('pen', 20, 2.4) + '一次補填全部（' + list.length + ' 張）</button>' +
    '<div class="muted sm2">一張一張帶出，送出後自動跳下一張；那天沒上班就按「今日無作業」。</div></div>';
}
function bfStart() {
  var v = S.view, list = bfCollect(v); if (!list.length) return;
  if (!confirm('要補填 ' + list.length + ' 張嗎？會一張一張帶出，送出後自動跳下一張。\n\n請確認這些天確實有做檢查；沒上班的那天按「今日無作業」。')) return;
  bfSet({ dept: v.dept, period: v.period, list: list, i: 0, done: 0, skip: 0 });
  bfOpen();
}
function bfOpen() { var b = bfGet(); if (!b) return; var x = b.list[b.i]; S.stack = []; openFill(x.key, x.date); }
function bfCur() { var b = bfGet(); return b && S.fill && b.list[b.i] && b.list[b.i].key === S.fill.key && b.list[b.i].date === S.fill.date ? b : null; }
function bfBanner() {
  var b = bfCur(); if (!b) return '';
  return '<div class="bfbar"><div class="bft"><b>補填 ' + (b.i + 1) + ' / ' + b.list.length + '</b><span>' + esc(md(b.list[b.i].date) + '（' + wk(b.list[b.i].date) + '）') + '</span></div>' +
    '<div class="bfb"><button class="btn ghost sm" onclick="bfSkip()">跳過這張</button><button class="btn ghost sm" onclick="bfStop()">結束補填</button></div></div>';
}
/** 送出（存進手機）之後：還有下一張就直接打開，沒有就結束。回傳 true＝已經接手畫面。 */
function bfAfterSave(key, date) {
  var b = bfGet(); if (!b || !b.list[b.i] || b.list[b.i].key !== key || b.list[b.i].date !== date) return false;
  b.i++; b.done++;
  if (b.i < b.list.length) { bfSet(b); var x = b.list[b.i]; toast('已存，下一張：' + md(x.date) + ' ' + x.name, 'ok', 2500); bfOpen(); return true; }
  bfSet(null); toast('補填完成，共 ' + b.done + ' 張；有網路會自動上傳', 'ok', 4000);
  S.stack = []; go('month', { dept: b.dept, period: b.period }, true); return true;
}
function bfSkip() {
  var b = bfGet(); if (!b) return;
  b.i++; b.skip++;
  if (b.i < b.list.length) { bfSet(b); bfOpen(); }
  else { bfSet(null); toast('補填結束（補 ' + b.done + ' 張，跳過 ' + b.skip + ' 張）', 'ok', 3500); S.stack = []; go('month', { dept: b.dept, period: b.period }, true); }
}
function bfStop() {
  var b = bfGet(); if (!b) return;
  if (!confirm('結束補填？還沒補的 ' + (b.list.length - b.i) + ' 張之後可以在月曆再補。')) return;
  bfSet(null); S.fill = null; S.stack = []; go('month', { dept: b.dept, period: b.period }, true);
}

(function init() {
  keepStorage();
  setTimeout(splashDone, 3000);
  var sm = /[#&]share=([0-9a-fA-F]{64})/.exec(location.hash);
  if (sm) {                                     // 代填連結：不碰這支手機原本的登入、草稿、待上傳
    S.share = { token: sm[1], name: '' }; S.page = 'proxy';
    render(); splashDone();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) swReg();
    return;
  }
  var deep = new URLSearchParams(location.search).get('r');
  authRestore().then(function () {                                // 登入被清掉時從備份補回
    S.me = lsGet(LS.ME, null); if (S.me) S.me = normMe(S.me);
    if (S.me && S.page === 'home') { S.page = landing(); S.landed = !!plat(); }      // 打開 App：有兩個以上功能先到主選單
    return obRefresh();
  }).then(function () {
    render();                                   // 先用手機裡的資料畫出來，不等 Google
    splashDone();
    flush();
    return refreshMe();
  }).then(function () {
    if (deep && S.me) {
      return apiR('packages', {}).then(function (list) {
        var p = list.filter(function (x) { return x.monthId === deep; })[0];
        if (p) go('month', { dept: p.dept, period: p.period });
      }).catch(function () {});
    }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) swReg();
})();
