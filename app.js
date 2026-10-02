/* 員和工業 現場作業檢點 PWA
 * 後端：Google Apps Script（as04293133，Code.gs）
 * 設計：第一次選部門＋選自己＋簽名一次，之後每天開 App 直接勾；送出先存手機再背景上傳；
 *       月底「本月完成送主管」→ 單位負責人手機審核簽名 → 產 PDF → 環安衛審核歸檔。
 */
'use strict';
var APP_VERSION = '0.3.0';
// 部署後把網址填在這裡，現場人員就不用自己設定；空白時第一次開會請使用者貼上
var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbxXn_HbSkWw8nWxfbTOgnzll6PjBqGGEbizxfgQvZSKLqVhGO8zQFJyBKdAacqiDT5-/exec';

var LS = { GAS: 'chk.gas', TOKEN: 'chk.token', ME: 'chk.me', REM: 'chk.remind', DRAFT: 'chk.draft' };
var S = { me: null, page: 'home', arg: {}, stack: [], outbox: [], flushing: false, boot: null, view: null, fill: null };

// ───────────── 小工具 ─────────────
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
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

var toastTimer = null;
function toast(msg, type, ms) {
  var old = document.querySelector('.toast'); if (old) old.remove();
  var d = document.createElement('div'); d.className = 'toast ' + (type || ''); d.innerHTML = msg;
  document.body.appendChild(d);
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { d.remove(); }, ms || 2600);
}

