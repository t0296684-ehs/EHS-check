// ───────────── 承攬商管理（v0.15，10/19 Jason：舊承攬商系統搬進 App；同日晚依第二輪意見＋舊系統細節補回）─────────────
// 廠商、施工人員、員和承辦人員：從連結進來，不用登入、不碰這支手機原本的帳號。
//   #cons=reg|apply&i=邀請碼  廠商建檔／施工申請（特殊作業許可同一張填完、可附檔）
//   #cons=case&c=案件權杖     案件頁：自檢清單、兩組 QR、提交審核、補件、補附件、局限空間氣體測定
//   #cons=sign&w=簽名權杖     施工人員掃碼親簽（名單上沒有的可現場補充；斷線保留、恢復自動補送）
//   #cons=hsign&h=承辦權杖    員和承辦人員掃碼簽名（不用 App；比照舊系統 HandlerSignPage）
// 員工：主選單「施工申請」—— 傳邀請連結、承辦簽名與提交、環安衛審核、承諾書登記。後端：mod/cons.gs。
var CN_ST_PILL = { '暫緩－文件不齊': 'warn', '施工人員簽名中': 'info', '待審核': 'warn', '已核准': 'ok', '補件退回': 'bad', '已駁回': 'na', '已結案': 'na' };
(function () {
  var st = document.createElement('style');
  st.textContent = '.cwrap{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px}.cwrap .chip{min-height:40px;font-size:15px}' +
    '.cnw{display:grid;grid-template-columns:1fr 92px 44px;gap:6px;align-items:center;margin-bottom:6px}.cnw .field{margin:0}' +
    '.cnwh{margin-bottom:2px}.cnwh span{font-size:13px;font-weight:800;color:var(--sub);padding-left:4px}.cnw .rm{min-height:44px;border:0;background:#F1F4F8;border-radius:10px;font-size:20px}.cnqr{display:flex;justify-content:center;margin:10px 0}.cnqr svg{width:220px;height:220px}' +
    '.cnno{background:#FFF8EC;border-left:4px solid #E58A00;border-radius:0 10px 10px 0;padding:10px 14px;margin:8px 0}.cnno b{display:block;margin-bottom:4px}.cnno li{margin:3px 0}' +
    '.cnwk{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #EEF1F5}.cnagree{display:flex;gap:10px;align-items:flex-start;margin:12px 0;font-size:15px}' +
    '.cnagree input{width:24px;height:24px;flex-shrink:0;margin-top:2px}.cnpm{border:1.5px solid #E58A00;border-radius:12px;padding:10px 12px;margin:10px 0;background:#FFFCF5}' +
    '.cnpm h4{margin:0 0 6px;font-size:16px;color:#92400E}.cntd{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid #EEF1F5}.cntd i{flex-shrink:0;width:22px;height:22px;border-radius:50%;' +
    'display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:900;font-size:13px}.cntd .y{background:#DCFCE7;color:#166534}.cntd .n{background:#FEF3C7;color:#92400E}' +
    '.cntd small{display:block;color:var(--sub)}.cnqrbox{border:1.5px solid #D5DCE6;border-radius:12px;padding:10px 12px;margin:10px 0}.cnqrbox h4{margin:0;font-size:16px}' +
    '.cnfile{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #EEF1F5;font-size:15px}';
  document.head.appendChild(st);
})();

