/* 員和工業 現場作業檢點 PWA
 * 後端：Google Apps Script（as04293133，Code.gs）
 * 設計：第一次選部門＋選自己＋簽名一次，之後每天開 App 直接勾；送出先存手機再背景上傳；
 *       月底「本月完成送主管」→ 單位負責人手機審核簽名 → 產 PDF → 環安衛審核歸檔。
 * v0.4.0：畫面全面改版（首頁依角色先列「要做的事」、填寫頁進度與跳題、月結月曆、錯誤停留畫面）；
 *         後端呼叫加 rid 比對。後端 API、手機存的資料名稱、送出流程、簽名邏輯都沒有改。
 */
'use strict';
var APP_VERSION = '0.26.1';
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
// ── 防呆（10/20 Jason：「技術員有時候能多笨」）：說明、改善、退回原因寫「無」「OK」「已處理」這種沒內容的，當場告訴他怎麼寫 ──
var TXT_NIL = /^(無|沒有|正常|無異常|沒異常|沒問題|良好|好|ok|okay|good|fine|可|可以|是|否|none|nil|na|n\/a)$/i;
var TXT_VAGUE = /^(同上|如上|同前|測試|test|已處理|處理|處理中|處理完成|已改善|改善|改善完成|已完成|完成|已修|已修好|修好了|已通報|通報|待處理|異常|不良|有問題|壞了|壞掉|故障|ng|x|v)$/i;
/** 回空字串＝可以；否則回一句給使用者看的說明。o.bad：這項選了異常（寫「正常」「沒問題」就是前後矛盾）；o.min：最少字數；o.want：看到的應該寫什麼 */
function txtWhy(s, o) {
  o = o || {};
  var t = String(s == null ? '' : s).replace(/[\s　.,，。、;；:：!！?？~～\-—_()（）\[\]【】「」'"`*#@\/\\|+=<>…·]/g, ''), min = o.min || 4;
  if (!t) return '還沒寫';
  if (o.bad && TXT_NIL.test(t)) return '選了異常，說明卻寫沒問題：有異常請寫狀況與處理；沒有異常請改勾正常';
  if (TXT_NIL.test(t) || TXT_VAGUE.test(t)) return o.want || '寫得太籠統：請寫出是什麼狀況、怎麼處理';
  if (/^[\d.]+$/.test(t)) return '只寫數字看不懂，請用文字說明';
  if (t.length < min) return '太短，請寫清楚（至少 ' + min + ' 個字）';
  var u = {}; for (var i = 0; i < t.length; i++) u[t.charAt(i)] = 1;
  if (Object.keys(u).length < Math.min(3 + Math.floor(t.length / 8), 8)) return '請寫具體內容，不要用重複的字湊字數';
  return '';
}
/** 姓名防呆：數字、兩個人寫在一格、「測試」→ 回說明；空字串＝可以 */
function nameWhy(s) {
  var t = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  if (t.replace(/\s/g, '').length < 2) return '請寫全名';
  if (/[0-9０-９]/.test(t)) return '姓名不能有數字';
  if (/[、,，;；\/／&＆+＋]/.test(t) || /[一-鿿]\s+[一-鿿]/.test(t)) return '一次只寫一個人的名字，每個人要各自簽';
  if (/^(測試|test|無|我|本人)$/i.test(t)) return '請寫您的真實全名';
  return '';
}
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
  var op = /^cons/.test(action) && RC_KEEP.indexOf(action) < 0 ? { op: (body && body.op) || newId() } : {};   // 承攬商送出：自動重送不會重複建立（後端以 op 去重）
  function once() {
    var rid = newId();
    var payload = JSON.stringify(Object.assign({ action: action, token: opt.token === '-' ? '' : (opt.token || lsGet(LS.TOKEN, '')) }, body || {}, op, { rid: rid, appVer: APP_VERSION }, devAs));
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
      if (i === 0 && !opt.quiet) toast(e.server ? '系統忙碌，自動重試中，請不要關閉畫面…' : '連線不穩，自動重試中…', '', e.server ? 4000 : 2000);
      var w = waits[i++];
      return new Promise(function (res) { setTimeout(res, w); }).then(once);
    });
  }
  return once();
}