// ───────────── 後端 ─────────────
// Google 偶爾回 404 或冷啟動很慢：沒連上就重試（2／4／8 秒）；後端明確拒絕（業務錯誤）不重試。
function api(action, body, opt) {
  opt = opt || {};
  var url = gasUrl();
  if (!url) return Promise.reject(new Error('還沒設定系統網址'));
  var payload = JSON.stringify(Object.assign({ action: action, token: opt.token || lsGet(LS.TOKEN, '') }, body || {}));
  var waits = opt.noRetry ? [] : [2000, 4000, 8000];
  var i = 0;
  function once() {
    return fetch(url, { method: 'POST', redirect: 'follow', body: payload }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Google 暫時無法開啟'); }
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
  var sent = 0;
  return obAll().then(function (jobs) {
    var p = Promise.resolve(), stop = false;
    jobs.filter(function (j) { return j.status === 'pending'; }).forEach(function (j) {
      p = p.then(function () {
        if (stop) return;
        return api('submitCheck', Object.assign({ submitId: j.id }, j.body), { token: j.token, quiet: true }).then(function () {
          sent++; return obDel(j.id);
        }).catch(function (e) {
          j.tries = (j.tries || 0) + 1; j.message = e.message;
          if (e.biz) { j.status = 'error'; return obPut(j); }
          stop = true; clearTimeout(flushTimer); flushTimer = setTimeout(flush, 60000);
          return obPut(j);
        });
      });
    });
    return p;
  }).then(function () {
    S.flushing = false;
    if (sent) { toast('✓ 已上傳 ' + sent + ' 筆檢點', 'ok'); refreshMe(); }
    return obRefresh();
  }).then(function () { if (S.page === 'home') render(); })
    .catch(function () { S.flushing = false; });
}

function outboxBlock() {
  var a = S.outbox || []; if (!a.length) return '';
  var pend = a.filter(function (j) { return j.status === 'pending'; });
  var h = '';
  if (pend.length) {
    h += '<div class="alert blue"><b>📤 待上傳 ' + pend.length + ' 筆</b>　' +
      (S.flushing ? '上傳中…' : (pend.some(function (j) { return j.message; }) ? '沒連上，會自動再試' : '背景上傳中')) +
      '　<u onclick="flush()">立即重試</u></div>';
  }
  a.filter(function (j) { return j.status !== 'pending'; }).forEach(function (j) {
    h += '<div class="alert red"><b>⚠ ' + esc(j.label) + ' 沒有上傳成功</b><div>' + esc(j.message) + '</div>' +
      '<div style="margin-top:6px"><u onclick="obRetry(\'' + j.id + '\')">重試</u>　<u onclick="obDrop(\'' + j.id + '\')">刪除這筆</u></div></div>';
  });
  return h;
}
function obRetry(id) { obAll().then(function (a) { var j = a.filter(function (x) { return x.id === id; })[0]; if (!j) return; j.status = 'pending'; return obPut(j); }).then(obRefresh).then(function () { render(); flush(); }); }
function obDrop(id) { if (!confirm('刪除這筆檢點？刪了手機上就沒有這筆資料了。')) return; obDel(id).then(obRefresh).then(render); }

// ───────────── 資料 ─────────────
function normMe(m) {
  m.assigns = []; m.months = [];
  m.person.depts = m.depts.map(function (d) { return { id: d.id, name: d.id }; });
  m.depts.forEach(function (d) {
    d.daily.forEach(function (x) {
      m.assigns.push({ key: d.id + '|' + x.form + '||', dept: d.id, form: x.form, object: '', kind: '', freq: '作業日', daily: true,
        due: { todayDone: x.state === 'done' || x.state === 'nowork', todayNoWork: x.state === 'nowork', state: x.state } });
    });
    d.pick.forEach(function (x) {
      if (x.missingEquip) { m.assigns.push({ key: d.id + '|' + x.form + '|?|', dept: d.id, form: x.form, object: '', kind: '', missingEquip: x.missingEquip, freq: '' }); return; }
      m.assigns.push({ key: [d.id, x.form, x.object, x.kind].join('|'), dept: d.id, form: x.form, object: x.object, objectName: x.objectName,
        kind: x.kind, freq: x.freq, pick: true, warnDays: 30, due: { last: x.last, due: x.due, state: x.state } });
    });
    d.months.forEach(function (x) { m.months.push({ dept: d.id, period: x.period, status: x.status, reason: x.reason, sheetUrl: d.sheetUrl }); });
  });
  return m;
}
function refreshMe() {
  if (!lsGet(LS.TOKEN, '')) return Promise.resolve();
  return api('me', {}, { quiet: true }).then(function (m) {
    S.me = normMe(m); lsSet(LS.ME, m);
    if (S.page === 'home' || S.page === 'settings' || S.page === 'pick') render();
  }).catch(function (e) {
    if (e.biz && /失效|名單|選擇您的身分/.test(e.message)) { lsDel(LS.TOKEN); lsDel(LS.ME); S.me = null; go('login', {}, true); }
  });
}
function A(key) { return (S.me.assigns || []).filter(function (a) { return a.key === key; })[0]; }
function F(id) { return S.me.forms[id]; }
function aTitle(a) { var f = F(a.form); return f.name + (a.object ? '｜' + a.object : '') + (a.kind ? '｜' + a.kind : ''); }
function isMgr() { return S.me && S.me.person.role === '單位負責人'; }
function mgrOf(dept) { var d = (S.me.depts || []).filter(function (x) { return x.id === dept; })[0]; return d && d.mgr; }
function isEhs() { return S.me && S.me.person.role === '環安衛'; }
function pendingFor(a, date) {
  return (S.outbox || []).some(function (j) { return j.status === 'pending' && j.key === a.key && j.body.date === date; });
}

// ───────────── 導覽 ─────────────
function go(page, arg, replace) {
  if (!replace && S.page !== page) S.stack.push({ page: S.page, arg: S.arg });
  S.page = page; S.arg = arg || {};
  window.scrollTo(0, 0);
  render();
}
function back() { var p = S.stack.pop() || { page: 'home', arg: {} }; S.page = p.page; S.arg = p.arg; render(); }

function render() {
  var p = S.page;
  if (!gasUrl()) p = 'url';
  else if (!lsGet(LS.TOKEN, '') && p !== 'login') p = 'login';
  else if (p !== 'login' && p !== 'sign' && S.me && !(S.me.signature && S.me.signature.imageV)) { p = 'sign'; if (S.page !== 'sign') { S.page = 'sign'; S.arg = {}; } }
  var fn = PAGES[p] || PAGES.home;
  $('bar').innerHTML = '';
  $('back').style.visibility = (S.stack.length && ['home', 'login', 'url'].indexOf(p) < 0) ? 'visible' : 'hidden';
  $('who').innerHTML = S.me ? esc(S.me.person.name) + '<br>' + esc(S.me.depts.map(function (d) { return d.id; }).join('、')) : '';
  $('net').className = 'dot' + (navigator.onLine ? '' : ' off');
  fn();
}
function setTitle(t) { $('ttl').textContent = t; }
function bar(html) { $('bar').innerHTML = '<div class="bar"><div class="in">' + html + '</div></div>'; }

var PAGES = {};

// ───────────── 設定網址 ─────────────
PAGES.url = function () {
  setTitle('作業檢點｜設定');
  $('app').innerHTML = '<div class="card"><b>第一次使用</b><p class="muted">請貼上環安衛中心提供的系統網址（結尾是 /exec）。</p>' +
    '<input id="u" class="field" placeholder="https://script.google.com/macros/s/…/exec"></div>';
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
  var b = S.boot;
  if (!b) {
    $('app').innerHTML = '<div class="center muted" style="margin-top:40px">讀取名單中…</div>';
    api('bootstrap').then(function (d) { S.boot = d; render(); })
      .catch(function (e) { $('app').innerHTML = '<div class="alert red">讀不到名單：' + esc(e.message) + '</div><button class="btn" onclick="render()">再試一次</button>'; });
    return;
  }
  var a = S.arg;
  var h = '<div class="h">1. 您的部門</div><div class="chips">' + b.depts.map(function (d, i) {
    return '<button class="chip' + (a.dept === d ? ' on' : '') + '" onclick="S.arg={dept:S.boot.depts[' + i + ']};render()">' + esc(d) + '</button>';
  }).join('') + '</div>';
  var ps = a.dept ? (b.people[a.dept] || []) : [];
  if (a.dept) {
    h += '<div class="h">2. 您是</div>' + (ps.length ? ps.map(function (p, i) {
      return '<button class="row" onclick="S.arg.i=' + i + ';render()"><div class="main"><div class="name">' + esc(p.name) + '</div><div class="meta">' + esc(p.role) + '</div></div>' +
        (a.i === i ? '<span class="pill p-ok">✓</span>' : '') + '</button>';
    }).join('') : '<div class="muted">這個部門的名單還沒建立，請洽環安衛中心。</div>');
  }
  var sel = a.i != null ? ps[a.i] : null;
  if (sel && sel.needPin) h += '<div class="h">3. 啟用碼</div><input id="pin" class="field" inputmode="numeric" placeholder="環安衛中心給您的啟用碼">';
  $('app').innerHTML = h;
  if (sel) bar('<button class="btn" id="bindBtn" onclick="doBind()">確認，我是 ' + esc(sel.name) + '</button>');
};
function doBind() {
  var btn = $('bindBtn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 登入中…';
  var sel = S.boot.people[S.arg.dept][S.arg.i];
  var pin = $('pin') ? $('pin').value.trim() : '';
  api('bind', { name: sel.name, pin: pin, device: navigator.userAgent.slice(0, 80) }).then(function (d) {
    lsSet(LS.TOKEN, d.token); lsSet(LS.ME, d.me); S.me = normMe(d.me); S.stack = [];
    go(d.me.signature ? 'home' : 'sign', {}, true);
    toast('歡迎，' + esc(d.me.person.name), 'ok');
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); btn.disabled = false; btn.textContent = '再試一次'; });
}
// ───────────── 簽名（簽一次，之後自動帶入）─────────────
PAGES.sign = function () {
  setTitle('我的簽名');
  var v = S.arg.step === 'v';
  var has = S.me && S.me.signature;
  $('app').innerHTML = '<div class="card"><b>' + (v ? '2／2　直式簽名' : '1／2　橫式簽名') + '</b>' +
    '<p class="muted" style="margin:4px 0 10px">' + (v
      ? '每日檢點表的「檢查人員簽章」在每天那一格，很窄，請在下面直的框裡<b>由上往下</b>簽全名。'
      : '用在定期檢查表與送審。請用手指簽全名。') + '簽一次存在系統，之後每次送出自動帶入，不用每天簽。</p>' +
    '<canvas id="cv" class="sigbox" style="' + (v ? 'width:120px;height:360px;margin:0 auto' : '') + '"></canvas>' +
    '<div style="text-align:right;margin-top:6px"><u class="muted" onclick="sigClear()">清除重簽</u></div></div>' +
    (has ? '<div class="card"><div class="muted">目前的簽名</div><div style="display:flex;gap:16px;align-items:center"><img class="sigimg" src="' + has.image + '">' +
      (has.imageV ? '<img src="' + has.imageV + '" style="max-height:110px">' : '') + '</div></div>' : '');
  bar('<button class="btn" id="sigBtn" onclick="sigNext()">' + (v ? '儲存兩個簽名' : '下一步：簽直式') + '</button>');
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
  if (S.arg.step !== 'v') { SIG.h = img; S.arg = { step: 'v' }; return render(); }
  var btn = $('sigBtn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 儲存中…';
  api('saveSignature', { image: SIG.h, imageV: img }).then(function (r) {
    S.me.signature = { id: r.id, image: SIG.h, imageV: img };
    var raw = lsGet(LS.ME, null); if (raw) { raw.signature = S.me.signature; lsSet(LS.ME, raw); }
    toast('✓ 簽名已存', 'ok'); S.stack = []; go('home', {}, true);
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); btn.disabled = false; btn.textContent = '再試一次'; });
}
// ───────────── 首頁 ─────────────
function duePill(a) {
  var d = a.due || {};
  if (a.daily) {
    if (pendingFor(a, today())) return '<span class="pill p-warn">待上傳</span>';
    if (d.todayNoWork) return '<span class="pill p-na">今日無作業</span>';
    return d.todayDone ? '<span class="pill p-ok">✓ 已檢點</span>' : '<span class="pill p-warn">今天未檢點</span>';
  }
  return { never: '<span class="pill p-na">尚無紀錄</span>', overdue: '<span class="pill p-ng">已到期</span>',
           soon: '<span class="pill p-warn">快到期</span>', ok: '<span class="pill p-ok">✓</span>' }[d.state] || '';
}
function dueMeta(a) {
  var d = a.due || {};
  return (a.freq || '') + (d.last ? '｜上次 ' + d.last + (d.due ? '｜下次 ' + d.due : '') : '｜還沒有紀錄');
}
PAGES.home = function () {
  setTitle('作業檢點');
  var m = S.me;
  if (!m) { $('app').innerHTML = '<div class="center muted" style="margin-top:40px">載入中…</div>'; return; }
  var h = outboxBlock(), t = today();
  m.months.forEach(function (x) {
    if (x.status === '退回') h += '<div class="alert red"><b>' + esc(x.dept) + ' ' + ymLabel(x.period) + ' 被退回</b><div>' + esc(x.reason) + '</div>' +
      '<u onclick="go(\'month\',{dept:\'' + esc(x.dept) + '\',period:\'' + x.period + '\'})">去修正並重新送出</u></div>';
    else if (x.period < t.slice(0, 7) && x.status === '填寫中' && !isEhs()) h += '<div class="alert"><b>' + esc(x.dept) + ' ' + ymLabel(x.period) + ' 還沒鎖定送審</b>　' +
      '<u onclick="go(\'month\',{dept:\'' + esc(x.dept) + '\',period:\'' + x.period + '\'})">查看並送出</u></div>';
  });
  if (m.pendingReview) {
    h += '<button class="row" style="background:#173F6B;color:#fff" onclick="go(\'packages\')"><div class="main"><div class="name">📋 待您審核 ' + m.pendingReview + ' 份</div>' +
      '<div class="meta" style="color:#C9D8EA">' + (isEhs() ? '單位負責人已簽，請看 PDF 後歸檔' : '檢點人員已鎖定送審') + '</div></div><span>›</span></button>';
  }
  if (!isEhs()) {
    m.depts.forEach(function (d) {
      var daily = m.assigns.filter(function (a) { return a.dept === d.id && a.daily; });
      var picks = m.assigns.filter(function (a) { return a.dept === d.id && (a.pick || a.missingEquip); });
      h += '<div class="h">' + esc(d.id) + '｜今天 ' + md(t) + '（' + wk(t) + '）</div>';
      daily.forEach(function (a) {
        h += '<button class="row" onclick="openFill(\'' + esc(a.key) + '\')"><div class="main"><div class="name">' + esc(F(a.form).name) + '</div></div>' + duePill(a) + '</button>';
      });
      if (picks.length) {
        var warn = picks.filter(function (a) { return a.due && (a.due.state === 'overdue' || a.due.state === 'soon'); }).length;
        h += '<button class="row" onclick="go(\'pick\',{dept:\'' + esc(d.id) + '\'})"><div class="main"><div class="name">＋ 其他檢查表（自選）</div>' +
          '<div class="meta">定期檢查、堆高機、烘箱…需要時自己選來填</div></div>' + (warn ? '<span class="pill p-warn">' + warn + ' 張快到期</span>' : '<span>›</span>') + '</button>';
      }
    });
  }
  h += '<div class="h">月結</div>';
  m.months.filter(function (x) { return x.period === t.slice(0, 7) || x.status !== '已歸檔'; }).forEach(function (x) {
    h += '<button class="row" onclick="go(\'month\',{dept:\'' + esc(x.dept) + '\',period:\'' + x.period + '\'})"><div class="main"><div class="name">' +
      esc(x.dept) + '　' + ymLabel(x.period) + '</div><div class="meta">' + (x.status === '填寫中' ? '查看本月紀錄、鎖定送審' : '查看') + '</div></div>' + statusPill(x.status) + '</button>';
  });
  h += '<div class="btns" style="margin-top:14px"><button class="btn ghost" onclick="go(\'remind\')">🔔 提醒設定</button><button class="btn ghost" onclick="go(\'settings\')">⚙ 設定</button></div>' +
    '<div class="center muted" style="margin-top:16px">v' + APP_VERSION + '</div>';
  $('app').innerHTML = h;
};

PAGES.pick = function () {
  setTitle('其他檢查表');
  var dept = S.arg.dept;
  var list = S.me.assigns.filter(function (a) { return a.dept === dept && (a.pick || a.missingEquip); });
  var h = '<div class="alert blue">需要做的時候從這裡選一張來填。快到期的會標出來。</div>', last = null;
  list.forEach(function (a) {
    var f = F(a.form);
    if (a.form !== last) { last = a.form; h += '<div class="h">' + esc(f.name) + '</div>'; }
    if (a.missingEquip) { h += '<div class="muted" style="margin:0 4px 8px">後台還沒建立這個部門的' + esc(a.missingEquip) + '編號，請洽環安衛中心。</div>'; return; }
    h += '<button class="row" onclick="openFill(\'' + esc(a.key) + '\')"><div class="main"><div class="name">' +
      esc([a.object ? a.object + (a.objectName ? ' ' + a.objectName : '') : '', a.kind].filter(String).join('｜') || f.name) + '</div>' +
      '<div class="meta">' + esc(dueMeta(a)) + '</div></div>' + duePill(a) + '</button>';
  });
  $('app').innerHTML = h;
};
function deptOf(id) { return id; }
function statusPill(s) {
  var c = { '填寫中': 'p-na', '待主管審核': 'p-warn', '待環安衛審核': 'p-warn', '已歸檔': 'p-ok', '退回': 'p-ng' }[s] || 'p-na';
  return '<span class="pill ' + c + '">' + esc(s) + '</span>';
}

// ───────────── 填寫 ─────────────
function openFill(key, date) {
  var a = A(key); if (!a) return;
  var d = date || today();
  S.fill = lsGet(LS.DRAFT, {})[key + '@' + d] || { key: key, date: d, r: {}, n: {}, x: {}, noWork: false };
  go('fill', { key: key });
  loadDay();
}
function loadDay() {
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
  var f = S.fill; if (!f) return;
  var all = lsGet(LS.DRAFT, {}); all[f.key + '@' + f.date] = f; lsSet(LS.DRAFT, all);
}
function draftDrop(f) { var all = lsGet(LS.DRAFT, {}); delete all[f.key + '@' + f.date]; lsSet(LS.DRAFT, all); }

function optClass(k) { return { ok: 'ok', ng: 'ng', danger: 'ng', care: 'warn', risk: 'warn', na: 'na' }[k] || 'ok'; }

PAGES.fill = function () {
  var a = A(S.arg.key); var fm = S.fill;
  if (!a || !fm) return back();
  var f = F(a.form);
  setTitle(f.name);
  var t = today(), minD = (function () { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ymd(d); })();
  var h = '<div class="card"><div class="name" style="font-weight:700">' + esc(f.name) + '</div>' +
    '<div class="muted">' + esc(deptOf(a.dept)) + (a.object ? '｜' + esc(a.object) : '') + (a.kind ? '｜' + esc(a.kind) : '') + '</div>' +
    '<label class="lb">檢查日期</label>' +
    '<input type="date" class="field" id="dt" value="' + fm.date + '" max="' + t + '" min="' + minD + '" onchange="fillDate(this.value)"></div>';
  if (a.daily) {
    h += '<div class="btns" style="margin-bottom:12px"><button class="btn ghost" onclick="allOk()">✓ 全部正常</button>' +
      '<button class="btn ghost" onclick="noWork()">' + (fm.noWork ? '↺ 取消無作業' : '今日無作業') + '</button></div>';
  } else {
    h += '<button class="btn ghost" style="margin-bottom:12px" onclick="allOk()">✓ 全部正常</button>';
  }
  if (fm.noWork) {
    h += '<div class="alert">這一天記為「無作業」，表上留空白。</div>';
  } else {
    var g = null;
    f.items.forEach(function (it) {
      if (it.group && it.group !== g) { g = it.group; h += '<div class="grp">' + esc(g) + '</div>'; }
      var opts = it.opts || f.opts, v = fm.r[it.seq], needNote = v && f.noteFor.indexOf(v) >= 0;
      h += '<div class="item" id="it' + esc(it.seq) + '"><div class="q">' + esc(it.seq) + '. ' + esc(it.text) + (it.method ? ' <small>（' + esc(it.method) + '）</small>' : '') + '</div><div class="opts">' +
        opts.map(function (o) {
          return '<button class="opt ' + optClass(o.k) + (v === o.k ? ' on' : '') + '" onclick="pick(\'' + esc(it.seq) + '\',\'' + o.k + '\')">' + esc(o.label) + '</button>';
        }).join('') + '</div>' +
        (needNote || (fm.n[it.seq] && f.type === '單張') ? '<textarea class="note' + (needNote ? '' : ' plain') + '" placeholder="' + esc(f.noteTitle || '請說明異常狀況與處理方式') + '" oninput="S.fill.n[\'' + esc(it.seq) + '\']=this.value;draftSave()">' + esc(fm.n[it.seq] || '') + '</textarea>' : '') +
        '</div>';
    });
    (f.extra || []).forEach(function (x, i) {
      h += '<div class="item"><div class="q">' + esc(x) + '</div><textarea class="note plain" oninput="S.fill.x[' + i + ']=this.value;draftSave()">' + esc(fm.x[i] || '') + '</textarea></div>';
    });
  }
  var done = fm.noWork || f.items.every(function (it) { return fm.r[it.seq]; });
  var cnt = f.items.filter(function (it) { return fm.r[it.seq]; }).length;
  h += '<div class="card"><div class="muted">送出時會自動帶入您的簽名</div><img class="sigimg" src="' + S.me.signature.image + '"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" ' + (done ? '' : 'disabled') + ' onclick="submitFill()">' + (done ? '送出' : '已勾 ' + cnt + ' / ' + f.items.length + ' 項') + '</button>');
};
function fillDate(v) {
  var t = today();
  if (!v || v > t) { toast('不能選未來的日期', 'err'); return render(); }
  S.fill = lsGet(LS.DRAFT, {})[S.fill.key + '@' + v] || { key: S.fill.key, date: v, r: {}, n: {}, x: {}, noWork: false };
  render(); loadDay();
}
function pick(seq, k) { S.fill.r[seq] = k; S.fill.noWork = false; draftSave(); var y = window.scrollY; render(); window.scrollTo(0, y); }
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
      if (!v) return toast('第 ' + it.seq + ' 項還沒勾', 'err');
      if (f.noteFor.indexOf(v) >= 0 && !String(fm.n[it.seq] || '').trim()) {
        var el = $('it' + it.seq); if (el) el.scrollIntoView({ block: 'center' });
        return toast('第 ' + it.seq + ' 項請寫說明', 'err');
      }
    }
  }
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
    render(); toast('✓ 已存在手機，背景上傳中', 'ok'); flush();
  }).catch(function (e) { toast('手機存檔失敗：' + esc(e.message), 'err', 5000); });
}