function cnRoute() {
  var h = location.hash, m = /[#&]cons=(reg|apply|case|sign|hsign|vlogin)(?=&|$)/.exec(h);
  if (!m) return null;
  if (m[1] === 'vlogin') { var vs0 = cnVs(); return vs0 ? { kind: 'vhome', vs: vs0, f: {} } : { kind: 'login', f: { clTax: (/[#&]t=(\d{8})/.exec(h) || [])[1] || '' } }; }   // t＝統編（環安衛分享的登入連結帶好帳號）
  var g = function (k) { var x = new RegExp('[#&]' + k + '=([0-9a-fA-F]+)').exec(h); return x ? x[1].toLowerCase() : ''; };
  return { kind: m[1], i: g('i'), c: g('c'), w: g('w'), h: g('h'), f: {}, step: 0 };
}
/** 這支手機的代號（隨機，存在手機）：同一支手機簽了好幾個人、承辦人員用了廠商的手機時，環安衛看得到。 */
function cnDev() {
  var k = 'cons_dev', v = '';
  try { v = localStorage.getItem(k) || ''; } catch (e) {}
  if (!/^[0-9a-f]{32}$/.test(v)) {
    v = ''; var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 16; i++) v += ('0' + a[i].toString(16)).slice(-2);
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  return v;
}
function cnPub(action, body) {
  var P = S.cpub, b = Object.assign({ ak: cnDev() }, body || {});
  if (P.demo) {                                                         // 示範（勞檢用）：資料是假的，什麼都不送出
    if (action === 'consPubVHome') return Promise.resolve(P.demo.home);
    if (action === 'consPubCase') return Promise.resolve(P.demo.cases[P.cid]);
    var e0 = new Error('示範模式：這個動作不會真的送出'); e0.biz = true; toast('示範模式：不會真的送出', '', 2500); return Promise.reject(e0);
  }
  if (P.i) b.i = P.i; if (P.c) b.c = P.c; if (P.w) b.w = P.w; if (P.h) b.h = P.h; if (P.vs && !P.c) { b.vs = P.vs; if (P.cid) b.cid = P.cid; }
  return api(action, b, { token: '-' }).catch(function (e) { if (e.biz && /請重新登入|登入已失效/.test(e.message)) cnVs(null); throw e; });
}
/** 承攬商登入權杖（跟員工的啟用碼一樣登入一次、手機記住）。 */
function cnVs(v) {
  try { if (v === null) localStorage.removeItem('cons_vs'); else if (v) localStorage.setItem('cons_vs', v); else return /^[0-9a-f]{64}$/.test(localStorage.getItem('cons_vs') || '') ? localStorage.getItem('cons_vs') : ''; } catch (e) { return ''; }
}
function cnB64Save(r) {
  var bin = atob(r.data), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  var url = URL.createObjectURL(new Blob([a], { type: r.type || 'application/octet-stream' })), el = document.createElement('a');
  el.href = url; el.download = r.name; document.body.appendChild(el); el.click(); setTimeout(function () { URL.revokeObjectURL(url); el.remove(); }, 4000);
}
function cnHero(title, sub) {
  S.hero = '<div class="hero-in"><div class="brand"><span class="logo"><img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block"></span>員和工業・承攬商施工申請</div>' +
    '<div class="hn"><div class="h1">' + esc(title) + '</div>' + (sub ? '<div class="hsub">' + esc(sub) + '</div>' : '') + '</div></div>';
}
function cnFail(e) { $('app').innerHTML = errBox(e.biz ? '這個連結不能用' : '連不上系統', e.message) + (e.biz ? '' : '<button class="btn navy" onclick="render()">再試一次</button>'); }
function cnBusy(id, txt) { var b = $(id); if (b) { b.disabled = true; b.className = 'btn busy'; b.innerHTML = '<span class="spin"></span>' + esc(txt); } }
function cnUnbusy(id, txt) { var b = $(id); if (b) { b.disabled = false; b.className = 'btn'; b.textContent = txt; } }
function cnField(id, label, val, o) {
  o = o || {};
  return '<label class="nl' + (o.req === false ? '' : ' req') + '" for="' + id + '">' + esc(label) + '</label>' +
    '<input class="field" id="' + id + '" ' + (o.type ? 'type="' + o.type + '" ' : '') + (o.mode ? 'inputmode="' + o.mode + '" ' : '') + 'maxlength="' + (o.max || 60) + '"' +
    (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' value="' + esc(val || '') + '" oninput="S.cpub.f[' + jsq(id) + ']=this.value"' + (o.change ? ' onchange="' + o.change + '"' : '') + '>' +
    (o.hint ? '<div class="muted sm">' + esc(o.hint) + '</div>' : '');
}
function cnChips(key, list, sel, label) {
  return '<div class="cwrap">' + list.map(function (x, i) {
    var on = (sel || []).indexOf(x) >= 0;
    return '<button type="button" class="chip' + (on ? ' on' : '') + '" onclick="cnTog(' + jsq(key) + ',' + jsq(x) + ')">' + (on ? ic('check', 14, 3) : '') + esc(label ? label[i] : x) + '</button>';
  }).join('') + '</div>';
}
/** key 可以是「pm.動火作業.dates」這種路徑（特殊作業區塊用）。 */
function cnPath(key, mk) {
  var p = key.split('.'), o = S.cpub.f;
  for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]]) { if (!mk) return null; o[p[i]] = {}; } o = o[p[i]]; }
  return { o: o, k: p[p.length - 1] };
}
function cnTog(key, x) {
  cnKeep();
  var r = cnPath(key, true), a = r.o[r.k] = r.o[r.k] || [], k = a.indexOf(x);
  if (k >= 0) a.splice(k, 1); else a.push(x);
  var y = window.scrollY; render(); window.scrollTo(0, y);
}
function cnV(id) { var el = $(id); return el ? el.value.trim() : (S.cpub.f[id] || ''); }
/** 重畫前把畫面上所有輸入框的值收回 S.cpub.f（id 以 ca／pm／cr 開頭的）。 */
function cnKeep() {
  var f = S.cpub && S.cpub.f; if (!f) return;
  [].forEach.call(document.querySelectorAll('#app input.field, #app textarea.field'), function (el) { if (el.id && !el.dataset.wk) f[el.id] = el.value; });
}
function cnRedraw() { cnKeep(); var y = window.scrollY; render(); window.scrollTo(0, y); }
function cnStCard(st, title, msg) { return '<div class="box ' + st + '"><div class="r">' + ic(st === 'ok' ? 'check' : 'warn', 22) + '<div class="bt">' + (title ? '<b>' + esc(title) + '</b>' : '') + '<div class="m">' + msg + '</div></div></div></div>'; }

// ── 公開頁入口 ──
PLAT_PAGES.consPub = function () {
  var P = S.cpub;
  if (P.kind === 'login') return cnLogin();
  if (P.kind === 'vhome') return cnVHome();
  if (P.kind === 'reg') return cnReg();
  if (P.kind === 'apply') return cnApply();
  if (P.kind === 'case') return cnCase();
  if (P.kind === 'hsign') return cnHSign();
  return cnSign();
};

// 承攬商登入：帳號＝統一編號、登入碼＝建檔時寄到 Email 的 6 碼（10/19 晚 Jason）；登入一次這支手機就記住。忘記 → 輸入統編，新的寄到建檔信箱
function cnLogin() {
  var P = S.cpub;
  setTitle('承攬商登入');
  cnHero('承攬商登入', '看貴公司全部施工案件與施工前必讀');
  if (P.demoLogin) { P.f.clTax = P.f.clTax || P.demoLogin.tax; P.f.clCode = P.f.clCode || P.demoLogin.code; }
  $('app').innerHTML = (P.demoLogin ? '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>示範模式</b><div class="m">帳號、登入碼是示範用的假資料，已經幫您填好，直接按「登入」。示範中不會送出任何資料。</div></div></div></div>' : '') + cnField('clTax', '帳號（統一編號）', P.f.clTax, { mode: 'numeric', max: 8, ph: '8 位數字' }) +
    cnField('clCode', '登入碼（6 位數字）', P.f.clCode, { mode: 'numeric', max: 6, ph: '建檔時寄到 Email 的 6 碼', hint: '不是員工的 4 碼啟用碼。登入一次後這支手機會記住。' }) + '<div id="clErr"></div>' +
    '<div class="sec">忘記登入碼、還沒有登入碼？</div><div class="card"><div class="muted">在上面輸入統一編號後按下面的按鈕，系統會把新的登入碼寄到貴公司<b>建檔時登記的信箱</b>（舊的作廢；這個畫面不會顯示任何資料）。</div>' +
    '<button class="btn line" id="clFind" onclick="cnFindGo()">' + ic('mail', 18, 2.4) + '寄新的登入碼到建檔信箱</button><div id="clFindMsg"></div></div>' +
    '<button class="btn ghost" onclick="S.cpub=null;S.page=\'login\';render()">' + ic('back', 18, 2.4) + '回員工登入</button>';
  bar('<button class="btn" id="clBtn" onclick="cnLoginGo()">' + ic('arrow', 22, 2.6) + '登入</button>');
}
function cnLoginGo() {
  var tax = cnV('clTax').replace(/\D/g, ''), code = cnV('clCode').replace(/\D/g, '');
  if (S.cpub.demoLogin) { S.cpub = { kind: 'vhome', demo: S.cpub.demoLogin.data, d: S.cpub.demoLogin.data.home, f: {} }; window.scrollTo(0, 0); return render(); }
  if (!/^\d{8}$/.test(tax)) return toast('統一編號是 8 位數字', 'err');
  if (!/^\d{6}$/.test(code)) return toast('登入碼是 6 位數字', 'err');
  cnBusy('clBtn', '登入中…');
  api('consPubVLogin', { tax: tax, code: code, ak: cnDev() }, { token: '-' }).then(function (d) { cnVs(d.vs); S.cpub = { kind: 'vhome', vs: d.vs, f: {} }; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('clErr').innerHTML = errBox('沒有登入', e.message); cnUnbusy('clBtn', '登入'); });
}
function cnFindGo() {
  var tax = cnV('clTax').replace(/\D/g, '');
  if (!/^\d{8}$/.test(tax)) return toast('請先在上面輸入 8 位數字的統一編號', 'err');
  cnBusy('clFind', '寄送中…');
  api('consPubFind', { tax: tax }, { token: '-' }).then(function (d) { $('clFindMsg').innerHTML = cnStCard('ok', '', esc(d.msg)); cnUnbusy('clFind', '寄新的登入碼到建檔信箱'); })
    .catch(function (e) { $('clFindMsg').innerHTML = errBox('沒有寄出', e.message); cnUnbusy('clFind', '寄新的登入碼到建檔信箱'); });
}

// 廠商建檔
function cnReg() {
  var P = S.cpub, f = P.f;
  setTitle('廠商建檔');
  if (!P.form) { $('app').innerHTML = loading('讀取中…'); cnPub('consPubForm').then(function (d) { P.form = d; render(); }).catch(cnFail); return; }
  cnHero('承攬商建檔', '員和承辦人員：' + P.form.handler);
  if (P.done) {
    var dn = P.done;
    if (dn.vs) cnVs(dn.vs);
    $('app').innerHTML = cnStCard('ok', dn.name + ' 建檔完成', dn.updated ? '已更新貴公司原本的建檔資料。' : '「承攬商安全衛生承諾書」已寄到您的 Email：請負責人簽名、蓋公司大小章，拍照或掃描後在下面上傳（也可以寄回正本）。') +
      (dn.code ? '<div class="card"><div class="kv"><span>帳號（統編）</span><b>' + esc(dn.tax) + '</b></div><div class="kv"><span>登入碼</span><b style="font-size:22px;letter-spacing:4px">' + esc(dn.code) + '</b></div>' +
        '<div class="muted sm">以後在員和環安衛系統登入頁按「承攬商登入」，就能看貴公司全部施工案件與施工前必讀。這支手機已經登入，不用再輸入。登入碼也寄到 Email 了。</div></div>' : '') +
      (dn.vs ? '<div class="sec">上傳用印後的承諾書<small>拍照或掃描都可以</small></div><div class="card">' + cnFilesBox('crCommit', { fileMax: 2 }) +
        (S.cpub.f.files && S.cpub.f.files.length ? '<button class="btn" id="crUp" onclick="cnCommitUp(\'crUp\')">' + ic('up', 18, 2.6) + '上傳承諾書</button>' : '') + '</div>' : '') +
      '<button class="btn" onclick="location.hash=' + jsq(dn.applyUrl.split('#')[1]) + ';location.reload()">' + ic('arrow', 20, 2.6) + '接著填施工申請</button>' +
      (dn.vs ? '<button class="btn ghost" onclick="S.cpub={kind:\'vhome\',vs:' + jsq(dn.vs) + ',f:{}};render()">' + ic('helmet', 18, 2.4) + '進入承攬商專區</button>' : '');
    bar(''); return;
  }
  $('app').innerHTML = '<div class="muted">第一次到員和施工的廠商填一次；資料有變更可以再填一次（同一統編會更新原資料）。</div>' +
    cnField('crTax', '統一編號', f.crTax, { mode: 'numeric', max: 8, ph: '8 位數字' }) + cnField('crName', '公司名稱（全名）', f.crName) +
    cnField('crOwner', '負責人', f.crOwner, { max: 20 }) + cnField('crContact', '主要聯絡人', f.crContact, { max: 20 }) +
    cnField('crPhone', '聯絡電話', f.crPhone, { type: 'tel', max: 30 }) + cnField('crEmail', 'Email（承諾書、通知寄到這裡，請再確認一次）', f.crEmail, { type: 'email', max: 80 }) +
    cnField('crAddr', '公司地址', f.crAddr, { max: 100 }) + '<label class="nl">承攬類別（可複選）</label>' + cnChips('types', P.form.types, f.types) + '<div id="crErr"></div>';
  bar('<button class="btn" id="crBtn" onclick="cnRegGo()">' + ic('check', 22, 3) + '送出建檔</button>');
}
function cnRegGo() {
  var b = { tax: cnV('crTax'), name: cnV('crName'), owner: cnV('crOwner'), contact: cnV('crContact'), phone: cnV('crPhone'), email: cnV('crEmail'), addr: cnV('crAddr'), types: S.cpub.f.types || [], vs: cnVs() };
  cnBusy('crBtn', '送出中…');
  cnPub('consPubReg', b).then(function (d) { S.cpub.done = d; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('crErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('crBtn', '再送一次'); });
}

// 施工申請（也用在補件：P.fix）
function cnApply() {
  var P = S.cpub, f = P.f;
  setTitle('入廠施工申請');
  if (!P.form) { $('app').innerHTML = loading('讀取中…'); cnPub('consPubForm').then(function (d) { P.form = d; render(); }).catch(cnFail); return; }
  cnHero('入廠施工申請', '員和承辦人員：' + P.form.handler);
  if (P.done) return cnApplyDone();
  if (!P.vendor) {                                                         // 第一步：統編
    $('app').innerHTML = '<div class="steps"><div class="cur"><i></i><span>1 統一編號</span></div><div><i></i><span>2 施工內容・人員・簽名</span></div></div>' +
      cnField('caTax', '貴公司統一編號', f.caTax, { mode: 'numeric', max: 8, ph: '8 位數字' }) + '<div id="caErr"></div>';
    bar('<button class="btn" id="caBtn" onclick="cnApplyPeek()">' + ic('arrow', 22, 2.6) + '下一步</button>');
    return;
  }
  $('app').innerHTML = '<div class="steps"><div class="done"><i></i><span>' + ic('check', 14, 3.2) + esc(P.vendor.name) + '</span></div><div class="cur"><i></i><span>2 施工內容・人員・簽名</span></div></div>' +
    (P.vendor.commit ? '' : '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>環安衛還沒確認貴公司的承攬商安全衛生承諾書</b><div class="m">可以先申請、施工人員可以先簽名；承諾書確認後才會進入審核。</div></div></div></div>' +
      '<label class="cnagree"><input type="checkbox" id="caCommitDecl"' + (f.commitDeclared ? ' checked' : '') + ' onchange="S.cpub.f.commitDeclared=this.checked"><span>本公司建檔時已提交承諾書（或已寄出用印正本）</span></label>' +
      '<div class="muted sm">還沒交的話，請把負責人簽名、蓋公司大小章的承諾書拍照或掃描，在這裡上傳：</div>' + cnFilesBoxK('commitFiles', 'caCommit', 2)) +
    cnCaseForm(P.form, f) + cnFilesBox('caFiles', P.form) + cnAgree() + cnSigBox('施工負責人請簽全名') + '<div id="caErr"></div>';
  bar('<button class="btn" id="caBtn" onclick="cnApplyGo()">' + ic('check', 22, 3) + '送出申請</button>');
  sigInit();
}
function cnApplyPeek() {
  var tax = cnV('caTax');
  if (!/^\d{8}$/.test(tax)) return toast('統一編號是 8 位數字', 'err');
  cnBusy('caBtn', '查詢中…');
  cnPub('consPubApply', { peek: true, tax: tax }).then(function (d) {
    if (d.ok) { S.cpub.vendor = { tax: tax, name: d.name, commit: d.commit }; window.scrollTo(0, 0); return render(); }
    cnUnbusy('caBtn', '下一步');
    $('caErr').innerHTML = d.why === 'taxInvalid' ? errBox('統一編號不正確', '請再確認一次（8 位數字）') :
      cnStCard('warn', '貴公司還沒建檔', '第一次到員和施工，請先完成廠商建檔（約 2 分鐘），再回來填施工申請。') +
      '<button class="btn" onclick="location.hash=' + jsq(S.cpub.form.regUrl.split('#')[1]) + ';location.reload()">' + ic('arrow', 20, 2.6) + '先去建檔</button>';
  }).catch(function (e) { cnUnbusy('caBtn', '下一步'); $('caErr').innerHTML = errBox('查不到', e.message); });
}
/** 施工內容表單（申請與補件共用）。f：S.cpub.f，o：選項 */
function cnCaseForm(o, f, fix) {
  var ws = f.workers = f.workers || (fix ? [] : [{ name: '', id4: '' }]);
  var spec = f.spec || [], pmT = fix ? [] : spec.filter(function (x) { return (o.permit || []).indexOf(x) >= 0; });
  var h = '<div class="sec">施工內容</div>' +
    cnField('caWork', '工程名稱', f.caWork) + cnField('caArea', '施工區域', f.caArea, { ph: '例：PU部一廠、BU粉體區' }) +
    '<div class="r2">' + cnField('caStart', '預計開工日', f.caStart, { type: 'date', max: 10, change: 'cnRedraw()' }) + cnField('caEnd', '預計完工日', f.caEnd, { type: 'date', max: 10, change: 'cnRedraw()' }) + '</div>' +
    '<label class="nl">特殊作業（有的才勾）</label>' + cnChips('spec', o.spec, spec) +
    (spec.indexOf('動火作業') >= 0 ? '<label class="nl req">動火方式</label>' + cnChips('hot', o.hot, f.hot) : '') +
    (pmT.length ? '<div class="cnno"><b>' + ic('warn', 16, 2.6) + ' 您勾了「' + esc(pmT.join('、')) + '」</b>這' + (pmT.length > 1 ? '幾' : '') + '項作業要另外申請作業許可。<b style="display:inline">請在下面一起填完</b>，送出申請時一併送出，不用再填其他表單。' +
      '有特殊作業請在開工前 ' + (o.lateDays || 3) + ' 天提出申請。</div>' + pmT.map(function (t) { return cnPmBlock(o, f, t); }).join('') : '') +
    (fix && spec.some(function (x) { return (o.permit || ['動火作業', '吊掛作業', '局限空間作業', '高架作業']).indexOf(x) >= 0; }) ? '<div class="muted sm">新加勾的特殊作業，送出修改後請在案件頁按「申請特殊作業許可」。</div>' : '') +
    '<label class="nl">施工期間可能產生的狀況</label>' + cnChips('situ', o.situ, f.situ) +
    '<label class="nl">施工環境可能的危害</label>' + cnChips('env', o.env, f.env) +
    '<div class="sec">' + (fix ? '新增施工人員' : '施工人員') + '<small>一列一人；沒有身分證的外籍人員填居留證末 4 碼</small></div>' +
    '<div class="cnw cnwh"><span>姓名</span><span>身分證末 4 碼</span><span></span></div>' +
    ws.map(function (w, k) {
      return '<div class="cnw"><input class="field" data-wk="1" maxlength="20" placeholder="姓名" value="' + esc(w.name) + '" oninput="S.cpub.f.workers[' + k + '].name=this.value">' +
        '<input class="field" data-wk="1" inputmode="numeric" maxlength="4" placeholder="末4碼" value="' + esc(w.id4) + '" oninput="S.cpub.f.workers[' + k + '].id4=this.value.replace(/\\D/g,\'\')">' +
        '<button type="button" class="rm" aria-label="刪除這一列" onclick="cnWk(' + k + ')">×</button></div>';
    }).join('') + '<button type="button" class="btn line" onclick="cnWk(-1)">' + ic('plus', 18, 2.6) + '新增一位施工人員</button>' +
    '<div class="muted sm">現場臨時多來的人，可以掃施工人員 QR 時選「名單上沒有我」自己補上。</div>' +
    '<div class="sec">施工負責人（現場監督）</div>' + cnField('caSup', '姓名', f.caSup, { max: 20 }) + cnField('caSupPhone', '手機', f.caSupPhone, { type: 'tel', max: 30 }) +
    cnField('caEmail', 'Email（進度通知、QR 寄到這裡）', f.caEmail, { type: 'email', max: 80, req: false, hint: '沒填就寄到建檔時的 Email' }) +
    '<label class="nl" for="caNote">備註</label><textarea class="field" id="caNote" maxlength="300" rows="2" oninput="S.cpub.f.caNote=this.value">' + esc(f.caNote || '') + '</textarea>';
  return h;
}
/** 一種特殊作業的許可填寫區（動火、吊掛限當天：勾作業日，每天各一張；局限空間、高架：一段期間）。 */
function cnPmBlock(o, f, t) {
  var pm = (f.pm = f.pm || {})[t] = (f.pm[t] || { from: '08:00', to: '17:00', chk: [] }), same = (o.pmSameDay || []).indexOf(t) >= 0, key = 'pm.' + t;
  var days = cnDays(f.caStart, f.caEnd), h = '<div class="cnpm"><h4>' + esc(t) + '許可</h4>';
  if (same) h += '<label class="nl req">作業日期（許可限當天，有作業的日子都勾，每天各一張）</label>' +
    (days.length ? cnChips(key + '.dates', days, pm.dates, days.map(function (d) { return md(d) + '（' + '日一二三四五六'.charAt(new Date(d + 'T00:00:00').getDay()) + '）'; })) : '<div class="muted sm">先填上面的開工日、完工日。</div>');
  else h += '<div class="r2">' + cnPmF(t, 'start', '作業開始日', pm.start || f.caStart, { type: 'date', max: 10 }) + cnPmF(t, 'end', '作業結束日', pm.end || f.caEnd, { type: 'date', max: 10 }) + '</div>';
  h += '<div class="r2">' + cnPmF(t, 'from', '起始時間', pm.from, { type: 'time', max: 5 }) + cnPmF(t, 'to', '結束時間', pm.to, { type: 'time', max: 5 }) + '</div>' +
    cnPmF(t, 'area', '作業區域（跟施工區域一樣可不填）', pm.area, { req: false, max: 40 }) + cnPmF(t, 'desc', '作業內容（跟工程名稱一樣可不填）', pm.desc, { req: false, max: 100 });
  if (t === '局限空間作業') h += '<div class="muted sm">氣體測定（O2、LEL、H2S、CO）要在作業當天、進入前量，量完在案件頁填；合格才放行。</div>' + cnPmF(t, 'lift', '關聯吊掛許可編號（需要吊掛才填）', pm.lift, { req: false, max: 20 });
  h += '<label class="nl req">注意事項（逐項確認做得到才勾）</label>' + (o.pmCheck[t] || []).map(function (x, i) {
    return '<label class="cnagree" style="margin:6px 0"><input type="checkbox"' + (pm.chk[i] ? ' checked' : '') + ' onchange="S.cpub.f.pm[' + jsq(t) + '].chk[' + i + ']=this.checked"><span>' + (i + 1) + '. ' + esc(x) + '</span></label>';
  }).join('') + '<button type="button" class="btn ghost sm" onclick="cnPmAll(' + jsq(t) + ')">全部都確認了</button></div>';
  return h;
}
function cnPmF(t, k, label, val, o) {
  o = o || {};
  return '<label class="nl' + (o.req === false ? '' : ' req') + '">' + esc(label) + '</label><input class="field" data-wk="1" ' + (o.type ? 'type="' + o.type + '" ' : '') + 'maxlength="' + (o.max || 60) + '" value="' + esc(val || '') + '" ' +
    'oninput="S.cpub.f.pm[' + jsq(t) + '][' + jsq(k) + ']=this.value">';
}
function cnPmAll(t) { var o = S.cpub.form || S.cpub.d; S.cpub.f.pm[t].chk = (o.pmCheck[t] || []).map(function () { return true; }); cnRedraw(); }
function cnDays(a, b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b || '') || b < a) return [];
  var out = [], d = new Date(a + 'T00:00:00'), e = new Date(b + 'T00:00:00');
  while (d <= e && out.length < 62) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function cnWk(k) {
  var ws = S.cpub.f.workers;
  cnKeep();
  if (k === -2) { var y0 = window.scrollY; render(); return window.scrollTo(0, y0); }
  if (k < 0) ws.push({ name: '', id4: '' }); else { ws.splice(k, 1); if (!ws.length && !S.cpub.fix) ws.push({ name: '', id4: '' }); }
  var y = window.scrollY; render(); window.scrollTo(0, y);
}
// 附件（施工計畫書、勞保證明、證照…）：選了先放手機記憶體，送出時一起上傳
function cnFilesBox(id, o) { return cnFilesBoxK('files', id, (o && o.fileMax) || 3); }
function cnFilesBoxK(key, id, max) {
  var fs = S.cpub.f[key] = S.cpub.f[key] || [];
  var o = { fileMax: max };
  return (key === 'files' ? '<div class="sec">附件<small>施工計畫書、證照等（選填，最多 ' + (o.fileMax || 3) + ' 個，每個 8MB 以內）</small></div>' : '') +
    (fs.length ? '<div class="card">' + fs.map(function (x, i) { return '<div class="cnfile"><span>' + esc(x.name) + '</span><button type="button" class="btn ghost sm" onclick="S.cpub.f[' + jsq(key) + '].splice(' + i + ',1);cnRedraw()">移除</button></div>'; }).join('') + '</div>' : '') +
    (fs.length < (o.fileMax || 3) ? '<label class="btn line" for="' + id + '">' + ic('plus', 18, 2.6) + '選擇檔案</label><input type="file" id="' + id + '" data-key="' + key + '" data-max="' + (o.fileMax || 3) + '" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style="display:none" onchange="cnFilesAdd(this)">' : '');
}
function cnFilesAdd(el) {
  var fs = S.cpub.f[el.dataset.key || 'files'], max = Number(el.dataset.max) || 3, list = [].slice.call(el.files || []);
  var left = list.slice(0, Math.max(0, max - fs.length));
  if (list.length > left.length) toast('附件最多 ' + max + ' 個', 'err');
  var n = left.length; if (!n) return;
  left.forEach(function (file) {
    if (file.size > 8 * 1048576) { toast(file.name + ' 超過 8MB', 'err', 4000); if (!--n) cnRedraw(); return; }
    var rd = new FileReader();
    rd.onload = function () { fs.push({ name: file.name, type: file.type, data: String(rd.result).split(',')[1] }); if (!--n) cnRedraw(); };
    rd.onerror = function () { toast('讀不到 ' + file.name, 'err'); if (!--n) cnRedraw(); };
    rd.readAsDataURL(file);
  });
}
function cnAgree() {
  return '<div class="cnno"><b>員和工業施工安全衛生規定（摘要）</b><ul><li>進廠換證登記、配戴識別證；廠區全面禁菸</li><li>依作業穿戴安全帽、安全鞋與防護具</li>' +
    '<li>動火、吊掛、局限空間、高架作業須申請許可，核准後才能作業</li><li>進場當天先參加工具箱會議；發生異常立即停工並通知員和承辦人員</li></ul></div>' +
    '<label class="cnagree"><input type="checkbox" id="caAgree"' + (S.cpub.f.agree ? ' checked' : '') + ' onchange="S.cpub.f.agree=this.checked"><span>我已閱讀，並會要求施工人員遵守員和工業施工安全衛生規定</span></label>';
}
function cnSigBox(t) {
  return '<div class="h2" style="margin-top:14px">' + esc(t) + '</div><div class="sigwrap"><canvas id="cv" class="sigbox" aria-label="簽名區"></canvas>' +
    '<div class="right"><button type="button" class="btn ghost sm" onclick="sigClear()">' + ic('refresh', 18) + '清除重簽</button></div></div>';
}
function cnCaseBody() {
  var f = S.cpub.f;
  return { work: cnV('caWork'), area: cnV('caArea'), start: cnV('caStart'), end: cnV('caEnd'), spec: f.spec || [], hot: f.hot || [], situ: f.situ || [], env: f.env || [],
           workers: (f.workers || []).map(function (w) { return { name: String(w.name || '').trim(), id4: String(w.id4 || '').trim() }; }),
           sup: cnV('caSup'), supPhone: cnV('caSupPhone'), email: cnV('caEmail'), note: cnV('caNote'), files: f.files || [] };
}
function cnApplyGo() {
  cnKeep();
  var b = cnCaseBody(), f = S.cpub.f, o = S.cpub.form;
  b.tax = S.cpub.vendor.tax; b.agree = !!($('caAgree') && $('caAgree').checked);
  b.commitDeclared = !!f.commitDeclared; b.commitFiles = f.commitFiles || [];
  if (!S.cpub.vendor.commit && !b.commitDeclared && !b.commitFiles.length) return toast('請勾「建檔時已提交承諾書」或上傳承諾書', 'err');
  b.permits = (f.spec || []).filter(function (t) { return (o.permit || []).indexOf(t) >= 0; }).map(function (t) {
    var p = (f.pm || {})[t] || {};
    return { type: t, dates: p.dates || [], start: p.start || b.start, end: p.end || b.end, from: p.from, to: p.to, area: p.area, desc: p.desc, lift: p.lift, checks: p.chk || [] };
  });
  for (var i = 0; i < b.permits.length; i++) {
    var p = b.permits[i];
    if ((o.pmSameDay || []).indexOf(p.type) >= 0 && !p.dates.length) return toast(p.type + '：請勾選作業日期', 'err');
    if ((o.pmCheck[p.type] || []).some(function (x, k) { return !p.checks[k]; })) return toast(p.type + '：注意事項還有沒勾的', 'err');
  }
  if (!b.agree) return toast('請勾選已閱讀施工安全衛生規定', 'err');
  if (!SIG.drawn) return toast('施工負責人請簽名', 'err');
  b.image = sigExport(); if (!b.image) return toast('簽名太小，請簽大一點', 'err');
  cnBusy('caBtn', b.files.length ? '上傳中…（有附件會久一點）' : '送出中…');
  cnPub('consPubApply', b).then(function (d) { S.cpub.done = d; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('caErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('caBtn', '再送一次'); });
}
/** 兩組 QR（① 施工人員各自用自己的手機掃 ② 員和承辦人員掃）：申請完成頁、案件頁共用。 */
function cnQrPair(d, wUrl, hUrl, showH) {
  return '<div class="cnqrbox"><h4>① 施工人員簽名</h4><div class="muted sm">每位施工人員用<b>自己的手機</b>掃、看完危害告知後親簽，不用圍著同一支手機。也可以按「傳給施工人員」丟到工班 LINE 群組。</div>' +
    '<div class="cnqr">' + meetQrSvg(wUrl, 220) + '</div><div class="btns r3"><button class="btn ghost" onclick="cnQrImg(' + jsq(wUrl) + ',' + jsq('施工人員簽名QR_' + d.id) + ')">' + ic('share', 18, 2.4) + '分享 QR 圖</button>' +
    '<button class="btn ghost" onclick="shareLink(' + jsq('員和工業施工人員簽名（' + d.id + '）') + ',' + jsq(wUrl) + ')">' + ic('share', 18, 2.4) + '傳連結</button>' +
    '<button class="btn ghost" onclick="copyText(' + jsq(wUrl) + ',' + jsq('已複製') + ')">' + ic('copy', 18, 2.2) + '複製</button></div></div>' +
    (showH ? '<div class="cnqrbox"><h4>② 員和承辦人員簽名</h4><div class="muted sm">請員和承辦人員 <b>' + esc(d.handler || '') + '</b> 掃描簽名（不用安裝 App），簽名時可以一併提交審核。' +
      '施工人員都簽好後，系統也會通知承辦人員。</div><div class="cnqr">' + meetQrSvg(hUrl, 220) + '</div>' +
      '<div class="btns r3"><button class="btn ghost" onclick="cnQrImg(' + jsq(hUrl) + ',' + jsq('承辦人員簽名QR_' + d.id) + ')">' + ic('share', 18, 2.4) + '分享 QR 圖</button>' +
      '<button class="btn ghost" onclick="shareLink(' + jsq('員和工業施工申請・承辦人員簽名（' + d.id + '）') + ',' + jsq(hUrl) + ')">' + ic('share', 18, 2.4) + '傳連結</button>' +
      '<button class="btn ghost" onclick="copyText(' + jsq(hUrl) + ',' + jsq('已複製') + ')">' + ic('copy', 18, 2.2) + '複製</button></div></div>' : '');
}
/** QR 圖片（白底、下方寫用途）：手機能分享檔案就直接開分享（LINE 群組傳圖），不行就存到手機。 */
function cnQrImg(url, name) {
  if (!window.qrcode) return toast('QR 元件沒有載入', 'err');
  var q = qrcode(0, 'M'); q.addData(url); q.make();
  var n = q.getModuleCount(), cell = 10, pad = 40, w = n * cell + pad * 2, cv = document.createElement('canvas'), x = cv.getContext('2d');
  cv.width = w; cv.height = w + 70;
  x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#000';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(pad + c * cell, pad + r * cell, cell, cell);
  x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(name.replace(/_/g, '　'), w / 2, w + 40);
  cv.toBlob(function (blob) {
    var file = new File([blob], name + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: name, text: url }).catch(function () {});
    else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 3000); toast('QR 圖已存到手機，可以傳到 LINE', 'ok'); }
  }, 'image/png');
}
function cnApplyDone() {
  var d = S.cpub.done;
  $('app').innerHTML = cnStCard('ok', '申請已送出（' + d.id + '）', (d.status === '暫緩－文件不齊' ? '承諾書正本寄達後才會進入審核；施工人員可以先簽名。' : '接下來：施工人員掃 ① 簽名 → 承辦人員掃 ② 簽名 → 提交審核。') +
      (d.late ? '<br>注意：有特殊作業，開工日距今不到 3 天。' : '') + '<br>兩組 QR 與案件連結也已寄到您的 Email。') +
    '<div class="card"><div class="kv"><span>案件編號</span><b>' + esc(d.id) + '</b></div>' +
    '<div class="muted sm">貴公司全部案件：員和環安衛系統登入頁按「承攬商登入」，帳號＝統一編號 ' + esc(d.tax) + '、登入碼＝建檔時寄到 Email 的 6 碼。</div></div>' +
    (d.permits && d.permits.length ? '<div class="sec">特殊作業許可（已一起送出）</div><div class="card">' + d.permits.map(function (x) {
      return '<div class="cnwk"><span>' + esc(x.type + '・' + x.start + (x.end !== x.start ? '～' + x.end.slice(5) : '')) + '</span>' + pill(CN_PM_PILL[x.status] || 'na', '', x.status) + '</div>'; }).join('') +
      (d.permits.some(function (x) { return x.status === '待測定'; }) ? '<div class="muted sm">局限空間：作業當天進入前，在案件頁填氣體測定值，合格才放行。</div>' : '') + '</div>' : '') +
    cnQrPair(d, d.workerUrl, d.handlerUrl, true) +
    '<div class="sec">案件連結<small>看進度、出 QR、提交審核、補件都用這個</small></div>' +
    '<div class="btns"><button class="btn" onclick="location.hash=' + jsq(d.caseUrl.split('#')[1]) + ';location.reload()">' + ic('arrow', 18, 2.4) + '打開案件頁</button>' +
    '<button class="btn ghost" onclick="shareLink(' + jsq('員和工業施工申請案件連結（' + d.id + '）') + ',' + jsq(d.caseUrl) + ')">' + ic('share', 18, 2.4) + '傳給自己</button></div>';
  bar('');
}

// 案件頁：自檢清單、兩組 QR、提交審核、補件、補附件、許可
function cnCase() {
  var P = S.cpub;
  setTitle('施工申請進度');
  if (!P.d || P.reload) {
    P.reload = false; if (!P.d) $('app').innerHTML = loading('讀取案件…');
    cnPub('consPubCase').then(function (d) { P.d = d; if (d.caseToken && !P.c) P.c = d.caseToken; render(); }).catch(cnFail); return;
  }
  var d = P.d;
  cnHero(d.vendor, d.id + '・' + d.work);
  if (P.fix) return cnFixForm();
  if (P.pm) return cnPmForm();
  var left = d.workers.filter(function (w) { return !w.signed; });
  var h = (P.vs || P.demo ? '<button class="btn ghost" onclick="S.cpub={kind:\'vhome\',vs:S.cpub.vs,demo:S.cpub.demo,d:S.cpub.demo?S.cpub.demo.home:null,f:{},tab:\'c\'};render()">' + ic('back', 18, 2.4) + '回我的案件</button>' : '') +
    '<div class="card"><div class="kv"><span>狀態</span><b>' + pill(CN_ST_PILL[d.status] || 'na', '', d.status) + '</b></div>' +
    (d.comment && (d.status === '補件退回' || d.status === '已駁回') ? '<div class="box bad"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>環安衛意見</b><div class="m">' + esc(d.comment).replace(/\n/g, '<br>') + '</div></div></div></div>' : '') +
    '<div class="kv"><span>工程</span><b>' + esc(d.work) + '</b></div><div class="kv"><span>區域</span><b>' + esc(d.area) + '</b></div>' +
    '<div class="kv"><span>期間</span><b>' + esc(d.start + ' ～ ' + d.end) + '</b></div><div class="kv"><span>特殊作業</span><b>' + esc(d.spec) + '</b></div>' +
    '<div class="kv"><span>員和承辦</span><b>' + esc(d.handler) + (d.handlerSigned ? '（已簽）' : '') + '</b></div></div>';
  if (d.status !== '已核准' && d.status !== '已駁回') h += '<div class="sec">還要做的事</div><div class="card">' + d.todo.map(function (t) {
    return '<div class="cntd"><i class="' + (t.done ? 'y' : 'n') + '">' + (t.done ? '✓' : '!') + '</i><span><b>' + esc(t.label) + '</b>' + (t.note ? '<small>' + esc(t.note) + '</small>' : '') + '</span></div>'; }).join('') + '</div>';
  if (d.canSubmit) h += '<button class="btn" id="cnSubBtn" onclick="cnPubSubmit()">' + ic('up', 20, 2.6) + '提交審核' + (left.length ? '（施工人員還有 ' + left.length + ' 位沒簽）' : '') + '</button>';
  if (d.status === '已核准') h += cnStCard('ok', '', '已核准，施工期間可進場。進場當天請先參加工具箱會議；入廠施工許可證等文件已寄到 Email。');
  h += '<div class="sec">施工人員簽名 ' + d.wSigned + '/' + d.workers.length + '<button class="btn ghost sm" onclick="S.cpub.reload=true;render()">' + ic('refresh', 16, 2.4) + '更新</button></div><div class="card">' +
    d.workers.map(function (w) {
      return '<div class="cnwk"><span>' + esc(w.name) + (w.extra ? ' <small class="muted">現場補充</small>' : '') + '</span><span>' + (w.signed ? pill('ok', 'check', '已簽 ' + w.at) : pill('warn', '', '未簽')) +
        (w.signed && d.canReset ? ' <button class="btn ghost sm" onclick="cnWkReset(' + w.seq + ',' + jsq(w.name) + ')" aria-label="刪除簽名重簽">✕</button>' : '') + '</span></div>';
    }).join('') + '</div>';
  if (d.canQr) h += '<div class="sec">掃碼簽名</div>' + cnQrPair(d, d.workerUrl, d.handlerUrl, !d.handlerSigned);
  if (d.canFix) h += '<button class="btn ' + (d.status === '補件退回' ? '' : 'line') + '" onclick="cnFixStart()">' + ic('pen', 18, 2.4) + (d.status === '補件退回' ? '補件後重新送出' : '修改申請內容、增減施工人員') + '</button>';
  if (d.pmTypes.length) {
    h += '<div class="sec">特殊作業許可<small>' + esc(d.pmTypes.join('、')) + '：核准才能作業</small></div>' + cnPmList(d.permits, false);
    if (d.canPermit) h += '<button class="btn line" onclick="cnPmStart()">' + ic('plus', 18, 2.6) + '再申請特殊作業許可（加作業日）</button>';
  }
  h += '<div class="sec">附件</div><div class="card">' + (d.files.length ? d.files.map(function (x) { return '<div class="cnfile"><span>' + esc(x.name) + '</span><small class="muted">' + esc(String(x.at || '').slice(5)) + '</small></div>'; }).join('') : '<div class="muted">沒有附件</div>') +
    (d.canAttach ? cnFilesBox('cnAtt', d.form) + (S.cpub.f.files && S.cpub.f.files.length ? '<button class="btn" id="cnAttBtn" onclick="cnAttachGo()">' + ic('up', 18, 2.6) + '上傳 ' + S.cpub.f.files.length + ' 個附件</button>' : '') : '') + '</div>';
  if (d.docs && d.docs.length) h += '<div class="sec">核准文件<small>入廠施工許可證等，施工期間請備查</small></div><div class="card">' + d.docs.map(function (x) {
    return '<div class="cnfile"><span>' + esc(x.name) + '</span><button class="btn ghost sm" onclick="cnDocGet(' + jsq(x.id) + ')">' + ic('down', 16, 2.4) + '下載</button></div>'; }).join('') + '</div>';
  var rk = cnRiskFor(d.spec + '、' + (d.env || ''));
  if (rk.length) h += '<div class="sec">本案相關的高風險作業<small>點開看主要危害與一定要做的防護</small></div>' + cnRiskList(rk);
  h += '<div class="sec">危害告知<small>施工人員簽名前會看到的內容</small></div>' + d.notice.map(function (s) { return '<div class="cnno"><b>' + esc(s.t) + '</b><ul>' + s.x.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  $('app').innerHTML = h + '<div id="cnErr"></div>';
  bar('');
  clearTimeout(cnCase.t);                                          // 施工人員在掃碼：每 30 秒自動更新簽名進度（比照舊系統）
  if (d.canQr) cnCase.t = setTimeout(function () { var Q = S.cpub; if (Q && Q.kind === 'case' && !Q.fix && !Q.pm && !(Q.f.files && Q.f.files.length) && !document.hidden) { Q.reload = true; var y = window.scrollY; render(); window.scrollTo(0, y); } }, 30000);
}
function cnPubSubmit() {
  var d = S.cpub.d, left = d.workers.filter(function (w) { return !w.signed; });
  if (!confirm(left.length ? '還有 ' + left.length + ' 位施工人員沒簽（' + left.map(function (w) { return w.name; }).join('、') + '）。\n先提交審核？（他們之後仍可補簽）' : '所有人都簽好了，提交審核？')) return;
  cnBusy('cnSubBtn', '提交中…');
  cnPub('consPubSubmit').then(function () { toast('已提交審核，環安衛審核後會寄 Email 通知', 'ok', 4500); S.cpub.reload = true; render(); })
    .catch(function (e) { $('cnErr').innerHTML = errBox('沒有提交', e.message); cnUnbusy('cnSubBtn', '提交審核'); });
}
function cnWkReset(seq, name) {
  if (!confirm('刪除「' + name + '」的簽名？刪除後他要重新掃碼簽名。')) return;
  cnPub('consPubWorkerReset', { seq: seq }).then(function () { toast('已刪除，請他重新掃碼簽名', 'ok'); S.cpub.reload = true; render(); }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
function cnAttachGo() {
  cnBusy('cnAttBtn', '上傳中…');
  cnPub('consPubAttach', { files: S.cpub.f.files }).then(function (r) { S.cpub.f.files = []; toast('已上傳 ' + r.files + ' 個附件', 'ok'); S.cpub.reload = true; render(); })
    .catch(function (e) { $('cnErr').innerHTML = errBox('沒有上傳', e.message); cnUnbusy('cnAttBtn', '再試一次'); });
}
function cnFixStart() {
  var d = S.cpub.d;
  S.cpub.f = { caWork: d.work, caArea: d.area, caStart: d.start, caEnd: d.end, spec: d.specRaw.slice(), hot: d.hotRaw.slice(), situ: d.situRaw.slice(), env: d.envRaw.slice(),
               caSup: d.sup, caSupPhone: d.supPhone, caEmail: d.email, caNote: d.note, workers: [], files: [] };
  S.cpub.fix = true; S.cpub.form = Object.assign({ lateDays: 3 }, d.form); S.cpub.keep = d.workers.map(function (w) { return w.seq; });
  window.scrollTo(0, 0); render();
}
function cnFixForm() {
  var P = S.cpub, f = P.f;
  var kept = P.d.workers.filter(function (w) { return P.keep.indexOf(w.seq) >= 0; });
  $('app').innerHTML = '<div class="muted">改完按「送出修改」。改了期間、區域或特殊作業，員和承辦人員要重新簽名。</div>' +
    '<div class="sec">已登記的施工人員<small>按 × 移除；已簽名的保留簽名</small></div><div class="card">' +
    (kept.length ? kept.map(function (w) { return '<div class="cnwk"><span>' + esc(w.name) + (w.signed ? '（已簽）' : '') + '</span><button type="button" class="rm btn ghost sm" onclick="cnKeepRm(' + w.seq + ')">×</button></div>'; }).join('') : '<div class="muted">（都移除了）</div>') + '</div>' +
    cnCaseForm(P.form, f, true) + cnFilesBox('caFiles', P.form) + cnSigBox('換了施工負責人才需要簽名（沒換可以不簽）') + '<div id="caErr"></div>';
  bar('<button class="btn ghost" onclick="S.cpub.fix=false;render()">取消</button><button class="btn" id="caBtn" onclick="cnFixGo()">' + ic('check', 22, 3) + '送出修改</button>');
  sigInit();
}
function cnKeepRm(seq) { var k = S.cpub.keep.indexOf(seq); if (k >= 0) S.cpub.keep.splice(k, 1); cnWk(-2); }
function cnFixGo() {
  cnKeep();
  var b = cnCaseBody(); b.keep = S.cpub.keep;
  if (SIG.drawn) { b.image = sigExport(); if (!b.image) return toast('簽名太小，請簽大一點', 'err'); }
  cnBusy('caBtn', '送出中…');
  cnPub('consPubFix', b).then(function (r) {
    S.cpub.fix = false; S.cpub.f = {}; S.cpub.reload = true; window.scrollTo(0, 0); render();
    toast((r.handlerReSign ? '已送出；內容有改，員和承辦人員會重新簽名' : '已送出修改') + (r.needPermit && r.needPermit.length ? '。請申請「' + r.needPermit.join('、') + '」許可' : ''), 'ok', 5000);
  }).catch(function (e) { $('caErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('caBtn', '再送一次'); });
}

// 施工人員：選名字（或名單上沒有我）→ 末4碼 → 看危害告知 → 親簽。訊號差：簽名先存在這支手機，恢復訊號自動補送（舊系統 10/06 斷線保留）
function cnWkKey() { return 'cons_wk:' + S.cpub.w.slice(0, 16); }
function cnWkGet() { try { var o = JSON.parse(localStorage.getItem(cnWkKey()) || 'null'); return o && Date.now() - o.t < 7 * 864e5 ? o : null; } catch (e) { return null; } }
function cnWkPut(o) { try { if (o) { o.t = Date.now(); localStorage.setItem(cnWkKey(), JSON.stringify(o)); } else localStorage.removeItem(cnWkKey()); return true; } catch (e) { return false; } }
function cnSign() {
  var P = S.cpub;
  setTitle('施工人員簽名');
  if (!P.d || P.reload) { P.reload = false; $('app').innerHTML = loading('讀取中…'); cnPub('consPubWorkerOpen').then(function (d) { P.d = d; render(); }).catch(cnFail); return; }
  var d = P.d;
  cnHero(d.vendor, d.work + '・' + d.area);
  if (P.done) {
    $('app').innerHTML = cnStCard('ok', P.done + '，簽名完成', '謝謝您。施工時請遵守安全規定；有任何異常立即停工並通知員和承辦人員。') +
      '<button class="btn ghost" onclick="S.cpub={kind:\'sign\',w:S.cpub.w,f:{}};render()">換下一位施工人員簽</button>';
    bar(''); return;
  }
  var pend = cnWkGet();
  if (pend && !P.seq && !P.other) {
    $('app').innerHTML = cnStCard('warn', '這支手機有一份還沒送出的簽名', esc(pend.nm) + '（' + new Date(pend.t).toLocaleString() + '）') +
      '<button class="btn" id="csBtn" onclick="cnWkResend()">' + ic('up', 20, 2.6) + '送出這份簽名</button><button class="btn ghost" onclick="cnWkPut(null);render()">不是我，清除</button><div id="csErr"></div>';
    bar(''); return;
  }
  if (!P.seq && !P.other) {
    var left = d.workers.filter(function (w) { return !w.signed; });
    $('app').innerHTML = '<div class="steps"><div class="cur"><i></i><span>1 選您的名字</span></div><div><i></i><span>2 危害告知・簽名</span></div></div>' +
      (left.length ? '<div class="list">' + left.map(function (w) { return '<button class="li" onclick="S.cpub.seq=' + w.seq + ';S.cpub.nm=' + jsq(w.name) + ';render()"><span class="mn"><span class="nm">' + esc(w.name) + '</span></span>' + ic('chev', 18, 2.6) + '</button>'; }).join('') + '</div>'
        : '<div class="empty">名單上的施工人員都簽好了</div>') +
      '<button class="btn line" onclick="S.cpub.other=true;S.cpub.nm=\'\';render()">' + ic('plus', 18, 2.6) + '名單上沒有我（現場臨時人員）</button>';
    bar(''); return;
  }
  var notice = '<div class="cnno"><b>本次施工</b><ul><li>期間：' + esc(d.start + ' ～ ' + d.end) + '</li><li>特殊作業：' + esc(d.spec) + '</li>' +
    (d.env ? '<li>環境危害：' + esc(d.env) + '</li>' : '') + (d.situ ? '<li>可能狀況：' + esc(d.situ) + '</li>' : '') + '</ul></div>' +
    d.notice.map(function (s) { return '<div class="cnno"><b>' + esc(s.t) + '</b><ul>' + s.x.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  $('app').innerHTML = '<div class="steps"><div class="done"><i></i><span>' + ic('check', 14, 3.2) + esc(P.other ? '現場補充' : P.nm) + '</span></div><div class="cur"><i></i><span>2 危害告知・簽名</span></div></div>' +
    (P.other ? cnField('csName', '您的姓名', P.f.csName, { max: 20, hint: '名單上有您的名字請按「不是我」回上一步從名單選' }) : '') +
    '<div class="sec">危害告知<small>請看完再簽名</small></div>' + notice +
    '<label class="cnagree"><input type="checkbox" id="csRead"' + (P.f.read ? ' checked' : '') + ' onchange="S.cpub.f.read=this.checked"><span>我已了解上述危害與規定，會遵守</span></label>' +
    cnField('csId4', '身分證（居留證）末 4 碼', P.f.csId4, { mode: 'numeric', max: 4, hint: '確認是您本人；不會顯示在任何畫面' }) +
    cnSigBox((P.other ? '' : P.nm + '，') + '請用手指簽全名') + '<div id="csErr"></div>';
  bar('<button class="btn ghost" onclick="S.cpub.seq=0;S.cpub.other=false;render()">不是我</button><button class="btn" id="csBtn" onclick="cnSignGo()">' + ic('check', 22, 3) + '簽名送出</button>');
  sigInit();
}
function cnSignGo() {
  var P = S.cpub, id4 = cnV('csId4'), name = P.other ? cnV('csName') : '';
  if (P.other && name.length < 2) return toast('請填您的姓名', 'err');
  if (!($('csRead') && $('csRead').checked)) return toast('請先看完危害告知並勾選', 'err');
  if (!/^\d{4}$/.test(id4)) return toast('請填末 4 碼', 'err');
  if (!SIG.drawn) return toast('請先簽名', 'err');
  var img = sigExport(); if (!img) return toast('簽名太小，請簽大一點', 'err');
  var body = { seq: P.other ? 0 : P.seq, name: name, id4: id4, image: img, read: true, akey: cnDev() };
  cnWkPut({ body: body, nm: P.other ? name : P.nm });                 // 先存進手機再送：送到一半斷線也找得回來
  cnWkSend(body, P.other ? name : P.nm);
}
function cnWkSend(body, nm) {
  cnBusy('csBtn', '送出中…');
  cnPub('consPubWorkerSign', body).then(function (r) { cnWkPut(null); window.removeEventListener('online', cnWkResend); S.cpub.done = r.name || nm; window.scrollTo(0, 0); render(); })
    .catch(function (e) {
      if (e.biz) { cnWkPut(null); $('csErr').innerHTML = errBox('沒有送出', e.message); return cnUnbusy('csBtn', '再送一次'); }
      $('csErr').innerHTML = cnStCard('warn', '目前沒有網路訊號，簽名還沒送出', '您的簽名已保存在這支手機，恢復訊號後會自動送出，請盡量不要關閉這個畫面。關掉了也沒關係：有訊號時再掃一次同一個 QR，按「送出這份簽名」，不用重簽。');
      cnUnbusy('csBtn', '立即重新送出'); $('csBtn').onclick = cnWkResend;
      window.removeEventListener('online', cnWkResend); window.addEventListener('online', cnWkResend);
    });
}
function cnWkResend() { var p = cnWkGet(); if (!p) return render(); cnWkSend(p.body, p.nm); }

// 員和承辦人員：掃 QR 簽名（不用 App）。姓名預設本案承辦人，不是的話選「我才是承辦人」輸入自己的名字（要跟公司員工名單一樣）
function cnHSign() {
  var P = S.cpub;
  setTitle('承辦人員簽名');
  if (!P.d || P.reload) { P.reload = false; $('app').innerHTML = loading('讀取中…'); cnPub('consPubHandlerOpen').then(function (d) { P.d = d; render(); }).catch(cnFail); return; }
  var d = P.d;
  cnHero('員和承辦人員簽名', d.id + '・' + d.vendor);
  var left = d.workers.filter(function (w) { return !w.signed; });
  var h = '<div class="card"><div class="kv"><span>狀態</span><b>' + pill(CN_ST_PILL[d.status] || 'na', '', d.status) + '</b></div><div class="kv"><span>工程</span><b>' + esc(d.work) + '</b></div>' +
    '<div class="kv"><span>區域</span><b>' + esc(d.area) + '</b></div><div class="kv"><span>期間</span><b>' + esc(d.start + ' ～ ' + d.end) + '</b></div>' +
    '<div class="kv"><span>特殊作業</span><b>' + esc(d.spec) + '</b></div><div class="kv"><span>施工負責人</span><b>' + esc(d.sup) + (d.supSigned ? '（已簽）' : '') + '</b></div></div>' +
    '<div class="sec">施工人員簽名 ' + d.wSigned + '/' + d.workers.length + '</div><div class="card">' +
    d.workers.map(function (w) { return '<div class="cnwk"><span>' + esc(w.name) + '</span>' + (w.signed ? pill('ok', 'check', '已簽') : pill('warn', '', '未簽')) + '</div>'; }).join('') + '</div>' +
    (d.permits.length ? '<div class="sec">特殊作業許可</div>' + cnPmList(d.permits, false) : '');
  if (d.handlerSigned) {
    h = cnStCard('ok', '承辦人員已簽名（' + d.handlerSignedBy + '）', d.status === '待審核' ? '已提交，環安衛審核中。這個畫面可以關閉。' : d.canSubmit ? '可以提交審核了。' : '') + h;
    $('app').innerHTML = h + '<div id="hsErr"></div>';
    bar(d.canSubmit ? '<button class="btn" id="hsBtn" onclick="cnHSubmit()">' + ic('up', 20, 2.6) + '提交審核</button>' : '');
    return;
  }
  if (!d.canSign) {
    $('app').innerHTML = cnStCard('warn', '', d.status === '暫緩－文件不齊' ? '本案因承攬商安全衛生承諾書正本未收到暫緩中，環安衛收到後才能簽。' : '本案目前「' + esc(d.status) + '」，不能簽名。') + h;
    bar(''); return;
  }
  var nm = P.f.hsOther ? '' : d.handler;
  h += '<div class="sec">簽名</div><div class="list">' +
    '<button class="li' + (!P.f.hsOther ? ' sel' : '') + '" onclick="S.cpub.f.hsOther=false;cnRedraw()"><span class="radio"></span><span class="mn"><span class="nm">' + esc(d.handler) + '</span><span class="mt">施工申請登記的承辦人</span></span></button>' +
    '<button class="li' + (P.f.hsOther ? ' sel' : '') + '" onclick="S.cpub.f.hsOther=true;cnRedraw()"><span class="radio"></span><span class="mn"><span class="nm">我才是承辦人</span><span class="mt">輸入自己的名字（跟公司員工名單一樣）</span></span></button></div>' +
    (P.f.hsOther ? cnField('hsName', '您的姓名', P.f.hsName, { max: 10 }) : '') +
    (left.length ? '<div class="muted sm">施工人員還有 ' + left.length + ' 位沒簽，可以先提交（他們之後仍可補簽），也可以只簽名、等他們簽完再提交。</div>' : '') +
    cnSigBox('請用手指簽全名') + '<div id="hsErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn ghost" id="hsBtn2" onclick="cnHSignGo(false)">只簽名</button><button class="btn" id="hsBtn" onclick="cnHSignGo(true)">' + ic('check', 22, 3) + '簽名並提交審核</button>');
  sigInit();
}
function cnHSignGo(submit) {
  var P = S.cpub, name = P.f.hsOther ? cnV('hsName') : P.d.handler;
  if (!name) return toast('請輸入您的姓名', 'err');
  if (!SIG.drawn) return toast('請先簽名', 'err');
  var img = sigExport(); if (!img) return toast('簽名太小，請簽大一點', 'err');
  cnBusy(submit ? 'hsBtn' : 'hsBtn2', '送出中…');
  cnPub('consPubHandlerSign', { name: name, image: img, submit: submit }).then(function (r) { toast(r.status === '待審核' ? '已簽名並提交審核' : '已簽名', 'ok', 4000); P.reload = true; render(); })
    .catch(function (e) { $('hsErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('hsBtn', '簽名並提交審核'); cnUnbusy('hsBtn2', '只簽名'); });
}
function cnHSubmit() {
  cnBusy('hsBtn', '提交中…');
  cnPub('consPubHandlerSign', { submitOnly: true }).then(function () { toast('已提交審核', 'ok'); S.cpub.reload = true; render(); })
    .catch(function (e) { $('hsErr').innerHTML = errBox('沒有提交', e.message); cnUnbusy('hsBtn', '提交審核'); });
}

// ── 員工端（新系統開啟時取代舊的施工申請頁）──
var cnOldPage = PLAT_PAGES.cons;
PLAT_PAGES.cons = function () {
  if (!(plat() && plat().consNew)) return cnOldPage();
  setTitle('施工申請');
  var h = '<button class="card fcard tbm" onclick="S.mh=null;go(\'meet\')"><div class="fh">' + ic('helmet', 22, 2.2) + '<b>工具箱會議</b></div>' +
    '<div class="muted">施工當天開工前在現場開：施工人員掃 QR 簽名、看完簡報，完成後自動產生紀錄。</div></button>' +
    '<div class="sec">傳給廠商<small>連結 30 天內有效；案件會掛在您名下</small></div>' +
    '<div class="card fcard"><div class="fh"><b>施工申請連結</b></div><div class="muted">廠商填統編 → 施工內容（有特殊作業就一起填許可）→ 施工人員（按「＋」逐人新增）→ 施工負責人簽名。沒建檔的會先導去建檔。' +
    '送出後廠商的 Email 會收到兩組 QR：施工人員各自掃碼簽名、您（承辦人員）掃碼簽名。</div>' +
    '<div class="btns r3"><button class="btn" onclick="cnInvite(\'apply\',\'share\')">' + ic('share', 18, 2.4) + '傳給廠商</button>' +
    '<button class="btn ghost" onclick="cnInvite(\'apply\',\'copy\')">' + ic('copy', 18, 2.2) + '複製連結</button><button class="btn ghost" onclick="cnInvite(\'apply\',\'open\')">' + ic('ext', 18, 2.2) + '打開看看</button></div></div>';
  if (isEhs() || (S.me && (S.me.depts || []).some(function (d) { return /^示範/.test(d.id || d); }))) h += '<button class="card fcard" onclick="cnDemoStart()"><div class="fh">' + ic('helmet', 22, 2.2) + '<b>承攬商端示範（給勞檢看）</b></div>' +
    '<div class="muted">示範廠商登入後看到的畫面：施工案件、施工前必讀、承諾書。帳號密碼是假的、已填好，不會寫入任何資料。</div></button>';
  if (isEhs()) h += '<div class="seg2 cstab"><button class="' + (S.cnTab !== 'v' ? 'on' : '') + '" onclick="S.cnTab=\'c\';render()">案件</button><button class="' + (S.cnTab === 'v' ? 'on' : '') + '" onclick="S.cnTab=\'v\';render()">廠商・承諾書</button></div>';
  h += '<div id="cnList">' + loading('讀取中…') + '</div>';
  $('app').innerHTML = h;
  if (S.cnTab === 'v' && isEhs()) return cnVendors();
  apiR('consHome', {}).then(function (d) { S.cnHome = d; var el = $('cnList'); if (el && S.page === 'cons') el.innerHTML = cnListHtml(d); })
    .catch(function (e) { var el = $('cnList'); if (el) el.innerHTML = errBox('讀不到案件', e.message); });
};
var CN_MSG = { apply: '員和工業入廠施工申請（請在施工前 3 天填寫；第一次合作會先請您建檔）', reg: '員和工業承攬商建檔' };
function cnInvite(kind, how) {
  toast('產生連結中…', '', 1500);
  api('consInvite', { kind: kind }).then(function (r) {
    if (how === 'share') shareLink(CN_MSG[kind], r.url); else if (how === 'copy') copyText(r.url, '連結已複製（30 天內有效）'); else openUrl(r.url);
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
function cnListHtml(d) {
  if (!d.list.length) return '<div class="empty">' + (d.ehs ? '目前沒有案件' : '目前沒有您承辦的案件') + '</div>';
  var on = d.list.filter(function (x) { return ['已核准', '已駁回', '已結案'].indexOf(x.status) < 0 || (x.status === '已核准' && x.end >= d.today); });
  var off = d.list.filter(function (x) { return on.indexOf(x) < 0; });
  var tab = S.cnSub === 'off' ? off : on;
  var todo = tab.filter(function (x) { return x.todo && !/^等/.test(x.todo); });
  tab = todo.concat(tab.filter(function (x) { return todo.indexOf(x) < 0; }));
  return '<div class="seg2 cstab"><button class="' + (S.cnSub !== 'off' ? 'on' : '') + '" onclick="S.cnSub=\'on\';$(\'cnList\').innerHTML=cnListHtml(S.cnHome)">進行中 ' + on.length + '</button>' +
    '<button class="' + (S.cnSub === 'off' ? 'on' : '') + '" onclick="S.cnSub=\'off\';$(\'cnList\').innerHTML=cnListHtml(S.cnHome)">已完成 ' + off.length + '</button></div>' +
    (tab.length ? '<div class="list">' + tab.map(function (x) {
      var st = x.status === '已核准' ? (x.start > d.today ? '已核准・待進場' : x.end < d.today ? '已完工' : '施工中') : x.status;
      return '<button class="li cs" onclick="go(\'consCase\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="mt">' + esc(x.id + (x.mine ? '' : '・承辦 ' + x.handler)) + '</span><span class="nm">' + esc(x.vendor) + '</span>' +
        '<span class="mt">' + esc(x.work + '・' + x.area) + '</span><span class="mt">' + esc(md(x.start) + (x.end !== x.start ? '～' + md(x.end) : '')) + '</span>' +
        (x.todo ? '<span class="mt" style="color:' + (/^等/.test(x.todo) ? 'var(--sub)' : 'var(--orange)') + ';font-weight:700">' + esc(x.todo) + '</span>' : '') +
        '</span><span class="csr">' + pill(CN_ST_PILL[x.status] || 'na', '', st) + ic('chev', 18, 2.6) + '</span></button>';
    }).join('') + '</div>' : '<div class="empty">沒有案件</div>');
}
PLAT_PAGES.consCase = function () {
  setTitle('施工案件');
  var id = S.arg.id;
  $('app').innerHTML = loading('讀取案件…');
  api('consDetail', { id: id }).then(function (d) { S.cnD = d; if (S.page === 'consCase') cnCaseStaff(d); }).catch(function (e) { $('app').innerHTML = errBox('讀不到案件', e.message); });
};
function cnCaseStaff(d) {
  var v = d.vendorInfo, tel = String(v.phone || '').replace(/[^\d+#]/g, ''), stel = String(d.supPhone || '').replace(/[^\d+#]/g, '');
  var row = function (k, x) { return x ? '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(x) + '</b></div>' : ''; };
  var h = '<div class="card">' + row('案件', d.id) + '<div class="kv"><span>狀態</span><b>' + pill(CN_ST_PILL[d.status] || 'na', '', d.status) + '</b></div>' + row('廠商', d.vendor) +
    row('工程', d.work) + row('區域', d.area) + row('期間', d.start + ' ～ ' + d.end) + row('特殊作業', d.spec + (d.hot ? '（' + d.hot + '）' : '')) +
    row('可能狀況', d.situ) + row('環境危害', d.env) + row('承辦', d.handler) + row('提交', d.submitted ? d.submitted.slice(5) + '　' + d.submittedBy : '') + row('備註', d.note) +
    (d.late ? cnStCard('warn', '', esc(d.late)) : '') + '</div>';
  if (d.gaps && d.gaps.length && ['待審核', '施工人員簽名中', '暫緩－文件不齊'].indexOf(d.status) >= 0) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>' + (d.status === '待審核' ? '審核前請注意' : '還缺') + '</b><div class="m">' +
    d.gaps.map(esc).join('<br>') + '</div></div></div></div>';
  h += '<div class="sec">聯絡</div><div class="card">' + row('施工負責人', d.sup + (d.supSigned ? '（已簽）' : '')) +
    (stel ? '<a class="btn ghost" href="tel:' + esc(stel) + '">' + ic('chat', 18, 2.4) + '打給施工負責人 ' + esc(d.supPhone) + '</a>' : '') +
    row('廠商聯絡人', v.contact) + (tel ? '<a class="btn ghost" href="tel:' + esc(tel) + '">' + ic('chat', 18, 2.4) + '打給廠商 ' + esc(v.phone) + '</a>' : '') +
    row('承諾書', v.commit ? '已收到用印正本' : '尚未收到正本') + '</div>' +
    '<div class="sec">施工人員簽名 ' + d.wSigned + '/' + d.workers.length + '</div><div class="card">' +
    d.workers.map(function (w) { return '<div class="cnwk"><span>' + esc(w.name) + (w.extra ? ' <small class="muted">現場補充</small>' : '') + '</span>' + (w.signed ? pill('ok', 'check', '已簽 ' + w.at) : pill('warn', '', '未簽')) + '</div>'; }).join('') + '</div>';
  if (d.sameDevice && d.sameDevice.length) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>同一支手機簽了好幾位</b><div class="m">' +
    d.sameDevice.map(function (a) { return esc(a.join('、')); }).join('<br>') + '<br>請確認是本人親簽（不是別人代簽）。</div></div></div></div>';
  if (d.files && d.files.length) h += '<div class="sec">附件</div><div class="card">' + d.files.map(function (x) {
    return '<div class="cnfile"><span>' + esc(x.name) + '<br><small class="muted">' + esc(String(x.at || '').slice(5) + '　' + (x.by || '')) + '</small></span><button class="btn ghost sm" onclick="cnFileGet(' + jsq(x.id) + ')">' + ic('down', 16, 2.4) + '開啟</button></div>'; }).join('') + '</div>';
  if (d.handlerUrl && !d.handlerSigned && d.status === '施工人員簽名中') h += '<div class="sec">承辦人員簽名連結<small>承辦人員沒有 App 時轉給他</small></div><div class="btns"><button class="btn ghost" onclick="shareLink(' +
    jsq('員和工業施工申請・承辦人員簽名（' + d.id + '）') + ',' + jsq(d.handlerUrl) + ')">' + ic('share', 18, 2.4) + '傳給承辦人員</button><button class="btn ghost" onclick="copyText(' + jsq(d.handlerUrl) + ',' + jsq('已複製') + ')">' + ic('copy', 18, 2.2) + '複製</button></div>';
  if (d.pmTypes && d.pmTypes.length) h += '<div class="sec">特殊作業許可<small>' + esc(d.pmTypes.join('、')) + '</small></div>' + cnPmList(d.permits, d.canPmReview);
  h += '<div class="sec">歷程</div><div class="card">' + d.history.map(function (x) { return '<div class="cnwk"><span><b>' + esc(x.act) + '</b>' + (x.note ? '・' + esc(x.note) : '') + '<br><small class="muted">' + esc(x.who) + '</small></span><small class="muted">' + esc(x.at.slice(5)) + '</small></div>'; }).join('') + '</div>';
  if (d.comment) h += '<div class="box info"><div class="r">' + ic('info', 20) + '<div class="bt"><b>審核意見</b><div class="m">' + esc(d.comment).replace(/\n/g, '<br>') + '</div></div></div></div>';
  $('app').innerHTML = h + '<div id="cnErr"></div>';
  var left = d.workers.length - d.wSigned;
  if (d.canSign) bar('<button class="btn" id="cnBtn" onclick="cnHandlerSign()">' + ic('pen', 20, 2.4) + '簽名並提交審核' + (left ? '（' + left + ' 位未簽）' : '') + '</button>');
  else if (d.canSubmit) bar('<button class="btn" id="cnBtn" onclick="cnSubmit()">' + ic('up', 20, 2.6) + '提交審核</button>');
  else if (d.canReview) bar('<button class="btn ghost" onclick="cnReview(\'return\')">退回補件</button><button class="btn ghost" onclick="cnReview(\'reject\')">駁回</button><button class="btn" id="cnBtn" onclick="cnReview(\'approve\')">' + ic('check', 20, 3) + '核准</button>');
  else bar('');
}
function cnFileGet(fid) { toast('下載中…', '', 1500); api('consFile', { id: S.cnD.id, fid: fid }).then(cnB64Save).catch(function (e) { toast(esc(e.message), 'err', 4000); }); }
function cnAfter(msg) { return function () { toast(msg, 'ok', 3500); rcClear(); render(); }; }
function cnErr(e) { var el = $('cnErr'); if (el) el.innerHTML = errBox('沒有完成', e.message); var b = $('cnBtn'); if (b) { b.disabled = false; b.className = 'btn'; b.textContent = '再試一次'; } }
function cnLeftOk() {
  var d = S.cnD, left = d.workers.filter(function (w) { return !w.signed; });
  return !left.length || confirm('還有 ' + left.length + ' 位施工人員沒簽（' + left.map(function (w) { return w.name; }).join('、') + '）。\n先提交審核？（他們之後仍可補簽）');
}
function cnHandlerSign() { if (!cnLeftOk()) return; cnBusy('cnBtn', '簽名中…'); api('consHandlerSign', { id: S.cnD.id, submit: true }).then(function (r) { cnAfter(r.status === '待審核' ? '已簽名並提交審核' : '已簽名')(); }).catch(cnErr); }
function cnSubmit() { if (!cnLeftOk()) return; cnBusy('cnBtn', '提交中…'); api('consSubmit', { id: S.cnD.id }).then(cnAfter('已提交審核')).catch(cnErr); }
function cnReview(dec) {
  var name = { approve: '核准', 'return': '退回補件', reject: '駁回' }[dec], d = S.cnD;
  if (dec === 'approve' && d.gaps && d.gaps.length && !confirm('還有：\n' + d.gaps.join('\n') + '\n\n仍要核准？（會記進歷程）')) return;
  var ask = dec === 'approve' ? '備註（選填，廠商會看到）' : name + '原因（廠商會看到；要補的東西用「；」分開會逐條列出）';
  var c = prompt(ask, ''); if (c === null) return;
  if (dec !== 'approve' && c.trim().length < 2) return toast('請寫原因', 'err');
  cnBusy('cnBtn', '送出中…');
  api('consReview', { id: d.id, decision: dec, comment: c.trim().replace(/[；;]\s*/g, '\n') }).then(function (r) {
    cnAfter('已' + name + (r.held && r.held.length ? '；' + r.held.length + ' 張許可還沒放行' : ''))();
  }).catch(cnErr);
}
function cnVendors() {
  api('consVendors', {}).then(function (d) {
    var el = $('cnList'); if (!el) return;
    el.innerHTML = d.list.length ? '<div class="list">' + d.list.map(function (v) {
      return '<div class="li cs"><span class="mn"><span class="mt">' + esc(v.id + '・統編 ' + v.tax) + '</span><span class="nm">' + esc(v.name) + '</span><span class="mt">' + esc((v.contact || '') + ' ' + (v.phone || '')) +
        '・案件 ' + v.cases + (v.hold ? '（暫緩 ' + v.hold + '）' : '') + '</span>' +
        (v.ups && v.ups.length ? '<span class="mt">廠商上傳的承諾書：' + v.ups.map(function (f) { return '<button class="btn ghost sm" onclick="cnCommitView(' + jsq(v.id) + ',' + jsq(f.id) + ')">' + ic('down', 14, 2.4) + esc(f.at.slice(5, 10) + ' ' + f.name) + '</button>'; }).join(' ') + '</span>' : '') +
        (v.commit ? '<span class="mt">' + pill('ok', 'check', '承諾書已收到 ' + (v.commitAt || '')) + ' <button class="btn ghost sm" onclick="cnCommit(' + jsq(v.id) + ',false)">實際未收到？</button></span>'
          : '<button class="btn sm" onclick="cnCommit(' + jsq(v.id) + ',true)">' + ic('check', 16, 3) + (v.ups && v.ups.length ? '看過上傳檔，確認收到承諾書' : '已收到承諾書用印正本') + '</button>') +
        '<span class="mt">登入碼' + (v.codeAt ? ' ' + esc(v.codeAt) + ' 發出' : '還沒發') + ' <button class="btn ghost sm" onclick="cnVCode(' + jsq(v.id) + ')">寄新的登入碼</button>' +
          ' <button class="btn ghost sm" onclick="cnVCodeShow(' + jsq(v.id) + ')">產生登入碼給我</button></span>' +
        '<span class="mt"><button class="btn sm" onclick="shareLink(' + jsq('員和工業承攬商專區（' + v.name + '）：帳號是貴公司統一編號 ' + v.tax + '，登入碼請看 Email 或洽員和環安衛') + ',' + jsq(v.loginUrl) + ')">' + ic('share', 16, 2.4) + '分享登入連結</button></span>' +
        (v.caseIds && v.caseIds.length ? '<span class="mt">' + v.caseIds.map(function (id) { return '<button class="btn ghost sm" onclick="go(\'consCase\',{id:' + jsq(id) + '})">' + esc(id) + '</button>'; }).join(' ') + '</span>' : '') + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">還沒有廠商建檔</div>';
  }).catch(function (e) { var el = $('cnList'); if (el) el.innerHTML = errBox('讀不到廠商', e.message); });
}
function cnCommitView(vid, fid) { toast('下載中…', '', 1500); api('consCommitFile', { vid: vid, fid: fid }).then(cnB64Save).catch(function (e) { toast(esc(e.message), 'err', 4000); }); }
/** 產生登入碼、只顯示給環安衛（不寄信），由環安衛自己交給廠商。 */
function cnVCodeShow(vid) {
  if (!confirm('產生一組新的登入碼（舊的作廢），只顯示在這裡、不寄信，由您自己交給廠商？')) return;
  api('consVendorCode', { vid: vid, show: true }).then(function (r) {
    var msg = ['員和工業承攬商專區（' + r.name + '）', '帳號（統一編號）：' + r.tax, '登入碼：' + r.code, '登入：' + r.url].join(String.fromCharCode(10));
    $('cnList').insertAdjacentHTML('afterbegin', '<div class="box ok"><div class="r">' + ic('check', 22) + '<div class="bt"><b>' + esc(r.name) + ' 的登入資料</b><div class="m">帳號（統編）：' + esc(r.tax) +
      '<br>登入碼：<b style="font-size:20px;letter-spacing:3px">' + esc(r.code) + '</b><br><button class="btn sm" style="margin-top:6px" onclick="shareLink(' + jsq('員和工業承攬商專區登入') + ',' + jsq(msg) + ')">' + ic('share', 16, 2.4) + '傳給廠商</button></div></div></div></div>');
    window.scrollTo(0, 0);
  }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
function cnVCode(vid) {
  if (!confirm('寄一組新的登入碼到這家廠商建檔的 Email？舊的會作廢。')) return;
  api('consVendorCode', { vid: vid }).then(function (r) { toast('已寄到 ' + r.to, 'ok', 4000); cnVendors(); }).catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
function cnCommit(vid, ok) {
  var why = '';
  if (!ok) { why = prompt('為什麼實際沒收到？（例：只有簽名沒有蓋章。該廠商進行中的案件會改為暫緩，並寄信請廠商補）', ''); if (why === null) return; if (why.trim().length < 2) return toast('請寫原因', 'err'); }
  else if (!confirm('確認已收到負責人簽名、公司大小章的承諾書正本？\n該廠商暫緩中的案件會自動恢復並通知廠商。')) return;
  api('consCommit', { vid: vid, ok: ok, comment: why.trim() }).then(function (r) { toast(ok ? '已登記' + (r.moved.length ? '，恢復 ' + r.moved.join('、') : '') : '已改為未收到' + (r.moved.length ? '，暫緩 ' + r.moved.join('、') : ''), 'ok', 4000); cnVendors(); })
    .catch(function (e) { toast(esc(e.message), 'err', 4000); });
}


// ── 特殊作業許可（加作業日的另外申請、局限空間氣體測定、環安衛審核）──
var CN_PM_PILL = { '待審核': 'warn', '已核准': 'ok', '安全警報': 'bad', '不核准': 'bad', '已取消': 'na', '待測定': 'warn', '已逾期': 'na' };
function cnPmList(list, staff) {
  if (!list.length) return '<div class="muted">還沒有申請</div>';
  return '<div class="card">' + list.map(function (x) {
    var t = x.start + (x.end !== x.start ? '～' + x.end.slice(5) : '') + ' ' + x.from + '～' + x.to;
    var act = staff && (x.status === '待審核' || x.status === '安全警報') ? '<div class="btns"><button class="btn ghost sm" onclick="cnPmReview(' + jsq(x.id) + ',\'reject\')">不核准</button>' +
      (x.status === '待審核' ? '<button class="btn sm" onclick="cnPmReview(' + jsq(x.id) + ',\'approve\')">' + ic('check', 16, 3) + '核准</button>' : '') + '</div>' : '';
    var gas = !staff && x.gasToday ? '<button class="btn sm" onclick="cnGasStart(' + jsq(x.id) + ')">' + ic('pen', 16, 2.4) + '填氣體測定值（進入前）</button>' : !staff && x.status === '待測定' ? '<div class="muted sm">作業當天進入前在這裡填氣體測定值</div>' : '';
    return '<div class="cnwk" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(x.type + '・' + x.id) + '</b>' + pill(CN_PM_PILL[x.status] || 'na', '', x.status) + '</div>' +
      '<div class="muted sm">' + esc(t + '・' + x.area + '・' + x.desc + (x.hot ? '（' + x.hot + '）' : '')) + '</div>' +
      (x.gas ? '<div class="muted sm">測定 O2 ' + esc(x.gas.o2) + '%、LEL ' + esc(x.gas.lel) + '%、H2S ' + esc(x.gas.h2s) + 'ppm、CO ' + esc(x.gas.co) + 'ppm（' + esc(x.gas.who) + '）</div>' : '') +
      (x.alert ? '<div class="box bad"><div class="r">' + ic('warn', 18) + '<div class="bt"><div class="m">超標：' + esc(x.alert) + '。不得進入，通風後重新測定再填一次。</div></div></div></div>' : '') +
      (!staff && x.status === '安全警報' ? '<button class="btn sm line" onclick="cnGasStart(' + jsq(x.id) + ')">重新測定後再填</button>' : '') +
      (x.comment ? '<div class="muted sm">意見：' + esc(x.comment) + '</div>' : '') + gas + act + '</div>';
  }).join('') + '</div>';
}
function cnGasStart(pid) {
  var d = S.cpub.d, s = d.pmSafe;
  var o2 = prompt('O2（%），標準 ≥ ' + s.O2_MIN, ''); if (o2 === null) return;
  var lel = prompt('LEL（%），標準 ≤ ' + s.LEL_MAX, ''); if (lel === null) return;
  var h2s = prompt('H2S（ppm），標準 ≤ ' + s.H2S_MAX, ''); if (h2s === null) return;
  var co = prompt('CO（ppm），標準 ≤ ' + s.CO_MAX, ''); if (co === null) return;
  var who = prompt('測定人員姓名', d.sup || ''); if (who === null) return;
  cnPub('consPubPermitGas', { pid: pid, o2: o2, lel: lel, h2s: h2s, co: co, gasWho: who }).then(function (r) {
    toast(r.alerts.length ? '超標：不得進入，通風後重新測定' : r.status === '已核准' ? '合格，已放行' : '合格，等環安衛核准', r.alerts.length ? 'err' : 'ok', 5000); S.cpub.reload = true; render();
  }).catch(function (e) { toast(esc(e.message), 'err', 5000); });
}
function cnPmStart() {
  var d = S.cpub.d;
  S.cpub.pm = true; S.cpub.f = { types: d.pmTypes.length === 1 ? d.pmTypes.slice() : [], pmSup: d.sup, pmArea: d.area, chk: {} };
  window.scrollTo(0, 0); render();
}
function cnPmTogChk(t, i) { var c = S.cpub.f.chk[t] = S.cpub.f.chk[t] || []; c[i] = !c[i]; cnPmKeep(); var y = window.scrollY; render(); window.scrollTo(0, y); }
function cnPmKeep() { ['pmStart', 'pmEnd', 'pmFrom', 'pmTo', 'pmArea', 'pmDesc', 'pmO2', 'pmLel', 'pmH2s', 'pmCo', 'pmWho', 'pmLift', 'pmSup'].forEach(function (id) { var el = $(id); if (el) S.cpub.f[id] = el.value; }); }
function cnPmForm() {
  var P = S.cpub, d = P.d, f = P.f, types = f.types || [];
  var same = types.some(function (t) { return d.pmSameDay.indexOf(t) >= 0; });
  var h = '<div class="muted">施工期間 ' + esc(d.start + '～' + d.end) + '。動火、吊掛許可限當天，隔天要重新申請。注意事項要逐項確認做到才能送出。</div>' +
    '<label class="nl req">作業類別</label>' + cnChips('types', d.pmTypes, types) +
    '<div class="r2">' + cnField('pmStart', '作業日期', f.pmStart, { type: 'date', max: 10 }) + (same ? '' : cnField('pmEnd', '結束日期（多日才填）', f.pmEnd, { type: 'date', max: 10, req: false })) + '</div>' +
    '<div class="r2">' + cnField('pmFrom', '起始時間', f.pmFrom || '08:00', { type: 'time', max: 5 }) + cnField('pmTo', '結束時間', f.pmTo || '17:00', { type: 'time', max: 5 }) + '</div>' +
    cnField('pmArea', '作業區域', f.pmArea) + cnField('pmDesc', '工程內容概述', f.pmDesc, { max: 100 }) +
    (types.indexOf('動火作業') >= 0 ? '<label class="nl req">動火方式</label>' + cnChips('hot', d.hotList, f.hot) : '');
  if (types.indexOf('局限空間作業') >= 0) h += '<div class="sec">作業環境測定<small>O2 ≥ ' + d.pmSafe.O2_MIN + '%、LEL ≤ ' + d.pmSafe.LEL_MAX + '%、H2S ≤ ' + d.pmSafe.H2S_MAX + 'ppm、CO ≤ ' + d.pmSafe.CO_MAX + 'ppm</small></div>' +
    '<div class="r2">' + cnField('pmO2', 'O2（%）', f.pmO2, { mode: 'decimal', max: 6 }) + cnField('pmLel', 'LEL（%）', f.pmLel, { mode: 'decimal', max: 6 }) + '</div>' +
    '<div class="r2">' + cnField('pmH2s', 'H2S（ppm）', f.pmH2s, { mode: 'decimal', max: 6 }) + cnField('pmCo', 'CO（ppm）', f.pmCo, { mode: 'decimal', max: 6 }) + '</div>' +
    cnField('pmWho', '測定人員', f.pmWho, { max: 20 }) + cnField('pmLift', '關聯吊掛許可編號（需要吊掛才填）', f.pmLift, { max: 20, req: false });
  types.forEach(function (t) {
    var c = f.chk[t] || [];
    h += '<div class="sec">' + esc(t) + '注意事項<small>逐項確認</small></div><div class="card">' + d.pmCheck[t].map(function (x, i) {
      return '<label class="cnagree" style="margin:6px 0"><input type="checkbox"' + (c[i] ? ' checked' : '') + ' onchange="cnPmTogChk(' + jsq(t) + ',' + i + ')"><span>' + (i + 1) + '. ' + esc(x) + '</span></label>';
    }).join('') + '</div>';
  });
  h += cnField('pmSup', '申請人（施工現場監督人員）', f.pmSup, { max: 20 }) + cnSigBox('申請人請簽全名') + '<div id="pmErr"></div>';
  $('app').innerHTML = h;
  bar('<button class="btn ghost" onclick="S.cpub.pm=false;S.cpub.f={};render()">取消</button><button class="btn" id="pmBtn" onclick="cnPmGo()">' + ic('check', 22, 3) + '送出申請</button>');
  sigInit();
}
function cnPmGo() {
  cnPmKeep();
  var f = S.cpub.f, b = { types: f.types || [], start: f.pmStart, end: f.pmEnd || f.pmStart, from: f.pmFrom, to: f.pmTo, area: f.pmArea, desc: f.pmDesc, hot: f.hot || [],
    o2: f.pmO2, lel: f.pmLel, h2s: f.pmH2s, co: f.pmCo, gasWho: f.pmWho, lift: f.pmLift, sup: f.pmSup, checks: f.chk };
  if (!b.types.length) return toast('請勾選作業類別', 'err');
  if (!SIG.drawn) return toast('請簽名', 'err');
  b.image = sigExport(); if (!b.image) return toast('簽名太小，請簽大一點', 'err');
  cnBusy('pmBtn', '送出中…');
  cnPub('consPubPermit', b).then(function (r) {
    S.cpub.pm = false; S.cpub.f = {}; S.cpub.reload = true; window.scrollTo(0, 0); render();
    toast(r.alerts.length ? '已送出：氣體測定超標，不得進入，請通風後重新測定' : r.permits.every(function (x) { return x.status === '已核准'; }) ? '已核准，可以依許可期間作業' : '已送出，等環安衛核准', r.alerts.length ? 'err' : 'ok', 5000);
  }).catch(function (e) { $('pmErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('pmBtn', '再送一次'); });
}
function cnPmReview(id, dec) {
  var c = '';
  if (dec !== 'approve') { c = prompt('不核准的原因（廠商會看到）', ''); if (c === null) return; if (c.trim().length < 2) return toast('請寫原因', 'err'); }
  else if (!confirm('核准這張許可單？')) return;
  api('consPermitReview', { id: id, decision: dec, comment: c.trim() }).then(function () { toast(dec === 'approve' ? '已核准' : '已不核准', 'ok'); rcClear(); render(); })
    .catch(function (e) { toast(esc(e.message), 'err', 5000); });
}


// ── 承攬商專區（登入後）：案件（進行中＋歷史）、施工前必讀、公司與承諾書 ──
function cnVHome() {
  var P = S.cpub;
  setTitle('承攬商專區');
  if (!P.d || P.reload) {
    P.reload = false; if (!P.d) $('app').innerHTML = loading('讀取中…');
    cnPub('consPubVHome').then(function (d) { P.d = d; render(); }).catch(function (e) { if (/重新登入|已失效/.test(e.message)) { S.cpub = { kind: 'login', f: {} }; return render(); } cnFail(e); }); return;
  }
  var d = P.d, tab = P.tab || 'c';
  cnHero(d.vendor.name, '承攬商專區・統編 ' + d.vendor.tax);
  var h = (P.demo ? '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><b>示範模式（資料是假的）</b><div class="m">這是廠商登入後看到的畫面。<button class="btn sm" style="margin-top:6px" onclick="S.cpub=null;go(\'cons\',{},true)">結束示範，回員工畫面</button></div></div></div></div>' : '') +
    '<div class="seg2 cstab" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + [['c', '施工案件'], ['r', '施工前必讀'], ['v', '公司・承諾書']].map(function (x) {
    return '<button class="' + (tab === x[0] ? 'on' : '') + '" onclick="S.cpub.tab=' + jsq(x[0]) + ';render()">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
  if (d.commit.st !== 'ok' && tab !== 'v') h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>承攬商安全衛生承諾書</b><div class="m">' + esc(d.commit.text) +
    '</div><button class="btn sm" style="margin-top:8px" onclick="S.cpub.tab=\'v\';render()">去處理</button></div></div></div>';
  if (tab === 'c') {
    var on = d.cases.filter(function (x) { return ['已駁回', '已結案'].indexOf(x.status) < 0 && x.end >= d.today; }), off = d.cases.filter(function (x) { return on.indexOf(x) < 0; });
    var row = function (x) {
      var st = x.status === '已核准' ? (x.start > d.today ? '已核准・待進場' : x.end < d.today ? '已完工' : '施工中') : x.status;
      return '<button class="li cs" onclick="S.cpub={kind:\'case\',vs:S.cpub.vs,demo:S.cpub.demo,cid:' + jsq(x.id) + ',f:{}};render()"><span class="mn"><span class="mt">' + esc(x.id + '・承辦 ' + x.handler) + '</span><span class="nm">' + esc(x.work) + '</span>' +
        '<span class="mt">' + esc(x.area + '・' + x.start + (x.end !== x.start ? '～' + x.end.slice(5) : '')) + '</span><span class="mt">' + esc('施工人員 ' + x.wSigned + '/' + x.workers + ' 已簽' + (x.permits ? '・許可 ' + x.permits + ' 張' : '') + (x.docs ? '・文件 ' + x.docs + ' 份' : '')) + '</span></span>' +
        '<span class="csr">' + pill(CN_ST_PILL[x.status] || 'na', '', st) + ic('chev', 18, 2.6) + '</span></button>';
    };
    h += '<div class="sec">進行中 ' + on.length + '</div>' + (on.length ? '<div class="list">' + on.map(row).join('') + '</div>' : '<div class="empty">目前沒有進行中的案件</div>') +
      '<div class="muted sm" style="margin:6px 2px">新的施工申請：請向員和承辦人員索取「施工申請連結」。</div>' +
      '<div class="sec">歷史紀錄 ' + off.length + '</div>' + (off.length ? '<div class="list">' + off.map(row).join('') + '</div>' : '<div class="empty">沒有歷史紀錄</div>');
  } else if (tab === 'r') {
    h += '<div class="muted sm" style="margin:6px 2px 4px">進廠施工前，請負責人和每位施工人員都看過。</div>' +
      '<div class="sec">員和施工安全衛生規定</div><div class="card"><ol style="margin:0 0 0 20px">' + d.rules.map(function (x) { return '<li style="margin:4px 0">' + esc(x) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="sec">員和廠區危害告知</div>' + d.notice.map(function (s0) { return '<div class="cnno"><b>' + esc(s0.t) + '</b><ul>' + s0.x.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('') +
      '<div class="sec">高風險作業<small>點開看主要危害與一定要做的防護</small></div>' + cnRiskList(RISK.map(function (r, i) { return i; })) +
      '<div class="sec">特殊作業許可的注意事項<small>申請時要逐項確認做到</small></div>' + Object.keys(d.pmCheck).map(function (t) {
        return '<details class="card" style="margin:8px 0"><summary style="font-weight:800;font-size:16px">' + esc(t) + '</summary><ol style="margin:8px 0 0 20px">' + d.pmCheck[t].map(function (x) { return '<li style="margin:3px 0">' + esc(x) + '</li>'; }).join('') + '</ol>' +
          (t === '局限空間作業' ? '<div class="muted sm">進入前測定標準：O2 ≥ ' + d.pmSafe.O2_MIN + '%、LEL ≤ ' + d.pmSafe.LEL_MAX + '%、H2S ≤ ' + d.pmSafe.H2S_MAX + 'ppm、CO ≤ ' + d.pmSafe.CO_MAX + 'ppm</div>' : '') + '</details>';
      }).join('');
  } else {
    var v = d.vendor, row2 = function (k, x) { return x ? '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(x) + '</b></div>' : ''; };
    h += '<div class="sec">公司資料</div><div class="card">' + row2('公司', v.name) + row2('統一編號', v.tax) + row2('聯絡人', v.contact) + row2('電話', v.phone) + row2('Email', v.email) + row2('承攬類別', v.types) +
      '<div class="muted sm">資料有變更：請向員和承辦人員索取建檔連結，用這支手機（已登入）重新填一次。</div></div>' +
      '<div class="sec">承攬商安全衛生承諾書</div><div class="card"><div class="kv"><span>狀態</span><b>' + pill(d.commit.st === 'ok' ? 'ok' : 'warn', d.commit.st === 'ok' ? 'check' : '', d.commit.text) + '</b></div>' +
      (d.commitFiles.length ? d.commitFiles.map(function (x) { return '<div class="cnfile"><span>' + esc(x.name) + '</span><small class="muted">已上傳 ' + esc(x.at.slice(5)) + '</small></div>'; }).join('') : '') +
      '<button class="btn line" id="vcBlank" onclick="cnCommitBlank()">' + ic('down', 18, 2.4) + '下載承諾書（已帶入公司資料）</button>' +
      (d.commit.st !== 'ok' ? '<div class="muted sm" style="margin-top:8px">負責人簽名、蓋公司大章與負責人小章後，拍照或掃描上傳：</div>' + cnFilesBoxK('files', 'vcUp', 2) +
        (P.f.files && P.f.files.length ? '<button class="btn" id="vcUpBtn" onclick="cnCommitUp(\'vcUpBtn\')">' + ic('up', 18, 2.6) + '上傳承諾書</button>' : '') : '') + '</div>' +
      (P.demo ? '' : '<button class="btn ghost" onclick="cnVLogout()">' + ic('logout', 18, 2.4) + '登出這支手機</button>');
  }
  $('app').innerHTML = h + '<div id="vErr"></div>';
  bar('');
}
function cnCommitUp(btn) {
  cnBusy(btn, '上傳中…');
  var P = S.cpub, vs = P.vs || cnVs();
  api('consPubVCommit', { vs: vs, files: P.f.files || [] }, { token: '-' }).then(function () { P.f.files = []; toast('已上傳，環安衛確認後會通知', 'ok', 4000); if (P.kind === 'vhome') { P.reload = true; } render(); })
    .catch(function (e) { toast(esc(e.message), 'err', 5000); cnUnbusy(btn, '再試一次'); });
}
function cnCommitBlank() { cnBusy('vcBlank', '產生中…（約 10 秒）'); cnPub('consPubVCommitBlank').then(function (r) { cnB64Save(r); cnUnbusy('vcBlank', '下載承諾書（已帶入公司資料）'); }).catch(function (e) { toast(esc(e.message), 'err'); cnUnbusy('vcBlank', '下載承諾書（已帶入公司資料）'); }); }
function cnDocGet(fid) { toast('下載中…', '', 1500); cnPub('consPubVDoc', { fid: fid, cid: S.cpub.cid || S.cpub.d.id }).then(cnB64Save).catch(function (e) { toast(esc(e.message), 'err', 4000); }); }
function cnVLogout() { if (!confirm('登出這支手機？下次要重新輸入統編與登入碼。')) return; cnPub('consPubVLogout').catch(function () {}); cnVs(null); S.cpub = { kind: 'login', f: {} }; render(); }
/** 案件申報的作業 → 對應的高風險作業卡（RISK 在 plat.js）。 */
function cnRiskFor(txt) {
  var map = [['動火', 0], ['高架', 1], ['局限', 2], ['吊掛', 3], ['電氣', 4], ['堆高機', 5], ['有機溶劑', 6], ['粉塵', 7], ['化學品', 8]], out = [];
  map.forEach(function (m) { if (String(txt).indexOf(m[0]) >= 0 && out.indexOf(m[1]) < 0) out.push(m[1]); });
  return out;
}
function cnRiskList(idx) {
  if (typeof RISK === 'undefined') return '';
  var open = S.cpub.rk;
  return '<div class="list">' + idx.map(function (i) {
    var r = RISK[i], d = r.zh, on = open === i;
    return '<div class="li rk' + (on ? ' on' : '') + '" role="button" tabindex="0" onclick="S.cpub.rk=' + (on ? 'null' : i) + ';cnRedraw()" style="display:block">' +
      '<div style="display:flex;align-items:center;gap:10px">' + r.icons.map(function (n) { return '<img src="' + n + '.svg" alt="" style="width:40px;height:40px;flex-shrink:0">'; }).join('') +
      '<b style="font-size:17px;flex:1">' + esc(d[0]) + '</b>' + ic('chev', 18, 2.6) + '</div>' +
      (on ? '<div style="margin-top:10px"><div class="sec" style="margin:6px 0 2px">主要危害</div><ul style="margin:0 0 6px 18px">' + d[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<div class="sec" style="margin:6px 0 2px">一定要做</div><ol style="margin:0 0 6px 18px">' + d[2].map(function (x) { return '<li><b>' + esc(x) + '</b></li>'; }).join('') + '</ol>' +
        '<div class="muted sm">法規依據：' + esc(d[3]) + '</div></div>' : '') + '</div>';
  }).join('') + '</div>';
}

/** 承攬商端示範：跟後端拿示範資料（要員工登入），開承攬商登入畫面、帳密預先填好。 */
function cnDemoStart() {
  toast('準備示範資料…', '', 1500);
  api('consDemo', {}).then(function (d) { S.cpub = { kind: 'login', demoLogin: { tax: d.tax, code: d.code, data: d }, f: {} }; window.scrollTo(0, 0); render(); })
    .catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
