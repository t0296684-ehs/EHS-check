// 員和環安衛系統｜作業檢點的畫面：各課執行狀況、領取、通知、廣播、異常追蹤、使用教學、下月負責人、部門管理、我的表單、佐證、填寫、月份與送審、代填、提醒、通知信設定、設定、資料匯出
// （10/19 從 app.js 拆出；載入順序 plat.js → cons.js → app.js → check.js，全部載入完 app.js 才啟動）
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
  setTitle('申請表單');
  var list = S.me.claimable || [], multi = S.me.depts.length > 1;
  var h = '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">單位負責人指派給您的表會自動出現在首頁，不用申請。這裡是本課其他還沒指派給您的表或設備；想多負責哪一項，按「申請」送給單位負責人，核准後就會出現在首頁。' +
    '要取消請洽單位負責人。</div></div></div></div>';
  S.me.depts.forEach(function (d) {
    var mine = list.filter(function (x) { return x.dept === d.id; });
    if (!mine.length) return;
    var fs = mine.filter(function (x) { return x.kind === 'form'; }), es = mine.filter(function (x) { return x.kind === 'equip'; });
    if (fs.length) h += '<div class="sec">' + esc((multi ? d.id + '・' : '') + '檢查表') + '</div><div class="list">' + fs.map(function (x, i) {
      return claimRow(x, x.name, (x.daily ? '每日檢點' : '定期檢查') + '・' + (x.users.length ? '目前使用：' + x.users.join('、') : '目前沒有人使用'), 'f' + i + d.id);
    }).join('') + '</div>';
    if (es.length) h += '<div class="sec">' + esc((multi ? d.id + '・' : '') + '設備（一台一台申請）') + '</div><div class="list">' + es.map(function (x, i) {
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
    (x.pending ? pill('warn', 'clock', '待單位負責人核准') : '<button class="btn sm" onclick="claimGo(' + jsq(k) + ')">申請</button>') + '</div>';
}
function claimGo(k) {
  var x = CLAIMS[k]; if (!x) return;
  var what = x.kind === 'equip' ? x.cat + ' ' + x.object : x.name;
  if (!confirm('申請負責「' + what + '」？\n送出後要單位負責人核准，核准了首頁才會出現' + (x.kind === 'equip' ? '這台設備的檢查表' : '這張表') + '。')) return;
  if (!navigator.onLine) return toast('沒有網路，申請要連上網路才能做', 'err', 3500);
  busyOn('送出申請中…');
  api('claim', x.kind === 'equip' ? { deptId: x.dept, kind: 'equip', cat: x.cat, object: x.object } : { deptId: x.dept, kind: 'form', formId: x.form }).then(function (r) {
    busyOff(); S.me = normMe(r.me); lsSet(LS.ME, r.me);
    toast('已送出申請：' + what + '，等單位負責人核准', 'ok', 3500); render();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
// ───────────── 領取申請（單位負責人核准）─────────────
PAGES.claimReview = function () {
  setTitle('表單申請');
  var cr = S.cr;
  if (!cr) {
    $('app').innerHTML = loading('讀取表單申請…');
    api('claimList', {}).then(function (r) { S.cr = r; if (S.page === 'claimReview') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到表單申請', e.message); });
    return;
  }
  var h = '<div class="muted upnote">同仁申請負責的表或設備。核准後馬上出現在他的手機上，環安衛中心會收到異動通知；退回請寫原因。</div>';
  h += cr.list.length ? '<div class="list">' + cr.list.map(function (x) {
    return '<div class="li"><span class="mn"><span class="nm">' + esc(x.name + '：' + x.what) + '</span><span class="mt">' + esc(x.dept + '・' + x.time.slice(5) + ' 申請') + '</span>' +
      '<span class="mt">' + esc(x.users.length ? '目前負責：' + x.users.join('、') : '目前沒有人負責') + '</span>' +
      '<span class="btns"><button class="btn sm" onclick="claimDecide(' + jsq(x.id) + ',' + jsq('approve') + ')">核准</button><button class="btn sm ghost" onclick="claimDecide(' + jsq(x.id) + ',' + jsq('reject') + ')">退回</button></span></span></div>';
  }).join('') + '</div>' : '<div class="empty">目前沒有待核准的表單申請</div>';
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
  var h = (window.pushRow ? pushRow() : '') + '<div class="muted upnote">最近 60 天和您有關的通知。單位負責人、環安衛另外會收到 Email。</div>';
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
    '<textarea id="tfFix" class="note plain" placeholder="例：已更換洗眼器加壓閥，試水壓正常" oninput="S.tf.fix=this.value;tfBar()">' + esc(tf.fix) + '</textarea><div class="hint nbad" id="tfWhy" hidden></div>' +
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
  var pic = !(x && x.form === 'PATROL') || S.tf.pics.length > 0, w = n ? txtWhy(S.tf.fix, { min: 5, want: '請寫做了什麼處理（例：更換了什麼、調整了什麼）' }) : '', go_ = n >= 5 && !w && pic;   // 現場巡視缺失要附改善後照片
  var el = $('tfWhy'); if (el) { el.textContent = w; el.hidden = !w; }
  bar('<button class="btn"' + (go_ ? '' : ' disabled') + ' onclick="tfSave()">' + ic('check', 22, 2.8) + (go_ ? '改善完成，結案' : n < 5 ? '寫好改善措施就能結案（至少 5 個字）' : w ? '改善措施要寫清楚才能結案' : '附上改善後照片就能結案') + '</button>');
}
function tfPick(inp) {
  var file = inp.files && inp.files[0]; inp.value = '';
  var x = S.tk.open.filter(function (y) { return y.id === S.tf.id; })[0], tf = S.tf;
  photoUp(file, { deptId: x.dept, formId: x.form, purpose: 'fix', __dup: tf.pics.map(function (p) { return p.t; }) }, function (p) { if (S.tf !== tf) return; tf.pics.push(p); keepY(render); tfBar(); });
}
function tfSave() {
  var tf = S.tf;
  if (!navigator.onLine) return toast('沒有網路，結案要連上網路', 'err', 3500);
  if (!tf.date || tf.date > today()) return toast('改善完成日期不能是未來', 'err');
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
  var h = '<button class="btn gfaqtop" onclick="gOpen(\'faq\')">' + ic('info', 20, 2.4) + '常見問題（先看這裡）</button>';
  h += '<div class="gintro">依您的身分（' + esc(guideRole() === 'ehs' ? '環安衛' : guideRole() === 'mgr' ? '單位負責人' : '檢點人員') + '）列出要看的章節，點一節就能看，每節都有實際畫面。</div>';
  h += guideChaps().map(function (c) {
    return '<div class="gch" style="--c:' + esc(c.color) + '"><div class="gct"><span class="gcn">' + c.no + '</span><span><b>' + esc(c.title) + '</b><small>' + esc(c.who) + '</small></span></div>' +
      '<div class="list">' + gSecsOf(c).map(function (x) {
        return '<button class="li" onclick="gOpen(' + jsq(x.no) + ')"><span class="gno">' + esc(x.no) + '</span><span class="mn"><span class="nm">' + esc(x.title) + '</span></span>' + ic('chev', 18, 2.6) + '</button>';
      }).join('') + '</div></div>';
  }).join('');
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
  if (!S.arg.tab || (S.arg.tab === 'grid' && !isDesk())) S.arg.tab = 'ov';   // 10/30：手機、電腦都先看總覽；分工表（人員 × 表單）只有電腦版   // 網頁版預設總覽（10/30）；分工表是人員 × 表單／設備
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
    $('app').innerHTML = h + (isDesk() ? tovHtml(all) : tovMobile(all)); return;   // 所有課一起的總覽（依設備／依人員）；手機排成卡片
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
  h += '<div class="seg" role="tablist">' + (isDesk() ? [['ov', '總覽'], ['grid', '分工表']] : [['ov', '總覽']]).concat([['people', '人員 ' + ops.length], ['form', '表單 ' + forms.length], ['equip', '設備 ' + eqs.length]]).map(function (t) {
    return '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'on' : '') + '" onclick="teamTab(' + jsq(t[0]) + ')">' + esc(t[1]) + '</button>';
  }).join('') + '</div>';
  var nameOf = {}; tm.targets.forEach(function (x) { nameOf[x.key] = x.name; });
  if (tab === 'grid') { $('app').innerHTML = h + tmxHtml(tm); tmxBar(tm); return; }
  if (tab === 'ov') { $('app').innerHTML = h + (isDesk() ? tovHtml([tm]) : tovMobile([tm])); return; }
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
// ───────────── 網頁版主管總覽（10/30 Jason：主管要有「高級但簡單的樞紐分析表」的感覺，舒適地管理所有表單）─────────────
// 列＝課別 › 設備類別（或人員），欄＝頻率（每日／每月／每年／其他週期），格子＝那一張表與定期檢查狀態；分組可收合、有小計；
// 上方狀態篩選（附件數）＋關鍵字篩選；可匯出成 Excel。點任何一列就到原本的調整畫面（今天起／下月起），資料與權限跟手機版同一套。
var TOV_ST = { overdue: ['ng', '已到期'], never: ['na', '尚無紀錄'], soon: ['warn', '快到期'], ok: ['ok', '期限內'] };
var TOV_COLS = ['每日', '每月', '每年', '其他週期'];
function tovShort(n) { return String(n || '').replace(/（[^）]*）$/, '').replace(/(每日作業、操作前|每日作業前|作業前)?檢點表$|定期檢查紀錄表$|作業檢點表$/, ''); }
function tovCol(fq) { return fq === '每日' || fq === '作業日' ? 0 : fq === '每月' ? 1 : fq === '每年' ? 2 : 3; }
function tovTag(name, freq, st, sub) {
  var s = st ? TOV_ST[st] : null;
  return '<span class="tvf' + (s ? ' ' + s[0] : '') + '" title="' + esc(name + (sub ? '・' + sub : '')) + '"><i></i><b>' + esc(tovShort(name)) + '</b>' + (freq && tovCol(freq) === 3 ? '<em>' + esc(freq) + '</em>' : '') + (s && st !== 'ok' ? '<u>' + esc(s[1]) + '</u>' : '') + '</span>';
}
function tovWho(names) { return names.length ? names.map(function (n) { return '<span class="tvp" data-raw>' + esc(n) + '</span>'; }).join('') : '<span class="tvnone">未指派</span>'; }
function tovGo(dept, page, arg) {
  if (S.team && S.team.dept === dept) return go(page, Object.assign({ dept: dept }, arg));
  busyOn('讀取中…');
  teamLoad(dept).then(function () { busyOff(); go(page, Object.assign({ dept: dept }, arg)); }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4000); });
}
function tovSet(k, v) { S.arg[k] = v; render(); }
function tovFold(k) { var f = S.arg.fold = S.arg.fold || {}; f[k] = !f[k]; render(); }
function tovOpen(k) { var o = S.arg.open = S.arg.open || {}; o[k] = !o[k]; render(); }
function tovQ(v) { S.arg.q = v; clearTimeout(S.tovT); S.tovT = setTimeout(function () { var c = $('tovq'), at = c ? c.selectionStart : 0; render(); var e = $('tovq'); if (e) { e.focus(); try { e.setSelectionRange(at, at); } catch (x) {} } }, 250); }
/** 每一列（設備或區域型表）攤成：欄位 0～3 的檢點表清單＋最差狀態 */
function tovCells(x) {
  var c = [[], [], [], []], worst = '';
  if (x.kind === 'equip' && x.dailyForm) c[0].push({ name: x.dailyForm.name, freq: '每日' });
  if (x.kind === 'form' && x.daily) c[0].push({ name: x.name, freq: '每日' });
  (x.periodic || []).forEach(function (y) { c[tovCol(y.freq)].push({ name: y.name, freq: y.freq, st: y.state, sub: perLine(y) }); });
  (x.periodic || []).forEach(function (y) { if (['overdue', 'never', 'soon', 'ok'].indexOf(y.state) < ['overdue', 'never', 'soon', 'ok', ''].indexOf(worst || '')) worst = y.state; });
  return { c: c, worst: worst };
}
function tovMatch(x, f) {
  if (f === 'none') return !x.now.length;
  if (f === 'overdue' || f === 'never' || f === 'soon') return (x.periodic || []).some(function (y) { return y.state === f; });
  return true;
}
function tovHtml(list) {
  var mode = S.arg.ov || 'equip', q = String(S.arg.q || '').trim().toLowerCase(), multi = list.length > 1, flt = S.arg.flt || 'all';
  var fold = S.arg.fold || {}, open = S.arg.open || {};
  var nOp = 0, nOff = 0, nEq = 0, nF = 0, cnt = { none: 0, overdue: 0, never: 0, soon: 0 };
  list.forEach(function (t) {
    t.people.forEach(function (p) { if (p.role === '檢點人員') { nOp++; if (!p.loggedIn || !p.signed) nOff++; } });
    t.targets.forEach(function (x) {
      if (x.kind === 'equip') nEq++; else nF++;
      if (!x.now.length) cnt.none++;
      ['overdue', 'never', 'soon'].forEach(function (s) { if (tovMatch(x, s)) cnt[s]++; });
    });
  });
  var stat = function (n, l, s, tone) { return '<div class="tvk' + (tone ? ' ' + tone : '') + '"><span class="kn" data-raw>' + n + '</span><span class="kl">' + esc(l) + '</span>' + (s ? '<span class="ks">' + esc(s) + '</span>' : '') + '</div>'; };
  var h = '<div class="tvstats">' + stat(nOp, '檢點人員', nOff ? nOff + ' 位還沒登入或簽名' : '都已登入、簽名', nOff ? 'warn' : '') + stat(nEq, '設備', '', '') +
    stat(nF, '區域型檢點表', '不分設備的每日、定期表') + stat(cnt.none, '未指派', '設備或表單沒有負責人', cnt.none ? 'warn' : '') +
    stat(cnt.overdue, '定期檢查已到期', cnt.soon ? cnt.soon + ' 項 30 天內到期' : '', cnt.overdue ? 'ng' : '') + '</div>';
  // 工具列：檢視（依設備／依人員）｜狀態篩選（附件數）｜關鍵字｜匯出
  var fb = [['all', '全部', 0], ['none', '未指派', cnt.none], ['overdue', '已到期', cnt.overdue], ['never', '尚無紀錄', cnt.never], ['soon', '快到期', cnt.soon]];
  h += '<div class="tvbar"><div class="tvseg" role="tablist">' + [['equip', '依設備'], ['people', '依人員']].map(function (m) {
    return '<button role="tab" aria-selected="' + (mode === m[0]) + '" class="' + (mode === m[0] ? 'on' : '') + '" onclick="tovSet(\'ov\',' + jsq(m[0]) + ')">' + esc(m[1]) + '</button>';
  }).join('') + '</div><div class="tvflt">' + fb.map(function (b) {
    return '<button class="' + (flt === b[0] ? 'on' : '') + (b[0] !== 'all' && !b[2] ? ' zero' : '') + '" onclick="tovSet(\'flt\',' + jsq(b[0]) + ')">' + esc(b[1]) + (b[0] !== 'all' ? '<i data-raw>' + b[2] + '</i>' : '') + '</button>';
  }).join('') + '</div><label class="tvsearch">' + ic('search', 16, 2.4) + '<input id="tovq" type="search" placeholder="篩選：設備、表單或人名" value="' + esc(S.arg.q || '') + '" oninput="tovQ(this.value)"></label>' +
    '<button class="btn ghost sm tvx" onclick="tovExport()">' + ic('down', 16, 2.4) + '匯出 Excel</button></div>';
  var hit = function (s) { return !q || String(s).toLowerCase().indexOf(q) >= 0; };
  var rowsOut = [];                                                 // 匯出用（跟畫面一樣的篩選結果）
  if (mode === 'equip') {
    var body = '';
    list.forEach(function (t) {
      var groups = {}, order = [];
      t.targets.forEach(function (x) {
        var g = x.kind === 'equip' ? (x.cat || '設備') : '區域型檢點（不分設備）';
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(x);
      });
      order.sort(function (a, b) { return (a.indexOf('區域型') === 0) - (b.indexOf('區域型') === 0); });
      var rows = '', dk = 'd:' + t.dept, sum = { n: 0, none: 0, bad: 0 };
      order.forEach(function (g) {
        var rs = groups[g].filter(function (x) {
          var c = tovCells(x).c, txt = [x.name, x.loc, x.now.join(' ')].concat(c.map(function (l) { return l.map(function (y) { return y.name; }).join(' '); })).join(' ');
          return tovMatch(x, flt) && hit(txt);
        });
        if (!rs.length) return;
        var gk = dk + '|' + g, none = rs.filter(function (x) { return !x.now.length; }).length, bad = rs.filter(function (x) { return tovMatch(x, 'overdue'); }).length;
        sum.n += rs.length; sum.none += none; sum.bad += bad;
        rows += '<tr class="tvg" onclick="tovFold(' + jsq(gk) + ')"><td colspan="6"><span class="tvcar' + (fold[gk] ? ' shut' : '') + '">' + ic('chev', 14, 2.6) + '</span>' + esc(g) +
          '<small data-raw>' + rs.length + '</small>' + (none ? '<span class="tvgs warn">' + esc('未指派 ' + none) + '</span>' : '') + (bad ? '<span class="tvgs ng">' + esc('已到期 ' + bad) + '</span>' : '') + '</td></tr>';
        if (fold[gk]) return;
        rows += rs.map(function (x) {
          var cc = tovCells(x).c, label = x.kind === 'equip' ? (x.obj || x.name) + (x.part ? '・' + x.part : '') : tovShort(x.name), sub = x.kind === 'equip' ? (x.loc || '') : (x.form || '');
          rowsOut.push([t.dept, g, label, sub].concat(cc.map(function (l) { return l.map(function (y) { return tovShort(y.name) + (y.st && y.st !== 'ok' ? '（' + TOV_ST[y.st][1] + '）' : ''); }).join('、'); }), [x.now.join('、') || '未指派']));
          return '<tr class="' + (x.now.length ? '' : 'none') + '" onclick="tovGo(' + jsq(t.dept) + ',\'teamEdit\',{key:' + jsq(x.key) + '})"><td class="tveq"><b data-raw>' + esc(label) + '</b><small>' + esc(sub) + '</small></td>' +
            cc.map(function (l) { return '<td class="tvc">' + (l.length ? l.map(function (y) { return tovTag(y.name, y.freq, y.st, y.sub); }).join('') : '<span class="tvdash">—</span>') + '</td>'; }).join('') +
            '<td class="tvwho">' + tovWho(x.now) + (x.next ? '<div class="tvnx">' + esc(Number(t.month.slice(5)) + ' 月起：' + (x.next.join('、') || '沒有人')) + '</div>' : '') + '</td></tr>';
        }).join('');
      });
      if (!rows) return;
      body += (multi ? '<div class="tvdept" onclick="tovFold(' + jsq(dk) + ')"><span class="tvcar' + (fold[dk] ? ' shut' : '') + '">' + ic('chev', 14, 2.6) + '</span>' + esc(t.dept) +
        '<small>' + esc(sum.n + ' 項') + (sum.none ? '・' + esc('未指派 ' + sum.none) : '') + (sum.bad ? '・' + esc('已到期 ' + sum.bad) : '') + '</small></div>' : '') +
        (fold[dk] ? '' : '<div class="tvwrap"><table class="tvt"><thead><tr><th>設備／表單</th>' + TOV_COLS.map(function (c) { return '<th class="tvc">' + esc(c) + '</th>'; }).join('') + '<th>負責人</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
    h += body || '<div class="empty">沒有符合的設備或表單</div>';
    S.tovRows = [['課別', '分組', '設備／表單', '位置／編號'].concat(TOV_COLS, ['負責人'])].concat(rowsOut);
  } else {
    var body2 = '';
    list.forEach(function (t) {
      var by = {}; t.targets.forEach(function (x) { by[x.key] = x; });
      var ps = t.people.filter(function (p) { return p.role === '檢點人員'; }).map(function (p) {
        var mine = p.equips.concat(p.forms).map(function (k) { return by[k]; }).filter(Boolean), n = [0, 0, 0, 0], bad = 0;
        mine.forEach(function (x) { tovCells(x).c.forEach(function (l, i) { n[i] += l.length; }); if (tovMatch(x, 'overdue')) bad++; });
        return { p: p, mine: mine, n: n, bad: bad, eq: p.equips.length };
      }).filter(function (o) {
        var ok = flt === 'all' ? true : flt === 'none' ? !o.mine.length : o.mine.some(function (x) { return tovMatch(x, flt); });
        return ok && hit(o.p.name + ' ' + o.mine.map(function (x) { return x.name; }).join(' '));
      });
      if (!ps.length) return;
      var dk = 'p:' + t.dept;
      var rows = ps.map(function (o) {
        var p = o.p, k = t.dept + '|' + p.name, warn = [!p.loggedIn ? '還沒登入' : '', !p.signed ? '還沒簽名' : ''].filter(String);
        rowsOut.push([t.dept, p.name, o.eq].concat(o.n, [o.mine.map(function (x) { return x.kind === 'equip' ? (x.cat || '') + ' ' + (x.obj || '') : tovShort(x.name); }).join('、'), warn.join('、')]));
        var r = '<tr class="' + (o.mine.length ? '' : 'none') + (open[k] ? ' opn' : '') + '" onclick="tovOpen(' + jsq(k) + ')"><td class="tveq"><span class="tvcar' + (open[k] ? '' : ' shut') + '">' + ic('chev', 14, 2.6) + '</span><b data-raw>' + esc(p.name) + '</b>' +
          (warn.length ? '<span class="tvw">' + esc(warn.join('・')) + '</span>' : '') + '</td><td class="tvn" data-raw>' + (o.eq || '—') + '</td>' +
          o.n.map(function (v) { return '<td class="tvn" data-raw>' + (v || '<span class="tvdash">—</span>') + '</td>'; }).join('') +
          '<td class="tvn">' + (o.bad ? '<span class="tvgs ng">' + esc('已到期 ' + o.bad) + '</span>' : o.mine.length ? '' : '<span class="tvnone">未負責</span>') + '</td>' +
          '<td class="tvact"><button class="btn ghost sm" onclick="event.stopPropagation();tovGo(' + jsq(t.dept) + ',\'teamPerson\',{name:' + jsq(p.name) + '})">調整</button></td></tr>';
        if (open[k]) r += '<tr class="tvdet"><td colspan="9">' + (o.mine.length ? o.mine.map(function (x) {
          var cc = tovCells(x).c, all = []; cc.forEach(function (l) { all = all.concat(l); });
          return '<div class="tvpi"><span class="tvpe" data-raw>' + esc(x.kind === 'equip' ? (x.cat || '') + ' ' + (x.obj || '') + (x.part ? '・' + x.part : '') : '區域型') + '</span><span class="tvfs">' + all.map(function (y) { return tovTag(y.name, y.freq, y.st, y.sub); }).join('') + '</span></div>';
        }).join('') : '<div class="tvnone pad">沒有負責任何設備或表單</div>') + '</td></tr>';
        return r;
      }).join('');
      body2 += (multi ? '<div class="tvdept" onclick="tovFold(' + jsq(dk) + ')"><span class="tvcar' + (fold[dk] ? ' shut' : '') + '">' + ic('chev', 14, 2.6) + '</span>' + esc(t.dept) + '<small>' + esc(ps.length + ' 位檢點人員') + '</small></div>' : '') +
        (fold[dk] ? '' : '<div class="tvwrap"><table class="tvt tvpp"><thead><tr><th>人員</th><th class="tvn">設備</th>' + TOV_COLS.map(function (c) { return '<th class="tvn">' + esc(c) + '</th>'; }).join('') + '<th class="tvn">狀態</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
    h += body2 || '<div class="empty">沒有符合的人員</div>';
    S.tovRows = [['課別', '人員', '設備（台）'].concat(TOV_COLS, ['負責的設備與表單', '提醒'])].concat(rowsOut);
  }
  return h;
}
/** 匯出 Excel（CSV，Excel 直接開；中文加 BOM）：跟畫面一樣的篩選結果 */
function tovExport() {
  var rows = S.tovRows || []; if (rows.length < 2) return toast('目前沒有資料可以匯出', 'err');
  var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  var a = document.createElement('a'), t = today();
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = '分工總覽_' + (S.arg.ov === 'people' ? '依人員' : '依設備') + '_' + t.replace(/-/g, '') + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
}
/** 手機版總覽（10/30 Jason：手機上的主管、環安衛也要有一樣好用的管理體驗）：同一份資料，排成單手好滑的卡片 */
function tovMobile(list) {
  var mode = S.arg.ov || 'equip', q = String(S.arg.q || '').trim().toLowerCase(), multi = list.length > 1, flt = S.arg.flt || 'all';
  var fold = S.arg.fold || {}, open = S.arg.open || {}, FQ = ['每日', '每月', '每年', '其他'];
  var nOp = 0, nOff = 0, nEq = 0, cnt = { none: 0, overdue: 0, never: 0, soon: 0 };
  list.forEach(function (t) {
    t.people.forEach(function (p) { if (p.role === '檢點人員') { nOp++; if (!p.loggedIn || !p.signed) nOff++; } });
    t.targets.forEach(function (x) { if (x.kind === 'equip') nEq++; if (!x.now.length) cnt.none++; ['overdue', 'never', 'soon'].forEach(function (s) { if (tovMatch(x, s)) cnt[s]++; }); });
  });
  var st = function (n, l, tone) { return '<div class="tmk' + (tone ? ' ' + tone : '') + '"><b data-raw>' + n + '</b><span>' + esc(l) + '</span></div>'; };
  var h = '<div class="tmks">' + st(nOp, nOff ? '檢點人員・' + nOff + ' 位未就緒' : '檢點人員', nOff ? 'warn' : '') + st(nEq, '設備', '') +
    st(cnt.none, '未指派', cnt.none ? 'warn' : '') + st(cnt.overdue, '定期檢查已到期', cnt.overdue ? 'ng' : '') + '</div>';
  h += '<div class="seg two" role="tablist">' + [['equip', '依設備'], ['people', '依人員']].map(function (m) {
    return '<button role="tab" aria-selected="' + (mode === m[0]) + '" class="' + (mode === m[0] ? 'on' : '') + '" onclick="tovSet(\'ov\',' + jsq(m[0]) + ')">' + esc(m[1]) + '</button>';
  }).join('') + '</div>';
  h += '<div class="chips tmflt">' + [['all', '全部', 0], ['none', '未指派', cnt.none], ['overdue', '已到期', cnt.overdue], ['never', '尚無紀錄', cnt.never], ['soon', '快到期', cnt.soon]].map(function (b) {
    return '<button class="chip' + (flt === b[0] ? ' on' : '') + '" onclick="tovSet(\'flt\',' + jsq(b[0]) + ')">' + esc(b[1]) + (b[0] !== 'all' ? '<i class="tmc" data-raw>' + b[2] + '</i>' : '') + '</button>';
  }).join('') + '</div>';
  h += '<label class="tmsearch">' + ic('search', 18, 2.4) + '<input id="tovq" type="search" placeholder="篩選：設備、表單或人名" value="' + esc(S.arg.q || '') + '" oninput="tovQ(this.value)"></label>';
  var hit = function (s) { return !q || String(s).toLowerCase().indexOf(q) >= 0; };
  var chips = function (x) {
    var c = tovCells(x).c, out = '';
    c.forEach(function (l, i) { l.forEach(function (y) { out += '<span class="tmf' + (y.st ? ' ' + TOV_ST[y.st][0] : '') + '"><em>' + esc(i === 3 ? y.freq : FQ[i]) + '</em>' + esc(tovShort(y.name)) + (y.st && y.st !== 'ok' ? '<u>' + esc(TOV_ST[y.st][1]) + '</u>' : '') + '</span>'; }); });
    return out || '<span class="tvnone">沒有對應的檢點表</span>';
  };
  var body = '';
  list.forEach(function (t) {
    var dk = (mode === 'equip' ? 'd:' : 'p:') + t.dept, inner = '';
    if (mode === 'equip') {
      var groups = {}, order = [];
      t.targets.forEach(function (x) { var g = x.kind === 'equip' ? (x.cat || '設備') : '區域型檢點（不分設備）'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(x); });
      order.sort(function (a, b) { return (a.indexOf('區域型') === 0) - (b.indexOf('區域型') === 0); });
      order.forEach(function (g) {
        var rs = groups[g].filter(function (x) { return tovMatch(x, flt) && hit([x.name, x.loc, x.now.join(' ')].join(' ')); });
        if (!rs.length) return;
        var gk = dk + '|' + g;
        inner += '<button class="tmg" onclick="tovFold(' + jsq(gk) + ')"><span class="tvcar' + (fold[gk] ? ' shut' : '') + '">' + ic('chev', 14, 2.6) + '</span>' + esc(g) + '<small data-raw>' + rs.length + '</small></button>';
        if (fold[gk]) return;
        inner += '<div class="list">' + rs.map(function (x) {
          var label = x.kind === 'equip' ? (x.obj || x.name) + (x.part ? '・' + x.part : '') : tovShort(x.name);
          return '<button class="li tmr' + (x.now.length ? '' : ' none') + '" onclick="tovGo(' + jsq(t.dept) + ',\'teamEdit\',{key:' + jsq(x.key) + '})"><span class="mn">' +
            '<span class="nm" data-raw>' + esc(label) + (x.kind === 'equip' && x.loc ? '<small> ' + esc(x.loc) + '</small>' : '') + '</span>' +
            '<span class="tmfs">' + chips(x) + '</span><span class="tmw">' + tovWho(x.now) + '</span></span>' + ic('chev', 18, 2.6) + '</button>';
        }).join('') + '</div>';
      });
    } else {
      var by = {}; t.targets.forEach(function (x) { by[x.key] = x; });
      var ps = t.people.filter(function (p) { return p.role === '檢點人員'; }).map(function (p) {
        var mine = p.equips.concat(p.forms).map(function (k) { return by[k]; }).filter(Boolean), n = [0, 0, 0, 0];
        mine.forEach(function (x) { tovCells(x).c.forEach(function (l, i) { n[i] += l.length; }); });
        return { p: p, mine: mine, n: n, bad: mine.filter(function (x) { return tovMatch(x, 'overdue'); }).length };
      }).filter(function (o) { return (flt === 'all' || (flt === 'none' ? !o.mine.length : o.mine.some(function (x) { return tovMatch(x, flt); }))) && hit(o.p.name + ' ' + o.mine.map(function (x) { return x.name; }).join(' ')); });
      if (ps.length) inner += '<div class="list">' + ps.map(function (o) {
        var p = o.p, k = t.dept + '|' + p.name, warn = [!p.loggedIn ? '還沒登入' : '', !p.signed ? '還沒簽名' : ''].filter(String);
        var sum = o.mine.length ? [p.equips.length ? p.equips.length + ' 台設備' : ''].concat(o.n.map(function (v, i) { return v ? FQ[i] + ' ' + v : ''; })).filter(String).join('・') : '未負責';
        var r = '<div class="li tmp' + (o.mine.length ? '' : ' none') + '" onclick="tovOpen(' + jsq(k) + ')"><span class="tvcar' + (open[k] ? '' : ' shut') + '">' + ic('chev', 14, 2.6) + '</span><span class="mn"><span class="nm" data-raw>' + esc(p.name) +
          (warn.length ? ' <span class="tvw">' + esc(warn.join('・')) + '</span>' : '') + '</span><span class="mt">' + esc(sum) + (o.bad ? '' : '') + '</span>' + (o.bad ? '<span class="mt"><span class="tvgs ng">' + esc('已到期 ' + o.bad) + '</span></span>' : '') + '</span>' +
          '<button class="btn ghost sm" onclick="event.stopPropagation();tovGo(' + jsq(t.dept) + ',\'teamPerson\',{name:' + jsq(p.name) + '})">調整</button></div>';
        if (open[k]) r += '<div class="tmdet">' + (o.mine.length ? o.mine.map(function (x) {
          return '<div class="tmdi"><b data-raw>' + esc(x.kind === 'equip' ? (x.cat || '') + ' ' + (x.obj || '') + (x.part ? '・' + x.part : '') : '區域型') + '</b><span class="tmfs">' + chips(x) + '</span></div>';
        }).join('') : '<div class="tvnone pad">沒有負責任何設備或表單</div>') + '</div>';
        return r;
      }).join('') + '</div>';
    }
    if (!inner) return;
    body += (multi ? '<button class="tvdept tmd" onclick="tovFold(' + jsq(dk) + ')"><span class="tvcar' + (fold[dk] ? ' shut' : '') + '">' + ic('chev', 14, 2.6) + '</span>' + esc(t.dept) + '</button>' : '') + (fold[dk] ? '' : inner);
  });
  return h + (body || '<div class="empty">' + esc(mode === 'equip' ? '沒有符合的設備或表單' : '沒有符合的人員') + '</div>');
}
function teamDept(d) { S.arg = { dept: d, tab: S.arg.dept === '*' ? 'ov' : S.arg.tab, ov: S.arg.ov }; S.team = null; render(); }   // 從「全部」總覽點進一課：網頁版先看那一課的總覽
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
    S.teamAll = null;                                    // 「全部」總覽的暫存跟著作廢，回去看到的是改好的
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
    S.teamAll = null; busyOff(); toast(when === 'now' ? '已改好 ' + ch.length + ' 項，今天起生效' : '已安排 ' + ch.length + ' 項，' + Number(tm.month.slice(5)) + ' 月 1 日生效', 'ok', 3500);
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
  if (m.claimable && m.claimable.length && !isMgr()) h += '<button class="btn ghost" onclick="go(\'claim\')">' + ic('plus', 20, 2.6) + '申請負責本課其他表或設備</button>';
  $('app').innerHTML = h;
};

// ───────────── 定期檢查佐證：現場照片（拍了就上傳）＋檢查過程紀要 ─────────────
var SUMMARY_MIN = 15;
function evNeed(f, fm) {
  var ev = f && f.evidence; if (!ev) return null;
  var n = (fm.pics || []).length, s = String(fm.sum || '').replace(/\s/g, '').length;
  var o = { pics: Math.max(0, (ev.photos || 0) - n), sum: ev.summary && (s < SUMMARY_MIN || !!sumWhy(fm.sum)) };
  return o.pics || o.sum ? o : null;
}
var EV_EG = '例：逐一檢查氣罩、導管、排氣機皮帶與軸承，量測控制風速 0.6 m/s，濾袋無破損';
/** 紀要防呆：照抄範例、用重複的字湊字數 → 回說明（空字串＝可以；字數不夠由 evCount 顯示） */
function sumWhy(v) {
  var t = String(v || '').replace(/\s/g, ''); if (t.length < SUMMARY_MIN) return '';
  if (t === EV_EG.replace(/\s/g, '') || t === EV_EG.replace(/^例：/, '').replace(/\s/g, '')) return '這是範例文字，請寫這次實際檢查了什麼、量到多少';
  return txtWhy(v, { min: SUMMARY_MIN, want: '請寫這次實際檢查了什麼、量到多少' });
}
function evHtml(f, fm) {
  var ev = f.evidence, pics = fm.pics || [];
  var h = '<div class="sec" id="evSec">檢查佐證<small>' + (ev.photos ? '至少 ' + ev.photos + ' 張照片' : '') + (ev.summary ? (ev.photos ? '＋' : '') + '紀要' : '') + '</small></div><div class="card ev">';
  if (ev.summary) {
    var n = String(fm.sum || '').replace(/\s/g, '').length;
    h += '<label class="nl req" for="evSum">檢查過程紀要（至少 ' + SUMMARY_MIN + ' 字）</label>' +
      '<textarea id="evSum" class="note" placeholder="' + esc(EV_EG) + '" oninput="S.fill.sum=this.value;draftSave();evCount();fillBar()">' + esc(fm.sum || '') + '</textarea>' +
      '<div class="hint" id="evCnt">' + evCntTxt(fm.sum) + '</div>';
  }
  if (ev.photos) {
    h += '<div class="pics">' + pics.map(function (p, i) {
      return '<div class="pic"><img src="' + esc(p.t) + '" alt="現場照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="evDel(' + i + ')">' + ic('x', 16, 3) + '</button></div>';
    }).join('') + (pics.length < 6 ? '<label class="pic add">' + ic('plus', 26, 2.6) + '<span>拍照／選照片</span><input type="file" accept="image/*" hidden onchange="evPick(this)"></label>' : '') + '</div>' +
      '<div class="hint">拍檢查的部位、量測的儀表讀數或銘牌。照片拍了就上傳，要有網路。</div>';
  }
  return h + '</div>';
}
function evCntTxt(v) { var n = String(v || '').replace(/\s/g, '').length, w = sumWhy(v); return n + ' 字' + (n < SUMMARY_MIN ? '・還差 ' + (SUMMARY_MIN - n) + ' 字' : w ? '・' + w : ''); }
function evCount() { var el = $('evCnt'); if (!el) return; el.textContent = evCntTxt(S.fill.sum); el.className = 'hint' + (sumWhy(S.fill.sum) ? ' nbad' : ''); }
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
    if ((body.__dup || []).indexOf(th.u) >= 0) { busyOff(); return toast('這張跟已附的照片是同一張，請拍另一個部位或角度', 'err', 4500); }   // 10/20 防呆：同一張選兩次湊張數
    var act = body.__api || 'photoUp'; body = Object.assign({}, body); delete body.__api; delete body.__dup;   // 現場巡視用 patrolPhoto
    api(act, Object.assign({ image: big.u, w: big.w, h: big.h }, body)).then(function (r) { busyOff(); done({ id: r.id, t: th.u }); })
      .catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
  };
  img.src = url;
}
function keepY(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }
function evPick(inp) {
  var file = inp.files && inp.files[0]; inp.value = '';
  var a = A(S.arg.key), fm = S.fill;
  photoUp(file, { deptId: a.dept, formId: a.form, __dup: (fm.pics || []).map(function (p) { return p.t; }) }, function (p) {
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
  var dup = []; Object.keys(fm.np || {}).forEach(function (k) { fm.np[k].forEach(function (p) { dup.push(p.t); }); });
  photoUp(file, { deptId: a.dept, formId: a.form, purpose: 'ng', __dup: dup }, function (p) {
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
    if (f.noteFor.indexOf(v) >= 0 && noteWhy(f, fm, it.seq)) noNote.push(it.seq);
  });
  return { total: f.items.length, cnt: f.items.length - todo.length, todo: todo, bad: bad, noNote: noNote };
}

/** 這項的說明哪裡不行（空字串＝可以）：10/20 起「無」「OK」「已處理」、太短、選異常卻寫沒問題都要重寫 */
function noteWhy(f, fm, seq) { var v = fm.r[seq]; return f.noteFor.indexOf(v) >= 0 ? txtWhy(fm.n[seq], { bad: isBad(f, v) }) : ''; }
function noteHint(f, fm, seq) { var w = String(fm.n[seq] || '').trim() ? noteWhy(f, fm, seq) : ''; return '<div class="hint nbad" id="nh' + esc(seq) + '"' + (w ? '' : ' hidden') + '>' + esc(w) + '</div>'; }
PAGES.fill = function () {
  var a = A(S.arg.key); var fm = S.fill;
  if (!a || !fm) return back();
  var f = F(a.form, fm.date);
  setTitle(f.name);
  var t = today(), minD = fillMin() + '-01';
  var st = fillState(f, fm), ff = S.ff, side = '';

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
    h += '<div class="fitems">';                                  // 網頁版：項目排兩欄（CSS），手機照舊一欄
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
          '<textarea id="n' + esc(it.seq) + '" class="note' + (needNote ? '' : ' plain') + '" placeholder="' + esc(f.noteTitle || '請說明異常狀況與處理方式') + '" oninput="noteIn(' + jsq(it.seq) + ',this.value)">' + esc(fm.n[it.seq] || '') + '</textarea>' + (needNote ? noteHint(f, fm, it.seq) : '') +
          (v && isBad(f, v) && !S.share ? ngPicsHtml(fm, it.seq) : '') + '</div>' : '') +
        '</div>';
    });
    if (!shown) h += '<div class="empty">' + (ff === 'todo' ? '都勾完了，沒有未勾的項目' : '沒有異常的項目') + '</div>';
    h += '</div>';
    if (ff === 'all') (f.extra || []).forEach(function (x, i) {
      h += '<div class="item"><label class="qt" for="x' + i + '">' + esc(x) + '</label><textarea id="x' + i + '" class="note plain" oninput="S.fill.x[' + i + ']=this.value;draftSave()">' + esc(fm.x[i] || '') + '</textarea></div>';
    });
    if (f.evidence && !a.daily) side = evHtml(f, fm);
  }
  var sig = S.share ? '<div class="box info"><div class="r">' + ic('pen', 22) + '<div class="bt"><b>勾完按送出，下一步請寫姓名並簽名</b><div class="m">代填的檢點要本人當場簽名才算數。</div></div></div></div>'
    : '<div class="sigcard"><img src="' + esc(S.me.signature.image) + '" alt="您的簽名"><div class="stx"><b>送出時自動帶入您的簽名</b>不用再簽</div></div>';
  // 10/29 網頁版：要附照片、紀要的定期檢查左右分欄（左邊逐項、右邊佐證與簽名），手機照舊往下排
  if (side && isDesk()) h = '<div class="fdesk"><div class="fmain">' + h + '</div><div class="fside">' + side + sig + '</div></div>';
  else h += side + sig;
  $('app').innerHTML = h;
  fillBar();
};
/** 底部按鈕永遠告訴使用者下一步：還沒勾 → 跳過去；要寫說明 → 跳過去；都好了 → 送出 */
function fillBar() {
  if (S.page !== 'fill' || !S.fill) return;
  var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date), st = fillState(f, fm), h;
  if (fm.noWork) h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic('check', 22, 2.8) + '送出（今日無作業）</button>';
  else if (st.todo.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.todo[0]) + ')">還有 ' + st.todo.length + ' 項沒勾・跳到第 ' + esc(st.todo[0]) + ' 項' + ic('down', 20, 2.6) + '</button>';
  else if (st.noNote.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.noNote[0]) + ',1)">第 ' + esc(st.noNote[0]) + ' 項' + (String(fm.n[st.noNote[0]] || '').trim() ? '的說明要寫清楚' : '要寫說明') + '・跳過去' + ic('down', 20, 2.6) + '</button>';
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
function noteIn(seq, v) {
  S.fill.n[seq] = v; draftSave(); fillBar();
  var el = $('nh' + seq), a = A(S.arg.key); if (!el || !a) return;           // 打字時只更新提示（整頁重畫會讓鍵盤收起來）
  var w = String(v || '').trim() ? noteWhy(F(a.form, S.fill.date), S.fill, seq) : ''; el.textContent = w; el.hidden = !w;
}
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
      var nw = noteWhy(f, fm, it.seq);
      if (nw) { jumpTo(it.seq, 1); return toast(nw === '還沒寫' ? '第 ' + esc(it.seq) + ' 項請寫說明' : '第 ' + esc(it.seq) + ' 項：' + esc(nw), 'err', 5000); }
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
  var p0 = h.length;                                             // 網頁版：本月狀態、補填、送審前要補的，移到月曆右邊那一欄
  h += '<div class="card"><div class="mr"><b>本月狀態</b>' + statusPill(v.status) + '</div>' +
    (v.status === '退回' ? '<div class="box err" role="alert"><div class="r">' + ic('ret', 22) + '<div class="bt"><b>退回原因</b><div class="m">' + esc(v.reason) + '</div></div></div></div>' : '') +
    (v.sheetUrl ? slBox(v) : '') + '</div>';     // 10/29：試算表只有環安衛看得到（平常唯讀，輸入後台密碼才開放編輯 30 分鐘）
  h += confirmBlock(v);
  h += bfButton(v);                                              // 一次補填全部漏填
  if (sfWide() && (boss || ehs) && (v.model.daily.length || v.model.periodic.length) && v.status !== '填寫中')
    h += '<button class="btn' + ((v.status === '待主管審核' && boss && !ehs) || (v.status === '待環安衛審核' && ehs) ? '' : ' ghost') + '" onclick="S.sf=null;go(\'sheetFill\',{dept:' + jsq(v.dept) + ',period:' + jsq(v.period) + ',review:1})">' + ic('review', 20, 2.4) + '用表格審核（電腦版，整月一次看完）</button>';
  if (sfWide() && !isEhs() && (v.status === '填寫中' || v.status === '退回') && sfMine(v).length)
    h += '<button class="btn ghost" onclick="S.sf=null;go(\'sheetFill\',{dept:' + jsq(v.dept) + ',period:' + jsq(v.period) + '})">' + ic('pen', 20, 2.4) + '用表格填寫（電腦版，像試算表一樣整月填）</button>';
  var pend = (S.outbox || []).filter(function (j) { return j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period; });
  if (pend.length) h += '<div class="strip info">' + ic('cloud', 24, 2.2) + '<div class="stx"><span>手機裡還有 <b>' + pend.length + ' 筆</b>這個月的檢點沒上傳完</span><small>上傳完才會出現在下面</small></div>' +
    '<button class="btn sm" onclick="flush().then(function(){render()})">立即上傳</button></div>';
  if ((v.status === '填寫中' || v.status === '退回') && v.problems.length) {
    h += '<div class="box warn"><div class="r">' + ic('warn', 24) + '<div class="bt"><b>送出前還要補 ' + v.problems.length + ' 個地方</b></div></div>' +
      '<div class="list">' + v.problems.slice(0, 20).map(function (p) { return '<div class="li" style="min-height:52px"><span class="mn"><span class="nm" style="font-weight:500">' + esc(p) + '</span></span></div>'; }).join('') +
      (v.problems.length > 20 ? '<div class="li" style="min-height:44px"><span class="mt">…還有 ' + (v.problems.length - 20) + ' 個</span></div>' : '') + '</div></div>';
  }
  var dl = mm.daily.filter(function (x) { return forms[x.form]; });
  var topPart = h.slice(p0), deskCal = isDesk() && dl.length && S.mv === 'cal'; if (deskCal) h = h.slice(0, p0);
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
    var calc = '<div class="card calcard' + (S.mSlide ? (S.mSlide > 0 ? ' slideL' : ' slideR') : '') + '">' + stats + calHtml(f, x, v.period, late[x.form]) + '</div>', dd = dayDetail(f, x, v.period, late[x.form]);
    if (S.mv === 'cal') h += deskCal ? '<div class="mdesk"><div class="mdmain">' + calc + '</div><div class="mdside">' + (dd || '<div class="card"><div class="muted">點月曆上的日期，這裡會顯示那天的檢查人員、異常與說明；沒紀錄的平日可以直接補填。</div></div>') + topPart + '</div></div>' : calc + dd;
    else h += '<div class="card">' + stats + '</div>' + gridHtml(f, x, v.period, seeLate(v) ? late[x.form] : null);
  }
  if (mm.periodic.length) h += '<div class="sec">定期檢查（本月）</div>';
  h += (isDesk() && mm.periodic.length ? '<div class="sfper">' : '') + mm.periodic.map(function (x) { return sheetHtml(forms[x.form], x); }).join('') + (isDesk() && mm.periodic.length ? '</div>' : '');
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
    bar('<label class="nl" for="cm">意見（核准可不填；<b>退回要寫要改哪一天、哪一項</b>，本課看得到）</label><textarea id="cm" class="note plain" placeholder="退回時必填，例：10/3、10/7 堆高機第 5 項沒寫異常說明">' + esc(S.cm) + '</textarea>' +
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
    if (S.page === 'month') monthRender(); else render();
    window.scrollTo(0, 0);
    dlg('<b>送審沒有成功</b><p>' + esc(e.message).replace(/\n/g, '<br>') + '</p>', [['知道了', function () {}, '']]);
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
function smGo() { S.smOk = true; S.page = 'month'; S.stack.pop(); S.arg = S.mArg; render(); submitMonth(); }   // 10/15：先回到月份畫面再送，失敗訊息才看得到（原本停在確認頁、像卡住）
function shareTo(text) {
  if (navigator.share) navigator.share({ text: text }).catch(function () {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('已複製，貼到 LINE 給主管', 'ok'); });
  else prompt('複製這段傳給主管：', text);
}

function doReview(action) {
  var cm = ($('cm') || {}).value || '';
  S.cm = cm;
  var rw = action === 'return' ? txtWhy(cm, { want: '請寫要改哪一天、哪一項（例：10/3 第 5 項沒寫異常說明）' }) : '';
  if (rw) { toast(rw === '還沒寫' ? '退回要寫原因：要改哪一天、哪一項' : esc(rw), 'err', 4500); var c0 = $('cm'); if (c0) { c0.classList.add('bad'); c0.focus(); } return; }   // 10/20：退回沒寫原因，本課不知道改哪裡
  if (action === 'return' && !confirm('把 ' + S.view.dept + ' ' + ymLabel(S.view.period) + ' 整個月退回給本課？\n\n退回後檢點人員可以修改，改好再重新送審。')) return;
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
  }).catch(function (e) { busyOff(); if (S.page === 'sheetFill') { toast((action === 'approve' ? '核准沒有成功：' : '退回沒有成功：') + esc(e.message), 'err', 6000); return sfRevBar(); }
    S.mErr = { t: action === 'approve' ? '核准沒有成功' : '退回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
}
function doEhs(action) {
  var why = '';
  if (action === 'return') {
    for (var tries = 0; ; tries++) {                                   // 10/20：退回一定要寫要改哪裡
      why = prompt((tries ? '請寫清楚要改哪一天、哪一項。\n' : '') + '退回原因（必填，本課與單位負責人看得到）？整個月會退回給本課。', why || ''); if (why === null) return;
      if (!txtWhy(why, { want: 'x' })) break;
    }
  }
  else if (!confirm('確認歸檔？')) return;
  bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === 'approve' ? '歸檔中…' : '退回中…') + '</div>');
  busyOn(action === 'approve' ? '歸檔中…' : '退回中…', '');
  var mid = S.view.monthId;
  api('ehsReview', { monthId: mid, decision: action, comment: why }).then(function () {
    if (action === 'approve') return archLoop(mid);
    busyOff(); toast('已退回', 'ok'); S.stack = []; go('home', {}, true); refreshMe();
  }).catch(function (e) { busyOff(); if (S.page === 'sheetFill') { toast((action === 'approve' ? '歸檔沒有成功：' : '退回沒有成功：') + esc(e.message), 'err', 6000); return sfRevBar(); }
    S.mErr = { t: action === 'approve' ? '歸檔沒有成功' : '退回沒有成功', m: e.message }; monthRender(); window.scrollTo(0, 0); });
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
  var nw = nameWhy(name); if (nw) { $('pname').classList.add('bad'); $('pname').focus(); return toast(esc(nw), 'err', 4000); }
  var img = '';
  if (!fm.noWork) {
    if (!SIG.drawn) return sigNudge();
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
      ' onchange="remSet(' + jsq(key) + ',\'on\',this.checked)"><span>' + (Array.isArray(title) ? title.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') : esc(title)) + '</span></label>';   // 分段：外語逐段翻（部門｜表名｜頻率黏在一起字典比不到）
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
  if (!isEhs()) list.forEach(function (a) { var r = Object.assign(remDefault(a), R[a.key] || {}); h += row(a.key, [a.dept, '｜', aTitle(a), '（' + (a.daily ? '每個作業日' : a.freq) + '）'], a.daily ? '作業日' : a.freq, r); });
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

// ───────────── 電腦版表格填寫（10/29 Jason：電腦上用 App 網頁版，填法要像 Google 試算表；同仁不用 Google 帳號）─────────────
// 一課一個月一頁：上面分頁＝我負責的每日表，格子＝項目 × 日期，方向鍵移動、打 1／2／3 或 V／X／- 直接填，可拉選一整片一起填、可從 Excel 貼上、Ctrl+Z 復原。
// 存檔＝每一天各送一筆（跟手機送出同一條路：先存待上傳、背景上傳、伺服器帶入本人簽名、補填照記填寫時間）；沒填完的天留在草稿，不會不見。
var SF_DRAFT = 'chk.sfd', SF_GEN = { ok: ['v', 'V', '√', '✓', 'ˇ', 'o', 'O', '○'], ng: ['x', 'X', '×', '✗'], na: ['-', '/', '－', '／', '─', '—'], care: ['Δ', '△'] };
function sfWide() { return window.innerWidth >= 900; }
function sfT(s) { return window.I18N && I18N.tr ? I18N.tr(s) : s; }
/** 這個月我負責、可以用表格填的每日表 */
function sfMine(v, review) {
  return (v.model.daily || []).map(function (x) {
    var a = (S.me.assigns || []).filter(function (y) { return y.daily && y.dept === v.dept && y.form === x.form; })[0];
    var f = (a || review) && (F(x.form, v.period + '-01') || S.me.forms[x.form]);
    return (a || review) && f && f.items && f.items.length ? { a: a, x: x, f: f, key: a ? a.key : 'r:' + x.form } : null;
  }).filter(Boolean);
}
/** 首頁（電腦寬螢幕）入口：每個有每日表的部門一格 */
function sfTiles(m) {
  if (!sfWide() || isEhs()) return '';
  return m.depts.filter(function (d) { return !demoDept(d.id) && m.assigns.some(function (a) { return a.dept === d.id && a.daily; }); }).map(function (d, i, all) {
    return tile('pen', '表格填寫（電腦版）', "go('sheetFill',{dept:" + jsq(d.id) + ',period:' + jsq(today().slice(0, 7)) + '})', '', all.length > 1 ? d.id : '像試算表一樣，一次填整個月');
  }).join('');
}
function sfDraftAll() { return lsGet(SF_DRAFT, {}); }
function sfDraftSave() { var sf = S.sf; if (!sf || sf.review) return; var all = sfDraftAll(), k = sf.dept + '|' + sf.period, any = Object.keys(sf.ed).some(function (x) { return Object.keys(sf.ed[x]).length; }); if (any) all[k] = sf.ed; else delete all[k]; lsSet(SF_DRAFT, all); }

PAGES.sheetFill = function () {
  var a = S.arg;
  setTitle('表格填寫');
  if (!S.sf || S.sf.arg !== a) S.sf = { arg: a, dept: a.dept, period: a.period, review: !!a.review, fi: 0, ed: a.review ? {} : sfDraftAll()[a.dept + '|' + a.period] || {}, sel: { r0: 0, c0: 0, r1: 0, c1: 0 }, undo: [] };
  if (a.review) setTitle('表格審核');
  var sf = S.sf;
  if (!sf.v) $('app').innerHTML = loading('讀取這個月的紀錄中…');
  else sfRender();
  if (!sf.v || sf.stale) sfLoad();
};
function sfLoad() {
  var sf = S.sf; sf.stale = false;
  return api('monthView', { deptId: sf.dept, period: sf.period }, { quiet: !!sf.v }).then(function (v) {
    if (S.page !== 'sheetFill' || S.sf !== sf) return;
    sf.v = v; sf.list = sfMine(v, sf.review); S.view = v;
    if (!sf.seeded) { sf.seeded = true; sfSeedSel(); }
    sfRender();
  }).catch(function (e) { if (!sf.v) $('app').innerHTML = errBox('讀不到這個月的資料', e.message) + '<button class="btn navy" onclick="render()">再試一次</button>'; });
}
/** 一開始游標放在第一個還沒填的平日 */
function sfSeedSel() {
  var sf = S.sf, it = sf.list[sf.fi]; if (!it) return;
  var t = today(), n = sfDays(sf.period);
  for (var d = 1; d <= n; d++) { var date = sf.period + '-' + pad(d); if (date > t) break; if (workDay(date) && !sfLock(it, d) && !sfRec(it, d)) { sf.sel = { r0: 0, c0: d, r1: 0, c1: d }; return; } }
  var c = Math.min(n, sf.period === t.slice(0, 7) ? Number(t.slice(8)) : 1); sf.sel = { r0: 0, c0: c, r1: 0, c1: c };
}
function sfDays(per) { return new Date(Number(per.slice(0, 4)), Number(per.slice(5)), 0).getDate(); }
function sfDate(d) { return S.sf.period + '-' + pad(d); }
/** 這一天現在的內容：自己改到一半的 → 還在手機待上傳的 → 伺服器上的 */
function sfRec(it, d) {
  var e = (S.sf.ed[it.key] || {})[d]; if (e) return e;
  return sfBase(it, d);
}
function sfBase(it, d) {
  var j = it.a && pendJob(it.a, sfDate(d));
  if (j) return { r: j.body.results || {}, n: j.body.notes || {}, w: !!j.body.noWork, pend: true, signer: S.me.person.name };
  var r = it.x.days[d];
  return r ? { r: r.results || {}, n: r.notes || {}, w: !!r.noWork, signer: r.signer, unconf: r.unconf } : null;
}
function sfEmpty(x) { return !x || (!x.w && !Object.keys(x.r || {}).length && !Object.keys(sfNotes(x)).length); }
function sfSame(p, q) {
  if (sfEmpty(p) && sfEmpty(q)) return true;
  if (!p || !q) return false;
  return !!p.w === !!q.w && JSON.stringify(sfSort(p.r)) === JSON.stringify(sfSort(q.r)) && JSON.stringify(sfSort(sfNotes(p))) === JSON.stringify(sfSort(sfNotes(q)));
}
function sfNotes(r) { var o = {}; Object.keys(r.n || {}).forEach(function (k) { if (String(r.n[k] || '').trim()) o[k] = r.n[k]; }); return o; }
function sfSort(o) { var x = {}; Object.keys(o || {}).sort().forEach(function (k) { x[k] = o[k]; }); return x; }
/** 這一天能不能改（空字串＝可以）：規則同月曆「補填這天／修改這天」 */
function sfLock(it, d) {
  var sf = S.sf, v = sf.v, date = sfDate(d), t = today();
  if (sf.review) return '審核畫面，只能看';
  if (!(v.status === '填寫中' || v.status === '退回')) return '本月已送審（' + v.status + '），不能修改';
  if (date > t) return '未來的日子';
  if (demoDept(v.dept) && date !== t) return '示範區只能填今天';
  if (date < fillMin() + '-01') return '超過補填期限';
  var r = it.x.days[d], me = S.me.person.name;
  if (r && r.signer && r.signer !== me && !(r.noWork && !mgrOf(v.dept))) return '這天由 ' + r.signer + ' 檢點，不能修改';
  return '';
}
function sfDirty(it, d) { var e = (S.sf.ed[it.key] || {})[d]; return !!e && !sfSame(e, sfBase(it, d)); }
/** 改到一半的這一天還缺什麼（空字串＝可以存） */
function sfProb(it, d) {
  var e = (S.sf.ed[it.key] || {})[d]; if (!e || e.w) return '';
  var f = it.f, miss = f.items.filter(function (q) { return !e.r[q.seq]; });
  if (miss.length) return '還有 ' + miss.length + ' 項沒填（第 ' + miss[0].seq + ' 項起）';
  for (var i = 0; i < f.items.length; i++) { var s = f.items[i].seq, w = noteWhy(f, e, s); if (w) return '第 ' + s + ' 項' + (w === '還沒寫' ? '要寫說明' : '：' + w); }
  return '';
}
function sfOpts(it, ri) { var q = it.f.items[ri]; return (q && q.opts) || it.f.opts; }
function sfMark(it, ri, k) { var o = sfOpts(it, ri).filter(function (x) { return x.k === k; })[0]; return o ? (o.mark || o.label) : k ? '?' : ''; }
/** 打的字 → 選項：1／2／3＝第幾個選項；也認 V、X、-、△ 與選項本身的符號、文字 */
function sfKeyOf(it, ri, s) {
  s = String(s == null ? '' : s).trim(); if (!s) return '';
  var opts = sfOpts(it, ri);
  if (/^[1-9１-９]$/.test(s)) { var o = opts[Number(s.replace(/[１-９]/, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })) - 1]; return o ? o.k : null; }
  var hit = opts.filter(function (o) { return o.mark === s || o.label === s; })[0]; if (hit) return hit.k;
  var g = Object.keys(SF_GEN).filter(function (k) { return SF_GEN[k].indexOf(s) >= 0; })[0];
  return g && opts.some(function (o) { return o.k === g; }) ? g : null;
}

function sfRender() {
  var sf = S.sf, v = sf.v, list = sf.list, t = today();
  var h = '<div class="sfnav"><button class="btn ghost sm" onclick="sfGo(-1)">' + ic('back', 18, 2.8) + '上個月</button><b>' + esc(ymLabel(sf.period)) + '</b>' +
    '<button class="btn ghost sm" onclick="sfGo(1)"' + (sf.period >= t.slice(0, 7) ? ' disabled' : '') + '>下個月' + ic('right', 18, 2.8) + '</button>' +
    '<span class="sfsp"></span>' + statusPill(v.status) + '<button class="btn ghost sm" onclick="go(\'month\',{dept:' + jsq(sf.dept) + ',period:' + jsq(sf.period) + '})">' + (sf.review ? '月曆檢視' : '月曆・送審') + '</button></div>';
  if (!list.length) { $('app').innerHTML = h + (sf.review ? '<div class="empty">這個月沒有每日檢點表。</div>' : '<div class="empty">這個月沒有指派給您的每日檢點表。</div>') + sfPeriodic(); if (sf.review) sfRevBar(); else bar(''); return; }
  if (sf.fi >= list.length) sf.fi = 0;
  h += sfDeptChips();
  h += '<div class="sftabs" role="tablist">' + list.map(function (it, i) {
    var n = Object.keys(sf.ed[it.key] || {}).filter(function (d) { return sfDirty(it, d); }).length, nb = sf.review ? sfBadDays(it).length : 0;
    return '<button role="tab" aria-selected="' + (i === sf.fi) + '" class="sftab' + (i === sf.fi ? ' on' : '') + '" onclick="sfTab(' + i + ')">' + esc(it.x.name || it.f.name) + (n ? '<i class="sfdot">' + n + '</i>' : '') + (nb ? '<i class="sfdot ng">' + nb + '</i>' : '') + '</button>';
  }).join('') + '</div>';
  var it = list[sf.fi];
  if (sf.review) h += sfRevHead();
  else if (sf.period === t.slice(0, 7) && !sfLock(it, Number(t.slice(8)))) h += '<div class="sftool"><button class="btn ghost sm" onclick="sfToday()">' + ic('check', 18, 3) + '今天（' + md(t) + '）全部正常</button><button class="btn ghost sm" onclick="sfTodayNoWork()">今天無作業</button></div>';
  if (!sf.review && !demoDept(v.dept) && (v.status === '填寫中' || v.status === '退回')) h += '<div class="sfhelp">' + ic('info', 16, 2.4) + '<span>點格子直接打字：1 或 V＝正常、2 或 X＝異常、3 或 -＝不適用（依各項的選項）。方向鍵、Tab、Enter 移動；拖曳或 Shift＋方向鍵選一整片一起填；可以從 Excel 複製貼上；Ctrl＋Z 復原。補填的日子會記下填寫時間，單位負責人與環安衛看得到。</span></div>';
  h += '<div class="sfwrap"><div class="sfgrid" id="sfg" tabindex="0" aria-label="' + esc(it.f.name) + '">' + sfTable(it) + '</div><div class="sfside" id="sfs"></div></div>' + sfPeriodic();
  $('app').innerHTML = h;
  for (var d = 1; d <= sfDays(sf.period); d++) sfPaintDay(it, d);
  sfMouse(); sfPaintSel(); sfSide(); if (sf.review) sfRevBar(); else sfBar();
  var g = $('sfg'); if (g && !document.querySelector('.sfside textarea:focus')) g.focus({ preventScroll: true });
}
function sfTable(it) {
  var sf = S.sf, n = sfDays(sf.period), t = today(), f = it.f;
  var h = '<table><thead><tr><th class="t">項目</th>';
  for (var d = 1; d <= n; d++) {
    var date = sfDate(d), wd = !workDay(date);
    h += '<th class="sfh' + (wd ? ' we' : '') + (date === t ? ' td' : '') + '" data-c="' + d + '">' + d + '<small>' + esc(wk(date)) + '</small></th>';
  }
  h += '</tr></thead><tbody>';
  var g = null;
  f.items.forEach(function (q, ri) {
    if (q.group && q.group !== g) { g = q.group; h += '<tr class="sfg"><td class="t" colspan="' + (n + 1) + '">' + esc(g) + '</td></tr>'; }
    h += '<tr><td class="t" data-r="' + ri + '"><span class="no">' + esc(q.seq) + '</span>' + esc(q.text) + '</td>';
    for (var d = 1; d <= n; d++) h += '<td id="sc' + ri + '_' + d + '" data-r="' + ri + '" data-c="' + d + '"></td>';
    h += '</tr>';
  });
  var nr = f.items.length;
  h += '<tr class="sfw"><td class="t" data-r="' + nr + '">無作業（整天沒上班、沒作業）</td>';
  for (var d2 = 1; d2 <= n; d2++) h += '<td id="sc' + nr + '_' + d2 + '" data-r="' + nr + '" data-c="' + d2 + '"></td>';
  h += '</tr><tr class="sfsg"><td class="t">檢查人員</td>';
  for (var d3 = 1; d3 <= n; d3++) h += '<td id="sg' + d3 + '"></td>';
  h += '</tr></tbody></table>';
  return h;
}
/** 只重畫一天（整欄），打字不會整頁閃 */
function sfPaintDay(it, d) {
  var f = it.f, rec = sfRec(it, d), lock = S.sf.review ? '' : sfLock(it, d), dirty = sfDirty(it, d), prob = dirty ? sfProb(it, d) : '', nr = f.items.length;
  f.items.forEach(function (q, ri) {
    var el = $('sc' + ri + '_' + d); if (!el) return;
    var k = rec && !rec.w ? rec.r[q.seq] : '', bad = k && (k === '?' || isBad(f, k)), note = rec && String((rec.n || {})[q.seq] || '').trim();
    el.textContent = rec && rec.w ? '' : sfShow(sfMark(it, ri, k));
    el.className = sfKeep(el) + (lock ? 'lk' : '') + (bad ? ' bad' : '') + (dirty ? ' dt' : rec && rec.pend ? ' pd' : rec && rec.unconf ? ' uc' : '') + (rec && rec.w ? ' nw' : '') + (note ? ' nt' : '') +
      (dirty && bad && f.noteFor.indexOf(k) >= 0 && noteWhy(f, rec, q.seq) ? ' need' : '') + (dirty && !rec.w && !k ? ' miss' : '') + (!rec && !lock && sfGap(d) ? ' gap' : '');
    el.title = lock || (note ? sfT('說明') + '：' + rec.n[q.seq] : '');
  });
  var w = $('sc' + nr + '_' + d);
  if (w) { w.textContent = rec && rec.w ? '無' : ''; w.className = sfKeep(w) + (lock ? 'lk' : '') + (dirty ? ' dt' : rec && rec.pend ? ' pd' : '') + (rec && rec.w ? ' on' : ''); w.title = lock; }
  var sg = $('sg' + d);
  if (sg) { sg.textContent = dirty ? (prob ? '!' : '✎') : rec ? (rec.w ? '' : String(rec.signer || '').slice(-2)) : ''; sg.className = dirty ? (prob ? 'need' : 'dt') : rec && rec.pend ? 'pd' : ''; sg.title = dirty ? (prob || sfT('存檔後帶入您的簽名')) : rec && rec.pend ? sfT('已存，等待上傳') : ''; }
  var th = document.querySelector('#sfg th[data-c="' + d + '"]'); if (th) { th.classList.toggle('dt', dirty); var lt = sfLate(it, d); th.classList.toggle('late', !!lt); if (lt) th.title = sfT('補登') + ' ' + lt; }
}
/** 過去的上班日還沒有紀錄（淡淡標出來，跟月曆的虛線框同一個意思） */
function sfGap(d) { var date = sfDate(d); return date < today() && workDay(date) && !demoDept(S.sf.dept) && !(S.me.startPeriod && S.sf.period < S.me.startPeriod); }
function sfShow(m) { return m === 'ˇ' ? '✓' : m; }   // 紙本、試算表用「ˇ」，螢幕上太小看不清，畫面改顯示 ✓（存回試算表仍是原符號）
function sfKeep(el) { return (el.classList.contains('sel') ? 'sel ' : '') + (el.classList.contains('cur') ? 'cur ' : ''); }
function sfPaintSel() {
  var sf = S.sf, s = sf.sel, g = $('sfg'); if (!g) return;
  g.querySelectorAll('td.sel,td.cur').forEach(function (e) { e.classList.remove('sel'); e.classList.remove('cur'); });
  var r0 = Math.min(s.r0, s.r1), r1 = Math.max(s.r0, s.r1), c0 = Math.min(s.c0, s.c1), c1 = Math.max(s.c0, s.c1);
  for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var e = $('sc' + r + '_' + c); if (e) e.classList.add('sel'); }
  var cur = $('sc' + s.r1 + '_' + s.c1); if (cur) { cur.classList.add('cur'); sfScrollTo(cur); }
}
function sfScrollTo(el) {
  var g = $('sfg'); if (!g) return;
  var gr = g.getBoundingClientRect(), er = el.getBoundingClientRect(), lw = 260;
  if (er.left < gr.left + lw) g.scrollLeft -= gr.left + lw - er.left + 8;
  else if (er.right > gr.right) g.scrollLeft += er.right - gr.right + 8;
  if (er.top < gr.top + 40) g.scrollTop -= gr.top + 40 - er.top + 4;
  else if (er.bottom > gr.bottom) g.scrollTop += er.bottom - gr.bottom + 4;
}
/** 右邊：選到的格子（日期、項目、要寫的說明）＋還沒填完的天 */
function sfSide() {
  var sf = S.sf, el = $('sfs'), it = sf.list[sf.fi]; if (!el || !it) return;
  if (sf.review) return sfRevSide(el, it);
  var s = sf.sel, d = s.c1, ri = s.r1, f = it.f, q = f.items[ri], date = sfDate(d), rec = sfRec(it, d), lock = sfLock(it, d);
  var h = '<div class="card"><div class="mr"><b>' + md(date) + '（' + esc(wk(date)) + '）</b>' + (lock ? pill('na', '', sfT('不能修改')) : sfDirty(it, d) ? pill('warn', 'pen', sfT('未存檔')) : rec && rec.pend ? pill('ok', 'cloud', sfT('已存，等待上傳')) : rec ? pill('ok', 'check', sfT('已送出')) : '') + '</div>';
  if (lock) h += '<div class="muted">' + esc(lock) + '</div>';
  if (q) {
    var k = rec && !rec.w ? rec.r[q.seq] : '';
    h += '<div class="sfq"><span class="sfno">' + esc(q.seq) + '</span>' + esc(q.text) + (q.method ? ' <small>（' + esc(q.method) + '）</small>' : '') + '</div>';
    if (!lock && !(rec && rec.w)) h += '<div class="sfopts">' + sfOpts(it, ri).map(function (o, i) {
      return '<button class="opt ' + optClass(o.k) + (k === o.k ? ' on' : '') + '" onclick="sfPut(' + jsq(o.k) + ')"><kbd>' + (i + 1) + '</kbd>' + esc(o.label) + '</button>';
    }).join('') + '</div>';
    else if (k) h += '<div class="muted">' + esc(optLabel(f, q.seq, k)) + '</div>';
    if (k && f.noteFor.indexOf(k) >= 0) {
      var w = rec && !lock ? noteWhy(f, rec, q.seq) : '';
      h += '<label class="nl req" for="sfn">' + esc(f.noteTitle || '請說明異常狀況與處理方式') + '</label>' +
        '<textarea id="sfn" class="note"' + (lock ? ' disabled' : '') + ' placeholder="' + esc(f.noteTitle || '請說明異常狀況與處理方式') + '" oninput="sfNote(this.value)" onkeydown="sfNoteKey(event)">' + esc((rec && rec.n[q.seq]) || '') + '</textarea>' +
        '<div class="hint nbad" id="sfnh"' + (w && String((rec.n || {})[q.seq] || '').trim() ? '' : ' hidden') + '>' + esc(w) + '</div><div class="muted sm2">' + esc(sfT('寫完按 Esc 回到表格')) + '</div>';
    } else if (rec && rec.n && rec.n[q.seq]) h += '<div class="muted">' + esc(sfT('說明') + '：' + rec.n[q.seq]) + '</div>';
  } else h += '<div class="muted">' + esc(rec && rec.w ? '這一天記為「無作業」，表上留空白。' : '這一天整天沒上班、沒作業，就在這一列打 1 或 V。') + '</div>';
  h += '</div>' + sfTodo();
  el.innerHTML = h;
}
function sfTodo() {
  var sf = S.sf, rows = [];
  sf.list.forEach(function (it, i) {
    Object.keys(sf.ed[it.key] || {}).sort(function (a, b) { return a - b; }).forEach(function (d) {
      if (!sfDirty(it, d)) return; var p = sfProb(it, d); if (p) rows.push({ i: i, d: Number(d), t: md(sfDate(d)) + ' ' + (it.x.name || it.f.name), p: p });
    });
  });
  if (!rows.length) return '';
  return '<div class="card"><b>' + esc('還沒填完的日子（' + rows.length + '）') + '</b><div class="list">' + rows.slice(0, 30).map(function (x) {
    return '<button class="li" onclick="sfJump(' + x.i + ',' + x.d + ')"><span class="mn"><span class="nm">' + esc(x.t) + '</span><span class="mt wn">' + esc(x.p) + '</span></span></button>';
  }).join('') + '</div><div class="muted sm2">' + esc(sfT('沒填完的先留在草稿，不會不見；填好再存檔。')) + '</div></div>';
}
function sfJump(i, d) {
  var sf = S.sf, it = sf.list[i], e = (sf.ed[it.key] || {})[d], ri = 0;
  if (e) { var miss = it.f.items.map(function (q, j) { return j; }).filter(function (j) { var s = it.f.items[j].seq; return !e.r[s] || noteWhy(it.f, e, s); }); ri = miss.length ? miss[0] : 0; }
  sf.sel = { r0: ri, c0: d, r1: ri, c1: d };
  if (i !== sf.fi) { sf.fi = i; sfRender(); } else { sfPaintSel(); sfSide(); $('sfg').focus({ preventScroll: true }); }
}
function sfSaveList() {
  var sf = S.sf, ok = [], bad = 0;
  sf.list.forEach(function (it) { Object.keys(sf.ed[it.key] || {}).forEach(function (d) { if (!sfDirty(it, d)) return; if (sfProb(it, d)) bad++; else ok.push({ it: it, d: Number(d) }); }); });
  return { ok: ok, bad: bad };
}
function sfBar() {
  var s = sfSaveList();
  if (!s.ok.length && !s.bad.length) return bar('');
  bar((s.ok.length ? '<button class="btn" id="sfBtn" onclick="sfSave()">' + ic('check', 22, 2.8) + '存檔並帶入簽名（' + s.ok.length + ' 天）</button>' : '<button class="btn" disabled>還沒有填完的日子可以存</button>') +
    (s.bad.length ? '<div class="muted sm2">還沒填完 ' + s.bad.length + ' 天（先留在草稿，右邊有清單）</div>' : ''));
}

// ── 編輯 ──
function sfEditRec(it, d) {
  var ed = S.sf.ed[it.key] = S.sf.ed[it.key] || {};
  if (!ed[d]) { var b = sfBase(it, d); ed[d] = { r: Object.assign({}, b ? b.r : {}), n: Object.assign({}, b ? b.n : {}), w: !!(b && b.w) }; }
  return ed[d];
}
function sfAfter(it, days) {
  var sf = S.sf, ed = sf.ed[it.key] || {};
  days.forEach(function (d) { if (ed[d] && sfSame(ed[d], sfBase(it, d))) delete ed[d]; sfPaintDay(it, d); });
  sfDraftSave(); sfSide(); sfBar(); sfTabDots();
}
function sfTabDots() {
  var sf = S.sf; document.querySelectorAll('.sftab').forEach(function (b, i) {
    var it = sf.list[i]; if (!it) return; var n = Object.keys(sf.ed[it.key] || {}).filter(function (d) { return sfDirty(it, d); }).length, dot = b.querySelector('.sfdot');
    if (n && !dot) { dot = document.createElement('i'); dot.className = 'sfdot'; b.appendChild(dot); }
    if (dot) { if (n) dot.textContent = n; else dot.remove(); }
  });
}
function sfPush() { var sf = S.sf; sf.undo.push(JSON.stringify(sf.ed)); if (sf.undo.length > 60) sf.undo.shift(); }
function sfUndo() {
  var sf = S.sf; if (!sf.undo.length) return toast('沒有可以復原的動作', '', 1500);
  sf.ed = JSON.parse(sf.undo.pop()); var it = sf.list[sf.fi];
  for (var d = 1; d <= sfDays(sf.period); d++) sfPaintDay(it, d);
  sfDraftSave(); sfSide(); sfBar(); sfTabDots();
}
function sfRect() { var s = S.sf.sel; return { r0: Math.min(s.r0, s.r1), r1: Math.max(s.r0, s.r1), c0: Math.min(s.c0, s.c1), c1: Math.max(s.c0, s.c1) }; }
/** 把選到的那一片填成 fn(列) 回傳的值：選項 k、''＝清掉；無作業那一列 true／false */
function sfFill(fn, ext) {
  var sf = S.sf, it = sf.list[sf.fi], R = sfRect(), nr = it.f.items.length, days = [], skip = 0;
  if (ext) { R.r1 = Math.min(nr, ext.r1); R.c1 = Math.min(sfDays(sf.period), ext.c1); sf.sel = { r0: R.r0, c0: R.c0, r1: R.r1, c1: R.c1 }; sfPaintSel(); }
  var one = R.r0 === R.r1 && R.c0 === R.c1;
  sfPush();
  for (var c = R.c0; c <= R.c1; c++) {
    if (sfLock(it, c)) { skip++; continue; }
    var touched = false;
    for (var r = R.r0; r <= R.r1; r++) {
      var val = fn(r, c); if (val === null || val === undefined) continue;
      var e = sfEditRec(it, c);
      if (r === nr) { e.w = !!val; }
      else { var s = it.f.items[r].seq; if (val) e.r[s] = val; else delete e.r[s]; if (val) e.w = false; }
      touched = true;
    }
    if (touched) days.push(c);
  }
  if (!days.length) { sf.undo.pop(); if (skip) toast(sfLock(it, R.c0) || '這幾天不能修改', '', 2200); return false; }
  sfAfter(it, days);
  if (skip && !one) toast('有 ' + skip + ' 天不能修改，已略過', '', 2200);
  return true;
}
function sfPut(k) {
  var sf = S.sf, it = sf.list[sf.fi], nr = it.f.items.length, idx = sfOpts(it, sf.sel.r1).map(function (o) { return o.k; }).indexOf(k);
  sfFill(function (r) { if (r === nr) return null; var o = sfOpts(it, r); return (o.filter(function (x) { return x.k === k; })[0] || o[idx] || {}).k || null; });
  sfAfterPut(k);
}
/** 打一格選到要寫說明的選項 → 游標直接進說明框；拉一整片填的不跳 */
function sfAfterPut(k) {
  var sf = S.sf, it = sf.list[sf.fi], R = sfRect();
  if (R.r0 === R.r1 && R.c0 === R.c1 && R.r0 < it.f.items.length && it.f.noteFor.indexOf(k) >= 0) {
    var ta = $('sfn'); if (ta && !String(ta.value).trim()) { ta.focus(); return; }
  }
  if (R.r0 === R.r1 && R.c0 === R.c1) sfMove(1, 0, false);
}
function sfType(ch) {
  var sf = S.sf, it = sf.list[sf.fi], nr = it.f.items.length;
  if (sf.sel.r1 === nr && Math.min(sf.sel.r0, sf.sel.r1) === nr) {        // 無作業這一列：打什麼都是切換
    var on = !((sfRec(it, sf.sel.c1) || {}).w);
    if (sfFill(function (r) { return r === nr ? on : null; })) sfMove(0, 1, false);
    return true;
  }
  var k0 = sfKeyOf(it, sf.sel.r1, ch); if (k0 === null) { toast('看不懂「' + esc(ch) + '」：請打 1／2／3 或 V／X／-', 'err', 2200); return true; }
  if (!k0) return false;
  var ki = sfOpts(it, sf.sel.r1).map(function (o) { return o.k; }).indexOf(k0);
  sfFill(function (r) { if (r === nr) return null; var k = sfKeyOf(it, r, ch); if (k === null && ki >= 0) { var o = sfOpts(it, r)[ki]; k = o ? o.k : null; } return k; });
  sfAfterPut(k0);
  return true;
}
function sfClear() { var it = S.sf.list[S.sf.fi], nr = it.f.items.length; sfFill(function (r) { return r === nr ? false : ''; }); }
function sfNote(val) {
  var sf = S.sf, it = sf.list[sf.fi], d = sf.sel.c1, q = it.f.items[sf.sel.r1]; if (!q || sfLock(it, d)) return;
  var e = sfEditRec(it, d); e.n[q.seq] = val;
  var ed = sf.ed[it.key]; if (sfSame(e, sfBase(it, d))) delete ed[d];
  sfPaintDay(it, d); sfDraftSave(); sfBar(); sfTabDots();
  var w = String(val || '').trim() ? noteWhy(it.f, e, q.seq) : '', hn = $('sfnh'); if (hn) { hn.textContent = w; hn.hidden = !w; }
  var sd = document.querySelector('#sfs .card + .card'); var nt = sfTodo();
  if (sd) { if (nt) sd.outerHTML = nt; else sd.remove(); } else if (nt) $('sfs').insertAdjacentHTML('beforeend', nt);
}
function sfNoteKey(e) { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); $('sfg').focus({ preventScroll: true }); sfMove(1, 0, false); } else if (e.key === 'Tab') { e.preventDefault(); $('sfg').focus({ preventScroll: true }); sfMove(0, e.shiftKey ? -1 : 1, false); } }
function sfMove(dr, dc, ext) {
  var sf = S.sf, it = sf.list[sf.fi], s = sf.sel, nr = it.f.items.length, n = sfDays(sf.period);
  var r = Math.max(0, Math.min(nr, s.r1 + dr)), c = Math.max(1, Math.min(n, s.c1 + dc));
  sf.sel = ext ? { r0: s.r0, c0: s.c0, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
  sfPaintSel(); sfSide();
}
function sfKey(e) {
  if (S.page !== 'sheetFill' || !S.sf || !S.sf.list || !S.sf.list.length) return;
  var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if (a && /^(BUTTON|A)$/.test(a.tagName) && (e.key === 'Enter' || e.key === ' ')) return;
  if (document.querySelector('.dlg,.pview,#busy')) return;
  var k = e.key, it = S.sf.list[S.sf.fi], ctl = e.ctrlKey || e.metaKey;
  if (S.sf.review && !(ctl && /^Page/.test(k)) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].indexOf(k) < 0) return;
  if (ctl && (k === 'z' || k === 'Z')) { e.preventDefault(); return sfUndo(); }
  if (ctl && k === 's') { e.preventDefault(); return sfSave(); }
  if (ctl && (k === 'PageDown' || k === 'PageUp')) { e.preventDefault(); return sfTab((S.sf.fi + (k === 'PageDown' ? 1 : -1) + S.sf.list.length) % S.sf.list.length); }
  if (ctl && k === 'a') { e.preventDefault(); S.sf.sel = { r0: 0, c0: 1, r1: it.f.items.length - 1, c1: sfDays(S.sf.period) }; sfPaintSel(); return sfSide(); }
  if (ctl || e.altKey) return;
  var mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
  if (mv) { e.preventDefault(); return sfMove(mv[0], mv[1], e.shiftKey); }
  if (k === 'Tab') { e.preventDefault(); return sfMove(0, e.shiftKey ? -1 : 1, false); }
  if (k === 'Enter') { e.preventDefault(); var ta = $('sfn'); if (ta && !e.shiftKey && !ta.disabled) return ta.focus(); return sfMove(e.shiftKey ? -1 : 1, 0, false); }
  if (k === 'Home') { e.preventDefault(); return sfMove(0, -99, e.shiftKey); }
  if (k === 'End') { e.preventDefault(); return sfMove(0, 99, e.shiftKey); }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return sfClear(); }
  if (k === ' ') { e.preventDefault(); return sfType('1'); }
  if (k.length === 1 && sfType(k)) e.preventDefault();
}
function sfMouse() {
  var g = $('sfg'); if (!g) return;
  var down = false;
  var cell = function (t) { var td = t.closest && t.closest('td[data-c],th[data-c],td[data-r]'); return td && g.contains(td) ? td : null; };
  g.onmousedown = function (e) {
    var td = cell(e.target); if (!td || e.button !== 0) return;
    var sf = S.sf, it = sf.list[sf.fi], nr = it.f.items.length, n = sfDays(sf.period);
    if (td.tagName === 'TH') { var c = Number(td.getAttribute('data-c')); sf.sel = e.shiftKey ? { r0: 0, c0: sf.sel.c0, r1: nr - 1, c1: c } : { r0: 0, c0: c, r1: nr - 1, c1: c }; }
    else if (!td.hasAttribute('data-c')) { var r = Number(td.getAttribute('data-r')); sf.sel = { r0: r, c0: 1, r1: r, c1: n }; }
    else { var r2 = Number(td.getAttribute('data-r')), c2 = Number(td.getAttribute('data-c')); sf.sel = e.shiftKey ? { r0: sf.sel.r0, c0: sf.sel.c0, r1: r2, c1: c2 } : { r0: r2, c0: c2, r1: r2, c1: c2 }; down = true; }
    e.preventDefault(); g.focus({ preventScroll: true }); sfPaintSel(); sfSide();
  };
  g.onmouseover = function (e) {
    if (!down || !(e.buttons & 1)) { down = false; return; }
    var td = cell(e.target); if (!td || !td.hasAttribute('data-c') || td.tagName === 'TH') return;
    var sf = S.sf, r = Number(td.getAttribute('data-r')), c = Number(td.getAttribute('data-c'));
    if (sf.sel.r1 === r && sf.sel.c1 === c) return;
    sf.sel.r1 = r; sf.sel.c1 = c; sfPaintSel();
  };
  g.onmouseup = function () { if (down) { down = false; sfSide(); } };
  g.ondblclick = function (e) {                       // 連點兩下：換下一個選項（滑鼠派）
    var td = cell(e.target); if (!td || !td.hasAttribute('data-c') || td.tagName === 'TH' || S.sf.review) return;
    var sf = S.sf, it = sf.list[sf.fi], r = Number(td.getAttribute('data-r')), c = Number(td.getAttribute('data-c'));
    if (r === it.f.items.length) return sfType('1');
    var o = sfOpts(it, r), rec = sfRec(it, c), cur = rec && !rec.w ? rec.r[it.f.items[r].seq] : '', i = o.map(function (x) { return x.k; }).indexOf(cur);
    sfFill(function (rr) { return rr === r ? o[(i + 1) % o.length].k : null; });
  };
  g.oncopy = function (e) {
    var sf = S.sf, it = sf.list[sf.fi], R = sfRect(), nr = it.f.items.length, rows = [];
    for (var r = R.r0; r <= R.r1; r++) { var row = []; for (var c = R.c0; c <= R.c1; c++) { var rec = sfRec(it, c); row.push(r === nr ? (rec && rec.w ? '無' : '') : rec && !rec.w ? sfMark(it, r, rec.r[it.f.items[r].seq]) : ''); } rows.push(row.join('\t')); }
    e.clipboardData.setData('text/plain', rows.join('\n')); e.preventDefault(); toast('已複製', '', 1200);
  };
  g.onpaste = function (e) {
    var txt = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; if (!txt || S.sf.review) return;
    e.preventDefault();
    var sf = S.sf, it = sf.list[sf.fi], R = sfRect(), nr = it.f.items.length, rows = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(function (l) { return l.split('\t'); });
    var single = rows.length === 1 && rows[0].length === 1, bad = 0;
    sfFill(function (r, c) {
      var s = single ? rows[0][0] : (rows[r - R.r0] || [])[c - R.c0];
      if (!single && (r - R.r0 >= rows.length || c - R.c0 >= (rows[0] || []).length)) return null;
      s = String(s == null ? '' : s).trim(); if (!s) return null;
      if (r === nr) return /^(無|無作業|v|V|1|✓|√)$/.test(s) ? true : null;
      var k = sfKeyOf(it, r, s); if (k === null) { bad++; return null; } return k;
    }, single ? null : { r1: R.r0 + rows.length - 1, c1: R.c0 + rows[0].length - 1 });
    if (bad) toast('有 ' + bad + ' 格看不懂，沒有貼上', 'err', 2600);
  };
}
function sfTab(i) { var sf = S.sf; if (i === sf.fi) return; sf.fi = i; sf.undo = []; sfSeedSel(); sfRender(); }
function sfGo(k) { var sf = S.sf, np = addM(sf.period, k); if (np > today().slice(0, 7)) return; S.sf = null; go('sheetFill', sf.review ? { dept: sf.dept, period: np, review: 1 } : { dept: sf.dept, period: np }, true); }

function sfSave() {
  var sf = S.sf, s = sfSaveList(); if (!s.ok.length) return toast(s.bad ? '還沒填完的日子不能存，右邊有清單' : '沒有要存的', '', 2400);
  if (S.dev) return devBlock('表格填寫');
  var btn = $('sfBtn'); if (btn) { btn.disabled = true; btn.className = 'btn busy'; btn.innerHTML = '<span class="spin"></span>' + esc(sfT('存檔中…')); }
  var tok = lsGet(LS.TOKEN, ''), who = S.me.person.name, p = Promise.resolve(), saved = [];
  s.ok.forEach(function (x) {
    var it = x.it, a = it.a, e = sf.ed[a.key][x.d], date = sfDate(x.d), notes = {};
    if (!e.w) Object.keys(e.n || {}).forEach(function (k) { if (k !== '*' && String(e.n[k] || '').trim() && isBad(it.f, e.r[k])) notes[k] = e.n[k]; });
    var body = { deptId: a.dept, formId: a.form, object: a.object || '', kind: a.kind || '', date: date, results: e.w ? {} : e.r, notes: notes, extra: {}, noWork: !!e.w };
    var job = { id: newId(), token: tok, who: who, key: a.key, body: body, created: Date.now(), status: 'pending', label: it.f.name + ' ' + md(date), via: 'grid' };
    p = p.then(function () { return obPut(job); }).then(function () { saved.push(x); });
  });
  p.then(function () {
    saved.forEach(function (x) { delete sf.ed[x.it.key][x.d]; });
    sfDraftSave(); return obRefresh();
  }).then(function () {
    sfRender();
    toast('已存 ' + saved.length + ' 天，已帶入您的簽名；背景上傳中', 'ok', 3500);
    flush().then(function () { if (S.page === 'sheetFill' && S.sf === sf) { sf.stale = true; sfLoad(); } });
  }).catch(function (err) {
    toast('存檔失敗：' + esc(err.message), 'err', 5000); sfRender();
  });
}
document.addEventListener('keydown', sfKey);

// ───────────── 試算表開放編輯（10/29 Jason：部門檢點試算表平常連環安衛都只能看，輸入後台「試算表編輯密碼」才開放 30 分鐘）─────────────
function slBox(v) {
  var open = v.status === '填寫中' || v.status === '退回';
  var h = '<a class="link" href="' + esc(v.sheetEdit || v.sheetUrl) + '" target="_blank" rel="noopener">' + ic('ext', 18, 2.2) + (v.sheetOpen ? '在 Google 試算表編輯' : '在 Google 試算表檢視（唯讀）') + '</a>';
  if (!open) return h;
  if (v.sheetOpen) return h + '<div class="slrow"><span class="muted sm2">已開放編輯到 ' + esc(v.sheetOpen) + '，時間到自動收回。在試算表改的內容，要本人回 App 確認才算簽名。</span><button class="btn ghost sm" onclick="slRelock()">立即收回</button></div>';
  return h + '<div class="slrow"><input type="password" class="field" id="slpw" placeholder="試算表編輯密碼（後台「設定」）" autocomplete="off" onkeydown="if(event.key===\'Enter\')slUnlock()"><button class="btn ghost sm" id="slBtn" onclick="slUnlock()">開放編輯 30 分鐘</button></div>';
}
function slUnlock() {
  var v = S.view, el = $('slpw'), pw = el ? el.value : '';
  if (!String(pw).trim()) { if (el) el.focus(); return toast('請輸入試算表編輯密碼', 'err'); }
  var b = $('slBtn'); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>'; }
  api('sheetUnlock', { deptId: v.dept, period: v.period, pw: pw }).then(function (r) {
    v.sheetOpen = r.until; v.sheetEdit = r.url; rcClear(); monthRender();
    toast('已開放編輯到 ' + esc(r.until) + '，點「在 Google 試算表編輯」', 'ok', 4000);
  }).catch(function (e) { if (b) { b.disabled = false; b.textContent = '開放編輯 30 分鐘'; } toast(esc(e.message), 'err', 4000); });
}
function slRelock() {
  var v = S.view;
  api('sheetRelock', { deptId: v.dept, period: v.period }).then(function () { v.sheetOpen = ''; v.sheetEdit = ''; rcClear(); monthRender(); toast('已收回，試算表恢復唯讀', 'ok'); })
    .catch(function (e) { toast(esc(e.message), 'err', 4000); });
}

// ───────────── 電腦版表格審核（10/29 Jason：主管審核也是手機或電腦版 App 二擇一）─────────────
// 同一個表格畫面、只能看：分頁＝本課每張每日表（紅點＝異常天數），右邊是點到的那格、異常一覽、送審前問題；下面是本月定期檢查；底部核准／退回。
function sfBadDays(it) { return Object.keys(it.x.days).filter(function (d) { return dayBad(it.f, it.x.days[d]); }); }
function sfLate(it, d) { var L = S.sf.v.model.late || {}, x = L[it.x.form]; return x && x[d] ? String(x[d]).slice(5, 16) : ''; }
/** 全課的異常（哪張表、哪天、哪一項、說明） */
function sfBadList() {
  var out = [];
  S.sf.list.forEach(function (it, i) {
    Object.keys(it.x.days).sort(function (a, b) { return a - b; }).forEach(function (d) {
      var r = it.x.days[d]; if (!r || r.noWork) return;
      it.f.items.forEach(function (q, ri) {
        var k = (r.results || {})[q.seq]; if (!(k === '?' || (k && it.f.noteFor.indexOf(k) >= 0))) return;
        out.push({ i: i, d: Number(d), ri: ri, t: md(sfDate(Number(d))) + ' ' + (it.x.name || it.f.name), q: '第 ' + q.seq + ' 項 ' + q.text, k: k === '?' ? '?' : optLabel(it.f, q.seq, k), n: (r.notes || {})[q.seq] || '' });
      });
    });
  });
  return out;
}
function sfRevHead() {
  var sf = S.sf, v = sf.v, days = 0, nw = 0, late = 0, uc = 0;
  sf.list.forEach(function (it) {
    Object.keys(it.x.days).forEach(function (d) { var r = it.x.days[d]; if (r.noWork) nw++; else days++; if (r.unconf) uc++; });
    late += Object.keys((v.model.late || {})[it.x.form] || {}).length;
  });
  var nb = sfBadList().length;
  return '<div class="stats sfstats">' + (v.submitter ? '<span>送審人 <b>' + esc(v.submitter) + '</b></span>' : '') + '<span>每日表 <b>' + sf.list.length + '</b> 張</span><span>檢點 <b>' + days + '</b> 天次</span><span>無作業 <b>' + nw + '</b> 天次</span>' +
    (nb ? '<span class="ng">異常 <b>' + nb + '</b> 項</span>' : '<span>異常 <b>0</b> 項</span>') + (late ? '<span class="wn">補登 <b>' + late + '</b> 天次</span>' : '') + (uc ? '<span class="wn">試算表填的待確認 <b>' + uc + '</b></span>' : '') +
    '<span>定期檢查 <b>' + (v.model.periodic || []).length + '</b> 份</span></div>';
}
function sfRevSide(el, it) {
  var sf = S.sf, s = sf.sel, d = s.c1, q = it.f.items[s.r1], date = sfDate(d), r = it.x.days[d], lt = sfLate(it, d);
  var h = '<div class="card"><div class="mr"><b>' + md(date) + '（' + esc(wk(date)) + '）</b>' + (r && r.signer ? '<span class="muted">檢查人員 ' + esc(r.signer) + '</span>' : '') + '</div>';
  if (!r) h += '<div class="muted">這天沒有紀錄。</div>';
  else if (r.noWork) h += '<div class="muted">這天記為「無作業」。</div>';
  else if (q) {
    var k = (r.results || {})[q.seq];
    h += '<div class="sfq"><span class="sfno">' + esc(q.seq) + '</span>' + esc(q.text) + '</div>' +
      (k ? pill(k === '?' || isBad(it.f, k) ? 'ng' : 'ok', k === '?' || isBad(it.f, k) ? 'x' : 'check', k === '?' ? '?' : optLabel(it.f, q.seq, k)) : pill('na', '', '未填')) +
      ((r.notes || {})[q.seq] ? '<div class="ex"><b>說明</b>：' + esc(r.notes[q.seq]) + '</div>' : '');
  }
  if (lt) h += '<div class="muted" style="color:var(--orT)">補登：' + esc(lt) + ' 登錄</div>';
  if (r && r.proxy) h += '<div class="muted" style="color:var(--orT)">' + esc(r.proxy) + '，簽名為代填人當場手寫</div>';
  if (r && r.unconf) h += '<div class="muted" style="color:var(--orT)">在試算表填的，本人還沒在 App 確認</div>';
  h += '</div>';
  var v = sf.v;
  if (v.problems && v.problems.length) h += '<div class="card"><b>送審檢查還有 ' + v.problems.length + ' 個問題</b><div class="list">' + v.problems.slice(0, 15).map(function (p) { return '<div class="li" style="min-height:44px"><span class="mn"><span class="mt wn">' + esc(p) + '</span></span></div>'; }).join('') + '</div></div>';
  var bl = sfBadList();
  h += '<div class="card"><b>' + esc('異常一覽（' + bl.length + '）') + '</b>' + (bl.length ? '<div class="list">' + bl.slice(0, 40).map(function (x) {
    return '<button class="li" onclick="sfGoCell(' + x.i + ',' + x.d + ',' + x.ri + ')"><span class="mn"><span class="nm">' + esc(x.t) + '</span><span class="mt">' + esc(x.q + '：' + x.k) + '</span>' + (x.n ? '<span class="mt">' + esc('說明：' + x.n) + '</span>' : '<span class="mt wn">' + esc('沒有說明') + '</span>') + '</span></button>';
  }).join('') + '</div>' : '<div class="muted">這個月沒有異常項目。</div>') + '</div>';
  el.innerHTML = h;
}
function sfGoCell(i, d, ri) {
  var sf = S.sf; sf.sel = { r0: ri, c0: d, r1: ri, c1: d };
  if (i !== sf.fi) { sf.fi = i; sfRender(); } else { sfPaintSel(); sfSide(); $('sfg').focus({ preventScroll: true }); }
}
function sfRevBar() {
  var v = S.sf.v, boss = mgrOf(v.dept), ehs = isEhs();
  if (v.status === '待主管審核' && boss && !ehs) {
    bar('<div class="sfrb"><textarea id="cm" class="note plain" placeholder="意見：核准可不填；退回要寫要改哪一天、哪一項，例：10/3、10/7 堆高機第 5 項沒寫異常說明">' + esc(S.cm || '') + '</textarea>' +
      '<button class="btn redline" onclick="doReview(\'return\')">退回</button><button class="btn" onclick="doReview(\'approve\')">' + ic('pen', 22) + '核准並簽名</button></div>');
  } else if (v.status === '待環安衛審核' && ehs) {
    bar('<div class="sfrb"><button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic('pdf', 20, 2.2) + '開啟 PDF</button><button class="btn redline" onclick="doEhs(\'return\')">退回</button><button class="btn" onclick="doEhs(\'approve\')">' + ic('check', 22, 2.8) + '核准歸檔</button></div>');
  } else if (v.status === '已歸檔' || v.status === '待環安衛審核') {
    bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic('pdf', 20, 2.2) + '開啟 PDF</button>');
  } else bar((v.status === '填寫中' || v.status === '退回') ? '<button class="btn" disabled>本課還沒送審（' + esc(v.status) + '）</button>' : '');
}
/** 表格下面：定期檢查。審核＝本月每一份紀錄；填寫＝我負責的定期表（點了用逐張填寫，要附照片、紀要的照常附）＋本月已做的 */
function sfPeriodic() {
  var sf = S.sf, v = sf.v, forms = S.me.forms, h = '';
  if (!sf.review && !isEhs()) {
    var picks = (S.me.assigns || []).filter(function (a) { return a.dept === v.dept && a.pick && F(a.form); });
    if (picks.length) h += '<div class="sec">我負責的定期檢查<small>每月、每年這類一次一張的表：點一下逐項填，附照片用電腦選檔案即可</small></div><div class="list sfplist">' + picks.map(function (a) {
      var f = F(a.form), ttl = f.name + (a.object ? '・' + a.object + (a.objectName ? ' ' + a.objectName : '') : '') + (a.kind ? '・' + a.kind : '');
      return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(ttl) + '</span><span class="mt">' + esc(dueMeta(a)) + '</span></span>' + duePill(a) + '</button>';
    }).join('') + '</div>';
  }
  var per = v.model.periodic || [];
  if (per.length) h += '<div class="sec">定期檢查（本月紀錄 ' + per.length + ' 份）</div><div class="sfper">' + per.map(function (x) { return sheetHtml(forms[x.form], x); }).join('') + '</div>';
  else if (sf.review) h += '<div class="sec">定期檢查（本月）</div><div class="empty">這個月沒有定期檢查紀錄。</div>';
  return h;
}

// ───────────── 網頁版工作台右欄（10/29）：每日檢點今天的狀態＋整月表格入口、快到期的定期檢查 ─────────────
function deskDaily(m) {
  if (isEhs()) return '';
  var t = today(), h = '', multi = m.depts.length > 1;
  m.depts.forEach(function (d) {
    var daily = m.assigns.filter(function (a) { return a.dept === d.id && a.daily && F(a.form); });
    if (!daily.length) return;
    h += '<div class="card dkc"><div class="mr"><b>' + esc('每日檢點' + (multi ? '・' + d.id : '')) + '</b>' +
      (demoDept(d.id) ? '' : '<button class="btn ghost sm" onclick="S.sf=null;go(\'sheetFill\',{dept:' + jsq(d.id) + ',period:' + jsq(t.slice(0, 7)) + '})">' + ic('pen', 18, 2.4) + '用表格填寫整月</button>') + '</div><div class="list">' +
      daily.map(function (a) {
        var job = pendJob(a, t), f = F(a.form);
        var st = job ? pill('info', 'up', '待上傳') : a.due.todayNoWork ? pill('na', 'minus', '今日無作業') : a.due.todayDone ? pill('ok', 'check', a.due.signer && a.due.signer !== m.person.name ? a.due.signer + ' 已檢點' : '已檢點') : pill('warn', 'pen', '今天未檢點');
        return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + esc(f.items.length + ' 項' + (a.object ? '・' + a.object : '')) + '</span></span>' + st + '</button>';
      }).join('') + '</div></div>';
  });
  var due = m.assigns.filter(function (a) { return a.pick && a.due && (a.due.state === 'overdue' || a.due.state === 'soon') && F(a.form); });
  if (due.length) h += '<div class="card dkc"><div class="mr"><b>' + esc('定期檢查快到期（' + due.length + '）') + '</b><button class="btn ghost sm" onclick="go(\'mine\')">我的表單</button></div><div class="list">' +
    due.slice(0, 8).map(function (a) {
      return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(pickName(a)) + '</span><span class="mt">' + esc(dueMeta(a)) + '</span></span>' + duePill(a) + '</button>';
    }).join('') + '</div></div>';
  return h;
}
/** 表格頁：一個人負責好幾個部門時，上方切換部門 */
function sfDeptChips() {
  var sf = S.sf; if (sf.review) return '';
  var ds = S.me.depts.filter(function (d) { return S.me.assigns.some(function (a) { return a.dept === d.id && a.daily; }); });
  if (ds.length < 2) return '';
  return '<div class="chips">' + ds.map(function (d) {
    return '<button class="chip' + (d.id === sf.dept ? ' on' : '') + '" aria-pressed="' + (d.id === sf.dept) + '" onclick="S.sf=null;go(\'sheetFill\',{dept:' + jsq(d.id) + ',period:' + jsq(sf.period) + '},true)">' + esc(d.id) + '</button>';
  }).join('') + '</div>';
}
/** 今天這一欄：全部填第一個選項（正常）／記為無作業 */
function sfToday() {
  var sf = S.sf, it = sf.list[sf.fi], d = Number(today().slice(8)), nr = it.f.items.length;
  sf.sel = { r0: 0, c0: d, r1: nr - 1, c1: d }; sfPaintSel();
  sfFill(function (r) { if (r === nr) return null; var rec = sfRec(it, d), s0 = it.f.items[r].seq, cur = rec && !rec.w ? rec.r[s0] : ''; return cur && cur !== '' ? (cur === 'na' ? 'na' : cur) : sfOpts(it, r)[0].k; });
  sfSide(); toast('今天已填「' + esc(sfOpts(it, 0)[0].label) + '」，有異常的請個別改，再按存檔', '', 2600);
}
function sfTodayNoWork() {
  var sf = S.sf, it = sf.list[sf.fi], d = Number(today().slice(8)), nr = it.f.items.length;
  sf.sel = { r0: nr, c0: d, r1: nr, c1: d }; sfPaintSel();
  sfFill(function (r) { return r === nr ? true : null; }); sfSide();
}

// ───────────── 網頁版部門管理：分工表（人員 × 表單／設備，一張表勾完）─────────────
// 手機是「點一位同仁 → 勾他負責的」；電腦一次看整課：每一列一位檢點人員、每一欄一張表或一台設備，勾選就是負責；改完一次存（今天起或下月起）。
function tmxWant(tm) {
  if (!S.tmx || S.tmx.dept !== tm.dept || S.tmx.at !== tm) { S.tmx = { dept: tm.dept, at: tm, want: {} }; tm.targets.forEach(function (x) { S.tmx.want[x.key] = x.now.slice(); }); }
  return S.tmx.want;
}
function tmxDiff(tm) {
  var w = tmxWant(tm);
  return tm.targets.filter(function (x) { return w[x.key].slice().sort().join() !== x.now.slice().sort().join(); }).map(function (x) { return { key: x.key, names: w[x.key].slice(), name: x.name }; });
}
function tmxHtml(tm) {
  var w = tmxWant(tm), ops = tm.people.filter(function (p) { return p.role === '檢點人員'; });
  var cols = tm.targets.filter(function (x) { return x.kind === 'form'; }).sort(function (a, b) { return (b.daily ? 1 : 0) - (a.daily ? 1 : 0); }).concat(tm.targets.filter(function (x) { return x.kind === 'equip'; }));
  if (!ops.length) return '<div class="empty">這一課還沒有檢點人員，人員新增請洽環安衛中心。</div>';
  var nf = cols.filter(function (x) { return x.kind === 'form'; }).length;
  var h = '<div class="muted upnote">每一列一位檢點人員、每一欄一張表或一台設備：勾選＝負責，同一項可以多人。改完按下方「今天起生效」或「下月起」一次存。人員、表單、設備的新增或停用請洽環安衛中心。</div>' +
    '<div class="tmx"><table><thead><tr><th class="t">檢點人員</th>' + (nf ? '<th class="grp" colspan="' + nf + '">表單</th>' : '') + (cols.length - nf ? '<th class="grp" colspan="' + (cols.length - nf) + '">設備</th>' : '') + '</tr><tr><th class="t"></th>' +
    cols.map(function (x) { return '<th class="c' + (x.daily ? ' dly' : '') + '" title="' + esc(x.name) + '"><span>' + esc(x.name) + '</span>' + (x.daily ? '<small>每日</small>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
  ops.forEach(function (p) {
    var warn = !p.loggedIn || !p.signed;
    h += '<tr><td class="t"><b>' + esc(p.name) + '</b><small class="' + (warn ? 'wn' : '') + '">' + esc((p.loggedIn ? '已登入' : '還沒登入') + '・' + (p.signed ? '已簽名' : '還沒簽名')) + '</small></td>';
    cols.forEach(function (x) {
      var on = w[x.key].indexOf(p.name) >= 0, was = x.now.indexOf(p.name) >= 0, nx = x.next && x.next.indexOf(p.name) >= 0 !== was;
      h += '<td class="' + (on !== was ? 'chg' : '') + '"><label><input type="checkbox"' + (on ? ' checked' : '') + ' aria-label="' + esc(p.name + '・' + x.name) + '" onchange="tmxTick(' + jsq(x.key) + ',' + jsq(p.name) + ',this.checked)"></label>' +
        (nx ? '<i class="nx" title="' + esc(Number(tm.month.slice(5)) + ' 月起' + (was ? '不負責' : '負責')) + '"></i>' : '') + '</td>';
    });
    h += '</tr>';
  });
  h += '<tr class="sum"><td class="t">負責人數</td>' + cols.map(function (x) { var n = w[x.key].length; return '<td class="' + (n ? '' : 'none') + '">' + (n || '無') + '</td>'; }).join('') + '</tr></tbody></table></div>';
  var none = cols.filter(function (x) { return !w[x.key].length; });
  if (none.length) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>' + esc(none.length + ' 項沒有人負責') + '</b><div class="m">' + esc('沒有負責人＝本課不再使用（手機上看不到、不算缺漏）：' + none.map(function (x) { return x.name; }).join('、')) + '</div></div></div></div>';
  return h;
}
function tmxTick(key, name, on) {
  var tm = S.team, w = tmxWant(tm)[key];
  if (on && w.indexOf(name) < 0) w.push(name);
  if (!on) tmxWant(tm)[key] = w.filter(function (n) { return n !== name; });
  var y = window.scrollY, g = document.querySelector('.tmx'), sx = g ? g.scrollLeft : 0; render(); window.scrollTo(0, y); g = document.querySelector('.tmx'); if (g) g.scrollLeft = sx;
}
function tmxBar(tm) {
  var n = tmxDiff(tm).length, mo = Number(tm.month.slice(5)) + ' 月';
  bar('<div class="btns r21"><button class="btn"' + (n ? '' : ' disabled') + ' onclick="tmxSave(\'now\')">' + ic('check', 22, 2.8) + (n ? '今天起生效（' + n + ' 項）' : '沒有變更') + '</button>' +
    '<button class="btn ghost"' + (n ? '' : ' disabled') + ' onclick="tmxSave(\'next\')">下月起（' + esc(mo) + '）</button></div>' + (n ? '<button class="btn ghost sm" onclick="S.tmx=null;render()">還原</button>' : ''));
}
function tmxSave(when) {
  var tm = S.team, ch = tmxDiff(tm); if (!ch.length) return;
  if (!navigator.onLine) return toast('沒有網路，調整要連上網路才能存', 'err', 3500);
  var empty = ch.filter(function (c) { return !c.names.length; });
  if (empty.length && !confirm(sfT('沒有勾任何人＝本課不再使用：') + empty.map(function (c) { return c.name; }).join('、') + '\n' + sfT('確定嗎？'))) return;
  busyOn('儲存中…', '共 ' + ch.length + ' 項');
  var i = 0, step = function () {
    if (i >= ch.length) { rcClear(); return api('team', { deptId: tm.dept }).then(function (r) { S.team = r; S.teamAt = Date.now(); }); }   // 不用暫存：要看到剛存好的
    var c = ch[i++];
    return api(when === 'now' ? 'assignNow' : 'nextSet', { deptId: tm.dept, target: c.key, names: c.names }).then(step);
  };
  step().then(function () {
    busyOff(); S.tmx = null; toast(when === 'now' ? '已改好 ' + ch.length + ' 項，今天起生效' : '已安排 ' + ch.length + ' 項，' + Number(tm.month.slice(5)) + ' 月 1 日生效', 'ok', 3500);
    if (when === 'now') refreshMe();
    render();
  }).catch(function (e) { busyOff(); toast(esc(e.message) + (i > 1 ? '（前 ' + (i - 1) + ' 項已存）' : ''), 'err', 5000); S.tmx = null; teamLoad(tm.dept).then(function () { render(); }); });
}
