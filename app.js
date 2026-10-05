/* 員和工業 現場作業檢點 PWA
 * 後端：Google Apps Script（as04293133，Code.gs）
 * 設計：第一次選部門＋選自己＋簽名一次，之後每天開 App 直接勾；送出先存手機再背景上傳；
 *       月底「本月完成送主管」→ 單位負責人手機審核簽名 → 產 PDF → 環安衛審核歸檔。
 * v0.4.0：畫面全面改版（首頁依角色先列「要做的事」、填寫頁進度與跳題、月結月曆、錯誤停留畫面）；
 *         後端呼叫加 rid 比對。後端 API、手機存的資料名稱、送出流程、簽名邏輯都沒有改。
 */
'use strict';
var APP_VERSION = '0.5.2';
// 部署後把網址填在這裡，現場人員就不用自己設定；空白時第一次開會請使用者貼上
var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbxXn_HbSkWw8nWxfbTOgnzll6PjBqGGEbizxfgQvZSKLqVhGO8zQFJyBKdAacqiDT5-/exec';
// 每次呼叫帶隨機 rid，回應的 rid 對不上就當連線失敗重送。
// 後端還沒更新（回應完全沒有 rid）時先放行；確認後端每個回應都帶 rid 後可改成 true（沒帶也當失敗）。
var RID_STRICT = true;

var LS = { GAS: 'chk.gas', TOKEN: 'chk.token', ME: 'chk.me', REM: 'chk.remind', DRAFT: 'chk.draft' };
var S = { me: null, page: 'home', arg: {}, stack: [], outbox: [], flushing: false, boot: null, view: null, fill: null,
          title: '', hero: null, topExtra: '', pkgs: null, ff: 'all', mArg: null, mf: 0, mv: 'cal', md: undefined, mErr: null, cm: '' };

// ───────────── 小工具 ─────────────
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
/** 放進 onclick="fn(…)" 的字串參數：JSON 字串再做 HTML 跳脫，名稱裡有引號也不會壞 */
function jsq(s) { return esc(JSON.stringify(String(s == null ? '' : s))); }
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function gasUrl() { return lsGet(LS.GAS, '') || DEFAULT_GAS; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today() { return ymd(new Date()); }
function wk(s) { return '日一二三四五六'.charAt(new Date(s + 'T00:00:00').getDay()); }
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
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
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
function ic(n, s, w) {
  s = s || 20;
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2.4) +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';
}
function pill(cls, icon, text) { return '<span class="pill p-' + cls + '">' + (icon ? ic(icon, 14, 2.8) : '') + esc(text) + '</span>'; }
function loading(t) { return '<div class="loading"><span class="spin"></span>' + esc(t) + '</div>'; }
/** 重要錯誤：停留在畫面上的卡片（不會自己消失） */
function errBox(title, msg, btns) {
  return '<div class="box err" role="alert"><div class="r">' + ic('err', 24) + '<div class="bt"><b>' + esc(title) + '</b>' +
    (msg ? '<div class="m">' + esc(msg) + '</div>' : '') + '</div></div>' + (btns || '') + '</div>';
}

var toastTimer = null;
function toast(msg, type, ms) {
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
  function once() {
    var rid = newId();
    var payload = JSON.stringify(Object.assign({ action: action, token: opt.token === '-' ? '' : (opt.token || lsGet(LS.TOKEN, '')) }, body || {}, { rid: rid }));
    return fetch(url, { method: 'POST', redirect: 'follow', body: payload }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Google 暫時無法開啟'); }
      if (!j || typeof j !== 'object') throw new Error('Google 暫時無法開啟');
      if (j.rid !== rid && (RID_STRICT || j.rid !== undefined)) throw new Error('連線回應錯亂（rid 不符）');
      if (!j.success) { var err = new Error(j.error || '系統錯誤'); err.biz = true; throw err; }
      return j.data;
    }).catch(function (e) {
      if (e.biz || i >= waits.length) throw e;
      if (i === 0 && !opt.quiet) toast('連線不穩，自動重試中…', '', 2000);
      var w = waits[i++];
      return new Promise(function (res) { setTimeout(res, w); }).then(once);
    });
  }
  return once();
}

