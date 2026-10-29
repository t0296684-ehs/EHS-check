// 員和環安衛系統｜問題回報＋小恩（10/27 從 plat.js 拆出：一個功能一個檔，改這裡不會動到其他功能）
// 載入順序：plat.js 之後、app.js 之前（app.js 載入時把 PLAT_PAGES 併進頁面表）。共用 plat.js／app.js／check.js 的函式（go、api、guideSecs…），只在執行時呼叫。
// 頂層只放常數與函式，不呼叫別檔的函式。新增功能模組照這個樣板：前端 <名稱>.js＋後端 mod/<名稱>.gs＋自己的後台頁＋自己的測試。

// ───────────── 問題回報（10/27 Jason：讓同仁跟環安衛直接溝通的地方；不會用、畫面卡住、資料不對都在這裡問，可附截圖）─────────────
// 一則問題＝一串對話：同仁開問題（類型＋說明＋截圖）→ 環安衛回覆（App 通知）→ 同仁可以接著回。截圖壓成長邊 1600 的 JPEG，字還看得清楚。
var SUP_CATS = ['不會操作', '畫面錯誤或卡住', '資料不對', '建議'];
var SUP_ST = { '新回報': ['warn', 'clock', '等待回覆'], '處理中': ['warn', 'clock', '處理中'], '已回覆': ['ok', 'chat', '已回覆'], '結案': ['na', 'check', '已結案'] };
var SUP_WANT = '請寫在做什麼、發生什麼事（例：按送出後一直轉圈）';
function supportCard() {
  if (S.share || !S.me) return '';                                  // 10/29：開發者模式也顯示（Jason 用它示範同仁畫面；送出時後端會擋）
  return '<div class="mcards"><button class="mcard" style="--c:#0F766E" onclick="go(\'support\')"><span class="mi">' + ic('chat', 30, 2.1) + '</span>' +
    '<span class="mx"><b>問題回報</b><small>問環安衛（可附截圖），看回覆</small></span>' + ic('chev', 20, 2.6) + '</button></div>';
}
/** 進問題回報前的操作經過（扣掉問題回報自己的畫面），讓處理的人知道他是在哪裡遇到問題 */
function supTrail() { return TRAIL.map(function (x) { return x.s; }).filter(function (s) { return !/^問題回報/.test(s); }); }
function supFrom() { var t = supTrail(), x = t.length ? t[t.length - 1].replace(/ \d\d:\d\d$/, '') : ''; return x === '主選單' ? '' : x; }
PLAT_PAGES.support = function () {
  setTitle('問題回報');
  if (!S.sup) {
    $('app').innerHTML = loading('讀取問題回報…'); bar('');
    api('supportMine', {}).then(function (r) { S.sup = r; if (S.page === 'support' || S.page === 'supportItem') render(); })
      .catch(function (e) { $('app').innerHTML = errBox('讀不到問題回報', e.message); });
    return;
  }
  guideLoad();
  var h = '';
  if (isEhs() && !S.dev) h += '<div class="mcards"><button class="mcard" style="--c:#B45309" onclick="S.supA=null;go(\'supAdmin\')"><span class="mi">' + ic('review', 30, 2.1) + '</span>' +
    '<span class="mx"><b>環安衛：全部問題回報</b><small>' + (S.sup.open ? '等待處理 ' + S.sup.open + ' 則' : '沒有等待處理的') + '・大家問小恩的紀錄</small></span>' + ic('chev', 20, 2.6) + '</button></div>';
  h += '<button class="xeask" onclick="xeOpen()">' + xeAv() + '<span><b>先問小恩</b><small>App 怎麼用、環安衛法規，常見問題點一下就有答案</small></span>' + ic('chev', 20, 2.6) + '</button>';
  h += '<div class="box info"><div class="r">' + ic('info', 22) + '<div class="bt"><div class="m">畫面跑出錯誤、資料不對，或小恩答不了的，按下方「我要問問題」直接問環安衛。<b>附上畫面截圖</b>處理得最快。</div></div></div></div>';
  var L = S.sup.list || [];
  h += L.length ? '<div class="sec">我問過的問題</div><div class="list">' + L.map(function (x) {
    var st = SUP_ST[x.status] || SUP_ST['新回報'], last = x.msgs[x.msgs.length - 1];
    return '<button class="li" onclick="go(\'supportItem\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="mt">' + esc(x.cat + '・' + x.time.slice(5).replace('-', '/')) + '</span>' +
      '<span class="nm" data-no-i18n>' + esc(x.title) + '</span>' + (last && last.staff ? '<span class="mt">環安衛回覆了</span>' : '') + '</span>' + pill(st[0], st[1], st[2]) + '</button>';
  }).join('') + '</div>' : '';
  $('app').innerHTML = h;
  supQRun();
  bar('<button class="btn" onclick="S.sn=null;go(\'supportNew\')">' + ic('plus', 22, 2.8) + '我要問問題</button>');
};
function supQRun() { var el = $('supQR'); if (el) el.innerHTML = String(S.supQ || '').trim() ? gHitsHtml(S.supQ, '教學裡沒找到，可以問小恩或直接問環安衛') : ''; }
PLAT_PAGES.supportNew = function () {
  setTitle('問題回報');
  if (!S.sn) S.sn = { cat: '', text: '', pics: [], from: supFrom(), rid: newId(), ok: false };
  var sn = S.sn;
  var h = '<div class="card ev"><span class="nl req">1. 是哪一種問題？</span><div class="chips wrap">' + SUP_CATS.map(function (c) {
    return '<button class="chip' + (sn.cat === c ? ' on' : '') + '" onclick="S.sn.cat=' + jsq(c) + ';keepY(render)">' + esc(c) + '</button>';
  }).join('') + '</div>' +
    '<label class="nl req" for="snTxt">2. 發生什麼事？</label>' +
    '<textarea id="snTxt" class="note plain" placeholder="例：填堆高機檢點表按送出後一直轉圈，等了一分鐘還是沒送出" oninput="S.sn.text=this.value;snBar();clearTimeout(S.snT);S.snT=setTimeout(snHint,350)">' + esc(sn.text) + '</textarea><div id="snHint"></div>' +
    '<div class="hint">寫清楚在做什麼、按了哪裡、出現什麼。</div>' + (sn.from ? '<div class="hint">系統會一起附上您剛剛在「' + esc(sn.from) + '」畫面。</div>' : '') +
    '<div class="hint nbad" id="snWhy" hidden></div>' +
    '<span class="nl">3. 畫面截圖（選填，最多 3 張）</span>' + supPicsHtml(sn.pics, 'snPick(this)', 'S.sn.pics') +
    '<div class="hint">截圖方法：一般手機同時按「電源鍵＋音量下」；iPhone 按「側邊鍵＋音量上」。截好後回到這裡按「＋」選照片。</div></div>' +
    '<label class="ck" id="snOkL"><input type="checkbox" id="snOk"' + (sn.ok ? ' checked' : '') + ' onchange="S.sn.ok=this.checked;snBar()"><span>我已確認上面的內容，送出給環安衛</span></label>';
  $('app').innerHTML = h;
  guideLoad(); snHint();
  snBar();
};
function supPicsHtml(pics, pick, path) {
  return '<div class="pics">' + pics.map(function (p, i) {
    return '<div class="pic"><img src="' + esc(p.t) + '" alt="截圖 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="' + path + '.splice(' + i + ',1);keepY(render)">' + ic('x', 16, 3) + '</button></div>';
  }).join('') + (pics.length < 3 ? '<label class="pic add">' + ic('plus', 26, 2.6) + '<span>加截圖</span><input type="file" accept="image/*" hidden onchange="' + pick + '"></label>' : '') + '</div>';
}
/** 截圖壓縮：長邊 1600、JPEG 0.8（字還看得清楚，約 0.2～0.5 MB）；另做 240 縮圖放畫面上。跟著送出一起送。 */
function supShrink(inp, done) {
  var file = inp.files && inp.files[0]; inp.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type || 'image/')) return toast('請選照片或截圖', 'err');
  var url = URL.createObjectURL(file), img = new Image();
  img.onerror = function () { URL.revokeObjectURL(url); toast('這張圖打不開，請換一張', 'err', 3500); };
  img.onload = function () {
    URL.revokeObjectURL(url);
    var sc = function (max, q) { var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q); };
    done({ u: sc(1600, 0.8), t: sc(240, 0.6) });
  };
  img.src = url;
}
function supAddPic(o, p) {
  if (o.pics.some(function (x) { return x.t === p.t; })) return toast('這張已經附過了', 'err');
  o.pics.push(p); keepY(render);
}
function snPick(inp) { var sn = S.sn; supShrink(inp, function (p) { if (S.sn === sn) supAddPic(sn, p); }); }
function srPick(inp) { var sr = S.sr; supShrink(inp, function (p) { if (S.sr === sr) supAddPic(sr, p); }); }
function snWhy() {
  var sn = S.sn; if (!sn) return 'x';
  if (!sn.cat) return '先選問題類型';
  if (String(sn.text || '').replace(/\s/g, '').length < 6) return '寫清楚發生什麼事（至少 6 個字）';
  if (txtWhy(sn.text, { min: 6, want: SUP_WANT })) return '問題要寫清楚才能送出';
  if (!sn.ok) return '勾選確認後就能送出';
  return '';
}
function snBar() {
  if (S.page !== 'supportNew') return;
  var w = snWhy(), n = String(S.sn.text || '').replace(/\s/g, '').length, tw = n ? txtWhy(S.sn.text, { min: 6, want: SUP_WANT }) : '';
  var el = $('snWhy'); if (el) { el.textContent = tw; el.hidden = !tw; }
  bar('<button class="btn' + (w ? ' dim' : '') + '" onclick="snSend()">' + ic('up', 22, 2.8) + esc(w || '送出問題') + '</button>');
}
function snSend() {
  var sn = S.sn, w = snWhy();
  if (w) { toast(esc(w), 'err'); var t = w.indexOf('勾選') >= 0 ? $('snOkL') : w.indexOf('類型') >= 0 ? document.querySelector('.chips') : $('snTxt'); if (t) t.scrollIntoView({ block: 'center' }); return; }
  if (!navigator.onLine) return toast('沒有網路，要連上網路才能送出', 'err', 3500);
  busyOn('送出中…');
  api('supportAdd', { cat: sn.cat, text: sn.text, pics: sn.pics.map(function (p) { return p.u; }), rid: sn.rid, page: sn.from, trail: supTrail(), appVer: APP_VERSION,
    ua: navigator.userAgent.slice(0, 120), lang: window.I18N ? I18N.lang() : 'zh' }).then(function () {
    busyOff(); S.sn = null; S.sup = null; toast('已送出，環安衛回覆後會通知您', 'ok', 3500); back();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
PLAT_PAGES.supportItem = function () {
  setTitle('問題回報');
  if (!S.sup) return PLAT_PAGES.support();
  var x = (S.sup.list || []).filter(function (y) { return y.id === S.arg.id; })[0];
  if (!x) return back();
  if (!S.sr || S.sr.id !== x.id) S.sr = { id: x.id, text: '', pics: [], rid: newId() };
  var sr = S.sr, st = SUP_ST[x.status] || SUP_ST['新回報'];
  var h = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="mt">' + esc(x.cat + '・' + x.time.replace(/-/g, '/')) + '</span>' + pill(st[0], st[1], st[2]) + '</div>' +
    '<div class="chat">' + x.msgs.map(function (m) {
      return '<div class="cm' + (m.staff ? ' st' : '') + '"><div class="cw">' + esc(m.staff ? '環安衛' : '我') + '・' + esc(m.time.slice(5).replace('-', '/')) + '</div>' +
        '<div class="cb" data-no-i18n>' + (m.staff ? supLinkify(m.text) : esc(m.text).replace(/\n/g, '<br>')) + '</div>' +
        (m.pics.length ? '<div class="cp">' + m.pics.map(function (fid, i) { return '<button class="chip" onclick="supPicView(' + jsq(fid) + ')">' + ic('img', 16, 2.4) + '截圖 ' + (i + 1) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div>' + (x.status === '新回報' || x.status === '處理中' ? '<div class="hint">環安衛會在上班日下午處理，回覆後會通知您。</div>' : '') + '</div>';
  h += '<div class="card ev"><label class="nl" for="srTxt">' + (x.status === '結案' ? '問題又出現了？可以接著說' : '還有要補充、或要回覆環安衛的？') + '</label>' +
    '<textarea id="srTxt" class="note plain" placeholder="例：照您說的重開 App 後可以了 ／ 還是一樣，截圖如下" oninput="S.sr.text=this.value;srBar()">' + esc(sr.text) + '</textarea>' +
    supPicsHtml(sr.pics, 'srPick(this)', 'S.sr.pics') + '</div>';
  $('app').innerHTML = h;
  srBar();
};
function srBar() {
  if (S.page !== 'supportItem') return;
  var n = String(S.sr.text || '').replace(/\s/g, '').length;
  bar('<button class="btn' + (n >= 2 ? '' : ' dim') + '" onclick="srSend()">' + ic('up', 22, 2.8) + (n >= 2 ? '送出' : '寫好要說的話就能送出') + '</button>');
}
function srSend() {
  var sr = S.sr;
  if (String(sr.text || '').replace(/\s/g, '').length < 2) { toast('請先寫要說的話', 'err'); var t = $('srTxt'); if (t) t.focus(); return; }
  if (!navigator.onLine) return toast('沒有網路，要連上網路才能送出', 'err', 3500);
  busyOn('送出中…');
  api('supportMsg', { id: sr.id, text: sr.text, pics: sr.pics.map(function (p) { return p.u; }), rid: sr.rid }).then(function () {
    return api('supportMine', {}).then(function (r) { busyOff(); S.sup = r; S.sr = null; toast('已送出', 'ok'); render(); });
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}
function supPicView(fid) {
  busyOn('讀取截圖…');
  api('supportPic', { fid: fid }).then(function (r) {
    busyOff();
    var d = document.createElement('div'); d.className = 'pview'; d.onclick = function () { d.remove(); };
    d.innerHTML = '<img src="' + esc(r.image) + '" alt="截圖"><span class="muted">點一下關閉</span>';
    document.body.appendChild(d);
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4000); });
}

// ───────────── 問題回報 × 使用教學（10/27 Jason：教學裡有的，要引導同仁去看或直接給內容，不要讓同仁問已經回答過的問題）─────────────
// 跟電腦端 guide_match.py 同一套算法：中文兩字一組、泰文三字一組、英文單字；越少節出現的詞越有份量，標題三倍。
var G_STOP = '什麼 怎麼 可以 沒有 一直 為什 麼辦 請問 不能 不會 我的 我要 要怎 如何 是不 不是 時候 出現 發生 按了 一下 現在 這個 那個 然後 還是 已經 我們 他們 問題 要按 哪裡 在哪 怎樣 知道 不到 找不 好像 一樣 有沒 的時 候要 了一 是什 就是 要去'.split(' ');
function gGrams(s) {
  s = String(s || '').replace(/<[^>]+>/g, '').toLowerCase();
  var o = {};
  (s.match(/[㐀-鿿]+/g) || []).forEach(function (x) { for (var i = 0; i < x.length - 1; i++) o[x.substr(i, 2)] = 1; });
  (s.match(/[฀-๿]+/g) || []).forEach(function (x) { for (var i = 0; i < x.length - 2; i++) o[x.substr(i, 3)] = 1; });
  (s.match(/[a-z0-9]{3,}/g) || []).forEach(function (x) { o[x] = 1; });
  G_STOP.forEach(function (x) { delete o[x]; });
  return o;
}
/** 使用教學讀進來（跟教學頁同一份；讀不到就算了，比對只是幫忙） */
function guideLoad() {
  if (S.guide || S.gLoading || !navigator.onLine) return;
  S.gLoading = true;
  var gl = window.I18N && I18N.lang() !== 'zh' ? I18N.lang() : '';
  var one = function (u) { return fetch(u + '?v=' + APP_VERSION, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  var gget = function (f) { return one(f).catch(function () { return one('guide/' + f); }); };
  (gl ? gget('content.' + gl + '.json').catch(function () { return gget('content.json'); }) : gget('content.json'))
    .then(function (j) { S.guide = j; S.gIdx = null; S.gLoading = false; supQRun(); snHint(); if (window.xeDraw) xeDraw(); if (S.page === 'supAdminItem') render(); })
    .catch(function () { S.gLoading = false; });
}
function gIndex() {
  if (S.gIdx) return S.gIdx;
  var docs = [];
  guideSecs().forEach(function (y) { var x = y.x; docs.push({ no: x.no, title: x.title, lead: x.lead || '', t: gGrams(x.title), b: gGrams([x.lead, x.steps.join(' '), x.tip].join(' ')) }); });
  var hf = gHide().faq || [];
  (S.guide.faq || []).forEach(function (q, k) { if (hf.indexOf(k) < 0 && (isEhs() || !/^（環安衛）/.test(q[0]))) docs.push({ no: 'faq', title: q[0], lead: q[1], t: gGrams(q[0]), b: gGrams(q[1]) }); });
  var df = {};
  docs.forEach(function (d) { Object.keys(Object.assign({}, d.t, d.b)).forEach(function (g) { df[g] = (df[g] || 0) + 1; }); });
  return (S.gIdx = { docs: docs, df: df });
}
function gMatch(q, n) {
  if (!S.guide) return [];
  var ix = gIndex(), N = ix.docs.length, qg = Object.keys(gGrams(q)), out = [];
  if (!qg.length) return [];
  ix.docs.forEach(function (d) {
    var sc = 0;
    qg.forEach(function (g) { if (d.t[g] || d.b[g]) sc += Math.log(N / ix.df[g]) * (d.t[g] ? 3 : 1); });
    if (sc >= 5) out.push([sc, d]);
  });
  out.sort(function (a, b) { return b[0] - a[0]; });
  var top = out.length ? out[0][0] : 0;
  return out.slice(0, n || 3).filter(function (x) { return x[0] >= top * 0.5; }).map(function (x) { return x[1]; });
}
/** 比對結果：教學的節＝標題＋開頭一句＋「看這一節」；常見問題＝直接把答案給他。pick＝環安衛回覆時「引用到回覆」。 */
function gHitsHtml(q, none, pick) {
  if (!S.guide) return '<div class="hint">' + (navigator.onLine ? '教學讀取中…' : '沒有網路，教學比對不到') + '</div>';
  var hit = gMatch(q);
  if (!hit.length) return none ? '<div class="hint">' + esc(none) + '</div>' : '';
  return '<div class="ghits">' + hit.map(function (d) {
    return '<div class="ghit"><b>' + (d.no === 'faq' ? '<span>常見問題</span>：' : '<span>使用教學</span> ' + esc(d.no) + '　') + esc(d.title) + '</b><p>' + esc(d.lead) + '</p>' +
      (pick ? '<button class="chip" onclick="' + pick + '(' + jsq(d.no) + ',' + jsq(d.title) + ',' + jsq(d.lead) + ')">' + ic('plus', 16, 2.6) + '引用到回覆</button>' :
        d.no !== 'faq' ? '<button class="chip" onclick="go(\'guide\',{sec:' + jsq(d.no) + '})">' + ic('book', 16, 2.4) + '看這一節（有畫面）</button>' : '') + '</div>';
  }).join('') + '</div>';
}
function snHint() {
  var el = $('snHint'); if (!el || !S.sn) return;
  var t = String(S.sn.text || '').trim();
  el.innerHTML = t.replace(/\s/g, '').length >= 4 && gMatch(t).length ? '<div class="box info gbox"><div class="m"><b>' + ic('book', 18, 2.4) + ' 使用教學可能已經有答案，先看看：</b></div>' + gHitsHtml(t) +
    '<div class="hint">看過了還是不行，再按下方送出。</div></div>' : '';
}
/** 環安衛回覆裡寫「使用教學 2-7」→ 變成按鈕，一點就打開那一節 */
function supLinkify(t) {
  var title = function (no) { var x = ''; if (S.guide) (S.guide.chapters || []).forEach(function (c) { c.sections.forEach(function (y) { if (y.no === no) x = y.title.replace(/（.*$/, ''); }); }); return x; };
  return esc(t).replace(/\n/g, '<br>').replace(/(詳見)?(使用教學|教學)\s?(\d-\d{1,2})(「[^」]*」)?/g, function (m, a, b, no) {     // 10/27 Jason：要直接給教學連結；小恩視窗裡點了先關視窗再打開那一節
    return '<button class="chip glink" onclick="if(window.xeClose)xeClose();go(\'guide\',{sec:' + jsq(no) + '})">' + ic('book', 15, 2.4) + esc((window.I18N && I18N.tr ? I18N.tr('打開教學') : '打開教學') + ' ' + no + (title(no) ? ' ' + title(no) : '')) + '</button>';
  });
}

// ───────────── 環安衛：全部問題回報（10/27 Jason：有環安衛權限的人要看得到大家問了什麼）─────────────
var SUPA_TABS = [['open', '等待處理'], ['已回覆', '已回覆'], ['結案', '結案'], ['xe', '問小恩紀錄']];
PLAT_PAGES.supAdmin = function () {
  setTitle('全部問題回報');
  var tab = S.supTab || 'open';
  if (!S.supA || S.supA.tab !== tab) {
    $('app').innerHTML = supATabs(tab) + loading('讀取中…'); bar('');
    (tab === 'xe' ? api('xeAll', {}) : api('supportAll', { st: tab })).then(function (r) { S.supA = { tab: tab, list: r.list }; if (S.page === 'supAdmin' || S.page === 'supAdminItem') render(); })
      .catch(function (e) { $('app').innerHTML = supATabs(tab) + errBox('讀不到', e.message); });
    return;
  }
  var L = S.supA.list, h = supATabs(tab);
  if (tab === 'xe') h += L.length ? '<div class="hint">同仁在 App 問小恩的問題與回答（新的在前）。回答不對的，可以找那位同仁補充說明。</div>' + L.map(function (x) {
    return '<div class="card xeq"><div class="mt">' + esc(x.time.slice(5).replace('-', '/') + '・' + x.name + (x.dept ? '（' + x.dept + '）' : '')) + (x.ok ? '' : '・沒回答') + '</div>' +
      '<div class="cb" data-no-i18n><b>問：</b>' + esc(x.q) + '</div><details><summary>看小恩的回答</summary><div class="cb" data-no-i18n>' + esc(x.a).replace(/\n/g, '<br>') + '</div></details></div>';
  }).join('') : '<div class="empty">還沒有人問過小恩</div>';
  else h += L.length ? '<div class="list">' + L.map(function (x) {
    var st = SUP_ST[x.status] || SUP_ST['新回報'];
    return '<button class="li" onclick="go(\'supAdminItem\',{id:' + jsq(x.id) + '})"><span class="mn"><span class="mt">' + esc(x.last.slice(5).replace('-', '/') + '・' + x.name + (x.dept ? '（' + x.dept.split('、')[0] + '）' : '') + '・' + x.cat) + '</span>' +
      '<span class="nm" data-no-i18n>' + esc(x.title) + '</span></span>' + pill(st[0], st[1], st[2]) + '</button>';
  }).join('') + '</div>' : '<div class="empty">' + (tab === 'open' ? '沒有等待處理的問題' : '沒有') + '</div>';
  $('app').innerHTML = h;
  bar('');
};
function supATabs(tab) {
  return '<div class="chips wrap" style="margin-bottom:10px">' + SUPA_TABS.map(function (t) {
    return '<button class="chip' + (t[0] === tab ? ' on' : '') + '" onclick="S.supTab=' + jsq(t[0]) + ';S.supA=null;render()">' + esc(t[1]) + '</button>';
  }).join('') + '</div>';
}
PLAT_PAGES.supAdminItem = function () {
  setTitle('問題回報');
  if (!S.supA) return back();
  var x = S.supA.list.filter(function (y) { return y.id === S.arg.id; })[0];
  if (!x) return back();
  guideLoad();
  if (!S.sar || S.sar.id !== x.id) S.sar = { id: x.id, text: '' };
  var st = SUP_ST[x.status] || SUP_ST['新回報'];
  var h = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b data-no-i18n>' + esc(x.name + (x.dept ? '（' + x.dept + '）' : '')) + '</b>' + pill(st[0], st[1], st[2]) + '</div>' +
    '<div class="mt">' + esc(x.cat + '・開單 ' + x.time.replace(/-/g, '/')) + '</div>' +
    '<div class="mt">在哪個畫面：' + esc(x.page || '主選單') + '</div>' + (x.trail ? '<div class="mt">前面經過：' + esc(x.trail) + '</div>' : '') +
    '<div class="mt">App ' + esc(x.ver || '?') + '・語言 ' + esc(x.lang || 'zh') + '・' + esc(/iPhone|iPad/.test(x.ua) ? 'iPhone' : /Android/.test(x.ua) ? '安卓' : '電腦') + '</div>' +
    (x.note ? '<div class="mt">處理紀錄：' + esc(x.note).replace(/\n/g, '／') + '</div>' : '') +
    '<div class="chat">' + x.msgs.map(function (m) {
      return '<div class="cm' + (m.staff ? ' st' : '') + '"><div class="cw">' + esc(m.staff ? '環安衛' : x.name) + '・' + esc(m.time.slice(5).replace('-', '/')) + '</div>' +
        '<div class="cb" data-no-i18n>' + (m.staff ? supLinkify(m.text) : esc(m.text).replace(/\n/g, '<br>')) + '</div>' +
        (m.pics.length ? '<div class="cp">' + m.pics.map(function (fid, i) { return '<button class="chip" onclick="supPicView(' + jsq(fid) + ')">' + ic('img', 16, 2.4) + '截圖 ' + (i + 1) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
  var q = x.msgs.filter(function (m) { return !m.staff; }).map(function (m) { return m.text; }).join(' ');
  var gh = S.guide ? gHitsHtml(q, '', 'sarCite') : '';
  if (gh) h += '<div class="card"><span class="nl">' + ic('book', 18, 2.4) + ' 使用教學裡相關的節</span><div class="hint">教學已經寫了的，回覆時引用，同仁點一下就能看那一節。</div>' + gh + '</div>';
  h += '<div class="card ev"><label class="nl" for="sarTxt">回覆（以「環安衛中心」署名，同仁會收到通知）</label>' +
    '<textarea id="sarTxt" class="note plain" placeholder="用同仁看得懂的話回覆；外籍同仁請用英文或泰文" oninput="S.sar.text=this.value;sarBar()">' + esc(S.sar.text) + '</textarea></div>';
  $('app').innerHTML = h;
  sarBar();
};
function sarCite(no, title, lead) {
  var t = (no === 'faq' ? '常見問題「' + title + '」：' + lead : lead + '\n詳見使用教學 ' + no + '「' + title + '」');
  S.sar.text = (S.sar.text ? S.sar.text.replace(/\s+$/, '') + '\n' : '') + t;
  var el = $('sarTxt'); if (el) { el.value = S.sar.text; el.focus(); }
  sarBar();
}
function sarBar() {
  if (S.page !== 'supAdminItem') return;
  var n = String(S.sar.text || '').replace(/\s/g, '').length;
  bar('<div class="btns r12"><button class="btn ghost" onclick="sarSend(\'\')">只回覆（等他回）</button>' +
    '<button class="btn" onclick="sarSend(\'結案\')">' + ic('up', 22, 2.8) + (n >= 2 ? '回覆並結案' : '直接結案') + '</button></div>');
}
function sarSend(st) {
  var s = S.sar, n = String(s.text || '').replace(/\s/g, '').length;
  if (!st && n < 2) { toast('請先寫回覆', 'err'); var t = $('sarTxt'); if (t) t.focus(); return; }
  busyOn('送出中…');
  api('supportReply', { id: s.id, reply: n >= 2 ? s.text : '', status: st }).then(function () {
    busyOff(); S.sar = null; S.supA = null; S.sup = null; toast(st ? '已結案' : '已回覆，同仁會收到通知', 'ok', 3000); back();
  }).catch(function (e) { busyOff(); toast(esc(e.message), 'err', 4500); });
}

// ───────────── 小恩：右下角小視窗（10/27 Jason：App 操作、法規問題都在同一個地方問，像網頁上的 AI 助理；問不到再轉給環安衛）─────────────
// 順序：常見問題、這個畫面相關的教學點了馬上有答案（不經 AI）→ 打字問小恩（App 帶使用教學節錄，小恩依教學或法規回答）→ 還是不行「轉給環安衛」（帶問題進問題回報，可附截圖）。
// 小恩在 Render：先跟後端拿通行證（10 分鐘）再直接問，手機上沒有金鑰；問答記到後台「小恩問答」。對話留在這支手機（最近 40 句）。
var XE_LS = 'chk.xe';
function xeAv(c) { return '<span class="xeav' + (c ? ' ' + c : '') + '"><img src="xiaoen.jpg?v=' + APP_VERSION + '" alt=""></span>'; }   // 小恩大頭照（跟 LINE 同一張）
function xeL(t) { return window.I18N && I18N.tr ? I18N.tr(t) : t; }     // 對話泡泡不經自動翻譯（data-no-i18n），固定字自己翻
function xeOk() { return !!(S.me && S.me.signature && S.me.signature.imageV) && !S.share && !S.cpub && !S.meet && ['login', 'sign', 'url'].indexOf(S.cur) < 0; }
function xeFab() {
  var f = $('xefab');
  if (!f) {
    f = document.createElement('button'); f.id = 'xefab'; f.className = 'xefab'; f.setAttribute('aria-label', '問小恩');
    f.innerHTML = '' + xeAv() + '<b>問小恩</b>'; f.onclick = function () { xeOpen(); };
    document.body.appendChild(f);
  }
  f.hidden = !xeOk() || !!$('xepanel');
}
function xeSt() {
  var me = (S.me && S.me.person && S.me.person.name) || '';
  if (!S.xc || S.xc.me !== me) {
    var m = []; try { m = (JSON.parse(localStorage.getItem(XE_LS) || '{}')[me] || []); } catch (e) { m = []; }
    S.xc = { me: me, msgs: m, busy: false };
  }
  return S.xc;
}
function xeSave() { var x = S.xc; if (!x || S.dev) return; try { var o = {}; o[x.me] = x.msgs.slice(-40); localStorage.setItem(XE_LS, JSON.stringify(o)); } catch (e) {} }
function xePage() { return PAGE_NAME[S.cur] || '主選單'; }
function xeOpen(q) {
  if (!$('xepanel')) {
    guideLoad();
    var d = document.createElement('div'); d.id = 'xepanel'; d.className = 'xepanel'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '小恩');
    d.innerHTML = '<div class="xehd">' + xeAv() + '<div class="xet"><b>小恩・環安衛助理</b><small>App 怎麼用、環安衛法規都可以問</small></div>' +
      '<button class="xex" aria-label="關閉" onclick="xeClose()">' + ic('x', 22, 2.6) + '</button></div>' +
      '<div class="xebody" id="xebody"></div><div class="xesug" id="xesug"></div>' +
      '<div class="xein"><textarea id="xeq" rows="1" maxlength="500" placeholder="打字問小恩，例：月結怎麼送？" oninput="xeType()" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey&&!event.isComposing){event.preventDefault();xeAsk();}"></textarea>' +
      '<button class="xesend" aria-label="送出" onclick="xeAsk()">' + ic('up', 22, 2.8) + '</button></div>';
    document.body.appendChild(d); document.body.classList.add('xeopen');
    xeSt().page = xePage();
    xeWarm();
  }
  xeFab(); xeDraw();
  if (q) { $('xeq').value = q; xeType(); }
}
function xeClose() { var d = $('xepanel'); if (d) d.remove(); document.body.classList.remove('xeopen'); xeFab(); }
function xeTxt(t) { return supLinkify(String(t || '')); }
/** 一節教學變成小恩的回答：開頭一句＋步驟＋提醒（不經 AI，馬上有） */
function xeSecText(d) {
  var x = null; guideSecs().forEach(function (y) { if (y.x.no === d.no) x = y.x; });
  if (!x) return d.lead;
  var hs = (gHide().steps || {})[x.no] || [];
  return [x.lead].concat(x.steps.filter(function (s, k) { return hs.indexOf(k) < 0; }).map(function (s, k) { return (k + 1) + '. ' + s.replace(/<[^>]+>/g, ''); }))
    .concat(x.tip ? [xeL('提醒：') + x.tip] : []).join('\n');
}
function xeFaqs() {
  if (!S.guide) return [];
  var hf = gHide().faq || [];
  return (S.guide.faq || []).map(function (q, k) { return { k: k, q: q[0], a: q[1] }; }).filter(function (o) { return hf.indexOf(o.k) < 0 && (isEhs() || !/^（環安衛）/.test(o.q)); });
}
function xeHello() {
  var x = xeSt(), p = plat() || {}, here = S.guide && x.page !== '主選單' ? gMatch(x.page, 2).filter(function (d) { return d.no !== 'faq'; }) : [];
  var h = '<div class="cm st"><div class="cw">' + xeAv('mini') + '小恩</div><div class="cb">您好，我是小恩 👋 App 怎麼用、環安衛法規都可以問我。先看看大家常問的，點一下就有答案：</div>';
  h += '<div class="xechips">' + here.map(function (d) { return '<button class="chip" onclick="xePick(' + jsq(d.no) + ')">' + ic('book', 15, 2.4) + esc(d.title.replace(/（.*$/, '')) + '怎麼用</button>'; }).join('') +
    xeFaqs().slice(0, 6).map(function (o) { return '<button class="chip" onclick="xeFaq(' + o.k + ')">' + esc(o.q) + '</button>'; }).join('') +
    (S.guide ? '<button class="chip" onclick="xeClose();go(\'guide\',{sec:\'faq\'})">更多常見問題</button>' : '<span class="hint">讀取常見問題中…</span>') + '</div>';
  h += '<div class="xelinks"><button class="chip" onclick="xeClose();S.sup=null;go(\'support\')">' + ic('chat', 15, 2.4) + '我問過環安衛的問題</button>' +
    (p.xeLine ? '<a class="chip" href="' + esc(p.xeLine) + '" target="_blank" rel="noopener">' + ic('ext', 15, 2.4) + '加小恩 LINE 好友</a>' : '') + '</div></div>';
  return h;
}
function xeDraw() {
  var b = $('xebody'); if (!b) return;
  var x = xeSt();
  b.innerHTML = xeHello() + x.msgs.map(function (m, i) {
    if (m.me) return '<div class="cm"><div class="cw">我</div><div class="cb" data-no-i18n>' + esc(m.t).replace(/\n/g, '<br>') + '</div></div>';
    return '<div class="cm st"><div class="cw">' + xeAv('mini') + '小恩</div><div class="cb" data-no-i18n>' + xeTxt(m.t) + '</div>' +
      ((m.hits || []).length ? '<div class="xechips">' + m.hits.map(function (h) { return '<button class="chip" data-no-i18n onclick="xeClose();go(\'guide\',{sec:' + jsq(h.no) + '})">' + ic('book', 15, 2.4) + esc(xeL('打開教學') + ' ' + h.no + ' ' + String(h.title || '').replace(/（.*$/, '')) + '</button>'; }).join('') + '</div>' : '') +
      (m.q ? '<div class="xechips"><button class="chip" onclick="xeHand(' + i + ')">' + ic('chat', 15, 2.4) + '還是不行，轉給環安衛</button></div>' : '') + '</div>';
  }).join('') + (x.busy ? '<div class="cm st"><div class="cw">' + xeAv('mini') + '小恩</div><div class="cb"><span class="dots"><i></i><i></i><i></i></span></div></div>' : '');
  b.scrollTop = b.scrollHeight;
  var q = $('xeq'); if (q) q.disabled = x.busy;
}
/** 打字時：教學裡相關的節先列出來，點了馬上有答案 */
function xeType() {
  var q = $('xeq'), el = $('xesug'); if (!q || !el) return;
  q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 120) + 'px';
  clearTimeout(S.xeT2);
  S.xeT2 = setTimeout(function () {
    var t = q.value.trim(), hit = t.replace(/\s/g, '').length >= 2 ? gMatch(t) : [];
    el.innerHTML = hit.length ? '<span class="hint">教學裡可能有：</span>' + hit.map(function (d) {
      return '<button class="chip" onclick="' + (d.no === 'faq' ? 'xeFaqT(' + jsq(d.title) + ')' : 'xePick(' + jsq(d.no) + ')') + '">' + ic('book', 15, 2.4) + esc(d.title) + '</button>';
    }).join('') : '';
  }, 250);
}
function xePush(m) { var x = xeSt(); x.msgs.push(m); xeSave(); xeDraw(); }
function xeClearIn() { var q = $('xeq'); if (q) { q.value = ''; q.style.height = 'auto'; } var el = $('xesug'); if (el) el.innerHTML = ''; }
function xeFaq(k) { var o = xeFaqs().filter(function (f) { return f.k === k; })[0]; if (!o) return; xePush({ me: 1, t: o.q }); xePush({ t: o.a, q: o.q }); }
function xeFaqT(title) { var o = xeFaqs().filter(function (f) { return f.q === title; })[0]; if (o) { xeClearIn(); xeFaq(o.k); } }
function xePick(no) {
  var d = null; guideSecs().forEach(function (y) { if (y.x.no === no) d = { no: no, title: y.x.title, lead: y.x.lead }; });
  if (!d) return;
  xeClearIn();
  xePush({ me: 1, t: d.title + xeL('怎麼做？') });
  xePush({ t: xeSecText(d), hits: [d], q: d.title });
}
/** 打字問：小恩（帶教學節錄）→ 回答；小恩沒開或連不上，就給教學裡找得到的 */
function xeAsk() {
  var x = xeSt(), qel = $('xeq'), q = qel ? qel.value.trim() : '';
  if (x.busy) return;
  if (q.replace(/\s/g, '').length < 2) { if (qel) qel.focus(); return; }
  xeClearIn();
  x.msgs.push({ me: 1, t: q }); x.busy = true; xeSave(); xeDraw();
  var hits = gMatch(q), secs = hits.filter(function (d) { return d.no !== 'faq'; });
  var local = function (why) {
    x.busy = false;
    why = why ? xeL(why) + '\n' : '';
    xePush(secs.length ? { t: why + xeL('使用教學裡這幾節可能有答案：'), hits: secs, q: q } : { t: why + xeL('可以按下方「轉給環安衛」，附上畫面截圖，環安衛會回覆您。'), q: q });
  };
  if (!((plat() || {}).xe) || S.dev) return local('');
  if (!navigator.onLine) return local('現在沒有網路，小恩連不上。');
  var guide = hits.map(function (d) { return d.no === 'faq' ? { no: '常見問題', title: d.title, text: d.lead } : { no: d.no, title: d.title, text: xeSecText(d) }; });
  var ask = function (k) {
    var ctl = window.AbortController ? new AbortController() : null, tm = ctl && setTimeout(function () { ctl.abort(); }, 60000);
    return fetch(k.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ t: k.t, text: q, page: x.page || xePage(), guide: guide, lang: window.I18N ? I18N.lang() : 'zh' }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (tm) clearTimeout(tm); return r.json().then(function (j) { j.status = r.status; return j; }); });
  };
  xeTicket().then(ask).then(function (j) { if (j.status === 401 && j.expired) { S.xeT = null; return xeTicket().then(ask); } return j; }).then(function (j) {
    if (!j.reply) throw new Error('x');
    x.busy = false;
    xePush({ t: String(j.reply), hits: secs.filter(function (d) { return String(j.reply).indexOf(d.no) < 0; }).slice(0, 2), q: q });
    api('xeLog', { q: q, a: String(j.reply), ok: !!j.ok }, { quiet: true, noRetry: true }).catch(function () {});
  }).catch(function () { local('小恩現在連不上。'); });
}
/** 轉給環安衛：帶著問題進問題回報（可附截圖） */
function xeHand(i) {
  var m = xeSt().msgs[i], q = m && m.q ? m.q : '';
  xeClose();
  S.sn = { cat: '不會操作', text: q, pics: [], from: xeSt().page === '主選單' ? '' : xeSt().page, rid: newId(), ok: false };
  go('supportNew');
}
function xeTicket() {
  if (S.xeT && S.xeT.until > Date.now()) return Promise.resolve(S.xeT);
  return api('xeTicket', {}, { quiet: true }).then(function (r) { S.xeT = { url: r.url, t: r.t, until: Date.now() + 8 * 60000 }; return S.xeT; });
}
/** 打開小視窗就先叫醒小恩（Render 閒置會睡著），同仁看常見問題、打字的時間剛好用來等它醒 */
function xeWarm() {
  if (S.xeWarm || S.dev || !navigator.onLine || !((plat() || {}).xe)) return;
  S.xeWarm = true;
  xeTicket().then(function (k) { fetch(k.url.replace(/\/app\/ask$/, '/'), { mode: 'no-cors' }).catch(function () {}); }).catch(function () { S.xeWarm = false; });
}


// ───────────── 小恩助理團隊・交辦（10/28 Jason：離開公司也能交辦、看 Claude 做到哪；只開給他本人，後端也擋）─────────────
// 交辦存到後台 → 公司電腦每 45 秒來拿、在電腦上做 → 進度與結果寫回來。寄信、部署這類對外動作停在「等確認」，按確認電腦才做。
var AGT_ST = { '排隊': ['warn', 'clock', '排隊中'], '進行中': ['warn', 'clock', '做事中'], '等確認': ['warn', 'bell', '等您確認'], '完成': ['ok', 'check', '做完了'], '沒做成': ['ng', 'warn', '沒做成'], '已取消': ['na', '', '已取消'] };
// 常用交辦（10/28 Jason：不要只給一個空白框，常用的放旁邊按一下就好）
var AGT_QUICK = [
  ['今天的 Outlook', '看我今天 Outlook 收件匣的信，挑出要我處理或回覆的，依急的排，每封一句話說要做什麼；廣告、電子報、系統自動通知略過。'],
  ['Gmail 新信', '看我 Gmail 最近一天的新信，挑出需要我處理的，每封一句話說要做什麼；廣告略過。'],
  ['今天先做什麼', '照環安衛工作總表和最新的工作日誌，告訴我今天最該先做的 3 件事，每件寫下一步，能直接幫我做的就說你可以接手。'],
  ['到期提醒', '列出工作總表逾期和 7 天內到期的事、這個月例行還沒做的、SDS 這個月到期的，各寫一句下一步。'],
  ['處理問題回報', '處理員和環安衛系統的問題回報（照問題回報客服的做法），處理完白話回報給我。'],
  ['承攬商案件', '看員和環安衛系統的承攬商施工案件：哪些在等我審核或簽名、哪些在施工期間、核准文件有沒有都產好存好，白話列給我。'],
  ['日報草稿', '把今天已執行的事、明天預計、等我決定的，整理成今天的日報草稿給我看，先不要寄。']
];
function agentOwner() { return isEhs() && !S.dev && !S.share && S.me && S.me.person && S.me.person.name === '楊坤庭'; }
function agentCard() {
  if (!agentOwner()) return '';
  return '<div class="mcards"><button class="mcard" style="--c:#E58A00" onclick="S.agt=null;go(\'agent\')"><span class="mi">' + xeAv() + '</span>' +
    '<span class="mx"><b>小恩助理團隊</b><small>交辦給 Claude、看做到哪（只有您看得到）</small></span>' + ic('chev', 20, 2.6) + '</button></div>';
}
function agtLoad() {
  return api('agentHome', {}).then(function (r) { S.agt = r; if (S.page === 'agent') render(); })
    .catch(function (e) { if (S.page === 'agent') $('app').innerHTML = errBox('讀不到交辦', e.message); });
}
/** 公司電腦多久沒來拿：超過 3 分鐘就提醒（可能關機、登出或沒網路），交辦會先排著。 */
function agtPc(r) {
  if (!r.beat) return '<div class="box warn"><div class="r">' + ic('warn', 22) + '<div class="bt"><div class="m">公司電腦還沒連上過。電腦要開著、登入，桌面的小恩助理在跑才會接到交辦。</div></div></div></div>';
  var gap = Math.round((new Date(r.now.replace(' ', 'T')) - new Date(r.beat.replace(' ', 'T'))) / 60000);
  if (gap > 3) return '<div class="box warn"><div class="r">' + ic('wifioff', 22) + '<div class="bt"><div class="m">公司電腦 ' + gap + ' 分鐘沒連線（最後 ' + esc(r.beat.slice(5, 16)) + '）。交辦會先排著，電腦開機後才做。</div></div></div></div>';
  return '<div class="mt agpc">公司電腦在線（' + esc(r.beat.slice(11, 16)) + ' 連線）・每 45 秒接一次</div>';
}
function agtFmt(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '$1').replace(/^#+\s*/gm, '').replace(/\n/g, '<br>');
}
function agtJob(x) {
  var st = AGT_ST[x.status] || AGT_ST['排隊'], h = '<div class="agj"><div class="agh"><span class="mt">' + esc(x.time.slice(5).replace('-', '/')) + (x.src === 'App' ? '' : '・電腦') + '</span>' + pill(st[0], st[1], st[2]) + '</div>';
  h += '<div class="agq" data-no-i18n>' + esc(x.ask) + '</div>';
  if (x.status === '進行中' && x.steps.length) h += '<ul class="ags">' + x.steps.slice(-5).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
  if (x.result) {
    var r = x.result, i = r.indexOf('【需要您確認】'), need = '';
    if (i < 0) i = r.indexOf('【需要您決定】');
    if (i >= 0) { need = r.slice(i); r = r.slice(0, i); }
    h += '<div class="agr" data-no-i18n>' + agtFmt(r.trim()) + '</div>' + (need ? '<div class="agn" data-no-i18n>' + agtFmt(need) + '</div>' : '');
  }
  if (x.status === '等確認' && !x.confirm) h += '<div class="agb"><button class="btn" onclick="agtConfirm(' + jsq(x.id) + ',true)">確認執行</button><button class="btn ghost" onclick="agtConfirm(' + jsq(x.id) + ',false)">先不要</button></div>';
  if (x.status === '等確認' && x.confirm === '確認') h += '<div class="mt">已確認，等公司電腦接手…</div>';
  if (['完成', '沒做成', '等確認'].indexOf(x.status) >= 0) h += '<button class="lnk" onclick="agtFollow(' + jsq(x.id) + ')">補充或追問這件</button>';
  return h + '</div>';
}
PLAT_PAGES.agent = function () {
  setTitle('小恩助理團隊');
  if (!agentOwner()) { $('app').innerHTML = errBox('這個功能只開給環安衛主管本人', ''); bar(''); return; }
  if (!S.agt) { $('app').innerHTML = loading('讀取交辦…'); bar(''); agtLoad(); return; }
  var r = S.agt, L = r.list || [], f = S.agtF ? L.filter(function (x) { return x.id === S.agtF; })[0] : null;
  var h = agtPc(r);
  h += '<div class="agin">' + (f ? '<div class="mt">追問：' + esc(f.ask.slice(0, 40)) + ' <button class="lnk" onclick="S.agtF=null;render()">取消</button></div>' : '') +
    '<textarea id="agtT" rows="3" placeholder="' + (f ? '要補充或追問什麼' : '交辦什麼事？例：看我今天的 Outlook 有沒有要處理的、把 ENV-13 原料資料整理好') + '">' + esc(S.agtD || '') + '</textarea>' +
    '<div class="mt">對外的事（寄信、部署、送件）會先停下來等您按確認。</div></div>';
  if (!f) h += '<div class="sec">常用</div><div class="agk">' + AGT_QUICK.map(function (q, i) { return '<button class="chip" onclick="agtQuick(' + i + ')">' + esc(q[0]) + '</button>'; }).join('') + '</div>';
  h += L.length ? '<div class="sec">交辦紀錄</div>' + L.map(agtJob).join('') : '<div class="mt agpc">還沒有交辦過。</div>';
  $('app').innerHTML = h;
  var t = $('agtT'); if (t) t.oninput = function () { S.agtD = t.value; };
  bar('<button class="btn" onclick="agtAsk()">' + ic('chat', 22, 2.4) + '交辦</button><button class="btn ghost" onclick="S.agt=null;render()">' + ic('refresh', 22, 2.4) + '重新整理</button>');
  clearTimeout(S.agtTm);                                   // 停在這頁時每 15 秒更新一次進度（正在打字就不重畫）
  S.agtTm = setTimeout(function () { if (S.page === 'agent' && !(document.activeElement && document.activeElement.id === 'agtT')) agtLoad(); }, 15000);
};
function agtQuick(i) {
  var q = AGT_QUICK[i]; if (!q || !confirm('交辦「' + q[0] + '」？')) return;
  S.agtD = q[1]; S.agtF = null; render(); agtAsk();
}
function agtFollow(id) { S.agtF = id; render(); var t = $('agtT'); if (t) t.focus(); }
function agtAsk() {
  var t = (($('agtT') || {}).value || '').trim();
  if (t.length < 2) return toast('請寫要交辦的事', 'warn');
  if (S.agtBusy) return;
  S.agtBusy = true; S.agtRid = S.agtRid || ('A' + Date.now().toString(36)); S.agtD = t;   // 送不出去時輸入的字留著（S.agtD），不用重打
  busyOn('交辦中…');
  api('agentAsk', { text: t, parent: S.agtF || '', rid: S.agtRid }).then(function () {
    busyOff(); S.agtBusy = false; S.agtRid = null; S.agtD = ''; S.agtF = null; toast('交辦了，公司電腦接到就開始做', 'ok'); agtLoad();
  }).catch(function (e) { busyOff(); S.agtBusy = false; toast(e.message, 'warn'); });
}
function agtConfirm(id, yes) {
  if (yes && !confirm('確定讓 Claude 執行這一項對外動作？')) return;
  if (S.agtBusy) return;
  S.agtBusy = true; busyOn(yes ? '確認中…' : '取消中…');
  api('agentConfirm', { id: id, yes: !!yes }).then(function () { busyOff(); S.agtBusy = false; toast(yes ? '已確認，電腦接手後執行' : '好，這件不做了', 'ok'); agtLoad(); })
    .catch(function (e) { busyOff(); S.agtBusy = false; toast(e.message, 'warn'); agtLoad(); });
}