// ───────────── 月份檢視／送出／審核 ─────────────
PAGES.month = function () {
  var a = S.arg;
  setTitle(deptOf(a.dept) + ' ' + ymLabel(a.period));
  $('app').innerHTML = '<div class="center muted" style="margin-top:40px">讀取中…</div>';
  api('monthView', { deptId: a.dept, period: a.period }).then(function (v) {
    if (S.page !== 'month' || S.arg !== a) return;
    S.view = v; monthRender();
  }).catch(function (e) { $('app').innerHTML = '<div class="alert red">' + esc(e.message) + '</div><button class="btn" onclick="render()">再試一次</button>'; });
};

function monthRender() {
  var v = S.view, forms = S.me.forms, mm = v.model, boss = mgrOf(v.dept);
  var h = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(v.dept) + '　' + ymLabel(v.period) + '</b>' + statusPill(v.status) + '</div>' +
    (v.status === '退回' ? '<div class="alert red" style="margin:10px 0 0">退回原因：' + esc(v.reason) + '</div>' : '') +
    (v.sheetUrl ? '<div style="margin-top:8px"><a href="' + esc(v.sheetUrl) + '" target="_blank" style="color:var(--blue)">📝 在 Google 試算表檢視／編輯</a></div>' : '') + '</div>';
  var pend = (S.outbox || []).filter(function (j) { return j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period; });
  if (pend.length) h += '<div class="alert blue">手機裡還有 ' + pend.length + ' 筆這個月的檢點沒上傳完，上傳完才會出現在下面。</div>';
  if ((v.status === '填寫中' || v.status === '退回') && v.problems.length) {
    h += '<div class="alert"><b>鎖定送審前要補的地方（' + v.problems.length + '）</b><div style="font-size:13px;margin-top:4px">' + v.problems.slice(0, 20).map(esc).join('<br>') + (v.problems.length > 20 ? '<br>…' : '') + '</div></div>';
  }
  mm.daily.forEach(function (x) {
    var f = forms[x.form]; if (!f) return;
    var days = Object.keys(x.days).map(function (d) { return x.days[d]; });
    var bad = days.reduce(function (s, d) { return s + Object.keys(d.results).filter(function (k) { return f.noteFor.indexOf(d.results[k]) >= 0; }).length; }, 0);
    var late = boss ? Object.keys((mm.late || {})[x.form] || {}).length : 0;
    h += '<div class="h">' + esc(x.name) + '</div><div class="muted" style="margin:0 4px 6px">檢點 ' + days.filter(function (d) { return !d.noWork; }).length + ' 天・無作業 ' +
      days.filter(function (d) { return d.noWork; }).length + ' 天' + (late ? '・<b style="color:var(--warn)">補登 ' + late + ' 天</b>' : '') +
      (bad ? '・<b style="color:var(--ng)">異常 ' + bad + ' 項次</b>' : '') + '</div>' + gridHtml(f, x, v.period, boss ? (mm.late || {})[x.form] : null);
  });
  if (mm.periodic.length) h += '<div class="h">定期檢查（本月）</div>';
  mm.periodic.forEach(function (x) { h += sheetHtml(forms[x.form], x); });
  if (!mm.daily.length && !mm.periodic.length) h += '<div class="muted">這個月沒有資料。</div>';
  $('app').innerHTML = h;

  if ((v.status === '填寫中' || v.status === '退回') && !isEhs()) {
    bar('<button class="btn" ' + (v.problems.length ? 'disabled' : '') + ' onclick="submitMonth()">' + (v.problems.length ? '還有 ' + v.problems.length + ' 個地方要補' : '本月完成，鎖定送單位負責人') + '</button>');
  } else if (v.status === '待主管審核' && boss && !isEhs()) {
    bar('<textarea id="cm" class="note plain" style="margin:0 0 8px" placeholder="意見（退回時必填）"></textarea>' +
      '<div class="btns"><button class="btn red" onclick="doReview(\'return\')">退回</button><button class="btn" onclick="doReview(\'approve\')">核准並簽名</button></div>');
  } else if (v.status === '待環安衛審核' && isEhs()) {
    bar('<button class="btn ghost" style="margin-bottom:8px" onclick="openPdf(\'' + v.monthId + '\')">📄 開啟 PDF</button>' +
      '<div class="btns"><button class="btn red" onclick="doEhs(\'return\')">退回</button><button class="btn" onclick="doEhs(\'approve\')">核准歸檔</button></div>');
  } else if (v.status === '已歸檔' || v.status === '待環安衛審核') {
    bar('<button class="btn ghost" onclick="openPdf(\'' + v.monthId + '\')">📄 開啟 PDF</button>');
  }
}
function markOf(f, seq, k) {
  var it = f.items.filter(function (x) { return x.seq === seq; })[0];
  var o = ((it && it.opts) || f.opts).filter(function (x) { return x.k === k; })[0];
  return o ? o.mark : '';
}
function gridHtml(f, x, period, late) {
  var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), days = new Date(y, mo, 0).getDate();
  var by = x.days;
  var h = '<div class="grid"><table><tr><th>項目</th>';
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
  for (var d2 = 1; d2 <= days; d2++) { var r2 = by[d2]; h += '<td style="font-size:10px">' + (r2 ? (r2.noWork ? '無' : esc((r2.signer || '?').slice(-2))) : '') + '</td>'; }
  h += '</tr></table></div>';
  var notes = [];
  Object.keys(by).forEach(function (d) { var n = by[d].notes || {}; Object.keys(n).forEach(function (k) { notes.push(mo + '/' + d + (k === '*' ? '' : ' 第' + k + '項') + '：' + n[k]); }); });
  if (late) Object.keys(late).forEach(function (d) { notes.push(mo + '/' + d + ' 補登（' + late[d].slice(5, 16) + ' 登錄，只有主管與環安衛看得到）'); });
  if (notes.length) h += '<div class="alert" style="font-size:13px">' + notes.map(esc).join('<br>') + '</div>';
  return h;
}
function sheetHtml(f, r) {
  var h = '<div class="card"><b>' + esc(r.name) + '</b><div class="muted">' + esc([r.object, r.kind, r.date, r.signer].filter(String).join('｜')) + '</div>';
  r.items.forEach(function (it) {
    var k = r.results[it.seq], bad = k && f && (f.noteFor.indexOf(k) >= 0 || k === '?');
    h += '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><div style="flex:1;font-size:14px">' + esc(it.text) +
      (it.note ? '<div style="color:var(--ng);font-size:13px">' + esc(it.note) + '</div>' : '') + '</div>' +
      '<span class="pill ' + (bad ? 'p-ng' : 'p-ok') + '">' + esc(it.result || '未填') + '</span></div>';
  });
  r.extra.forEach(function (e) { h += '<div style="font-size:13px;margin-top:6px"><b>' + esc(e.k) + '</b>：' + esc(e.v) + '</div>'; });
  return h + '</div>';
}
function submitMonth() {
  var v = S.view;
  var pend = (S.outbox || []).filter(function (j) { return j.status === 'pending' && j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period; });
  if (pend.length) return toast('手機裡還有 ' + pend.length + ' 筆沒上傳完，請等上傳完再送', 'err', 4000);
  if (!confirm('鎖定 ' + v.dept + ' ' + ymLabel(v.period) + ' 並送單位負責人審核？\n\n送出後 App 和試算表這個月都不能再改，除非被退回。')) return;
  api('submitMonth', { deptId: v.dept, period: v.period }).then(function (r) {
    toast('✓ 已鎖定送審', 'ok');
    var link = location.origin + location.pathname + '?r=' + r.monthId;
    var text = v.dept + ' ' + ymLabel(v.period) + ' 作業檢點已完成，請審核簽名：' + link;
    $('app').innerHTML = '<div class="card center"><div class="big">✓</div><b>已送給單位負責人</b><p class="muted">單位負責人打開檢點系統就會看到。也可以順手傳個訊息提醒他。</p></div>';
    bar('<button class="btn" onclick="shareTo(' + JSON.stringify(text).replace(/"/g, '&quot;') + ')">💬 用 LINE／訊息通知主管</button>' +
      '<button class="btn ghost" style="margin-top:8px" onclick="S.stack=[];go(\'home\',{},true);refreshMe()">回首頁</button>');
  }).catch(function (e) { alert(e.message); });
}
function shareTo(text) {
  if (navigator.share) navigator.share({ text: text }).catch(function () {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('已複製，貼到 LINE 給主管', 'ok'); });
  else prompt('複製這段傳給主管：', text);
}

function doReview(action) {
  var cm = ($('cm') || {}).value || '';
  if (action === 'return' && !cm.trim()) return toast('退回請寫原因', 'err');
  if (action === 'approve') {
    if (!S.me.signature) return go('sign');
    if (!confirm('核准 ' + S.view.dept + ' ' + ymLabel(S.view.period) + ' 的檢點紀錄？\n會帶入您的簽名並產生 PDF。')) return;
  }
  bar('<div class="center muted"><span class="spin" style="border-color:#ccc;border-top-color:#2F5D8C"></span> ' + (action === 'approve' ? '簽名並產生 PDF 中，約 10～30 秒…' : '退回中…') + '</div>');
  api('review', { monthId: S.view.monthId, decision: action, comment: cm }, { noRetry: true }).then(function (r) {
    toast(action === 'approve' ? '✓ 已核准，PDF 已產生' : '已退回', 'ok', 3000);
    S.stack = []; go('home', {}, true); refreshMe();
  }).catch(function (e) { toast(esc(e.message), 'err', 5000); monthRender(); });
}
function doEhs(action) {
  var why = '';
  if (action === 'return') { why = prompt('退回原因？'); if (!why) return; }
  else if (!confirm('確認歸檔？')) return;
  api('ehsReview', { monthId: S.view.monthId, decision: action, comment: why }, { noRetry: true }).then(function () {
    toast(action === 'approve' ? '✓ 已歸檔' : '已退回', 'ok'); S.stack = []; go('home', {}, true); refreshMe();
  }).catch(function (e) { toast(esc(e.message), 'err', 5000); });
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
  $('app').innerHTML = '<div class="center muted" style="margin-top:40px">讀取中…</div>';
  api('packages', {}).then(function (list) {
    var want = isEhs() ? '待環安衛審核' : '待主管審核';
    var mine = list.filter(function (x) { return x.status === want; });
    var rest = list.filter(function (x) { return x.status !== want; }).slice(0, 12);
    var row = function (x) {
      return '<button class="row" onclick="go(\'month\',{dept:\'' + x.dept + '\',period:\'' + x.period + '\'})"><div class="main"><div class="name">' +
        esc(x.dept) + '　' + ymLabel(x.period) + '</div><div class="meta">' + esc(x.submitter) + ' 送出 ' + esc((x.submittedAt || '').slice(5, 16)) + '</div></div>' + statusPill(x.status) + '</button>';
    };
    $('app').innerHTML = '<div class="h">待您審核</div>' + (mine.length ? mine.map(row).join('') : '<div class="muted">目前沒有</div>') +
      (rest.length ? '<div class="h">最近</div>' + rest.map(row).join('') : '');
  }).catch(function (e) { $('app').innerHTML = '<div class="alert red">' + esc(e.message) + '</div>'; });
};

// ───────────── 提醒（加到手機行事曆，手機自己會跳通知）─────────────
function remDefault(a) {
  if (a.daily) return { on: false, time: '08:30', days: [1, 2, 3, 4, 5] };
  if (a.freq === '每月') return { on: false, time: '09:00', dom: 25 };
  return { on: false, time: '09:00', before: a.warnDays || 30 };
}
PAGES.remind = function () {
  setTitle('提醒設定');
  var R = lsGet(LS.REM, {});
  var list = (S.me.assigns || []).filter(function (a) { return !a.missingEquip; });
  var h = '<div class="alert blue">勾選要提醒的項目後按下方按鈕，會下載一個行事曆檔，用手機的「行事曆」開啟加入，時間到手機自己會跳通知（不用開著 App）。之後要改，先到行事曆刪掉舊的再重新加入。</div>';
  var row = function (key, title, freq, r) {
    var x = '<div class="item"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" ' + (r.on ? 'checked' : '') +
      ' onchange="remSet(\'' + key + '\',\'on\',this.checked)" style="width:22px;height:22px"><b style="flex:1">' + esc(title) + '</b></label>';
    if (r.on) {
      x += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">';
      if (freq === '作業日') {
        x += '每週 ' + [1, 2, 3, 4, 5, 6].map(function (d) {
          return '<button class="chip' + (r.days.indexOf(d) >= 0 ? ' on' : '') + '" style="padding:6px 10px" onclick="remDay(\'' + key + '\',' + d + ')">' + '一二三四五六'.charAt(d - 1) + '</button>';
        }).join('');
      } else if (freq === '每月' || freq === 'review' || freq === 'close') {
        x += '每月 <select class="field" style="width:auto" onchange="remSet(\'' + key + '\',\'dom\',Number(this.value))">' +
          [-1].concat(Array.from({ length: 28 }, function (_, i) { return i + 1; })).map(function (d) {
            return '<option value="' + d + '"' + (r.dom === d ? ' selected' : '') + '>' + (d === -1 ? '最後一天' : d + ' 日') + '</option>';
          }).join('') + '</select>';
      } else {
        x += '到期前 <input class="field" style="width:70px" type="number" value="' + r.before + '" onchange="remSet(\'' + key + '\',\'before\',Number(this.value))"> 天';
      }
      x += '　<input class="field" style="width:auto" type="time" value="' + r.time + '" onchange="remSet(\'' + key + '\',\'time\',this.value)"></div>';
    }
    return x + '</div>';
  };
  if (!isEhs()) list.forEach(function (a) { var r = Object.assign(remDefault(a), R[a.key] || {}); h += row(a.key, a.dept + '｜' + aTitle(a) + '（' + (a.daily ? '每個作業日' : a.freq) + '）', a.daily ? '作業日' : a.freq, r); });
  if (!isEhs() && !isMgr()) h += row('close', '月底送單位負責人', 'close', Object.assign({ on: false, time: '16:00', dom: -1 }, R.close || {}));
  if (isMgr() || isEhs()) h += row('review', '每月審核檢點紀錄', 'review', Object.assign({ on: false, time: '09:00', dom: isEhs() ? 8 : 3 }, R.review || {}));
  $('app').innerHTML = h;
  bar('<button class="btn" onclick="makeIcs()">📅 加到手機行事曆</button>');
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
  (S.me.assigns || []).filter(function (a) { return !a.missingEquip; }).forEach(function (a) {
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
    '<div class="card"><div class="muted">我的簽名（送出時自動帶入）</div>' + (m.signature ? '<div style="display:flex;gap:16px;align-items:center"><img class="sigimg" src="' + m.signature.image + '"><img src="' + m.signature.imageV + '" style="max-height:100px"></div>' : '<div>尚未簽名</div>') +
    '<button class="btn ghost small" onclick="go(\'sign\',{})">重新簽名</button></div>' +
    '<button class="row" onclick="go(\'remind\')"><div class="main"><div class="name">🔔 提醒設定</div></div><span>›</span></button>' +
    '<button class="row" onclick="refreshMe().then(function(){toast(\'已更新\',\'ok\')})"><div class="main"><div class="name">🔄 重新讀取設定</div><div class="meta">環安衛中心改了表單或指派後按這裡</div></div></button>' +
    '<button class="row" onclick="logout()"><div class="main"><div class="name" style="color:var(--ng)">換人使用／登出這支手機</div><div class="meta">換別人抄表時用；手機裡沒上傳的檢點會先保留</div></div></button>' +
    '<div class="center muted" style="margin-top:16px">v' + APP_VERSION + '</div>';
};
function logout() {
  if (!confirm('登出 ' + S.me.person.name + '？')) return;
  lsDel(LS.TOKEN); lsDel(LS.ME); S.me = null; S.boot = null; S.stack = []; go('login', {}, true);
}

// ───────────── 啟動 ─────────────
$('back').addEventListener('click', back);
window.addEventListener('online', function () { render(); flush(); });
window.addEventListener('offline', function () { render(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { flush(); refreshMe(); } });

(function init() {
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
