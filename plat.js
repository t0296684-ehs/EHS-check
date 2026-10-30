/* 員和環安衛系統：平台層——主選單、功能權限、環保抄表、施工申請、環安衛教育訓練。
   app.js 是「日常檢點」這個功能；本檔在 app.js 之前載入，頁面與圖示在 app.js 建 PAGES／ICON 時併進去。
   新增功能的做法：MODS 加一筆（key、名稱、圖示、頁面）→ 後端 MODS／功能權限頁加一欄 → 這裡寫頁面。 */
var PLAT_VER = '0.29.3';                                   // 要跟 app.js 的 APP_VERSION 一樣（打包時會檢查）
/** 新舊檔混用自救：App 開啟時網路慢，Service Worker 會拿手機裡的舊檔頂上，可能 app.js、plat.js 一新一舊而卡在載入中。
 *  兩支檔各帶版本號，對不上就清掉手機裡存的程式檔、重新載入一次（60 秒內只做一次，不會一直重整）。 */
function platHeal() {
  try { if (Date.now() - Number(sessionStorage.getItem('chk_heal') || 0) < 60000) return; sessionStorage.setItem('chk_heal', String(Date.now())); } catch (e) { return; }
  var go = function () { location.reload(); };
  if (window.caches && caches.keys) caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(go, go); else go();
}
window.addEventListener('load', function () { if (typeof APP_VERSION === 'string' && APP_VERSION !== PLAT_VER) platHeal(); });
var PLAT_ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  helmet: '<path d="M3 17h18M5 17v-3a7 7 0 0 1 14 0v3"/><path d="M10 7.5V5h4v2.5"/><path d="M3 17v2h18v-2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  flask: '<path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3"/><path d="M7.2 15h9.6"/>',   // 危害性化學品（10/15：原本沒定義，主選單那格是空的）
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
};
var PLAT_PAGES = {};

// ───────────── 功能清單與權限 ─────────────
var MODS = [
  { key: 'check', name: '日常檢點', icon: 'clip', page: 'home', color: '#2E7D5B' },
  { key: 'env', name: '環保抄表', icon: 'wind', page: 'env', color: '#1C5FB0' },
  { key: 'cons', name: '施工申請', icon: 'helmet', page: 'cons', color: '#B45309' },
  { key: 'edu', name: '環安衛教育訓練', icon: 'book', page: 'edu', color: '#6B4FA0' },
  { key: 'chem', name: '危害性化學品', icon: 'flask', page: 'chem', color: '#C62828', hide: true },   // 後端有清單才顯示
  { key: 'patrol', name: '現場巡視', icon: 'review', page: 'patrol', color: '#9A3A06', hide: true },   // hide：沒權限的人不顯示（環安衛專用）
];
function plat() { return (S.me && S.me.plat) || null; }
function modOn(k) { var p = plat(); return p && p.mods ? !!p.mods[k] : (k === 'check' || k === 'edu'); }
function modOf(k) { return MODS.filter(function (m) { return m.key === k; })[0]; }
/** 有權限的「工作」功能（教育訓練人人都有，不算）。只有一個就直接進那個功能，兩個以上先到主選單。 */
function workMods() { return ['check', 'env'].filter(modOn); }     // 每天要做的功能；施工申請、教育訓練偶爾用、人人都有，從主選單進
function landing() {
  if (!plat()) return 'home';                     // 舊後端（沒有平台資料）：維持原本直接進日常檢點
  if (isDesk() && modOn('check')) return 'home';  // 10/29 網頁版：左邊選單就是主選單，一進來就是工作台
  return 'menu';                                  // 10/14 Jason：一律先到主選單，日常檢點、教育訓練、施工申請、危害性化學品都看得到（沒權限的灰底）
}
function goMenu() { S.stack = []; go('menu', {}, true); }
function goMod(k) { if (!modOn(k)) return permAsk(k); go(modOf(k).page); }
/** 頂部「主選單」按鈕：從任何功能都能回到主選單（只有一個功能的人也一樣）。教育訓練有未讀時加紅點。 */
function menuBtn() {
  var n = (plat() || {}).eduUnread || 0;
  return '<button class="mbtn" onclick="goMenu()" aria-label="回到主選單">' + ic('grid', 18, 2.4) + '<span>主選單</span>' + (n ? '<i class="mdot" aria-label="有新的教育訓練"></i>' : '') + '</button>';
}
function platHero(say) {
  var m = S.me;
  return '<div class="hero-in">' + (window.heroTop ? heroTop() : '') + '<div class="hi"><div class="hn"><div class="h1">' + greet() + '，' + esc(m.person.name) + '</div><div class="hsub">' + esc(whoLine()) + '</div></div></div>' +
    (say ? '<div class="say">' + say + '</div>' : '') + '</div>';
}

// ───────────── 主選單 ─────────────
function checkSub() {
  var m = S.me, t = today();
  if (isEhs()) return m.pendingReview ? '有 ' + m.pendingReview + ' 份等您歸檔' : '各課執行狀況、審核、廣播';
  if (isMgr()) return m.pendingReview ? '有 ' + m.pendingReview + ' 份等您審核' : '各課執行狀況、月結審核';
  var todo = (m.assigns || []).filter(function (a) { return a.daily && F(a.form) && !(pendingFor(a, t) || a.due.todayDone); }).length;
  return todo ? '今天還有 ' + todo + ' 張要做' : '今天的檢點都做完了';
}
PLAT_PAGES.menu = function () {
  setTitle('員和環安衛系統');
  var m = S.me;
  if (!m) { $('app').innerHTML = loading('載入中…'); return; }
  if (!S.pf && window.prefetch) setTimeout(prefetch, 1200);
  var p = plat() || { mods: { check: true, edu: true }, eduUnread: 0 };
  S.hero = platHero('今天要做什麼？');
  var subs = {
    check: checkSub(),
    env: '空污・水污',
    cons: p.consTodo ? p.consTodo + ' 件等您處理' : '給廠商的申請連結・我承辦的案件',
    edu: p.eduReady ? p.eduReady + ' 堂全員完成・待您確認匯入 NAS' : p.eduUnread ? p.eduUnread + ' 則待完成' : '教育訓練與衛教文宣',
    chem: '查作業現場的化學品與危害',
    patrol: p.patrolN ? '本月已巡視 ' + p.patrolN + ' 次' : '本月還沒巡視（EF-00-012-B）',
  };
  var badge = { check: (m.tracksOpen && !isEhs() ? m.tracksOpen : 0), cons: p.consTodo || 0, edu: p.eduReady ? '!' : p.eduUnread, patrol: p.mods && p.mods.patrol && !p.patrolN && Number(today().slice(8)) >= 15 ? '!' : 0 };
  var h = '<div class="mcards">' + MODS.filter(function (x) { return !x.hide || modOn(x.key); }).map(function (x) {
    var on = modOn(x.key);
    return '<button class="mcard' + (on ? '' : ' locked') + '" style="--c:' + x.color + '" onclick="' + (on ? 'goMod(' + jsq(x.key) + ')' : 'permAsk(' + jsq(x.key) + ')') + '">' +
      '<span class="mi">' + ic(x.icon, 30, 2.1) + '</span><span class="mx"><b>' + esc(x.name) + '</b><small>' + esc(on ? subs[x.key] : '沒有權限・點這裡申請') + '</small></span>' +
      (on ? (badge[x.key] ? '<span class="mb">' + badge[x.key] + '</span>' : '') + ic('chev', 20, 2.6) : ic('lock', 20, 2.4)) + '</button>';
  }).join('') + '</div>';
  h += pushCard();
  h += agentCard();
  h += supportCard();
  h += devCard();
  h += '<div class="ver">v' + APP_VERSION + '</div>';
  $('app').innerHTML = h;
};
/** 沒有權限：說明要向主管申請，可以直接按「申請開通」通知環安衛中心。 */
function permAsk(k) {
  var x = modOf(k); if (!x) return;
  var d = $('pDlg'); if (d) d.remove();
  d = document.createElement('div'); d.id = 'pDlg'; d.className = 'dlg'; d.setAttribute('role', 'alertdialog');
  d.innerHTML = '<div class="bx">' + ic('lock', 36, 2.2) + '<b>您沒有「' + esc(x.name) + '」權限</b><p>請先向單位負責人申請。按「申請開通」會通知環安衛中心，開通後重新打開 App 就能用。</p>' +
    '<button class="btn" id="pGo" onclick="permReq(' + jsq(k) + ')">申請開通</button><button class="btn ghost" onclick="$(\'pDlg\').remove()">取消</button></div>';
  d.onclick = function (e) { if (e.target === d) d.remove(); };
  document.body.appendChild(d);
}
function permReq(k) {
  var b = $('pGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span>送出中…';
  api('permReq', { mod: k }).then(function (r) {
    var d = $('pDlg'); if (d) d.remove();
    toast(r.already ? '您已經有這個權限，重新打開 App 就會出現' : '已通知環安衛中心，開通後重新打開 App 就能用', 'ok', 4000);
    if (r.already) refreshMe();
  }).catch(function (e) { b.disabled = false; b.textContent = '申請開通'; toast(esc(e.message), 'err', 4000); });
}
function lockedBox(k) {
  return '<div class="box warn"><div class="r">' + ic('lock', 22) + '<div class="bt"><b>您沒有「' + esc(modOf(k).name) + '」權限</b><div class="m">請先向單位負責人申請。</div></div></div>' +
    '<button class="btn" onclick="permAsk(' + jsq(k) + ')">申請開通</button></div>';
}

// ───────────── 分享、複製（給廠商、給同事的連結共用）─────────────
function copyText(txt, okMsg) {
  var done = function () { toast(okMsg || '已複製', 'ok'); };
  var old = function () {
    var el = document.createElement('textarea'); el.value = txt; el.setAttribute('readonly', ''); el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} el.remove();
    if (ok) done(); else prompt('請長按複製：', txt);
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, old); else old();
}
function shareLink(text, url) {
  if (navigator.share) navigator.share({ text: text + '\n' + url }).catch(function () {});
  else copyText(text + '\n' + url, '已複製，可以貼到 LINE');
}
function openUrl(url) { var w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url; }
/** 開原本的員和環保系統（空污）：兩個 App 在同一個網域，先把它的後台網址填好（它存在 ehs.gas_url），同仁就不用再輸入；
 *  在同一個視窗開（iPhone 加到主畫面的 App 開新視窗會跑到 Safari，那邊沒有設定）。已經設過別的網址就不動。 */
