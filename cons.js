// ───────────── 承攬商管理（v0.15，10/19 Jason：舊承攬商系統搬進 App）─────────────
// 廠商、施工人員：從連結進來（#cons=reg|apply&i=邀請碼、#cons=case&c=案件權杖、#cons=sign&w=簽名權杖），不用登入、不碰這支手機原本的帳號。
// 員工：主選單「施工申請」—— 傳邀請連結給廠商、承辦簽名與提交、環安衛審核、承諾書登記。後端：mod/cons.gs。
var CN_ST_PILL = { '暫緩－文件不齊': 'warn', '施工人員簽名中': 'info', '待審核': 'warn', '已核准': 'ok', '補件退回': 'bad', '已駁回': 'na', '已結案': 'na' };
(function () {
  var st = document.createElement('style');
  st.textContent = '.cwrap{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px}.cwrap .chip{min-height:40px;font-size:15px}' +
    '.cnw{display:grid;grid-template-columns:1fr 92px 44px;gap:6px;align-items:center;margin-bottom:6px}.cnw .field{margin:0}' +
    '.cnw .rm{min-height:44px;border:0;background:#F1F4F8;border-radius:10px;font-size:20px}.cnqr{display:flex;justify-content:center;margin:10px 0}.cnqr svg{width:240px;height:240px}' +
    '.cnno{background:#FFF8EC;border-left:4px solid #E58A00;border-radius:0 10px 10px 0;padding:10px 14px;margin:8px 0}.cnno b{display:block;margin-bottom:4px}.cnno li{margin:3px 0}' +
    '.cnwk{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #EEF1F5}.cnagree{display:flex;gap:10px;align-items:flex-start;margin:12px 0;font-size:15px}' +
    '.cnagree input{width:24px;height:24px;flex-shrink:0;margin-top:2px}';
  document.head.appendChild(st);
})();