// ───────────── 待上傳區（IndexedDB）─────────────
var DB = null;
function db() {
  if (DB) return Promise.resolve(DB);
  return new Promise(function (res, rej) {
    var q = indexedDB.open('chk_db', 1);
    q.onupgradeneeded = function () { q.result.createObjectStore('outbox', { keyPath: 'id' }); };
    q.onsuccess = function () { DB = q.result; res(DB); };
    q.onerror = function () { rej(q.error); };
  });
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
function flush() {
  if (S.flushing || !navigator.onLine || !gasUrl()) return Promise.resolve();
  S.flushing = true;
  if (S.page === 'home') render();
  var sent = 0, failed = 0;
  return obAll().then(function (jobs) {
    var p = Promise.resolve(), stop = false;
    jobs.filter(function (j) { return j.status === 'pending'; }).forEach(function (j) {
      p = p.then(function () {
        if (stop) return;
        return api('submitCheck', Object.assign({ submitId: j.id }, j.body), { token: j.token, quiet: true }).then(function () {
          sent++; return obDel(j.id);
        }).catch(function (e) {
          j.tries = (j.tries || 0) + 1; j.message = e.message;
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
    if (sent) toast('已上傳 ' + sent + ' 筆檢點', 'ok');
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
    var why = !navigator.onLine ? '等網路恢復' : S.flushing ? '上傳中…' : (pend.some(function (j) { return j.message; }) ? '沒連上，會自動再試' : '背景上傳中');
    h += '<div class="strip info">' + ic('cloud', 24, 2.2) + '<div class="stx"><span><b>待上傳 ' + pend.length + ' 筆</b>・' + why + '</span>' +
      '<small>已存在手機，不會不見</small></div>' +
      '<button class="btn sm" onclick="flush()"' + (S.flushing ? ' disabled' : '') + '>立即上傳</button></div>';
  }
  a.filter(function (j) { return j.status !== 'pending'; }).forEach(function (j) {
    h += errBox(j.label + ' 沒有上傳成功', '原因：' + (j.message || '不明'),
      '<div class="btns"><button class="btn red" onclick="obRetry(' + jsq(j.id) + ')">重試</button>' +
      '<button class="btn redline" onclick="obDrop(' + jsq(j.id) + ')">刪除這筆</button></div>');
  });
  return h;
}
function netBlock() {
  if (navigator.onLine) return '';
  return '<div class="strip off">' + ic('wifioff', 24, 2.2) + '<div class="stx"><b>目前沒有網路</b><small>照常檢點，會先存在手機，有網路自動上傳</small></div></div>';
}
function obRetry(id) { obAll().then(function (a) { var j = a.filter(function (x) { return x.id === id; })[0]; if (!j) return; j.status = 'pending'; return obPut(j); }).then(obRefresh).then(function () { render(); flush(); }); }
function obDrop(id) { if (!confirm('刪除這筆檢點？刪了手機上就沒有這筆資料了。')) return; obDel(id).then(obRefresh).then(render); }

// ───────────── 資料 ─────────────
function normMe(m) {
  m.assigns = []; m.months = [];
  var stale = m.today && m.today !== today();      // 手機裡存的是前幾天的狀態（例如隔天一早沒訊號）：今天一律當作還沒做
  m.person.depts = m.depts.map(function (d) { return { id: d.id, name: d.id }; });
  m.depts.forEach(function (d) {
    d.daily.forEach(function (x) {
      if (stale) x = { form: x.form, state: 'todo', signer: '' };
      m.assigns.push({ key: d.id + '|' + x.form + '||', dept: d.id, form: x.form, object: '', kind: '', freq: '作業日', daily: true,
        due: { todayDone: x.state === 'done' || x.state === 'nowork', todayNoWork: x.state === 'nowork', state: x.state, signer: x.signer || '' } });
    });
    d.pick.forEach(function (x) {
      if (x.missingEquip) { m.assigns.push({ key: d.id + '|' + x.form + '|?|', dept: d.id, form: x.form, object: '', kind: '', missingEquip: x.missingEquip, freq: '' }); return; }
      m.assigns.push({ key: [d.id, x.form, x.object, x.kind].join('|'), dept: d.id, form: x.form, object: x.object, objectName: x.objectName,
        kind: x.kind, freq: x.freq, pick: true, warnDays: 30, due: { last: x.last, due: x.due, state: x.state } });
    });
    d.months.forEach(function (x) { m.months.push({ dept: d.id, unit: d.unit, period: x.period, status: x.status, reason: x.reason, sheetUrl: d.sheetUrl,
      crew: x.crew, submitter: x.submitter, submittedAt: x.submittedAt }); });
  });
  return m;
}
function refreshMe() {
  if (!lsGet(LS.TOKEN, '')) return Promise.resolve();
  return api('me', {}, { quiet: true }).then(function (m) {
    S.me = normMe(m); lsSet(LS.ME, m);
    if (m.pendingReview) loadPkgs(true); else S.pkgs = [];
    if (['home', 'settings', 'pick', 'months'].indexOf(S.page) >= 0) render();
  }).catch(function (e) {
    if (e.biz && /失效|名單|選擇您的身分/.test(e.message)) { lsDel(LS.TOKEN); lsDel(LS.ME); S.me = null; go('login', {}, true); }
  });
}
/** 主管／環安衛首頁要列出「哪一份待審」：讀 packages 清單 */
var pkgLoading = false;
function loadPkgs(force) {
  if (pkgLoading || (S.pkgs && !force)) return;
  pkgLoading = true;
  api('packages', {}, { quiet: true }).then(function (list) { S.pkgs = list || []; if (S.page === 'home') render(); })
    .catch(function () { if (!S.pkgs) S.pkgs = []; }).then(function () { pkgLoading = false; });
}
function A(key) { return (S.me.assigns || []).filter(function (a) { return a.key === key; })[0]; }
function F(id) { return S.me.forms[id]; }
function aTitle(a) { var f = F(a.form); return f.name + (a.object ? '｜' + a.object : '') + (a.kind ? '｜' + a.kind : ''); }
function isMgr() { return S.me && S.me.person.role === '單位負責人'; }
function mgrOf(dept) { var d = (S.me.depts || []).filter(function (x) { return x.id === dept; })[0]; return d && d.mgr; }
function isEhs() { return S.me && /^環安衛/.test(S.me.person.role); }
function pendingFor(a, date) {
  return (S.outbox || []).some(function (j) { return j.status === 'pending' && j.key === a.key && j.body.date === date; });
}
function pendJob(a, date) {
  return (S.outbox || []).filter(function (j) { return j.status === 'pending' && j.key === a.key && j.body.date === date; })[0];
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
  render();
}
function back() { var p = S.stack.pop() || { page: 'home', arg: {} }; S.page = p.page; S.arg = p.arg; window.scrollTo(0, 0); render(); }

function render() {
  var p = S.page;
  if (S.share) { if (['proxy', 'fill', 'psign'].indexOf(p) < 0) { p = 'proxy'; S.page = p; } }
  else if (!gasUrl()) p = 'url';
  else if (!lsGet(LS.TOKEN, '') && p !== 'login') p = 'login';
  else if (p !== 'login' && p !== 'sign' && S.me && !(S.me.signature && S.me.signature.imageV)) { p = 'sign'; if (S.page !== 'sign') { S.page = 'sign'; S.arg = {}; } }
  var fn = PAGES[p] || PAGES.home;
  S.cur = p; S.hero = null; S.topExtra = '';
  $('bar').innerHTML = ''; padBar();
  fn();
  drawTop();
}
function netTag() { var on = navigator.onLine; return '<span class="net' + (on ? '' : ' off') + '" id="net"><i></i>' + (on ? '已連線' : '離線') + '</span>'; }
function drawTop() {
  var t = $('top');
  if (S.hero) { t.className = 'hero'; t.innerHTML = S.hero; return; }
  var showBack = S.stack.length && ['home', 'login', 'url', 'proxy'].indexOf(S.cur) < 0;
  t.className = 'topbar';
  t.innerHTML = '<div class="tb">' + (showBack ? '<button class="tb-back" id="back" aria-label="返回" onclick="back()">' + ic('back', 24, 2.6) + '</button>' : '<span class="tb-sp"></span>') +
    '<div class="tb-t"><div class="tb-ttl" id="ttl">' + esc(S.title) + '</div>' + (S.me ? '<div class="tb-sub">' + esc(whoLine()) + '</div>' : '') + '</div>' + netTag() + '</div>' + (S.topExtra || '');
}
function setTitle(t) { S.title = t; document.title = t === '員和電子抄表' ? t : t + '｜員和電子抄表'; }
function bar(html) { $('bar').innerHTML = '<div class="bar"><div class="in">' + html + '</div></div>'; padBar(); }
function padBar() { var b = $('bar').firstChild; document.documentElement.style.setProperty('--barh', (b ? b.offsetHeight : 0) + 'px'); }

var PAGES = {};

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
  S.hero = '<div class="hero-in"><div class="brand"><span class="logo">' + '<img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block">' + '</span>員和電子抄表</div>' +
    '<div class="hn"><div class="h1">第一次使用，請選您是誰</div><div class="hsub">只要選一次，之後打開就直接用</div></div></div>';
  var b = S.boot;
  if (!b) {
    $('app').innerHTML = loading('讀取名單中…');
    api('bootstrap').then(function (d) { S.boot = d; render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到名單', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
    return;
  }
  var a = S.arg;
  var step = function (n, done, t) { return '<div class="stepH"><i class="' + (done ? 'done' : '') + '">' + (done ? ic('check', 16, 3.2) : n) + '</i>' + t + '</div>'; };
  var h = step(1, !!a.dept, '您的部門') + '<div class="depts">' + b.depts.map(function (d, i) {
    var on = a.dept === d;
    return '<button class="dept' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="S.arg={dept:S.boot.depts[' + i + ']};render()">' + (on ? ic('check', 16, 3.2) : '') + esc(d) + '</button>';
  }).join('') + '</div>';
  var ps = a.dept ? (b.people[a.dept] || []) : [];
  if (a.dept) {
    h += step(2, a.i != null, '您是') + (ps.length ? '<div class="list">' + ps.map(function (p, i) {
      return '<button class="li' + (a.i === i ? ' sel' : '') + '" aria-pressed="' + (a.i === i) + '" onclick="S.arg.i=' + i + ';render()"><span class="radio"></span><span class="mn"><span class="nm">' + esc(p.name) + '</span><span class="mt">' +
        esc(p.role) + (p.needPin ? '・需要啟用碼' : '') + '</span></span></button>';
    }).join('') + '</div>' : '<div class="box warn"><div class="r">' + ic('info', 22) + '<div class="bt"><b>這個部門的名單還沒建立</b><div class="m">請洽環安衛中心。</div></div></div></div>');
  }
  var sel = a.i != null ? ps[a.i] : null;
  if (sel && sel.needPin) h += step(3, false, '<label for="pin">輸入啟用碼</label>') + '<input id="pin" class="field pin" inputmode="numeric" autocomplete="one-time-code" placeholder="環安衛中心給您的啟用碼">';
  h += '<div id="loginErr"></div>';
  $('app').innerHTML = h;
  if (sel) bar('<button class="btn" id="bindBtn" onclick="doBind()">確認，我是 ' + esc(sel.name) + '</button>');
};
function doBind() {
  var btn = $('bindBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>登入中…';
  var sel = S.boot.people[S.arg.dept][S.arg.i];
  var pin = $('pin') ? $('pin').value.trim() : '';
  $('loginErr').innerHTML = '';
  api('bind', { name: sel.name, pin: pin, device: navigator.userAgent.slice(0, 80) }).then(function (d) {
    lsSet(LS.TOKEN, d.token); lsSet(LS.ME, d.me); S.me = normMe(d.me); S.stack = [];
    go(d.me.signature ? 'home' : 'sign', {}, true);
    toast('歡迎，' + esc(d.me.person.name), 'ok');
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
  } else {
    h += '<div class="h2">請用手指簽全名</div><div class="lead">只要簽<b>這一次</b>，存在系統裡，之後每次送出都會自動帶入，不用每天簽。</div>' +
      '<div class="sigwrap"><canvas id="cv" class="sigbox" aria-label="橫式簽名區"></canvas>';
  }
  h += '<div class="right"><button class="btn ghost sm" onclick="sigClear()">' + ic('refresh', 18) + '清除重簽</button></div></div>';
  if (!v) h += '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">這個簽名用在定期檢查表與送審。下一步再簽一個直的，給每日檢點表用。</div></div></div></div>';
  if (has) h += '<div class="card"><div class="muted">目前的簽名（按儲存才會換掉）</div><div class="sigimgs"><img src="' + esc(has.image) + '" alt="目前的橫式簽名">' +
    (has.imageV ? '<img class="v" src="' + esc(has.imageV) + '" alt="目前的直式簽名">' : '') + '</div></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="sigBtn" onclick="sigNext()">' + (v ? ic('check', 22, 2.8) + '儲存兩個簽名' : '下一步：簽直式' + ic('arrow', 20, 2.6)) + '</button>');
  sigInit();
};
var SIG = { drawn: false };
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
  if (S.arg.step !== 'v') { SIG.h = img; S.arg = { step: 'v' }; window.scrollTo(0, 0); return render(); }
  var btn = $('sigBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>儲存中…';
  api('saveSignature', { image: SIG.h, imageV: img }).then(function (r) {
    S.me.signature = { id: r.id, image: SIG.h, imageV: img };
    var raw = lsGet(LS.ME, null); if (raw) { raw.signature = S.me.signature; lsSet(LS.ME, raw); }
    toast('簽名已存', 'ok'); S.stack = []; go('home', {}, true);
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); btn.disabled = false; btn.className = 'btn'; btn.textContent = '再試一次'; });
}

// ───────────── 首頁（依角色：先講要做的事）─────────────
function duePill(a) {
  var d = a.due || {};
  if (a.daily) {
    if (pendingFor(a, today())) return pill('info', 'up', '待上傳');
    if (d.todayNoWork) return pill('na', 'minus', '今日無作業');
    return d.todayDone ? pill('ok', 'check', '已檢點') : pill('warn', 'clock', '今天未檢點');
  }
  return ({ never: pill('na', '', '尚無紀錄'), overdue: pill('ng', 'warn', '已到期'), soon: pill('warn', 'clock', '快到期'), ok: pill('ok', 'check', '期限內') })[d.state] || '';
}
function dueMeta(a) {
  var d = a.due || {};
  return (a.freq || '') + (d.last ? '｜上次 ' + d.last + (d.due ? '｜下次 ' + d.due : '') : '｜還沒有紀錄');
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
  setTitle('員和電子抄表');
  var m = S.me;
  if (!m) { $('app').innerHTML = loading('載入中…'); return; }
  var t = today(), ehs = isEhs(), mgr = isMgr(), multi = m.depts.length > 1;
  var dn = function (d) { return multi ? d + '・' : ''; };
  var tasks = [];
  // 1. 被退回
  if (!ehs) m.months.forEach(function (x) {
    if (x.status === '退回' && !mgrOf(x.dept)) tasks.push({ red: true, tag: dn(x.dept) + '被退回，要修正', title: ymLabel(x.period) + '的檢點紀錄', meta: '退回原因：' + (x.reason || '（未填寫）'), btn: '去修正並重新送出', on: goMonth(x.dept, x.period) });
  });
  // 2. 待審核（主管／環安衛）
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
    if (od.length) tasks.push({ tag: dn(d.id) + '定期檢查', title: od.length + ' 張已到期', meta: od.slice(0, 2).map(pickName).join('、') + (od.length > 2 ? '…' : ''), btn: '去看看', on: "go('pick',{dept:" + jsq(d.id) + '})' });
  });
  // 5. 上個月還沒送審
  if (!ehs) m.months.forEach(function (x) {
    if (x.period < t.slice(0, 7) && x.status === '填寫中' && !mgrOf(x.dept)) {     // 送審是檢點人員的事；主管看「各課送審狀況」
      var mo = Number(x.period.slice(5));
      tasks.push({ tag: dn(x.dept) + '月底送審・已過期限', title: '送出 ' + mo + ' 月的檢點紀錄', meta: '確認沒漏填，鎖定後送給單位負責人', btn: '查看 ' + mo + ' 月並送出', on: goMonth(x.dept, x.period) });
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
  S.hero = '<div class="hero-in"><div class="hi"><div class="hn"><div class="h1">' + greet() + '，' + esc(m.person.name) + '</div><div class="hsub">' + esc(sub) + '</div></div>' + netTag() + '</div>' +
    '<div class="hs">' + hs + '</div></div>';

  // 內容
  var h = netBlock() + outboxBlock();
  if (tasks.length) h += '<div class="sec"><span class="sl"><span class="cnt">' + tasks.length + '</span>要做的事</span></div>' + tasks.map(taskHtml).join('');
  else h += '<div class="card calm">' + ic('check', 24, 3) + '目前沒有要做的事</div>';

  if (!ehs && !mgr && done.length) {
    h += '<div class="sec">今天已完成</div><div class="list">' + done.map(function (a) {
      var job = pendJob(a, t);
      var dot = job ? '<span class="dotic info">' + ic('up', 16, 3) + '</span>' : a.due.todayNoWork ? '<span class="dotic na">' + ic('minus', 16, 3) + '</span>' : '<span class="dotic ok">' + ic('check', 16, 3.2) + '</span>';
      var other = a.due.signer && a.due.signer !== m.person.name;     // 同課別人已經檢點
      var st = job ? '<span class="mt inf">已存手機，等待上傳・' + hm(job.created) + '</span>' : a.due.todayNoWork ? '<span class="mt">今日無作業</span>' :
        other ? '<span class="mt okt">' + esc(a.due.signer) + ' 已檢點</span>' : '<span class="mt okt">已上傳</span>';
      return '<button class="li" onclick="openFill(' + jsq(a.key) + ')">' + dot + '<span class="mn"><span class="nm">' + esc(dn(a.dept) + F(a.form).name) + '</span>' + st + '</span></button>';
    }).join('') + '</div>';
  }
  if (mgr && daily.length) {
    h += '<div class="sec">本課今天的檢點<small>' + md(t) + '（' + wk(t) + '）</small></div><div class="list">' + daily.map(function (a) {
      return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(dn(a.dept) + F(a.form).name) + '</span></span>' + duePill(a) + '</button>';
    }).join('') + '</div>';
  }
  if (mgr && !ehs) {
    var mine2 = m.months.filter(function (x) { return x.crew; }).sort(function (x, y) { return x.period < y.period ? 1 : x.period > y.period ? -1 : (x.dept < y.dept ? -1 : 1); });
    if (mine2.length) h += '<div class="sec">各課送審狀況<small>送審後才能審核</small></div><div class="list">' + mine2.map(crewRow).join('') + '</div>';
  }
  if (ehs && m.months.length) {
    var lastP = (function () { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ymd(d).slice(0, 7); })();
    var ms = m.months.filter(function (x) { return x.period >= lastP || x.status !== '已歸檔'; })
      .sort(function (x, y) { return x.period < y.period ? 1 : x.period > y.period ? -1 : (x.dept < y.dept ? -1 : 1); });
    if (ms.length) h += '<div class="sec">各部門月結進度</div><div class="list">' + ms.map(monthRow).join('') + '</div>';
  }

  // 入口
  var tl = '';
  if (!ehs) m.depts.forEach(function (d) {
    var picks = m.assigns.filter(function (a) { return a.dept === d.id && (a.pick || a.missingEquip); });
    if (!picks.length) return;
    var warn = picks.filter(function (a) { return a.due && (a.due.state === 'overdue' || a.due.state === 'soon'); }).length;
    tl += tile('clip', '其他檢查表', "go('pick',{dept:" + jsq(d.id) + '})', warn ? pill('warn', '', warn + ' 張快到期') : '', multi ? d.id : '定期、堆高機、烘箱…');
  });
  if (!ehs && m.depts.some(function (d) { return m.assigns.some(function (a) { return a.dept === d.id && a.daily; }); }))
    tl += tile('chat', '請人代填', "go('shareMake')", '', '休假時給同事限時連結');
  if (mgr || ehs) tl += tile('review', '審核紀錄', "go('packages')");
  tl += tile('cal', '月結紀錄', "go('months')");
  tl += tile('bell', '提醒設定', "go('remind')");
  tl += tile('sliders', '設定', "go('settings')");
  h += '<div class="tiles">' + tl + '</div><div class="ver">v' + APP_VERSION + '</div>';
  $('app').innerHTML = h;
};
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
  var f = F(a.form);
  setTitle(f.name);
  var t = today(), minD = (function () { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ymd(d); })();
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
  var h = '<div class="meta">' + esc(metaTxt) + '</div>' + (S.share ? '<div class="dwrap"><div class="lbl">檢查日期 ' + pill('ok', '', md(fm.date) + '（' + wk(fm.date) + '）') + '</div></div>' :
    '<div class="dwrap"><div class="lbl"><label for="dt">檢查日期</label>' + (fm.date === t ? pill('ok', '', '今天') : pill('warn', '', '補登')) + '</div>' +
    '<input type="date" class="field" id="dt" value="' + esc(fm.date) + '" max="' + t + '" min="' + minD + '" onchange="fillDate(this.value)">' +
    '<div class="hint">要補登可改日期，最早到 ' + md(minD) + '</div></div>');
  if (a.daily) {
    h += '<div class="btns r21"><button class="btn navy" onclick="allOk()">' + ic('check', 22, 3) + '全部正常</button>' +
      '<button class="btn ghost" onclick="noWork()">' + (fm.noWork ? '↺ 取消無作業' : '今日無作業') + '</button></div>';
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
          '<textarea id="n' + esc(it.seq) + '" class="note' + (needNote ? '' : ' plain') + '" placeholder="' + esc(f.noteTitle || '請說明異常狀況與處理方式') + '" oninput="noteIn(' + jsq(it.seq) + ',this.value)">' + esc(fm.n[it.seq] || '') + '</textarea></div>' : '') +
        '</div>';
    });
    if (!shown) h += '<div class="empty">' + (ff === 'todo' ? '都勾完了，沒有未勾的項目' : '沒有異常的項目') + '</div>';
    if (ff === 'all') (f.extra || []).forEach(function (x, i) {
      h += '<div class="item"><label class="qt" for="x' + i + '">' + esc(x) + '</label><textarea id="x' + i + '" class="note plain" oninput="S.fill.x[' + i + ']=this.value;draftSave()">' + esc(fm.x[i] || '') + '</textarea></div>';
    });
  }
  h += S.share ? '<div class="box info"><div class="r">' + ic('pen', 22) + '<div class="bt"><b>勾完按送出，下一步請寫姓名並簽名</b><div class="m">代填的檢點要本人當場簽名才算數。</div></div></div></div>'
    : '<div class="sigcard"><img src="' + esc(S.me.signature.image) + '" alt="您的簽名"><div class="stx"><b>送出時自動帶入您的簽名</b>不用再簽</div></div>';
  $('app').innerHTML = h;
  fillBar();
};
/** 底部按鈕永遠告訴使用者下一步：還沒勾 → 跳過去；要寫說明 → 跳過去；都好了 → 送出 */
function fillBar() {
  if (S.page !== 'fill' || !S.fill) return;
  var a = A(S.arg.key), f = F(a.form), fm = S.fill, st = fillState(f, fm), h;
  if (fm.noWork) h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic('check', 22, 2.8) + '送出（今日無作業）</button>';
  else if (st.todo.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.todo[0]) + ')">還有 ' + st.todo.length + ' 項沒勾・跳到第 ' + esc(st.todo[0]) + ' 項' + ic('down', 20, 2.6) + '</button>';
  else if (st.noNote.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.noNote[0]) + ',1)">第 ' + esc(st.noNote[0]) + ' 項要寫說明・跳過去' + ic('down', 20, 2.6) + '</button>';
  else h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic('check', 22, 2.8) + st.total + ' 項都勾好了，送出</button>';
  bar(h);
}
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
  var f = F(A(S.arg.key).form);
  if (f.noteFor.indexOf(k) >= 0 && !String(S.fill.n[seq] || '').trim()) {     // 選到要說明的選項：直接把游標放進說明框
    var ta = $('n' + seq); if (ta) ta.focus({ preventScroll: true });
  }
}
function allOk() {
  var a = A(S.arg.key), f = F(a.form);
  f.items.forEach(function (it) { var opts = it.opts || f.opts; if (!S.fill.r[it.seq] || S.fill.r[it.seq] === 'na') S.fill.r[it.seq] = S.fill.r[it.seq] === 'na' ? 'na' : opts[0].k; });
  S.fill.noWork = false; draftSave(); render();
  toast('已勾「' + esc((f.items[0].opts || f.opts)[0].label) + '」，有異常的請個別改', '', 2200);
}
function noWork() { S.fill.noWork = !S.fill.noWork; draftSave(); render(); }

function submitFill() {
  var a = A(S.arg.key), f = F(a.form), fm = S.fill;
  if (!fm.noWork) {
    for (var i = 0; i < f.items.length; i++) {
      var it = f.items[i], v = fm.r[it.seq];
      if (!v) { jumpTo(it.seq); return toast('第 ' + esc(it.seq) + ' 項還沒勾', 'err'); }
      if (f.noteFor.indexOf(v) >= 0 && !String(fm.n[it.seq] || '').trim()) { jumpTo(it.seq, 1); return toast('第 ' + esc(it.seq) + ' 項請寫說明', 'err'); }
    }
  }
  if (S.share) { draftSave(); return go('psign', { key: a.key }); }
  var btn = $('fillBtn'); if (btn) { btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>存到手機中…'; }
  var extra = {};
  (f.extra || []).forEach(function (x, i) { if (fm.x[i]) extra[x] = fm.x[i]; });
  var body = { deptId: a.dept, formId: a.form, object: a.object || '', kind: a.kind || '', date: fm.date,
               results: fm.noWork ? {} : fm.r, notes: fm.noWork ? {} : fm.n, extra: extra, noWork: fm.noWork };
  var job = { id: newId(), token: lsGet(LS.TOKEN, ''), key: a.key, body: body, created: Date.now(), status: 'pending',
              label: f.name + ' ' + md(fm.date) };
  obPut(job).then(function () {
    draftDrop(fm);
    // 畫面立即更新為「待上傳」，真正結果以後端為準
    if (fm.date === today() && a.daily) { a.due.todayDone = true; a.due.todayNoWork = fm.noWork; }
    S.fill = null; S.stack = []; S.page = 'home'; S.arg = {};
    return obRefresh();
  }).then(function () {
    window.scrollTo(0, 0); render(); toast('已存在手機，背景上傳中', 'ok'); flush();
  }).catch(function (e) {
    toast('手機存檔失敗：' + esc(e.message), 'err', 5000);
    if (btn) { btn.disabled = false; btn.className = 'btn'; btn.textContent = '再送一次'; }
  });
}

// ───────────── 月份檢視／送出／審核 ─────────────
PAGES.month = function () {
  var a = S.arg;
  setTitle(deptOf(a.dept) + ' ' + ymLabel(a.period));
  if (S.mArg !== a) { S.mArg = a; S.mf = 0; S.mv = 'cal'; S.md = undefined; S.mErr = null; S.cm = ''; }
  $('app').innerHTML = loading('讀取中…');
  api('monthView', { deptId: a.dept, period: a.period }).then(function (v) {
    if (S.page !== 'month' || S.arg !== a) return;
    S.view = v; monthRender();
  }).catch(function (e) { $('app').innerHTML = errBox('讀不到這個月的資料', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
};
function dayBad(f, r) {
  if (!r || r.noWork) return false;
  return Object.keys(r.results || {}).some(function (k) { var x = r.results[k]; return x === '?' || f.noteFor.indexOf(x) >= 0; });
}
function seeLate(v) { return !!(mgrOf(v.dept) || isEhs()); }     // 補登資訊只給單位負責人、環安衛看
function monthRender() {
  if ($('cm')) S.cm = $('cm').value;
  var v = S.view, forms = S.me.forms, mm = v.model, boss = mgrOf(v.dept), ehs = isEhs();
  var late = seeLate(v) ? (mm.late || {}) : {};
  var h = '';
  if (S.mErr) h += errBox(S.mErr.t, S.mErr.m, S.mErr.btn || '');
  h += '<div class="card"><div class="mr"><b>本月狀態</b>' + statusPill(v.status) + '</div>' +
    (v.status === '退回' ? '<div class="box err" role="alert"><div class="r">' + ic('ret', 22) + '<div class="bt"><b>退回原因</b><div class="m">' + esc(v.reason) + '</div></div></div></div>' : '') +
    (v.sheetUrl ? '<a class="link" href="' + esc(v.sheetUrl) + '" target="_blank" rel="noopener">' + ic('ext', 18, 2.2) + '在 Google 試算表檢視／編輯</a>' : '') + '</div>';
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
    if (S.md === undefined) { S.md = null; for (var d0 = 1; d0 <= 31; d0++) if (dayBad(f, x.days[d0])) { S.md = d0; break; } }
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
    if (S.mv === 'cal') h += '<div class="card">' + stats + calHtml(f, x, v.period, late[x.form]) + '</div>' + dayDetail(f, x, v.period, late[x.form]);
    else h += '<div class="card">' + stats + '</div>' + gridHtml(f, x, v.period, seeLate(v) ? late[x.form] : null);
  }
  if (mm.periodic.length) h += '<div class="sec">定期檢查（本月）</div>';
  mm.periodic.forEach(function (x) { h += sheetHtml(forms[x.form], x); });
  if (!mm.daily.length && !mm.periodic.length) h += '<div class="empty">這個月沒有資料。</div>';
  $('app').innerHTML = h;

  if ((v.status === '填寫中' || v.status === '退回') && !ehs) {
    bar(v.problems.length ? '<button class="btn" disabled>補完 ' + v.problems.length + ' 個地方，才能送單位負責人</button>'
      : '<button class="btn" id="smBtn" onclick="submitMonth()">' + ic('check', 22, 2.8) + '本月完成，鎖定送單位負責人</button>');
  } else if (v.status === '待主管審核' && boss && !ehs) {
    bar('<label class="nl" for="cm">意見（退回時必填）</label><textarea id="cm" class="note plain" placeholder="意見（退回時必填）">' + esc(S.cm) + '</textarea>' +
      '<div class="btns r12"><button class="btn redline" onclick="doReview(\'return\')">退回</button><button class="btn" onclick="doReview(\'approve\')">' + ic('pen', 22) + '核准並簽名</button></div>');
  } else if (v.status === '待環安衛審核' && ehs) {
    bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic('pdf', 20, 2.2) + '開啟 PDF</button>' +
      '<div class="btns r12"><button class="btn redline" onclick="doEhs(\'return\')">退回</button><button class="btn" onclick="doEhs(\'approve\')">' + ic('check', 22, 2.8) + '核准歸檔</button></div>');
  } else if (v.status === '已歸檔' || v.status === '待環安衛審核') {
    bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic('pdf', 20, 2.2) + '開啟 PDF</button>');
  }
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
  var h = '<div class="calw">' + '日一二三四五六'.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div><div class="cal">';
  for (var i = 0; i < first; i++) h += '<span></span>';
  var anyLate = false, anyMiss = false;
  for (var d = 1; d <= n; d++) {
    var r = x.days[d], date = period + '-' + pad(d), dow = (first + d - 1) % 7, future = date > td, cls = 'cd', mark = '', lab;
    if (r && r.noWork) { cls += ' nw'; mark = '<small>無</small>'; lab = '無作業'; }
    else if (r && dayBad(f, r)) { cls += ' bad'; mark = ic('x', 12, 3.6); lab = '有異常'; }
    else if (r) { cls += ' ok'; mark = ic('check', 12, 3.6); lab = '正常'; }
    else if (!future && dow > 0 && dow < 6) { cls += ' miss'; lab = '沒有紀錄'; anyMiss = true; }
    else lab = '沒有紀錄';
    if (late && late[d]) { cls += ' late'; anyLate = true; if (!r || !dayBad(f, r)) mark = '<small class="lt">補登</small>'; lab += '、補登'; }
    if (S.md === d) cls += ' sel';
    h += '<button class="' + cls + '" aria-label="' + mo + '/' + d + ' ' + lab + '"' + (future ? ' disabled' : ' onclick="mDay(' + d + ')"') + '>' + d + mark + '</button>';
  }
  h += '</div><div class="legend"><span><i style="background:var(--okbg)"></i>✓ 正常</span><span><i style="background:var(--ng)"></i>✕ 有異常</span><span><i style="background:#E2E6EB"></i>無作業</span>' +
    (anyMiss ? '<span><i style="border:2px dashed #B5BEC9"></i>平日沒紀錄</span>' : '') + (anyLate ? '<span><i style="box-shadow:inset 0 0 0 2px var(--orange)"></i>補登</span>' : '') + '</div>';
  return h;
}
function optLabel(f, seq, k) {
  var it = f.items.filter(function (x) { return x.seq === seq; })[0];
  var o = ((it && it.opts) || f.opts).filter(function (x) { return x.k === k; })[0];
  return o ? o.label : k;
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
  return h + '</div>';
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
  if (!confirm('鎖定 ' + v.dept + ' ' + ymLabel(v.period) + ' 並送單位負責人審核？\n\n送出後 App 和試算表這個月都不能再改，除非被退回。')) return;
  var btn = $('smBtn'); if (btn) { btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>送出中…'; }
  api('submitMonth', { deptId: v.dept, period: v.period }).then(function (r) {
    S.mErr = null;
    toast('已鎖定送審', 'ok');
    var link = location.origin + location.pathname + '?r=' + r.monthId;
    var text = v.dept + ' ' + ymLabel(v.period) + ' 作業檢點已完成，請審核簽名：' + link;
    $('app').innerHTML = '<div class="sent"><span class="bigck">' + ic('check', 40, 3) + '</span><b>已送給單位負責人</b><p>' + esc(v.dept + ' ' + ymLabel(v.period)) +
      ' 已鎖定送審。<br>單位負責人打開檢點系統就會看到，也可以順手傳個訊息提醒他。</p></div>';
    bar('<button class="btn" onclick="shareTo(' + jsq(text) + ')">' + ic('chat', 22, 2.4) + '用 LINE／訊息通知主管</button>' +
      '<button class="btn ghost" onclick="S.stack=[];go(\'home\',{},true);refreshMe()">' + ic('home', 20, 2.2) + '回首頁</button>');
  }).catch(function (e) {
    S.mErr = { t: '送審沒有成功', m: e.message };
    monthRender(); window.scrollTo(0, 0);
  });
}
function shareTo(text) {
  if (navigator.share) navigator.share({ text: text }).catch(function () {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('已複製，貼到 LINE 給主管', 'ok'); });
  else prompt('複製這段傳給主管：', text);
}

function doReview(action) {
  var cm = ($('cm') || {}).value || '';
  S.cm = cm;
  if (action === 'return' && !cm.trim()) { toast('退回請寫原因', 'err'); if ($('cm')) $('cm').focus(); return; }
  if (action === 'approve') {
    if (!S.me.signature) return go('sign');
    if (!confirm('核准 ' + S.view.dept + ' ' + ymLabel(S.view.period) + ' 的檢點紀錄？\n會帶入您的簽名並產生 PDF。')) return;
  }
  bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === 'approve' ? '簽名並產生 PDF 中，約 10～30 秒…' : '退回中…') + '</div>');
  api('review', { monthId: S.view.monthId, decision: action, comment: cm }, { noRetry: true }).then(function (r) {
    toast(action === 'approve' ? '已核准，PDF 已產生' : '已退回', 'ok', 3000);
    S.stack = []; S.cm = ''; go('home', {}, true); refreshMe();
  }).catch(function (e) { S.mErr = { t: action === 'approve' ? '核准沒有成功' : '退回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
}
function doEhs(action) {
  var why = '';
  if (action === 'return') { why = prompt('退回原因？'); if (!why) return; }
  else if (!confirm('確認歸檔？')) return;
  bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === 'approve' ? '歸檔中…' : '退回中…') + '</div>');
  api('ehsReview', { monthId: S.view.monthId, decision: action, comment: why }, { noRetry: true }).then(function () {
    toast(action === 'approve' ? '已歸檔' : '已退回', 'ok'); S.stack = []; go('home', {}, true); refreshMe();
  }).catch(function (e) { S.mErr = { t: action === 'approve' ? '歸檔沒有成功' : '退回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
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
  api('packages', {}).then(function (list) {
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
    var days = [0, 1, 2, 3, 4, 5, 6, 7].map(function (n) { var d = new Date(); d.setDate(d.getDate() + n); return ymd(d); });
    if (!S.arg.date) S.arg.date = t;
    h += '<div class="sec">哪一天要代填</div><div class="depts">' + days.map(function (d, i) {
      var on = S.arg.date === d, lab = i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '後天' : md(d) + '（' + wk(d) + '）';
      return '<button class="dept' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="S.arg.date=' + jsq(d) + ';render()">' + (on ? ic('check', 16, 3.2) : '') + esc(lab) + '</button>';
    }).join('') + '</div>';
  }
  if (L) {
    h += '<div class="card"><div class="mr"><b>' + esc(L.dept) + '　' + md(L.date) + ' 代填連結</b>' + pill('ok', 'check', '已產生') + '</div>' +
      '<div class="muted">只能在 ' + md(L.date) + '（' + wk(L.date) + '）當天使用，填那天的每日檢點表，23:59 失效。</div>' +
      '<input class="field" id="shareUrl" readonly value="' + esc(L.url) + '" onclick="this.select()"></div>';
  }
  h += '<div id="shareErr"></div>';
  $('app').innerHTML = h;
  if (L) bar('<button class="btn" onclick="shareTo(' + jsq('請幫忙填 ' + L.dept + ' ' + md(L.date) + '（' + wk(L.date) + '）的每日檢點表，那天打開這個連結就能填：' + L.url) + ')">' + ic('chat', 22, 2.4) + '用 LINE／訊息傳給同事</button>');
  else if (S.arg.dept) bar('<button class="btn" id="mkBtn" onclick="shareMake()">' + ic('ext', 22, 2.2) + '產生' + (S.arg.date === t ? '今天' : ' ' + md(S.arg.date) + ' ') + '的代填連結</button>');
};
function shareMake() {
  var btn = $('mkBtn'); btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>產生中…';
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
  S.hero = '<div class="hero-in"><div class="brand"><span class="logo">' + '<img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block">' + '</span>員和電子抄表</div>' +
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
  var a = A(S.arg.key), f = F(a.form), fm = S.fill;
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
  $('app').innerHTML = '<div class="card"><div class="kv"><div>姓名</div><div><b>' + esc(m.person.name) + '</b></div><div>身分</div><div>' + esc(m.person.role) +
    '</div><div>部門</div><div>' + esc(m.depts.map(function (d) { return d.id; }).join('、')) + '</div></div></div>' +
    '<div class="card"><div class="muted">我的簽名（送出時自動帶入）</div>' + (m.signature ? '<div class="sigimgs"><img src="' + esc(m.signature.image) + '" alt="橫式簽名"><img class="v" src="' + esc(m.signature.imageV) + '" alt="直式簽名"></div>' : '<div>尚未簽名</div>') +
    '<div><button class="btn ghost sm" onclick="go(\'sign\',{})">' + ic('pen', 18) + '重新簽名</button></div></div>' +
    '<div class="list">' +
    '<button class="li" onclick="go(\'remind\')">' + ic('bell', 22, 2.2) + '<span class="mn"><span class="nm">提醒設定</span></span><span class="chev">' + ic('right', 18) + '</span></button>' +
    '<button class="li" onclick="refreshMe().then(function(){toast(\'已更新\',\'ok\')})">' + ic('refresh', 22, 2.2) + '<span class="mn"><span class="nm">重新讀取設定</span><span class="mt">環安衛中心改了表單或指派後按這裡</span></span></button>' +
    '<button class="li" onclick="logout()" style="color:var(--ngT)">' + ic('logout', 22, 2.2) + '<span class="mn"><span class="nm">換人使用／登出這支手機</span><span class="mt">換別人抄表時用；手機裡沒上傳的檢點會先保留</span></span></button>' +
    '</div><div class="ver">v' + APP_VERSION + '</div>';
};
function logout() {
  if (!confirm('登出 ' + S.me.person.name + '？')) return;
  api('logout', {}, { quiet: true, noRetry: true }).catch(function () {});   // 讓伺服器端這支手機的登入作廢
  lsDel(LS.TOKEN); lsDel(LS.ME); S.me = null; S.boot = null; S.pkgs = null; S.stack = []; go('login', {}, true);
}

// ───────────── 啟動 ─────────────
window.addEventListener('online', function () { render(); if (!S.share) flush(); });
window.addEventListener('offline', function () { render(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !S.share) { flush(); refreshMe(); } });

(function init() {
  var sm = /[#&]share=([0-9a-fA-F]{64})/.exec(location.hash);
  if (sm) {                                     // 代填連結：不碰這支手機原本的登入、草稿、待上傳
    S.share = { token: sm[1], name: '' }; S.page = 'proxy';
    render();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {});
    return;
  }
  S.me = lsGet(LS.ME, null); if (S.me) S.me = normMe(S.me);
  var deep = new URLSearchParams(location.search).get('r');
  obRefresh().then(function () {
    render();                                   // 先用手機裡的資料畫出來，不等 Google
    flush();
    return refreshMe();
  }).then(function () {
    if (deep && S.me) {
      return api('packages', {}).then(function (list) {
        var p = list.filter(function (x) { return x.monthId === deep; })[0];
        if (p) go('month', { dept: p.dept, period: p.period });
      }).catch(function () {});
    }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