function openAir(url, gas, nav) {
  try { if (gas && /^https:\/\/script\.google\.com\//.test(gas) && !localStorage.getItem('ehs.gas_url')) localStorage.setItem('ehs.gas_url', gas); } catch (e) {}
  (nav || function (u) { location.href = u; })(url);
}

// ───────────── 環保抄表：系統清單 → 當天抄表（項目來自後台「抄表項目」）→ 月份與月結確認 ─────────────
PLAT_PAGES.env = function () {
  setTitle('環保抄表');
  if (!modOn('env')) { $('app').innerHTML = lockedBox('env'); return; }
  if (!S.envL) {
    $('app').innerHTML = loading('讀取中…');
    apiR('envMe', {}).then(function (r) { S.envL = r.systems; if (S.page === 'env') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到環保抄表', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
    return;
  }
  var col = { '空污': '#1C5FB0', '水污': '#0E7490' }, icn = { '空污': 'wind', '水污': 'drop' };
  $('app').innerHTML = '<div class="mcards">' + S.envL.map(function (x) {
    var off = !x.url && !x.n, sub = x.url ? '開啟員和環保系統（抄法不變）' : x.n ? x.n + ' 項・' + (x.layers === 3 ? '抄表 → 主管確認 → 環安衛確認' : '抄表 → 環安衛確認') : '項目還沒設定';
    return '<button class="mcard' + (off ? ' locked' : '') + '" style="--c:' + (col[x.sys] || '#3D4754') + '"' + (off ? ' disabled' : ' onclick="' + (x.url ? 'openAir(' + jsq(x.url) + ',' + jsq(x.gas || '') + ')' : "S.env=null;go('envSys',{sys:" + jsq(x.sys) + '})') + '"') +
      '><span class="mi">' + ic(icn[x.sys] || 'clip', 30, 2.1) + '</span><span class="mx"><b>' + esc(x.name) + '</b><small>' + esc(sub) + '</small></span>' + ic(x.url ? 'ext' : 'chev', 20, 2.4) + '</button>';
  }).join('') + '</div><div class="muted upnote">空污目前開啟原本的「員和環保系統」；之後會整合進本系統。</div>';
};
/** 10/20 防呆：全形數字、千分位逗號照樣算；「12..5」「1O0」這種打錯的不是數字 */
function envNorm(v) { return String(v == null ? '' : v).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); }).replace(/[．。]/g, '.').replace(/[,，\s]/g, ''); }
function envNum(v) { var t = envNorm(v); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; }
function envNaN(it, v) { return (it.type === '累計' || it.type === '數值') && envNorm(v) !== '' && !isFinite(envNum(v)); }
/** 抄表常見錯誤：讀數比上次小（抄錯或換表）、比上次大 10 倍以上（多打一位數）→ 要寫說明 */
function envOdd(it, E) {
  if (it.type !== '累計') return '';
  var l = E.d.last[it.code], v = envNum(E.v[it.code]); if (!l || !isFinite(v)) return '';
  var lv = Number(l.val);
  if (v < lv) return '比上次讀數 ' + l.val + ' 小：是抄錯了，還是換了新表？請再看一次表頭';
  if (lv > 0 && v >= lv * 10) return '比上次讀數 ' + l.val + ' 大 10 倍以上：是不是多打了一位數或少了小數點？';
  return '';
}
function envOver(it, v, use) {
  if (it.type === '勾選') return v === 'x';
  if (it.type === '選項') return it.opts.length && v !== '' && v !== it.opts[0];
  var n = it.type === '累計' ? use : envNum(v);
  if (it.type === '累計' && S.env && envOdd(it, S.env)) return true;
  return isFinite(n) && ((it.min !== null && n < it.min) || (it.max !== null && n > it.max));
}
function envCalc(it, E) {
  var m = /^([\w\-]+)\s*([\/\*\+\-])\s*([\w\-]+)$/.exec(String(it.formula || '').replace(/\s/g, '')); if (!m) return '';
  var get = function (c) { var u = envUse(c, E); return isFinite(u) ? u : envNum(E.v[c]); };
  var a = get(m[1]), b = get(m[3]), r = m[2] === '/' ? (b ? a / b : NaN) : m[2] === '*' ? a * b : m[2] === '+' ? a + b : a - b;
  return isFinite(r) ? String(Math.round(r * 1000) / 1000) : '';
}
function envUse(code, E) { var l = E.d.last[code], v = envNum(E.v[code]); return l && isFinite(v) ? Math.round((v - Number(l.val)) * 1000) / 1000 : NaN; }
PLAT_PAGES.envSys = function () {
  var sys = S.arg.sys, date = S.arg.date || today();
  setTitle(sys + '抄表');
  var E = S.env;
  if (!E || E.sys !== sys || E.date !== date) {
    $('app').innerHTML = loading('讀取項目…');
    apiR('envMe', { sys: sys, date: date }).then(function (d) {
      var v = {}, n = {}; Object.keys(d.values || {}).forEach(function (k) { v[k] = d.values[k].val; n[k] = d.values[k].note; });
      S.env = { sys: sys, date: date, d: d, v: v, n: n }; if (S.page === 'envSys') render();
    }).catch(function (e) { $('app').innerHTML = errBox('讀不到抄表項目', e.message); });
    return;
  }
  var d = E.d, lock = ['待主管確認', '待環安衛確認', '已歸檔'].indexOf(d.status) >= 0, g0 = '', done = Object.keys(d.values || {}).length > 0;
  var h = '<div class="card"><div class="mr"><b>' + esc(md(date) + '（' + wk(date) + '）') + '</b>' + (done ? pill('ok', 'check', '這天已抄') : pill('warn', '', '還沒抄')) + '</div>' +
    '<div class="btns"><button class="btn ghost" onclick="go(\'envMonth\',{sys:' + jsq(sys) + ',period:' + jsq(date.slice(0, 7)) + '})">' + ic('cal', 18, 2.2) + '本月紀錄</button>' +
    (date !== today() ? '<button class="btn ghost" onclick="S.env=null;go(\'envSys\',{sys:' + jsq(sys) + '},true)">回到今天</button>' : '<span></span>') + '</div>' +
    (lock ? '<div class="box warn"><div class="r">' + ic('lock', 22) + '<div class="bt"><div class="m">這個月已送出確認（' + esc(d.status) + '），不能再改。</div></div></div></div>' : '') + '</div>';
  d.items.forEach(function (it) {
    if (it.group !== g0) { g0 = it.group; h += '<div class="sec">' + esc(g0 || '項目') + '</div>'; }
    var v = E.v[it.code] == null ? '' : E.v[it.code], use = it.type === '累計' ? envUse(it.code, E) : NaN;
    var calc = it.type === '計算' ? envCalc(it, E) : '', over = it.type === '計算' ? envOver(Object.assign({}, it, { type: '數值' }), calc) : envOver(it, v, use);
    var rng = (it.min !== null || it.max !== null) ? '範圍 ' + (it.min !== null ? it.min : '') + '～' + (it.max !== null ? it.max : '') + (it.unit ? ' ' + it.unit : '') : '';
    var inp = '';
    var nan = envNaN(it, v), odd = envOdd(it, E);
    if (it.type === '累計' || it.type === '數值') inp = '<input class="field num' + (over || nan ? ' bad' : '') + '" inputmode="decimal" value="' + esc(v) + '"' + (lock ? ' disabled' : '') + ' oninput="envSet(' + jsq(it.code) + ',this.value)" placeholder="' + esc(it.unit || '') + '">';
    else if (it.type === '勾選') inp = '<div class="seg">' + [['ok', '✓ 正常'], ['x', '✕ 異常']].map(function (o) { return '<button class="' + (v === o[0] ? 'on' + (o[0] === 'x' ? ' ngc' : '') : '') + '"' + (lock ? ' disabled' : '') + ' onclick="envSet(' + jsq(it.code) + ',' + jsq(o[0]) + ',1)">' + o[1] + '</button>'; }).join('') + '</div>';
    else if (it.type === '選項') inp = '<div class="seg">' + it.opts.map(function (o, k) { return '<button class="' + (v === o ? 'on' + (k ? ' ngc' : '') : '') + '"' + (lock ? ' disabled' : '') + ' onclick="envSet(' + jsq(it.code) + ',' + jsq(o) + ',1)">' + esc(o) + '</button>'; }).join('') + '</div>';
    else if (it.type === '文字') inp = '<input class="field" value="' + esc(v) + '"' + (lock ? ' disabled' : '') + ' oninput="envSet(' + jsq(it.code) + ',this.value)">';
    else inp = '<div class="calcv' + (over ? ' bad' : '') + '">' + esc(calc === '' ? '（自動計算）' : calc + (it.unit ? ' ' + it.unit : '')) + '</div>';
    var meta = [rng, it.type === '累計' && d.last[it.code] ? '上次 ' + md(d.last[it.code].date) + '：' + d.last[it.code].val + (isFinite(use) ? '・日用量 ' + use + (it.unit ? ' ' + it.unit : '') : '') : it.type === '累計' ? '第一次抄：只記讀數' : ''].filter(String).join('・');
    h += '<div class="card envi' + (over || nan ? ' over' : '') + '" id="ev_' + esc(it.code) + '"><div class="eh"><b>' + esc(it.name) + '</b>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</div>' + inp +
      (nan ? '<div class="hint nbad">這不是數字，請重新輸入（小數點用「.」）</div>' : odd ? '<div class="hint nbad">' + esc(odd) + '</div>' : '') +
      (over && it.needNote !== false ? '<textarea class="note" placeholder="超出範圍或異常：寫原因與處置（必填）"' + (lock ? ' disabled' : '') + ' oninput="S.env.n[' + jsq(it.code) + ']=this.value">' + esc(E.n[it.code] || '') + '</textarea>' : '') + '</div>';
  });
  $('app').innerHTML = h;
  if (!lock) envBar();
};
function envSet(code, v, re) { S.env.v[code] = v; if (re) { var y = window.scrollY; render(); window.scrollTo(0, y); } else { envRefreshCard(code); envBar(); } }
function envRefreshCard(code) {     // 打字時只更新那一張卡的紅框與說明框（整頁重畫會讓鍵盤收起來）
  var y = window.scrollY, el = document.activeElement, pos = el && el.selectionStart;
  render(); window.scrollTo(0, y);
  var box = $('ev_' + code), inp = box && box.querySelector('input'); if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (e) {} }
}
function envMissing() {
  var E = S.env, miss = [], note = [], nan = [];
  E.d.items.forEach(function (it) {
    if (it.type === '計算') return;
    var v = E.v[it.code]; if (v == null || String(v).trim() === '') { miss.push(it); return; }
    if (envNaN(it, v)) { nan.push(it); return; }
    if (envOver(it, v, it.type === '累計' ? envUse(it.code, E) : NaN) && it.needNote !== false && txtWhy(E.n[it.code], { want: '請寫原因與處置' })) note.push(it);
  });
  return { miss: miss, note: note, nan: nan };
}
function envBar() {
  if (S.page !== 'envSys' || !S.env) return;
  var m = envMissing(), t = m.miss.length ? '還有 ' + m.miss.length + ' 項沒填・跳到「' + m.miss[0].name + '」' : m.nan.length ? '「' + m.nan[0].name + '」不是數字・跳過去' : m.note.length ? '「' + m.note[0].name + '」要寫說明・跳過去' : '送出 ' + md(S.env.date) + ' 的抄表';
  bar('<button class="btn" id="envBtn" onclick="envGo()">' + ic(m.miss.length || m.nan.length || m.note.length ? 'down' : 'check', 22, 2.6) + esc(t) + '</button>');
}
function envGo() {
  var E = S.env, m = envMissing(), first = m.miss[0] || m.nan[0] || m.note[0];
  if (first) { var el = $('ev_' + first.code); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (S.dev) return devBlock(E.sys + '抄表');
  if (E.sending) return; E.sending = true;                              // 10/20：連按兩下不會送兩筆
  var vals = {}; Object.keys(E.v).forEach(function (k) { var it = E.d.items.filter(function (x) { return x.code === k; })[0]; vals[k] = it && (it.type === '累計' || it.type === '數值') ? envNorm(E.v[k]) : E.v[k]; });
  var body = { sys: E.sys, date: E.date, values: vals, notes: E.n };
  var job = { id: newId(), action: 'envSubmit', token: lsGet(LS.TOKEN, ''), who: S.me.person.name, key: 'env|' + E.sys + '|' + E.date, body: body, created: Date.now(), status: 'pending', label: E.sys + '抄表 ' + md(E.date) };
  obPut(job).then(function () {
    toast((navigator.onLine ? '已送出 ' : '已存在手機，有網路自動上傳：') + E.sys + '抄表 ' + md(E.date), 'ok', 3000);
    S.env = null; S.envM = null; flush(); back();
  }).catch(function (e) { E.sending = false; toast('手機存檔失敗：' + esc(e.message), 'err', 5000); });
}
PLAT_PAGES.envMonth = function () {
  var sys = S.arg.sys, per = S.arg.period || today().slice(0, 7);
  setTitle(sys + '抄表・' + ymLabel(per));
  var M = S.envM;
  if (!M || M.sys !== sys || M.period !== per) {
    $('app').innerHTML = loading('讀取這個月的紀錄…');
    apiR('envMonth', { sys: sys, period: per }).then(function (r) { S.envM = r; if (S.page === 'envMonth') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到紀錄', e.message); });
    return;
  }
  var n = new Date(Number(per.slice(0, 4)), Number(per.slice(5)), 0).getDate(), t = today(), rows = '';
  for (var d = 1; d <= n; d++) {
    var date = per + '-' + pad(d); if (date > t) break;
    var x = M.days[d], dow = new Date(date + 'T12:00:00').getDay();
    var over = x ? Object.keys(x.v).filter(function (k) { return x.v[k].over; }).length : 0;
    rows += '<button class="li" onclick="S.env=null;go(\'envSys\',{sys:' + jsq(sys) + ',date:' + jsq(date) + '})"><span class="mn"><span class="nm">' + esc(md(date) + '（' + wk(date) + '）') + '</span>' +
      '<span class="mt">' + esc(x ? x.who + ' ' + String(x.at).slice(11, 16) + (over ? '・' + over + ' 項超出範圍' : '') : (dow === 0 || dow === 6 ? '假日' : '還沒抄')) + '</span></span>' +
      (x ? pill(over ? 'ng' : 'ok', over ? '' : 'check', over ? '有異常' : '已抄') : pill('na', '', '—')) + '</button>';
  }
  var act = '', st = M.status;
  if ((st === '填寫中' || st === '退回') && per < t.slice(0, 7)) act = '<button class="btn" onclick="envAct(\'submit\')">送出 ' + Number(per.slice(5)) + ' 月確認</button>';
  else if ((st === '待主管確認' && M.canMgr) || (st === '待環安衛確認' && M.canEhs)) act = '<div class="btns"><button class="btn" onclick="envAct(\'approve\')">' + ic('check', 20, 3) + '確認</button><button class="btn ghost" onclick="envAct(\'return\')">退回</button></div>';
  $('app').innerHTML = '<div class="card"><div class="mr"><b>本月狀態</b>' + pill(st === '已歸檔' ? 'ok' : st === '退回' ? 'ng' : 'info', '', st) + '</div>' +
    '<div class="muted sm2">' + esc(M.layers === 3 ? '流程：抄表人送出 → 單位負責人（' + (M.mgr || '未設定') + '）確認 → 環安衛確認' : '流程：抄表人送出 → 環安衛確認') + '</div>' +
    (st === '退回' && M.reason ? '<div class="box err"><div class="r">' + ic('ret', 22) + '<div class="bt"><b>退回原因</b><div class="m">' + esc(M.reason) + '</div></div></div></div>' : '') + '</div>' +
    '<div class="list">' + rows + '</div>';
  if (act) bar(act);
};
function envAct(a) {
  var M = S.envM, reason = '';
  if (a === 'return') { reason = prompt('退回原因（可不填，要改哪裡請當面說明）：', '') ; if (reason === null) return; }
  if (a === 'submit' && !confirm('送出 ' + ymLabel(M.period) + ' 的抄表確認？送出後這個月就不能再改，要改請退回。')) return;
  busyOn('處理中…');
  api('envMonthAct', { sys: M.sys, period: M.period, act: a, reason: reason }).then(function (r) {
    busyOff(); toast('已更新：' + r.status, 'ok'); S.envM = null; render();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}

// ───────────── 施工申請：給廠商的 Form 1／Form 2 連結、我承辦的案件（只讀承攬商系統）─────────────
function form2Url(withMe) {
  var L = (plat() || {}).links || {}, u = L.form2 || '';
  if (!u) return '';
  if (withMe === false || !L.form2Handler) return u;
  return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'usp=pp_url&' + L.form2Handler + '=' + encodeURIComponent(S.me.person.name);
}
var CONS_PILL = { '待簽名': 'warn', '施工人員簽名中': 'info', '待審核': 'info', '申請中': 'info', '已核准': 'ok', '補件退回': 'ng', '已駁回': 'ng', '已結案': 'na' };
var F1_MSG = '員和工業承攬商建檔（Form 1）：第一次合作請先填這份，填完會收到承諾書，請用印後回傳，謝謝。';
var F2_MSG = '員和工業入廠施工申請（Form 2）：請在施工前 3 個工作天填好，送出後會收到簽名連結，謝謝。';
PLAT_PAGES.cons = function () {
  setTitle('施工申請');
  var L = (plat() || {}).links || {};
  var btns = function (form) {
    return '<div class="btns r3"><button class="btn" onclick="consLink(' + form + ',\'share\')">' + ic('share', 18, 2.4) + '傳給廠商</button>' +
      '<button class="btn ghost" onclick="consLink(' + form + ',\'copy\')">' + ic('copy', 18, 2.2) + '複製連結</button>' +
      '<button class="btn ghost" onclick="consLink(' + form + ',\'open\')">' + ic('ext', 18, 2.2) + '打開看看</button></div>';
  };
  var card = function (n, title, desc) { return '<div class="card fcard"><div class="fh"><span class="fn">' + n + '</span><b>' + esc(title) + '</b></div><div class="muted">' + esc(desc) + '</div>' + btns(n) + '</div>'; };
  var h = '<button class="card fcard tbm" onclick="S.mh=null;go(\'meet\')"><div class="fh">' + ic('helmet', 22, 2.2) + '<b>工具箱會議</b></div>' +
    '<div class="muted">施工當天開工前在現場開：施工人員用手機掃 QR Code 簽名、看完簡報，完成後自動產生紀錄寄出並存檔。</div></button>' +
    '<div class="sec">給廠商的連結<small>用 LINE 傳給廠商窗口</small></div>' +
    (L.form1 ? card(1, '廠商建檔（Form 1）', '第一次來員和施工的廠商先填一次。填完系統會寄承諾書，要蓋公司大小章回傳。同一家廠商之後不用再填。') : '') +
    (L.form2 ? card(2, '入廠施工申請（Form 2）', '每個工程一份，請廠商在施工前 3 個工作天填好。從您的 App 傳出去的連結，會先問您要不要帶入您是「員和承辦人員」。') : '') +
    '<button class="btn line" onclick="gOpenFrom(\'7-3\')">' + ic('info', 18, 2.4) + '申請流程：廠商和我各要做什麼</button>';
  h += '<div class="sec">我承辦的案件<small>以 Form 2「員和承辦人員」為準</small></div><div id="consList">' + consListHtml() + '</div>';
  if (L.findme) h += '<div class="card"><b>廠商說沒收到簽名信？</b><div class="muted">把這個網址傳給廠商，系統會把簽名連結重寄到他建檔時登記的信箱。</div>' +
    '<div class="btns"><button class="btn ghost" onclick="shareLink(' + jsq('員和工業：找回簽名連結（系統會重寄到貴公司登記的信箱）') + ',' + jsq(L.findme) + ')">' + ic('share', 18, 2.4) + '傳給廠商</button>' +
    '<button class="btn ghost" onclick="copyText(' + jsq(L.findme) + ',' + jsq('連結已複製') + ')">' + ic('copy', 18, 2.2) + '複製連結</button></div></div>';
  $('app').innerHTML = h;
  if (!S.cons || S.cons.at < Date.now() - 120000) consLoad();
};
/** Form 1 直接給；Form 2 先問要不要帶入自己是承辦人員（Jason：使用這些資料前都先詢問） */
function consLink(form, how) {
  var L = (plat() || {}).links || {};
  var run = function (url, msg) { if (how === 'share') shareLink(msg, url); else if (how === 'copy') copyText(url, '連結已複製'); else openUrl(url); };
  if (form === 1) return run(L.form1, F1_MSG);
  if (!L.form2Handler) return run(form2Url(false), F2_MSG);
  dlg('<b>要帶入您的資料嗎？</b><p>這個 Form 2 連結會先幫廠商填好：</p><div class="kv"><span>員和承辦人員</span><b>' + esc(S.me.person.name) + '</b></div>' +
    '<p class="sm">帶入後，案件會出現在您的「我承辦的案件」，輪到您簽名時可以直接在 App 裡簽。</p>',
    [['帶入我的名字', function () { run(form2Url(true), F2_MSG); }, ''], ['不要帶入', function () { run(form2Url(false), F2_MSG); }, 'ghost']]);
}
/** 共用的對話框：buttons＝[[文字, 動作, 'ghost'?]]，最後自動加「取消」 */
function dlg(html, buttons) {
  var d = $('pDlg'); if (d) d.remove();
  d = document.createElement('div'); d.id = 'pDlg'; d.className = 'dlg'; d.setAttribute('role', 'alertdialog');
  d.innerHTML = '<div class="bx">' + html + '<div class="dbtns"></div></div>';
  var box = d.querySelector('.dbtns');
  (buttons || []).concat([['取消', null, 'ghost']]).forEach(function (b) {
    var el = document.createElement('button'); el.className = 'btn' + (b[2] ? ' ' + b[2] : ''); el.textContent = b[0];
    el.onclick = function () { d.remove(); if (b[1]) b[1](); };
    box.appendChild(el);
  });
  d.onclick = function (e) { if (e.target === d) d.remove(); };
  document.body.appendChild(d);
}
function consLoad(fresh) {
  if (!navigator.onLine) { S.cons = S.cons || { off: true, list: [] }; var el0 = $('consList'); if (el0) el0.innerHTML = consListHtml(); return; }
  var done = function (r) { S.cons = { at: Date.now(), list: r.list, total: r.total, demo: r.demo, today: r.today }; consSigFix(); var el = $('consList'); if (el && S.page === 'cons') el.innerHTML = consListHtml(); };
  var fail = function (e) { S.cons = { at: Date.now(), err: e.message, list: [] }; var el = $('consList'); if (el && S.page === 'cons') el.innerHTML = consListHtml(); };
  // 剛簽完名／提交：直接問承攬商系統最新狀態（不用手機與伺服器的暫存）
  if (fresh) return api('consCases', { fresh: true }, { quiet: true }).then(function (r) { rcClear(); done(r); }).catch(fail);
  apiR('consCases', {}, { quiet: true }).then(done).catch(fail);
}
/** 這支手機剛簽過的案件：承攬商系統表格還沒更新到（最多幾分鐘）前，先照手機的紀錄顯示「已簽名」，不會又跳出「在 App 內簽名」 */
function consSigMark(id, what) { try { var o = JSON.parse(localStorage.getItem('cons_sig') || '{}'); o[id] = { what: what, at: Date.now() }; localStorage.setItem('cons_sig', JSON.stringify(o)); } catch (e) {} }
function consSigFix() {
  var o = {}; try { o = JSON.parse(localStorage.getItem('cons_sig') || '{}'); } catch (e) {}
  var keep = {}, now = Date.now();
  (S.cons.list || []).forEach(function (x) {
    var m = o[x.id]; if (!m || now - m.at > 30 * 60000) return;
    keep[x.id] = m;
    if (!x.handlerSigned) { x.handlerSigned = true; x.canSubmit = !!x.sign && x.status === '施工人員簽名中'; }
    if (m.what === 'submit' && x.status === '施工人員簽名中') { x.status = '待審核'; x.canSubmit = false; x.sign = null; }
  });
  try { localStorage.setItem('cons_sig', JSON.stringify(keep)); } catch (e) {}
}
/** 已核准的案件依日期給更有用的說法：待進場／施工中／已完工 */
function consStage(x) {
  var t = (S.cons && S.cons.today) || today();
  if (x.status === '已核准') return x.end && x.end < t ? '已完工' : x.start && x.start > t ? '已核准・待進場' : '施工中';
  return x.status;
}
var CONS_DONE_ST = ['已結案', '已駁回', '已完工'];
function consIsDone(x) { return CONS_DONE_ST.indexOf(consStage(x)) >= 0; }
function consYear(x) { var d = x.start || x.apply || ''; return d ? String(Number(d.slice(0, 4)) - 1911) : '—'; }
function consTodo(x) { return !!(x.sign && (!x.handlerSigned || x.canSubmit)); }
function consListHtml() {
  var c = S.cons;
  if (!c) return loading('讀取案件…');
  if (c.off) return '<div class="muted">連上網路後顯示案件</div>';
  if (c.err) return '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(c.err) + '</div></div></div></div>';
  if (!c.list.length) return '<div class="empty">目前沒有您承辦的案件</div>';
  var f = S.consF = S.consF || { tab: 'on', year: '', dept: '', q: '' };
  var on = c.list.filter(function (x) { return !consIsDone(x); }), off = c.list.filter(consIsDone);
  var h = '<div class="seg2 cstab"><button class="' + (f.tab === 'on' ? 'on' : '') + '" onclick="consF(\'tab\',\'on\')">進行中 ' + on.length + '</button>' +
    '<button class="' + (f.tab === 'off' ? 'on' : '') + '" onclick="consF(\'tab\',\'off\')">已完成 ' + off.length + '</button></div>';
  var src = f.tab === 'on' ? on : off;
  // 已完成：依年度分；環安衛（看全部人的案件）再依承辦部門分
  var years = [], depts = [];
  src.forEach(function (x) { var y = consYear(x); if (years.indexOf(y) < 0) years.push(y); var d = x.dept || '未指定'; if (depts.indexOf(d) < 0) depts.push(d); });
  years.sort(function (a, b) { return b < a ? -1 : 1; });
  if (f.tab === 'off' && years.length > 1) {
    if (f.year && years.indexOf(f.year) < 0) f.year = '';
    var yr = f.year || years[0];
    h += '<div class="chips">' + years.map(function (y) { return '<button class="chip' + (y === yr ? ' on' : '') + '" onclick="consF(\'year\',' + jsq(y) + ')">' + esc(y === '—' ? '未填日期' : y + ' 年') + '</button>'; }).join('') + '</div>';
    src = src.filter(function (x) { return consYear(x) === yr; });
  }
  var multi = c.list.some(function (x) { return !x.mine; });
  if (multi && depts.length > 1) {
    if (f.dept && depts.indexOf(f.dept) < 0) f.dept = '';
    h += '<div class="chips">' + [''].concat(depts).map(function (d) { return '<button class="chip' + (d === f.dept ? ' on' : '') + '" onclick="consF(\'dept\',' + jsq(d) + ')">' + esc(d || '全部部門') + '</button>'; }).join('') + '</div>';
    if (f.dept) src = src.filter(function (x) { return (x.dept || '未指定') === f.dept; });
  }
  if (c.list.length > 8) h += '<input class="field" type="search" placeholder="搜尋廠商、工程、案件編號" value="' + esc(f.q) + '" oninput="S.consF.q=this.value;consListOnly()">';
  h += '<div id="consRows">' + consRows(src) + '</div>';
  return h;
}
function consF(k, v) { S.consF[k] = S.consF[k] === v && k !== 'tab' ? '' : v; if (k === 'tab') { S.consF.year = ''; } var el = $('consList'); if (el) el.innerHTML = consListHtml(); }
function consListOnly() { var el = $('consList'); if (el) el.innerHTML = consListHtml(); var q = el && el.querySelector('input[type=search]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
function consRows(src) {
  var f = S.consF, q = (f.q || '').trim().toLowerCase();
  if (q) src = src.filter(function (x) { return (x.id + ' ' + x.vendor + ' ' + x.work + ' ' + x.area + ' ' + x.owner).toLowerCase().indexOf(q) >= 0; });
  if (!src.length) return '<div class="empty">' + (q ? '找不到「' + esc(f.q) + '」' : f.tab === 'on' ? '目前沒有進行中的案件' : '沒有已完成的案件') + '</div>';
  if (f.tab === 'on') src = src.filter(consTodo).concat(src.filter(function (x) { return !consTodo(x); }));   // 輪到我做的排最上面
  return '<div class="list">' + src.map(function (x) {
    var i = S.cons.list.indexOf(x), st = consStage(x);
    var hint = x.status === '待簽名' ? '等廠商監督人員簽名' : x.status === '施工人員簽名中' ? (x.handlerSigned ? (x.canSubmit ? '您已簽，可以提交審核' : '您已簽，等施工人員簽完') : '施工人員簽完後，換您簽名') :
      x.status === '暫緩－文件不齊' ? '暫緩：承諾書還沒簽回' : x.status === '待審核' ? '環安衛審核中' : x.status === '補件退回' ? '退回補件，請提醒廠商' : '';
    var act = '';
    if (x.sign && !x.handlerSigned) act = '<button class="btn" onclick="event.stopPropagation();consSign(' + i + ')">' + ic('pen', 18, 2.4) + '在 App 內簽名</button>';
    else {
      if (x.handlerSigned && x.mine && ['施工人員簽名中', '待審核'].indexOf(x.status) >= 0) act = '<span class="csok">' + ic('check', 16, 3) + '您已簽名完成</span>';
      if (x.sign && x.canSubmit) act += '<button class="btn" onclick="event.stopPropagation();consSubmit(' + i + ')">' + ic('up', 18, 2.6) + '提交審核</button>';
    }
    var pc = st === '施工中' ? 'ok' : st === '已核准・待進場' ? 'info' : st === '已完工' ? 'na' : CONS_PILL[x.status] || 'na';
    return '<div class="li cs" role="button" tabindex="0" onclick="consOpen(' + i + ')"><span class="mn"><span class="mt">' + esc(x.id + (x.owner && !x.mine ? '・承辦 ' + x.owner : '')) + '</span><span class="nm">' + esc(x.vendor) + '</span>' +
      '<span class="mt">' + esc([x.work, x.area].filter(String).join('・')) + '</span><span class="mt">' + esc((x.start ? md(x.start) : '') + (x.end && x.end !== x.start ? '～' + md(x.end) : '')) + (hint ? '・' + esc(hint) : '') + '</span>' +
      act + '</span><span class="csr">' + pill(pc, '', st) + ic('chev', 18, 2.6) + '</span></div>';
  }).join('') + '</div>';
}
/** 案件明細（小視窗，比照危害性化學品）：廠商、聯絡、施工內容、人員、簽名進度 */
function consOpen(i) {
  var x = S.cons.list[i]; if (!x) return;
  var d0 = $('pDlg'); if (d0) d0.remove();
  var dd = document.createElement('div'); dd.id = 'pDlg'; dd.className = 'dlg';
  var row = function (k, v, raw) { return v ? '<div class="chr"><b>' + esc(k) + '</b><span>' + (raw ? v : esc(v)) + '</span></div>' : ''; };
  var tel = String(x.phone || '').replace(/[^\d+#]/g, '');
  var days = x.start ? (x.start === x.end || !x.end ? md(x.start) : md(x.start) + '～' + md(x.end)) : '';
  var spec = x.spec && !/無特殊作業|以上皆非/.test(x.spec) ? x.spec : '無';
  var ok = function (b) { return b ? '<span class="cy">' + ic('check', 14, 3) + '已簽</span>' : '<span class="cn">未簽</span>'; };
  var ws = (x.workers || []);
  var act = '';
  if (x.sign && !x.handlerSigned) act = '<button class="btn" onclick="$(\'pDlg\').remove();consSign(' + i + ')">' + ic('pen', 18, 2.4) + '在 App 內簽名</button>';
  else if (x.sign && x.canSubmit) act = '<button class="btn" onclick="$(\'pDlg\').remove();consSubmit(' + i + ')">' + ic('up', 18, 2.6) + '提交審核</button>';
  dd.innerHTML = '<div class="bx chd"><button class="chclose" aria-label="關閉" onclick="$(\'pDlg\').remove()">' + ic('x', 26, 2.8) + '</button>' +
    '<div class="muted">' + esc(x.id) + '</div><div class="mr"><b class="chn">' + esc(x.vendor) + '</b></div>' +
    '<div class="chf"><span>' + esc(consStage(x)) + '</span>' + (x.handlerSigned ? '<span>承辦人已簽名</span>' : '') + '</div>' +
    '<div class="chsec">施工內容</div>' + row('工程名稱', x.work) + row('施工區域', x.area) + row('施工期間', days) + row('申請日', x.apply ? md(x.apply) : '') +
    row('特殊作業', spec) + row('環境潛在危害', x.env) + row('備註', x.note) +
    '<div class="chsec">廠商聯絡</div>' + (x.contact || tel || x.email ? row('聯絡人', x.contact) + row('電話', tel ? '<a href="tel:' + esc(tel) + '">' + esc(x.phone) + '</a>' : '', true) + row('Email', x.email) : '<div class="muted">廠商主檔沒有聯絡資料</div>') +
    row('現場監督人員', x.sup) +
    '<div class="chsec">施工人員' + (ws.length ? '（' + ws.length + ' 人）' : '') + '</div>' + (ws.length ? '<div class="cswk">' + ws.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div>' : '<div class="muted">Form 2 沒有填施工人員</div>') +
    '<div class="chsec">簽名進度</div>' + row('廠商監督人員', ok(x.repSigned), true) +
    (ws.length || x.wSigned ? row('施工人員', x.wSigned + ' / ' + (ws.length || '—') + ' 人', false) : '') + row('員和承辦人員' + (x.owner ? '（' + x.owner + '）' : ''), ok(x.handlerSigned), true) +
    (act ? '<div class="btns" style="margin-top:12px">' + act + '</div>' : '') + '</div>';
  document.body.appendChild(dd);
  dd.addEventListener('click', function (e) { if (e.target === dd) dd.remove(); });
}
/** 呼叫承攬商系統的 APP_API（手機直接送，帶該案通行碼；跟原本簽名頁一樣的安全等級）。沒裝 APP_API → reject({noApi}) */
function consApi(sign, body) {
  if (sign.api === 'demo') return new Promise(function (res) { setTimeout(function () { res({ ok: true, workersDone: true, demo: true }); }, 600); });
  return fetch(sign.api, { method: 'POST', redirect: 'follow', body: JSON.stringify(Object.assign({ caseId: sign.caseId, token: sign.token }, body)) })
    .then(function (r) { return r.text(); })
    .then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { var x = new Error('承攬商系統還沒裝 App 簽名功能'); x.noApi = true; throw x; } return j; });
}
function consSign(i) {
  var x = S.cons.list[i], sig = S.me.signature;
  if (!sig || !sig.image) return dlg('<b>還沒有您的簽名</b><p>請先到「設定 → 我的簽名」簽好，之後就能直接帶入。</p>', [['去簽名', function () { go('sign'); }, '']]);
  // v0.14.3（10/16 Jason）：監督人員、施工人員都簽好了 → 簽名與提交審核一次完成，不用簽完再等、再按一次
  var last = x.repSigned && (x.workers || []).length > 0 && x.wSigned >= x.workers.length;
  dlg('<b>' + (last ? '簽名並提交審核？' : '用您的簽名簽這個案件？') + '</b><p>' + esc(x.id + '・' + x.vendor) + '<br>' + esc(x.work) + '</p><img class="sigprev" src="' + sig.image + '" alt="我的簽名">' +
    '<p class="sm">會以「員和承辦人員 ' + esc(S.me.person.name) + '」簽名，簽完不能撤回。' + (last ? '監督人員與施工人員都已簽名，簽完會直接送環安衛審核。' : '') + '</p>',
    [[last ? '簽名並提交審核' : '確認簽名', function () { consSignGo(i); }, ''], ['改開簽名頁自己簽', function () { consFallback(x); }, 'ghost']]);
}
function consSignGo(i) {
  var x = S.cons.list[i];
  if (!navigator.onLine) return toast('沒有網路，簽名要連上網路', 'err', 3500);
  busyOn('簽名中…', '約 5～10 秒');
  consApi(x.sign, { action: 'handlerSign', name: S.me.person.name, dataUrl: S.me.signature.image }).then(function (r) {
    busyOff();
    if (!r.ok && /已簽|已經簽/.test(r.error || '')) {                 // 承攬商系統說已經簽過：照已簽處理，不要再叫他簽
      consSigMark(x.id, 'sign'); x.handlerSigned = true; x.canSubmit = x.status === '施工人員簽名中';
      toast('這個案件您已經簽過名了', 'ok', 3500); var el2 = $('consList'); if (el2) el2.innerHTML = consListHtml(); return consLoad(true);
    }
    if (!r.ok) return toast(esc(r.error || '簽名沒有成功'), 'err', 5000);
    x.handlerSigned = true; x.canSubmit = x.status === '施工人員簽名中';
    if (!x.demo) consSigMark(x.id, 'sign');
    if (r.workersDone) return consSubmit(i, true);                    // 施工人員都簽完：直接接著提交審核（同一次操作）
    toast('已簽名；等施工人員都簽完再提交審核', 'ok', 4000);
    var el = $('consList'); if (el) el.innerHTML = consListHtml();
    if (!x.demo) setTimeout(function () { consLoad(true); }, 1500);
  }).catch(function (e) { busyOff(); if (e.noApi) { toast('承攬商系統還不能在 App 內簽名，改開原本的簽名頁', '', 3500); consFallback(x); } else toast(esc(e.message), 'err', 4000); });
}
function consSubmit(i, afterSign) {
  var x = S.cons.list[i];
  busyOn(afterSign ? '已簽名，提交審核中…' : '提交審核中…');
  consApi(x.sign, { action: 'submitForReview' }).then(function (r) {
    busyOff();
    if (!r.ok) { var el0 = $('consList'); if (el0) el0.innerHTML = consListHtml(); return toast(esc(r.error || '提交沒有成功'), 'err', 6000); }
    x.status = '待審核'; x.canSubmit = false; x.sign = null;
    if (!x.demo) { consSigMark(x.id, 'submit'); setTimeout(function () { consLoad(true); }, 1500); }
    toast(afterSign ? '已簽名並提交審核，環安衛會收到通知' : '已提交審核，環安衛會收到通知', 'ok', 4500);
    var el = $('consList'); if (el) el.innerHTML = consListHtml();
  }).catch(function (e) { busyOff(); if (e.noApi) consFallback(x); else toast(esc(e.message), 'err', 4000); });
}
function consFallback(x) { if (x.handlerLink) openUrl(x.handlerLink); else toast('示範區不會開啟正式簽名頁', '', 3000); }
/** 從功能頁打開教學某一節（返回時回到原頁） */
function gOpenFrom(no) { go('guide', { sec: no }); }

// ───────────── 環安衛教育訓練（簡化版 e-learning）─────────────
// 課程（教育訓練）：看教材（中／泰／英，手機語言的放前面）→ 有測驗就作答（全對才算）→「我已完成」帶入簽名 → 自動進教育訓練簽到表。
// 文宣（衛教文宣）：看就好；要確認的按「我已閱讀」。
var EDU_CAT_COLOR = { '教育訓練': 'info', '衛教文宣': 'ok' };
var EDU_LANG = { zh: '中文', th: 'ภาษาไทย', en: 'English' };
function eduState(x) {
  if (x.course) return x.done ? ['ok', 'check', '已完成'] : x.due && x.due < today() ? ['ng', '', '已逾期'] : ['warn', '', x.due ? '期限 ' + md(x.due) : '待完成'];
  return x.needAck ? (x.acked ? ['ok', 'check', '已確認'] : ['warn', '', '請看完確認']) : x.opened ? null : ['ng', '', '新'];
}
function eduRow(x) {
  var st = eduState(x), meta = x.cat + (x.course && x.hours ? '・' + x.hours + ' 小時' : '') + '・' + x.time.slice(5, 10).replace('-', '/') + (x.files.length ? '・' + x.files.length + ' 個附件' : '');
  return '<button class="li' + (x.opened ? '' : ' unread') + '" onclick="go(\'eduItem\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="mt">' + esc(meta) + '</span><span class="nm">' + (x.opened ? '' : '<i class="ndot"></i>') + esc(x.title) + '</span></span>' +
    (st ? pill(st[0], st[1], st[2]) : '') + '</button>';
}
PLAT_PAGES.edu = function () {
  setTitle('環安衛教育訓練');
  var e = S.edu;
  if (!e) {
    $('app').innerHTML = loading('讀取文宣…');
    apiR('eduList', {}).then(function (r) { S.edu = { list: r.list, cats: r.cats, cat: '' }; if (S.page === 'edu') render(); })
      .catch(function (x) { $('app').innerHTML = errBox('讀不到教育訓練', x.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
    return;
  }
  var h = '';
  if (isEhs()) h += '<div class="btns"><button class="btn" onclick="S.ep=null;go(\'eduPost\')">' + ic('plus', 18, 2.4) + '發布新文宣</button><button class="btn ghost" onclick="S.es=null;go(\'eduStats\')">' + ic('review', 18, 2.4) + '閱讀紀錄</button></div>' +
    '<button class="btn line" style="margin-top:10px" onclick="go(\'meetNew\')">' + ic('helmet', 18, 2.4) + '新進人員教育訓練（現場掃碼簽到）</button>';
  // 10/19 晚 Jason：通知說有未完成的，點進來要一眼看出是哪幾則 → 第一個分頁「待完成」（數字＝還沒做完的），有待完成就先開它
  var isTodo = function (x) { return x.forMe !== false && (x.course ? !isEhs() && !x.done : x.needAck ? !x.acked : !x.opened); };   // 環安衛看得到全部，待完成只算發給自己的
  var todoL = e.list.filter(isTodo).sort(function (a, b) { return String(a.due || '9999').localeCompare(String(b.due || '9999')) || (b.course ? 1 : 0) - (a.course ? 1 : 0); });
  var view = e.view || (todoL.length ? 'todo' : 'all');
  var tabs = [['todo', '待完成', todoL.length]].concat([['all', '全部'], ['lib', '教材庫'], ['risk', '高風險作業']]);
  h += '<div class="seg2 cstab" style="grid-template-columns:repeat(' + tabs.length + ',minmax(0,1fr))">' + tabs.map(function (v) {
    return '<button class="' + (view === v[0] ? 'on' : '') + '" onclick="S.edu.view=' + jsq(v[0]) + ';render()"><span>' + esc(v[1]) + '</span>' + (v[2] ? ' <b data-raw>' + v[2] + '</b>' : '') + '</button>'; }).join('') + '</div>';
  if (view === 'lib') { $('app').innerHTML = h + eduLibHtml(e); return; }
  if (view === 'risk') { $('app').innerHTML = h + riskHtml(); return; }
  if (view === 'todo') {
    h += todoL.length ? '<div class="muted upnote" style="margin:4px 2px 8px">期限近的在上面。教育訓練看完教材、按「我已完成」；要確認的文宣按「我已閱讀」；新的文宣打開看過就好。</div>' +
      '<div class="list">' + todoL.map(eduRow).join('') + '</div>' : '<div class="empty">都完成了，沒有待完成的</div>';
    $('app').innerHTML = h; return;
  }
  h += '<div class="seg">' + [''].concat(e.cats).map(function (c) {
    return '<button class="' + (e.cat === c ? 'on' : '') + '" onclick="S.edu.cat=' + jsq(c) + ';render()">' + esc(c || '全部') + '</button>'; }).join('') + '</div>';
  var list = e.list.filter(function (x) { return !e.cat || x.cat === e.cat; });
  if (!list.length) h += '<div class="empty">目前沒有' + esc(e.cat || '文宣') + '</div>';
  else h += '<div class="list">' + list.map(eduRow).join('') + '</div>';
  h += '<div class="muted upnote">教育訓練看完要按「我已完成」（會自動簽到）；衛教文宣看完就好。</div>';
  $('app').innerHTML = h;
};
PLAT_PAGES.eduItem = function () {
  setTitle('環安衛教育訓練');
  var id = S.arg.id, x = S.eduItem && S.eduItem.id === id ? S.eduItem : null;
  if (!x) {
    $('app').innerHTML = loading('讀取中…');
    api('eduGet', { id: id }).then(function (r) {
      S.eduItem = r; S.eq = { ans: [], wrong: [] };
      if (S.edu) S.edu.list.forEach(function (y) { if (y.id === id) { y.opened = true; } });
      if (r.firstOpen && !r.course && !r.needAck) eduDec();             // 只有一般文宣「打開＝看過」；課程要按我已完成、要確認的要按我已閱讀才算做完
      if (S.page === 'eduItem') render();
    }).catch(function (e) { $('app').innerHTML = errBox('讀不到這則文宣', e.message); });
    return;
  }
  var info = [x.time.slice(0, 10).replace(/-/g, '/'), x.by].concat(x.course ? [x.hours ? x.hours + ' 小時' : '', x.teacher ? '講師 ' + x.teacher : '', x.due ? '期限 ' + md(x.due) : ''] : []).filter(String).join('・');
  var h = '<div class="card edi"><div class="mt">' + pill(EDU_CAT_COLOR[x.cat] || 'na', '', x.cat) + '　' + esc(info) + '</div>' +
    '<h2 class="gh">' + esc(x.title) + '</h2>' + (x.body ? '<div class="edb">' + esc(x.body) + '</div>' : '') + '</div>';
  var pl = Object.keys(x.pages || {});
  if (pl.length) {
    // v0.13.18（10/15 Jason）：教材在 App 內一頁一頁翻，中文、泰文擇一看完（滑到最後一頁）就算讀完
    var my0 = window.I18N ? I18N.lang() : 'zh';
    pl.sort(function (a, b) { return (a === my0 ? 0 : a === 'zh' ? 1 : 2) - (b === my0 ? 0 : b === 'zh' ? 1 : 2); });
    h += '<div class="sec">' + (x.course ? '教材' : '內容') + (x.readDone ? '<small class="okt">' + ic('check', 14, 3) + '已看完</small>' : '<small>選一種語言，從第一頁看到最後一頁</small>') + '</div><div class="rdl">' +
      pl.map(function (lg, i) {
        return '<button class="btn' + (i ? ' line' : '') + '" onclick="go(\'eduRead\',{id:' + jsq(x.id) + ',lang:' + jsq(lg) + '})">' + ic('book', 20, 2.4) +
          '<span data-raw>' + esc(EDU_LANG[lg] || lg) + '</span><small>' + x.pages[lg].length + ' 頁</small></button>';
      }).join('') + '</div>';
  }
  if (x.files.length && pl.length) {
    h += '<details class="edoth"><summary>原始檔案（' + x.files.length + '）</summary><div class="list">' + x.files.map(function (f) {
      return '<button class="li" onclick="eduOpen(' + jsq(x.id) + ',' + jsq(f.id) + ')">' + ic(/^image/.test(f.mime) ? 'img' : 'pdf', 22, 2.2) + '<span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + esc(fsz(f.size)) + '</span></span>' + ic('chev', 18, 2.6) + '</button>';
    }).join('') + '</div></details><div id="eduView"></div>';
  } else if (x.files.length) {
    // v0.13.9（10/14 Jason）：教材依同仁選的語言推送——只列他那個語言的檔；沒有他的語言就給中文；其他語言收在下面「其他語言版本」。環安衛全部列出。
    var my = window.I18N ? I18N.lang() : 'zh', lg = function (f) { return f.lang || 'zh'; };
    var multi = x.files.some(function (f) { return lg(f) !== 'zh'; });
    var mine = x.files.filter(function (f) { return lg(f) === my; });
    if (!mine.length) mine = x.files.filter(function (f) { return lg(f) === 'zh'; });
    if (!mine.length || isEhs()) mine = x.files.slice().sort(function (a, b) { return (lg(a) === my ? 0 : 1) - (lg(b) === my ? 0 : 1); });
    var rest = x.files.filter(function (f) { return mine.indexOf(f) < 0; });
    var row = function (f) {
      return '<button class="li" onclick="eduOpen(' + jsq(x.id) + ',' + jsq(f.id) + ')">' + ic(/^image/.test(f.mime) ? 'img' : 'pdf', 22, 2.2) + '<span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + esc(fsz(f.size)) + '</span></span>' +
        (multi ? '<span class="pill p-na" data-raw>' + esc(EDU_LANG[lg(f)] || '中文') + '</span>' : '') + ic('chev', 18, 2.6) + '</button>';
    };
    h += '<div class="sec">' + (x.course ? '教材' : '附件') + '</div><div class="list">' + mine.map(row).join('') + '</div>' +
      (rest.length ? '<details class="edoth"><summary>其他語言版本（' + rest.length + '）</summary><div class="list">' + rest.map(row).join('') + '</div></details>' : '') + '<div id="eduView"></div>';
  }
  if (x.link) h += '<button class="btn line" onclick="openUrl(' + jsq(x.link) + ')">' + ic('link', 18, 2.4) + '打開相關連結</button>';
  if (x.course && x.quiz.length && !x.done) {
    var q = S.eq || (S.eq = { ans: [], wrong: [] });
    h += '<div class="sec">測驗<small>全部答對才算完成</small></div>' + x.quiz.map(function (y, i) {
      return '<div class="card quiz' + (q.wrong.indexOf(i + 1) >= 0 ? ' bad' : '') + '"><b>' + (i + 1) + '. ' + esc(y.q) + '</b>' + y.opts.map(function (o, k) {
        return '<label class="ck"><input type="radio" name="q' + i + '"' + (q.ans[i] === k ? ' checked' : '') + ' onchange="S.eq.ans[' + i + ']=' + k + '"><span>' + esc(o) + '</span></label>'; }).join('') +
        (q.wrong.indexOf(i + 1) >= 0 ? '<div class="ngt">這題答錯了，再看一下教材</div>' : '') + '</div>';
    }).join('');
    var needRead = pl.length && !x.readDone && !isEhs();
    h += isEhs() && !S.dev ? '<button class="btn line" onclick="eduDone(true)">' + ic('check', 20, 3) + '預覽批改（環安衛不簽到）</button>' :
      needRead ? '<button class="btn" disabled>' + ic('lock', 20, 2.6) + '先看完教材才能送出</button>' :
      '<button class="btn" onclick="eduDone()">' + ic('check', 22, 3) + '送出答案並完成（帶入簽名）</button>';
  }
  $('app').innerHTML = h;
  if (isEhs() && !S.dev) return;
  var rd0 = pl.length && !x.readDone ? '<button class="btn" onclick="go(\'eduRead\',{id:' + jsq(x.id) + ',lang:' + jsq(pl[0]) + '})">' + ic('book', 22, 2.6) + '開始閱讀</button>' : '';
  if (!x.course && pl.length) { bar(x.acked || x.readDone ? '<div class="donebar">' + ic('check', 20, 3) + '已閱讀' + (x.ackAt ? '・' + esc(x.ackAt.slice(5).replace('-', '/')) : '') + '</div>' : rd0); return; }
  if (x.course && !x.done && rd0) { bar(rd0); return; }
  if (x.course) {
    if (x.done) bar('<div class="donebar">' + ic('check', 20, 3) + '已完成・' + esc(x.doneAt.slice(5).replace('-', '/')) + (x.score ? '・測驗 ' + esc(x.score) : '') + '・已簽到</div>');
    else if (!x.quiz.length) bar('<button class="btn" id="doneBtn" onclick="eduDone()">' + ic('check', 22, 3) + '我已完成（帶入簽名）</button>');
  } else if (x.needAck && !x.acked) bar('<button class="btn" id="ackBtn" onclick="eduAck()">' + ic('check', 22, 3) + '我已閱讀，了解內容</button>');
  else if (x.acked) bar('<div class="donebar">' + ic('check', 20, 3) + '已確認閱讀・' + esc(x.ackAt.slice(5).replace('-', '/')) + '</div>');
};
// v0.13.18：App 內閱讀教材。邊滑邊載（一次 3 頁）；最後一頁的底部出現在畫面上、而且是自己滑下來的，才記「已看完」
PLAT_PAGES.eduRead = function () {
  var id = S.arg.id, lang = S.arg.lang, x = S.eduItem && S.eduItem.id === id ? S.eduItem : null;
  setTitle(x ? x.title : '閱讀教材');
  if (!x) { go('eduItem', { id: id }); return; }
  var pg = (x.pages || {})[lang] || [];
  S.rd = { id: id, lang: lang, n: pg.length, got: 0, busy: false, done: !!x.readDone, moved: false };
  $('app').innerHTML = '<div class="rdh"><span data-raw>' + esc(EDU_LANG[lang] || lang) + '</span>・共 ' + pg.length + ' 頁</div>' +
    pg.map(function (p, i) { return '<div class="rdp" id="rdp' + i + '"><div class="rdn">' + (i + 1) + ' / ' + pg.length + '</div><div class="rdi"><span class="spin"></span></div>' +
      (p.t ? '<div class="rdt" data-raw>' + esc(p.t) + '</div>' : '') + '</div>'; }).join('') +
    '<div id="rdEnd" class="rdend">' + (S.rd.done ? '已看完' : '— 最後一頁 —') + '</div>';
  rdBar();
  rdLoad();
  window.onscroll = function () { if (S.page !== 'eduRead') { window.onscroll = null; return; } if (window.scrollY > 40) S.rd.moved = true; rdLoad(); rdCheck(); };
};
function rdBar() {
  var r = S.rd; if (!r) return;
  if (r.done) bar('<button class="btn" onclick="back()">' + ic('check', 22, 3) + '已看完，回上一頁</button>');
  else bar('<div class="rdbar"><div class="rdpg"><i style="width:' + Math.round(100 * rdSeen() / Math.max(1, r.n)) + '%"></i></div><span>看到第 ' + rdSeen() + ' / ' + r.n + ' 頁，滑到最後一頁才算看完</span></div>');
}
function rdSeen() { var n = 0, H = window.innerHeight; for (var i = 0; i < S.rd.n; i++) { var e = $('rdp' + i); if (e && e.getBoundingClientRect().top < H * 0.8) n = i + 1; } return n; }
function rdLoad() {
  var r = S.rd; if (!r || r.busy || r.got >= r.n) return;
  var last = $('rdp' + Math.max(0, r.got - 1));
  if (r.got && last && last.getBoundingClientRect().top > window.innerHeight * 2.5) return;      // 還沒滑到附近就先不載
  r.busy = true;
  api('eduPages', { id: r.id, lang: r.lang, from: r.got, n: 3 }).then(function (o) {
    o.pages.forEach(function (p) {
      var e = $('rdp' + p.i); if (!e) return;
      e.querySelector('.rdi').innerHTML = '<img src="data:' + p.mime + ';base64,' + p.data + '" alt="第 ' + (p.i + 1) + ' 頁">';
    });
    r.got += o.pages.length; r.busy = false; rdBar();
    if (S.page === 'eduRead') { rdLoad(); rdCheck(); }
  }).catch(function (e) { r.busy = false; toast(esc(e.message), 'err', 4000); });
}
function rdCheck() {
  var r = S.rd; if (!r || r.done || r.saving) return;
  rdBar();
  var end = $('rdEnd'); if (!end || r.got < r.n || !r.moved) return;
  if (end.getBoundingClientRect().top > window.innerHeight) return;
  r.saving = true;
  api('eduRead', { id: r.id, lang: r.lang }).then(function (o) {
    r.done = true; r.saving = false;
    var x = S.eduItem; if (x) { x.readDone = o.at || now16(); if (!x.course) { if (!x.acked && !o.ehs && !o.dev) eduDec(); x.acked = true; x.ackAt = o.ackAt || x.ackAt; } }
    if (S.edu) S.edu.list.forEach(function (y) { if (y.id === r.id && !y.course) y.acked = true; });
    end.textContent = '已看完';
    toast(o.ehs ? '已看到最後（環安衛預覽，不記錄）' : x && x.course ? '已看完，可以回去作答／按完成' : '已看完，已記錄閱讀', 'ok', 3500);
    rdBar();
  }).catch(function (e) { r.saving = false; toast(esc(e.message), 'err', 4000); });
}
function now16() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
/** 教育訓練待辦數減 1（主選單紅點、首頁待辦） */
function eduDec() { var p = plat(); if (p && p.eduUnread) { p.eduUnread = Math.max(0, p.eduUnread - 1); var raw = lsGet(LS.ME, null); if (raw && raw.plat) { raw.plat.eduUnread = p.eduUnread; lsSet(LS.ME, raw); } } }
function fsz(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function eduOpen(id, fid) {
  if (!navigator.onLine) return toast('沒有網路，附件要連上網路才能看', 'err', 3500);
  busyOn('開啟附件…');
  api('eduFile', { id: id, file: fid }).then(function (r) {
    busyOff();
    var bin = atob(r.data), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([arr], { type: r.mime }));
    if (/^image/.test(r.mime)) { var v = $('eduView'); if (v) { v.innerHTML = '<img class="edimg" src="' + url + '" alt="' + esc(r.name) + '">'; v.scrollIntoView({ behavior: 'smooth' }); } return; }
    var w = window.open(url, '_blank');
    if (!w) { var a = document.createElement('a'); a.href = url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove(); }
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4000); });
}
function eduAck() {
  var b = $('ackBtn'); b.disabled = true; b.innerHTML = '<span class="spin"></span>送出中…';
  api('eduAck', { id: S.eduItem.id }).then(function (r) {
    S.eduItem.acked = true; S.eduItem.ackAt = r.ackAt; eduDec();
    if (S.edu) S.edu.list.forEach(function (y) { if (y.id === S.eduItem.id) y.acked = true; });
    toast('已記錄，謝謝', 'ok'); render();
  }).catch(function (e) { b.disabled = false; b.innerHTML = ic('check', 22, 3) + '我已閱讀，了解內容'; toast(esc(e.message), 'err', 4000); });
}
/** 我已完成：題目都要作答 → 確認用系統裡的簽名 → 送出批改；錯的題目標紅 */
function eduDone(dry) {
  var x = S.eduItem, q = S.eq || { ans: [] }, sig = S.me.signature;
  for (var i = 0; i < x.quiz.length; i++) if (q.ans[i] == null) { toast('第 ' + (i + 1) + ' 題還沒作答', 'err'); var c = document.querySelectorAll('.quiz')[i]; if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (dry) {                                                         // 環安衛預覽：只批改，不簽到、不寫完成
    busyOn('批改中…');
    return api('eduDone', { id: x.id, answers: q.ans, dry: true }).then(function (r) {
      busyOff(); S.eq.wrong = r.wrong || []; render();
      toast(r.total ? '答對 ' + r.right + ' / ' + r.total + ' 題（預覽，不簽到）' : '這堂課沒有測驗', r.done ? 'ok' : 'err', 4000);
    }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
  }
  if (!sig || !sig.image) return dlg('<b>還沒有您的簽名</b><p>請先到「設定 → 我的簽名」簽好，完成時會自動帶入。</p>', [['去簽名', function () { go('sign'); }, '']]);
  if (S.dev) return devBlock('教育訓練完成簽到');
  dlg('<b>完成這堂教育訓練？</b><p>' + esc(x.title) + (x.hours ? '（' + x.hours + ' 小時）' : '') + '</p><img class="sigprev" src="' + sig.image + '" alt="我的簽名"><p class="sm">會用您的簽名寫進教育訓練簽到表。</p>',
    [['確認完成', function () {
      busyOn('送出中…');
      api('eduDone', { id: x.id, answers: q.ans }).then(function (r) {
        busyOff();
        if (!r.done) { S.eq.wrong = r.wrong; toast('答對 ' + r.right + ' / ' + r.total + ' 題，請再看一下教材', 'err', 4000); render(); return; }
        x.done = true; x.doneAt = r.doneAt; x.score = r.score || ''; eduDec();
        if (S.edu) S.edu.list.forEach(function (y) { if (y.id === x.id) y.done = true; });
        toast('已完成並簽到，謝謝', 'ok', 3500); render();
      }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
    }, '']]);
}

// 環安衛：發布（課程：時數、講師、期限、主題、教材語言、測驗；文宣：要不要確認）
var EDU_TOPICS = ['一般安全衛生教育訓練', '危害辨識教育訓練', '呼吸防護教育訓練', '安全防災教育訓練', '環安衛教育訓練', '堆高機回訓', '新進人員教育訓練'];
PLAT_PAGES.eduPost = function () {
  setTitle('發布教育訓練');
  if (!isEhs()) return back();
  if (!S.ep) {
    $('app').innerHTML = loading('讀取人員名單…');
    apiR('bcPeople', {}).then(function (r) {
      S.ep = { depts: r.depts, cat: '教育訓練', title: '', body: '', link: '', files: [], mode: 'all', depts2: {}, names: {}, mgrOnly: false, needAck: true, mail: false, up: 0,
               hours: '', teacher: S.me.person.name, due: '', quiz: [], topic: '' };
      if (S.page === 'eduPost') render();
    }).catch(function (e) { $('app').innerHTML = errBox('讀不到人員名單', e.message); });
    return;
  }
  var b = S.ep, course = b.cat === '教育訓練', h = '';
  h += '<div class="sec">1. 類別</div><div class="seg">' + ['教育訓練', '衛教文宣'].map(function (c) {
    return '<button class="' + (b.cat === c ? 'on' : '') + '" onclick="S.ep.cat=' + jsq(c) + ';S.ep.needAck=' + (c === '教育訓練') + ';render()">' + c + '</button>'; }).join('') + '</div>' +
    '<div class="muted sm2">' + (course ? '教育訓練＝要簽到表：同仁看完按「我已完成」自動簽到；全員完成後您確認，電腦產生 P-05-01-A 簽到表放 NAS。' : '衛教文宣＝不出簽到表：只在「閱讀紀錄」看誰還沒看過。') + '</div>';
  h += '<div class="sec">2. 內容</div><div class="card ev"><label class="nl" for="epT">標題</label><input id="epT" class="field" maxlength="60" placeholder="例：有機溶劑危害告知" value="' + esc(b.title) + '" oninput="S.ep.title=this.value;epBar()">' +
    '<label class="nl" for="epB">說明</label><textarea id="epB" class="note plain" maxlength="3000" placeholder="重點、要注意的事" oninput="S.ep.body=this.value;epBar()">' + esc(b.body) + '</textarea>';
  if (course) h += '<div class="btns r3"><div><label class="nl" for="epH">時數</label><input id="epH" class="field" inputmode="decimal" placeholder="1" value="' + esc(b.hours) + '" oninput="S.ep.hours=this.value"></div>' +
    '<div><label class="nl" for="epR">講師</label><input id="epR" class="field" value="' + esc(b.teacher) + '" oninput="S.ep.teacher=this.value"></div>' +
    '<div><label class="nl" for="epD">完成期限</label><input id="epD" class="field" type="date" value="' + esc(b.due) + '" onchange="S.ep.due=this.value"></div></div>';
  if (course) h += '<label class="nl" for="epTp">主題（NAS 歷年教育訓練資料裡的資料夾名稱）</label><input id="epTp" class="field" list="eduTopics" placeholder="例：一般安全衛生教育訓練" value="' + esc(b.topic) + '" oninput="S.ep.topic=this.value">' +
    '<datalist id="eduTopics">' + EDU_TOPICS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><div class="muted sm2">簽到表與教材會放在 歷年教育訓練資料／民國年／主題；同主題的課會放同一個資料夾。</div>';
  h += '<label class="nl">' + (course ? '教材' : '附件') + '（PDF、JPG、PNG，每個 10MB 以內，最多 5 個）</label>' +
    (b.files.length ? '<div class="list">' + b.files.map(function (f, i) {
      return '<div class="li">' + ic(/^image/.test(f.mime) ? 'img' : 'pdf', 22, 2.2) + '<span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + fsz(f.size) + '</span></span>' +
        '<select class="field sel" onchange="S.ep.files[' + i + '].lang=this.value">' + ['zh', 'th', 'en'].map(function (l) { return '<option value="' + l + '"' + ((f.lang || 'zh') === l ? ' selected' : '') + '>' + EDU_LANG[l] + '</option>'; }).join('') + '</select>' +
        '<button class="lnk" onclick="S.ep.files.splice(' + i + ',1);render()">移除</button></div>'; }).join('') + '</div>' : '') +
    (b.up ? loading('上傳中…（' + b.up + ' 個）') : '') +
    (b.files.length < 5 ? '<label class="btn ghost filebtn">' + ic('plus', 18, 2.4) + '選擇檔案<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onchange="epFiles(this)" hidden></label>' : '') +
    (b.files.length ? '<div class="muted sm2">同一份教材有中文、泰文版，各傳一個並選語言；同仁手機選泰文就先看到泰文版。</div>' : '') +
    '<label class="nl" for="epL">相關連結（選填，例如影片）</label><input id="epL" class="field" inputmode="url" placeholder="https://" value="' + esc(b.link) + '" oninput="S.ep.link=this.value">' + '</div>';
  if (course) {
    h += '<div class="sec">測驗<small>選填，最多 10 題，全對才算完成</small></div>' + b.quiz.map(function (q, i) {
      return '<div class="card"><div class="mr"><b>第 ' + (i + 1) + ' 題</b><button class="lnk" onclick="S.ep.quiz.splice(' + i + ',1);render()">刪除</button></div>' +
        '<input class="field" placeholder="題目" value="' + esc(q.q) + '" oninput="S.ep.quiz[' + i + '].q=this.value">' +
        q.opts.map(function (o, k) { return '<label class="ck"><input type="radio" name="qa' + i + '"' + (q.ans === k ? ' checked' : '') + ' onchange="S.ep.quiz[' + i + '].ans=' + k + '" title="正確答案"><input class="field" placeholder="選項 ' + (k + 1) + '" value="' + esc(o) + '" oninput="S.ep.quiz[' + i + '].opts[' + k + ']=this.value"></label>'; }).join('') +
        '<div class="muted sm2">點選項左邊的圓圈＝正確答案</div></div>';
    }).join('') + (b.quiz.length < 10 ? '<button class="btn ghost" onclick="S.ep.quiz.push({q:\'\',opts:[\'\',\'\',\'\'],ans:0});render()">' + ic('plus', 18, 2.4) + '加一題</button>' : '');
  }
  h += '<div class="sec">3. 發給誰</div><div class="seg">' + [['all', '全部人員'], ['dept', '指定部門'], ['name', '指定人員']].map(function (t) {
    return '<button class="' + (b.mode === t[0] ? 'on' : '') + '" onclick="S.ep.mode=' + jsq(t[0]) + ';render()">' + t[1] + '</button>'; }).join('') + '</div>';
  if (b.mode === 'dept') h += '<div class="chips wrap">' + b.depts.map(function (d) {
    return '<button class="chip' + (b.depts2[d.id] ? ' on' : '') + '" onclick="S.ep.depts2[' + jsq(d.id) + ']=!S.ep.depts2[' + jsq(d.id) + '];render()">' + esc(d.id) + '・' + d.people.length + ' 人</button>'; }).join('') + '</div>';
  if (b.mode !== 'name') h += '<label class="ck"><input type="checkbox"' + (b.mgrOnly ? ' checked' : '') + ' onchange="S.ep.mgrOnly=this.checked;render()">只發給單位負責人</label>';
  if (b.mode === 'name') h += b.depts.map(function (d) {
    return '<div class="sec">' + esc(d.id) + '</div><div class="card">' + d.people.map(function (x) {
      return '<label class="ck"><input type="checkbox"' + (b.names[x.name] ? ' checked' : '') + ' onchange="S.ep.names[' + jsq(x.name) + ']=this.checked;epBar()"><span>' + esc(x.name) + '</span></label>'; }).join('') + '</div>'; }).join('');
  h += '<div class="card">' + (course ? '' : '<label class="ck"><input type="checkbox"' + (b.needAck ? ' checked' : '') + ' onchange="S.ep.needAck=this.checked">要同仁看完按「我已閱讀」</label>') +
    '<label class="ck"><input type="checkbox"' + (b.mail ? ' checked' : '') + ' onchange="S.ep.mail=this.checked">另外寄 Email 給有信箱的人</label></div>';
  $('app').innerHTML = h;
  epBar();
};
function epCount() {
  var b = S.ep, set = {};
  b.depts.forEach(function (d) { d.people.forEach(function (x) {
    var hit = b.mode === 'all' || (b.mode === 'dept' && b.depts2[d.id]);
    if (b.mode === 'name' ? b.names[x.name] : hit && (!b.mgrOnly || x.role === '單位負責人')) set[x.name] = 1; }); });
  delete set[S.me.person.name];
  return Object.keys(set).length;
}
function epBar() {
  if (S.page !== 'eduPost' || !S.ep) return;
  var b = S.ep, n = epCount(), ok = n && b.title.trim() && (b.body.trim() || b.files.length || b.link.trim()) && !b.up;
  bar('<button class="btn"' + (ok ? '' : ' disabled') + ' onclick="epSend()">' + ic('book', 22, 2.4) + (b.up ? '附件上傳中…' : !n ? '先選要發給誰' : ok ? '發布（' + n + ' 人）' : '寫好標題和內容就能發布（' + n + ' 人）') + '</button>');
}
var EDU_MAX = 10 * 1024 * 1024;
function epFiles(inp) {
  var fs = [].slice.call(inp.files || []).slice(0, 5 - S.ep.files.length);
  inp.value = '';
  fs.forEach(function (f) {
    if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(f.type)) return toast(esc(f.name) + '：只收 PDF、JPG、PNG', 'err', 4000);
    if (f.size > EDU_MAX) return toast(esc(f.name) + '：超過 10MB，請先壓縮', 'err', 4000);
    S.ep.up++; render();
    var rd = new FileReader();
    rd.onload = function () {
      api('eduUp', { name: f.name, mime: f.type, data: String(rd.result).split(',')[1] }).then(function (r) { r.lang = /泰|thai|_th\b|th\./i.test(f.name) ? 'th' : /_en\b|english/i.test(f.name) ? 'en' : 'zh'; S.ep.files.push(r); })
        .catch(function (e) { toast(esc(f.name + '：' + e.message), 'err', 5000); })
        .then(function () { S.ep.up--; if (S.page === 'eduPost') render(); });
    };
    rd.onerror = function () { S.ep.up--; toast(esc(f.name) + '：讀不到這個檔案', 'err'); render(); };
    rd.readAsDataURL(f);
  });
}
function epSend() {
  var b = S.ep, n = epCount();
  if (!confirm('發布「' + b.title.trim() + '」給 ' + n + ' 人？')) return;
  if (!navigator.onLine) return toast('沒有網路，要連上網路才能發布', 'err', 3500);
  var to = b.mode === 'all' ? { all: true } : b.mode === 'dept' ? { depts: Object.keys(b.depts2).filter(function (k) { return b.depts2[k]; }) } : { names: Object.keys(b.names).filter(function (k) { return b.names[k]; }) };
  if (b.mode !== 'name' && b.mgrOnly) to.roles = ['單位負責人'];
  busyOn('發布中…');
  api('eduPost', { cat: b.cat, title: b.title, body: b.body, link: b.link.trim(), files: b.files, to: to, needAck: b.needAck, mail: b.mail,
                   hours: b.hours, teacher: b.teacher, due: b.due, quiz: b.quiz, topic: b.topic.trim() || b.title.trim() }).then(function (r) {
    busyOff(); toast('已發布給 ' + r.n + ' 人', 'ok', 3000); S.ep = null; S.edu = null; S.es = null; back();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
// 環安衛：閱讀與完成紀錄（課程看完成、文宣看已讀／確認），可下架
PLAT_PAGES.eduStats = function () {
  setTitle('閱讀紀錄');
  if (!isEhs()) return back();
  if (!S.es) {
    $('app').innerHTML = loading('讀取中…');
    apiR('eduStats', {}).then(function (r) { S.es = { list: r.list, open: {} }; if (S.page === 'eduStats') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到閱讀紀錄', e.message); });
    return;
  }
  var s = S.es;
  if (!s.list.length) { $('app').innerHTML = '<div class="empty">還沒有發布過文宣</div>'; return; }
  $('app').innerHTML = '<div class="list">' + s.list.map(function (x) {
    var done = x.course ? x.done : x.needAck ? x.acked : x.opened, op = s.open[x.id], off = x.status === '下架';
    var lab = x.course ? '完成 ' : x.needAck ? '已確認 ' : '已讀 ', nd = x.course ? '還沒完成：' : x.needAck ? '還沒確認：' : '還沒打開：';
    return '<div class="li cs' + (off ? ' off' : '') + '"><button class="mn" onclick="S.es.open[' + jsq(x.id) + ']=!S.es.open[' + jsq(x.id) + '];render()"><span class="mt">' + esc(x.cat + '・' + x.time.slice(5).replace('-', '/') + '・' + x.to + (off ? '・已下架' : '')) + '</span>' +
      '<span class="nm">' + esc(x.title) + '</span><span class="mt">打開 ' + x.opened + '/' + x.n + (x.course ? '・完成 ' + x.done + '/' + x.n + (x.quiz ? '・測驗 ' + x.quiz + ' 題' : '') + (x.due ? '・期限 ' + md(x.due) : '') : x.needAck ? '・確認 ' + x.acked + '/' + x.n : '') + '</span>' +
      (op ? '<span class="mt' + (x.notDone.length ? ' wn' : '') + '">' + esc(x.notDone.length ? nd + x.notDone.join('、') : '全部都完成了') + '</span>' : '') + '</button>' +
      '<span class="cs2">' + pill(done === x.n ? 'ok' : 'warn', done === x.n ? 'check' : '', lab + done + '/' + x.n) +
      (x.course ? (/^待匯出/.test(x.exported) ? pill('info', '', '待匯入 NAS') : /^已匯出/.test(x.exported) ? pill('ok', 'check', '已匯入 NAS') : '') : '') +
      (x.course && x.done && !/^待匯出/.test(x.exported) ? '<button class="lnk" onclick="eduArch(' + jsq(x.id) + ',' + x.done + ',' + x.n + ')">' + (/^已匯出/.test(x.exported) ? '再匯入一次' : '確認簽到完成・匯入 NAS') + '</button>' : '') +
      '<button class="lnk" onclick="eduHide(' + jsq(x.id) + ',' + (off ? 'true' : 'false') + ')">' + (off ? '重新上架' : '下架') + '</button></span></div>';
  }).join('') + '</div><div class="muted upnote">完成紀錄存在後台「教育訓練簽到」分頁（含簽名），電腦每天匯出成 NAS 的教育訓練簽到表。</div>';
};
/** 確認簽到完成 → 待匯入；電腦每天 12:15 把簽到表（P-05-01-A，分 BU／PU，含簽名）與教材放進 NAS 歷年教育訓練資料／民國年／主題 */
function eduArch(id, done, n) {
  if (!confirm((done < n ? '還有 ' + (n - done) + ' 人沒完成，沒完成的不會列在簽到表。\n\n' : '') + '確認這堂課的簽到完成，匯入 NAS？\n電腦每天 12:15 會把簽到表（P-05-01-A，分 BU／PU）和教材放進「歷年教育訓練資料／民國年／主題」。')) return;
  api('eduArchive', { id: id }).then(function (r) { S.es = null; toast('已確認，' + r.n + ' 人；明天 12:15 前匯入 NAS', 'ok', 4000); render(); })
    .catch(function (e) { toast(esc(e.message), 'err', 4500); });
}
function eduHide(id, show) {
  if (!show && !confirm('下架後同仁就看不到這則（閱讀紀錄會保留）。確定下架？')) return;
  api('eduHide', { id: id, show: show }).then(function () { S.es = null; S.edu = null; toast(show ? '已重新上架' : '已下架', 'ok'); render(); })
    .catch(function (e) { toast(esc(e.message), 'err', 4000); });
}

// ───────────── 現場巡視（環安衛，OSH-17）：EF-00-012-B 現場查核紀錄表 ─────────────
// 巡視清單（本月幾次、近 12 個月）→ 開始巡視：基本資料、16 項 ○／×／－、× 的項目填缺失：
// 責任單位（BU A～C 區、PU 製1～製5…）、常見缺失與法規條號都用點的，自己再補文字與照片 → 送出：缺失自動開「異常追蹤」；
// 紀錄由電腦填回 EF-00-012-B 存 NAS，缺失全部改善完成後再存一份「改善完成」版。
var PV_KEY = 'chk.patrol';
PLAT_PAGES.patrol = function () {
  setTitle('現場巡視');
  if (!modOn('patrol')) return back();
  var P = S.pv;
  if (!P) {
    $('app').innerHTML = loading('讀取中…');
    apiR('patrolInfo', {}).then(function (r) { S.pv = r; if (S.page === 'patrol') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到巡視紀錄', e.message); });
    return;
  }
  var t = today(), ms = [], d = new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, 1);
  for (var i = 0; i < 12; i++) { ms.unshift(d.getFullYear() + '-' + pad(d.getMonth() + 1)); d.setMonth(d.getMonth() - 1); }
  var draft = lsGet(PV_KEY, null);
  var h = '<div class="card"><div class="mr"><b>本月巡視</b>' + (P.list.length ? pill('ok', 'check', P.list.length + ' 次') : pill('ng', '', '還沒巡視')) + '</div>' +
    '<div class="pvm">' + ms.map(function (m) { var n = P.months[m] || 0; return '<span class="' + (n ? 'ok' : m < t.slice(0, 7) ? 'ng' : '') + '"><b>' + Number(m.slice(5)) + '月</b>' + n + '</span>'; }).join('') + '</div>' +
    '<div class="muted sm2">EF-00-012-B 現場查核紀錄表：每月至少一次（可抽查部分區域）。缺失會自動開「異常追蹤」給責任單位，紀錄每天由電腦存進 NAS 08 款現場查核紀錄。</div></div>';
  if (P.list.length) h += '<div class="sec">本月紀錄</div><div class="list">' + P.list.map(function (x) {
    var st = !x.defects ? pill('ok', 'check', '全部符合') : x.closed >= x.defects ? pill('ok', 'check', '缺失已全部改善') : pill('warn', '', '已改善 ' + x.closed + ' / ' + x.defects);
    return '<div class="li cs"><span class="mn"><span class="mt">' + esc(md(x.date) + ' ' + x.time + '・' + x.cat) + '</span><span class="nm">' + esc(x.areas.join('、')) + '</span>' +
      '<span class="mt">' + esc(x.exported ? (/^已匯出/.test(x.exported) ? (/改善完成 已匯出/.test(x.exported) ? '已存 NAS（含改善完成版）' : '已存 NAS') : x.exported) : '等電腦存 NAS') + '</span></span>' + st + '</div>';
  }).join('') + '</div>';
  $('app').innerHTML = h;
  bar('<button class="btn" onclick="pvStart()">' + ic('review', 22, 2.4) + (draft ? '繼續填寫巡視（' + md(draft.date) + '）' : '開始巡視') + '</button>');
};
function pvStart() {
  var d = lsGet(PV_KEY, null), now = new Date(), U = S.pv.units.map(function (u) { return u.name; });
  if (!d) d = { date: today(), time: pad(now.getHours()) + ':' + pad(now.getMinutes()) + '～', cat: S.pv.cats[0], areas: [], with_: '', res: {}, defects: [] };
  d.areas = (d.areas || []).filter(function (a) { return U.indexOf(a) >= 0; });            // 舊版草稿的區域（PU 部、BU 部…）不沿用
  if (S.pv.cats.indexOf(d.cat) < 0) d.cat = S.pv.cats[0];
  d.defects = (d.defects || []).map(function (x) {
    return { item: x.item, unit: U.indexOf(x.unit) >= 0 ? x.unit : '', place: x.place || '', picks: x.picks || [], extra: x.extra != null ? x.extra : (x.fact || ''),
             laws: x.laws || [], lawNote: x.lawNote != null ? x.lawNote : (x.law || ''), due: x.due || '', photos: x.photos || [] };
  });
  delete d.cosign;
  S.pd = d; go('patrolNew');
}
function pvSave() { if (S.pd && !S.dev) lsSet(PV_KEY, S.pd); }
/** 一筆缺失的缺失事實＝點選的常見缺失＋自己補的文字 */
function pvFact(x) {
  var it = S.pv.items[x.item - 1], a = x.picks.map(function (k) { return it.d[k][0]; });
  if (x.extra.trim()) a.push(x.extra.trim());
  return a.join('；');
}
function pvUnitChips(on, click, only) {
  var parts = [], us = S.pv.units.filter(function (u) { return !only || only.indexOf(u.name) >= 0; });
  us.forEach(function (u) { if (parts.indexOf(u.part) < 0) parts.push(u.part); });
  return parts.map(function (pt) {
    return '<div class="pvg"><span class="pvgl">' + esc(pt) + '</span><div class="chips wrap">' + us.filter(function (u) { return u.part === pt; }).map(function (u) {
      return '<button class="chip' + (on(u.name) ? ' on' : '') + '" onclick="' + click(u.name) + '">' + esc(u.name.replace(/^(BU|PU) /, '')) + '</button>';
    }).join('') + '</div></div>';
  }).join('');
}
function pvLawName(c) { return String(c).replace('§', ' 第 ') + ' 條'; }
PLAT_PAGES.patrolNew = function () {
  setTitle('現場巡視');
  var P = S.pv, d = S.pd; if (!P || !d) return back();
  var h = '<div class="sec">一、巡視基本資料</div><div class="card ev">' +
    '<div class="btns"><div><label class="nl" for="pvD">巡視日期</label><input id="pvD" class="field" type="date" max="' + today() + '" value="' + esc(d.date) + '" onchange="S.pd.date=this.value;pvSave()"></div>' +
    '<div><label class="nl" for="pvT">巡視時間</label><input id="pvT" class="field" value="' + esc(d.time) + '" placeholder="09:00～10:00" oninput="S.pd.time=this.value;pvSave()"></div></div>' +
    '<label class="nl">巡視類別</label><div class="chips wrap">' + P.cats.map(function (c) { return '<button class="chip' + (d.cat === c ? ' on' : '') + '" onclick="S.pd.cat=' + jsq(c) + ';pvSave();keepY(render)">' + esc(c) + '</button>'; }).join('') + '</div>' +
    '<label class="nl">巡視區域（可複選；抽查就勾這次去的區域）</label>' +
    pvUnitChips(function (n) { return d.areas.indexOf(n) >= 0; }, function (n) { return 'pvArea(' + jsq(n) + ')'; }) +
    '<label class="nl" for="pvW">會同人員（選填）</label><input id="pvW" class="field" value="' + esc(d.with_) + '" placeholder="例：曾柏維（BU）" oninput="S.pd.with_=this.value;pvSave()"></div>';
  var n = P.items.filter(function (x, i) { return d.res[i + 1]; }).length;
  h += '<div class="sec">二、查核重點<small>' + n + ' / ' + P.items.length + '</small></div><button class="btn ghost" onclick="pvAllOk()">' + ic('check', 18, 3) + '還沒填的全部「○ 符合」</button>' +
    P.items.map(function (it, i) { var k = i + 1, v = d.res[k];
      return '<div class="card pvi' + (v === 'ng' ? ' over' : '') + '" id="pv_' + k + '"><b>' + k + '. ' + esc(it.t) + '</b><div class="seg">' +
        [['ok', '○ 符合'], ['ng', '× 待改善'], ['na', '－ 未實查']].map(function (o) { return '<button class="' + (v === o[0] ? 'on' + (o[0] === 'ng' ? ' ngc' : '') : '') + '" onclick="pvRes(' + k + ',' + jsq(o[0]) + ')">' + o[1] + '</button>'; }).join('') + '</div></div>';
    }).join('');
  var ngs = Object.keys(d.res).filter(function (k) { return d.res[k] === 'ng'; }).map(Number).sort(function (a, b) { return a - b; });
  h += '<div class="sec">三、發現缺失與改善要求</div>';
  if (!ngs.length) h += '<div class="muted upnote">打「×」的項目會在這裡填缺失。</div>';
  d.defects.forEach(function (x, j) {
    var it = P.items[x.item - 1], J = 'S.pd.defects[' + j + ']', u = P.units.filter(function (y) { return y.name === x.unit; })[0];
    var few = d.areas.length && !x.allU && (!x.unit || d.areas.indexOf(x.unit) >= 0);   // 先只列這次巡視的區域，不夠再展開
    h += '<div class="card ev pvd" id="pvd_' + j + '"><div class="mr"><b>缺失 ' + (j + 1) + '・第 ' + x.item + ' 項</b><button class="lnk" onclick="pvDelDef(' + j + ')">刪除</button></div><div class="muted sm2">' + esc(it.t) + '</div>' +
      '<label class="nl">責任單位</label>' + pvUnitChips(function (nm) { return x.unit === nm; }, function (nm) { return J + '.unit=' + jsq(nm) + ';pvSave();keepY(render)'; }, few ? d.areas : null) +
      (few ? '<button class="lnk" onclick="' + J + '.allU=1;keepY(render)">其他單位…</button>' : '') +
      (u && !u.app ? '<div class="muted sm2">這個單位還沒用 App，缺失由環安衛中心追蹤。</div>' : '') +
      '<label class="nl">缺失事實（點選，可複選）</label><div class="pvpk">' + it.d.map(function (p, k) { var on = x.picks.indexOf(k) >= 0;
        return '<button class="pvp' + (on ? ' on' : '') + '" onclick="pvPick(' + j + ',' + k + ')">' + (on ? ic('check', 14, 3) : '') + '<span>' + esc(p[0]) + '</span>' + (p[1] ? '<small>' + esc(pvLawName(p[1])) + '</small>' : '') + '</button>'; }).join('') + '</div>' +
      '<textarea class="note plain" placeholder="補充說明（選填）：位置、數量、看到的情形" oninput="' + J + '.extra=this.value;pvSave();pvBar()">' + esc(x.extra) + '</textarea>' +
      '<label class="nl">法規依據（點選，可複選）</label><div class="chips wrap">' + it.law.map(function (c) { var on = x.laws.indexOf(c) >= 0;
        return '<button class="chip' + (on ? ' on' : '') + '" onclick="pvLaw(' + j + ',' + jsq(c) + ')">' + esc(pvLawName(c)) + '</button>'; }).join('') + '</div>' +
      '<input class="field" value="' + esc(x.lawNote) + '" placeholder="其他法規或公司規定（選填）" oninput="' + J + '.lawNote=this.value;pvSave()">' +
      '<label class="nl">位置／設備（選填）</label><input class="field" value="' + esc(x.place) + '" placeholder="例：二樓攪拌區 3 號槽" oninput="' + J + '.place=this.value;pvSave()">' +
      '<label class="nl">改善期限</label><div class="btns"><input class="field" type="date" value="' + esc(x.due) + '" onchange="' + J + '.due=this.value;pvSave();keepY(render)">' +
      '<div class="chips wrap">' + [[7, '1 週'], [14, '2 週'], [30, '1 個月']].map(function (o) { return '<button class="chip' + (x.due === pvDue(o[0]) ? ' on' : '') + '" onclick="' + J + '.due=pvDue(' + o[0] + ');pvSave();keepY(render)">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<label class="nl">現場照片</label><div class="pics sm">' + x.photos.map(function (ph, k) { return '<div class="pic"><img src="' + esc(ph.t) + '" alt="照片"><button class="px" aria-label="移除這張" onclick="' + J + '.photos.splice(' + k + ',1);pvSave();keepY(render)">' + ic('x', 16, 3) + '</button></div>'; }).join('') +
      (x.photos.length < 4 ? '<label class="pic add">' + ic('plus', 22, 2.6) + '<span>拍照／選照片</span><input type="file" accept="image/*" hidden onchange="pvPic(this,' + j + ')"></label>' : '') + '</div></div>';
  });
  if (ngs.length) h += '<div class="btns">' + ngs.map(function (k) { return '<button class="btn ghost" onclick="pvAddDef(' + k + ')">' + ic('plus', 16, 2.4) + '第 ' + k + ' 項再加一筆</button>'; }).join('') + '</div>';
  h += '<div class="muted upnote">送出時帶入您的簽名（' + esc(S.me.person.name) + '）。</div>';
  $('app').innerHTML = h;
  pvBar();
};
function pvDue(n) { var x = new Date(S.pd.date + 'T00:00:00'); x.setDate(x.getDate() + n); return ymd(x); }
function pvArea(a) { var d = S.pd, i = d.areas.indexOf(a); if (i >= 0) d.areas.splice(i, 1); else d.areas.push(a); pvSave(); keepY(render); }
function pvRes(k, v) {
  var d = S.pd; d.res[k] = v;
  if (v === 'ng' && !d.defects.some(function (x) { return x.item === k; })) pvAddDef(k, true);
  if (v !== 'ng') d.defects = d.defects.filter(function (x) { return x.item !== k || x.picks.length || x.extra.trim() || x.photos.length; });
  pvSave(); keepY(render);
}
function pvAllOk() { var d = S.pd; for (var k = 1; k <= S.pv.items.length; k++) if (!d.res[k]) d.res[k] = 'ok'; pvSave(); keepY(render); }
function pvAddDef(k, silent) {
  var d = S.pd;
  d.defects.push({ item: k, unit: d.areas.length === 1 ? d.areas[0] : '', place: '', picks: [], extra: '', laws: [], lawNote: '', due: pvDue(14), photos: [] });   // 只巡一個區域就先帶那個單位
  d.defects.sort(function (a, b) { return a.item - b.item; });
  pvSave(); if (!silent) keepY(render);
}
/** 點常見缺失：勾／取消，順便把對應的法條帶進「法規依據」（取消時，沒有其他勾選用到的條文就拿掉） */
function pvPick(j, k) {
  var x = S.pd.defects[j], it = S.pv.items[x.item - 1], i = x.picks.indexOf(k), law = it.d[k][1];
  if (i >= 0) {
    x.picks.splice(i, 1);
    if (law && !x.picks.some(function (q) { return it.d[q][1] === law; })) x.laws = x.laws.filter(function (c) { return c !== law; });
  } else {
    x.picks.push(k); x.picks.sort(function (a, b) { return a - b; });
    if (law && x.laws.indexOf(law) < 0) x.laws.push(law);
  }
  pvSave(); keepY(render);
}
function pvLaw(j, c) { var x = S.pd.defects[j], i = x.laws.indexOf(c); if (i >= 0) x.laws.splice(i, 1); else x.laws.push(c); pvSave(); keepY(render); }
function pvDelDef(j) { if (!confirm('刪除這筆缺失？')) return; S.pd.defects.splice(j, 1); pvSave(); keepY(render); }
function pvPic(inp, j) {
  var file = inp.files && inp.files[0]; inp.value = '';
  photoUp(file, { __api: 'patrolPhoto' }, function (p) { S.pd.defects[j].photos.push(p); pvSave(); keepY(render); });
}
function pvMissing() {
  var d = S.pd, m = [];
  if (!d.areas.length) m.push(['勾巡視區域', null]);
  for (var k = 1; k <= S.pv.items.length; k++) if (!d.res[k]) { m.push(['第 ' + k + ' 項還沒填', 'pv_' + k]); break; }
  d.defects.forEach(function (x, j) {
    if (!x.unit) m.push(['缺失 ' + (j + 1) + ' 要選責任單位', 'pvd_' + j]);
    else if (pvFact(x).replace(/\s/g, '').length < 4) m.push(['缺失 ' + (j + 1) + ' 要點選或寫缺失事實', 'pvd_' + j]);
    else if (!x.due) m.push(['缺失 ' + (j + 1) + ' 要選改善期限', 'pvd_' + j]);
  });
  return m;
}
function pvBar() {
  if (S.page !== 'patrolNew') return;
  var m = pvMissing();
  bar(m.length ? '<button class="btn" onclick="pvJump()">' + ic('down', 22, 2.6) + esc(m[0][0]) + '</button>' : '<button class="btn" onclick="pvSend()">' + ic('check', 22, 3) + '送出巡視紀錄</button>');
}
function pvJump() { var m = pvMissing()[0]; if (m && m[1] && $(m[1])) $(m[1]).scrollIntoView({ behavior: 'smooth', block: 'center' }); else toast(m ? m[0] : '', 'err'); }
function pvSend() {
  var d = S.pd;
  if (S.dev) return devBlock('現場巡視紀錄');
  if (!confirm('送出這次巡視？' + (d.defects.length ? '缺失會開「異常追蹤」通知責任單位。' : ''))) return;
  if (!navigator.onLine) return toast('沒有網路，巡視紀錄要連上網路才能送出（已存在手機）', 'err', 4000);
  busyOn('送出中…');
  api('patrolSave', { date: d.date, time: d.time, cat: d.cat, areas: d.areas, with_: d.with_, results: d.res,
    defects: d.defects.map(function (x) { return { item: x.item, unit: x.unit, place: x.place, fact: pvFact(x), laws: x.laws, lawNote: x.lawNote, due: x.due, photos: x.photos.map(function (p) { return p.id; }) }; }) }).then(function (r) {
    busyOff(); lsDel(PV_KEY); S.pd = null; S.pv = null;
    toast('已送出' + (r.tracks ? '，' + r.tracks + ' 項缺失已開異常追蹤' + (r.self && r.self.length ? '（' + r.self.join('、') + ' 由環安衛中心追蹤）' : '') : '，全部符合'), 'ok', 5000); back();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 5000); });
}

// ───────────── 危害性化學品（v0.13.1）：查自己部（PU／BU）的危害性化學品，點進去看危害重點 ─────────────
// 資料來自 NAS 危害性化學品清單，電腦排程整理後上傳，約一季更新一次；手機只讀。
// GHS 圖示：用聯合國 GHS 官方圖（維基共享資源，公有領域），檔案 ghs-<代號>.svg；不自己畫
var GHS_PIC = { explode: ['爆炸'], flame: ['易燃'], oxid: ['助燃'], gas: ['高壓氣體'], corrode: ['腐蝕'], skull: ['劇毒'], health: ['健康危害'], warn: ['有害／刺激'], env: ['危害環境'] };
function ghsIcon(k, size) {
  var g = GHS_PIC[k]; if (!g) return '';
  // 圖檔抓不到（沒網路、第一次開還沒存進手機）→ 換成文字標籤，不顯示破圖
  return '<img class="ghs" src="ghs-' + k + '.svg" width="' + size + '" height="' + size + '" alt="' + esc(g[0]) + '" onerror="ghsFail(this)">';
}
function ghsFail(img) {
  var s = document.createElement('span'); s.className = 'ghst'; s.textContent = img.alt || '危害'; img.replaceWith(s);
}
PLAT_PAGES.chem = function () {
  setTitle('危害性化學品');
  var C = S.chem;
  if (!C) {
    $('app').innerHTML = loading('讀取中…');
    apiR('chemList', {}).then(function (r) { S.chem = r; S.chemQ = ''; S.chemP = r.parts[0] || 'PU'; if (S.page === 'chem') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到化學品清單', e.message); });
    return;
  }
  var q = (S.chemQ || '').trim().toLowerCase(), part = C.parts.length > 1 ? S.chemP : C.parts[0];
  var list = C.list.filter(function (x) { return x.part === part && (!q || (x.name + ' ' + x.other + ' ' + x.cas + ' ' + x.idx + ' ' + x.use).toLowerCase().indexOf(q) >= 0); });
  var h = '<div class="card chh"><div class="chm"><b>' + (part === 'PU' ? 'PU 部' : 'BU 建材部') + '</b><span>' + '共 ' + C.list.filter(function (x) { return x.part === part; }).length + ' 項' + '</span>' +
    (C.updated ? '<span>' + esc(md(C.updated)) + '</span><span>更新</span>' : '') + '</div><div class="muted sm2">點一項看危害重點；SDS 正本在現場資料夾，依「索引碼」找。</div>' +
    (C.parts.length > 1 ? '<div class="seg2">' + C.parts.map(function (p) { return '<button class="' + (p === part ? 'on' : '') + '" onclick="S.chemP=' + jsq(p) + ';render()">' + esc(p === 'PU' ? 'PU 部' : 'BU 建材部') + '</button>'; }).join('') + '</div>' : '') +
    '<input id="chQ" class="field" type="search" placeholder="搜尋品名、CAS、索引碼" value="' + esc(S.chemQ || '') + '" oninput="S.chemQ=this.value;chemList()"></div>';
  h += '<div id="chL"></div>';
  $('app').innerHTML = h;
  chemList();
};
function chemList() {
  var C = S.chem, q = (S.chemQ || '').trim().toLowerCase(), part = C.parts.length > 1 ? S.chemP : C.parts[0];
  var list = C.list.filter(function (x) { return x.part === part && (!q || (x.name + ' ' + x.other + ' ' + x.cas + ' ' + x.idx + ' ' + x.use).toLowerCase().indexOf(q) >= 0); });
  var el = $('chL'); if (!el) return;
  var grp = null;
  el.innerHTML = list.length ? list.map(function (x) {
    var i = C.list.indexOf(x), head = '';
    if (x.sheet !== grp) { head = (grp === null ? '' : '</div>') + '<div class="chg">' + esc(x.sheet) + '</div><div class="list">'; grp = x.sheet; }
    return head + '<button class="li chi" onclick="chemOpen(' + i + ')"><span class="mn"><span class="nm">' + esc(x.name) + '</span><span class="mt">' + (x.other ? '<span>' + esc(x.other) + '</span>' : '') + (x.idx ? '<span class="chx"><i>索引碼</i> ' + esc(x.idx) + '</span>' : '') + '</span></span>' +
      '<span class="chp">' + (x.pic.length ? x.pic.slice(0, 3).map(function (k) { return ghsIcon(k, 26); }).join('') : x.hazNone ? '<span class="ch0">非危害</span>' : '') + '</span>' + ic('chev', 18, 2.6) + '</button>';
  }).join('') + '</div>' : '<div class="empty">' + (q ? '找不到「' + esc(S.chemQ) + '」' : '目前沒有資料') + '</div>';
}
function chemOpen(i) {
  var x = S.chem.list[i]; if (!x) return;
  var dd = document.createElement('div'); dd.id = 'pDlg'; dd.className = 'dlg';
  var row = function (k, v) { return v ? '<div class="chr"><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>' : ''; };
  dd.innerHTML = '<div class="bx chd"><button class="chclose" aria-label="關閉" onclick="$(\'pDlg\').remove()">' + ic('x', 26, 2.8) + '</button><div class="mr"><b class="chn">' + esc(x.name) + '</b></div>' +
    (x.other ? '<div class="muted">' + esc(x.other) + '</div>' : '') +
    (x.pic.length ? '<div class="chpics">' + x.pic.map(function (k) { return '<span>' + ghsIcon(k, 46) + '<small>' + esc(GHS_PIC[k][0]) + '</small></span>'; }).join('') + '</div>' : '') +
    (x.flag ? '<div class="chf">' + x.flag.split('、').map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' : '') +
    '<div class="chsec">危害分類</div>' + (x.haz.length ? '<ul class="chz">' + x.haz.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' + (x.hazSrc ? '<div class="chs">' + esc(x.hazSrc) + '</div>' : '') :
      x.hazNone ? '<div class="chok">' + esc(x.hazSrc || 'SDS 載明非危害物質') + '，不需危害圖式。仍請依 SDS 第八項穿戴防護具。</div>' :
      '<div class="muted">' + (x.hazSrc ? esc(x.hazSrc) + '。' : '') + '危害重點請看現場 SDS 第二項（索引碼 ' + esc(x.idx || '—') + '）。</div>') +
    chemPts(x) +
    '<div class="chsec">基本資料</div>' + row('CAS No.', x.cas) + row('使用情形', x.use) + row('製造商／供應商', x.maker) +
    '<div class="tip">不舒服、皮膚或眼睛有異狀，馬上告訴主管。現場 SDS 依索引碼 ' + esc(x.idx || '—') + ' 找。</div></div>';
  document.body.appendChild(dd);
  dd.addEventListener('click', function (e) { if (e.target === dd) dd.remove(); });
}

// v0.13.21（10/15 Jason）：明細著重「作業時注意」與「出事怎麼做」（摘自 SDS 第四～八項；掃描件用同成分 SDS；都沒有時給依危害分類的一般原則）
var PTS_K = { handle: [['處置', '作業時'], ['儲存', '儲存']], ppe: [['呼吸', '呼吸防護'], ['手部', '手套'], ['眼睛', '眼睛防護'], ['身體', '身體防護']],
  firstaid: [['吸入', '吸入'], ['皮膚', '沾到皮膚'], ['眼睛', '噴到眼睛'], ['食入', '誤食']], leak: [['洩漏時', '洩漏時'], ['清理', '清理']], fire: [['滅火劑', '滅火劑']] };
function chemPts(x) {
  var p = x.pts; if (!p) return '';
  var blk = function (sec) { var d = p[sec] || {}; return PTS_K[sec].filter(function (k) { return d[k[0]]; }).map(function (k) { return '<div class="chr"><b>' + esc(k[1]) + '</b><span>' + esc(d[k[0]]) + '</span></div>'; }).join(''); };
  var work = blk('handle') + blk('ppe'), act = (blk('firstaid') ? '<div class="chsub">急救</div>' + blk('firstaid') : '') + (blk('leak') ? '<div class="chsub">洩漏</div>' + blk('leak') : '') + (blk('fire') ? '<div class="chsub">火災</div>' + blk('fire') : '');
  var src = p.src === 'sds' ? '摘自 SDS 第四～八項' : p.src === 'ref' ? '這份 SDS 是掃描件，摘自同成分的 SDS（' + (p.ref || '') + '）' : '依危害分類整理的一般原則，細節以現場 SDS 為準';
  return (work ? '<div class="chsec">作業時注意</div>' + work : '') + (act ? '<div class="chsec">出事怎麼做</div>' + act : '') + '<div class="chs">' + esc(src) + '</div>';
}
// ───────────── 現場簽到（10/16）：工具箱會議、新進人員教育訓練 ─────────────
// 主持人：施工申請 →「工具箱會議」選今天施工的案件（或臨時會議）→ 手機出現 QR Code → 施工人員掃碼簽名、看完簡報按完成
//        → 主持人看完簡報、按「完成會議」→ PDF 寄給主持人、單位負責人、環安衛，並存 NAS。
// 參加者：掃 QR（網址 #meet=…），不用登入、不碰這支手機原本的帳號：先簽名 → 簡報滑到最後一頁 → 按「完成」。
var MEET_KIND_NAME = { toolbox: '工具箱會議', newhire: '新進人員教育訓練' };
function meetTok(id, t) {                                          // 主持人這支手機記住 QR 權杖（後端只存雜湊）
  var k = 'meet_qr:' + id;                                        // 存在這支手機：App 關掉重開 QR 還在（會議結束後就作廢）
  try { if (t) localStorage.setItem(k, t); return t || localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch (e) { return t || ''; }
}
function meetRead(id, v) {                                          // 主持人看完簡報了沒（這支手機）
  var k = 'meet_rd:' + id;
  try { if (v) localStorage.setItem(k, '1'); return !!localStorage.getItem(k); } catch (e) { return !!v; }
}
function meetLink(t) { return location.origin + location.pathname + '#meet=' + t; }
function meetQrSvg(url, px) {
  if (!window.qrcode) return '<div class="muted">（QR Code 元件沒有載入，請用下方「複製連結」）</div>';
  var q = qrcode(0, 'M'); q.addData(url); q.make();
  var n = q.getModuleCount(), cell = Math.max(2, Math.floor((px || 240) / (n + 8)));
  return q.createSvgTag({ cellSize: cell, margin: cell * 4, scalable: true });
}
function meetStatusPill(st) {
  return st === '已完成' ? pill('ok', 'check', '已完成') : st === '紙本完成' ? pill('ok', 'check', '紙本完成') : st === '進行中' ? pill('warn', 'clock', '進行中') : st === '已取消' ? pill('na', '', '已取消') : '';
}

PLAT_PAGES.meet = function () {
  setTitle('工具箱會議');
  var h0 = S.mh;
  if (!h0 || S.arg.reload) {
    $('app').innerHTML = loading('讀取今天施工的案件…');
    api('meetHome', {}).then(function (r) { S.mh = r; if (S.page === 'meet') { S.arg.reload = 0; render(); } })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到資料', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
    return;
  }
  var h = '<div class="box info"><div class="r">' + ic('helmet', 22) + '<div class="bt"><b>施工當天、開工前在現場開</b><div class="m">按「開始」手機會出現 QR Code，施工人員用手機掃描：先簽名、看完簡報按完成，就算簽到。沒有手機的人可以用您的手機當面簽。</div></div></div></div>';
  var tbl = h0.list.filter(function (x) { return x.kind === 'toolbox'; });           // 新進人員教育訓練在「環安衛教育訓練」，這裡不列
  var live = tbl.filter(function (x) { return x.status === '進行中'; });
  if (live.length) h += '<div class="sec">進行中的會議</div><div class="list">' + live.map(function (x) {
    return '<button class="li" onclick="go(\'meetRoom\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="nm">' + esc(x.kind === 'newhire' ? x.topic : x.vendor) + '</span><span class="mt">' +
      esc((x.kind === 'newhire' ? '新進人員教育訓練' : x.work) + '・已簽 ' + x.signed + ' 人、完成 ' + x.finished + ' 人') + '</span></span>' + pill('warn', 'clock', '回到會議') + '</button>'; }).join('') + '</div>';
  h += '<div class="sec">今天施工的案件<small>承攬商系統裡，今天在施工期間的案件</small></div>';
  if (h0.casesErr) h += errBox('讀不到承攬商案件', h0.casesErr);
  else if (!h0.cases.length) h += '<div class="empty">今天沒有施工中的案件。臨時進場的廠商請用下方「臨時工具箱會議」。</div>';
  else h += h0.cases.map(function (c) {
    var meta = esc(c.work) + '・' + esc(c.area) + '<br>' + esc(md(c.start || today()) + '～' + md(c.end || c.start || today())) + (c.spec.length ? '・特殊作業：' + esc(c.spec.join('、')) : '・無特殊作業') + (c.mine ? '・<b>我承辦</b>' : '');
    var act;
    if (c.todayStatus === '已完成' || c.todayStatus === '紙本完成') act = '<div class="right">' + meetStatusPill(c.todayStatus) + '</div>';
    else if (c.todayStatus === '進行中') act = '';
    else if (!c.ok) act = '<div class="muted" style="margin-top:6px">' + ic('warn', 16) + ' 目前是「' + esc(c.status) + '」，核准後才能開工、開會</div>';
    else act = '<div class="btns r12" style="margin-top:10px"><button class="btn ghost" onclick="meetPaper(' + jsq(c.id) + ',' + jsq(c.vendor) + ')">已完成紙本簽署</button>' +
      '<button class="btn" onclick="meetStart(' + jsq(c.id) + ',this)">' + ic('check', 18, 2.6) + '開始工具箱會議</button></div>';
    return '<div class="card"><div class="fh"><b>' + esc(c.vendor) + '</b><span class="muted" style="margin-left:6px">' + esc(c.id) + '</span></div><div class="muted">' + meta + '</div>' + act + '</div>';
  }).join('');
  h += '<div class="btns" style="margin-top:12px"><button class="btn ghost" onclick="go(\'meetTemp\')">' + ic('plus', 18, 2.4) + '臨時工具箱會議</button>' +
    '<button class="btn ghost" onclick="S.mhist=null;go(\'meetHist\',{kind:\'toolbox\'})">' + ic('review', 18, 2.4) + '會議紀錄</button></div>';
  var past = tbl.filter(function (x) { return x.status !== '進行中'; });
  if (past.length) h += '<div class="sec">今天的紀錄</div><div class="list">' + past.map(function (x) {
    return '<div class="li"><span class="mn"><span class="nm">' + esc(x.kind === 'newhire' ? x.topic : x.vendor) + '</span><span class="mt">' + esc((x.kind === 'newhire' ? '新進人員' : x.work) + (x.finished ? '・' + x.finished + ' 人' : '') + (x.sent ? '・已寄 ' + x.sent : '')) + '</span></span>' + meetStatusPill(x.status) + '</div>'; }).join('') + '</div>';
  $('app').innerHTML = h;
};
function meetBusy(btn, txt) { if (!btn) return; btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>' + esc(txt); }
function meetStart(caseId, btn) {
  meetBusy(btn, '開會中…');
  api('meetCreate', { kind: 'toolbox', caseId: caseId }).then(meetOpened).catch(function (e) { toast(esc(e.message), 'err', 5000); S.mh = null; render(); });
}
function meetOpened(r, replace) {
  meetTok(r.id, r.token);
  S.mh = null;
  go('meetRoom', { id: r.id }, !!replace);          // 新進人員：開好後取代表單頁，按返回直接回新進人員頁
  if (r.resumed) toast('這場會議已經開過，換了新的 QR Code（舊的失效）', '', 4000);
}
function meetPaper(caseId, vendor) {
  if (!confirm(vendor + '\n\n今天的工具箱會議已經用紙本開完、施工人員也簽好名了？\n按確定會留下紀錄（紙本請交環安衛中心歸檔）。')) return;
  api('meetPaper', { caseId: caseId }).then(function (r) { toast(r.already ? '今天已經有紀錄了' : '已記錄：紙本工具箱會議完成', 'ok'); S.mh = null; render(); })
    .catch(function (e) { toast(esc(e.message), 'err', 5000); });
}
PLAT_PAGES.meetTemp = function () {
  setTitle('臨時工具箱會議');
  var sp = (S.mh && S.mh.specList) || ['動火', '高架', '局限', '吊掛'];
  var h = '<div class="lead">承攬商系統裡沒有的臨時施工（例：臨時叫修）。填好就可以開會。</div>' +
    '<label class="nl req" for="mtV">廠商名稱</label><input class="field" id="mtV" maxlength="40" placeholder="公司全名">' +
    '<label class="nl req" for="mtW">工程名稱（主要工作）</label><input class="field" id="mtW" maxlength="60" placeholder="例：冷卻水塔馬達更換">' +
    '<label class="nl req" for="mtA">施工區域</label><input class="field" id="mtA" maxlength="40" placeholder="例：PU 部一廠 2F">' +
    '<div class="nl">今天有沒有特殊作業（有勾的會加入那一種的安全簡報）</div><div class="chk">' +
    sp.map(function (s) { return '<label><input type="checkbox" value="' + esc(s) + '" class="mtS"> ' + esc(s) + '作業</label>'; }).join('') + '</div>' +
    '<label class="nl" for="mtE">其他潛在風險（選填）</label><input class="field" id="mtE" maxlength="100" placeholder="例：鄰近有機溶劑儲槽">' +
    '<div id="mtErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="mtBtn" onclick="meetTempGo()">' + ic('check', 22, 2.6) + '開始工具箱會議</button>');
};
function meetTempGo() {
  var v = function (id) { return ($(id).value || '').trim(); };
  var spec = [].slice.call(document.querySelectorAll('.mtS')).filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
  if (v('mtV').length < 2 || v('mtW').length < 2 || v('mtA').length < 2) return toast('請填廠商名稱、工程名稱、施工區域', 'err');
  meetBusy($('mtBtn'), '開會中…');
  api('meetCreate', { kind: 'toolbox', vendor: v('mtV'), work: v('mtW'), area: v('mtA'), spec: spec, env: v('mtE') }).then(meetOpened)
    .catch(function (e) { $('mtErr').innerHTML = errBox('沒有開成', e.message); var b = $('mtBtn'); b.disabled = false; b.className = 'btn'; b.textContent = '再試一次'; });
}
PLAT_PAGES.meetNew = function () {
  setTitle('新進人員教育訓練');
  if (!S.mh) {
    $('app').innerHTML = loading('讀取中…');
    api('meetHome', {}).then(function (r) { S.mh = r; if (S.page === 'meetNew') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到資料', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
    return;
  }
  var t = today(), nh = S.mh.list.filter(function (x) { return x.kind === 'newhire'; });
  var liveN = nh.filter(function (x) { return x.status === '進行中'; });
  var top = liveN.length ? '<div class="sec">進行中<small>點一下回到 QR Code 與簽到名單</small></div><div class="list">' + liveN.map(function (x) {
    return '<button class="li" onclick="go(\'meetRoom\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="nm">' + esc(x.topic) + '</span><span class="mt">' +
      esc(md(x.date) + ' ' + x.start + '～' + x.end + '・已簽 ' + x.signed + ' 人、完成 ' + x.finished + ' 人') + '</span></span>' + pill('warn', 'clock', '回到會議') + '</button>'; }).join('') + '</div>' : '';
  top += '<button class="btn ghost" style="margin:6px 0 4px" onclick="S.mhist=null;go(\'meetHist\',{kind:\'newhire\'})">' + ic('review', 18, 2.4) + '新進人員簽到紀錄</button>';
  var h = top + '<div class="sec">開新的一堂課</div><div class="lead">新人用手機掃 QR Code：先簽名、看完簡報按完成，就簽到。課程結束您按「完成會議」，系統產生 P-05-01-A 內訓簽到表寄給環安衛並存 NAS。</div>' +
    '<label class="nl req" for="mnT">課程名稱</label><input class="field" id="mnT" maxlength="40" value="新進人員一般安全衛生教育訓練">' +
    '<label class="nl req" for="mnD">上課日期</label><input class="field" id="mnD" type="date" max="' + t + '" value="' + t + '">' +
    '<div class="mr2"><div><label class="nl req" for="mnS">開始</label><input class="field" id="mnS" type="time" value="13:00"></div>' +
    '<div><label class="nl req" for="mnE">結束</label><input class="field" id="mnE" type="time" value="16:00"></div></div>' +
    '<div class="muted">一般安全衛生教育訓練新僱勞工至少 3 小時。</div>' +
    '<label class="nl" for="mnP">地點</label><input class="field" id="mnP" maxlength="30" value="會議室"><div id="mnErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="mnBtn" onclick="meetNewGo()">' + ic('check', 22, 2.6) + '開始，顯示 QR Code</button>');
};
function meetNewGo() {
  var v = function (id) { return ($(id).value || '').trim(); };
  if (v('mnE') <= v('mnS')) return toast('結束時間要晚於開始時間', 'err');
  meetBusy($('mnBtn'), '開始中…');
  api('meetCreate', { kind: 'newhire', topic: v('mnT'), date: v('mnD'), start: v('mnS'), end: v('mnE'), place: v('mnP') }).then(function (r) { meetOpened(r, true); })
    .catch(function (e) { $('mnErr').innerHTML = errBox('沒有開成', e.message); var b = $('mnBtn'); b.disabled = false; b.className = 'btn'; b.textContent = '再試一次'; });
}

// ── 開會中（主持人）──
PLAT_PAGES.meetRoom = function () {
  var id = S.arg.id, st = S.ms && S.ms.meet.id === id ? S.ms : null;
  setTitle('工具箱會議');
  if (!st) {
    $('app').innerHTML = loading('讀取會議…');
    meetPoll(true);
    return;
  }
  var m = st.meet, tok = meetTok(id), read = meetRead(id);
  setTitle(MEET_KIND_NAME[m.kind]);
  var h = '<div class="card"><div class="fh"><b>' + esc(m.kind === 'newhire' ? m.topic : m.vendor) + '</b></div><div class="muted">' +
    esc(m.kind === 'newhire' ? md(m.date) + ' ' + m.start + '～' + m.end + '・' + (m.place || '') : (m.caseId || '臨時') + '・' + m.work + '・' + m.area) +
    (m.spec.length ? '<br>特殊作業：' + esc(m.spec.join('、')) : '') + '</div></div>';
  if (m.status !== '進行中') {
    h += '<div class="box ok"><div class="r">' + ic('check', 22) + '<div class="bt"><b>這場會議' + esc(m.status) + '</b>' + (m.sent ? '<div class="m">PDF 已寄給：' + esc(m.sent) + '</div>' : '') + '</div></div></div>';
  } else if (tok) {
    var url = meetLink(tok);
    h += '<div class="card qrcard"><div class="qr">' + meetQrSvg(url, 260) + '</div><div class="muted" style="text-align:center">請' + (m.kind === 'newhire' ? '新進同仁' : '施工人員') + '用手機相機掃描</div>' +
      '<div class="btns r3"><button class="btn ghost" onclick="shareLink(' + jsq('員和工業' + MEET_KIND_NAME[m.kind] + '簽到（打開後先簽名、看完簡報按完成）') + ',' + jsq(url) + ')">' + ic('share', 18, 2.4) + '傳連結</button>' +
      '<button class="btn ghost" onclick="copyText(' + jsq(url) + ',\'連結已複製\')">' + ic('copy', 18, 2.2) + '複製</button>' +
      '<button class="btn ghost" onclick="meetNewQr()">' + ic('refresh', 18, 2.2) + '換新 QR</button></div></div>';
  } else {
    h += '<div class="card"><div class="muted">這支手機沒有這場會議的 QR Code（可能重新開過 App）。按下面產生新的，舊的會失效。</div><button class="btn" onclick="meetNewQr()">' + ic('refresh', 18, 2.4) + '顯示 QR Code</button></div>';
  }
  var done = st.atts.filter(function (a) { return a.done; }).length;
  if (m.status === '進行中') h += '<div class="btns" style="margin:4px 0 2px"><button class="btn" onclick="go(\'meetView\',{id:' + jsq(id) + '})">' + ic('book', 18, 2.4) + (read ? '再看一次簡報' : '看簡報（主持人）') + '</button>' +
    '<button class="btn ghost" onclick="go(\'meetSign\',{id:' + jsq(id) + '})">' + ic('pen', 18, 2.4) + '新增簽名（用這支手機）</button></div>' +
    '<div class="muted" style="margin-bottom:6px">看簡報時按左上角返回、或看完按「已看完，回到會議」，都會回到這一頁；會議會一直保留到您按完成或取消。</div>';
  if (m.status === '進行中' && st.roster && st.roster.length) {
    var rs = st.roster, pick = S.mRoster = S.mRoster && S.mRoster.id === id ? S.mRoster : { id: id, on: rs.filter(function (w) { return w.signed && !w.inMeet; }).map(function (w) { return w.seq; }) };
    h += '<div class="sec">本案申請的施工人員<small>勾今天有到場的，按下面帶入（沿用施工申請時本人簽的名）</small></div><div class="card">' + rs.map(function (w) {
      var dis = w.inMeet || !w.signed;
      return '<label class="ck" style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="checkbox"' + (w.inMeet || pick.on.indexOf(w.seq) >= 0 ? ' checked' : '') + (dis ? ' disabled' : '') +
        ' onchange="meetRosterTog(' + w.seq + ',this.checked)"><span><b>' + esc(w.name) + '</b>' + (w.extra ? ' <small class="muted">現場補充</small>' : '') + '<br><small class="muted">' +
        (w.inMeet ? '已在簽到名單' : w.signed ? '施工申請時已簽名' : '施工申請時還沒簽名 → 請他掃 QR 簽') + '</small></span></label>';
    }).join('') + '<button class="btn" id="mrBtn" onclick="meetRosterGo()">' + ic('check', 18, 2.6) + '帶入勾選的人（' + pick.on.filter(function (q) { return rs.some(function (w) { return w.seq === q && !w.inMeet; }); }).length + ' 位）</button>' +
      '<div class="muted sm">名單上沒有的人：請他掃上面的 QR，或按「新增簽名」。帶錯的人在下方簽到名單按垃圾桶移除。</div></div>';
  }
  if (m.status === '進行中' && st.demo) h += '<div class="muted sm" style="margin:4px 2px">示範區：施工人員掃 QR、看完簡報後重新簽名。</div>';
  h += '<div class="sec">簽到名單<small>已簽 ' + st.atts.length + ' 人，完成 ' + done + ' 人（每 5 秒更新）</small></div>';
  h += st.atts.length ? '<div class="list">' + st.atts.map(function (a) {
    var stp = a.done ? (/主持人/.test(a.how) ? pill('ok', 'check', '當面簽') : pill('ok', 'check', '已完成')) : pill('warn', 'clock', '看簡報中');
    return '<div class="li"><span class="mn"><span class="nm">' + esc(a.name) + '</span><span class="mt">' + esc(a.unit + '・' + a.signedAt + ' 簽名' + (a.readAt ? '・' + a.readAt + ' 完成' : '')) + '</span></span>' + stp +
      (m.status === '進行中' ? '<button class="btn ghost sm" aria-label="移除 ' + esc(a.name) + '" onclick="meetDel(' + a.seq + ',' + jsq(a.name) + ')">' + ic('trash', 16, 2.2) + '</button>' : '') + '</div>';
  }).join('') + '</div>' : '<div class="empty">還沒有人簽到</div>';
  if (m.status === '進行中') {
    h += '<button class="btn ghost sm" style="margin-top:14px" onclick="meetCancel()">取消這場會議</button>';
    bar(read ? '<button class="btn" onclick="go(\'meetFinish\',{id:' + jsq(id) + '})">' + ic('check', 22, 2.8) + '完成會議（' + done + ' 人）</button>'
      : '<div class="rdbar"><span>' + ic('info', 16) + ' 主持人也要把簡報看到最後一頁，才能按完成會議</span></div>');
  } else bar(m.kind === 'newhire' ? '<button class="btn" onclick="S.mh=null;S.stack=[];go(\'edu\',{},true)">回教育訓練</button>'
    : '<button class="btn" onclick="S.mh=null;go(\'meet\',{},true)">回工具箱會議</button>');
  $('app').innerHTML = h;
  meetPoll(false);
};
function meetRosterTog(seq, on) { var p = S.mRoster, k = p.on.indexOf(seq); if (on && k < 0) p.on.push(seq); if (!on && k >= 0) p.on.splice(k, 1); var y = window.scrollY; render(); window.scrollTo(0, y); }
function meetRosterGo() {
  var p = S.mRoster, rs = (S.ms && S.ms.roster) || [], seqs = p.on.filter(function (q) { return rs.some(function (w) { return w.seq === q && !w.inMeet; }); });
  if (!seqs.length) return toast('請勾選要帶入的施工人員', 'err');
  meetBusy($('mrBtn'), '帶入中…');
  api('meetRoster', { id: S.arg.id, seqs: seqs }).then(function (r) { toast('已帶入 ' + r.added.length + ' 位' + (r.skipped.length ? '；' + r.skipped.join('、') : ''), 'ok', 4500); S.mRoster = null; meetPoll(true); })
    .catch(function (e) { toast(esc(e.message), 'err', 5000); render(); });
}
function meetPoll(now) {
  clearTimeout(S.mpT);
  var go1 = function () {
    if (S.page !== 'meetRoom' || document.visibilityState === 'hidden') { if (S.page === 'meetRoom') S.mpT = setTimeout(go1, 5000); return; }
    var id = S.arg.id;
    api('meetState', { id: id }, { quiet: true }).then(function (r) {
      if (S.page !== 'meetRoom' || S.arg.id !== id) return;
      var sig = JSON.stringify([r.meet.status, r.atts]), old = S.ms && S.ms.meet.id === id ? JSON.stringify([S.ms.meet.status, S.ms.atts]) : '';
      S.ms = r;
      if (sig !== old) render();
      else S.mpT = setTimeout(go1, 5000);
    }).catch(function (e) { if (!S.ms) $('app').innerHTML = errBox('讀不到會議', e.message); S.mpT = setTimeout(go1, 8000); });
  };
  if (now) go1(); else S.mpT = setTimeout(go1, 5000);
}
function meetNewQr() {
  var id = S.arg.id;
  if (meetTok(id) && !confirm('換新的 QR Code？已經掃過、還沒完成的人要重掃。')) return;
  api('meetQr', { id: id }).then(function (r) { meetTok(id, r.token); render(); }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
function meetDel(seq, name) {
  if (!confirm('把「' + name + '」從簽到名單移除？')) return;
  api('meetRemove', { id: S.arg.id, seq: seq }).then(function () { S.ms = null; render(); }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
function meetCancel() {
  if (!confirm('取消這場會議？QR Code 會失效，簽到紀錄不會產生 PDF。')) return;
  var nhk = S.ms && S.ms.meet.kind === 'newhire';
  api('meetCancel', { id: S.arg.id }).then(function () { S.mh = null; S.ms = null; go(nhk ? 'meetNew' : 'meet', {}, true); toast('已取消', 'ok'); }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
/** 主持人用這支手機替沒手機的人當面簽 */
PLAT_PAGES.meetSign = function () {
  setTitle('新增簽名');
  var m = S.ms && S.ms.meet;
  var h = '<div class="lead">請本人在這支手機上簽名。當面簽的視為現場已聽講說明。</div>' +
    '<label class="nl req" for="msN">姓名</label><input class="field" id="msN" maxlength="20" placeholder="請寫全名">' +
    '<label class="nl req" for="msU">' + (m && m.kind === 'newhire' ? '單位（部門）' : '公司') + '</label><input class="field" id="msU" maxlength="30" value="' + esc(m && m.kind !== 'newhire' ? m.vendor : '') + '">' +
    '<div class="h2" style="margin-top:14px">請用手指簽全名</div><div class="sigwrap"><canvas id="cv" class="sigbox" aria-label="簽名區"></canvas>' +
    '<div class="right"><button class="btn ghost sm" onclick="sigClear()">' + ic('refresh', 18) + '清除重簽</button></div></div><div id="msErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="msBtn" onclick="meetSignGo()">' + ic('check', 22, 2.8) + '加入簽到</button>');
  sigInit();
};
function meetSignGo() {
  var name = ($('msN').value || '').trim(), unit = ($('msU').value || '').trim();
  var nw = nameWhy(name); if (nw) { $('msN').classList.add('bad'); $('msN').focus(); return toast(esc(nw), 'err', 4000); }
  if (!unit) return toast('請寫公司或單位', 'err');
  if (!SIG.drawn) return sigNudge();
  var img = sigExport(); if (!img) return toast('簽名太小，請簽大一點', 'err');
  meetBusy($('msBtn'), '加入中…');
  api('meetAddSign', { id: S.arg.id, name: name, unit: unit, image: img }).then(function () {
    toast(name + ' 已加入', 'ok'); S.ms = null; back();
  }).catch(function (e) { $('msErr').innerHTML = errBox('沒有加入', e.message); var b = $('msBtn'); b.disabled = false; b.className = 'btn'; b.textContent = '再試一次'; });
}
/** 簡報（主持人、參加者共用）：一頁一張直式圖，邊滑邊載；滑到最後一頁才算看完。 */
function mrStart(o) {
  S.mr = { n: o.total, got: 0, busy: false, moved: false, done: false, load: o.load, end: o.end };
  var h = '<div class="rdh">共 ' + o.total + ' 頁・滑到最後一頁才算看完</div>';
  for (var i = 0; i < o.total; i++) h += '<div class="rdp" id="mrp' + i + '"><div class="rdn">' + (i + 1) + ' / ' + o.total + '</div><div class="rdi"><span class="spin"></span></div></div>';
  h += '<div id="mrEnd" class="rdend">— 最後一頁 —</div>';
  $('app').innerHTML = (o.head || '') + h;
  mrBar(); mrLoad();
  var pg = S.page;
  window.onscroll = function () { if (S.page !== pg) { window.onscroll = null; return; } if (window.scrollY > 40) S.mr.moved = true; mrLoad(); mrCheck(); };
}
function mrSeen() { var n = 0, H = window.innerHeight; for (var i = 0; i < S.mr.n; i++) { var e = $('mrp' + i); if (e && e.getBoundingClientRect().top < H * 0.8) n = i + 1; } return n; }
function mrBar() {
  var r = S.mr; if (!r || r.done) return;
  bar('<div class="rdbar"><div class="rdpg"><i style="width:' + Math.round(100 * mrSeen() / Math.max(1, r.n)) + '%"></i></div><span>看到第 ' + mrSeen() + ' / ' + r.n + ' 頁，滑到最後一頁才算看完</span></div>');
}
function mrLoad() {
  var r = S.mr; if (!r || r.busy || r.got >= r.n) return;
  var last = $('mrp' + Math.max(0, r.got - 1));
  if (r.got && last && last.getBoundingClientRect().top > window.innerHeight * 2.5) return;
  r.busy = true;
  r.load(r.got).then(function (o) {
    o.pages.forEach(function (p) { var e = $('mrp' + p.i); if (e) e.querySelector('.rdi').innerHTML = '<img src="data:' + p.mime + ';base64,' + p.data + '" alt="第 ' + (p.i + 1) + ' 頁"' + (p.w && p.h ? ' width="' + p.w + '" height="' + p.h + '"' : '') + '>'; });
    r.got += o.pages.length; r.busy = false; mrBar(); mrLoad(); mrCheck();
  }).catch(function (e) { r.busy = false; toast(esc(e.message), 'err', 4000); setTimeout(mrLoad, 4000); });
}
function mrCheck() {
  var r = S.mr; if (!r || r.done) return;
  mrBar();
  var end = $('mrEnd'); if (!end || r.got < r.n || (!r.moved && r.n > 1)) return;
  if (end.getBoundingClientRect().top > window.innerHeight) return;
  r.done = true; end.textContent = '已看完';
  r.end();
}
PLAT_PAGES.meetView = function () {
  var id = S.arg.id;
  setTitle('簡報');
  var st = S.ms && S.ms.meet.id === id ? S.ms : null;
  if (!st) { back(); return; }
  mrStart({ total: st.total, load: function (from) { return api('meetDeck', { id: id, from: from, n: 3 }, { quiet: true }); },
    end: function () { meetRead(id, true); bar('<button class="btn" onclick="back()">' + ic('check', 22, 3) + '已看完，回到會議</button>'); toast('已看完，可以按完成會議了', 'ok'); } });
};
PLAT_PAGES.meetFinish = function () {
  var id = S.arg.id, st = S.ms && S.ms.meet.id === id ? S.ms : null;
  setTitle('完成會議');
  if (!st) { back(); return; }
  var m = st.meet, ck = S.mck && S.mck.id === id ? S.mck : null;
  if (m.kind === 'toolbox' && !ck) {
    $('app').innerHTML = loading('讀取…');
    api('meetChecks', { id: id }).then(function (r) { S.mck = Object.assign({ id: id }, r); render(); }).catch(function (e) { $('app').innerHTML = errBox('讀不到', e.message); });
    return;
  }
  var done = st.atts.filter(function (a) { return a.done; }), wait = st.atts.filter(function (a) { return !a.done; });
  var h = '<div class="box info"><div class="r">' + ic('check', 22) + '<div class="bt"><b>' + done.length + ' 人已完成簽到</b><div class="m">' + esc(done.map(function (a) { return a.name; }).join('、') || '—') + '</div></div></div></div>';
  if (wait.length) h += '<div class="sec">簽了名、還沒看完簡報<small>現場已經聽您說明的請勾選列入；沒勾的不算出席</small></div><div class="chk col">' +
    wait.map(function (a) { return '<label><input type="checkbox" class="mfI" value="' + a.seq + '"> ' + esc(a.name) + '（' + esc(a.unit) + '）</label>'; }).join('') + '</div>';
  if (m.kind === 'toolbox') {
    var c = ck.checks, box = function (k, x) { return '<label><input type="checkbox" class="mfC" data-k="' + k + '" value="' + esc(x) + '"' + (c[k].indexOf(x) >= 0 ? ' checked' : '') + '> ' + esc(x) + '</label>'; };
    h += '<div class="lead" style="margin-top:12px">以下是紀錄表（EF-45-011-A）要勾的項目，已依今天的特殊作業預先勾好，請依現場實際情形調整。</div>';
    h += '<div class="sec">二、安全宣導內容</div>' + ck.haz.map(function (g) { return '<div class="nl">' + esc(g[0]) + '</div><div class="chk">' + g[1].map(function (x) { return box('haz', x); }).join('') + '</div>'; }).join('');
    h += '<div class="sec">三、現場安全衛生措施</div>' + ck.ppe.map(function (g) { return '<div class="nl">' + esc(g[0]) + '</div><div class="chk">' + g[1].filter(function (x) { return x && x.charAt(0) !== '#'; }).map(function (x) { return box('ppe', x); }).join('') + '</div>'; }).join('');
    h += '<div class="sec">四、其他潛在風險說明</div><textarea class="field" id="mfR" rows="3" maxlength="300">' + esc(c.risk || '') + '</textarea>';
    h += '<div class="sec">五、特殊作業項目</div><div class="chk">' + ck.sp.reduce(function (a, l) { return a.concat(l); }, []).map(function (x) { return box('sp', x); }).join('') + '</div>';
  }
  h += '<div id="mfErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn" id="mfBtn" onclick="meetFinishGo()">' + ic('check', 22, 2.8) + '完成，產生紀錄並寄出</button>');
};
function meetFinishGo() {
  var id = S.arg.id, m = S.ms.meet;
  var inc = [].slice.call(document.querySelectorAll('.mfI')).filter(function (x) { return x.checked; }).map(function (x) { return Number(x.value); });
  var checks = null;
  if (m.kind === 'toolbox') {
    checks = { haz: [], ppe: [], sp: [], other: {}, risk: ($('mfR').value || '').trim() };
    [].slice.call(document.querySelectorAll('.mfC')).forEach(function (x) { if (x.checked) checks[x.getAttribute('data-k')].push(x.value); });
  }
  meetBusy($('mfBtn'), '產生紀錄、寄信中…（約 10～30 秒）');
  api('meetFinish', { id: id, hostRead: meetRead(id), include: inc, checks: checks }).then(function (r) {
    S.ms = null; S.mh = null;
    toast(r.already ? '這場會議已經完成過了' : '已完成，紀錄已寄給：' + (r.sent || []).join('、'), 'ok', 6000);
    S.stack = [];
    go('meetRoom', { id: id }, true);
  }).catch(function (e) { $('mfErr').innerHTML = errBox('沒有完成', e.message); var b = $('mfBtn'); b.disabled = false; b.className = 'btn'; b.textContent = '再試一次'; });
}
PLAT_PAGES.meetHist = function () {
  setTitle('會議紀錄');
  if (!S.mhist) {
    $('app').innerHTML = loading('讀取紀錄…');
    api('meetList', {}).then(function (r) { S.mhist = r.list; if (S.page === 'meetHist') render(); }).catch(function (e) { $('app').innerHTML = errBox('讀不到紀錄', e.message); });
    return;
  }
  var L = S.mhist.filter(function (x) { return !S.arg.kind || x.kind === S.arg.kind; });
  if (S.arg.kind === 'newhire') setTitle('新進人員簽到紀錄');
  var h = L.length ? '<div class="list">' + L.map(function (x) {
    return '<div class="li"><span class="mn"><span class="mt">' + esc(md(x.date) + '・' + MEET_KIND_NAME[x.kind] + '・主持 ' + x.host) + '</span><span class="nm">' + esc(x.kind === 'newhire' ? x.topic : x.vendor + ' ' + (x.caseId || '臨時')) + '</span>' +
      '<span class="mt">' + esc(x.finished ? x.finished + ' 人完成' : '') + '</span></span>' + meetStatusPill(x.status) +
      (x.pdf ? '<button class="btn ghost sm" onclick="meetPdfOpen(' + jsq(x.id) + ')">' + ic('pdf', 16, 2.2) + 'PDF</button>' : x.status === '進行中' ? '<button class="btn ghost sm" onclick="go(\'meetRoom\',{id:' + jsq(x.id) + '})">回到會議</button>' : '') + '</div>'; }).join('') + '</div>'
    : '<div class="empty">最近 90 天沒有會議紀錄</div>';
  $('app').innerHTML = h + '<div class="muted upnote">PDF 也會存到 NAS 職安資料夾（工具箱會議：承攬管理\\備查資料\\工具箱會議；新進人員：歷年教育訓練資料）。</div>';
};
function meetPdfOpen(id) {
  var w = window.open('', '_blank');
  toast('PDF 下載中…');
  api('meetPdf', { id: id }).then(function (r) {
    var bin = atob(r.data), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([u], { type: 'application/pdf' }));
    if (w) w.location = url; else location.href = url;
  }).catch(function (e) { if (w) w.close(); toast(esc(e.message), 'err', 4000); });
}

// ── 參加者（掃 QR 進來，不用登入）──
function meetAk() {
  var k = 'meet_ak:' + S.meet.token.slice(0, 16), v = '';
  try { v = localStorage.getItem(k) || ''; } catch (e) {}
  if (!/^[0-9a-f]{32}$/.test(v)) {
    v = ''; var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 16; i++) v += ('0' + a[i].toString(16)).slice(-2);
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  return v;
}
function meetPub(action, body) { return api(action, Object.assign({ meet: S.meet.token, akey: meetAk() }, body || {}), { token: '-' }); }
PLAT_PAGES.meetJoin = function () {
  var mt = S.meet;
  setTitle('現場簽到');
  if (!mt.d) {
    $('app').innerHTML = loading('讀取會議…');
    meetPub('meetOpen').then(function (d) { mt.d = d; render(); })
      .catch(function (e) { $('app').innerHTML = errBox(e.biz ? '這個 QR Code 不能用' : '連不上系統', e.message) + (e.biz ? '' : '<button class="btn navy" onclick="render()">再試一次</button>'); });
    return;
  }
  var d = mt.d, kind = MEET_KIND_NAME[d.kind];
  S.hero = '<div class="hero-in"><div class="brand"><span class="logo"><img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block"></span>員和工業・' + esc(kind) + '</div>' +
    '<div class="hn"><div class="h1">' + esc(d.kind === 'newhire' ? d.topic : d.vendor) + '</div><div class="hsub">' +
    esc(d.kind === 'newhire' ? md(d.date) + '・' + (d.place || '') + '・主持 ' + d.host : d.work + '・' + d.area + '・主持 ' + d.host) + '</div></div></div>';
  if (d.me && d.me.done) {
    $('app').innerHTML = '<div class="box ok"><div class="r">' + ic('check', 26) + '<div class="bt"><b>' + esc(d.me.name) + '，您已完成簽到</b><div class="m">' + esc(d.me.readAt) + ' 完成。謝謝您，可以關閉這個頁面。</div></div></div></div>' +
      '<div class="muted upnote">施工時請遵守主持人說明的安全規定；有任何異常立即停工並通知員和承辦人員。</div>';
    return;
  }
  if (!d.me) {
    var h = '<div class="steps"><div class="cur"><i></i><span>1 簽名</span></div><div><i></i><span>2 看完簡報・完成</span></div></div>' +
      '<label class="nl req" for="mjN">您的姓名</label><input class="field" id="mjN" maxlength="20" autocomplete="name" placeholder="請寫全名" value="' + esc(mt.name || '') + '" oninput="S.meet.name=this.value">' +
      '<label class="nl req" for="mjU">' + (d.kind === 'newhire' ? '單位（部門）' : '公司') + '</label><input class="field" id="mjU" maxlength="30" value="' + esc(mt.unit != null ? mt.unit : d.kind === 'newhire' ? '' : d.vendor) + '" oninput="S.meet.unit=this.value">' +
      '<div class="h2" style="margin-top:14px">請用手指簽全名</div><div class="sigwrap"><canvas id="cv" class="sigbox" aria-label="簽名區"></canvas>' +
      '<div class="right"><button class="btn ghost sm" onclick="sigClear()">' + ic('refresh', 18) + '清除重簽</button></div></div><div id="mjErr"></div>';
    $('app').innerHTML = h;
    bar('<button class="btn" id="mjBtn" onclick="meetJoinSign()">' + ic('arrow', 22, 2.6) + '簽好了，開始看簡報</button>');
    sigInit();
    return;
  }
  var head = '<div class="steps"><div class="done"><i></i><span>' + ic('check', 14, 3.2) + '1 已簽名</span></div><div class="cur"><i></i><span>2 看完簡報・完成</span></div></div>';
  mrStart({ total: d.total, head: head, load: function (from) { return meetPub('meetPagesPub', { from: from, n: 3 }); },
    end: function () { bar('<button class="btn" id="mjDone" onclick="meetJoinDone()">' + ic('check', 22, 3) + '我已看完，完成簽到</button>'); } });
};
function meetJoinSign() {
  var name = ($('mjN').value || '').trim(), unit = ($('mjU').value || '').trim();
  var nw = nameWhy(name); if (nw) { $('mjN').classList.add('bad'); $('mjN').focus(); return toast(esc(nw), 'err', 4000); }
  if (!unit) { $('mjU').classList.add('bad'); return toast('請寫公司或單位', 'err'); }
  if (!SIG.drawn) return sigNudge();
  var img = sigExport(); if (!img) return toast('簽名太小，請簽大一點', 'err');
  meetBusy($('mjBtn'), '送出中…');
  meetPub('meetSign', { name: name, unit: unit, image: img }).then(function () { S.meet.d = null; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('mjErr').innerHTML = errBox('沒有送出', e.message); var b = $('mjBtn'); b.disabled = false; b.className = 'btn'; b.textContent = '再送一次'; });
}
function meetJoinDone() {
  meetBusy($('mjDone'), '送出中…');
  meetPub('meetReadPub').then(function () { S.meet.d = null; window.scrollTo(0, 0); render(); toast('已完成簽到，謝謝您', 'ok', 4000); })
    .catch(function (e) { toast(esc(e.message), 'err', 5000); var b = $('mjDone'); if (b) { b.disabled = false; b.className = 'btn'; b.textContent = '再送一次'; } });
}

// ───────────── 開發者模式（環安衛）：用任何同仁的畫面操作、找出他卡在哪一步；只看不送出 ─────────────
// 只讀的動作帶 viewAs 給後端；會寫入的（送出、簽名、核准、上傳…）在手機上就攔下，後端也只放行這份清單。
var DEV_READ = ['me', 'chemList', 'overview', 'notices', 'dayView', 'monthView', 'packages', 'tracks', 'photoGet', 'getPdf', 'team', 'nextList',
                'eduList', 'eduGet', 'eduFile', 'consCases', 'consHome', 'consDetail', 'consVendors', 'envMe', 'envMonth', 'ping', 'meetHome', 'meetState', 'meetList', 'meetDeck', 'meetChecks', 'supportMine', 'supportPic', 'supportAll', 'xeMine', 'xeAll'];
var DEV_SELF = ['bootstrap', 'devLogs'];                       // 這些用開發者自己的身分
function devBanner() {
  return S.dev ? '<div class="devbar">' + ic('sliders', 18, 2.4) + '<span>開發者模式・' + esc(S.dev.name) + ' 的畫面（只看不送出）</span><button onclick="devEnd()">結束</button></div>' : '';
}
function devBlock(what) {
  var d = $('pDlg'); if (d) d.remove();
  d = document.createElement('div'); d.id = 'pDlg'; d.className = 'dlg'; d.setAttribute('role', 'alertdialog');
  d.innerHTML = '<div class="bx">' + ic('sliders', 36, 2.2) + '<b>開發者模式：到這一步會送出</b><p>' + esc(S.dev.name) + ' 按下去就會送出' + (what ? '「' + esc(what) + '」' : '資料') +
    '。這裡只檢查畫面，不會用他的名義送出。</p><button class="btn" onclick="$(\'pDlg\').remove()">知道了</button><button class="btn ghost" onclick="$(\'pDlg\').remove();devEnd()">結束開發者模式</button></div>';
  document.body.appendChild(d);
}
function resetCaches() { S.pkgs = null; S.tk = null; S.edu = null; S.cons = null; S.es = null; S.ep = null; S.eduItem = null; S.team = null; S.bc = null; S.view = null; S.fill = null; S.ov = null; S.guide = null; }
function devStart(name) {
  busyOn('切換到 ' + name + ' 的畫面…');
  S.dev = { name: name };
  api('me', {}).then(function (m) {
    busyOff(); resetCaches(); S.me = normMe(m); S.stack = []; S.landed = true;
    go(landing(), {}, true);
    toast('開發者模式：現在看到的是 ' + esc(name) + ' 的畫面', 'ok', 3500);
  }).catch(function (e) { busyOff(); S.dev = null; toast(esc(e.message), 'err', 4000); });
}
function devEnd() {
  S.dev = null; resetCaches();
  var raw = lsGet(LS.ME, null); S.me = raw ? normMe(raw) : null;
  S.stack = []; go('menu', {}, true); refreshMe();
}
var PAGE_NAME = { home: '日常檢點首頁', menu: '主選單', fill: '填寫檢點表', month: '月份紀錄', smConfirm: '月結送審確認', sign: '簽名', login: '登入', mine: '我的表單',
  claim: '申請表單', track: '異常追蹤', trackFix: '填寫改善', notice: '通知', guide: '使用教學', settings: '設定', shareMake: '請人代填', packages: '審核紀錄',
  team: '部門管理', edu: '教育訓練', eduItem: '教育訓練內容', eduPost: '發布教育訓練', cons: '施工申請', env: '環保抄表', months: '月結紀錄', pick: '其他檢查表',
  remind: '提醒設定', bc: '廣播', proxy: '代填', psign: '代填簽名', nextOwners: '下月負責人', teamEdit: '部門管理', teamPerson: '部門管理', devPick: '開發者模式', devPerson: '開發者模式',
  support: '問題回報', supportNew: '問題回報・新問題', supAdmin: '全部問題回報', supAdminItem: '問題回報（環安衛）', xiaoen: '問小恩', supportItem: '問題回報・對話', agent: '小恩助理團隊' };
// 同仁手機的操作經過（最近 15 個畫面）：遇到錯誤時一起回報，開發者看得到他是從哪裡一路點到卡住的
var TRAIL = [];
function trailPush(p) {
  var d = new Date(), f = S.fill && S.me && S.me.forms ? S.me.forms[S.fill.form] : null;
  var lab = (PAGE_NAME[p] || p) + (p === 'fill' && f ? '（' + f.name.slice(0, 12) + '）' : '');
  if (TRAIL.length && TRAIL[TRAIL.length - 1].p === p) return;
  TRAIL.push({ p: p, s: lab + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) });
  if (TRAIL.length > 15) TRAIL.shift();
}
var CLOG = { last: {}, n: 0, t0: Date.now() };
function clientErr(msg) {
  try {
    if (S.dev || S.share || !S.me || !lsGet(LS.TOKEN, '') || !navigator.onLine) return;
    var m = String(msg || '').replace(/<[^>]+>/g, '').trim().slice(0, 300); if (!m) return;
    var now = Date.now();
    if (CLOG.last[m] && now - CLOG.last[m] < 60000) return;     // 同一個錯誤一分鐘內只報一次
    if (now - CLOG.t0 > 600000) { CLOG.t0 = now; CLOG.n = 0; }
    if (++CLOG.n > 6) return;                                     // 十分鐘最多 6 則
    CLOG.last[m] = now;
    api('clientLog', { error: m, page: PAGE_NAME[S.cur] || S.cur, trail: TRAIL.map(function (x) { return x.s; }), appVer: APP_VERSION,
      ua: navigator.userAgent.slice(0, 80), lang: window.I18N ? I18N.lang() : 'zh' }, { quiet: true, noRetry: true }).catch(function () {});
  } catch (e) {}
}
window.addEventListener('error', function (e) { if (window.APP_VERSION) clientErr('程式錯誤：' + (e.message || '') + (e.filename ? '（' + String(e.filename).split('/').pop() + ':' + e.lineno + '）' : '')); });
window.addEventListener('unhandledrejection', function (e) { var r = e.reason; if (r && !r.biz && !r.dev && window.APP_VERSION) clientErr('程式錯誤：' + String(r && r.message || r).slice(0, 200)); });

PLAT_PAGES.devPick = function () {
  setTitle('開發者模式');
  if (!isEhs() || S.dev) return back();
  if (!S.dp) {
    $('app').innerHTML = loading('讀取人員名單…');
    Promise.all([api('bootstrap', {}), api('devLogs', {})]).then(function (r) { S.dp = { boot: r[0], hot: r[1].people || [] }; if (S.page === 'devPick') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到人員名單', e.message); });
    return;
  }
  var d = S.dp, me = S.me.person.name;
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">選一位同仁，就能用他的畫面操作 App，看到他看到的東西、找出卡在哪一步。<b>只能看，不會用他的名義送出任何資料。</b></div></div></div></div>';
  if (d.hot.length) h += '<div class="sec">最近 30 天有錯誤回報<small>點進去看他卡在哪</small></div><div class="list">' + d.hot.map(function (x) {
    return '<button class="li" onclick="go(\'devPerson\',{name:' + jsq(x.name) + '})"><span class="mn"><span class="nm">' + esc(x.name) + '</span><span class="mt">最近一次 ' + esc(x.last.slice(5).replace('-', '/')) + '</span></span>' + pill('ng', '', x.n + ' 則') + '</button>';
  }).join('') + '</div>';
  h += (d.boot.depts || []).map(function (dp) {
    var ps = (d.boot.people[dp] || []).filter(function (p) { return p.name !== me; });
    if (!ps.length) return '';
    return '<div class="sec">' + esc(dp) + '</div><div class="list">' + ps.map(function (p) {
      return '<button class="li" onclick="go(\'devPerson\',{name:' + jsq(p.name) + '})"><span class="mn"><span class="nm">' + esc(p.name) + '</span><span class="mt">' + esc(p.role) + '</span></span>' + ic('chev', 18, 2.6) + '</button>';
    }).join('') + '</div>';
  }).join('');
  $('app').innerHTML = h;
};
PLAT_PAGES.devPerson = function () {
  var name = S.arg.name;
  setTitle('開發者模式・' + name);
  if (!isEhs() || S.dev) return back();
  if (!S.dl || S.dl.name !== name) {
    $('app').innerHTML = loading('讀取錯誤回報…');
    api('devLogs', { name: name }).then(function (r) { S.dl = { name: name, list: r.list }; if (S.page === 'devPerson') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到錯誤回報', e.message); });
    return;
  }
  var h = '<div class="sec">' + esc(name) + ' 最近 30 天的錯誤回報</div>';
  h += S.dl.list.length ? '<div class="list">' + S.dl.list.map(function (x) {
    return '<div class="li cs"><span class="mn"><span class="mt">' + esc(x.time.slice(5).replace('-', '/') + '・' + x.page + '・v' + x.ver + (x.lang && x.lang !== 'zh' ? '・' + x.lang : '')) + '</span>' +
      '<span class="nm">' + esc(x.err) + '</span><span class="mt">經過：' + esc(x.trail || '（沒有）') + '</span><span class="mt">' + esc(x.dev) + '</span></span></div>';
  }).join('') + '</div>' : '<div class="empty">最近沒有錯誤回報</div>';
  $('app').innerHTML = h;
  bar('<button class="btn" onclick="devStart(' + jsq(name) + ')">' + ic('sliders', 22, 2.4) + '用 ' + esc(name) + ' 的畫面進入</button>');
};
/** 主選單的開發者入口（只有環安衛、不在開發者模式時） */
function devCard() {
  if (!isEhs() || S.dev) return '';
  return '<div class="mcards"><button class="mcard" style="--c:#3D4754" onclick="S.dp=null;go(\'devPick\')"><span class="mi">' + ic('sliders', 30, 2.1) + '</span>' +
    '<span class="mx"><b>開發者模式</b><small>用同仁的畫面找出卡在哪一步（只看不送出）</small></span>' + ic('chev', 20, 2.6) + '</button></div>';
}

// 問題回報、問題回報 × 使用教學、環安衛全部問題回報、小恩右下角小視窗 → sup.js（10/27 拆出）

// ───────────── 教材庫、高風險作業（10/19 Jason：教育訓練資料要成為固定教材，不是一次性閱讀；高風險作業用圖示說明主要危害與防護）─────────────
// 教材庫：同一批文宣、課程依主題分類，隨時可以再看（下架的才不見）。高風險作業卡：ISO 7010 官方安全標誌／GHS 圖示（iso-*.svg、ghs-*.svg）。
var RISK = [
  { icons: ['iso-W021'], zh: ['動火作業', ['火災、爆炸', '灼傷、眼睛傷害（強光、火花）', '感電（電銲機）'], ['作業前申請動火許可，核准才能做', '清除周圍可燃物，移不走的用防火毯蓋住', '現場備妥滅火器（至少一具）', '乙炔、氧氣鋼瓶直立固定、裝防回火裝置', '作業後確認火種熄滅，留人監看'], '職業安全衛生設施規則（火災爆炸之防止）；動火作業許可證 EF-45-005-A'],
    en: ['Hot work', ['Fire, explosion', 'Burns, eye injury (glare, sparks)', 'Electric shock (welder)'], ['Get a hot-work permit first; work only after approval', 'Remove nearby combustibles; cover what cannot be moved with a fire blanket', 'Keep at least one extinguisher on site', 'Acetylene/oxygen cylinders upright, secured, with flashback arrestors', 'After work, make sure all sparks are out and keep watch'], 'Occupational Safety and Health Facilities Rules (fire & explosion); Hot-work permit EF-45-005-A'],
    th: ['งานใช้ความร้อน (เชื่อม/ตัด)', ['ไฟไหม้ ระเบิด', 'แผลไหม้ ตาบาดเจ็บ (แสงจ้า สะเก็ดไฟ)', 'ไฟดูด (ตู้เชื่อม)'], ['ขอใบอนุญาตก่อน ได้รับอนุมัติแล้วจึงทำ', 'เก็บของติดไฟรอบๆ ออก ที่ย้ายไม่ได้ให้คลุมผ้ากันไฟ', 'มีถังดับเพลิงที่หน้างานอย่างน้อย 1 ถัง', 'ถังอะเซทิลีน/ออกซิเจนตั้งตรง ยึดแน่น มีอุปกรณ์กันไฟย้อน', 'เสร็จงานตรวจว่าไม่มีไฟค้าง และมีคนเฝ้าดู'], 'กฎความปลอดภัยฯ (การป้องกันไฟไหม้/ระเบิด); ใบอนุญาต EF-45-005-A'] },
  { icons: ['iso-W008', 'iso-M018'], zh: ['高架作業', ['墜落', '物體飛落', '施工架、合梯倒塌'], ['2 公尺以上使用全身式安全帶，鉤在穩固處', '施工架、合梯要穩，開口處設護欄', '工具放工具袋，防止掉落', '下方設圍籬或警示，禁止人員通過'], '職業安全衛生設施規則（墜落災害防止）；高架作業許可證 EF-45-008-A'],
    en: ['Work at height', ['Falls', 'Falling objects', 'Scaffold or ladder collapse'], ['Above 2 m wear a full-body harness hooked to a secure point', 'Scaffolds and ladders stable; guardrails at openings', 'Keep tools in a tool bag so nothing falls', 'Fence or mark the area below; no one walks underneath'], 'OSH Facilities Rules (fall prevention); Height work permit EF-45-008-A'],
    th: ['งานบนที่สูง', ['ตกจากที่สูง', 'ของตกใส่', 'นั่งร้าน/บันไดล้ม'], ['สูงเกิน 2 เมตร ใส่เข็มขัดนิรภัยเต็มตัว เกี่ยวกับจุดที่แข็งแรง', 'นั่งร้าน บันไดต้องมั่นคง ช่องเปิดมีราวกั้น', 'ใส่เครื่องมือในกระเป๋าเครื่องมือ กันตก', 'ด้านล่างกั้นเขตหรือติดป้าย ห้ามคนเดินผ่าน'], 'กฎความปลอดภัยฯ (การป้องกันการตก); ใบอนุญาต EF-45-008-A'] },
  { icons: ['iso-W016'], zh: ['局限空間作業', ['缺氧', '中毒（硫化氫、一氧化碳等）', '可燃性氣體火災爆炸'], ['作業前申請許可，關閉相連管路閥門', '進入前測定：O2 ≥ 18%、LEL ≤ 30%、H2S ≤ 10ppm、CO ≤ 35ppm', '持續通風，外面一定要有監視人員', '備妥救援器材；有人倒下不可貿然進去救'], '職業安全衛生設施規則（局限空間）、缺氧症預防規則；局限空間作業許可證 EF-45-007-A'],
    en: ['Confined space', ['Oxygen deficiency', 'Poisoning (H2S, CO, etc.)', 'Flammable gas fire/explosion'], ['Get a permit; close all connected pipe valves', 'Measure before entry: O2 ≥ 18%, LEL ≤ 30%, H2S ≤ 10 ppm, CO ≤ 35 ppm', 'Keep ventilating; an attendant must stay outside', 'Have rescue gear ready; never rush in to rescue someone'], 'OSH Facilities Rules (confined spaces), Hypoxia Prevention Rules; Permit EF-45-007-A'],
    th: ['ที่อับอากาศ', ['ขาดออกซิเจน', 'ก๊าซพิษ (H2S, CO ฯลฯ)', 'ก๊าซติดไฟ ไฟไหม้/ระเบิด'], ['ขอใบอนุญาต ปิดวาล์วท่อที่ต่อเข้ามาทั้งหมด', 'วัดก่อนเข้า: O2 ≥ 18%, LEL ≤ 30%, H2S ≤ 10 ppm, CO ≤ 35 ppm', 'ระบายอากาศตลอด ต้องมีคนเฝ้าอยู่ข้างนอก', 'เตรียมอุปกรณ์กู้ภัย ถ้ามีคนล้ม ห้ามรีบเข้าไปช่วย'], 'กฎความปลอดภัยฯ (ที่อับอากาศ) กฎป้องกันภาวะขาดออกซิเจน; ใบอนุญาต EF-45-007-A'] },
  { icons: ['iso-W015'], zh: ['吊掛作業', ['吊物掉落', '起重機翻覆', '被撞、被夾'], ['起重機、操作人員、吊掛人員證照齊全（一機三證）', '作業前檢查吊具、鋼索、防脫舌片', '設管制區，吊物下方禁止有人', '指派專人指揮'], '起重升降機具安全規則；吊掛作業許可證 EF-45-006-A'],
    en: ['Lifting', ['Load falling', 'Crane tipping over', 'Struck by / caught between'], ['Crane, operator and rigger all certified', 'Check slings, wire ropes and hook latches before use', 'Set a restricted zone; no one under the load', 'Assign a signal person'], 'Safety Rules for Cranes and Lifts; Lifting permit EF-45-006-A'],
    th: ['งานยก', ['ของที่ยกตกลงมา', 'เครนล้ม', 'ถูกชน/ถูกหนีบ'], ['เครน ผู้ควบคุม และผู้ผูกยก มีใบรับรองครบ', 'ก่อนทำงานตรวจสลิง ลวด และลิ้นกันหลุดของตะขอ', 'กั้นเขต ห้ามคนอยู่ใต้ของที่ยก', 'มีคนให้สัญญาณโดยเฉพาะ'], 'กฎความปลอดภัยเครื่องจักรยก; ใบอนุญาต EF-45-006-A'] },
  { icons: ['iso-W012'], zh: ['電氣作業', ['感電', '電弧灼傷', '電氣火災'], ['停電作業要上鎖、掛牌，並驗電確認', '使用絕緣手套與絕緣工具', '臨時用電接漏電斷路器，電線架高、不經過積水', '電線破損立即更換，不私接電源'], '職業安全衛生設施規則（電氣危害之防止）'],
    en: ['Electrical work', ['Electric shock', 'Arc burns', 'Electrical fire'], ['Lock out, tag out and test before work', 'Use insulated gloves and tools', 'Temporary power through an RCD; cables raised, away from water', 'Replace damaged cables at once; no unauthorized connections'], 'OSH Facilities Rules (electrical hazards)'],
    th: ['งานไฟฟ้า', ['ไฟดูด', 'แผลไหม้จากอาร์ก', 'ไฟไหม้จากไฟฟ้า'], ['ตัดไฟต้องล็อก แขวนป้าย และวัดไฟก่อน', 'ใช้ถุงมือและเครื่องมือฉนวน', 'ไฟชั่วคราวต้องผ่านเบรกเกอร์กันไฟรั่ว สายยกสูง ไม่ผ่านน้ำขัง', 'สายชำรุดเปลี่ยนทันที ห้ามต่อไฟเอง'], 'กฎความปลอดภัยฯ (อันตรายจากไฟฟ้า)'] },
  { icons: ['iso-W014'], zh: ['堆高機作業', ['撞到行人', '翻覆', '被夾、物體掉落'], ['有堆高機操作證照才能開', '每天作業前做檢點，異常不使用', '行駛繫安全帶、不超速，貨叉放低', '下車拉手煞車、拔鑰匙，貨叉落地'], '職業安全衛生管理辦法（作業前檢點）、職業安全衛生設施規則（車輛機械）'],
    en: ['Forklifts', ['Hitting pedestrians', 'Tipping over', 'Caught / falling loads'], ['Drive only with a forklift licence', 'Do the pre-use check every day; do not use if abnormal', 'Seat belt on, no speeding, forks low when moving', 'Leaving the truck: handbrake on, key out, forks on the floor'], 'OSH Management Regulations (pre-use checks), OSH Facilities Rules (vehicles)'],
    th: ['รถยก (โฟล์คลิฟท์)', ['ชนคนเดินเท้า', 'รถพลิกคว่ำ', 'ถูกหนีบ/ของตก'], ['ขับได้เฉพาะคนที่มีใบอนุญาตขับรถยก', 'ตรวจก่อนใช้ทุกวัน ผิดปกติห้ามใช้', 'คาดเข็มขัด ไม่ขับเร็ว ลดงาให้ต่ำขณะวิ่ง', 'ลงจากรถ ดึงเบรกมือ ถอดกุญแจ วางงาลงพื้น'], 'ระเบียบการจัดการความปลอดภัยฯ (ตรวจก่อนใช้) กฎความปลอดภัยฯ (ยานพาหนะ)'] },
  { icons: ['ghs-flame', 'ghs-health'], zh: ['有機溶劑作業', ['吸入中毒（頭暈、神經傷害）', '皮膚吸收', '火災'], ['作業前打開局部排氣，氣罩靠近溶劑', '戴有機濾罐口罩與耐溶劑手套', '容器隨時加蓋，沾溶劑抹布放有蓋桶', '周圍禁止火源'], '有機溶劑中毒預防規則'],
    en: ['Organic solvents', ['Poisoning by inhalation (dizziness, nerve damage)', 'Absorption through skin', 'Fire'], ['Turn on local exhaust first; hood close to the solvent', 'Wear an organic-vapour respirator and solvent-resistant gloves', 'Keep containers closed; solvent rags in a lidded bin', 'No ignition sources nearby'], 'Organic Solvent Poisoning Prevention Rules'],
    th: ['งานตัวทำละลายอินทรีย์', ['สูดดมเป็นพิษ (เวียนหัว ทำลายประสาท)', 'ซึมผ่านผิวหนัง', 'ไฟไหม้'], ['เปิดระบบดูดอากาศก่อน ให้ฮูดอยู่ใกล้ตัวทำละลาย', 'ใส่หน้ากากไส้กรองไอระเหยอินทรีย์ และถุงมือกันตัวทำละลาย', 'ปิดฝาภาชนะเสมอ ผ้าเปื้อนใส่ถังมีฝา', 'ห้ามมีแหล่งไฟใกล้ๆ'], 'กฎป้องกันพิษจากตัวทำละลายอินทรีย์'] },
  { icons: ['iso-M016'], zh: ['粉塵作業', ['塵肺症（長期吸入）', '眼睛、皮膚刺激', '粉塵爆炸'], ['先開集塵設備再作業', '戴 N95 以上防塵口罩並貼合臉部', '用吸塵器或濕式清掃，不乾掃、不用壓縮空氣吹', '投料輕放，空袋折好不拍打'], '粉塵危害預防標準'],
    en: ['Dust work', ['Pneumoconiosis (long-term inhalation)', 'Eye and skin irritation', 'Dust explosion'], ['Turn on dust collection before working', 'Wear an N95 or better mask, fitted to your face', 'Clean with a vacuum or wet method; never dry-sweep or blow with air', 'Pour gently; fold empty bags, do not shake them'], 'Dust Hazard Prevention Standards'],
    th: ['งานฝุ่น', ['โรคปอดจากฝุ่น (สูดนาน)', 'ระคายเคืองตาและผิว', 'ฝุ่นระเบิด'], ['เปิดเครื่องดูดฝุ่นก่อนทำงาน', 'ใส่หน้ากาก N95 ขึ้นไป แนบหน้าพอดี', 'ทำความสะอาดด้วยเครื่องดูดหรือแบบเปียก ห้ามกวาดแห้งหรือเป่าลม', 'เทวัตถุดิบเบาๆ พับถุงเปล่า ห้ามสะบัด'], 'มาตรฐานป้องกันอันตรายจากฝุ่น'] },
  { icons: ['iso-W023', 'ghs-corrode'], zh: ['危害性化學品', ['灼傷、中毒', '洩漏、火災'], ['用之前看容器標示與安全資料表（SDS）', '依標示穿戴手套、護目鏡、口罩', '分裝容器一定要貼標示', '洩漏用吸附棉處理並通知主管'], '危害性化學品標示及通識規則'],
    en: ['Hazardous chemicals', ['Burns, poisoning', 'Spills, fire'], ['Read the container label and SDS before use', 'Wear the gloves, goggles and mask shown on the label', 'Always label smaller containers you fill', 'Clean spills with absorbent pads and tell your supervisor'], 'Hazardous Chemicals Labelling and Communication Rules'],
    th: ['สารเคมีอันตราย', ['แผลไหม้ เป็นพิษ', 'รั่วไหล ไฟไหม้'], ['อ่านฉลากและเอกสาร SDS ก่อนใช้', 'ใส่ถุงมือ แว่นตา หน้ากาก ตามฉลาก', 'ภาชนะที่แบ่งใส่ต้องติดฉลากเสมอ', 'สารหกใช้แผ่นดูดซับ และแจ้งหัวหน้า'], 'กฎการติดฉลากและสื่อสารสารเคมีอันตราย'] }
];
var RISK_T = { zh: ['主要危害', '一定要做', '法規依據'], en: ['Main hazards', 'Must do', 'Legal basis'], th: ['อันตรายหลัก', 'ต้องทำ', 'กฎหมายที่เกี่ยวข้อง'] };
function riskLang() { var l = window.I18N ? I18N.lang() : 'zh'; return RISK[0][l] ? l : 'zh'; }
function riskHtml() {
  var l = riskLang(), T = RISK_T[l], open = S.riskOpen;
  return '<div class="muted sm" style="margin:4px 0 10px">' + esc(l === 'zh' ? '點開看主要危害與該做的防護' : l === 'th' ? 'แตะเพื่อดูอันตรายหลักและสิ่งที่ต้องทำ' : 'Tap to see the main hazards and what to do') + '</div>' +
    '<div class="list">' + RISK.map(function (r, i) {
      var d = r[l], on = open === i;
      return '<div class="li rk' + (on ? ' on' : '') + '" role="button" tabindex="0" onclick="S.riskOpen=' + (on ? 'null' : i) + ';render()" style="display:block">' +
        '<div style="display:flex;align-items:center;gap:10px">' + r.icons.map(function (n) { return '<img src="' + n + '.svg" alt="" style="width:44px;height:44px;flex-shrink:0">'; }).join('') +
        '<b style="font-size:18px;flex:1" data-no-i18n>' + esc(d[0]) + '</b>' + ic('chev', 18, 2.6) + '</div>' +
        (on ? '<div style="margin-top:10px" data-no-i18n><div class="sec" style="margin:6px 0 2px">' + esc(T[0]) + '</div><ul style="margin:0 0 6px 18px">' + d[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
          '<div class="sec" style="margin:6px 0 2px">' + esc(T[1]) + '</div><ol style="margin:0 0 6px 18px">' + d[2].map(function (x) { return '<li><b>' + esc(x) + '</b></li>'; }).join('') + '</ol>' +
          '<div class="muted sm">' + esc(T[2]) + '：' + esc(d[3]) + '</div></div>' : '') + '</div>';
    }).join('') + '</div>';
}
/** 教材庫：有教材頁或附件的（課程、文宣）依主題分組；沒主題的依類別。隨時可以再看。 */
function eduLibHtml(e) {
  var mats = e.list.filter(function (x) { return Object.keys(x.pages || {}).length || (x.files && x.files.length) || x.course; });
  if (!mats.length) return '<div class="empty">還沒有教材</div>';
  var g = {}, order = [];
  mats.forEach(function (x) { var k = x.topic || x.cat || '其他'; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(x); });
  return '<div class="muted sm" style="margin:4px 0 10px">依主題分類，隨時可以再看</div>' + order.map(function (k) {
    return '<div class="sec">' + esc(k) + '<small>' + g[k].length + '</small></div><div class="list">' + g[k].map(function (x) {
      var st = eduState(x);
      return '<button class="li" onclick="go(\'eduItem\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="mt">' + esc(x.cat + '・' + x.time.slice(0, 10).replace(/-/g, '/')) + '</span><span class="nm">' + esc(x.title) + '</span></span>' +
        (st ? pill(st[0], st[1], st[2]) : '') + '</button>';
    }).join('') + '</div>';
  }).join('');
}

// ───────────── 網頁版外框（10/29 Jason：電腦上不是把手機版放大，用同一套邏輯做成適合網頁的 App）─────────────
// 寬螢幕（≥1024px）：左邊固定選單取代手機的首頁大方塊、返回鍵與右上角按鈕；內容區放寬、首頁變工作台（左：要做的事；右：每日檢點、送審、各課狀況）。
// 手機完全照舊。資料、權限、流程兩邊同一套，只是版面不同。
var DESK_W = 1024;
function isDesk() { return window.innerWidth >= DESK_W && !S.share && !S.cpub && !S.meet; }
/** 這一頁屬於選單的哪一格（亮起來） */
function sideKey(p, a) {
  if (p === 'sheetFill') return a && a.review ? 'review' : 'grid';
  var m = { home: 'home', mine: 'mine', fill: 'mine', pick: 'mine', month: 'month', months: 'month', packages: 'review', team: 'team', track: 'track', trackFix: 'track',
    claim: 'claim', claimReview: 'team', shareMake: 'share', notice: 'notice', bc: 'bc', guide: 'guide', settings: 'settings', remind: 'settings', menu: 'menu',
    support: 'support', supportNew: 'support', supportItem: 'support', supAdmin: 'support', supAdminItem: 'support', agent: 'agent', devPick: 'dev' };
  if (m[p]) return m[p];
  var k = ['edu', 'chem', 'cons', 'env', 'patrol'].filter(function (x) { return p.indexOf(x) === 0; })[0];
  return k || '';
}
function sideReset() { S.stack = []; S.sf = null; }
var SIDE_REG = [];                                       // 這次畫出來的選單項目（快速搜尋 Ctrl+K 用）
function sItem(key, icon, label, js, badge, locked) {
  var on = sideKey(S.cur, S.arg) === key;
  if (!locked) SIDE_REG.push({ icon: icon, label: label, js: 'sideReset();' + js });
  return '<button class="sitem' + (on ? ' on' : '') + (locked ? ' lk' : '') + '"' + (on ? ' aria-current="page"' : '') + ' onclick="' + esc('sideReset();' + js) + '">' + ic(icon, 20, 2.3) +
    '<span>' + esc(label) + '</span>' + (badge ? '<i class="sb">' + esc(String(badge)) + '</i>' : locked ? ic('lock', 16, 2.4) : '') + '</button>';
}
function drawSide() {
  var el = $('side'); if (!el) return;
  var desk = isDesk(), on = desk && S.me && lsGet(LS.TOKEN, '') && ['login', 'url', 'sign', 'proxy', 'psign'].indexOf(S.cur) < 0;
  document.body.classList.toggle('desk', desk);
  document.body.classList.toggle('hasside', !!on);
  document.body.setAttribute('data-page', S.cur || '');
  document.body.classList.toggle('sidemin', !!on && sideMin());
  if (!on) { el.innerHTML = ''; return; }
  SIDE_REG = [];
  var m = S.me, p = plat() || { mods: { check: true, edu: true } }, ehs = isEhs(), mgr = isMgr(), t = today();
  var h = '<div class="sbrand"><span class="slogo">' + ic('logo', 22, 2.2) + '</span><b>員和環安衛系統</b></div>';
  h += sItem('home', 'grid', modOn('check') ? '工作台' : '主選單', modOn('check') ? "go('home',{},true)" : "go('menu',{},true)");
  if (modOn('check')) {
    h += '<div class="ssec">日常檢點</div>';
    var dd = m.depts.filter(function (d) { return m.assigns.some(function (a) { return a.dept === d.id && a.daily; }); });
    if (!ehs && dd.length) h += sItem('grid', 'pen', '表格填寫', "go('sheetFill',{dept:" + JSON.stringify(dd[0].id) + ",period:" + JSON.stringify(t.slice(0, 7)) + "},true)");
    if (!ehs && !mgr && m.assigns.some(function (a) { return a.daily || a.pick || a.missingEquip; })) h += sItem('mine', 'clip', '我的表單', "go('mine',{},true)");
    if (!ehs) { var d1 = m.depts.length === 1 ? m.depts[0].id : '';
      h += sItem('month', 'cal', demoDept(d1) ? '月曆' : '月曆・補填', d1 ? "go('month',{dept:" + JSON.stringify(d1) + ",period:" + JSON.stringify(t.slice(0, 7)) + "},true)" : "go('months',{},true)"); }
    else h += sItem('month', 'cal', '月結紀錄', "go('months',{},true)");
    if (mgr || ehs) h += sItem('review', 'review', '審核', "go('packages',{},true)", m.pendingReview || 0);
    if (mgr || ehs) h += sItem('team', 'swap', '部門管理', "S.team=null;go('team',{},true)");
    if (!ehs && !mgr && (m.claimable || []).length) h += sItem('claim', 'plus', '申請表單', "go('claim',{},true)");
    if (!ehs && dd.length) h += sItem('share', 'chat', '請人代填', "go('shareMake',{},true)");
    h += sItem('track', 'warn', '異常追蹤', "S.tk=null;go('track',{},true)", m.tracksOpen || 0);
    if (ehs) h += sItem('bc', 'bell', '廣播', "S.bc=null;go('bc',{},true)");
  }
  var others = MODS.filter(function (x) { return x.key !== 'check' && (!x.hide || modOn(x.key)); });
  if (others.length) {
    h += '<div class="ssec">其他功能</div>';
    var bd = { cons: p.consTodo || 0, edu: p.eduReady ? '!' : p.eduUnread || 0 };
    others.forEach(function (x) { h += sItem(x.key, x.icon, x.name, modOn(x.key) ? 'goMod(' + JSON.stringify(x.key) + ');S.stack=[];drawTop()' : 'permAsk(' + JSON.stringify(x.key) + ')', modOn(x.key) ? bd[x.key] : 0, !modOn(x.key)); });
  }
  if (ehs) { h += '<div class="ssec">環安衛</div>';
    if (window.agentOwner && agentOwner()) h += sItem('agent', 'spark', '小恩助理團隊', "S.agt=null;go('agent',{},true)");
    h += sItem('dev', 'sliders', '開發者模式', "S.dp=null;go('devPick',{},true)"); }
  h += '<div class="sfill"></div><div class="ssec">說明與設定</div>' + sItem('support', 'chat', '問題回報', "go('support',{},true)") +
    sItem('notice', 'bell', '通知', "go('notice',{},true)", m.unread || 0) + sItem('guide', 'info', '使用教學', "go('guide',{},true)") + sItem('settings', 'sliders', '設定', "go('settings',{},true)") +
    '<button class="sitem smin" onclick="sideToggle()" title="' + (sideMin() ? '展開選單' : '收合選單') + '">' + ic(sideMin() ? 'right' : 'back', 20, 2.3) + '<span>收合選單</span></button>' +
    '<div class="sver">' + netTag() + '<span>v' + APP_VERSION + '</span></div>';
  el.innerHTML = h;
  if (sideMin()) [].forEach.call(el.querySelectorAll('.sitem'), function (b) { var sp = b.querySelector('span'); if (sp && !b.title) b.title = sp.textContent; });
}

// ───────────── 網頁版 2.0（10/30 Jason：重新設計成真正適合電腦用的 App，不是手機放大）─────────────
// ① 上方工具列：頁名、快速搜尋（Ctrl+K）、語言、通知、使用者；② 左側選單可收合成圖示；③ 鍵盤：Ctrl+K 找功能／表單、Esc 返回、Alt+1～9 跳選單
// 手機完全照舊；這一段只在 body.hasside（電腦、已登入）時作用。
function sideMin() { return lsGet('chk.sidemin', false) === true; }
function sideToggle() { lsSet('chk.sidemin', !sideMin()); drawSide(); }
function deskOn() { return isDesk() && !!S.me && !!lsGet(LS.TOKEN, '') && ['login', 'url', 'sign', 'proxy', 'psign'].indexOf(S.cur) < 0; }
/** 網頁版上方工具列（取代手機的深藍標題列與首頁大標題）。 */
function deskTop() {
  var showBack = S.stack.length && ['home', 'login', 'url', 'proxy'].indexOf(S.cur) < 0, n = (S.me && S.me.unread) || 0;
  var L = window.I18N ? I18N.lang() : 'zh', LN = { zh: '中文', en: 'English', th: 'ไทย' };
  return devBanner() + '<div class="dtb">' +
    (showBack ? '<button class="dtb-back" id="back" aria-label="返回" title="返回（Esc）" onclick="back()">' + ic('back', 20, 2.6) + '</button>' : '') +
    '<div class="dtb-t"><div class="tb-ttl" id="ttl">' + esc(S.cur === 'home' ? '工作台' : S.title) + '</div><div class="dtb-sub">' + esc(whoLine()) + '</div></div>' +
    '<button class="dtb-search" onclick="palOpen()" aria-label="快速搜尋">' + ic('search', 18, 2.4) + '<span>找功能、表單…</span><kbd data-raw>Ctrl K</kbd></button>' +
    '<div class="dtb-r">' + netTag() +
    '<select class="dtb-lang" aria-label="語言" data-raw onchange="I18N.set(this.value)">' + ['zh', 'en', 'th'].map(function (k) { return '<option value="' + k + '"' + (k === L ? ' selected' : '') + '>' + LN[k] + '</option>'; }).join('') + '</select>' +
    '<button class="dtb-ic" aria-label="通知" title="通知" onclick="sideReset();go(\'notice\',{},true)">' + ic('bell', 20, 2.3) + (n ? '<i class="tbadge">' + (n > 99 ? '99+' : n) + '</i>' : '') + '</button>' +
    '<button class="dtb-me" onclick="sideReset();go(\'settings\',{},true)" title="設定"><span class="av" data-raw>' + esc(String(S.me.person.name || '').slice(-2)) + '</span><span class="nm">' + esc(S.me.person.name) + '<small>' + esc(S.me.person.role || '') + '</small></span></button>' +
    '</div></div>' + (S.topExtra || '');
}
// ── 快速搜尋（Ctrl+K）：選單裡的功能＋自己的每張表（每日、定期）＋各課月曆 ──
var PAL = null;
function palItems() {
  var out = SIDE_REG.map(function (x) { return { icon: x.icon, label: x.label, sub: '功能', js: x.js }; }), m = S.me, t = today();
  if (m && !isEhs()) (m.assigns || []).forEach(function (a) {
    var f = window.F && F(a.form); if (!f || !(a.daily || a.pick)) return;
    out.push({ icon: a.daily ? 'pen' : 'clip', label: a.daily ? f.name + (a.object ? ' ' + a.object : '') : (window.pickName ? pickName(a) : f.name), sub: (a.daily ? '每日檢點' : '定期檢查') + '・' + a.dept, js: 'openFill(' + jsq(a.key) + ')' });
  });
  if (m && !isEhs()) (m.depts || []).forEach(function (d) { out.push({ icon: 'cal', label: d.id + ' 月曆', sub: '月曆', js: "go('month',{dept:" + jsq(d.id) + ',period:' + jsq(t.slice(0, 7)) + "})" }); });
  return out;
}
function palOpen() {
  if (!deskOn() || PAL) return;
  PAL = { all: palItems(), sel: 0, hits: [] };
  var el = document.createElement('div'); el.id = 'pal'; el.className = 'pal';
  el.innerHTML = '<div class="palbg" onclick="palClose()"></div><div class="palbox" role="dialog" aria-label="快速搜尋"><div class="palin">' + ic('search', 20, 2.4) +
    '<input id="palq" placeholder="輸入功能或表單名稱，例：堆高機、月曆、審核" autocomplete="off" oninput="PAL.sel=0;palDraw()"></div><div class="pall" id="pall"></div>' +
    '<div class="palft"><span><kbd data-raw>↑↓</kbd> 選擇</span><span><kbd data-raw>Enter</kbd> 開啟</span><span><kbd data-raw>Esc</kbd> 關閉</span></div></div>';
  document.body.appendChild(el); palDraw(); $('palq').focus();
}
function palClose() { var el = $('pal'); if (el) el.parentNode.removeChild(el); PAL = null; }
function palHits() {
  var q = (($('palq') || {}).value || '').trim().toLowerCase(), words = q.split(/\s+/).filter(String);
  return PAL.all.filter(function (x) { var s = (x.label + ' ' + x.sub + ' ' + (window.I18N ? I18N.tr(x.label) : '')).toLowerCase(); return words.every(function (w) { return s.indexOf(w) >= 0; }); }).slice(0, 12);
}
function palDraw() {
  if (!PAL) return; var hits = palHits(); PAL.sel = Math.min(PAL.sel, Math.max(0, hits.length - 1)); PAL.hits = hits;
  $('pall').innerHTML = hits.length ? hits.map(function (x, i) {
    return '<button class="palit' + (i === PAL.sel ? ' on' : '') + '" onmousemove="if(PAL.sel!==' + i + '){PAL.sel=' + i + ';palMark()}" onclick="palGo(' + i + ')">' + ic(x.icon, 18, 2.3) + '<span class="pn">' + esc(x.label) + '</span><small>' + esc(x.sub) + '</small></button>';
  }).join('') : '<div class="palno">找不到符合的功能或表單</div>';
}
function palMark() { [].forEach.call(document.querySelectorAll('#pall .palit'), function (b, i) { b.classList.toggle('on', i === PAL.sel); }); }
function palGo(i) {
  var x = PAL && PAL.hits[i]; palClose(); if (!x) return;
  var t = document.createElement('textarea'); t.innerHTML = x.js;   // jsq() 給 onclick 用，引號是 &quot;，執行前還原
  (new Function(t.value))();
}
document.addEventListener('keydown', function (e) {
  if (PAL) {
    if (e.key === 'Escape') { e.preventDefault(); palClose(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); var n = PAL.hits.length; if (!n) return;
      PAL.sel = (PAL.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; palMark();
      var on = document.querySelector('#pall .palit.on'); if (on) on.scrollIntoView({ block: 'nearest' }); return;
    }
    if (e.key === 'Enter') { e.preventDefault(); palGo(PAL.sel); }
    return;
  }
  if (!deskOn()) return;
  var ae = document.activeElement || {}, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || '') || ae.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); palOpen(); return; }
  if (typing || document.querySelector('.xepanel') || S.cur === 'sheetFill') return;           // 表格頁 Esc、方向鍵是表格自己的
  if (e.key === 'Escape' && $('back')) { e.preventDefault(); $('back').click(); return; }
  if (e.altKey && /^[1-9]$/.test(e.key)) { var it = document.querySelectorAll('#side .sitem:not(.lk):not(.smin)')[Number(e.key) - 1]; if (it) { e.preventDefault(); it.click(); } }
});
var DESK_WAS = null;
window.addEventListener('resize', function () {
  var d = isDesk(); if (DESK_WAS === null) { DESK_WAS = d; return; }
  if (d !== DESK_WAS) { DESK_WAS = d; if (typeof render === 'function' && S.me) render(); }
});
