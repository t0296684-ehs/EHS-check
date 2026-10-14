/* 員和環安衛系統：平台層——主選單、功能權限、環保抄表、施工申請、環安衛教育訓練。
   app.js 是「日常檢點」這個功能；本檔在 app.js 之前載入，頁面與圖示在 app.js 建 PAGES／ICON 時併進去。
   新增功能的做法：MODS 加一筆（key、名稱、圖示、頁面）→ 後端 MODS／功能權限頁加一欄 → 這裡寫頁面。 */
var PLAT_VER = '0.13.13';                                   // 要跟 app.js 的 APP_VERSION 一樣（打包時會檢查）
/** 新舊檔混用自救：App 開啟時網路慢，Service Worker 會拿手機裡的舊檔頂上，可能 app.js、plat.js 一新一舊而卡在載入中。
 *  兩支檔各帶版本號，對不上就清掉手機裡存的程式檔、重新載入一次（60 秒內只做一次，不會一直重整）。 */
function platHeal() {
  try { if (Date.now() - Number(sessionStorage.getItem('chk_heal') || 0) < 60000) return; sessionStorage.setItem('chk_heal', String(Date.now())); } catch (e) { return; }
  var go = function () { location.reload(); };
  if (window.caches && caches.keys) caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(go, go); else go();
}
window.addEventListener('load', function () { if (typeof APP_VERSION === 'string' && APP_VERSION !== PLAT_VER) platHeal(); });
var PLAT_ICON = {
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  helmet: '<path d="M3 17h18M5 17v-3a7 7 0 0 1 14 0v3"/><path d="M10 7.5V5h4v2.5"/><path d="M3 17v2h18v-2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
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
  var w = workMods();
  return w.length === 1 ? modOf(w[0]).page : 'menu';
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
    cons: '給廠商的申請連結・我承辦的案件',
    edu: p.eduReady ? p.eduReady + ' 堂全員完成・待您確認匯入 NAS' : p.eduUnread ? p.eduUnread + ' 則待完成' : '教育訓練與衛教文宣',
    chem: '查作業現場的化學品與危害',
    patrol: p.patrolN ? '本月已巡視 ' + p.patrolN + ' 次' : '本月還沒巡視（EF-00-012-B）',
  };
  var badge = { check: (m.tracksOpen && !isEhs() ? m.tracksOpen : 0), edu: p.eduReady ? '!' : p.eduUnread, patrol: p.mods && p.mods.patrol && !p.patrolN && Number(today().slice(8)) >= 15 ? '!' : 0 };
  var h = '<div class="mcards">' + MODS.filter(function (x) { return !x.hide || modOn(x.key); }).map(function (x) {
    var on = modOn(x.key);
    return '<button class="mcard' + (on ? '' : ' locked') + '" style="--c:' + x.color + '" onclick="' + (on ? 'goMod(' + jsq(x.key) + ')' : 'permAsk(' + jsq(x.key) + ')') + '">' +
      '<span class="mi">' + ic(x.icon, 30, 2.1) + '</span><span class="mx"><b>' + esc(x.name) + '</b><small>' + esc(on ? subs[x.key] : '沒有權限・點這裡申請') + '</small></span>' +
      (on ? (badge[x.key] ? '<span class="mb">' + badge[x.key] + '</span>' : '') + ic('chev', 20, 2.6) : ic('lock', 20, 2.4)) + '</button>';
  }).join('') + '</div>';
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
function envNum(v) { return v === '' || v == null ? NaN : Number(v); }
function envOver(it, v, use) {
  if (it.type === '勾選') return v === 'x';
  if (it.type === '選項') return it.opts.length && v !== '' && v !== it.opts[0];
  var n = it.type === '累計' ? use : envNum(v);
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
    if (it.type === '累計' || it.type === '數值') inp = '<input class="field num' + (over ? ' bad' : '') + '" inputmode="decimal" value="' + esc(v) + '"' + (lock ? ' disabled' : '') + ' oninput="envSet(' + jsq(it.code) + ',this.value)" placeholder="' + esc(it.unit || '') + '">';
    else if (it.type === '勾選') inp = '<div class="seg">' + [['ok', '✓ 正常'], ['x', '✕ 異常']].map(function (o) { return '<button class="' + (v === o[0] ? 'on' + (o[0] === 'x' ? ' ngc' : '') : '') + '"' + (lock ? ' disabled' : '') + ' onclick="envSet(' + jsq(it.code) + ',' + jsq(o[0]) + ',1)">' + o[1] + '</button>'; }).join('') + '</div>';
    else if (it.type === '選項') inp = '<div class="seg">' + it.opts.map(function (o, k) { return '<button class="' + (v === o ? 'on' + (k ? ' ngc' : '') : '') + '"' + (lock ? ' disabled' : '') + ' onclick="envSet(' + jsq(it.code) + ',' + jsq(o) + ',1)">' + esc(o) + '</button>'; }).join('') + '</div>';
    else if (it.type === '文字') inp = '<input class="field" value="' + esc(v) + '"' + (lock ? ' disabled' : '') + ' oninput="envSet(' + jsq(it.code) + ',this.value)">';
    else inp = '<div class="calcv' + (over ? ' bad' : '') + '">' + esc(calc === '' ? '（自動計算）' : calc + (it.unit ? ' ' + it.unit : '')) + '</div>';
    var meta = [rng, it.type === '累計' && d.last[it.code] ? '上次 ' + md(d.last[it.code].date) + '：' + d.last[it.code].val + (isFinite(use) ? '・日用量 ' + use + (it.unit ? ' ' + it.unit : '') : '') : it.type === '累計' ? '第一次抄：只記讀數' : ''].filter(String).join('・');
    h += '<div class="card envi' + (over ? ' over' : '') + '" id="ev_' + esc(it.code) + '"><div class="eh"><b>' + esc(it.name) + '</b>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</div>' + inp +
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
  var E = S.env, miss = [], note = [];
  E.d.items.forEach(function (it) {
    if (it.type === '計算') return;
    var v = E.v[it.code]; if (v == null || String(v).trim() === '') { miss.push(it); return; }
    if (envOver(it, v, it.type === '累計' ? envUse(it.code, E) : NaN) && !String(E.n[it.code] || '').trim()) note.push(it);
  });
  return { miss: miss, note: note };
}
function envBar() {
  if (S.page !== 'envSys' || !S.env) return;
  var m = envMissing(), t = m.miss.length ? '還有 ' + m.miss.length + ' 項沒填・跳到「' + m.miss[0].name + '」' : m.note.length ? '「' + m.note[0].name + '」要寫說明・跳過去' : '送出 ' + md(S.env.date) + ' 的抄表';
  bar('<button class="btn" onclick="envGo()">' + ic(m.miss.length || m.note.length ? 'down' : 'check', 22, 2.6) + esc(t) + '</button>');
}
function envGo() {
  var E = S.env, m = envMissing(), first = m.miss[0] || m.note[0];
  if (first) { var el = $('ev_' + first.code); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (S.dev) return devBlock(E.sys + '抄表');
  var body = { sys: E.sys, date: E.date, values: E.v, notes: E.n };
  var job = { id: newId(), action: 'envSubmit', token: lsGet(LS.TOKEN, ''), who: S.me.person.name, key: 'env|' + E.sys + '|' + E.date, body: body, created: Date.now(), status: 'pending', label: E.sys + '抄表 ' + md(E.date) };
  obPut(job).then(function () {
    toast((navigator.onLine ? '已送出 ' : '已存在手機，有網路自動上傳：') + E.sys + '抄表 ' + md(E.date), 'ok', 3000);
    S.env = null; S.envM = null; flush(); back();
  }).catch(function (e) { toast('手機存檔失敗：' + esc(e.message), 'err', 5000); });
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
  var h = '<div class="sec">給廠商的連結<small>用 LINE 傳給廠商窗口</small></div>' +
    (L.form1 ? card(1, '廠商建檔（Form 1）', '第一次來員和施工的廠商先填一次。填完系統會寄承諾書，要蓋公司大小章回傳。同一家廠商之後不用再填。') : '') +
    (L.form2 ? card(2, '入廠施工申請（Form 2）', '每個工程一份，請廠商在施工前 3 個工作天填好。從您的 App 傳出去的連結，會先問您要不要帶入您是「員和承辦人員」。') : '') +
    '<button class="btn line" onclick="gOpenFrom(\'7-2\')">' + ic('info', 18, 2.4) + '申請流程：廠商和我各要做什麼</button>';
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
function consLoad() {
  if (!navigator.onLine) { S.cons = S.cons || { off: true, list: [] }; var el0 = $('consList'); if (el0) el0.innerHTML = consListHtml(); return; }
  apiR('consCases', {}, { quiet: true }).then(function (r) { S.cons = { at: Date.now(), list: r.list, total: r.total, demo: r.demo }; var el = $('consList'); if (el && S.page === 'cons') el.innerHTML = consListHtml(); })
    .catch(function (e) { S.cons = { at: Date.now(), err: e.message, list: [] }; var el = $('consList'); if (el && S.page === 'cons') el.innerHTML = consListHtml(); });
}
function consListHtml() {
  var c = S.cons;
  if (!c) return loading('讀取案件…');
  if (c.off) return '<div class="muted">連上網路後顯示案件</div>';
  if (c.err) return '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">' + esc(c.err) + '</div></div></div></div>';
  if (!c.list.length) return '<div class="empty">目前沒有您承辦中的案件</div>';
  return '<div class="list">' + c.list.map(function (x, i) {
    var hint = x.status === '待簽名' ? '等廠商監督人員簽名' : x.status === '施工人員簽名中' ? (x.handlerSigned ? (x.canSubmit ? '您已簽，可以提交審核' : '您已簽，等廠商提交審核') : '工人簽完後，換您簽名') :
      x.status === '待審核' ? '環安衛審核中' : x.status === '已核准' ? '已核准，可以進場' : x.status === '補件退回' ? '退回補件，請提醒廠商' : '';
    var act = '';
    if (x.sign && !x.handlerSigned) act = '<button class="btn" onclick="consSign(' + i + ')">' + ic('pen', 18, 2.4) + '在 App 內簽名</button>';
    else if (x.sign && x.canSubmit) act = '<button class="btn" onclick="consSubmit(' + i + ')">' + ic('up', 18, 2.6) + '提交審核</button>';
    return '<div class="li cs"><span class="mn"><span class="mt">' + esc(x.id + (x.owner && !x.mine ? '・承辦 ' + x.owner : '')) + '</span><span class="nm">' + esc(x.vendor) + '</span>' +
      '<span class="mt">' + esc([x.work, x.area].filter(String).join('・')) + '</span><span class="mt">' + esc((x.start ? md(x.start) : '') + (x.end && x.end !== x.start ? '～' + md(x.end) : '')) + (hint ? '・' + esc(hint) : '') + '</span>' +
      act + '</span>' + pill(CONS_PILL[x.status] || 'na', '', x.status) + '</div>';
  }).join('') + '</div>' + (c.total > c.list.length ? '<div class="muted upnote">只列進行中與最近 45 天結束的案件</div>' : '');
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
  dlg('<b>用您的簽名簽這個案件？</b><p>' + esc(x.id + '・' + x.vendor) + '<br>' + esc(x.work) + '</p><img class="sigprev" src="' + sig.image + '" alt="我的簽名">' +
    '<p class="sm">會以「員和承辦人員 ' + esc(S.me.person.name) + '」簽名，簽完不能撤回。</p>',
    [['確認簽名', function () { consSignGo(i); }, ''], ['改開簽名頁自己簽', function () { consFallback(x); }, 'ghost']]);
}
function consSignGo(i) {
  var x = S.cons.list[i];
  if (!navigator.onLine) return toast('沒有網路，簽名要連上網路', 'err', 3500);
  busyOn('簽名中…', '約 5～10 秒');
  consApi(x.sign, { action: 'handlerSign', name: S.me.person.name, dataUrl: S.me.signature.image }).then(function (r) {
    busyOff();
    if (!r.ok) return toast(esc(r.error || '簽名沒有成功'), 'err', 5000);
    x.handlerSigned = true; x.canSubmit = x.status === '施工人員簽名中';
    if (r.workersDone) dlg('<b>簽好了</b><p>工人都簽完了，要現在提交審核嗎？提交後環安衛會收到通知。</p>', [['提交審核', function () { consSubmit(i); }, '']]);
    else toast('已簽名；等工人都簽完再提交審核', 'ok', 4000);
    var el = $('consList'); if (el) el.innerHTML = consListHtml();
    if (!x.demo) S.cons.at = 0;
  }).catch(function (e) { busyOff(); if (e.noApi) { toast('承攬商系統還不能在 App 內簽名，改開原本的簽名頁', '', 3500); consFallback(x); } else toast(esc(e.message), 'err', 4000); });
}
function consSubmit(i) {
  var x = S.cons.list[i];
  busyOn('提交審核中…');
  consApi(x.sign, { action: 'submitForReview' }).then(function (r) {
    busyOff();
    if (!r.ok) return toast(esc(r.error || '提交沒有成功'), 'err', 6000);
    x.status = '待審核'; x.canSubmit = false; x.sign = null;
    toast('已提交審核，環安衛會收到通知', 'ok', 4000);
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
  if (isEhs()) h += '<div class="btns"><button class="btn" onclick="S.ep=null;go(\'eduPost\')">' + ic('plus', 18, 2.4) + '發布新文宣</button><button class="btn ghost" onclick="S.es=null;go(\'eduStats\')">' + ic('review', 18, 2.4) + '閱讀紀錄</button></div>';
  var todo = e.list.filter(function (x) { return x.course && !x.done; }).length;
  if (todo && !isEhs()) h += '<div class="box info"><div class="r">' + ic('book', 22) + '<div class="bt"><b>有 ' + todo + ' 堂教育訓練要完成</b><div class="m">看完教材、作答，按「我已完成」就會自動簽到。</div></div></div></div>';
  h += '<div class="seg">' + [''].concat(e.cats).map(function (c) {
    return '<button class="' + (e.cat === c ? 'on' : '') + '" onclick="S.edu.cat=' + jsq(c) + ';render()">' + esc(c || '全部') + '</button>'; }).join('') + '</div>';
  var list = e.list.filter(function (x) { return !e.cat || x.cat === e.cat; });
  if (!list.length) h += '<div class="empty">目前沒有' + esc(e.cat || '文宣') + '</div>';
  else h += '<div class="list">' + list.map(function (x) {
    var st = eduState(x), meta = x.cat + (x.course && x.hours ? '・' + x.hours + ' 小時' : '') + '・' + x.time.slice(5, 10).replace('-', '/') + (x.files.length ? '・' + x.files.length + ' 個附件' : '');
    return '<button class="li' + (x.opened ? '' : ' unread') + '" onclick="go(\'eduItem\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="mt">' + esc(meta) + '</span><span class="nm">' + (x.opened ? '' : '<i class="ndot"></i>') + esc(x.title) + '</span></span>' +
      (st ? pill(st[0], st[1], st[2]) : '') + '</button>';
  }).join('') + '</div>';
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
  if (x.files.length) {
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
  }
  $('app').innerHTML = h;
  if (isEhs() && !S.dev) return;
  if (x.course) {
    if (x.done) bar('<div class="donebar">' + ic('check', 20, 3) + '已完成・' + esc(x.doneAt.slice(5).replace('-', '/')) + (x.score ? '・測驗 ' + esc(x.score) : '') + '・已簽到</div>');
    else bar('<button class="btn" id="doneBtn" onclick="eduDone()">' + ic('check', 22, 3) + '我已完成（帶入簽名）</button>');
  } else if (x.needAck && !x.acked) bar('<button class="btn" id="ackBtn" onclick="eduAck()">' + ic('check', 22, 3) + '我已閱讀，了解內容</button>');
  else if (x.acked) bar('<div class="donebar">' + ic('check', 20, 3) + '已確認閱讀・' + esc(x.ackAt.slice(5).replace('-', '/')) + '</div>');
};
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
function eduDone() {
  var x = S.eduItem, q = S.eq || { ans: [] }, sig = S.me.signature;
  for (var i = 0; i < x.quiz.length; i++) if (q.ans[i] == null) { toast('第 ' + (i + 1) + ' 題還沒作答', 'err'); var c = document.querySelectorAll('.quiz')[i]; if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
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
/** 確認簽到完成 → 待匯入；電腦每天 09:15 把簽到表（P-05-01-A，分 BU／PU，含簽名）與教材放進 NAS 歷年教育訓練資料／民國年／主題 */
function eduArch(id, done, n) {
  if (!confirm((done < n ? '還有 ' + (n - done) + ' 人沒完成，沒完成的不會列在簽到表。\n\n' : '') + '確認這堂課的簽到完成，匯入 NAS？\n電腦每天 09:15 會把簽到表（P-05-01-A，分 BU／PU）和教材放進「歷年教育訓練資料／民國年／主題」。')) return;
  api('eduArchive', { id: id }).then(function (r) { S.es = null; toast('已確認，' + r.n + ' 人；明天 09:15 前匯入 NAS', 'ok', 4000); render(); })
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
  return '<img class="ghs" src="ghs-' + k + '.svg" width="' + size + '" height="' + size + '" alt="' + esc(g[0]) + '">';
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
      '<span class="chp">' + (x.pic.length ? x.pic.slice(0, 3).map(function (k) { return ghsIcon(k, 26); }).join('') : '') + '</span>' + ic('chev', 18, 2.6) + '</button>';
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
    '<div class="chsec">危害分類</div>' + (x.haz.length ? '<ul class="chz">' + x.haz.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' :
      '<div class="muted">系統讀不到這份 SDS 的危害分類，請看現場 SDS 第二項。</div><div class="chr"><b>SDS 索引碼</b><span>' + esc(x.idx || '—') + '</span></div>') +
    '<div class="chsec">基本資料</div>' + row('SDS 索引碼', x.idx) + row('CAS No.', x.cas) + row('使用情形', x.use) + row('製造商／供應商', x.maker) + row('清單分頁', x.sheet) +
    '<div class="tip">作業前看 SDS 第八項（防護具）、第四項（急救）；不舒服馬上告訴主管。</div></div>';
  document.body.appendChild(dd);
  dd.addEventListener('click', function (e) { if (e.target === dd) dd.remove(); });
}

// ───────────── 開發者模式（環安衛）：用任何同仁的畫面操作、找出他卡在哪一步；只看不送出 ─────────────
// 只讀的動作帶 viewAs 給後端；會寫入的（送出、簽名、核准、上傳…）在手機上就攔下，後端也只放行這份清單。
var DEV_READ = ['me', 'chemList', 'overview', 'notices', 'dayView', 'monthView', 'packages', 'tracks', 'photoGet', 'getPdf', 'team', 'nextList',
                'eduList', 'eduGet', 'eduFile', 'consCases', 'envMe', 'envMonth', 'ping'];
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
  claim: '領取表單', track: '異常追蹤', trackFix: '填寫改善', notice: '通知', guide: '使用教學', settings: '設定', shareMake: '請人代填', packages: '審核紀錄',
  team: '部門管理', edu: '教育訓練', eduItem: '教育訓練內容', eduPost: '發布教育訓練', cons: '施工申請', env: '環保抄表', months: '月結紀錄', pick: '其他檢查表',
  remind: '提醒設定', bc: '廣播', proxy: '代填', psign: '代填簽名', nextOwners: '下月負責人', teamEdit: '部門管理', teamPerson: '部門管理', devPick: '開發者模式', devPerson: '開發者模式' };
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