function cnRoute() {
  var h = location.hash, m = /[#&]cons=(reg|apply|case|sign)/.exec(h);
  if (!m) return null;
  var g = function (k) { var x = new RegExp('[#&]' + k + '=([0-9a-fA-F]+)').exec(h); return x ? x[1].toLowerCase() : ''; };
  return { kind: m[1], i: g('i'), c: g('c'), w: g('w'), f: {}, step: 0 };
}
function cnPub(action, body) {
  var P = S.cpub, b = Object.assign({}, body || {});
  if (P.i) b.i = P.i; if (P.c) b.c = P.c; if (P.w) b.w = P.w; if (P.cid) { b.cid = P.cid; b.pin = P.pin; }
  return api(action, b, { token: '-' });
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
    (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' value="' + esc(val || '') + '" oninput="S.cpub.f[' + jsq(id) + ']=this.value">' + (o.hint ? '<div class="muted sm">' + esc(o.hint) + '</div>' : '');
}
function cnChips(key, list, sel) {
  return '<div class="cwrap">' + list.map(function (x) {
    var on = (sel || []).indexOf(x) >= 0;
    return '<button type="button" class="chip' + (on ? ' on' : '') + '" onclick="cnTog(' + jsq(key) + ',' + jsq(x) + ')">' + (on ? ic('check', 14, 3) : '') + esc(x) + '</button>';
  }).join('') + '</div>';
}
function cnTog(key, x) {
  var a = S.cpub.f[key] = S.cpub.f[key] || [], k = a.indexOf(x);
  if (k >= 0) a.splice(k, 1); else a.push(x);
  var y = window.scrollY; render(); window.scrollTo(0, y);
}
function cnV(id) { var el = $(id); return el ? el.value.trim() : (S.cpub.f[id] || ''); }

// ── 公開頁入口 ──
PLAT_PAGES.consPub = function () {
  var P = S.cpub;
  if (P.kind === 'login') return cnLogin();
  if (P.kind === 'reg') return cnReg();
  if (P.kind === 'apply') return cnApply();
  if (P.kind === 'case') return cnCase();
  return cnSign();
};

// 承攬商查詢案件：案件編號＋6 碼查詢密碼（申請完成的 Email 裡）
function cnLogin() {
  var P = S.cpub;
  setTitle('承攬商查詢案件');
  cnHero('承攬商查詢案件', '輸入案件編號與 6 碼查詢密碼');
  $('app').innerHTML = cnField('clId', '案件編號', P.f.clId, { max: 12, ph: '例：C' + today().slice(0, 4) + '-028' }) +
    cnField('clPin', '查詢密碼（6 位數字）', P.f.clPin, { mode: 'numeric', max: 6, hint: '在「施工申請已收到」的 Email 裡；不是員工的 4 碼啟用碼' }) + '<div id="clErr"></div>' +
    '<button class="btn ghost" onclick="S.cpub=null;S.page=\'login\';render()">' + ic('back', 18, 2.4) + '回員工登入</button>';
  bar('<button class="btn" id="clBtn" onclick="cnLoginGo()">' + ic('arrow', 22, 2.6) + '查詢</button>');
}
function cnLoginGo() {
  var id = cnV('clId').toUpperCase().replace(/\s/g, ''), pin = cnV('clPin').replace(/\D/g, '');
  if (!/^C\d{4}-\d{3,}$/.test(id)) return toast('案件編號像 C' + today().slice(0, 4) + '-028', 'err');
  if (!/^\d{6}$/.test(pin)) return toast('查詢密碼是 6 位數字', 'err');
  cnBusy('clBtn', '查詢中…');
  api('consPubCase', { cid: id, pin: pin }, { token: '-' }).then(function (d) { S.cpub = { kind: 'case', cid: id, pin: pin, f: {}, d: d }; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('clErr').innerHTML = errBox('查不到', e.message); cnUnbusy('clBtn', '查詢'); });
}

// 廠商建檔
function cnReg() {
  var P = S.cpub, f = P.f;
  setTitle('廠商建檔');
  if (!P.form) { $('app').innerHTML = loading('讀取中…'); cnPub('consPubForm').then(function (d) { P.form = d; render(); }).catch(cnFail); return; }
  cnHero('承攬商建檔', '員和承辦人員：' + P.form.handler);
  if (P.done) {
    $('app').innerHTML = '<div class="box ok"><div class="r">' + ic('check', 26) + '<div class="bt"><b>' + esc(P.done.name) + ' 建檔完成</b><div class="m">' +
      (P.done.updated ? '已更新貴公司原本的建檔資料。' : '環安衛中心會寄「承攬商安全衛生承諾書」給您，請負責人簽名、蓋公司大小章後寄回正本。') + '</div></div></div></div>' +
      '<button class="btn" onclick="location.hash=' + jsq(P.done.applyUrl.split('#')[1]) + ';location.reload()">' + ic('arrow', 20, 2.6) + '接著填施工申請</button>';
    return;
  }
  $('app').innerHTML = '<div class="muted">第一次到員和施工的廠商填一次；資料有變更可以再填一次（同一統編會更新原資料）。</div>' +
    cnField('crTax', '統一編號', f.crTax, { mode: 'numeric', max: 8, ph: '8 位數字' }) + cnField('crName', '公司名稱（全名）', f.crName) +
    cnField('crOwner', '負責人', f.crOwner, { max: 20 }) + cnField('crContact', '主要聯絡人', f.crContact, { max: 20 }) +
    cnField('crPhone', '聯絡電話', f.crPhone, { type: 'tel', max: 30 }) + cnField('crEmail', 'Email（承諾書、通知寄到這裡）', f.crEmail, { type: 'email', max: 80 }) +
    cnField('crAddr', '公司地址', f.crAddr, { max: 100 }) + '<label class="nl">承攬類別（可複選）</label>' + cnChips('types', P.form.types, f.types) + '<div id="crErr"></div>';
  bar('<button class="btn" id="crBtn" onclick="cnRegGo()">' + ic('check', 22, 3) + '送出建檔</button>');
}
function cnRegGo() {
  var b = { tax: cnV('crTax'), name: cnV('crName'), owner: cnV('crOwner'), contact: cnV('crContact'), phone: cnV('crPhone'), email: cnV('crEmail'), addr: cnV('crAddr'), types: S.cpub.f.types || [] };
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
    (P.vendor.commit ? '' : '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">環安衛中心還沒收到貴公司承諾書用印正本：可以先申請，正本寄達後才會進入審核。</div></div></div></div>') +
    cnCaseForm(P.form, f) + cnAgree() + cnSigBox('施工負責人請簽全名') + '<div id="caErr"></div>';
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
      '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>貴公司還沒建檔</b><div class="m">第一次到員和施工，請先完成廠商建檔（約 2 分鐘），再回來填施工申請。</div></div></div></div>' +
      '<button class="btn" onclick="location.hash=' + jsq(S.cpub.form.regUrl.split('#')[1]) + ';location.reload()">' + ic('arrow', 20, 2.6) + '先去建檔</button>';
  }).catch(function (e) { cnUnbusy('caBtn', '下一步'); $('caErr').innerHTML = errBox('查不到', e.message); });
}
/** 施工內容表單（申請與補件共用）。f：S.cpub.f，o：選項 */
function cnCaseForm(o, f, fix) {
  var ws = f.workers = f.workers || (fix ? [] : [{ name: '', id4: '' }]);
  var spec = f.spec || [], h = '<div class="sec">施工內容</div>' +
    cnField('caWork', '工程名稱', f.caWork) + cnField('caArea', '施工區域', f.caArea, { ph: '例：PU部一廠、BU粉體區' }) +
    '<div class="r2">' + cnField('caStart', '預計開工日', f.caStart, { type: 'date', max: 10 }) + cnField('caEnd', '預計完工日', f.caEnd, { type: 'date', max: 10 }) + '</div>' +
    '<label class="nl">特殊作業（有的才勾）</label>' + cnChips('spec', o.spec, spec) +
    (spec.indexOf('動火作業') >= 0 ? '<label class="nl req">動火方式</label>' + cnChips('hot', o.hot, f.hot) : '') +
    (spec.length ? '<div class="muted sm">有特殊作業請在開工前 ' + (o.lateDays || 3) + ' 天提出申請；作業前另外申請許可。</div>' : '') +
    '<label class="nl">施工期間可能產生的狀況</label>' + cnChips('situ', o.situ, f.situ) +
    '<label class="nl">施工環境可能的危害</label>' + cnChips('env', o.env, f.env) +
    '<div class="sec">' + (fix ? '新增施工人員' : '施工人員') + '<small>一列一人；沒有身分證的外籍人員填居留證末 4 碼</small></div>' +
    ws.map(function (w, k) {
      return '<div class="cnw"><input class="field" maxlength="20" placeholder="姓名" value="' + esc(w.name) + '" oninput="S.cpub.f.workers[' + k + '].name=this.value">' +
        '<input class="field" inputmode="numeric" maxlength="4" placeholder="末4碼" value="' + esc(w.id4) + '" oninput="S.cpub.f.workers[' + k + '].id4=this.value.replace(/\\D/g,\'\')">' +
        '<button type="button" class="rm" aria-label="刪除這一列" onclick="cnWk(' + k + ')">×</button></div>';
    }).join('') + '<button type="button" class="btn line" onclick="cnWk(-1)">' + ic('plus', 18, 2.6) + '新增一位施工人員</button>' +
    '<div class="sec">施工負責人（現場監督）</div>' + cnField('caSup', '姓名', f.caSup, { max: 20 }) + cnField('caSupPhone', '手機', f.caSupPhone, { type: 'tel', max: 30 }) +
    cnField('caEmail', 'Email（進度通知寄到這裡）', f.caEmail, { type: 'email', max: 80, req: false, hint: '沒填就寄到建檔時的 Email' }) +
    '<label class="nl" for="caNote">備註</label><textarea class="field" id="caNote" maxlength="300" rows="2" oninput="S.cpub.f.caNote=this.value">' + esc(f.caNote || '') + '</textarea>';
  return h;
}
function cnWk(k) {
  var ws = S.cpub.f.workers;
  ['caWork', 'caArea', 'caStart', 'caEnd', 'caSup', 'caSupPhone', 'caEmail', 'caNote'].forEach(function (id) { var el = $(id); if (el) S.cpub.f[id] = el.value; });
  if (k === -2) { var y0 = window.scrollY; render(); return window.scrollTo(0, y0); }
  if (k < 0) ws.push({ name: '', id4: '' }); else { ws.splice(k, 1); if (!ws.length && !S.cpub.fix) ws.push({ name: '', id4: '' }); }
  var y = window.scrollY; render(); window.scrollTo(0, y);
}
function cnAgree() {
  return '<div class="cnno"><b>員和工業施工安全衛生規定（摘要）</b><ul><li>進廠換證登記、配戴識別證；廠區全面禁菸</li><li>依作業穿戴安全帽、安全鞋與防護具</li>' +
    '<li>動火、吊掛、局限空間、高架作業須事先申請許可</li><li>進場當天先參加工具箱會議；發生異常立即停工並通知員和承辦人員</li></ul></div>' +
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
           sup: cnV('caSup'), supPhone: cnV('caSupPhone'), email: cnV('caEmail'), note: cnV('caNote') };
}
function cnApplyGo() {
  var b = cnCaseBody();
  b.tax = S.cpub.vendor.tax; b.agree = !!($('caAgree') && $('caAgree').checked);
  if (!b.agree) return toast('請勾選已閱讀施工安全衛生規定', 'err');
  if (!SIG.drawn) return toast('施工負責人請簽名', 'err');
  b.image = sigExport(); if (!b.image) return toast('簽名太小，請簽大一點', 'err');
  cnBusy('caBtn', '送出中…');
  cnPub('consPubApply', b).then(function (d) { S.cpub.done = d; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('caErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('caBtn', '再送一次'); });
}
function cnApplyDone() {
  var d = S.cpub.done;
  $('app').innerHTML = '<div class="box ok"><div class="r">' + ic('check', 26) + '<div class="bt"><b>申請已送出（' + esc(d.id) + '）</b><div class="m">' +
    (d.status === '暫緩－文件不齊' ? '承諾書正本寄達後才會進入審核。' : '請讓每位施工人員用自己的手機掃下方 QR Code 簽名。') + (d.late ? '<br>注意：有特殊作業，開工日距今不到 3 天。' : '') + '</div></div></div></div>' +
    (d.pin ? '<div class="card"><div class="kv"><span>案件編號</span><b>' + esc(d.id) + '</b></div><div class="kv"><span>查詢密碼</span><b style="font-size:22px;letter-spacing:4px">' + esc(d.pin) + '</b></div>' +
      '<div class="muted sm">請記下來（也寄到 Email）。沒有連結時，打開員和環安衛系統登入頁按「承攬商查詢案件」輸入這兩項即可。</div></div>' : '') +
    '<div class="sec">施工人員簽名 QR</div><div class="cnqr">' + meetQrSvg(d.workerUrl, 240) + '</div>' +
    '<div class="btns"><button class="btn ghost" onclick="shareLink(' + jsq('員和工業施工人員簽名（' + d.id + '）') + ',' + jsq(d.workerUrl) + ')">' + ic('share', 18, 2.4) + '傳給施工人員</button></div>' +
    '<div class="sec">案件連結<small>看進度、補件、再出 QR 都用這個，請保存</small></div>' +
    '<div class="btns"><button class="btn" onclick="shareLink(' + jsq('員和工業施工申請案件連結（' + d.id + '）') + ',' + jsq(d.caseUrl) + ')">' + ic('share', 18, 2.4) + '傳給自己（LINE）</button>' +
    '<button class="btn ghost" onclick="copyText(' + jsq(d.caseUrl) + ',' + jsq('已複製') + ')">' + ic('copy', 18, 2.2) + '複製連結</button></div>' +
    '<div class="muted sm">同一個連結也已寄到您的 Email。</div>';
}

// 案件連結：進度、補件、出 QR
function cnCase() {
  var P = S.cpub;
  setTitle('施工申請進度');
  if (!P.d || P.reload) { P.reload = false; $('app').innerHTML = loading('讀取案件…'); cnPub('consPubCase', P.qr ? { qr: true } : {}).then(function (d) { P.d = d; if (d.workerUrl) P.workerUrl = d.workerUrl; P.qr = false; render(); }).catch(cnFail); return; }
  var d = P.d;
  cnHero(d.vendor, d.id + '・' + d.work);
  if (P.fix) return cnFixForm();
  var h = '<div class="card"><div class="kv"><span>狀態</span><b>' + pill(CN_ST_PILL[d.status] || 'na', '', d.status) + '</b></div>' +
    (d.comment && (d.status === '補件退回' || d.status === '已駁回') ? '<div class="box bad"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>環安衛意見</b><div class="m">' + esc(d.comment) + '</div></div></div></div>' : '') +
    '<div class="kv"><span>工程</span><b>' + esc(d.work) + '</b></div><div class="kv"><span>區域</span><b>' + esc(d.area) + '</b></div>' +
    '<div class="kv"><span>期間</span><b>' + esc(d.start + ' ～ ' + d.end) + '</b></div><div class="kv"><span>特殊作業</span><b>' + esc(d.spec) + '</b></div>' +
    '<div class="kv"><span>員和承辦</span><b>' + esc(d.handler) + (d.handlerSigned ? '（已簽）' : '') + '</b></div></div>' +
    '<div class="sec">施工人員簽名 ' + d.wSigned + '/' + d.workers.length + '</div><div class="card">' +
    d.workers.map(function (w) { return '<div class="cnwk"><span>' + esc(w.name) + '</span>' + (w.signed ? pill('ok', 'check', '已簽 ' + w.at) : pill('warn', '', '未簽')) + '</div>'; }).join('') + '</div>';
  if (d.canQr) h += P.workerUrl ? '<div class="sec">施工人員簽名 QR<small>每位施工人員用自己的手機掃</small></div><div class="cnqr">' + meetQrSvg(P.workerUrl, 240) + '</div>' +
      '<div class="btns"><button class="btn ghost" onclick="shareLink(' + jsq('員和工業施工人員簽名（' + d.id + '）') + ',' + jsq(P.workerUrl) + ')">' + ic('share', 18, 2.4) + '傳給施工人員</button></div>'
    : '<button class="btn" onclick="S.cpub.qr=true;S.cpub.reload=true;render()">' + ic('grid', 20, 2.4) + '出施工人員簽名 QR</button>';
  if (d.canFix) h += '<button class="btn ' + (d.status === '補件退回' ? '' : 'line') + '" onclick="cnFixStart()">' + ic('pen', 18, 2.4) + (d.status === '補件退回' ? '補件後重新送出' : '修改申請內容、增減施工人員') + '</button>';
  if (d.status === '已核准') h += '<div class="box ok"><div class="r">' + ic('check', 22) + '<div class="bt"><div class="m">已核准，施工期間可進場。進場當天請先參加工具箱會議；特殊作業前另外申請許可。</div></div></div></div>';
  $('app').innerHTML = h + '<button class="btn ghost" onclick="S.cpub.reload=true;render()">' + ic('refresh', 18, 2.4) + '重新整理</button>';
}
function cnFixStart() {
  var d = S.cpub.d;
  S.cpub.f = { caWork: d.work, caArea: d.area, caStart: d.start, caEnd: d.end, spec: d.specRaw.slice(), hot: d.hotRaw.slice(), situ: d.situRaw.slice(), env: d.envRaw.slice(),
               caSup: d.sup, caSupPhone: d.supPhone, caEmail: d.email, caNote: d.note, workers: [] };
  S.cpub.fix = true; S.cpub.form = Object.assign({ lateDays: 3 }, d.form); S.cpub.keep = d.workers.map(function (w) { return w.seq; });
  window.scrollTo(0, 0); render();
}
function cnFixForm() {
  var P = S.cpub, f = P.f;
  var kept = P.d.workers.filter(function (w) { return P.keep.indexOf(w.seq) >= 0; });
  $('app').innerHTML = '<div class="muted">改完按「送出修改」。改了期間、區域或特殊作業，員和承辦人員要重新簽名。</div>' +
    '<div class="sec">已登記的施工人員<small>按 × 移除；已簽名的保留簽名</small></div><div class="card">' +
    (kept.length ? kept.map(function (w) { return '<div class="cnwk"><span>' + esc(w.name) + (w.signed ? '（已簽）' : '') + '</span><button type="button" class="rm btn ghost sm" onclick="cnKeepRm(' + w.seq + ')">×</button></div>'; }).join('') : '<div class="muted">（都移除了）</div>') + '</div>' +
    cnCaseForm(P.form, f, true) + cnSigBox('換了施工負責人才需要簽名（沒換可以不簽）') + '<div id="caErr"></div>';
  bar('<button class="btn ghost" onclick="S.cpub.fix=false;render()">取消</button><button class="btn" id="caBtn" onclick="cnFixGo()">' + ic('check', 22, 3) + '送出修改</button>');
  sigInit();
}
function cnKeepRm(seq) { var k = S.cpub.keep.indexOf(seq); if (k >= 0) S.cpub.keep.splice(k, 1); cnWk(-2); }
function cnFixGo() {
  var b = cnCaseBody(); b.keep = S.cpub.keep;
  if (SIG.drawn) { b.image = sigExport(); if (!b.image) return toast('簽名太小，請簽大一點', 'err'); }
  cnBusy('caBtn', '送出中…');
  cnPub('consPubFix', b).then(function (r) {
    S.cpub.fix = false; S.cpub.reload = true; window.scrollTo(0, 0); render();
    toast(r.handlerReSign ? '已送出；內容有改，員和承辦人員會重新簽名' : '已送出修改', 'ok', 4000);
  }).catch(function (e) { $('caErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('caBtn', '再送一次'); });
}

// 施工人員：選名字 → 末4碼 → 看危害告知 → 親簽
function cnAk() {
  var k = 'cons_ak:' + S.cpub.w.slice(0, 16), v = '';
  try { v = localStorage.getItem(k) || ''; } catch (e) {}
  if (!/^[0-9a-f]{32}$/.test(v)) {
    v = ''; var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 16; i++) v += ('0' + a[i].toString(16)).slice(-2);
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  return v;
}
function cnSign() {
  var P = S.cpub;
  setTitle('施工人員簽名');
  if (!P.d || P.reload) { P.reload = false; $('app').innerHTML = loading('讀取中…'); cnPub('consPubWorkerOpen').then(function (d) { P.d = d; render(); }).catch(cnFail); return; }
  var d = P.d;
  cnHero(d.vendor, d.work + '・' + d.area);
  if (P.done) {
    $('app').innerHTML = '<div class="box ok"><div class="r">' + ic('check', 26) + '<div class="bt"><b>' + esc(P.done) + '，簽名完成</b><div class="m">謝謝您。施工時請遵守安全規定；有任何異常立即停工並通知員和承辦人員。</div></div></div></div>' +
      '<button class="btn ghost" onclick="S.cpub={kind:\'sign\',w:S.cpub.w,f:{}};render()">換下一位施工人員簽</button>';
    return;
  }
  if (!P.seq) {
    var left = d.workers.filter(function (w) { return !w.signed; });
    $('app').innerHTML = '<div class="steps"><div class="cur"><i></i><span>1 選您的名字</span></div><div><i></i><span>2 危害告知・簽名</span></div></div>' +
      (left.length ? '<div class="list">' + left.map(function (w) { return '<button class="li" onclick="S.cpub.seq=' + w.seq + ';S.cpub.nm=' + jsq(w.name) + ';render()"><span class="mn"><span class="nm">' + esc(w.name) + '</span></span>' + ic('chev', 18, 2.6) + '</button>'; }).join('') + '</div>'
        : '<div class="empty">名單上的施工人員都簽好了</div>') +
      '<div class="muted sm">名單上沒有您的名字：請施工負責人在案件連結加上您。</div>';
    return;
  }
  var notice = '<div class="cnno"><b>本次施工</b><ul><li>期間：' + esc(d.start + ' ～ ' + d.end) + '</li><li>特殊作業：' + esc(d.spec) + '</li>' +
    (d.env ? '<li>環境危害：' + esc(d.env) + '</li>' : '') + (d.situ ? '<li>可能狀況：' + esc(d.situ) + '</li>' : '') + '</ul></div>' +
    d.notice.map(function (s) { return '<div class="cnno"><b>' + esc(s.t) + '</b><ul>' + s.x.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  $('app').innerHTML = '<div class="steps"><div class="done"><i></i><span>' + ic('check', 14, 3.2) + esc(P.nm) + '</span></div><div class="cur"><i></i><span>2 危害告知・簽名</span></div></div>' +
    '<div class="sec">危害告知<small>請看完再簽名</small></div>' + notice +
    '<label class="cnagree"><input type="checkbox" id="csRead"' + (P.f.read ? ' checked' : '') + ' onchange="S.cpub.f.read=this.checked"><span>我已了解上述危害與規定，會遵守</span></label>' +
    cnField('csId4', '身分證（居留證）末 4 碼', P.f.csId4, { mode: 'numeric', max: 4, hint: '確認是您本人；不會顯示在任何畫面' }) +
    cnSigBox(P.nm + '，請用手指簽全名') + '<div id="csErr"></div>';
  bar('<button class="btn ghost" onclick="S.cpub.seq=0;render()">不是我</button><button class="btn" id="csBtn" onclick="cnSignGo()">' + ic('check', 22, 3) + '簽名送出</button>');
  sigInit();
}
function cnSignGo() {
  var P = S.cpub, id4 = cnV('csId4');
  if (!($('csRead') && $('csRead').checked)) return toast('請先看完危害告知並勾選', 'err');
  if (!/^\d{4}$/.test(id4)) return toast('請填末 4 碼', 'err');
  if (!SIG.drawn) return toast('請先簽名', 'err');
  var img = sigExport(); if (!img) return toast('簽名太小，請簽大一點', 'err');
  cnBusy('csBtn', '送出中…');
  cnPub('consPubWorkerSign', { seq: P.seq, id4: id4, image: img, read: true, akey: cnAk() }).then(function (r) { P.done = r.name; window.scrollTo(0, 0); render(); })
    .catch(function (e) { $('csErr').innerHTML = errBox('沒有送出', e.message); cnUnbusy('csBtn', '再送一次'); });
}

// ── 員工端（新系統開啟時取代舊的施工申請頁）──
var cnOldPage = PLAT_PAGES.cons;
PLAT_PAGES.cons = function () {
  if (!(plat() && plat().consNew)) return cnOldPage();
  setTitle('施工申請');
  var h = '<button class="card fcard tbm" onclick="S.mh=null;go(\'meet\')"><div class="fh">' + ic('helmet', 22, 2.2) + '<b>工具箱會議</b></div>' +
    '<div class="muted">施工當天開工前在現場開：施工人員掃 QR 簽名、看完簡報，完成後自動產生紀錄。</div></button>' +
    '<div class="sec">傳給廠商<small>連結 30 天內有效；案件會掛在您名下</small></div>' +
    '<div class="card fcard"><div class="fh"><b>施工申請連結</b></div><div class="muted">廠商填統編 → 施工內容 → 施工人員（按「＋」逐人新增）→ 施工負責人簽名。沒建檔的會先導去建檔。</div>' +
    '<div class="btns r3"><button class="btn" onclick="cnInvite(\'apply\',\'share\')">' + ic('share', 18, 2.4) + '傳給廠商</button>' +
    '<button class="btn ghost" onclick="cnInvite(\'apply\',\'copy\')">' + ic('copy', 18, 2.2) + '複製連結</button><button class="btn ghost" onclick="cnInvite(\'apply\',\'open\')">' + ic('ext', 18, 2.2) + '打開看看</button></div></div>';
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
    row('可能狀況', d.situ) + row('環境危害', d.env) + row('承辦', d.handler) + row('備註', d.note) + (d.late ? '<div class="box warn"><div class="r">' + ic('warn', 20) + '<div class="bt"><div class="m">' + esc(d.late) + '</div></div></div></div>' : '') + '</div>' +
    '<div class="sec">聯絡</div><div class="card">' + row('施工負責人', d.sup + (d.supSigned ? '（已簽）' : '')) +
    (stel ? '<a class="btn ghost" href="tel:' + esc(stel) + '">' + ic('chat', 18, 2.4) + '打給施工負責人 ' + esc(d.supPhone) + '</a>' : '') +
    row('廠商聯絡人', v.contact) + (tel ? '<a class="btn ghost" href="tel:' + esc(tel) + '">' + ic('chat', 18, 2.4) + '打給廠商 ' + esc(v.phone) + '</a>' : '') +
    row('承諾書', v.commit ? '已收到用印正本' : '尚未收到正本') + '</div>' +
    '<div class="sec">施工人員簽名 ' + d.wSigned + '/' + d.workers.length + '</div><div class="card">' +
    d.workers.map(function (w) { return '<div class="cnwk"><span>' + esc(w.name) + '</span>' + (w.signed ? pill('ok', 'check', '已簽 ' + w.at) : pill('warn', '', '未簽')) + '</div>'; }).join('') + '</div>';
  if (d.sameDevice && d.sameDevice.length) h += '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><b>同一支手機簽了好幾位</b><div class="m">' +
    d.sameDevice.map(function (a) { return esc(a.join('、')); }).join('<br>') + '<br>請確認是本人親簽（不是別人代簽）。</div></div></div></div>';
  h += '<div class="sec">歷程</div><div class="card">' + d.history.map(function (x) { return '<div class="cnwk"><span><b>' + esc(x.act) + '</b>' + (x.note ? '・' + esc(x.note) : '') + '<br><small class="muted">' + esc(x.who) + '</small></span><small class="muted">' + esc(x.at.slice(5)) + '</small></div>'; }).join('') + '</div>';
  if (d.comment) h += '<div class="box info"><div class="r">' + ic('info', 20) + '<div class="bt"><b>審核意見</b><div class="m">' + esc(d.comment) + '</div></div></div></div>';
  $('app').innerHTML = h + '<div id="cnErr"></div>';
  if (d.canSign) bar('<button class="btn" id="cnBtn" onclick="cnHandlerSign()">' + ic('pen', 20, 2.4) + (d.wSigned >= d.workers.length ? '簽名並提交審核' : '簽名（施工人員簽完再提交）') + '</button>');
  else if (d.canSubmit) bar('<button class="btn" id="cnBtn" onclick="cnSubmit()">' + ic('up', 20, 2.6) + '提交審核</button>');
  else if (d.canReview) bar('<button class="btn ghost" onclick="cnReview(\'return\')">退回補件</button><button class="btn ghost" onclick="cnReview(\'reject\')">駁回</button><button class="btn" id="cnBtn" onclick="cnReview(\'approve\')">' + ic('check', 20, 3) + '核准</button>');
}
function cnAfter(msg) { return function () { toast(msg, 'ok', 3500); rcClear(); render(); }; }
function cnErr(e) { var el = $('cnErr'); if (el) el.innerHTML = errBox('沒有完成', e.message); var b = $('cnBtn'); if (b) { b.disabled = false; b.className = 'btn'; b.textContent = '再試一次'; } }
function cnHandlerSign() { cnBusy('cnBtn', '簽名中…'); api('consHandlerSign', { id: S.cnD.id, submit: true }).then(function (r) { cnAfter(r.status === '待審核' ? '已簽名並提交審核' : '已簽名')(); }).catch(cnErr); }
function cnSubmit() { cnBusy('cnBtn', '提交中…'); api('consSubmit', { id: S.cnD.id }).then(cnAfter('已提交審核')).catch(cnErr); }
function cnReview(dec) {
  var name = { approve: '核准', 'return': '退回補件', reject: '駁回' }[dec];
  var ask = dec === 'approve' ? '備註（選填，廠商會看到）' : name + '原因（廠商會看到）';
  var c = prompt(ask, ''); if (c === null) return;
  if (dec !== 'approve' && c.trim().length < 2) return toast('請寫原因', 'err');
  cnBusy('cnBtn', '送出中…');
  api('consReview', { id: S.cnD.id, decision: dec, comment: c.trim() }).then(cnAfter('已' + name)).catch(cnErr);
}
function cnVendors() {
  api('consVendors', {}).then(function (d) {
    var el = $('cnList'); if (!el) return;
    el.innerHTML = d.list.length ? '<div class="list">' + d.list.map(function (v) {
      return '<div class="li cs"><span class="mn"><span class="mt">' + esc(v.id + '・統編 ' + v.tax) + '</span><span class="nm">' + esc(v.name) + '</span><span class="mt">' + esc((v.contact || '') + ' ' + (v.phone || '')) +
        '・案件 ' + v.cases + (v.hold ? '（暫緩 ' + v.hold + '）' : '') + '</span>' +
        (v.commit ? '<span class="mt">' + pill('ok', 'check', '承諾書已收到 ' + (v.commitAt || '')) + ' <button class="btn ghost sm" onclick="cnCommit(' + jsq(v.id) + ',false)">實際未收到？</button></span>'
          : '<button class="btn sm" onclick="cnCommit(' + jsq(v.id) + ',true)">' + ic('check', 16, 3) + '已收到承諾書用印正本</button>') + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">還沒有廠商建檔</div>';
  }).catch(function (e) { var el = $('cnList'); if (el) el.innerHTML = errBox('讀不到廠商', e.message); });
}
function cnCommit(vid, ok) {
  var why = '';
  if (!ok) { why = prompt('為什麼實際沒收到？（該廠商進行中的案件會改為暫緩）', ''); if (why === null) return; if (why.trim().length < 2) return toast('請寫原因', 'err'); }
  else if (!confirm('確認已收到負責人簽名、公司大小章的承諾書正本？\n該廠商暫緩中的案件會自動恢復。')) return;
  api('consCommit', { vid: vid, ok: ok, comment: why.trim() }).then(function (r) { toast(ok ? '已登記' + (r.moved.length ? '，恢復 ' + r.moved.join('、') : '') : '已改為未收到' + (r.moved.length ? '，暫緩 ' + r.moved.join('、') : ''), 'ok', 4000); cnVendors(); })
    .catch(function (e) { toast(esc(e.message), 'err', 4000); });
}