// ───────────── 讀取暫存（v0.13.7）：看過的畫面先用手機裡的資料立刻畫出來，背景再跟 Google 對一次，有變才重畫 ─────────────
// 任何寫入成功後整個清掉；登入、登出、換人也清掉。開發者模式只放記憶體、不存手機。
var RC_ACT = ['monthView', 'packages', 'tracks', 'eduList', 'eduStats', 'team', 'nextList', 'envMe', 'envMonth', 'consCases', 'chemList', 'patrolInfo', 'bcPeople', 'bcList', 'exportOpts', 'supportMine'];
var RC_KEEP = RC_ACT.concat(['me', 'overview', 'bootstrap', 'ping', 'clientLog', 'photoGet', 'eduFile', 'getPdf', 'exportPdf', 'dayView', 'devLogs',
  'meetHome', 'meetState', 'meetDeck', 'meetList', 'meetPdf', 'meetChecks', 'meetOpen', 'meetPagesPub', 'consHome', 'consDetail', 'consVendors', 'consPubForm', 'consPubCase', 'consPubWorkerOpen', 'consPubHandlerOpen', 'consFile', 'consDemo', 'supportPic', 'supportAll', 'xeMine', 'xeAll', 'xeTicket']);   // 只讀的動作不清暫存
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
    // 10/19：「本月的試算表是改版前的項目」後端已修好（整月空白的區塊會換成本月版本）→ 之前卡住的自動再送一次（只一次）
    return Promise.all(jobs.filter(function (j) { return j.status !== 'pending' && j.status !== 'auth' && !j.requeued && /改版前的項目/.test(j.message || ''); })
      .map(function (j) { j.status = 'pending'; j.requeued = true; return obPut(j); })).then(function () { return jobs; });
  }).then(function (jobs) {
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
  if (S.cpub) { p = 'consPub'; S.page = p; }
  else if (S.meet) { p = 'meetJoin'; S.page = p; }
  else if (S.share) { if (['proxy', 'fill', 'psign'].indexOf(p) < 0) { p = 'proxy'; S.page = p; } }
  else if (!gasUrl()) p = 'url';
  else if (!lsGet(LS.TOKEN, '') && p !== 'login') p = 'login';
  else if (p !== 'login' && p !== 'sign' && S.me && !(S.me.signature && S.me.signature.imageV)) { p = 'sign'; if (S.page !== 'sign') { S.page = 'sign'; S.arg = {}; } }
  var fn = PAGES[p] || PAGES.home;
  if (window.trailPush) trailPush(p);
  S.cur = p; S.hero = null; S.topExtra = '';
  document.body.classList.toggle('wide', p === 'sheetFill');          // 電腦版表格填寫：版面放寬到整個螢幕
  $('bar').innerHTML = ''; padBar();
  fn();
  drawTop();
  if (window.drawSide) drawSide();                                   // 網頁版左側選單（plat.js）
  if (window.xeFab) xeFab();
  if (window.coachAfter) coachAfter();
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
function bar(html) { $('bar').innerHTML = html ? '<div class="bar"><div class="in">' + html + '</div></div>' : ''; padBar(); }   // 沒有按鈕就不留空白底條（10/19：蓋住頁面最下面的內容）
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
  // 10/20 Jason：承攬商登入跟環安衛登入放一起、同樣樣式
  S.hero = '<div class="hero-in"><div class="brand lg"><span class="logo">' + '<img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block">' + '</span>員和環安衛系統' +
    '<span class="lgbtns"><button class="spcbtn" onclick="S.arg=' + (S.arg && S.arg.spc ? '{}' : '{spc:true}') + ';render()">' + (S.arg && S.arg.spc ? '回同仁登入' : '環安衛登入') + '</button>' +
    '<button class="spcbtn vlog" onclick="S.cpub={kind:\'login\',f:{}};render()">承攬商登入</button></span></div>' +
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
    lsSet('chk.coach.menu', 'todo');                // 剛在這支手機登入：第一次進主選單給新手引導
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
  function end() { if (down && SIG.drawn && !document.querySelector('.coach.cbar')) coachSign(); down = false; }
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
    coachSign();
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
    if (!o) { box.innerHTML = '<div class="muted">這個簽名沒辦法自動轉成直式，請在下面的框裡<b>由上往下</b>簽。</div>'; return coachSign(); }
    SIG.vprev = o;
    box.innerHTML = '<div class="mr"><b>自動轉成的直式簽名</b></div>' +
      '<div class="muted">請確認<b>每個字都完整、上下順序正確</b>' + (exact ? '' : '（字有連在一起，系統是猜著切的，特別注意）') + '。</div>' +
      '<div class="vpv"><img alt="自動轉成的直式簽名" src="' + o.toDataURL('image/png') + '"></div>' +
      '<div class="btns r12"><button class="btn ghost" onclick="vpNo()">我自己簽</button><button class="btn" onclick="vpYes()">' + ic('check', 20, 2.8) + '用這個直式</button></div>';
    coachSign();
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
function sigClear() { var cv = $('cv'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); SIG.drawn = false; coachSign(); }
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

// ───────────── 新手引導（v0.14.2，10/16 Jason：第一次設定不知道要按哪裡）─────────────
// 下一步要按的地方：橘色閃框＋上方一條「↓ 點這裡」的提示；做完一步提示自動移到下一步。只在登入、簽名、第一次進主選單出現。
var COACH = { last: '' };
function coachClear() {
  [].forEach.call(document.querySelectorAll('.coach'), function (e) { e.remove(); });
  [].forEach.call(document.querySelectorAll('.coachOn'), function (e) { e.classList.remove('coachOn'); });
}
/** 在 el 前面插一條提示並讓 el 閃框；dir 'up' 時箭頭朝上（提示放在 el 後面）。換了新的一步才捲過去。 */
function coachAt(el, text, dir, key) {
  if (!el) return;
  var d = document.createElement('div');
  d.className = 'coach' + (dir === 'up' ? ' up' : '') + (dir === 'right' ? ' up rt' : '');
  d.setAttribute('role', 'status');
  d.innerHTML = '<svg class="ca" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    (dir ? '<path d="M12 20V5M5 11l7-7 7 7"/>' : '<path d="M12 4v15M5 13l7 7 7-7"/>') + '</svg><span>' + text + '</span>';
  el.classList.add('coachOn');
  if (dir) el.parentNode.insertBefore(d, el.nextSibling); else el.parentNode.insertBefore(d, el);
  if (key && key !== COACH.last) {
    COACH.last = key;
    setTimeout(function () { try { (dir ? el : d).scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 60);
  }
}
/** 下方固定列的按鈕：提示放在按鈕上面（同一列裡） */
function coachBar(id, text, key) {
  var b = $(id); if (!b) return;
  var wrap = b.closest('.in') || b.parentNode;
  var d = document.createElement('div'); d.className = 'coach cbar'; d.setAttribute('role', 'status');
  d.innerHTML = '<svg class="ca" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M5 13l7 7 7-7"/></svg><span>' + text + '</span>';
  wrap.insertBefore(d, wrap.firstChild);
  b.classList.add('coachOn');
  COACH.last = key || id;
  padBar();
}
/** 登入頁：部門 → 課別 → 名字 → 啟用碼 → 確認 */
function coachLogin() {
  if (S.cur !== 'login' || !S.boot) return;
  coachClear();
  var a = S.arg || {}, ps = S.loginPs || [];
  var sel = a.i != null ? ps[a.i] : null;
  if (!a.dept && !a.mgr) {
    var sub = document.querySelector('.dsub .depts');
    if (sub) return coachAt(sub, '再點您的課別（主管請點「單位負責人」）', '', 'grp');
    return coachAt(document.querySelector('.depts'), '第一步：點您的部門', '', 'dept');
  }
  if (!ps.length) return;
  if (!sel) return coachAt(document.querySelector('#app .list'), '點您的名字', '', 'name');
  var pin = $('pin');
  if (pin && !/^\d{4}$/.test(pin.value.trim())) {
    if (!pin.oninput) pin.oninput = function () { if (/^\d{4}$/.test(pin.value.trim()) || COACH.last === 'bind') coachLogin(); };
    return coachAt(pin, '輸入環安衛中心給您的 4 位數字', 'up', 'pin');
  }
  coachBar('bindBtn', '確認名字沒錯，按這裡完成', 'bind');
}
/** 簽名頁：簽名框 → 下一步／儲存；直式有自動轉的預覽時先指「用這個直式」 */
function coachSign() {
  if (S.cur !== 'sign') return;
  coachClear();
  var v = S.arg.step === 'v', yes = document.querySelector('#vprev .btn:not(.ghost)');
  if (v && yes && !SIG.drawn) return coachAt(yes.parentNode, '確認每個字都完整、順序對，按「用這個直式」', '', 'vyes');
  if (v && document.querySelector('#vprev .spin')) return;          // 自動轉換中，轉好再指
  if (!SIG.drawn) return coachAt(document.querySelector('.sigwrap'), v ? '在直的框裡由上往下簽全名' : '用手指在框裡簽您的全名', '', v ? 'cvv' : 'cvh');
  coachBar('sigBtn', v ? '簽好了，按這裡儲存' : '簽好了，按這裡下一步', v ? 'savev' : 'nexth');
}
/** 第一次進主選單（剛在這支手機登入的人）：先指功能卡，再指右上角「教學」，各按一次「知道了」 */
function coachMenu() {
  if (S.cur !== 'menu' || S.dev) return;
  var st = lsGet('chk.coach.menu', '');
  if (st !== 'todo' && st !== 'todo2') return;
  coachClear();
  var ok = '<button class="btn sm cok" onclick="coachMenuNext()">知道了</button>';
  if (st === 'todo') {
    var c = document.querySelector('.mcards .mcard:not(.locked)');
    if (c) coachAt(c, '要做的事從這些功能進去，例如每天的檢點點「日常檢點」' + ok, '', 'm1');
    else coachMenuNext();
    return;
  }
  var g = document.querySelector('#top .tact[aria-label="使用教學"]'), app = $('app');
  if (!g || !app) return coachMenuNext();
  g.classList.add('coachOn');
  var d = document.createElement('div'); d.className = 'coach up rt'; d.setAttribute('role', 'status');
  d.innerHTML = '<svg class="ca" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M5 11l7-7 7 7"/></svg><span>不會用時，點右上角「教學」看操作說明' + ok + '</span>';
  app.insertBefore(d, app.firstChild);
  window.scrollTo(0, 0);
}
function coachMenuNext() {
  var st = lsGet('chk.coach.menu', '');
  lsSet('chk.coach.menu', st === 'todo' ? 'todo2' : 'done');
  coachClear(); coachMenu();
}
function coachAfter() {           // render() 畫完頁面與頁首之後呼叫
  if (S.cur === 'login') return coachLogin();
  if (S.cur === 'sign') return coachSign();
  if (S.cur === 'menu') return coachMenu();
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
    tasks.push({ red: true, tag: '歸檔收尾還沒完成', title: x.dept + ' ' + ymLabel(x.period), meta: '每張表的 PDF 或通知信還沒做完（每天 12:15 電腦也會自動補做）',
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
  // 4.6（10/15 Jason）：本課還有沒人負責的表或設備 → 提醒去領取（已經有負責項目的人也要看到；申請中的不算）
  if (!ehs && !mgr && m.assigns.some(function (a) { return a.daily || a.pick; })) {
    var open = (m.claimable || []).filter(function (x) { return !(x.users || []).length && !x.pending; });
    if (open.length) tasks.push({ tag: '本課還有沒人負責的檢查', title: open.length + ' 項等人領取', meta: open.slice(0, 2).map(function (x) { return x.kind === 'equip' ? x.cat + ' ' + x.object : x.name; }).join('、') + (open.length > 2 ? '…' : '') + '；領取後由單位負責人核准',
      btn: '去領取', on: "go('claim')" });
  }
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

  // 內容（10/29 網頁版：左欄要做的事、右欄每日檢點／送審／各課狀況；手機照原本順序往下排）
  var top = netBlock() + clockBlock() + outboxBlock(), h = '';
  if (tasks.length) h += '<div class="sec"><span class="sl"><span class="cnt">' + tasks.length + '</span>要做的事</span></div>' + tasks.map(taskHtml).join('');
  else h += '<div class="card calm">' + ic('check', 24, 3) + '目前沒有要做的事</div>';
  var main = h; h = '';
  if (subs.length) h += '<div class="sec">月結送審<small>' + dueTxt(subs[0].period) + ' 前送出</small></div><div class="list">' + subs.map(function (x) {
    return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '"><span class="mn"><span class="nm">' + esc(dn(x.dept) + ymLabel(x.period)) + '</span>' +
      '<span class="mt">' + (demoDept(x.dept) ? '整課一起送，任一位同仁送出即可' : '先確認沒有漏填（可補填），整課一起送，任一位同仁送出即可') + '</span></span>' + pill('na', 'pen', '可以送審') + '</button>';
  }).join('') + '</div>';

  if (!ehs && !mgr && done.length && !isDesk()) {                   // 網頁版右欄「每日檢點」已經列出每張今天的狀態
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
  if (window.sfTiles) tl += sfTiles(m);
  tl += tile('review', '月結紀錄', "go('months')");
  tl += tile('clock', '提醒設定', "go('remind')");
  tl += tile('chat', '問題回報', "go('support')", '', '問環安衛（可附截圖）');      // 10/29：只用日常檢點的同仁在這頁也找得到
  if (isDesk()) h = top + '<div class="desk2"><div class="dcol">' + main + '</div><div class="dcol">' + (window.deskDaily ? deskDaily(m) : '') + h + '</div></div><div class="ver">v' + APP_VERSION + '</div>';
  else h = top + main + h + '<div class="tiles">' + tl + '</div><div class="ver">v' + APP_VERSION + '</div>';
  $('app').innerHTML = h;
};
// ───────────── 啟動 ─────────────
window.addEventListener('online', function () { render(); if (!S.share && !S.meet) flush(); });
window.addEventListener('offline', function () { render(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !S.share && !S.meet) { flush(); refreshMe(); } });

/** 開場 LOGO：畫面第一次畫好、且至少播完 1.3 秒才收起；最慢 3 秒一定收。 */
function splashDone() {
  var s = document.getElementById('splash');
  if (!s || s.getAttribute('data-done')) return;
  s.setAttribute('data-done', '1');
  var wait = Math.max(0, 2200 - (Date.now() - (window.SPLASH_T0 || 0)));          // 10/20 Jason：1.3 秒像閃一下 → 2.2 秒、淡出 0.7 秒
  setTimeout(function () { s.className = 'out'; setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 750); }, wait);
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

function appInit() {
  keepStorage();
  setTimeout(splashDone, 3000);
  var cr = window.cnRoute && cnRoute();
  if (!cr && !lsGet(LS.TOKEN, '') && window.cnVs && cnVs()) cr = { kind: 'vhome', vs: cnVs(), f: {} };   // 承攬商登入過的手機：直接進承攬商專區（跟員工一樣登入一次就好）
  if (cr) {                                     // 承攬商（廠商、施工人員）連結：不用登入，不碰這支手機原本的登入、草稿、待上傳
    S.cpub = cr; S.page = 'consPub';
    window.addEventListener('hashchange', function () { location.reload(); });
    render(); splashDone();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) swReg();
    return;
  }
  var mm = /[#&]meet=([0-9a-fA-F]{64})/.exec(location.hash);
  if (mm) {                                     // 現場簽到 QR：不用登入，不碰這支手機原本的登入、草稿、待上傳
    S.meet = { token: mm[1].toLowerCase(), name: '' }; S.page = 'meetJoin';
    window.addEventListener('hashchange', function () { if (location.hash.indexOf(S.meet.token) < 0) location.reload(); });   // 同一個分頁掃了另一個 QR
    render(); splashDone();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) swReg();
    return;
  }
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
}
// 10/19：畫面程式拆成 app.js＋check.js，等全部 script 載入完才啟動（check.js 在 app.js 後面載入）
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appInit); else setTimeout(appInit, 0);

// ───────────── 往右滑回上一頁（10/19 Jason：跟好用的 App 一樣，不必按左上角）─────────────
// 從螢幕左邊緣（24px 內）往右滑超過 1/4 寬放開 → 等於按左上角「返回」；滑動時畫面跟著手指走一點點。
// Android 的系統返回手勢／返回鍵也一樣回上一頁（用一筆瀏覽紀錄墊著，按到首頁時才真的離開）。
(function () {
  var sx = 0, sy = 0, on = false, dx = 0, app = null;
  var backBtn = function () { var xp = document.querySelector('#xepanel .xex'); if (xp) return xp; var b = document.getElementById('back'); return b && b.offsetParent !== null ? b : null; };
  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; on = false;
    if (e.touches.length !== 1 || t.clientX > 24 || !backBtn()) return;
    sx = t.clientX; sy = t.clientY; dx = 0; on = true; app = document.getElementById('app');
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!on) return;
    var t = e.touches[0]; dx = t.clientX - sx;
    if (Math.abs(t.clientY - sy) > 40 && dx < 40) { on = false; if (app) app.style.transform = ''; return; }   // 其實是上下捲動
    if (app && dx > 0) { app.style.transition = 'none'; app.style.transform = 'translateX(' + Math.min(dx * 0.5, 120) + 'px)'; }
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (!on) return; on = false;
    if (app) { app.style.transition = 'transform .15s ease-out'; app.style.transform = ''; }
    if (dx > Math.max(80, window.innerWidth / 4)) { var b = backBtn(); if (b) b.click(); }
  });
  // Android 返回：墊一筆紀錄；按返回時有「返回」鈕就回上一頁並再墊一筆，在首頁就讓它離開
  if (window.history && history.pushState && !/[#&](cons|meet)=/.test(location.hash)) {
    try { history.pushState({ ehsGuard: 1 }, ''); } catch (e) {}
    window.addEventListener('popstate', function () {
      var b = backBtn();
      if (b) { b.click(); try { history.pushState({ ehsGuard: 1 }, ''); } catch (e) {} }
    });
  }
})();
