var OV_AT = 0;

function ovOpenGet() {
 try {
  return JSON.parse(localStorage.getItem("chk_ov_open") || "{}");
 } catch (e) {
  return {};
 }
}

function ovOpenSet(o) {
 try {
  localStorage.setItem("chk_ov_open", JSON.stringify(o));
 } catch (e) {}
}

function ovLoad(force) {
 if (!force && (S.ovBusy || Date.now() - OV_AT < 6e4)) return;
 S.ovBusy = true;
 api("overview", {}, {
  quiet: true
 }).then((function(r) {
  S.ov = r;
  S.ovErr = false;
  OV_AT = Date.now();
  S.ovBusy = false;
  if (S.page === "home") render();
 })).catch((function() {
  S.ovBusy = false;
  S.ovErr = true;
  OV_AT = Date.now();
  if (S.page === "home") render();
 }));
}

function ovSum(d) {
 var c = {
  done: 0,
  nowork: 0,
  todo: 0,
  ng: 0,
  n: d.forms.length
 };
 d.forms.forEach((function(x) {
  c[x.state]++;
  if (x.ng) c.ng++;
 }));
 return c;
}

function overviewHtml() {
 ovLoad(false);
 var ov = S.ov, t = today();
 if (!ov && S.ovErr) {
  var lastP = function() {
   var d = nowD();
   d.setDate(1);
   d.setMonth(d.getMonth() - 1);
   return ymd(d).slice(0, 7);
  }();
  var ms = (S.me.months || []).filter((function(x) {
   return x.period >= lastP || x.status !== "已歸檔";
  })).sort((function(x, y) {
   return x.period < y.period ? 1 : x.period > y.period ? -1 : x.dept < y.dept ? -1 : 1;
  }));
  return ms.length ? '<div class="sec">各部門月結進度<small>連上網路後顯示各課今天的檢點</small></div><div class="list">' + ms.map(monthRow).join("") + "</div>" : "";
 }
 if (!ov) return '<div class="sec">各課執行狀況</div>' + loading("讀取各課今天的檢點…");
 var open = ovOpenGet(), many = ov.depts.length > 3;
 var isOpenOf = function(id) {
  return id in open ? open[id] : !many;
 };
 var rank = function(d) {
  var c = ovSum(d);
  return c.ng ? 0 : c.todo ? 1 : d.unconf ? 2 : 3;
 };
 var list = ov.depts.slice().sort((function(a, b) {
  return rank(a) - rank(b) || (a.id < b.id ? -1 : 1);
 }));
 var tot = {
  ok: 0,
  todo: 0,
  ng: 0
 };
 list.forEach((function(d) {
  var c = ovSum(d);
  if (c.ng) tot.ng++;
  if (c.todo) tot.todo++; else if (c.n) tot.ok++;
 }));
 var h = '<div class="sec">各課執行狀況<small>' + md(t) + "（" + wk(t) + "）・" + (ov.today === t ? "" : "更新中・") + '<button class="lnk" onclick="ovAll()">' + (ov.depts.some((function(d) {
  return isOpenOf(d.id);
 })) ? "全部收合" : "全部展開") + "</button></small></div>";
 if (list.length > 1) h += '<div class="ovsum">' + list.length + " 個課：" + [ tot.ok ? "今日完成 " + tot.ok : "", tot.todo ? "未完成 " + tot.todo : "", tot.ng ? '<b class="ngt">有異常 ' + tot.ng + "</b>" : "" ].filter(String).join("・") + "</div>";
 var card = function(d, inG) {
  var c = ovSum(d), isOpen = isOpenOf(d.id);
  var pv = d.months[0], cur = d.months[1];
  var line = c.n ? "已檢點 " + c.done + "/" + c.n + (c.nowork ? "・無作業 " + c.nowork : "") : "沒有在用的每日表";
  if (d.unconf) line += "・待確認 " + d.unconf;
  var mline = pv.status !== "已歸檔" ? ymLabel(pv.period) + "：" + pv.status : "";
  var pl = c.ng ? pill("ng", "warn", "異常 " + c.ng) : c.todo ? pill("warn", "clock", c.todo + " 張未檢點") : c.n ? pill("ok", "check", "今日完成") : "";
  var x = '<div class="ov' + (isOpen ? " open" : "") + '"><button class="ovh" onclick="ovToggle(' + jsq(d.id) + ')" aria-expanded="' + isOpen + '">' + '<span class="chv">' + ic("chev", 18, 2.6) + '</span><span class="mn"><span class="nm">' + esc(inG ? d.label || d.id : d.id) + '</span><span class="mt">' + esc(line) + "</span>" + (mline ? '<span class="mt' + (pv.status === "退回" ? " wn" : "") + '">' + esc(mline) + "</span>" : "") + "</span>" + pl + "</button>";
  if (isOpen) {
   x += '<div class="ovb">' + (d.forms.length ? d.forms.map((function(f) {
    var a = (S.me.assigns || []).filter((function(y) {
     return y.daily && y.dept === d.id && y.form === f.form;
    }))[0];
    var st = f.state === "done" ? f.ng ? pill("ng", "warn", "異常") : pill("ok", "check", "已檢點") : f.state === "nowork" ? pill("na", "minus", "無作業") : pill("warn", "clock", "未檢點");
    var meta = (f.signer ? f.signer + " 已檢點" : "負責：" + (f.who.join("、") || "—")) + "・本月已填 " + f.filled + " 天";
    var inner = '<span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + esc(meta) + "</span></span>" + st;
    return a && !isEhs() ? '<button class="li" onclick="openFill(' + jsq(a.key) + ')">' + inner + "</button>" : '<div class="li">' + inner + "</div>";
   })).join("") : '<div class="li"><span class="mn"><span class="mt">這個課目前沒有在用的每日表</span></span></div>') + (S.me.months || []).filter((function(y) {
    return y.dept === d.id;
   })).sort((function(a2, b2) {
    return a2.period < b2.period ? 1 : -1;
   })).map(monthRow).join("") + "</div>";
  }
  return x + "</div>";
 };
 var gN = {};
 list.forEach((function(d) {
  if (d.g) gN[d.g] = (gN[d.g] || 0) + 1;
 }));
 var seen = {};
 h += '<div class="ovs">' + list.map((function(d) {
  if (!d.g || gN[d.g] < 2) return card(d, false);
  if (seen[d.g]) return "";
  seen[d.g] = 1;
  var mem = list.filter((function(y) {
   return y.g === d.g;
  })), gid = "g:" + d.g, gOpen = gid in open ? open[gid] : false;
  var s2 = {
   n: 0,
   done: 0,
   todo: 0,
   ng: 0,
   back: 0
  };
  mem.forEach((function(y) {
   var c = ovSum(y);
   s2.n += c.n;
   s2.done += c.done;
   if (c.todo) s2.todo++;
   if (c.ng) s2.ng++;
   if (y.months[0].status === "退回") s2.back++;
  }));
  var gl = mem.length + " 課・已檢點 " + s2.done + "/" + s2.n + (s2.back ? "・退回 " + s2.back : "");
  var gp = s2.ng ? pill("ng", "warn", s2.ng + " 課異常") : s2.todo ? pill("warn", "clock", s2.todo + " 課未完成") : s2.n ? pill("ok", "check", "今日完成") : "";
  return '<div class="ov' + (gOpen ? " open" : "") + '"><button class="ovh" onclick="ovToggle(' + jsq(gid) + ')" aria-expanded="' + gOpen + '">' + '<span class="chv">' + ic("chev", 18, 2.6) + '</span><span class="mn"><span class="nm">' + esc(d.g) + '</span><span class="mt">' + esc(gl) + "</span></span>" + gp + "</button>" + (gOpen ? '<div class="ovg">' + mem.map((function(y) {
   return card(y, true);
  })).join("") + "</div>" : "") + "</div>";
 })).join("") + "</div>";
 return h;
}

function ovToggle(id) {
 var o = ovOpenGet(), many = S.ov && S.ov.depts.length > 3;
 o[id] = !(id in o ? o[id] : !many);
 ovOpenSet(o);
 render();
}

function ovAll() {
 var o = ovOpenGet(), ds = S.ov ? S.ov.depts : [], many = ds.length > 3, n = {};
 var anyOpen = ds.some((function(d) {
  return d.id in o ? o[d.id] : !many;
 }));
 ds.forEach((function(d) {
  n[d.id] = !anyOpen;
  if (d.g) n["g:" + d.g] = !anyOpen;
 }));
 ovOpenSet(n);
 render();
}

function monthRow(x) {
 if (x.crew) return crewRow(x);
 return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '"><span class="mn"><span class="nm">' + esc(x.dept) + '　<span class="nw">' + ymLabel(x.period) + "</span></span>" + (x.status === "填寫中" ? '<span class="mt">查看紀錄、鎖定送審</span>' : x.status === "退回" && x.reason ? '<span class="mt wn">' + esc("退回：" + x.reason) + "</span>" : "") + "</span>" + statusPill(x.status) + "</button>";
}

var REVIEWABLE = [ "待主管審核", "待環安衛審核", "已歸檔" ];

function crewRow(x) {
 var crew = (x.crew || []).map((function(c) {
  return c.name + " " + c.days + " 天" + (c.status ? "・" + c.status : "");
 })).join("、") || "名單沒有檢點人員";
 var sub = x.status === "待主管審核" ? (x.submitter || "") + " " + (x.submittedAt || "").slice(5) + " 送審" : x.status === "退回" ? "退回修正中" + (x.reason ? "：" + x.reason : "") : x.status === "填寫中" ? "尚未送審" : "";
 var head = '<span class="mn"><span class="nm">' + esc(x.dept) + '　<span class="nw">' + ymLabel(x.period) + '</span></span><span class="mt">' + esc(crew) + "</span>" + (sub ? '<span class="mt' + (x.status === "退回" ? " wn" : "") + '">' + esc(sub) + "</span>" : "") + "</span>";
 if (REVIEWABLE.indexOf(x.status) < 0 && !(x.crew || []).some((function(c) {
  return c.monthId;
 }))) return '<div class="li off" aria-disabled="true">' + head + statusPill(x.status) + "</div>";
 return '<button class="li" onclick="' + goMonth(x.dept, x.period) + '">' + head + statusPill(x.status) + "</button>";
}

PAGES.months = function() {
 setTitle("月結紀錄");
 var ms = (S.me.months || []).slice().sort((function(x, y) {
  return x.period < y.period ? 1 : x.period > y.period ? -1 : x.dept < y.dept ? -1 : 1;
 }));
 $("app").innerHTML = ms.length ? '<div class="list">' + ms.map(monthRow).join("") + "</div>" : '<div class="empty">還沒有月結紀錄</div>';
};

PAGES.pick = function() {
 setTitle("其他檢查表");
 var dept = S.arg.dept;
 var list = S.me.assigns.filter((function(a) {
  return a.dept === dept && (a.pick || a.missingEquip);
 }));
 var h = '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><div class="m">需要做的時候從這裡選一張來填。快到期、已到期的會標出來。</div></div></div></div>', last = null, open = false;
 list.forEach((function(a) {
  var f = F(a.form);
  if (!f) return;
  if (a.form !== last) {
   if (open) h += "</div>";
   last = a.form;
   h += '<div class="sec">' + esc(f.name) + '</div><div class="list">';
   open = true;
  }
  if (a.missingEquip) {
   h += '<div class="li"><span class="mn"><span class="mt">後台還沒建立這個部門的' + esc(a.missingEquip) + "編號，請洽環安衛中心。</span></span></div>";
   return;
  }
  h += '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc([ a.object ? a.object + (a.objectName ? " " + a.objectName : "") : "", a.kind ].filter(String).join("｜") || f.name) + "</span>" + '<span class="mt">' + esc(dueMeta(a)) + "</span></span>" + duePill(a) + "</button>";
 }));
 if (open) h += "</div>";
 if (!list.length) h += '<div class="empty">這個部門沒有其他檢查表</div>';
 $("app").innerHTML = h;
};

PAGES.claim = function() {
 setTitle("申請表單");
 var list = S.me.claimable || [], multi = S.me.depts.length > 1;
 var h = '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><div class="m">單位負責人指派給您的表會自動出現在首頁，不用申請。這裡是本課其他還沒指派給您的表或設備；想多負責哪一項，按「申請」送給單位負責人，核准後就會出現在首頁。' + "要取消請洽單位負責人。</div></div></div></div>";
 S.me.depts.forEach((function(d) {
  var mine = list.filter((function(x) {
   return x.dept === d.id;
  }));
  if (!mine.length) return;
  var fs = mine.filter((function(x) {
   return x.kind === "form";
  })), es = mine.filter((function(x) {
   return x.kind === "equip";
  }));
  if (fs.length) h += '<div class="sec">' + esc((multi ? d.id + "・" : "") + "檢查表") + '</div><div class="list">' + fs.map((function(x, i) {
   return claimRow(x, x.name, (x.daily ? "每日檢點" : "定期檢查") + "・" + (x.users.length ? "目前使用：" + x.users.join("、") : "目前沒有人使用"), "f" + i + d.id);
  })).join("") + "</div>";
  if (es.length) h += '<div class="sec">' + esc((multi ? d.id + "・" : "") + "設備（一台一台申請）") + '</div><div class="list">' + es.map((function(x, i) {
   return claimRow(x, x.cat + " " + x.object + (x.objectName ? "（" + x.objectName + "）" : ""), "用到：" + x.forms.join("、") + "・" + (x.users.length ? "目前負責：" + x.users.join("、") : "目前沒有負責人"), "e" + i + d.id);
  })).join("") + "</div>";
 }));
 if (!list.length) h += '<div class="empty">本課開放的表都已經是您的了</div>';
 $("app").innerHTML = h;
};

var CLAIMS = {};

function claimRow(x, title, meta, k) {
 CLAIMS[k] = x;
 return '<div class="li"><span class="mn"><span class="nm">' + esc(title) + '</span><span class="mt">' + esc(meta) + "</span></span>" + (x.pending ? pill("warn", "clock", "待單位負責人核准") : '<button class="btn sm" onclick="claimGo(' + jsq(k) + ')">申請</button>') + "</div>";
}

function claimGo(k) {
 var x = CLAIMS[k];
 if (!x) return;
 var what = x.kind === "equip" ? x.cat + " " + x.object : x.name;
 if (!confirm("申請負責「" + what + "」？\n送出後要單位負責人核准，核准了首頁才會出現" + (x.kind === "equip" ? "這台設備的檢查表" : "這張表") + "。")) return;
 if (!navigator.onLine) return toast("沒有網路，申請要連上網路才能做", "err", 3500);
 busyOn("送出申請中…");
 api("claim", x.kind === "equip" ? {
  deptId: x.dept,
  kind: "equip",
  cat: x.cat,
  object: x.object
 } : {
  deptId: x.dept,
  kind: "form",
  formId: x.form
 }).then((function(r) {
  busyOff();
  S.me = normMe(r.me);
  lsSet(LS.ME, r.me);
  toast("已送出申請：" + what + "，等單位負責人核准", "ok", 3500);
  render();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4500);
 }));
}

PAGES.claimReview = function() {
 setTitle("表單申請");
 var cr = S.cr;
 if (!cr) {
  $("app").innerHTML = loading("讀取表單申請…");
  api("claimList", {}).then((function(r) {
   S.cr = r;
   if (S.page === "claimReview") render();
  })).catch((function(e) {
   $("app").innerHTML = errBox("讀不到表單申請", e.message);
  }));
  return;
 }
 var sel = S.crSel = S.crSel || {};
 cr.list.forEach((function(x) {
  if (!(x.id in sel)) sel[x.id] = true;
 }));
 var ids = cr.list.filter((function(x) {
  return sel[x.id];
 })).map((function(x) {
  return x.id;
 }));
 var h = '<div class="muted upnote">同仁申請負責的表或設備。核准後馬上出現在他的手機上，環安衛中心會收到異動通知；退回請寫原因。環安衛或您已經直接派給他的，系統會自動結案，不用再按。</div>';
 if (cr.list.length > 1) h += '<div class="card" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' + '<label style="display:flex;align-items:center;gap:6px;margin-right:auto"><input type="checkbox" ' + (ids.length === cr.list.length ? "checked " : "") + 'onchange="claimSelAll(this.checked)">全選（已選 ' + ids.length + " / " + cr.list.length + " 件）</label>" + '<button class="btn sm"' + (ids.length ? "" : " disabled") + ' onclick="claimDecide(null,' + jsq("approve") + ')">核准勾選的 ' + ids.length + " 件</button>" + '<button class="btn sm ghost"' + (ids.length ? "" : " disabled") + ' onclick="claimDecide(null,' + jsq("reject") + ')">退回勾選的</button></div>';
 h += cr.list.length ? '<div class="list">' + cr.list.map((function(x) {
  return '<div class="li">' + (cr.list.length > 1 ? '<input type="checkbox" style="width:22px;height:22px;margin-right:10px;flex:none" ' + (sel[x.id] ? "checked " : "") + 'onchange="claimSel(' + jsq(x.id) + ',this.checked)">' : "") + '<span class="mn"><span class="nm">' + esc(x.name + "：" + x.what) + '</span><span class="mt">' + esc(x.dept + "・" + x.time.slice(5) + " 申請") + "</span>" + '<span class="mt">' + esc(x.users.length ? "目前負責：" + x.users.join("、") : "目前沒有人負責") + "</span>" + '<span class="btns"><button class="btn sm" onclick="claimDecide(' + jsq(x.id) + "," + jsq("approve") + ')">核准</button><button class="btn sm ghost" onclick="claimDecide(' + jsq(x.id) + "," + jsq("reject") + ')">退回</button></span></span></div>';
 })).join("") + "</div>" : '<div class="empty">目前沒有待核准的表單申請</div>';
 $("app").innerHTML = h;
};

function claimSel(id, on) {
 (S.crSel = S.crSel || {})[id] = on;
 keepY(render);
}

function claimSelAll(on) {
 var sel = S.crSel = S.crSel || {};
 (S.cr && S.cr.list || []).forEach((function(x) {
  sel[x.id] = on;
 }));
 keepY(render);
}

function claimDecide(id, d) {
 var list = S.cr && S.cr.list || [], sel = S.crSel || {};
 var ids = id ? [ id ] : list.filter((function(x) {
  return sel[x.id];
 })).map((function(x) {
  return x.id;
 }));
 if (!ids.length) return toast("請先勾選要處理的申請", "err", 2500);
 var b = {
  ids,
  decision: d
 };
 if (d === "reject") {
  var why = prompt("退回原因（會通知申請人）" + (ids.length > 1 ? "，" + ids.length + " 件共用同一個原因" : ""), "");
  if (why === null) return;
  b.reason = why;
 }
 if (!navigator.onLine) return toast("沒有網路，要連上網路才能核准", "err", 3500);
 busyOn((d === "approve" ? "核准中" : "退回中") + (ids.length > 1 ? "（" + ids.length + " 件）" : "") + "…");
 api("claimDecide", b).then((function(r) {
  busyOff();
  S.cr = {
   list: r.list
  };
  S.me = normMe(r.me);
  lsSet(LS.ME, r.me);
  ids.forEach((function(x) {
   delete sel[x];
  }));
  var msg = (d === "approve" ? "已核准 " : "已退回 ") + (r.done == null ? ids.length : r.done) + " 件";
  if (r.skipped && r.skipped.length) toast(esc(msg + "；略過：" + r.skipped.join("；")), "err", 6e3); else toast(msg, "ok", 2500);
  render();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4500);
 }));
}

PAGES.notice = function() {
 setTitle("通知");
 var list = S.me && S.me.notices || [];
 var h = (window.pushRow ? pushRow() : "") + '<div class="muted upnote">最近 60 天和您有關的通知。單位負責人、環安衛另外會收到 Email。</div>';
 if (!list.length) h += '<div class="empty">目前沒有通知</div>'; else h += '<div class="list">' + list.map((function(x) {
  var bc = x.type === "廣播";
  return '<div class="li nt' + (x.read ? "" : " unread") + (bc ? " bcn" : "") + '"><span class="mn"><span class="mt">' + esc((bc ? "環安衛中心廣播" : (x.type || "") + (x.dept ? "・" + x.dept : "")) + "・" + x.time.slice(5).replace("-", "/")) + "</span>" + '<span class="nm">' + (x.read ? "" : '<i class="ndot"></i>') + esc(x.title) + '</span><span class="mt nb">' + esc(bc ? bcBody(x.body) : x.body) + "</span></span></div>";
 })).join("") + "</div>";
 $("app").innerHTML = h;
 var ids = list.filter((function(x) {
  return !x.read;
 })).map((function(x) {
  return x.id;
 }));
 if (ids.length && navigator.onLine) api("noticeRead", {
  ids
 }, {
  quiet: true
 }).then((function() {
  list.forEach((function(x) {
   x.read = true;
  }));
  S.me.unread = 0;
  var raw = lsGet(LS.ME, null);
  if (raw) {
   (raw.notices || []).forEach((function(x) {
    x.read = true;
   }));
   raw.unread = 0;
   lsSet(LS.ME, raw);
  }
 })).catch((function() {}));
};

function bcBody(b) {
 return String(b || "").replace(/（B\d+[0-9A-Z]{4}）$/, "");
}

PAGES.bc = function() {
 setTitle("廣播");
 if (!S.bc) {
  $("app").innerHTML = loading("讀取人員名單…");
  Promise.all([ apiR("bcPeople", {}), apiR("bcList", {}) ]).then((function(r) {
   S.bc = {
    depts: r[0].depts,
    list: r[1].list,
    mode: "all",
    depts2: {},
    names: {},
    mgrOnly: false,
    title: "",
    body: "",
    mail: false,
    open: {}
   };
   if (S.page === "bc") render();
  })).catch((function(e) {
   $("app").innerHTML = '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + esc(e.message) + "</div></div></div></div>";
  }));
  return;
 }
 var b = S.bc, h = "";
 h += '<div class="sec">1. 發給誰</div><div class="seg">' + [ [ "all", "全部人員" ], [ "dept", "指定部門" ], [ "name", "指定人員" ] ].map((function(t) {
  return '<button class="' + (b.mode === t[0] ? "on" : "") + '" onclick="S.bc.mode=' + jsq(t[0]) + ';render()">' + t[1] + "</button>";
 })).join("") + "</div>";
 if (b.mode === "dept") h += '<div class="chips wrap">' + b.depts.map((function(d) {
  return '<button class="chip' + (b.depts2[d.id] ? " on" : "") + '" onclick="S.bc.depts2[' + jsq(d.id) + "]=!S.bc.depts2[" + jsq(d.id) + '];render()">' + esc(d.id) + "・" + d.people.length + " 人</button>";
 })).join("") + "</div>";
 if (b.mode !== "name") h += '<label class="ck"><input type="checkbox"' + (b.mgrOnly ? " checked" : "") + ' onchange="S.bc.mgrOnly=this.checked;render()">只發給單位負責人</label>';
 if (b.mode === "name") h += b.depts.map((function(d) {
  return '<div class="sec">' + esc(d.id) + '</div><div class="card">' + d.people.map((function(x) {
   return '<label class="ck"><input type="checkbox"' + (b.names[x.name] ? " checked" : "") + ' onchange="S.bc.names[' + jsq(x.name) + ']=this.checked;render()"><span>' + esc(x.name) + (x.role !== "檢點人員" ? '<small class="muted">　' + esc(x.role) + "</small>" : "") + "</span></label>";
  })).join("") + "</div>";
 })).join("");
 h += '<div class="sec">2. 內容</div><div class="card ev"><label class="nl" for="bcT">標題（同仁首頁最上面會顯示）</label>' + '<input id="bcT" class="field" maxlength="60" placeholder="例：10/15 消防演練，13:30 前廣場集合" value="' + esc(b.title) + '" oninput="S.bc.title=this.value;bcBar()">' + '<label class="nl" for="bcB">內容</label><textarea id="bcB" class="note plain" maxlength="1000" placeholder="時間、地點、要做什麼" oninput="S.bc.body=this.value;bcBar()">' + esc(b.body) + "</textarea>" + '<label class="ck"><input type="checkbox"' + (b.mail ? " checked" : "") + ' onchange="S.bc.mail=this.checked">另外寄 Email 給有信箱的人</label></div>';
 h += '<div class="sec">已發的廣播<small>點一則看誰還沒讀</small></div>' + (b.list.length ? '<div class="list">' + b.list.map((function(x) {
  var rd = x.n - x.unread.length, op = b.open[x.id];
  return '<button class="li" onclick="S.bc.open[' + jsq(x.id) + "]=!S.bc.open[" + jsq(x.id) + '];render()"><span class="mn"><span class="nm">' + esc(x.title) + "</span>" + '<span class="mt">' + esc(x.time.slice(5).replace("-", "/") + "・" + x.to + (x.mail ? "・有寄信" : "")) + "</span>" + (op ? '<span class="mt nb">' + esc(x.body) + '</span><span class="mt' + (x.unread.length ? " wn" : "") + '">' + esc(x.unread.length ? "還沒讀：" + x.unread.join("、") : "全部都讀了") + "</span>" : "") + "</span>" + pill(rd === x.n ? "ok" : "warn", rd === x.n ? "check" : "", "已讀 " + rd + "/" + x.n) + "</button>";
 })).join("") + "</div>" : '<div class="empty">還沒有發過廣播</div>');
 $("app").innerHTML = h;
 bcBar();
};

function bcCount() {
 var b = S.bc, set = {};
 b.depts.forEach((function(d) {
  d.people.forEach((function(x) {
   var hit = b.mode === "all" || b.mode === "dept" && b.depts2[d.id];
   if (b.mode === "name" ? b.names[x.name] : hit && (!b.mgrOnly || x.role === "單位負責人")) set[x.name] = 1;
  }));
 }));
 delete set[S.me.person.name];
 return Object.keys(set).length;
}

function bcBar() {
 if (S.page !== "bc" || !S.bc) return;
 var n = bcCount(), ok = n && S.bc.title.trim() && S.bc.body.trim();
 bar('<button class="btn"' + (ok ? "" : " disabled") + ' onclick="bcSend()">' + ic("bell", 22, 2.6) + (!n ? "先選要發給誰" : ok ? "發送廣播（" + n + " 人）" : "寫好標題和內容就能發（" + n + " 人）") + "</button>");
}

function bcSend() {
 var b = S.bc, n = bcCount();
 if (!confirm("發送「" + b.title.trim() + "」給 " + n + " 人？發出後不能收回。")) return;
 if (!navigator.onLine) return toast("沒有網路，廣播要連上網路才能發", "err", 3500);
 var to = b.mode === "all" ? {
  all: true
 } : b.mode === "dept" ? {
  depts: Object.keys(b.depts2).filter((function(k) {
   return b.depts2[k];
  }))
 } : {
  names: Object.keys(b.names).filter((function(k) {
   return b.names[k];
  }))
 };
 if (b.mode !== "name" && b.mgrOnly) to.roles = [ "單位負責人" ];
 busyOn("發送中…");
 api("broadcast", {
  title: b.title,
  body: b.body,
  to,
  mail: b.mail
 }).then((function(r) {
  busyOff();
  b.list = r.list;
  b.title = "";
  b.body = "";
  toast("已發送給 " + r.n + " 人", "ok", 3e3);
  window.scrollTo(0, 0);
  render();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4500);
 }));
}

function tkLoad() {
 return apiR("tracks", {}).then((function(r) {
  S.tk = r;
  S.me.tracksOpen = r.open.length;
  return r;
 }));
}

function prevDefects(a) {
 if (!S.me || !S.me.tracksOpen) return "";
 if (!S.tk) {
  if (!S.tkBusy) {
   S.tkBusy = true;
   tkLoad().then((function() {
    S.tkBusy = false;
    if (S.page === "fill") keepY(render);
   }), (function() {
    S.tkBusy = false;
   }));
  }
  return "";
 }
 var list = (S.tk.open || []).filter((function(x) {
  return x.dept === a.dept && x.form === a.form && String(x.object || "") === String(a.object || "");
 }));
 if (!list.length) return "";
 return '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><b>上次檢查還有 ' + list.length + ' 項缺失沒結案</b><div class="m">' + list.slice(0, 4).map((function(x) {
  return esc(tkDates(x) + " 第 " + x.seq + " 項：" + (x.note || x.item));
 })).join("<br>") + (list.length > 4 ? "<br>…另有 " + (list.length - 4) + " 項" : "") + "<br>這次檢查請一併確認；改善好了到「異常追蹤」填寫改善措施結案。</div></div></div>" + '<button class="btn ghost" onclick="S.tk=null;go(\'track\')">' + ic("warn", 20, 2.2) + "到異常追蹤填寫改善</button></div>";
}

function tkPlan(id, v) {
 if (!v) return;
 api("trackPlan", {
  id,
  plan: v
 }).then((function(r) {
  S.tk = r;
  S.me.tracksOpen = r.open.length;
  toast("已排定預定完成日 " + md(v), "ok", 2500);
  keepY(render);
 })).catch((function(e) {
  toast(esc(e.message), "err", 4500);
  keepY(render);
 }));
}

function tkDates(x) {
 var d = x.dates.map(md);
 return (d.length > 3 ? d.slice(0, 2).join("、") + "…" + d[d.length - 1] : d.join("、")) + (d.length > 1 ? "（" + d.length + " 天）" : "");
}

function tkPhotos(ids, label) {
 return ids && ids.length ? '<span class="mt">' + esc(label) + "：" + ids.map((function(id, i) {
  return '<button class="lnk" onclick="event.stopPropagation();photoView(' + jsq(id) + ')">照片 ' + (i + 1) + "</button>";
 })).join("　") + "</span>" : "";
}

function tkTitle(x) {
 return (x.formName || "").replace(/（[^）]*）$/, "") + (x.object ? "・" + x.object : x.form.indexOf("@") > 0 ? "・" + x.form.split("@")[1] : "");
}

PAGES.track = function() {
 setTitle("異常追蹤");
 if (!S.tk) {
  $("app").innerHTML = loading("讀取異常追蹤…");
  tkLoad().then((function() {
   if (S.page === "track") render();
  })).catch((function(e) {
   $("app").innerHTML = '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + esc(e.message) + "</div></div></div></div>";
  }));
  return;
 }
 var tab = S.arg.tab || "open", list = tab === "open" ? S.tk.open : S.tk.closed, multi = S.me.depts.length > 1 || isEhs();
 var h = '<div class="seg2" role="tablist"><button class="' + (tab === "open" ? "on" : "") + '" onclick="S.arg.tab=\'open\';render()">待改善 ' + S.tk.open.length + "</button>" + '<button class="' + (tab === "closed" ? "on" : "") + '" onclick="S.arg.tab=\'closed\';render()">已結案 ' + S.tk.closed.length + "</button></div>";
 if (tab === "open") h += '<div class="muted upnote">檢點時打了「異常」的項目會自動列在這裡。改善好了，點「填寫改善」寫處理方式就能結案。同一個項目還沒結案前再異常，會記在同一件。</div>';
 h += list.length ? list.map((function(x) {
  var head = '<div class="tkh"><span class="nm">' + esc(tkTitle(x)) + "</span>" + (x.state === "已結案" ? pill("ok", "check", "已結案") : pill("ng", "warn", x.mark || "異常")) + "</div>";
  var body = '<div class="tki">' + esc(x.item.replace(/^\d+\.\s*/, "")) + "</div>" + (x.note ? '<div class="tkn">' + esc(x.note) + "</div>" : "") + '<span class="mt">' + esc((multi ? x.dept + "・" : "") + "發現：" + tkDates(x) + "・" + x.finder) + "</span>" + tkPhotos(x.photos, "異常照片");
  if (x.state === "已結案") body += '<div class="tkf"><b>改善：</b>' + esc(x.fix) + '<span class="mt">' + esc(md(x.fixDate) + " 完成・" + x.fixer) + "</span>" + tkPhotos(x.fixPhotos, "改善照片") + "</div>"; else {
   if (isEhs() || mgrOf(x.dept)) body += '<div class="tkp"><label class="nl" for="pl_' + esc(x.id) + '">預定完成日（主管排定，印在檢點表上）</label>' + '<input type="date" id="pl_' + esc(x.id) + '" class="field" value="' + esc(x.plan || "") + '" min="' + esc(x.dates[0] || today()) + '" onchange="tkPlan(' + jsq(x.id) + ',this.value)"></div>'; else body += '<span class="mt">' + esc(x.plan ? "預定 " + md(x.plan) + " 前完成改善" : "預定完成日：等單位負責人排定") + "</span>";
   body += '<button class="btn line sm" onclick="go(\'trackFix\',{id:' + jsq(x.id) + '})">' + ic("pen", 18) + "填寫改善</button>";
  }
  return '<div class="card tk">' + head + body + "</div>";
 })).join("") : '<div class="empty">' + (tab === "open" ? "目前沒有待改善的異常" : "最近 90 天沒有結案的紀錄") + "</div>";
 $("app").innerHTML = h;
};

PAGES.trackFix = function() {
 var x = S.tk && S.tk.open.filter((function(y) {
  return y.id === S.arg.id;
 }))[0];
 if (!x) return back();
 setTitle("填寫改善");
 if (!S.tf || S.tf.id !== x.id) S.tf = {
  id: x.id,
  fix: "",
  date: today(),
  pics: []
 };
 var tf = S.tf, first = x.dates[0] || today();
 var h = '<div class="card tk"><div class="tkh"><span class="nm">' + esc(tkTitle(x)) + "</span>" + pill("ng", "warn", x.mark || "異常") + "</div>" + '<div class="tki">' + esc(x.item.replace(/^\d+\.\s*/, "")) + "</div>" + (x.note ? '<div class="tkn">' + esc(x.note) + "</div>" : "") + '<span class="mt">' + esc("發現：" + tkDates(x) + "・" + x.finder) + "</span>" + tkPhotos(x.photos, "異常照片") + "</div>";
 h += '<div class="card ev"><label class="nl req" for="tfFix">改善措施（做了什麼處理）</label>' + '<textarea id="tfFix" class="note plain" placeholder="例：已更換洗眼器加壓閥，試水壓正常" oninput="S.tf.fix=this.value;tfBar()">' + esc(tf.fix) + '</textarea><div class="hint nbad" id="tfWhy" hidden></div>' + '<label class="nl" for="tfDate">改善完成日期</label><input type="date" id="tfDate" class="field" value="' + esc(tf.date) + '" min="' + esc(first) + '" max="' + today() + '" onchange="S.tf.date=this.value">' + '<label class="nl' + (x.form === "PATROL" ? " req" : "") + '">改善後照片' + (x.form === "PATROL" ? "（現場巡視缺失要附，會放進查核紀錄附頁）" : "（選填）") + '</label><div class="pics">' + tf.pics.map((function(p, i) {
  return '<div class="pic"><img src="' + esc(p.t) + '" alt="改善照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="S.tf.pics.splice(' + i + ',1);keepY(render)">' + ic("x", 16, 3) + "</button></div>";
 })).join("") + (tf.pics.length < 3 ? '<label class="pic add">' + ic("plus", 26, 2.6) + '<span>拍照／選照片</span><input type="file" accept="image/*" hidden onchange="tfPick(this)"></label>' : "") + "</div></div>";
 $("app").innerHTML = h;
 tfBar();
};

function tfBar() {
 if (S.page !== "trackFix") return;
 var n = String(S.tf.fix || "").replace(/\s/g, "").length, x = S.tk.open.filter((function(y) {
  return y.id === S.tf.id;
 }))[0];
 var pic = !(x && x.form === "PATROL") || S.tf.pics.length > 0, w = n ? txtWhy(S.tf.fix, {
  min: 5,
  want: "請寫做了什麼處理（例：更換了什麼、調整了什麼）"
 }) : "", go_ = n >= 5 && !w && pic;
 var el = $("tfWhy");
 if (el) {
  el.textContent = w;
  el.hidden = !w;
 }
 bar('<button class="btn"' + (go_ ? "" : " disabled") + ' onclick="tfSave()">' + ic("check", 22, 2.8) + (go_ ? "改善完成，結案" : n < 5 ? "寫好改善措施就能結案（至少 5 個字）" : w ? "改善措施要寫清楚才能結案" : "附上改善後照片就能結案") + "</button>");
}

function tfPick(inp) {
 var file = inp.files && inp.files[0];
 inp.value = "";
 var x = S.tk.open.filter((function(y) {
  return y.id === S.tf.id;
 }))[0], tf = S.tf;
 photoUp(file, {
  deptId: x.dept,
  formId: x.form,
  purpose: "fix",
  __dup: tf.pics.map((function(p) {
   return p.t;
  }))
 }, (function(p) {
  if (S.tf !== tf) return;
  tf.pics.push(p);
  keepY(render);
  tfBar();
 }));
}

function tfSave() {
 var tf = S.tf;
 if (!navigator.onLine) return toast("沒有網路，結案要連上網路", "err", 3500);
 if (!tf.date || tf.date > today()) return toast("改善完成日期不能是未來", "err");
 busyOn("結案中…");
 api("trackClose", {
  id: tf.id,
  fix: tf.fix,
  fixDate: tf.date,
  photos: tf.pics.map((function(p) {
   return p.id;
  }))
 }).then((function(r) {
  busyOff();
  S.tk = r;
  S.me.tracksOpen = r.open.length;
  S.tf = null;
  toast("已結案", "ok", 2500);
  back();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4500);
 }));
}

function guideRole() {
 return isEhs() ? "ehs" : isMgr() ? "mgr" : "op";
}

function guideChaps() {
 return (S.guide.chapters || []).filter((function(c) {
  return c.roles.indexOf(guideRole()) >= 0 && (!c.mod || modOn(c.mod));
 }));
}

function guideDemo() {
 var ds = S.me && S.me.depts || [];
 return ds.length > 0 && ds.every((function(d) {
  return demoDept(d.id);
 }));
}

function gHide() {
 return guideDemo() ? S.guide.demoHide || {} : {};
}

function gSecsOf(c) {
 var hs = gHide().secs || [];
 return c.sections.filter((function(x) {
  return hs.indexOf(x.no) < 0;
 }));
}

function guideSecs() {
 var o = [];
 guideChaps().forEach((function(c) {
  gSecsOf(c).forEach((function(x) {
   o.push({
    c,
    x
   });
  }));
 }));
 return o;
}

PAGES.guide = function() {
 setTitle("使用教學");
 if (!S.guide) {
  $("app").innerHTML = loading("讀取教學…");
  var gl = window.I18N && I18N.lang() !== "zh" ? I18N.lang() : "", gget = function(f) {
   var one = function(u) {
    return fetch(u + "?v=" + APP_VERSION, {
     cache: "no-cache"
    }).then((function(r) {
     if (!r.ok) throw new Error(r.status);
     return r.json();
    }));
   };
   return one(f).catch((function() {
    return one("guide/" + f);
   }));
  };
  (gl ? gget("content." + gl + ".json").catch((function() {
   return gget("content.json");
  })) : gget("content.json")).then((function(j) {
   S.guide = j;
   if (S.page === "guide") render();
  })).catch((function() {
   $("app").innerHTML = '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">教學要連上網路才能看，請稍後再試。</div></div></div></div>';
  }));
  return;
 }
 var id = S.arg.sec;
 if (id === "faq") return guideFaq();
 if (id) return guideSec(id);
 var h = '<button class="btn gfaqtop" onclick="gOpen(\'faq\')">' + ic("info", 20, 2.4) + "常見問題（先看這裡）</button>";
 h += '<div class="gintro">依您的身分（' + esc(guideRole() === "ehs" ? "環安衛" : guideRole() === "mgr" ? "單位負責人" : "檢點人員") + "）列出要看的章節，點一節就能看，每節都有實際畫面。</div>";
 h += guideChaps().map((function(c) {
  return '<div class="gch" style="--c:' + esc(c.color) + '"><div class="gct"><span class="gcn">' + c.no + "</span><span><b>" + esc(c.title) + "</b><small>" + esc(c.who) + "</small></span></div>" + '<div class="list">' + gSecsOf(c).map((function(x) {
   return '<button class="li" onclick="gOpen(' + jsq(x.no) + ')"><span class="gno">' + esc(x.no) + '</span><span class="mn"><span class="nm">' + esc(x.title) + "</span></span>" + ic("chev", 18, 2.6) + "</button>";
  })).join("") + "</div></div>";
 })).join("");
 $("app").innerHTML = h;
};

function guideSec(id) {
 var all = guideSecs(), i = all.findIndex((function(y) {
  return y.x.no === id;
 }));
 if (i < 0) return back();
 var c = all[i].c, x = all[i].x;
 setTitle(x.no + " " + x.title);
 var h = '<div class="gtag" style="--c:' + esc(c.color) + '">第 ' + c.no + " 章　" + esc(c.title) + '</div><h2 class="gh">' + esc(x.title) + "</h2>" + (x.lead ? '<p class="glead">' + esc(x.lead) + "</p>" : "");
 h += '<div class="gshots">' + x.shots.map((function(s) {
  return '<figure><img src="' + esc(s[0]) + ".webp?v=" + APP_VERSION + '" onerror="this.onerror=null;this.src=\'guide/w/' + esc(s[0]) + ".webp?v=" + APP_VERSION + '\'" alt="' + esc(s[1]) + '" loading="lazy"><figcaption>' + esc(s[1]) + "</figcaption></figure>";
 })).join("") + "</div>" + (x.shots.length > 1 ? '<div class="hint gsw">← 左右滑動看 ' + x.shots.length + " 張畫面 →</div>" : "");
 var hideSt = (gHide().steps || {})[x.no] || [];
 h += '<ol class="gst">' + x.steps.filter((function(s, k) {
  return hideSt.indexOf(k) < 0;
 })).map((function(s) {
  return "<li>" + s + "</li>";
 })).join("") + "</ol>";
 if (x.tip) h += '<div class="box ' + (x.warn ? "warn" : "info") + '"><div class="r">' + ic(x.warn ? "warn" : "info", 22) + '<div class="bt"><div class="m">' + esc(x.tip) + "</div></div></div></div>";
 $("app").innerHTML = h;
 var prev = all[i - 1], next = all[i + 1];
 bar('<div class="btns r12">' + (prev ? '<button class="btn ghost" onclick="gTo(' + jsq(prev.x.no) + ')">上一節</button>' : '<button class="btn ghost" onclick="back()">目錄</button>') + (next ? '<button class="btn" onclick="gTo(' + jsq(next.x.no) + ')">下一節：' + esc(next.x.title.replace(/（.*$/, "")) + "</button>" : '<button class="btn" onclick="gTo(\'faq\')">常見問題</button>') + "</div>");
}

function guideFaq() {
 setTitle("常見問題");
 var hideF = gHide().faq || [];
 $("app").innerHTML = (S.guide.faq || []).filter((function(q, k) {
  return hideF.indexOf(k) < 0;
 })).map((function(q) {
  return '<div class="card gfaq"><b>' + esc(q[0]) + "</b><p>" + esc(q[1]) + "</p></div>";
 })).join("") + '<div class="muted upnote">還有問題請洽環安衛中心。</div>';
 bar('<button class="btn ghost" onclick="back()">回教學目錄</button>');
}

function gOpen(no) {
 S.stack.push({
  page: S.page,
  arg: S.arg
 });
 S.arg = {
  sec: no
 };
 window.scrollTo(0, 0);
 render();
}

function gTo(no) {
 S.arg = {
  sec: no
 };
 window.scrollTo(0, 0);
 render();
}

PAGES.nextOwners = function() {
 setTitle("下月負責人");
 var ds = S.me.depts.filter((function(d) {
  return mgrOf(d.id);
 })).map((function(d) {
  return d.id;
 }));
 if (!S.arg.dept) S.arg.dept = ds[0];
 var nx = S.next && S.next.dept === S.arg.dept ? S.next : null;
 var h = "";
 if (ds.length > 1) h += '<div class="chips">' + ds.map((function(d) {
  return '<button class="chip' + (d === S.arg.dept ? " on" : "") + '" onclick="nextDept(' + jsq(d) + ')">' + esc(d) + "</button>";
 })).join("") + "</div>";
 if (!nx) {
  $("app").innerHTML = h + loading("讀取本課負責人…");
  apiR("nextList", {
   deptId: S.arg.dept
  }).then((function(r) {
   S.next = r;
   if (!S.arg.key && r.targets.length) S.arg.key = r.targets[0].key;
   render();
  })).catch((function(e) {
   $("app").innerHTML = h + '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + esc(e.message) + "</div></div></div></div>";
  }));
  return;
 }
 var mo = Number(nx.month.slice(5)) + " 月";
 h += '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><div class="m">先選要變更的表單或設備，右邊勾 ' + mo + " 起的負責人，按儲存。" + mo + " 1 日自動生效，當事人會收到 App 通知。這個月照舊。</div></div></div></div>";
 var opt = function(k) {
  var t = nx.targets.filter((function(x) {
   return x.kind === k;
  }));
  return t.map((function(x) {
   return '<option value="' + esc(x.key) + '"' + (x.key === S.arg.key ? " selected" : "") + ">" + esc(x.name) + (x.next ? "（已安排）" : "") + "</option>";
  })).join("");
 };
 h += '<div class="sec">1. 要變更的表單或設備</div><select class="field" id="nxKey" onchange="nextPick(this.value)">' + '<optgroup label="檢查表">' + opt("form") + '</optgroup><optgroup label="設備">' + opt("equip") + "</optgroup></select>";
 var tg = nx.targets.filter((function(x) {
  return x.key === S.arg.key;
 }))[0], same = false, saved = false;
 if (tg) {
  var want = S.arg.want || (tg.next || tg.now).slice();
  S.arg.want = want;
  if (tg.uses && tg.uses.length) h += '<div class="muted upnote">這台設備會用到：' + esc(tg.uses.join("、")) + "</div>";
  h += '<div class="sec">2. 負責人</div><div class="nxcols"><div class="nxc"><div class="nxh">本月（目前）</div>' + (tg.now.length ? tg.now.map((function(n) {
   return '<div class="nxn">' + esc(n) + "</div>";
  })).join("") : '<div class="muted">沒有負責人</div>') + "</div>" + '<div class="nxc on"><div class="nxh">' + mo + " 起</div>" + nx.ops.map((function(n) {
   return '<label class="ck"><input type="checkbox" ' + (want.indexOf(n) >= 0 ? "checked" : "") + ' onchange="nextTick(' + jsq(n) + ',this.checked)">' + esc(n) + "</label>";
  })).join("") + (nx.ops.length ? "" : '<div class="muted">本課還沒有檢點人員</div>') + "</div></div>";
  same = want.slice().sort().join() === tg.now.slice().sort().join();
  saved = tg.next && want.slice().sort().join() === tg.next.slice().sort().join();
  if (!want.length) h += '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + mo + " 起沒有負責人＝這" + (tg.kind === "equip" ? "台設備" : "張表") + "本課不再使用（手機上看不到、不算缺漏）。</div></div></div></div>";
  bar('<button class="btn" id="nxBtn" onclick="nextSave()">' + ic("check", 22, 2.8) + (saved ? "已安排（要改請重新勾選）" : same && tg.next ? "取消下月異動（維持現狀）" : same ? "沒有變更" : "儲存 " + mo + " 的安排") + "</button>");
 }
 var plan = nx.targets.filter((function(x) {
  return x.next;
 }));
 h += '<div class="sec">已安排的下月異動<small>' + mo + " 1 日生效</small></div>" + (plan.length ? '<div class="list">' + plan.map((function(x) {
  return '<button class="li" onclick="nextPick(' + jsq(x.key) + ')"><span class="mn"><span class="nm">' + esc(x.name) + '</span><span class="mt">' + esc((x.now.join("、") || "（無）") + " → " + (x.next.join("、") || "（無）")) + "</span></span></button>";
 })).join("") + "</div>" : '<div class="empty">還沒有安排</div>');
 $("app").innerHTML = h;
 if (tg && $("nxBtn") && (saved || same && !tg.next)) $("nxBtn").disabled = true;
};

function nextDept(d) {
 S.arg = {
  dept: d
 };
 S.next = null;
 render();
}

function nextPick(k) {
 S.arg.key = k;
 S.arg.want = null;
 window.scrollTo(0, 0);
 render();
}

function nextTick(n, on) {
 var w = S.arg.want || [];
 if (on && w.indexOf(n) < 0) w.push(n);
 if (!on) w = w.filter((function(x) {
  return x !== n;
 }));
 S.arg.want = w;
 render();
}

function nextSave() {
 var nx = S.next, tg = nx && nx.targets.filter((function(x) {
  return x.key === S.arg.key;
 }))[0];
 if (!tg) return;
 if (!navigator.onLine) return toast("沒有網路，安排要連上網路才能存", "err", 3500);
 busyOn("儲存中…");
 api("nextSet", {
  deptId: nx.dept,
  target: tg.key,
  names: S.arg.want || []
 }).then((function(r) {
  busyOff();
  S.next = r;
  S.arg.want = null;
  toast("已儲存，" + Number(r.month.slice(5)) + " 月 1 日生效；相關人員會收到通知", "ok", 3500);
  render();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4500);
 }));
}

function teamDepts() {
 return S.me.depts.filter((function(d) {
  return mgrOf(d.id);
 })).map((function(d) {
  return d.id;
 }));
}

function teamLoad(dept) {
 return apiR("team", {
  deptId: dept
 }).then((function(r) {
  S.team = r;
  S.teamAt = Date.now();
  return r;
 }));
}

function perPill(x) {
 return {
  never: pill("na", "", "尚無紀錄"),
  overdue: pill("ng", "warn", "已到期"),
  soon: pill("warn", "clock", "快到期"),
  ok: pill("ok", "check", "期限內")
 }[x.state] || "";
}

function perLine(x) {
 return x.freq + (x.last ? "・上次 " + x.last + (x.due ? "・下次 " + x.due : "") : "") + (x.evidence ? "・需照片＋紀要" : "");
}

PAGES.team = function() {
 setTitle("部門管理");
 var ds = teamDepts();
 var allOk = ds.length > 1 && !isEhs();
 if (!S.arg.dept || S.arg.dept === "*" && !allOk) S.arg.dept = allOk ? "*" : ds[0];
 if (!S.arg.tab || S.arg.tab === "grid" && !isDesk()) S.arg.tab = "ov";
 var tm = S.team && S.team.dept === S.arg.dept ? S.team : null;
 var h = "";
 if (ds.length > 1) h += '<div class="chips">' + (allOk ? [ "*" ] : []).concat(ds).map((function(d) {
  return '<button class="chip' + (d === S.arg.dept ? " on" : "") + '" onclick="teamDept(' + jsq(d) + ')">' + esc(d === "*" ? "全部" : d) + "</button>";
 })).join("") + "</div>";
 if (S.arg.dept === "*") {
  var all = S.teamAll && Date.now() - S.teamAll.at < 6e4 ? S.teamAll.list : null;
  if (!all) {
   $("app").innerHTML = h + loading("讀取您管理的各課…");
   Promise.all(ds.map((function(d) {
    return apiR("team", {
     deptId: d
    });
   }))).then((function(rs) {
    S.teamAll = {
     at: Date.now(),
     list: rs
    };
    if (S.page === "team") render();
   })).catch((function(e) {
    $("app").innerHTML = h + '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + esc(e.message) + "</div></div></div></div>";
   }));
   return;
  }
  $("app").innerHTML = h + (isDesk() ? tovHtml(all) : tovMobile(all));
  return;
  var nOps = 0;
  all.forEach((function(t) {
   nOps += t.people.filter((function(p) {
    return p.role === "檢點人員";
   })).length;
  }));
  h += '<div class="muted upnote">您管理 ' + all.length + " 個課、" + nOps + " 位檢點人員。點課名可以調整那一課的人員、表單、設備。</div>";
  h += all.map((function(t) {
   var nm = {};
   t.targets.forEach((function(x) {
    nm[x.key] = x.name;
   }));
   var ops = t.people.filter((function(p) {
    return p.role === "檢點人員";
   }));
   var none = t.targets.filter((function(x) {
    return !x.now.length;
   })).length;
   return '<div class="card tmall"><button class="tmh" onclick="teamDept(' + jsq(t.dept) + ')"><span class="mn"><span class="nm">' + esc(t.dept) + '</span><span class="mt">' + esc(ops.length + " 位檢點人員・" + t.targets.length + " 項表單或設備") + "</span>" + (none ? '<span class="mt wn">' + esc(none + " 項沒有人負責") + "</span>" : "") + "</span>" + ic("chev", 18, 2.6) + "</button>" + (ops.length ? '<div class="list">' + ops.map((function(p) {
    var mine = p.forms.concat(p.equips).map((function(k) {
     return nm[k];
    })).filter(Boolean);
    return '<div class="li"><span class="mn"><span class="nm">' + esc(p.name) + '</span><span class="mt' + (!p.loggedIn || !p.signed ? " wn" : "") + '">' + esc((p.loggedIn ? "已登入" : "還沒登入") + "・" + (p.signed ? "已簽名" : "還沒簽名") + "・" + (mine.length ? "負責 " + mine.length + " 項" : "沒有負責的表")) + "</span></span></div>";
   })).join("") + "</div>" : '<div class="empty">這一課還沒有檢點人員</div>') + "</div>";
  })).join("");
  $("app").innerHTML = h;
  return;
 }
 if (!tm) {
  $("app").innerHTML = h + loading("讀取本課分工…");
  teamLoad(S.arg.dept).then((function() {
   if (S.page === "team") render();
  })).catch((function(e) {
   $("app").innerHTML = h + '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + esc(e.message) + "</div></div></div></div>";
  }));
  return;
 }
 var tab = S.arg.tab, forms = tm.targets.filter((function(x) {
  return x.kind === "form";
 })), eqs = tm.targets.filter((function(x) {
  return x.kind === "equip";
 }));
 var ops = tm.people.filter((function(p) {
  return p.role === "檢點人員";
 }));
 h += '<div class="seg" role="tablist">' + (isDesk() ? [ [ "ov", "總覽" ], [ "grid", "分工表" ] ] : [ [ "ov", "總覽" ] ]).concat([ [ "people", "人員 " + ops.length ], [ "form", "表單 " + forms.length ], [ "equip", "設備 " + eqs.length ] ]).map((function(t) {
  return '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? "on" : "") + '" onclick="teamTab(' + jsq(t[0]) + ')">' + esc(t[1]) + "</button>";
 })).join("") + "</div>";
 var nameOf = {};
 tm.targets.forEach((function(x) {
  nameOf[x.key] = x.name;
 }));
 if (tab === "grid") {
  $("app").innerHTML = h + tmxHtml(tm);
  tmxBar(tm);
  return;
 }
 if (tab === "ov") {
  $("app").innerHTML = h + (isDesk() ? tovHtml([ tm ]) : tovMobile([ tm ]));
  return;
 }
 if (tab === "people") {
  h += '<div class="muted upnote">點一位同仁，勾選他負責的表單和設備。人員、表單、設備的新增或停用請洽環安衛中心。</div>';
  h += '<div class="list">' + tm.people.map((function(p) {
   var mine = p.forms.concat(p.equips).map((function(k) {
    return nameOf[k];
   }));
   var st = [ p.loggedIn ? "已登入" : "還沒登入", p.signed ? "已簽名" : "還沒簽名" ].join("・");
   var warn = p.role === "檢點人員" && (!p.loggedIn || !p.signed);
   var inner = '<span class="mn"><span class="nm">' + esc(p.name) + (p.role !== "檢點人員" ? '　<small class="muted">' + esc(p.role) + "</small>" : "") + "</span>" + '<span class="mt' + (warn ? " wn" : "") + '">' + esc(st) + "</span>" + (p.role === "檢點人員" ? '<span class="mt">' + esc(mine.length ? "負責 " + mine.length + " 項：" + mine.join("、") : "目前沒有負責的表或設備") + "</span>" : '<span class="mt">審核本課紀錄，可代填</span>') + "</span>";
   return p.role === "檢點人員" ? '<button class="li" onclick="go(\'teamPerson\',{dept:' + jsq(tm.dept) + ",name:" + jsq(p.name) + '})">' + inner + "</button>" : '<div class="li">' + inner + "</div>";
  })).join("") + "</div>";
 } else if (tab === "equip") {
  $("app").innerHTML = h + teqListHtml(tm);
  teqDragInit(tm);
  return;
 } else {
  var list = tab === "form" ? forms : eqs;
  if (tab === "form" && isEhs() && tm.ehs) h += '<button class="btn ghost" onclick="go(\'deptForms\',{dept:' + jsq(tm.dept) + '})">' + ic("pen", 18, 2.4) + "本課要用的表（環安衛設定）</button>";
  h += '<div class="muted upnote">點一項調整負責人：可以今天起生效，或排到下個月 1 日。</div>';
  h += list.length ? '<div class="list">' + list.map((function(x) {
   var per = (x.periodic || []).map((function(y) {
    return '<span class="mt">' + esc((x.periodic.length > 1 || x.kind === "equip" ? y.name + "・" : "") + perLine(y)) + "</span>";
   })).join("");
   var worst = (x.periodic || []).map((function(y) {
    return y.state;
   })).sort((function(a, b) {
    return [ "overdue", "never", "soon", "ok" ].indexOf(a) - [ "overdue", "never", "soon", "ok" ].indexOf(b);
   }))[0];
   return '<button class="li" onclick="go(\'teamEdit\',{dept:' + jsq(tm.dept) + ",key:" + jsq(x.key) + '})"><span class="mn"><span class="nm">' + esc(x.name) + "</span>" + '<span class="mt' + (x.now.length ? "" : " wn") + '">' + esc((x.daily ? "每日・" : "") + "負責：" + (x.now.join("、") || "沒有人（不使用）")) + "</span>" + (x.next ? '<span class="mt inf">' + esc(Number(tm.month.slice(5)) + " 月起：" + (x.next.join("、") || "沒有人")) + "</span>" : "") + per + "</span>" + (worst ? perPill({
    state: worst
   }) : "") + "</button>";
  })).join("") + "</div>" : '<div class="empty">本課沒有' + (tab === "form" ? "開放的表單" : "設備") + "</div>";
 }
 $("app").innerHTML = h;
};

var TOV_ST = {
 overdue: [ "ng", "已到期" ],
 never: [ "na", "尚無紀錄" ],
 soon: [ "warn", "快到期" ],
 ok: [ "ok", "期限內" ]
};

var TOV_COLS = [ "每日", "每月", "每年", "其他週期" ];

function tovShort(n) {
 return String(n || "").replace(/（[^）]*）$/, "").replace(/(每日作業、操作前|每日作業前|作業前)?檢點表$|定期檢查紀錄表$|作業檢點表$/, "");
}

function tovCol(fq) {
 return fq === "每日" || fq === "作業日" ? 0 : fq === "每月" ? 1 : fq === "每年" ? 2 : 3;
}

function tovTag(name, freq, st, sub) {
 var s = st ? TOV_ST[st] : null;
 return '<span class="tvf' + (s ? " " + s[0] : "") + '" title="' + esc(name + (sub ? "・" + sub : "")) + '"><i></i><b>' + esc(tovShort(name)) + "</b>" + (freq && tovCol(freq) === 3 ? "<em>" + esc(freq) + "</em>" : "") + (s && st !== "ok" ? "<u>" + esc(s[1]) + "</u>" : "") + "</span>";
}

function tovWho(names) {
 return names.length ? names.map((function(n) {
  return '<span class="tvp" data-raw>' + esc(n) + "</span>";
 })).join("") : '<span class="tvnone">未指派</span>';
}

function tovGo(dept, page, arg) {
 if (S.team && S.team.dept === dept) return go(page, Object.assign({
  dept
 }, arg));
 busyOn("讀取中…");
 teamLoad(dept).then((function() {
  busyOff();
  go(page, Object.assign({
   dept
  }, arg));
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4e3);
 }));
}

function tovSet(k, v) {
 S.arg[k] = v;
 render();
}

function tovFold(k) {
 var f = S.arg.fold = S.arg.fold || {};
 f[k] = !f[k];
 render();
}

function tovOpen(k) {
 var o = S.arg.open = S.arg.open || {};
 o[k] = !o[k];
 render();
}

function tovQ(v) {
 S.arg.q = v;
 clearTimeout(S.tovT);
 S.tovT = setTimeout((function() {
  var c = $("tovq"), at = c ? c.selectionStart : 0;
  render();
  var e = $("tovq");
  if (e) {
   e.focus();
   try {
    e.setSelectionRange(at, at);
   } catch (x) {}
  }
 }), 250);
}

function tovCells(x) {
 var c = [ [], [], [], [] ], worst = "";
 if (x.kind === "equip" && x.dailyForm) c[0].push({
  name: x.dailyForm.name,
  freq: "每日"
 });
 if (x.kind === "form" && x.daily) c[0].push({
  name: x.name,
  freq: "每日"
 });
 (x.periodic || []).forEach((function(y) {
  c[tovCol(y.freq)].push({
   name: y.name,
   freq: y.freq,
   st: y.state,
   sub: perLine(y)
  });
 }));
 (x.periodic || []).forEach((function(y) {
  if ([ "overdue", "never", "soon", "ok" ].indexOf(y.state) < [ "overdue", "never", "soon", "ok", "" ].indexOf(worst || "")) worst = y.state;
 }));
 return {
  c,
  worst
 };
}

function tovMatch(x, f) {
 if (f === "none") return !x.now.length;
 if (f === "overdue" || f === "never" || f === "soon") return (x.periodic || []).some((function(y) {
  return y.state === f;
 }));
 return true;
}

function tovHtml(list) {
 var mode = S.arg.ov || "equip", q = String(S.arg.q || "").trim().toLowerCase(), multi = list.length > 1, flt = S.arg.flt || "all";
 var fold = S.arg.fold || {}, open = S.arg.open || {};
 var nOp = 0, nOff = 0, nEq = 0, nF = 0, cnt = {
  none: 0,
  overdue: 0,
  never: 0,
  soon: 0
 };
 list.forEach((function(t) {
  t.people.forEach((function(p) {
   if (p.role === "檢點人員") {
    nOp++;
    if (!p.loggedIn || !p.signed) nOff++;
   }
  }));
  t.targets.forEach((function(x) {
   if (x.kind === "equip") nEq++; else nF++;
   if (!x.now.length) cnt.none++;
   [ "overdue", "never", "soon" ].forEach((function(s) {
    if (tovMatch(x, s)) cnt[s]++;
   }));
  }));
 }));
 var stat = function(n, l, s, tone) {
  return '<div class="tvk' + (tone ? " " + tone : "") + '"><span class="kn" data-raw>' + n + '</span><span class="kl">' + esc(l) + "</span>" + (s ? '<span class="ks">' + esc(s) + "</span>" : "") + "</div>";
 };
 var h = '<div class="tvstats">' + stat(nOp, "檢點人員", nOff ? nOff + " 位還沒登入或簽名" : "都已登入、簽名", nOff ? "warn" : "") + stat(nEq, "設備", "", "") + stat(nF, "區域型檢點表", "不分設備的每日、定期表") + stat(cnt.none, "未指派", "設備或表單沒有負責人", cnt.none ? "warn" : "") + stat(cnt.overdue, "定期檢查已到期", cnt.soon ? cnt.soon + " 項 30 天內到期" : "", cnt.overdue ? "ng" : "") + "</div>";
 var fb = [ [ "all", "全部", 0 ], [ "none", "未指派", cnt.none ], [ "overdue", "已到期", cnt.overdue ], [ "never", "尚無紀錄", cnt.never ], [ "soon", "快到期", cnt.soon ] ];
 h += '<div class="tvbar"><div class="tvseg" role="tablist">' + [ [ "equip", "依設備" ], [ "people", "依人員" ] ].map((function(m) {
  return '<button role="tab" aria-selected="' + (mode === m[0]) + '" class="' + (mode === m[0] ? "on" : "") + "\" onclick=\"tovSet('ov'," + jsq(m[0]) + ')">' + esc(m[1]) + "</button>";
 })).join("") + '</div><div class="tvflt">' + fb.map((function(b) {
  return '<button class="' + (flt === b[0] ? "on" : "") + (b[0] !== "all" && !b[2] ? " zero" : "") + "\" onclick=\"tovSet('flt'," + jsq(b[0]) + ')">' + esc(b[1]) + (b[0] !== "all" ? "<i data-raw>" + b[2] + "</i>" : "") + "</button>";
 })).join("") + '</div><label class="tvsearch">' + ic("search", 16, 2.4) + '<input id="tovq" type="search" placeholder="篩選：設備、表單或人名" value="' + esc(S.arg.q || "") + '" oninput="tovQ(this.value)"></label>' + '<button class="btn ghost sm tvx" onclick="tovExport()">' + ic("down", 16, 2.4) + "匯出 Excel</button></div>";
 var hit = function(s) {
  return !q || String(s).toLowerCase().indexOf(q) >= 0;
 };
 var rowsOut = [];
 if (mode === "equip") {
  var body = "";
  list.forEach((function(t) {
   var groups = {}, order = [];
   t.targets.forEach((function(x) {
    var g = x.kind === "equip" ? x.cat || "設備" : "區域型檢點（不分設備）";
    if (!groups[g]) {
     groups[g] = [];
     order.push(g);
    }
    groups[g].push(x);
   }));
   order.sort((function(a, b) {
    return (a.indexOf("區域型") === 0) - (b.indexOf("區域型") === 0);
   }));
   var rows = "", dk = "d:" + t.dept, sum = {
    n: 0,
    none: 0,
    bad: 0
   };
   order.forEach((function(g) {
    var rs = groups[g].filter((function(x) {
     var c = tovCells(x).c, txt = [ x.name, x.loc, x.now.join(" ") ].concat(c.map((function(l) {
      return l.map((function(y) {
       return y.name;
      })).join(" ");
     }))).join(" ");
     return tovMatch(x, flt) && hit(txt);
    }));
    if (!rs.length) return;
    var gk = dk + "|" + g, none = rs.filter((function(x) {
     return !x.now.length;
    })).length, bad = rs.filter((function(x) {
     return tovMatch(x, "overdue");
    })).length;
    sum.n += rs.length;
    sum.none += none;
    sum.bad += bad;
    rows += '<tr class="tvg" onclick="tovFold(' + jsq(gk) + ')"><td colspan="6"><span class="tvcar' + (fold[gk] ? " shut" : "") + '">' + ic("chev", 14, 2.6) + "</span>" + esc(g) + "<small data-raw>" + rs.length + "</small>" + (none ? '<span class="tvgs warn">' + esc("未指派 " + none) + "</span>" : "") + (bad ? '<span class="tvgs ng">' + esc("已到期 " + bad) + "</span>" : "") + "</td></tr>";
    if (fold[gk]) return;
    rows += rs.map((function(x) {
     var cc = tovCells(x).c, label = x.kind === "equip" ? (x.obj || x.name) + (x.part ? "・" + x.part : "") : tovShort(x.name), sub = x.kind === "equip" ? x.loc || "" : x.form || "";
     rowsOut.push([ t.dept, g, label, sub ].concat(cc.map((function(l) {
      return l.map((function(y) {
       return tovShort(y.name) + (y.st && y.st !== "ok" ? "（" + TOV_ST[y.st][1] + "）" : "");
      })).join("、");
     })), [ x.now.join("、") || "未指派" ]));
     return '<tr class="' + (x.now.length ? "" : "none") + '" onclick="tovGo(' + jsq(t.dept) + ",'teamEdit',{key:" + jsq(x.key) + '})"><td class="tveq"><b data-raw>' + esc(label) + "</b><small>" + esc(sub) + "</small></td>" + cc.map((function(l) {
      return '<td class="tvc">' + (l.length ? l.map((function(y) {
       return tovTag(y.name, y.freq, y.st, y.sub);
      })).join("") : '<span class="tvdash">—</span>') + "</td>";
     })).join("") + '<td class="tvwho">' + tovWho(x.now) + (x.next ? '<div class="tvnx">' + esc(Number(t.month.slice(5)) + " 月起：" + (x.next.join("、") || "沒有人")) + "</div>" : "") + "</td></tr>";
    })).join("");
   }));
   if (!rows) return;
   body += (multi ? '<div class="tvdept" onclick="tovFold(' + jsq(dk) + ')"><span class="tvcar' + (fold[dk] ? " shut" : "") + '">' + ic("chev", 14, 2.6) + "</span>" + esc(t.dept) + "<small>" + esc(sum.n + " 項") + (sum.none ? "・" + esc("未指派 " + sum.none) : "") + (sum.bad ? "・" + esc("已到期 " + sum.bad) : "") + "</small></div>" : "") + (fold[dk] ? "" : '<div class="tvwrap"><table class="tvt"><thead><tr><th>設備／表單</th>' + TOV_COLS.map((function(c) {
    return '<th class="tvc">' + esc(c) + "</th>";
   })).join("") + "<th>負責人</th></tr></thead><tbody>" + rows + "</tbody></table></div>");
  }));
  h += body || '<div class="empty">沒有符合的設備或表單</div>';
  S.tovRows = [ [ "課別", "分組", "設備／表單", "位置／編號" ].concat(TOV_COLS, [ "負責人" ]) ].concat(rowsOut);
 } else {
  var body2 = "";
  list.forEach((function(t) {
   var by = {};
   t.targets.forEach((function(x) {
    by[x.key] = x;
   }));
   var ps = t.people.filter((function(p) {
    return p.role === "檢點人員";
   })).map((function(p) {
    var mine = p.equips.concat(p.forms).map((function(k) {
     return by[k];
    })).filter(Boolean), n = [ 0, 0, 0, 0 ], bad = 0;
    mine.forEach((function(x) {
     tovCells(x).c.forEach((function(l, i) {
      n[i] += l.length;
     }));
     if (tovMatch(x, "overdue")) bad++;
    }));
    return {
     p,
     mine,
     n,
     bad,
     eq: p.equips.length
    };
   })).filter((function(o) {
    var ok = flt === "all" ? true : flt === "none" ? !o.mine.length : o.mine.some((function(x) {
     return tovMatch(x, flt);
    }));
    return ok && hit(o.p.name + " " + o.mine.map((function(x) {
     return x.name;
    })).join(" "));
   }));
   if (!ps.length) return;
   var dk = "p:" + t.dept;
   var rows = ps.map((function(o) {
    var p = o.p, k = t.dept + "|" + p.name, warn = [ !p.loggedIn ? "還沒登入" : "", !p.signed ? "還沒簽名" : "" ].filter(String);
    rowsOut.push([ t.dept, p.name, o.eq ].concat(o.n, [ o.mine.map((function(x) {
     return x.kind === "equip" ? (x.cat || "") + " " + (x.obj || "") : tovShort(x.name);
    })).join("、"), warn.join("、") ]));
    var r = '<tr class="' + (o.mine.length ? "" : "none") + (open[k] ? " opn" : "") + '" onclick="tovOpen(' + jsq(k) + ')"><td class="tveq"><span class="tvcar' + (open[k] ? "" : " shut") + '">' + ic("chev", 14, 2.6) + "</span><b data-raw>" + esc(p.name) + "</b>" + (warn.length ? '<span class="tvw">' + esc(warn.join("・")) + "</span>" : "") + '</td><td class="tvn" data-raw>' + (o.eq || "—") + "</td>" + o.n.map((function(v) {
     return '<td class="tvn" data-raw>' + (v || '<span class="tvdash">—</span>') + "</td>";
    })).join("") + '<td class="tvn">' + (o.bad ? '<span class="tvgs ng">' + esc("已到期 " + o.bad) + "</span>" : o.mine.length ? "" : '<span class="tvnone">未負責</span>') + "</td>" + '<td class="tvact"><button class="btn ghost sm" onclick="event.stopPropagation();tovGo(' + jsq(t.dept) + ",'teamPerson',{name:" + jsq(p.name) + '})">調整</button></td></tr>';
    if (open[k]) r += '<tr class="tvdet"><td colspan="9">' + (o.mine.length ? o.mine.map((function(x) {
     var cc = tovCells(x).c, all = [];
     cc.forEach((function(l) {
      all = all.concat(l);
     }));
     return '<div class="tvpi"><span class="tvpe" data-raw>' + esc(x.kind === "equip" ? (x.cat || "") + " " + (x.obj || "") + (x.part ? "・" + x.part : "") : "區域型") + '</span><span class="tvfs">' + all.map((function(y) {
      return tovTag(y.name, y.freq, y.st, y.sub);
     })).join("") + "</span></div>";
    })).join("") : '<div class="tvnone pad">沒有負責任何設備或表單</div>') + "</td></tr>";
    return r;
   })).join("");
   body2 += (multi ? '<div class="tvdept" onclick="tovFold(' + jsq(dk) + ')"><span class="tvcar' + (fold[dk] ? " shut" : "") + '">' + ic("chev", 14, 2.6) + "</span>" + esc(t.dept) + "<small>" + esc(ps.length + " 位檢點人員") + "</small></div>" : "") + (fold[dk] ? "" : '<div class="tvwrap"><table class="tvt tvpp"><thead><tr><th>人員</th><th class="tvn">設備</th>' + TOV_COLS.map((function(c) {
    return '<th class="tvn">' + esc(c) + "</th>";
   })).join("") + '<th class="tvn">狀態</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>");
  }));
  h += body2 || '<div class="empty">沒有符合的人員</div>';
  S.tovRows = [ [ "課別", "人員", "設備（台）" ].concat(TOV_COLS, [ "負責的設備與表單", "提醒" ]) ].concat(rowsOut);
 }
 return h;
}

function tovExport() {
 var rows = S.tovRows || [];
 if (rows.length < 2) return toast("目前沒有資料可以匯出", "err");
 var csv = "\ufeff" + rows.map((function(r) {
  return r.map((function(v) {
   v = String(v == null ? "" : v);
   return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  })).join(",");
 })).join("\r\n");
 var a = document.createElement("a"), t = today();
 a.href = URL.createObjectURL(new Blob([ csv ], {
  type: "text/csv;charset=utf-8"
 }));
 a.download = "分工總覽_" + (S.arg.ov === "people" ? "依人員" : "依設備") + "_" + t.replace(/-/g, "") + ".csv";
 document.body.appendChild(a);
 a.click();
 setTimeout((function() {
  URL.revokeObjectURL(a.href);
  a.parentNode.removeChild(a);
 }), 500);
}

function tovMobile(list) {
 var mode = S.arg.ov || "equip", q = String(S.arg.q || "").trim().toLowerCase(), multi = list.length > 1, flt = S.arg.flt || "all";
 var fold = S.arg.fold || {}, open = S.arg.open || {}, FQ = [ "每日", "每月", "每年", "其他" ];
 var nOp = 0, nOff = 0, nEq = 0, cnt = {
  none: 0,
  overdue: 0,
  never: 0,
  soon: 0
 };
 list.forEach((function(t) {
  t.people.forEach((function(p) {
   if (p.role === "檢點人員") {
    nOp++;
    if (!p.loggedIn || !p.signed) nOff++;
   }
  }));
  t.targets.forEach((function(x) {
   if (x.kind === "equip") nEq++;
   if (!x.now.length) cnt.none++;
   [ "overdue", "never", "soon" ].forEach((function(s) {
    if (tovMatch(x, s)) cnt[s]++;
   }));
  }));
 }));
 var st = function(n, l, tone) {
  return '<div class="tmk' + (tone ? " " + tone : "") + '"><b data-raw>' + n + "</b><span>" + esc(l) + "</span></div>";
 };
 var h = '<div class="tmks">' + st(nOp, nOff ? "檢點人員・" + nOff + " 位未就緒" : "檢點人員", nOff ? "warn" : "") + st(nEq, "設備", "") + st(cnt.none, "未指派", cnt.none ? "warn" : "") + st(cnt.overdue, "定期檢查已到期", cnt.overdue ? "ng" : "") + "</div>";
 h += '<div class="seg two" role="tablist">' + [ [ "equip", "依設備" ], [ "people", "依人員" ] ].map((function(m) {
  return '<button role="tab" aria-selected="' + (mode === m[0]) + '" class="' + (mode === m[0] ? "on" : "") + "\" onclick=\"tovSet('ov'," + jsq(m[0]) + ')">' + esc(m[1]) + "</button>";
 })).join("") + "</div>";
 h += '<div class="chips tmflt">' + [ [ "all", "全部", 0 ], [ "none", "未指派", cnt.none ], [ "overdue", "已到期", cnt.overdue ], [ "never", "尚無紀錄", cnt.never ], [ "soon", "快到期", cnt.soon ] ].map((function(b) {
  return '<button class="chip' + (flt === b[0] ? " on" : "") + "\" onclick=\"tovSet('flt'," + jsq(b[0]) + ')">' + esc(b[1]) + (b[0] !== "all" ? '<i class="tmc" data-raw>' + b[2] + "</i>" : "") + "</button>";
 })).join("") + "</div>";
 h += '<label class="tmsearch">' + ic("search", 18, 2.4) + '<input id="tovq" type="search" placeholder="篩選：設備、表單或人名" value="' + esc(S.arg.q || "") + '" oninput="tovQ(this.value)"></label>';
 var hit = function(s) {
  return !q || String(s).toLowerCase().indexOf(q) >= 0;
 };
 var chips = function(x) {
  var c = tovCells(x).c, out = "";
  c.forEach((function(l, i) {
   l.forEach((function(y) {
    out += '<span class="tmf' + (y.st ? " " + TOV_ST[y.st][0] : "") + '"><em>' + esc(i === 3 ? y.freq : FQ[i]) + "</em>" + esc(tovShort(y.name)) + (y.st && y.st !== "ok" ? "<u>" + esc(TOV_ST[y.st][1]) + "</u>" : "") + "</span>";
   }));
  }));
  return out || '<span class="tvnone">沒有對應的檢點表</span>';
 };
 var body = "";
 list.forEach((function(t) {
  var dk = (mode === "equip" ? "d:" : "p:") + t.dept, inner = "";
  if (mode === "equip") {
   var groups = {}, order = [];
   t.targets.forEach((function(x) {
    var g = x.kind === "equip" ? x.cat || "設備" : "區域型檢點（不分設備）";
    if (!groups[g]) {
     groups[g] = [];
     order.push(g);
    }
    groups[g].push(x);
   }));
   order.sort((function(a, b) {
    return (a.indexOf("區域型") === 0) - (b.indexOf("區域型") === 0);
   }));
   order.forEach((function(g) {
    var rs = groups[g].filter((function(x) {
     return tovMatch(x, flt) && hit([ x.name, x.loc, x.now.join(" ") ].join(" "));
    }));
    if (!rs.length) return;
    var gk = dk + "|" + g;
    inner += '<button class="tmg" onclick="tovFold(' + jsq(gk) + ')"><span class="tvcar' + (fold[gk] ? " shut" : "") + '">' + ic("chev", 14, 2.6) + "</span>" + esc(g) + "<small data-raw>" + rs.length + "</small></button>";
    if (fold[gk]) return;
    inner += '<div class="list">' + rs.map((function(x) {
     var label = x.kind === "equip" ? (x.obj || x.name) + (x.part ? "・" + x.part : "") : tovShort(x.name);
     return '<button class="li tmr' + (x.now.length ? "" : " none") + '" onclick="tovGo(' + jsq(t.dept) + ",'teamEdit',{key:" + jsq(x.key) + '})"><span class="mn">' + '<span class="nm" data-raw>' + esc(label) + (x.kind === "equip" && x.loc ? "<small> " + esc(x.loc) + "</small>" : "") + "</span>" + '<span class="tmfs">' + chips(x) + '</span><span class="tmw">' + tovWho(x.now) + "</span></span>" + ic("chev", 18, 2.6) + "</button>";
    })).join("") + "</div>";
   }));
  } else {
   var by = {};
   t.targets.forEach((function(x) {
    by[x.key] = x;
   }));
   var ps = t.people.filter((function(p) {
    return p.role === "檢點人員";
   })).map((function(p) {
    var mine = p.equips.concat(p.forms).map((function(k) {
     return by[k];
    })).filter(Boolean), n = [ 0, 0, 0, 0 ];
    mine.forEach((function(x) {
     tovCells(x).c.forEach((function(l, i) {
      n[i] += l.length;
     }));
    }));
    return {
     p,
     mine,
     n,
     bad: mine.filter((function(x) {
      return tovMatch(x, "overdue");
     })).length
    };
   })).filter((function(o) {
    return (flt === "all" || (flt === "none" ? !o.mine.length : o.mine.some((function(x) {
     return tovMatch(x, flt);
    })))) && hit(o.p.name + " " + o.mine.map((function(x) {
     return x.name;
    })).join(" "));
   }));
   if (ps.length) inner += '<div class="list">' + ps.map((function(o) {
    var p = o.p, k = t.dept + "|" + p.name, warn = [ !p.loggedIn ? "還沒登入" : "", !p.signed ? "還沒簽名" : "" ].filter(String);
    var sum = o.mine.length ? [ p.equips.length ? p.equips.length + " 台設備" : "" ].concat(o.n.map((function(v, i) {
     return v ? FQ[i] + " " + v : "";
    }))).filter(String).join("・") : "未負責";
    var r = '<div class="li tmp' + (o.mine.length ? "" : " none") + '" onclick="tovOpen(' + jsq(k) + ')"><span class="tvcar' + (open[k] ? "" : " shut") + '">' + ic("chev", 14, 2.6) + '</span><span class="mn"><span class="nm" data-raw>' + esc(p.name) + (warn.length ? ' <span class="tvw">' + esc(warn.join("・")) + "</span>" : "") + '</span><span class="mt">' + esc(sum) + (o.bad ? "" : "") + "</span>" + (o.bad ? '<span class="mt"><span class="tvgs ng">' + esc("已到期 " + o.bad) + "</span></span>" : "") + "</span>" + '<button class="btn ghost sm" onclick="event.stopPropagation();tovGo(' + jsq(t.dept) + ",'teamPerson',{name:" + jsq(p.name) + '})">調整</button></div>';
    if (open[k]) r += '<div class="tmdet">' + (o.mine.length ? o.mine.map((function(x) {
     return '<div class="tmdi"><b data-raw>' + esc(x.kind === "equip" ? (x.cat || "") + " " + (x.obj || "") + (x.part ? "・" + x.part : "") : "區域型") + '</b><span class="tmfs">' + chips(x) + "</span></div>";
    })).join("") : '<div class="tvnone pad">沒有負責任何設備或表單</div>') + "</div>";
    return r;
   })).join("") + "</div>";
  }
  if (!inner) return;
  body += (multi ? '<button class="tvdept tmd" onclick="tovFold(' + jsq(dk) + ')"><span class="tvcar' + (fold[dk] ? " shut" : "") + '">' + ic("chev", 14, 2.6) + "</span>" + esc(t.dept) + "</button>" : "") + (fold[dk] ? "" : inner);
 }));
 return h + (body || '<div class="empty">' + esc(mode === "equip" ? "沒有符合的設備或表單" : "沒有符合的人員") + "</div>");
}

function teamDept(d) {
 S.arg = {
  dept: d,
  tab: S.arg.dept === "*" ? "ov" : S.arg.tab,
  ov: S.arg.ov
 };
 S.team = null;
 render();
}

function teamTab(t) {
 S.arg.tab = t;
 render();
}

PAGES.teamEdit = function() {
 if (/^[EQ]:/.test(S.arg.key || "")) {
  var ka = S.arg.key.split(":");
  return go("teamEq", {
   dept: S.arg.dept,
   cat: ka[1],
   obj: ka.slice(2).join(":")
  }, true);
 }
 var tm = S.team, tg = tm && tm.targets.filter((function(x) {
  return x.key === S.arg.key;
 }))[0];
 if (!tg) return back();
 setTitle(tg.kind === "equip" ? "設備負責人" : "表單負責人");
 var ops = tm.people.filter((function(p) {
  return p.role === "檢點人員";
 })).map((function(p) {
  return p.name;
 }));
 if (!S.arg.want) S.arg.want = tg.now.slice();
 var want = S.arg.want, mo = Number(tm.month.slice(5)) + " 月";
 var h = '<div class="card"><div class="mr"><b>' + esc(tg.name) + "</b></div>" + (tg.uses && tg.uses.length ? '<div class="muted">用到：' + esc(tg.uses.join("、")) + "</div>" : "") + (tg.periodic || []).map((function(y) {
  return '<div class="muted">' + esc(y.name + "・" + perLine(y)) + " " + perPill(y) + "</div>";
 })).join("") + '<div class="muted">目前負責：' + esc(tg.now.join("、") || "沒有人") + (tg.next ? "；" + mo + "起：" + esc(tg.next.join("、") || "沒有人") : "") + "</div></div>";
 h += '<div class="sec">勾選負責人</div><div class="card">' + ops.map((function(n) {
  return '<label class="ck"><input type="checkbox" ' + (want.indexOf(n) >= 0 ? "checked" : "") + ' onchange="teamTick(' + jsq(n) + ',this.checked)">' + esc(n) + "</label>";
 })).join("") + (ops.length ? "" : '<div class="muted">本課還沒有檢點人員</div>') + "</div>";
 if (!want.length) h += '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">沒有負責人＝這' + (tg.kind === "equip" ? "台設備" : "張表") + "本課不再使用（手機上看不到、不算缺漏）。</div></div></div></div>";
 h += '<div class="muted upnote">「今天起」：馬上換人，今天以前的紀錄照舊歸原負責人。「下月起」：這個月照舊，' + mo + " 1 日自動換。當事人都會收到 App 通知。</div>";
 $("app").innerHTML = h;
 var same = want.slice().sort().join() === tg.now.slice().sort().join();
 bar('<div class="btns r21"><button class="btn" id="teNow" onclick="teamSave(\'now\')"' + (same ? " disabled" : "") + ">" + ic("check", 22, 2.8) + "今天起生效</button>" + '<button class="btn ghost" onclick="teamSave(\'next\')">' + "下月起（" + esc(mo) + "）</button></div>");
};

function teamTick(n, on) {
 var w = S.arg.want || [];
 if (on && w.indexOf(n) < 0) w.push(n);
 if (!on) w = w.filter((function(x) {
  return x !== n;
 }));
 S.arg.want = w;
 render();
}

function teamSave(when) {
 var tm = S.team, tg = tm && tm.targets.filter((function(x) {
  return x.key === S.arg.key;
 }))[0];
 if (!tg) return;
 if (!navigator.onLine) return toast("沒有網路，調整要連上網路才能存", "err", 3500);
 var want = S.arg.want || [];
 if (!want.length && !confirm("沒有勾任何人＝這" + (tg.kind === "equip" ? "台設備" : "張表") + "本課不再使用。確定嗎？")) return;
 busyOn("儲存中…");
 var p = when === "now" ? api("assignNow", {
  deptId: tm.dept,
  target: tg.key,
  names: want
 }) : api("nextSet", {
  deptId: tm.dept,
  target: tg.key,
  names: want
 }).then((function() {
  return teamLoad(tm.dept);
 }));
 p.then((function(r) {
  if (when === "now") S.team = r;
  S.teamAll = null;
  busyOff();
  toast(when === "now" ? "已改好，今天起生效；相關人員會收到通知" : "已安排，" + Number(tm.month.slice(5)) + " 月 1 日生效", "ok", 3500);
  if (when === "now") refreshMe();
  back();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4500);
 }));
}

PAGES.teamPerson = function() {
 var tm = S.team, name = S.arg.name;
 if (!tm) return back();
 setTitle(name + " 的分工");
 if (!S.arg.pick) {
  S.arg.pick = {};
  tm.targets.forEach((function(x) {
   S.arg.pick[x.key] = x.now.indexOf(name) >= 0;
  }));
 }
 var pk = S.arg.pick, sec = function(kind, title) {
  var list = tm.targets.filter((function(x) {
   return x.kind === kind;
  }));
  if (!list.length) return "";
  return '<div class="sec">' + title + '</div><div class="card">' + list.map((function(x) {
   var others = x.now.filter((function(n) {
    return n !== name;
   }));
   return '<label class="ck"><input type="checkbox" ' + (pk[x.key] ? "checked" : "") + ' onchange="S.arg.pick[' + jsq(x.key) + ']=this.checked;render()"><span>' + esc(x.name) + (others.length ? '<small class="muted">　也負責：' + esc(others.join("、")) + "</small>" : "") + "</span></label>";
  })).join("") + "</div>";
 };
 var mo = Number(tm.month.slice(5)) + " 月";
 $("app").innerHTML = '<div class="muted upnote">勾選 ' + esc(name) + " 負責的表單與設備。同一項可以多人一起負責；取消勾選不會影響其他人。</div>" + '<button class="btn ghost" onclick="teamHandover(' + jsq(tm.dept) + "," + jsq(name) + ')">' + ic("swap", 18, 2.4) + "全部轉給別人（請假、離職交接）</button>" + sec("form", "表單") + sec("equip", "設備");
 var n = teamPersonDiff().length;
 bar('<div class="btns r21"><button class="btn"' + (n ? "" : " disabled") + " onclick=\"teamPersonSave('now')\">" + ic("check", 22, 2.8) + (n ? "今天起生效（" + n + " 項）" : "沒有變更") + "</button>" + '<button class="btn ghost"' + (n ? "" : " disabled") + " onclick=\"teamPersonSave('next')\">" + "下月起（" + esc(mo) + "）</button></div>");
};

function teamPersonDiff() {
 var tm = S.team, name = S.arg.name, pk = S.arg.pick || {};
 return tm.targets.filter((function(x) {
  return !!pk[x.key] !== x.now.indexOf(name) >= 0;
 })).map((function(x) {
  var w = x.now.filter((function(n) {
   return n !== name;
  }));
  if (pk[x.key]) w.push(name);
  return {
   key: x.key,
   names: w
  };
 }));
}

function teamPersonSave(when) {
 var tm = S.team, ch = teamPersonDiff();
 if (!ch.length) return;
 if (!navigator.onLine) return toast("沒有網路，調整要連上網路才能存", "err", 3500);
 busyOn("儲存中…", "共 " + ch.length + " 項");
 var i = 0, step = function() {
  if (i >= ch.length) return teamLoad(tm.dept);
  var c = ch[i++];
  return api(when === "now" ? "assignNow" : "nextSet", {
   deptId: tm.dept,
   target: c.key,
   names: c.names
  }).then(step);
 };
 step().then((function() {
  S.teamAll = null;
  busyOff();
  toast(when === "now" ? "已改好 " + ch.length + " 項，今天起生效" : "已安排 " + ch.length + " 項，" + Number(tm.month.slice(5)) + " 月 1 日生效", "ok", 3500);
  if (when === "now") refreshMe();
  back();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message) + (i > 1 ? "（前 " + (i - 1) + " 項已存）" : ""), "err", 5e3);
  teamLoad(tm.dept).then((function() {
   render();
  }));
 }));
}

PAGES.mine = function() {
 setTitle("我的表單");
 var m = S.me, multi = m.depts.length > 1, h = "";
 m.depts.forEach((function(d) {
  var daily = m.assigns.filter((function(a) {
   return a.dept === d.id && a.daily && F(a.form);
  }));
  var picks = m.assigns.filter((function(a) {
   return a.dept === d.id && (a.pick || a.missingEquip);
  }));
  if (!daily.length && !picks.length) return;
  if (multi) h += '<div class="sec"><b>' + esc(d.id) + "</b></div>";
  if (daily.length) h += '<div class="sec">每日檢點<small>作業日當天填</small></div><div class="list">' + daily.map((function(a) {
   return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(F(a.form).name) + '</span><span class="mt">' + F(a.form).items.length + " 項</span></span>" + duePill(a) + "</button>";
  })).join("") + "</div>";
  if (picks.length) {
   h += '<div class="sec">定期檢查<small>期限內找時間做</small></div><div class="list">' + picks.map((function(a) {
    var f = F(a.form);
    if (!f) return "";
    if (a.missingEquip) return '<div class="li"><span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">後台還沒建立' + esc(a.missingEquip) + "編號，請洽環安衛中心</span></span></div>";
    var ttl = f.name + (a.object ? "・" + a.object + (a.objectName ? " " + a.objectName : "") : "") + (a.kind ? "・" + a.kind : "");
    return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(ttl) + '</span><span class="mt">' + esc(dueMeta(a)) + "</span>" + (f.evidence ? '<span class="mt inf">要到現場逐項檢查，送出前附' + (f.evidence.photos ? " " + f.evidence.photos + " 張照片" : "") + (f.evidence.summary ? "＋檢查過程紀要" : "") + "</span>" : "") + "</span>" + duePill(a) + "</button>";
   })).join("") + "</div>";
  }
 }));
 if (!h) h = '<div class="empty">目前沒有指派給您的表</div>'; else h = '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><div class="m">每年、每兩年的檢查沒有規定哪一天做，在期限內安排時間到現場檢查再填。快到期（30 天內）首頁會提醒。</div></div></div></div>' + h;
 if (m.claimable && m.claimable.length && !isMgr()) h += '<button class="btn ghost" onclick="go(\'claim\')">' + ic("plus", 20, 2.6) + "申請負責本課其他表或設備</button>";
 $("app").innerHTML = h;
};

var SUMMARY_MIN = 15;

function evNeed(f, fm) {
 var ev = f && f.evidence;
 if (!ev) return null;
 var n = (fm.pics || []).length, s = String(fm.sum || "").replace(/\s/g, "").length;
 var o = {
  pics: Math.max(0, (ev.photos || 0) - n),
  sum: ev.summary && (s < SUMMARY_MIN || !!sumWhy(fm.sum))
 };
 return o.pics || o.sum ? o : null;
}

var EV_EG = "例：逐一檢查氣罩、導管、排氣機皮帶與軸承，量測控制風速 0.6 m/s，濾袋無破損";

function sumWhy(v) {
 var t = String(v || "").replace(/\s/g, "");
 if (t.length < SUMMARY_MIN) return "";
 if (t === EV_EG.replace(/\s/g, "") || t === EV_EG.replace(/^例：/, "").replace(/\s/g, "")) return "這是範例文字，請寫這次實際檢查了什麼、量到多少";
 return txtWhy(v, {
  min: SUMMARY_MIN,
  want: "請寫這次實際檢查了什麼、量到多少"
 });
}

function evHtml(f, fm) {
 var ev = f.evidence, pics = fm.pics || [];
 var h = '<div class="sec" id="evSec">檢查佐證<small>' + (ev.photos ? "至少 " + ev.photos + " 張照片" : "") + (ev.summary ? (ev.photos ? "＋" : "") + "紀要" : "") + '</small></div><div class="card ev">';
 if (ev.summary) {
  var n = String(fm.sum || "").replace(/\s/g, "").length;
  h += '<label class="nl req" for="evSum">檢查過程紀要（至少 ' + SUMMARY_MIN + " 字）</label>" + '<textarea id="evSum" class="note" placeholder="' + esc(EV_EG) + '" oninput="S.fill.sum=this.value;draftSave();evCount();fillBar()">' + esc(fm.sum || "") + "</textarea>" + '<div class="hint" id="evCnt">' + evCntTxt(fm.sum) + "</div>";
 }
 if (ev.photos) {
  h += '<div class="pics">' + pics.map((function(p, i) {
   return '<div class="pic"><img src="' + esc(p.t) + '" alt="現場照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="evDel(' + i + ')">' + ic("x", 16, 3) + "</button></div>";
  })).join("") + (pics.length < 6 ? '<label class="pic add">' + ic("plus", 26, 2.6) + '<span>拍照／選照片</span><input type="file" accept="image/*" hidden onchange="evPick(this)"></label>' : "") + "</div>" + '<div class="hint">拍檢查的部位、量測的儀表讀數或銘牌。照片拍了就上傳，要有網路。</div>';
 }
 return h + "</div>";
}

function evCntTxt(v) {
 var n = String(v || "").replace(/\s/g, "").length, w = sumWhy(v);
 return n + " 字" + (n < SUMMARY_MIN ? "・還差 " + (SUMMARY_MIN - n) + " 字" : w ? "・" + w : "");
}

function evCount() {
 var el = $("evCnt");
 if (!el) return;
 el.textContent = evCntTxt(S.fill.sum);
 el.className = "hint" + (sumWhy(S.fill.sum) ? " nbad" : "");
}

function evDel(i) {
 if (!confirm("移除這張照片？")) return;
 S.fill.pics.splice(i, 1);
 draftSave();
 var y = window.scrollY;
 render();
 window.scrollTo(0, y);
}

function photoUp(file, body, done) {
 if (!file) return;
 if (!navigator.onLine) return toast("沒有網路，照片要連上網路才能上傳", "err", 3500);
 if (!/^image\//.test(file.type || "image/")) return toast("請選照片檔", "err");
 var url = URL.createObjectURL(file), img = new Image;
 busyOn("照片上傳中…");
 img.onerror = function() {
  URL.revokeObjectURL(url);
  busyOff();
  toast("這張照片打不開，請重拍", "err", 3500);
 };
 img.onload = function() {
  URL.revokeObjectURL(url);
  var sc = function(max, q) {
   var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
   c.width = Math.round(img.naturalWidth * s);
   c.height = Math.round(img.naturalHeight * s);
   var x = c.getContext("2d");
   x.fillStyle = "#fff";
   x.fillRect(0, 0, c.width, c.height);
   x.drawImage(img, 0, 0, c.width, c.height);
   return {
    u: c.toDataURL("image/jpeg", q),
    w: c.width,
    h: c.height
   };
  };
  var big = sc(1600, .72), th = sc(240, .6);
  if ((body.__dup || []).indexOf(th.u) >= 0) {
   busyOff();
   return toast("這張跟已附的照片是同一張，請拍另一個部位或角度", "err", 4500);
  }
  var act = body.__api || "photoUp";
  body = Object.assign({}, body);
  delete body.__api;
  delete body.__dup;
  api(act, Object.assign({
   image: big.u,
   w: big.w,
   h: big.h
  }, body)).then((function(r) {
   busyOff();
   done({
    id: r.id,
    t: th.u
   });
  })).catch((function(e) {
   busyOff();
   toast(esc(e.message), "err", 4500);
  }));
 };
 img.src = url;
}

function keepY(fn) {
 var y = window.scrollY;
 fn();
 window.scrollTo(0, y);
}

function evPick(inp) {
 var file = inp.files && inp.files[0];
 inp.value = "";
 var a = A(S.arg.key), fm = S.fill;
 photoUp(file, {
  deptId: a.dept,
  formId: a.form,
  __dup: (fm.pics || []).map((function(p) {
   return p.t;
  }))
 }, (function(p) {
  if (S.fill !== fm) return;
  fm.pics = (fm.pics || []).concat([ p ]);
  draftSave();
  keepY(render);
  toast("已上傳第 " + fm.pics.length + " 張", "ok", 1800);
 }));
}

function ngPicsHtml(fm, seq) {
 var pics = (fm.np || {})[seq] || [];
 return '<div class="pics sm">' + pics.map((function(p, i) {
  return '<div class="pic"><img src="' + esc(p.t) + '" alt="異常照片 ' + (i + 1) + '"><button class="px" aria-label="移除這張" onclick="ngDel(' + jsq(seq) + "," + i + ')">' + ic("x", 16, 3) + "</button></div>";
 })).join("") + (pics.length < 3 ? '<label class="pic add">' + ic("plus", 22, 2.6) + '<span>附照片</span><input type="file" accept="image/*" hidden onchange="ngPick(this,' + jsq(seq) + ')"></label>' : "") + "</div>" + (navigator.onLine ? "" : '<div class="hint">沒網路可以先送出；照片之後在「異常追蹤」填改善時再附。</div>');
}

function ngPick(inp, seq) {
 var file = inp.files && inp.files[0];
 inp.value = "";
 var a = A(S.arg.key), fm = S.fill;
 var dup = [];
 Object.keys(fm.np || {}).forEach((function(k) {
  fm.np[k].forEach((function(p) {
   dup.push(p.t);
  }));
 }));
 photoUp(file, {
  deptId: a.dept,
  formId: a.form,
  purpose: "ng",
  __dup: dup
 }, (function(p) {
  if (S.fill !== fm) return;
  fm.np = fm.np || {};
  fm.np[seq] = (fm.np[seq] || []).concat([ p ]);
  draftSave();
  keepY(render);
 }));
}

function ngDel(seq, i) {
 if (!confirm("移除這張照片？")) return;
 S.fill.np[seq].splice(i, 1);
 draftSave();
 keepY(render);
}

function photoView(id) {
 busyOn("讀取照片…");
 api("photoGet", {
  id
 }).then((function(r) {
  busyOff();
  var d = document.createElement("div");
  d.className = "pview";
  d.onclick = function() {
   d.remove();
  };
  d.innerHTML = '<img src="' + esc(r.image) + '" alt="現場照片"><span class="muted">點一下關閉</span>';
  document.body.appendChild(d);
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 4e3);
 }));
}

function deptOf(id) {
 return id;
}

function statusPill(s) {
 var c = {
  填寫中: [ "na", "pen" ],
  待主管審核: [ "warn", "clock" ],
  待環安衛審核: [ "warn", "clock" ],
  已核准: [ "ok", "check" ],
  已歸檔: [ "ok", "check" ],
  退回: [ "ng", "ret" ]
 }[s] || [ "na", "" ];
 return pill(c[0], c[1], s);
}

function openFill(key, date) {
 if (!S.share && navigator.onLine && S.me && S.me.today && S.me.today !== today() && !S.fillFresh) {
  S.fillFresh = true;
  toast("更新表單中…", "", 1500);
  return Promise.race([ refreshMe(), new Promise((function(r) {
   setTimeout(r, 5e3);
  })) ]).then((function() {
   openFill(key, date);
   S.fillFresh = false;
  }));
 }
 var a = A(key);
 if (!a) return;
 var d = date || today();
 S.fill = !S.share && lsGet(LS.DRAFT, {})[key + "@" + d] || {
  key,
  date: d,
  r: {},
  n: {},
  x: {},
  noWork: false
 };
 S.ff = "all";
 go("fill", {
  key
 });
 if (S.fill.need && S.fill.need.length) {
  var nd = S.fill.need.filter((function(q) {
   return !S.fill.r[q];
  }));
  if (nd.length) {
   jumpTo(nd[0]);
   toast("表單改版：原本的勾選已帶入，請補勾第 " + nd.join("、") + " 項", "", 5e3);
  }
  return;
 }
 loadDay();
}

function loadDay() {
 if (S.share) return;
 var a = A(S.fill.key), fm = S.fill;
 if (!a.daily || Object.keys(fm.r).length || fm.noWork) return;
 api("dayView", {
  deptId: a.dept,
  formId: a.form,
  date: fm.date
 }, {
  quiet: true,
  noRetry: true
 }).then((function(d) {
  if (!d || S.page !== "fill" || S.fill !== fm || Object.keys(fm.r).length) return;
  fm.r = d.results || {};
  fm.n = d.notes || {};
  fm.noWork = d.noWork;
  if (fm.n["*"]) {
   delete fm.n["*"];
  }
  render();
  toast("已帶出這天在試算表上的內容", "", 1800);
 })).catch((function() {}));
}

function draftSave() {
 var f = S.fill;
 if (!f || S.share) return;
 var all = lsGet(LS.DRAFT, {});
 all[f.key + "@" + f.date] = f;
 lsSet(LS.DRAFT, all);
}

function draftDrop(f) {
 var all = lsGet(LS.DRAFT, {});
 delete all[f.key + "@" + f.date];
 lsSet(LS.DRAFT, all);
}

function optClass(k) {
 return {
  ok: "ok",
  ng: "ng",
  danger: "ng",
  care: "warn",
  risk: "warn",
  na: "na"
 }[k] || "ok";
}

function optIcon(k) {
 return {
  ok: "check",
  ng: "x",
  warn: "warn",
  na: "minus"
 }[optClass(k)];
}

function isBad(f, v) {
 return f.noteFor.indexOf(v) >= 0 || optClass(v) === "ng";
}

function fillState(f, fm) {
 var todo = [], bad = [], noNote = [];
 f.items.forEach((function(it) {
  var v = fm.r[it.seq];
  if (!v) {
   todo.push(it.seq);
   return;
  }
  if (isBad(f, v)) bad.push(it.seq);
  if (f.noteFor.indexOf(v) >= 0 && noteWhy(f, fm, it.seq)) noNote.push(it.seq);
 }));
 return {
  total: f.items.length,
  cnt: f.items.length - todo.length,
  todo,
  bad,
  noNote
 };
}

function noteWhy(f, fm, seq) {
 var v = fm.r[seq];
 return f.noteFor.indexOf(v) >= 0 ? txtWhy(fm.n[seq], {
  bad: isBad(f, v)
 }) : "";
}

function noteHint(f, fm, seq) {
 var w = String(fm.n[seq] || "").trim() ? noteWhy(f, fm, seq) : "";
 return '<div class="hint nbad" id="nh' + esc(seq) + '"' + (w ? "" : " hidden") + ">" + esc(w) + "</div>";
}

PAGES.fill = function() {
 var a = A(S.arg.key);
 var fm = S.fill;
 if (!a || !fm) return back();
 var f = F(a.form, fm.date);
 setTitle(f.name);
 var t = today(), minD = fillMin() + "-01";
 var st = fillState(f, fm), ff = S.ff, side = "";
 if (!fm.noWork) {
  var pct = Math.round(st.cnt / Math.max(1, st.total) * 100);
  S.topExtra = '<div class="prog"><div class="prog-in"><div class="pt"><span>已勾 <b>' + st.cnt + "</b> / " + st.total + " 項</span>" + (st.todo.length ? '<span class="pr">還有 ' + st.todo.length + " 項</span>" : '<span class="pr okt">全部勾完了</span>') + "</div>" + '<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + st.total + '" aria-valuenow="' + st.cnt + '"><i class="' + (st.todo.length ? "" : "full") + '" style="width:' + pct + '%"></i></div>' + '<div class="seg" role="tablist"><button role="tab" aria-selected="' + (ff === "all") + '" class="' + (ff === "all" ? "on" : "") + '" onclick="fillFilter(\'all\')">全部 ' + st.total + "</button>" + '<button role="tab" aria-selected="' + (ff === "todo") + '" class="' + (ff === "todo" ? "on" : "") + '" onclick="fillFilter(\'todo\')">未勾 ' + st.todo.length + "</button>" + '<button role="tab" aria-selected="' + (ff === "bad") + '" class="ngc' + (ff === "bad" ? " on" : "") + '" onclick="fillFilter(\'bad\')">異常 ' + st.bad.length + "</button></div></div></div>";
 }
 var metaTxt = [ deptOf(a.dept), a.object, a.kind ].filter(String).join("｜");
 var h = bfBanner() + '<div class="meta">' + esc(metaTxt) + "</div>" + (S.share || demoDept(a.dept) || bfCur() ? '<div class="dwrap"><div class="lbl">檢查日期 ' + pill("ok", "", md(fm.date) + "（" + wk(fm.date) + "）") + "</div></div>" : '<div class="dwrap"><div class="lbl"><label for="dt">檢查日期</label>' + (fm.date === t ? pill("ok", "", "今天") : pill("warn", "", "補登")) + "</div>" + '<input type="date" class="field" id="dt" value="' + esc(fm.date) + '" max="' + t + '" min="' + minD + '" onchange="fillDate(this.value)">' + '<div class="hint">補填其他天：回首頁按「月曆・補填」，再點日期（最早可補到 ' + md(minD) + "）</div></div>" + (fm.date !== t ? '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><b>補填 ' + md(fm.date) + "（" + wk(fm.date) + "）的紀錄</b>" + '<div class="m">請確認這天確實有做檢查。建議當天檢查、當天填寫，檢查表才有實際作用；補填會記下填寫時間，單位負責人與環安衛看得到。</div></div></div></div>' : ""));
 if (a.daily) {
  h += '<div class="btns r21"><button class="btn navy" onclick="allOk()">' + ic("check", 22, 3) + "全部正常</button>" + '<button class="btn ghost" onclick="noWork()">' + (fm.noWork ? "↺ 取消無作業" : "今日無作業") + "</button></div>";
 } else {
  h += prevDefects(a);
 }
 if (a.daily) {} else if (f.evidence) {
  h += '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><b>請到現場逐項檢查後再勾</b><div class="m">這張表沒有「全部正常」，每一項都要自己勾；送出前要' + (f.evidence.photos ? "附 " + f.evidence.photos + " 張以上現場照片" : "") + (f.evidence.summary ? (f.evidence.photos ? "、" : "") + "寫檢查過程紀要" : "") + "，單位負責人與環安衛審核時看得到。</div></div></div></div>";
 } else {
  h += '<button class="btn navy" onclick="allOk()">' + ic("check", 22, 3) + "全部正常</button>";
 }
 if (fm.noWork) {
  h += '<div class="box warn"><div class="r">' + ic("info", 22) + '<div class="bt"><b>這一天記為「無作業」</b><div class="m">表上這天留空白。按最下面「送出（今日無作業）」；選錯了按「↺ 取消無作業」。</div></div></div></div>';
 } else {
  var g = null, shown = 0, nextSeq = st.todo[0] || st.noNote[0];
  h += '<div class="fitems">';
  f.items.forEach((function(it) {
   var v = fm.r[it.seq];
   if (ff === "todo" && v) return;
   if (ff === "bad" && !(v && isBad(f, v))) return;
   shown++;
   if (it.group && it.group !== g) {
    g = it.group;
    h += '<div class="grp">' + esc(g) + "</div>";
   }
   var opts = it.opts || f.opts, needNote = v && f.noteFor.indexOf(v) >= 0;
   var cls = "item" + (v && isBad(f, v) ? " bad" : it.seq === nextSeq && st.cnt ? " next" : "");
   h += '<div class="' + cls + '" id="it' + esc(it.seq) + '"><div class="q"><span class="no">' + esc(it.seq) + '</span><div class="qt">' + esc(it.text) + (it.method ? " <small>（" + esc(it.method) + "）</small>" : "") + "</div>" + (!v && st.cnt ? '<span class="tag">未勾</span>' : "") + "</div>" + '<div class="opts n' + Math.min(opts.length, 3) + '">' + opts.map((function(o) {
    var on = v === o.k;
    return '<button class="opt ' + optClass(o.k) + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="pick(' + jsq(it.seq) + "," + jsq(o.k) + ')">' + (on ? ic(optIcon(o.k), 18, 3) : "") + esc(o.label) + "</button>";
   })).join("") + "</div>" + (needNote || fm.n[it.seq] && f.type === "單張" ? '<div class="nwrap"><label class="nl' + (needNote ? " req" : "") + '" for="n' + esc(it.seq) + '">' + (needNote ? "必填：" : "說明：") + esc(f.noteTitle || "請說明異常狀況與處理方式") + "</label>" + '<textarea id="n' + esc(it.seq) + '" class="note' + (needNote ? "" : " plain") + '" placeholder="' + esc(f.noteTitle || "請說明異常狀況與處理方式") + '" oninput="noteIn(' + jsq(it.seq) + ',this.value)">' + esc(fm.n[it.seq] || "") + "</textarea>" + (needNote ? noteHint(f, fm, it.seq) : "") + (v && isBad(f, v) && !S.share ? ngPicsHtml(fm, it.seq) : "") + "</div>" : "") + "</div>";
  }));
  if (!shown) h += '<div class="empty">' + (ff === "todo" ? "都勾完了，沒有未勾的項目" : "沒有異常的項目") + "</div>";
  h += "</div>";
  if (ff === "all") (f.extra || []).forEach((function(x, i) {
   h += '<div class="item"><label class="qt" for="x' + i + '">' + esc(x) + '</label><textarea id="x' + i + '" class="note plain" oninput="S.fill.x[' + i + ']=this.value;draftSave()">' + esc(fm.x[i] || "") + "</textarea></div>";
  }));
  if (f.evidence && !a.daily) side = evHtml(f, fm);
 }
 var sig = S.share ? '<div class="box info"><div class="r">' + ic("pen", 22) + '<div class="bt"><b>' + (S.share.member ? "勾完按送出，下一步確認後用您的電子簽名送出" : "勾完按送出，下一步請寫姓名並簽名") + '</b><div class="m">' + (S.share.member ? "紀錄上會寫您的名字，代 " + esc(S.share.d ? S.share.d.creator : "") + " 檢點。" : "代填的檢點要本人當場簽名才算數。") + "</div></div></div></div>" : '<div class="sigcard"><img src="' + esc(S.me.signature.image) + '" alt="您的簽名"><div class="stx"><b>送出時自動帶入您的簽名</b>不用再簽</div></div>';
 if (side && isDesk()) h = '<div class="fdesk"><div class="fmain">' + h + '</div><div class="fside">' + side + sig + "</div></div>"; else h += side + sig;
 $("app").innerHTML = h;
 fillBar();
};

function fillBar() {
 if (S.page !== "fill" || !S.fill) return;
 var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date), st = fillState(f, fm), h;
 if (fm.noWork) h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic("check", 22, 2.8) + "送出（今日無作業）</button>"; else if (st.todo.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.todo[0]) + ')">還有 ' + st.todo.length + " 項沒勾・跳到第 " + esc(st.todo[0]) + " 項" + ic("down", 20, 2.6) + "</button>"; else if (st.noNote.length) h = '<button class="btn navy" onclick="jumpTo(' + jsq(st.noNote[0]) + ',1)">第 ' + esc(st.noNote[0]) + " 項" + (String(fm.n[st.noNote[0]] || "").trim() ? "的說明要寫清楚" : "要寫說明") + "・跳過去" + ic("down", 20, 2.6) + "</button>"; else if (!a.daily && evNeed(f, fm)) {
  var en = evNeed(f, fm);
  h = '<button class="btn navy" onclick="evJump()">' + (en.sum ? "還要寫檢查過程紀要" : "") + (en.sum && en.pics ? "、" : "") + (en.pics ? "還要 " + en.pics + " 張照片" : "") + "・跳過去" + ic("down", 20, 2.6) + "</button>";
 } else h = '<button class="btn" id="fillBtn" onclick="submitFill()">' + ic("check", 22, 2.8) + st.total + " 項都勾好了，送出這張（" + md(fm.date) + "）</button>";
 bar(h);
}

function evJump() {
 if (S.ff !== "all") {
  S.ff = "all";
  render();
 }
 var el = $("evSec");
 if (el) el.scrollIntoView({
  block: "start",
  behavior: "smooth"
 });
 var ta = $("evSum");
 if (ta && evNeed(F(A(S.arg.key).form), S.fill).sum) setTimeout((function() {
  ta.focus({
   preventScroll: true
  });
 }), 400);
}

function fillFilter(v) {
 S.ff = v;
 window.scrollTo(0, 0);
 render();
}

function jumpTo(seq, note) {
 var el = $("it" + seq);
 if (!el && S.ff !== "all") {
  S.ff = "all";
  render();
  el = $("it" + seq);
 }
 if (!el) return;
 el.scrollIntoView({
  block: "center",
  behavior: "smooth"
 });
 el.classList.add("flash");
 setTimeout((function() {
  el.classList.remove("flash");
 }), 1200);
 if (note) {
  var ta = el.querySelector("textarea");
  if (ta) setTimeout((function() {
   ta.focus({
    preventScroll: true
   });
  }), 400);
 }
}

function noteIn(seq, v) {
 S.fill.n[seq] = v;
 draftSave();
 fillBar();
 var el = $("nh" + seq), a = A(S.arg.key);
 if (!el || !a) return;
 var w = String(v || "").trim() ? noteWhy(F(a.form, S.fill.date), S.fill, seq) : "";
 el.textContent = w;
 el.hidden = !w;
}

function fillDate(v) {
 var t = today();
 if (!v || v > t) {
  toast("不能選未來的日期", "err");
  return render();
 }
 S.fill = lsGet(LS.DRAFT, {})[S.fill.key + "@" + v] || {
  key: S.fill.key,
  date: v,
  r: {},
  n: {},
  x: {},
  noWork: false
 };
 render();
 loadDay();
}

function pick(seq, k) {
 S.fill.r[seq] = k;
 S.fill.noWork = false;
 draftSave();
 var y = window.scrollY;
 render();
 window.scrollTo(0, y);
 var f = F(A(S.arg.key).form, S.fill && S.fill.date);
 if (f.noteFor.indexOf(k) >= 0 && !String(S.fill.n[seq] || "").trim()) {
  var ta = $("n" + seq);
  if (ta) ta.focus({
   preventScroll: true
  });
 }
}

function allOk() {
 var a = A(S.arg.key), f = F(a.form, S.fill && S.fill.date);
 f.items.forEach((function(it) {
  var opts = it.opts || f.opts;
  if (!S.fill.r[it.seq] || S.fill.r[it.seq] === "na") S.fill.r[it.seq] = S.fill.r[it.seq] === "na" ? "na" : opts[0].k;
 }));
 S.fill.noWork = false;
 draftSave();
 render();
 toast("已勾「" + esc((f.items[0].opts || f.opts)[0].label) + "」，有異常的請個別改", "", 2200);
}

function noWork() {
 S.fill.noWork = !S.fill.noWork;
 draftSave();
 render();
}

function submitFill() {
 var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date);
 if (!fm.noWork) {
  for (var i = 0; i < f.items.length; i++) {
   var it = f.items[i], v = fm.r[it.seq];
   if (!v) {
    jumpTo(it.seq);
    return toast("第 " + esc(it.seq) + " 項還沒勾", "err");
   }
   var nw = noteWhy(f, fm, it.seq);
   if (nw) {
    jumpTo(it.seq, 1);
    return toast(nw === "還沒寫" ? "第 " + esc(it.seq) + " 項請寫說明" : "第 " + esc(it.seq) + " 項：" + esc(nw), "err", 5e3);
   }
  }
  if (!a.daily && evNeed(f, fm)) {
   evJump();
   return toast("請補上檢查佐證（照片、紀要）", "err");
  }
 }
 if (S.share) {
  draftSave();
  return go("psign", {
   key: a.key
  });
 }
 if (S.dev) return devBlock("這張檢點表");
 var btn = $("fillBtn");
 if (btn) {
  btn.disabled = true;
  btn.className = "btn busy";
  btn.innerHTML = '<span class="spin"></span>存到手機中…';
 }
 var extra = {};
 (f.extra || []).forEach((function(x, i) {
  if (fm.x[i]) extra[x] = fm.x[i];
 }));
 var body = {
  deptId: a.dept,
  formId: a.form,
  object: a.object || "",
  kind: a.kind || "",
  date: fm.date,
  results: fm.noWork ? {} : fm.r,
  notes: fm.noWork ? {} : fm.n,
  extra,
  noWork: fm.noWork,
  fver: f.version || "",
  texts: f.items.reduce((function(o, it) {
   o[it.seq] = it.text;
   return o;
  }), {})
 };
 if (f.evidence && !a.daily) {
  body.summary = fm.sum || "";
  body.photos = (fm.pics || []).map((function(p) {
   return p.id;
  }));
 }
 if (!fm.noWork && fm.np) {
  body.ngPhotos = {};
  Object.keys(fm.np).forEach((function(k) {
   if (isBad(f, fm.r[k]) && fm.np[k].length) body.ngPhotos[k] = fm.np[k].map((function(p) {
    return p.id;
   }));
  }));
 }
 var nBad = fm.noWork ? 0 : f.items.filter((function(it) {
  return isBad(f, fm.r[it.seq]);
 })).length;
 var job = {
  id: newId(),
  token: lsGet(LS.TOKEN, ""),
  who: S.me && S.me.person ? S.me.person.name : "",
  key: a.key,
  body,
  created: Date.now(),
  status: "pending",
  label: f.name + " " + md(fm.date)
 };
 obPut(job).then((function() {
  draftDrop(fm);
  if (window.reviseDone) reviseDone(a.key, fm.date);
  if (fm.date === today() && a.daily) {
   a.due.todayDone = true;
   a.due.todayNoWork = fm.noWork;
  }
  S.fill = null;
  S.stack = [];
  S.page = "home";
  S.arg = {};
  return obRefresh();
 })).then((function() {
  if (bfAfterSave(a.key, body.date)) {
   flush();
   return;
  }
  window.scrollTo(0, 0);
  render();
  var left = (S.me.assigns || []).filter((function(x) {
   return x.daily && x.due && !x.due.todayDone && !pendingFor(x, today());
  })).length;
  var msg = f.name + " " + md(body.date) + (body.date === today() && left ? "・今天還有 " + left + " 張" : "") + "（今天要改：再打開這張，改好重送）";
  S.sentMsg = "已送出 " + msg;
  if (nBad) {
   msg += "；" + nBad + " 項異常已轉到「異常追蹤」";
   S.sentMsg = "已送出 " + msg;
  }
  toast((navigator.onLine ? "已送出 " : "已存在手機，有網路自動上傳：") + msg, "ok", nBad ? 5e3 : 3500);
  flush();
 })).catch((function(e) {
  toast("手機存檔失敗：" + esc(e.message), "err", 5e3);
  if (btn) {
   btn.disabled = false;
   btn.className = "btn";
   btn.textContent = "再送一次";
  }
 }));
}

PAGES.month = function() {
 var a = S.arg;
 setTitle((a.who && a.who !== (S.me.person || {}).name ? a.who + "・" : "") + deptOf(a.dept) + " " + ymLabel(a.period));
 if (S.mArg !== a) {
  S.mArg = a;
  S.mf = S.mKeep ? S.mKeep.mf : 0;
  S.mv = S.mKeep ? S.mKeep.mv : "cal";
  S.mKeep = null;
  S.md = undefined;
  S.mErr = null;
  S.cm = "";
 }
 $("app").innerHTML = monthNav(a.period) + loading("讀取這個月的紀錄中…");
 apiR("monthView", a.who ? {
  deptId: a.dept,
  period: a.period,
  who: a.who
 } : {
  deptId: a.dept,
  period: a.period
 }).then((function(v) {
  if (S.page !== "month" || S.arg !== a) return;
  S.view = v;
  monthRender();
 })).catch((function(e) {
  $("app").innerHTML = errBox("讀不到這個月的資料", e.message) + '<button class="btn navy" onclick="render()">再試一次</button>';
 }));
};

function dayBad(f, r) {
 if (!r || r.noWork) return false;
 return Object.keys(r.results || {}).some((function(k) {
  var x = r.results[k];
  return x === "?" || f.noteFor.indexOf(x) >= 0;
 }));
}

function seeLate(v) {
 return !!(mgrOf(v.dept) || isEhs());
}

function addM(per, k) {
 var d = new Date(Number(per.slice(0, 4)), Number(per.slice(5)) - 1 + k, 1);
 return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

function fillMin() {
 return addM(today().slice(0, 7), -(S.me && S.me.fillMonths || 1));
}

var MNAV_BACK = 12;

function mCanGo(per) {
 var cur = today().slice(0, 7);
 return per <= cur && per >= addM(cur, -MNAV_BACK);
}

function mGo(k) {
 var a = S.arg, np = addM(a.period, k);
 if (!mCanGo(np)) return toast(k > 0 ? "已經是本月" : "只能往前看 " + MNAV_BACK + " 個月", "", 2e3);
 S.mSlide = k;
 S.mKeep = {
  mf: S.mf,
  mv: S.mv
 };
 go("month", a.who ? {
  dept: a.dept,
  period: np,
  who: a.who
 } : {
  dept: a.dept,
  period: np
 }, true);
}

function monthNav(per) {
 var p0 = addM(per, -1), p1 = addM(per, 1);
 var btn = function(k, p) {
  var ok = mCanGo(p);
  return '<button class="btn ghost mnb" aria-label="' + (k < 0 ? "上個月" : "下個月") + '"' + (ok ? ' onclick="mGo(' + k + ')"' : " disabled") + ">" + (k < 0 ? ic("back", 22, 2.8) + Number(p.slice(5)) + " 月" : Number(p.slice(5)) + " 月" + ic("right", 22, 2.8)) + "</button>";
 };
 return '<div class="mnav">' + btn(-1, p0) + "<b>" + ymLabel(per) + "</b>" + btn(1, p1) + "</div>";
}

function mSwipe() {
 var el = $("app"), x0 = null, y0 = 0;
 el.ontouchstart = function(e) {
  if (S.page !== "month" || !e.target.closest(".calcard")) {
   x0 = null;
   return;
  }
  x0 = e.touches[0].clientX;
  y0 = e.touches[0].clientY;
 };
 el.ontouchend = function(e) {
  if (x0 === null || S.page !== "month") return;
  var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
  x0 = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) mGo(dx < 0 ? 1 : -1);
 };
}

function monthRender() {
 if ($("cm")) S.cm = $("cm").value;
 var v = S.view, forms = S.me.forms, mm = v.model, boss = mgrOf(v.dept), ehs = isEhs();
 var late = seeLate(v) ? mm.late || {} : {};
 var rev = S.revMode = revRole(v);
 var pa = actPending(v.monthId);
 var h = rev || pa ? revHead(v, rev, pa) : monthNav(v.period);
 if (S.mErr) h += errBox(S.mErr.t, S.mErr.m, S.mErr.btn || "");
 var p0 = h.length;
 if (v.overview) h += crewCard(v);
 h += '<div class="card"><div class="mr"><b>' + (v.who ? "送審・" + esc(v.who) : "本月狀態") + "</b>" + statusPill(v.status) + "</div>" + (v.status === "退回" ? '<div class="box err" role="alert"><div class="r">' + ic("ret", 22) + '<div class="bt"><b>退回原因</b><div class="m">' + esc(v.reason) + "</div></div></div></div>" : "") + (v.sheetUrl ? slBox(v) : "") + "</div>";
 if (!rev) {
  h += confirmBlock(v);
  h += bfButton(v);
 }
 if (sfWide() && (boss || ehs) && (v.model.daily.length || v.model.periodic.length) && v.status !== "填寫中") h += '<button class="btn' + (v.status === "待主管審核" && boss && !ehs || v.status === "待環安衛審核" && ehs ? "" : " ghost") + "\" onclick=\"S.sf=null;go('sheetFill',{dept:" + jsq(v.dept) + ",period:" + jsq(v.period) + (v.who ? ",who:" + jsq(v.who) : "") + ',review:1})">' + ic("review", 20, 2.4) + "用表格審核（電腦版，整月一次看完）</button>";
 if (!rev && sfWide() && !isEhs() && (v.status === "填寫中" || v.status === "退回") && sfMine(v).length) h += '<button class="btn ghost" onclick="S.sf=null;go(\'sheetFill\',{dept:' + jsq(v.dept) + ",period:" + jsq(v.period) + '})">' + ic("pen", 20, 2.4) + "用表格填寫（電腦版，像試算表一樣整月填）</button>";
 var pend = (S.outbox || []).filter((function(j) {
  return j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period;
 }));
 if (pend.length && !rev) h += '<div class="strip info">' + ic("cloud", 24, 2.2) + '<div class="stx"><span>手機裡還有 <b>' + pend.length + " 筆</b>這個月的檢點沒上傳完</span><small>上傳完才會出現在下面</small></div>" + '<button class="btn sm" onclick="flush().then(function(){render()})">立即上傳</button></div>';
 if ((v.status === "填寫中" || v.status === "退回") && v.problems.length) {
  h += '<div class="box warn"><div class="r">' + ic("warn", 24) + '<div class="bt"><b>送出前還要補 ' + v.problems.length + " 個地方</b></div></div>" + '<div class="list">' + v.problems.slice(0, 20).map((function(p) {
   return '<div class="li" style="min-height:52px"><span class="mn"><span class="nm" style="font-weight:500">' + esc(p) + "</span></span></div>";
  })).join("") + (v.problems.length > 20 ? '<div class="li" style="min-height:44px"><span class="mt">…還有 ' + (v.problems.length - 20) + " 個</span></div>" : "") + "</div></div>";
 }
 var dl = mm.daily.filter((function(x) {
  return forms[x.form];
 }));
 var topPart = h.slice(p0), deskCal = isDesk() && dl.length && S.mv === "cal";
 if (deskCal) h = h.slice(0, p0);
 if (dl.length) {
  if (S.mf >= dl.length) S.mf = 0;
  var x = dl[S.mf], f = forms[x.form];
  if (S.md === undefined) {
   S.md = null;
   for (var d0 = 1; d0 <= 31; d0++) if (dayBad(f, x.days[d0])) {
    S.md = d0;
    break;
   }
   if (S.md === null && !ehs && !boss && (v.status === "填寫中" || v.status === "退回")) S.md = blankDays(x, v.period)[0] || null;
  }
  h += '<div class="seg2" role="tablist"><button role="tab" aria-selected="' + (S.mv === "cal") + '" class="' + (S.mv === "cal" ? "on" : "") + '" onclick="mView(\'cal\')">月曆</button>' + '<button role="tab" aria-selected="' + (S.mv === "grid") + '" class="' + (S.mv === "grid" ? "on" : "") + '" onclick="mView(\'grid\')">表格（逐項）</button></div>';
  if (dl.length > 1) h += '<div class="chips">' + dl.map((function(y, i) {
   var fy = forms[y.form], nb = Object.keys(y.days).filter((function(k) {
    return dayBad(fy, y.days[k]);
   })).length;
   return '<button class="chip' + (i === S.mf ? " on" : "") + '" aria-pressed="' + (i === S.mf) + '" onclick="mForm(' + i + ')">' + esc(y.name) + (nb ? '<span class="bdg">異常 ' + nb + "</span>" : "") + "</button>";
  })).join("") + "</div>"; else h += '<div class="sec">' + esc(x.name) + "</div>";
  var days = Object.keys(x.days).map((function(k) {
   return x.days[k];
  }));
  var nBad = Object.keys(x.days).filter((function(k) {
   return dayBad(f, x.days[k]);
  })).length, nLate = Object.keys(late[x.form] || {}).length;
  var stats = '<div class="stats"><span>檢點 <b>' + days.filter((function(d) {
   return !d.noWork;
  })).length + "</b> 天</span><span>無作業 <b>" + days.filter((function(d) {
   return d.noWork;
  })).length + "</b> 天</span>" + (nBad ? '<span class="ng">異常 <b>' + nBad + "</b> 天</span>" : "") + (nLate ? '<span class="wn">補登 <b>' + nLate + "</b> 天</span>" : "") + "</div>";
  var blanks = blankDays(x, v.period), canEdit = (v.status === "填寫中" || v.status === "退回") && !ehs && v.period >= fillMin();
  if (canEdit && blanks.length) stats += '<div class="blankl">' + ic("pen", 16, 2.4) + "平日沒紀錄 " + blanks.length + " 天（" + blanks.slice(0, 10).join("、") + (blanks.length > 10 ? "…" : "") + " 號）：點日期可以補填</div>";
  var calc = '<div class="card calcard' + (S.mSlide ? S.mSlide > 0 ? " slideL" : " slideR" : "") + '">' + stats + calHtml(f, x, v.period, late[x.form]) + "</div>", dd = dayDetail(f, x, v.period, late[x.form]);
  if (S.mv === "cal") h += deskCal ? '<div class="mdesk"><div class="mdmain">' + calc + '</div><div class="mdside">' + (dd || '<div class="card"><div class="muted">點月曆上的日期，看那天的檢查人員、異常與說明；沒有紀錄的上班日，點下去就是補填。</div></div>') + topPart + "</div></div>" : calc + dd; else h += '<div class="card">' + stats + "</div>" + gridHtml(f, x, v.period, seeLate(v) ? late[x.form] : null);
 }
 if (mm.periodic.length) h += '<div class="sec">定期檢查（本月）</div>';
 h += (isDesk() && mm.periodic.length ? '<div class="sfper">' : "") + mm.periodic.map((function(x) {
  return sheetHtml(forms[x.form], x);
 })).join("") + (isDesk() && mm.periodic.length ? "</div>" : "");
 if (!mm.daily.length && !mm.periodic.length) h += '<div class="empty">這個月沒有資料。</div>';
 $("app").innerHTML = h;
 S.mSlide = 0;
 if (!rev && !pa) mSwipe(); else $("app").ontouchstart = $("app").ontouchend = null;
 if (pa) {
  bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>正在確認上次的' + esc(pa.label) + "結果…</div>");
  actWatch(v, pa);
  return;
 }
 var thisMonth = v.period === today().slice(0, 7);
 if (v.overview) {
  bar("");
  return;
 }
 if (v.who && v.who !== S.me.person.name && (v.status === "填寫中" || v.status === "退回")) {
  bar("");
  return;
 }
 if ((v.status === "填寫中" || v.status === "退回") && !ehs && thisMonth) {
  var nx = new Date(Number(v.period.slice(0, 4)), Number(v.period.slice(5)), 1);
  bar('<button class="btn" disabled>' + Number(v.period.slice(5)) + " 月還沒結束，" + (nx.getMonth() + 1) + "/1 起才能送審</button>");
 } else if (v.status === "待主管審核" && !boss && !ehs && v.submitter === S.me.person.name) {
  bar('<button class="btn redline" onclick="withdrawMonth()">' + ic("ret", 20, 2.4) + "撤回送審，改好再送（主管審核前才能撤回）</button>");
 } else if ((v.status === "填寫中" || v.status === "退回") && !ehs && v.who && !v.nSend) {
  bar('<button class="btn" disabled>這個月沒有您簽的檢點紀錄，不用送審</button>');
 } else if ((v.status === "填寫中" || v.status === "退回") && !ehs) {
  bar(v.problems.length ? '<button class="btn" disabled>補完 ' + v.problems.length + " 個地方，才能送單位負責人</button>" : '<button class="btn" id="smBtn" onclick="submitMonth()">' + ic("check", 22, 2.8) + (v.who ? "送出我的 " + (v.nSend || 0) + " 份，鎖定送單位負責人" : "本月完成，鎖定送單位負責人") + "</button>");
 } else if (v.status === "待主管審核" && boss && !ehs) {
  bar('<label class="nl" for="cm">退回原因：<b>寫要改哪一天、哪一項</b>（核准不用填，本課看得到）</label><textarea id="cm" class="note plain" placeholder="退回時必填，例：10/3、10/7 堆高機第 5 項沒寫異常說明">' + esc(S.cm) + "</textarea>" + '<div class="btns r3"><button class="btn ghost" onclick="revLeave()">先離開</button><button class="btn redline" onclick="doReview(\'return\')">退回本課修改</button><button class="btn" onclick="doReview(\'approve\')">' + ic("pen", 22) + "核准並簽名</button></div>");
 } else if (v.status === "待環安衛審核" && ehs) {
  bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic("pdf", 20, 2.2) + "開啟 PDF</button>" + '<div class="btns r3"><button class="btn ghost" onclick="revLeave()">先離開</button><button class="btn redline" onclick="doEhs(\'return\')">退回本課修改</button><button class="btn" onclick="doEhs(\'approve\')">' + ic("check", 22, 2.8) + "核准歸檔</button></div>");
 } else if (v.status === "已歸檔" || v.status === "待環安衛審核") {
  bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic("pdf", 20, 2.2) + "開啟 PDF</button>");
 }
}

function myUnconf(v) {
 var me = S.me.person.name, out = [];
 if (isEhs() || !(v.status === "填寫中" || v.status === "退回")) return out;
 v.model.daily.forEach((function(x) {
  var f = F(x.form, v.period);
  if (!f) return;
  Object.keys(x.days).forEach((function(d) {
   var r = x.days[d], byMgr = mgrOf(v.dept) && (v.gone || []).indexOf(r.signer) >= 0;
   if (!r.unconf || !(r.signer === me || r.noWork || byMgr)) return;
   var nb = Object.keys(r.results || {}).filter((function(k) {
    return f.noteFor.indexOf(r.results[k]) >= 0;
   })).length;
   out.push({
    d: Number(d),
    t: Number(v.period.slice(5)) + "/" + d + " " + f.name + (byMgr ? "（" + r.signer + "，已不在名單）" : ""),
    s: r.noWork ? "無作業" : nb ? "異常 " + nb + " 項" : "全部正常",
    ch: r.unconf === "changed",
    key: byMgr ? "" : v.dept + "|" + x.form + "||",
    date: v.period + "-" + pad(Number(d))
   });
  }));
 }));
 (v.model.periodic || []).forEach((function(x) {
  if (x.unconf && (x.signer === me || mgrOf(v.dept) && (v.gone || []).indexOf(x.signer) >= 0)) out.push({
   d: Number(x.date.slice(8)),
   t: x.date.slice(5).replace("-", "/") + " " + x.name + (x.object ? " " + x.object : ""),
   s: "定期檢查",
   ch: x.unconf === "changed"
  });
 }));
 return out.sort((function(a, b) {
  return a.d - b.d;
 }));
}

function confirmBlock(v) {
 var a = myUnconf(v);
 if (!a.length) return "";
 return '<div class="box info cfm"><div class="r">' + ic("pen", 24) + '<div class="bt"><b>在試算表填的 ' + a.length + " 筆，請確認</b>" + '<div class="m">內容沒錯就按最下面「已全數確認無誤」，會記成您檢點的並帶入電子簽名；哪一筆要改，點那一筆「前往修改」，改好送出就算確認。</div></div></div>' + '<div class="list">' + a.map((function(x) {
  var inner = '<span class="mn"><span class="nm">' + esc(x.t) + '</span><span class="mt' + (x.ch ? " wn" : "") + '">' + esc(x.s) + (x.ch ? "・手機送出後在試算表被改過" : "") + "</span></span>";
  return x.key ? '<button class="li" style="min-height:56px" onclick="openFill(' + jsq(x.key) + "," + jsq(x.date) + ')">' + inner + '<span class="go">前往修改' + ic("arrow", 16, 2.6) + "</span></button>" : '<div class="li" style="min-height:56px">' + inner + '<span class="mt">要改請到試算表</span></div>';
 })).join("") + "</div>" + '<button class="btn navy" id="cfBtn" onclick="confirmFill()">' + ic("check", 20, 2.8) + "已全數確認無誤（" + a.length + " 筆，帶入我的簽名）</button></div>";
}

function confirmFill() {
 var v = S.view, b = $("cfBtn");
 if (b) {
  b.disabled = true;
  b.className = "btn busy";
  b.innerHTML = '<span class="spin"></span>確認中…';
 }
 api("confirmFill", {
  deptId: v.dept,
  period: v.period
 }).then((function(r) {
  toast("已確認 " + r.count + " 筆", "ok");
  refreshMe();
  render();
 })).catch((function(e) {
  S.mErr = {
   t: "確認沒有成功",
   m: e.message
  };
  monthRender();
  window.scrollTo(0, 0);
 }));
}

function withdrawMonth() {
 var v = S.view, why = prompt("撤回原因（例如：漏填 28 號）？撤回後可以修改，改好再重新送審。");
 if (why === null) return;
 busyOn("撤回中…", "");
 api("withdrawMonth", {
  monthId: v.monthId,
  reason: why
 }).then((function() {
  busyOff();
  toast("已撤回，可以修改了", "ok");
  refreshMe();
  render();
 })).catch((function(e) {
  busyOff();
  S.mErr = {
   t: "撤回沒有成功",
   m: e.message
  };
  monthRender();
  window.scrollTo(0, 0);
 }));
}

function mView(x) {
 S.mv = x;
 monthRender();
}

function mForm(i) {
 S.mf = i;
 S.md = undefined;
 monthRender();
}

function mDay(d) {
 S.md = S.md === d ? null : d;
 monthRender();
 var el = $("dday");
 if (el && S.md) el.scrollIntoView({
  block: "nearest",
  behavior: "smooth"
 });
}

function calHtml(f, x, period, late) {
 var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), n = new Date(y, mo, 0).getDate(), first = new Date(y, mo - 1, 1).getDay(), td = today();
 var h = '<div class="calw">' + wkNames().map((function(c) {
  return "<span>" + c + "</span>";
 })).join("") + '</div><div class="cal">';
 for (var i = 0; i < first; i++) h += "<span></span>";
 var anyLate = false, anyMiss = false, anyUc = false;
 for (var d = 1; d <= n; d++) {
  var r = x.days[d], date = period + "-" + pad(d), dow = (first + d - 1) % 7, future = date > td, cls = "cd", mark = "", lab;
  if (r && r.noWork) {
   cls += " nw";
   mark = "<small>無</small>";
   lab = "無作業";
  } else if (r && dayBad(f, r)) {
   cls += " bad";
   mark = ic("x", 12, 3.6);
   lab = "有異常";
  } else if (r) {
   cls += " ok";
   mark = ic("check", 12, 3.6);
   lab = "正常";
  } else if (!future && dow > 0 && dow < 6 && !(S.view && demoDept(S.view.dept)) && !(S.me && S.me.startPeriod && period < S.me.startPeriod)) {
   cls += " miss";
   lab = "沒有紀錄";
   anyMiss = true;
  } else lab = "沒有紀錄";
  if (r && r.unconf) {
   cls += " uc";
   anyUc = true;
   mark = '<small class="ucl">待確認</small>';
   lab += "、試算表填的待確認";
  }
  if (late && late[d]) {
   cls += " late";
   anyLate = true;
   if (!r || !dayBad(f, r)) mark = '<small class="lt">補登</small>';
   lab += "、補登";
  }
  if (S.md === d) cls += " sel";
  h += '<button class="' + cls + '" aria-label="' + mo + "/" + d + " " + lab + '"' + (future ? " disabled" : ' onclick="mDay(' + d + ')"') + ">" + d + mark + "</button>";
 }
 h += '</div><div class="legend"><span><i style="background:var(--okbg)"></i>✓ 正常</span><span><i style="background:var(--ng)"></i>✕ 有異常</span><span><i style="background:#E2E6EB"></i>無作業</span>' + (anyMiss ? '<span><i style="border:2px dashed #B5BEC9"></i>平日沒紀錄</span>' : "") + (anyLate ? '<span><i style="box-shadow:inset 0 0 0 2px var(--orange)"></i>補登</span>' : "") + (anyUc ? '<span><i style="border:2px dashed #1A5FB4"></i>試算表填的待確認</span>' : "") + "</div>";
 return h;
}

function optLabel(f, seq, k) {
 var it = f.items.filter((function(x) {
  return x.seq === seq;
 }))[0];
 var o = (it && it.opts || f.opts).filter((function(x) {
  return x.k === k;
 }))[0];
 return o ? o.label : k;
}

function demoDept(d) {
 return /^示範/.test(String(d || ""));
}

function workDay(date) {
 var dw = new Date(date + "T12:00:00").getDay();
 return dw > 0 && dw < 6 && (S.me && S.me.holidays || []).indexOf(date) < 0;
}

function blankDays(x, period) {
 if (S.view && demoDept(S.view.dept)) return [];
 if (S.me && S.me.startPeriod && period < S.me.startPeriod) return [];
 var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), n = new Date(y, mo, 0).getDate(), td = today(), out = [];
 for (var d = 1; d <= n; d++) {
  var date = period + "-" + pad(d);
  if (date <= td && workDay(date) && !x.days[d]) out.push(d);
 }
 return out;
}

function dayAction(x, period, d) {
 var v = S.view, date = period + "-" + pad(d), t = today();
 if (isEhs() || !(v.status === "填寫中" || v.status === "退回") || date > t || demoDept(v.dept) && date !== t) return "";
 var minD = fillMin() + "-01";
 if (date < minD) return '<div class="muted">超過補填期限（只能補到 ' + Number(minD.slice(5, 7)) + " 月 1 日），要更正請洽環安衛中心。</div>";
 var a = (S.me.assigns || []).filter((function(y) {
  return y.daily && y.dept === v.dept && y.form === x.form;
 }))[0];
 if (!a) return "";
 var r = x.days[d], me = S.me.person.name;
 if (!r) return '<button class="btn' + (date === t ? "" : " amber") + '" onclick="openFill(' + jsq(a.key) + "," + jsq(date) + ')">' + ic("pen", 20, 2.4) + (date === t ? "填寫今天" : "補填這天（" + md(date) + "）") + "</button>";
 if (r.signer === me || r.noWork && !mgrOf(v.dept)) return '<button class="btn ghost" onclick="openFill(' + jsq(a.key) + "," + jsq(date) + ')">' + ic("pen", 20, 2.4) + "修改這天</button>";
 return "";
}

function dayDetail(f, x, period, late) {
 var d = S.md;
 if (!d) return "";
 var r = x.days[d], date = period + "-" + pad(d), mo = Number(period.slice(5));
 var h = '<div class="card dday" id="dday"><div class="mr"><b>' + mo + "/" + d + "（" + wk(date) + "）</b>" + (r && r.signer ? "<span>檢查人員 " + esc(r.signer) + "</span>" : "") + "</div>";
 if (!r) h += '<div class="muted">這天沒有紀錄。</div>'; else if (r.noWork) h += '<div class="muted">這天記為「無作業」。</div>'; else {
  var bads = f.items.filter((function(it) {
   var k = r.results[it.seq];
   return k === "?" || k && f.noteFor.indexOf(k) >= 0;
  }));
  bads.forEach((function(it) {
   var k = r.results[it.seq], note = (r.notes || {})[it.seq];
   h += '<div class="dbad">' + ic("x", 20, 3) + "<div><b>" + esc("第 " + it.seq + " 項 " + it.text + "：" + (k === "?" ? "?" : optLabel(f, it.seq, k))) + "</b>" + (note ? "<span>說明：" + esc(note) + "</span>" : "") + "</div></div>";
  }));
  if ((r.notes || {})["*"]) h += '<div class="muted">備註：' + esc(r.notes["*"]) + "</div>";
  var ok = f.items.length - bads.length;
  h += '<div class="muted">' + (bads.length ? "其餘 " + ok + " 項正常" : "全部 " + ok + " 項正常") + "</div>";
 }
 if (r && r.proxy && seeLate(S.view)) h += '<div class="muted" style="color:var(--orT)">' + esc(r.proxy) + "，簽名為代填人當場手寫（只有主管與環安衛看得到）</div>";
 if (late && late[d]) h += '<div class="muted" style="color:var(--orT)">補登：' + esc(String(late[d]).slice(5, 16)) + " 登錄（只有主管與環安衛看得到）</div>";
 return h + (S.revMode ? "" : dayAction(x, period, d)) + "</div>";
}

function markOf(f, seq, k) {
 var it = f.items.filter((function(x) {
  return x.seq === seq;
 }))[0];
 var o = (it && it.opts || f.opts).filter((function(x) {
  return x.k === k;
 }))[0];
 return o ? o.mark : "";
}

function gridHtml(f, x, period, late) {
 var y = Number(period.slice(0, 4)), mo = Number(period.slice(5)), days = new Date(y, mo, 0).getDate();
 var by = x.days;
 var h = '<div class="grid"><table><tr><th class="t">項目</th>';
 for (var d = 1; d <= days; d++) h += "<th" + (late && late[d] ? ' class="late" title="' + esc(late[d]) + ' 登錄"' : "") + ">" + d + "</th>";
 h += "</tr>";
 f.items.forEach((function(it) {
  h += '<tr><td class="t">' + esc(it.seq) + ". " + esc(it.text) + "</td>";
  for (var d = 1; d <= days; d++) {
   var r = by[d], k = r && !r.noWork ? r.results[it.seq] : "";
   var bad = k && (f.noteFor.indexOf(k) >= 0 || k === "?");
   h += "<td" + (bad ? ' class="bad"' : "") + ">" + esc(k === "?" ? "?" : k ? markOf(f, it.seq, k) : "") + "</td>";
  }
  h += "</tr>";
 }));
 h += '<tr><td class="t">檢查人員</td>';
 for (var d2 = 1; d2 <= days; d2++) {
  var r2 = by[d2];
  h += '<td style="font-size:11px">' + (r2 ? r2.noWork ? "無" : esc((r2.signer || "?").slice(-2)) : "") + "</td>";
 }
 h += "</tr></table></div>";
 var notes = [];
 Object.keys(by).forEach((function(d) {
  var n = by[d].notes || {};
  Object.keys(n).forEach((function(k) {
   notes.push(mo + "/" + d + (k === "*" ? "" : " 第" + k + "項") + "：" + n[k]);
  }));
 }));
 if (late) Object.keys(late).forEach((function(d) {
  notes.push(mo + "/" + d + " 補登（" + String(late[d]).slice(5, 16) + " 登錄，只有主管與環安衛看得到）");
 }));
 if (notes.length) h += '<div class="box warn"><div class="m">' + notes.map(esc).join("<br>") + "</div></div>";
 return h;
}

function sheetHtml(f, r) {
 var h = '<div class="card sheet"><div class="mr"><b>' + esc(r.name) + '</b></div><div class="muted">' + esc([ r.object, r.kind, r.date, r.signer ].filter(String).join("｜")) + "</div>";
 r.items.forEach((function(it) {
  var k = r.results[it.seq], bad = k && f && (f.noteFor.indexOf(k) >= 0 || k === "?");
  h += '<div class="sr"><div>' + esc(it.text) + (it.note ? "<small>" + esc(it.note) + "</small>" : "") + "</div>" + pill(bad ? "ng" : k ? "ok" : "na", bad ? "x" : k ? "check" : "", it.result || "未填") + "</div>";
 }));
 r.extra.forEach((function(e) {
  h += '<div class="ex"><b>' + esc(e.k) + "</b>：" + esc(e.v) + "</div>";
 }));
 if (r.summary) h += '<div class="ex"><b>檢查過程紀要</b>：' + esc(r.summary) + "</div>";
 if (r.photos && r.photos.length) h += '<div class="ex"><b>現場照片</b>：' + r.photos.map((function(id, i) {
  return '<button class="lnk" onclick="photoView(' + jsq(id) + ')">照片 ' + (i + 1) + "</button>";
 })).join("　") + "</div>";
 return h + "</div>";
}

function submitMonth() {
 var v = S.view;
 var pend = (S.outbox || []).filter((function(j) {
  return j.status === "pending" && j.body.deptId === v.dept && j.body.date.slice(0, 7) === v.period;
 }));
 if (pend.length && !v._autoUp && navigator.onLine) {
  v._autoUp = true;
  toast("先把手機裡的 " + pend.length + " 筆檢點上傳，請稍候…", "", 3e3);
  var wait = function() {
   return S.flushing ? new Promise((function(ok) {
    setTimeout(ok, 800);
   })).then(wait) : flush();
  };
  var again = function() {
   if (S.view === v) submitMonth();
  };
  wait().then((function() {
   return obRefresh();
  })).then(again, again);
  return;
 }
 v._autoUp = false;
 if (pend.length) {
  S.mErr = {
   t: "還不能送審",
   m: "手機裡還有 " + pend.length + " 筆這個月的檢點沒上傳完，上傳完才能送。",
   btn: '<button class="btn navy" onclick="S.mErr=null;flush().then(function(){render()})">立即上傳</button>'
  };
  monthRender();
  window.scrollTo(0, 0);
  return;
 }
 var y0 = Number(v.period.slice(0, 4)), m0 = Number(v.period.slice(5)), nd = new Date(y0, m0, 0).getDate(), lines = [], blanks = [];
 v.model.daily.forEach((function(x) {
  var f = F(x.form, v.period);
  if (!f) return;
  var work = 0, nw = 0, blank = [];
  for (var d = 1; d <= nd; d++) {
   var r = x.days[d];
   if (r && r.noWork) nw++; else if (r) work++; else if (workDay(v.period + "-" + pad(d)) && !demoDept(v.dept)) blank.push(d);
  }
  if (blank.length) blanks.push(f.name + "：" + blank.map((function(d) {
   return m0 + "/" + d;
  })).join("、"));
  lines.push("・" + f.name + "：檢點 " + work + " 天、無作業 " + nw + " 天" + (blank.length ? "、平日空白 " + blank.length + " 天（" + blank.slice(0, 8).join("、") + (blank.length > 8 ? "…" : "") + " 號）" : ""));
 }));
 if (v.model.periodic.length) lines.push("・定期檢查 " + v.model.periodic.length + " 份");
 if (!S.smOk) {
  S.smLines = lines;
  S.smBlank = blanks;
  return go("smConfirm", {
   dept: v.dept,
   period: v.period
  });
 }
 S.smOk = false;
 var btn = $("smBtn");
 if (btn) {
  btn.disabled = true;
  btn.className = "btn busy";
  btn.innerHTML = '<span class="spin"></span>送出中…';
 }
 busyOn("鎖定送審中…", "要檢查整個月的紀錄並鎖定試算表，約 10～30 秒");
 actSafe(v, "submitMonth", {
  deptId: v.dept,
  period: v.period
 }, "送審", [ "待主管審核", "待環安衛審核", "已歸檔" ]).then((function(r) {
  busyOff();
  r = r || {
   monthId: v.monthId
  };
  S.mErr = null;
  toast("已鎖定送審", "ok");
  var link = location.origin + location.pathname + "?r=" + r.monthId;
  var text = (v.who ? v.who + " " : "") + v.dept + " " + ymLabel(v.period) + " 作業檢點已完成，請審核簽名：" + link;
  $("app").innerHTML = '<div class="sent"><span class="bigck">' + ic("check", 40, 3) + "</span><b>已送給單位負責人</b><p>" + esc(v.dept + " " + ymLabel(v.period)) + " 已送給單位負責人。<br>他打開 App 就會看到；要催他，按下面「用 LINE／訊息通知主管」。</p></div>";
  bar('<button class="btn" onclick="shareTo(' + jsq(text) + ')">' + ic("chat", 22, 2.4) + "用 LINE／訊息通知主管</button>" + '<button class="btn ghost" onclick="S.stack=[];go(\'home\',{},true);refreshMe()">' + ic("home", 20, 2.2) + "回首頁</button>");
 })).catch((function(e) {
  busyOff();
  S.mErr = {
   t: "送審沒有成功",
   m: e.message
  };
  if (S.page === "month") monthRender(); else render();
  window.scrollTo(0, 0);
  dlg("<b>送審沒有成功</b><p>" + esc(e.message).replace(/\n/g, "<br>") + "</p>", [ [ "知道了", function() {}, "" ] ]);
 }));
}

PAGES.smConfirm = function() {
 var v = S.view;
 if (!v) return back();
 setTitle("送出 " + ymLabel(v.period));
 var h = '<div class="h2">送出前請確認</div><div class="lead">' + esc(v.dept + "・" + ymLabel(v.period)) + (v.who ? "，只送<b>您自己簽的 " + (v.nSend || 0) + " 份</b>（別人的表由他本人送），送出後由單位負責人審核。" : "，整課一起送，送出後由單位負責人審核。") + "</div>" + '<div class="card"><div class="muted">這個月的紀錄</div>' + (S.smLines || []).map((function(l) {
  return '<div class="sml">' + esc(l.replace(/^・/, "")) + "</div>";
 })).join("") + "</div>" + '<div class="box warn"><div class="r">' + ic("warn", 24) + '<div class="bt"><b>送出後就鎖定</b><div class="m">App 和試算表都不能再修改，<b>除非單位負責人退回補正</b>。單位負責人還沒審核前，送出的人可以自己撤回。</div></div></div></div>' + (demoDept(v.dept) ? "" : (S.smBlank || []).length ? '<div class="box warn"><div class="r">' + ic("warn", 24) + '<div class="bt"><b>這幾天是上班日，但沒有紀錄、也沒選「今日無作業」</b>' + (S.smBlank || []).map((function(l) {
  return '<div class="m">・' + esc(l) + "</div>";
 })).join("") + '<div class="m">請確認這幾天確實沒有運作；如果是漏填，請先回月曆點那天補填。</div></div></div></div>' : '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><div class="m">上班日都有紀錄或已選「今日無作業」。</div></div></div></div>') + '<label class="ck smck"><input type="checkbox" id="smChk" onchange="$(\'smGo\').disabled=!this.checked">' + ((S.smBlank || []).length && !demoDept(v.dept) ? "上面幾天確實沒有運作（不是漏填），仍要送出 " + Number(v.period.slice(5)) + " 月的紀錄" : "我已確認 " + Number(v.period.slice(5)) + " 月的紀錄沒有漏填，要送給單位負責人") + "</label>";
 $("app").innerHTML = h;
 bar('<button class="btn ghost" onclick="back()">' + ic("cal", 20, 2.2) + (demoDept(v.dept) ? "回月曆" : "回月曆補填") + '</button><button class="btn" id="smGo" disabled onclick="smGo()">' + ic("check", 22, 2.8) + "確認送出</button>");
};

function smGo() {
 S.smOk = true;
 S.page = "month";
 S.stack.pop();
 S.arg = S.mArg;
 render();
 submitMonth();
}

function shareTo(text) {
 if (navigator.share) navigator.share({
  text
 }).catch((function() {})); else if (navigator.clipboard) navigator.clipboard.writeText(text).then((function() {
  toast("已複製，貼到 LINE 給主管", "ok");
 })); else prompt("複製這段傳給主管：", text);
}

function doReview(action) {
 var cm = ($("cm") || {}).value || "";
 S.cm = cm;
 var rw = action === "return" ? txtWhy(cm, {
  want: "請寫要改哪一天、哪一項（例：10/3 第 5 項沒寫異常說明）"
 }) : "";
 if (rw) {
  toast(rw === "還沒寫" ? "退回要寫原因：要改哪一天、哪一項" : esc(rw), "err", 4500);
  var c0 = $("cm");
  if (c0) {
   c0.classList.add("bad");
   c0.focus();
  }
  return;
 }
 if (action === "return" && !confirm("把 " + S.view.dept + " " + ymLabel(S.view.period) + " 整個月退回給本課？\n\n退回後檢點人員可以修改，改好再重新送審。")) return;
 if (action === "approve") {
  if (!S.me.signature) return go("sign");
  if (!confirm("核准 " + S.view.dept + " " + ymLabel(S.view.period) + " 的檢點紀錄？\n會帶入您的簽名並產生 PDF。")) return;
 }
 bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === "approve" ? "簽名並產生 PDF 中，約 10～30 秒…" : "退回中…") + "</div>");
 busyOn(action === "approve" ? "簽名並產生 PDF 中…" : "退回中…", action === "approve" ? "約 10～30 秒" : "");
 var v0 = S.view;
 actSafe(v0, "review", {
  monthId: v0.monthId,
  decision: action,
  comment: cm
 }, action === "approve" ? "核准" : "退回", action === "approve" ? [ "待環安衛審核", "已歸檔" ] : [ "退回" ]).then((function(r) {
  busyOff();
  toast(action === "approve" ? "已核准，PDF 已產生" : "已退回", "ok", 3e3);
  S.stack = [];
  S.cm = "";
  go("home", {}, true);
  refreshMe();
 })).catch((function(e) {
  busyOff();
  if (S.page === "sheetFill") {
   toast((action === "approve" ? "核准沒有成功：" : "退回沒有成功：") + esc(e.message), "err", 6e3);
   return sfRevBar();
  }
  S.mErr = {
   t: action === "approve" ? "核准沒有成功" : "退回沒有成功",
   m: e.message
  };
  monthRender();
  window.scrollTo(0, 0);
 }));
}

function doEhs(action) {
 var why = "";
 if (action === "return") {
  for (var tries = 0; ;tries++) {
   why = prompt((tries ? "請寫清楚要改哪一天、哪一項。\n" : "") + "退回原因（必填，本課與單位負責人看得到）？整個月會退回給本課。", why || "");
   if (why === null) return;
   if (!txtWhy(why, {
    want: "x"
   })) break;
  }
 } else if (!confirm(S.view && S.view.who ? "核准 " + S.view.who + " 的檢點紀錄？（全課到齊後整課歸檔）" : "確認歸檔？")) return;
 bar('<div class="loading" style="padding:14px 0"><span class="spin"></span>' + (action === "approve" ? "歸檔中…" : "退回中…") + "</div>");
 busyOn(action === "approve" ? "歸檔中…" : "退回中…", "");
 var mid = S.view.monthId;
 actSafe(S.view, "ehsReview", {
  monthId: mid,
  decision: action,
  comment: why
 }, action === "approve" ? S.view.who ? "核准" : "歸檔" : "退回", action === "approve" ? [ "已歸檔", "已核准" ] : [ "退回" ]).then((function(r) {
  if (action === "approve" && r && r.archiveId) {
   toast("全課都已核准，開始整課歸檔", "ok", 3e3);
   return archLoop(r.archiveId);
  }
  if (action === "approve" && (!r || r.status !== "已歸檔") && S.view && S.view.who) {
   busyOff();
   toast("已核准 " + S.view.who + "；全課到齊後會整課產生 PDF 歸檔", "ok", 4500);
   S.stack = [];
   go("home", {}, true);
   refreshMe();
   return;
  }
  if (action === "approve") return archLoop(mid);
  busyOff();
  toast("已退回", "ok");
  S.stack = [];
  go("home", {}, true);
  refreshMe();
 })).catch((function(e) {
  busyOff();
  if (S.page === "sheetFill") {
   toast((action === "approve" ? "歸檔沒有成功：" : "退回沒有成功：") + esc(e.message), "err", 6e3);
   return sfRevBar();
  }
  S.mErr = {
   t: action === "approve" ? "歸檔沒有成功" : "退回沒有成功",
   m: e.message
  };
  monthRender();
  window.scrollTo(0, 0);
 }));
}

function archLoop(mid) {
 busyOn("歸檔收尾中…", "產生每張表的 PDF、寄通知信");
 var round = function() {
  return api("archiveWork", {
   monthId: mid
  }).then((function(r) {
   var sub = document.querySelector("#busy .bx p:not(.warn):not(.sec2)");
   if (sub && r.total) sub.textContent = "每張表的 PDF：" + r.made + " / " + r.total + (r.done ? "，寄通知信" : "");
   if (r.done) return r;
   return new Promise((function(res) {
    setTimeout(res, r.busy ? 8e3 : 300);
   })).then(round);
  }));
 };
 return round().then((function() {
  busyOff();
  toast("已歸檔，PDF 與通知信都完成了", "ok", 3e3);
  S.stack = [];
  go("home", {}, true);
  refreshMe();
 })).catch((function(e) {
  busyOff();
  toast(esc("已歸檔，但收尾沒做完：" + e.message + "（首頁可以繼續）"), "err", 6e3);
  S.stack = [];
  go("home", {}, true);
  refreshMe();
 }));
}

function openPdf(id) {
 var w = window.open("", "_blank");
 toast("PDF 下載中…");
 api("getPdf", {
  monthId: id
 }).then((function(r) {
  var bin = atob(r.base64), u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  var url = URL.createObjectURL(new Blob([ u ], {
   type: "application/pdf"
  }));
  if (w) w.location = url; else location.href = url;
 })).catch((function(e) {
  if (w) w.close();
  toast(esc(e.message), "err", 4e3);
 }));
}

PAGES.packages = function() {
 setTitle("待審核");
 $("app").innerHTML = loading("讀取中…");
 apiR("packages", {}).then((function(list) {
  if (S.page !== "packages") return;
  S.pkgs = list;
  var want = isEhs() ? "待環安衛審核" : "待主管審核";
  var mine = list.filter((function(x) {
   return x.status === want;
  }));
  var rest = list.filter((function(x) {
   return x.status !== want;
  })).slice(0, 12);
  var row = function(x) {
   return '<button class="li" onclick="' + goMonth(x.dept, x.period, x.who) + '"><span class="mn"><span class="nm">' + (x.who ? esc(x.who) + "　" : "") + esc(x.dept) + '　<span class="nw">' + ymLabel(x.period) + '</span></span><span class="mt">' + (x.who ? x.n + " 份・" : "") + esc(x.submitter) + " 送出 " + esc((x.submittedAt || "").slice(5, 16)) + "</span></span>" + statusPill(x.status) + "</button>";
  };
  $("app").innerHTML = '<div class="sec"><span class="sl"><span class="cnt' + (mine.length ? "" : " z") + '">' + mine.length + "</span>待您審核</span></div>" + (mine.length ? '<div class="list">' + mine.map(row).join("") + "</div>" : '<div class="empty">目前沒有</div>') + (rest.length ? '<div class="sec">最近</div><div class="list">' + rest.map(row).join("") + "</div>" : "");
 })).catch((function(e) {
  $("app").innerHTML = errBox("讀不到審核清單", e.message) + '<button class="btn navy" onclick="render()">再試一次</button>';
 }));
};

PAGES.shareMake = function() {
 setTitle("請人代填");
 var m = S.me, ds = m.depts.filter((function(d) {
  return m.assigns.some((function(a) {
   return a.dept === d.id && a.daily;
  }));
 }));
 if (!S.arg.dept && ds.length === 1) S.arg.dept = ds[0].id;
 var h = '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><b>休假或沒辦法檢點時用</b><div class="m">' + "① 選哪一天　② 選同事，直接分享到他的 App（他會收到通知，用他自己的電子簽名送出）。<br>同事沒有 App 帳號，才用最下面的「代填連結」傳 LINE。只能填那一天的每日檢點表。</div></div></div></div>";
 if (ds.length > 1) h += '<div class="sec">哪一課</div><div class="depts">' + ds.map((function(d) {
  var on = S.arg.dept === d.id;
  return '<button class="dept' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="S.arg={dept:' + jsq(d.id) + '};render()">' + (on ? ic("check", 16, 3.2) : "") + esc(d.id) + "</button>";
 })).join("") + "</div>";
 var L = S.arg.link, D = S.arg.done, t = today();
 if (!L && !D && S.arg.dept) {
  var days = [ 0, 1, 2, 3, 4, 5, 6, 7 ].map((function(n) {
   var d = nowD();
   d.setDate(d.getDate() + n);
   return ymd(d);
  }));
  if (!S.arg.date) S.arg.date = t;
  h += '<div class="sec">① 哪一天要代填</div><div class="depts">' + days.map((function(d, i) {
   var on = S.arg.date === d, lab = i === 0 ? "今天" : i === 1 ? "明天" : i === 2 ? "後天" : md(d) + "（" + wk(d) + "）";
   return '<button class="dept' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="S.arg.date=' + jsq(d) + ';render()">' + (on ? ic("check", 16, 3.2) : "") + esc(lab) + "</button>";
  })).join("") + "</div>";
  h += '<div class="sec">② 分享給誰</div>';
  var ML = S.arg.members;
  if (!ML) {
   h += '<div id="smList">' + loading("讀取同事名單…") + "</div>";
   api("shareMembers", {
    deptId: S.arg.dept
   }).then((function(r) {
    if (S.page !== "shareMake") return;
    S.arg.members = r;
    render();
   })).catch((function(e) {
    var el = $("smList");
    if (el) el.innerHTML = errBox("讀不到同事名單", e.message);
   }));
  } else {
   var q = (S.arg.q || "").trim();
   h += '<input class="field" id="smQ" type="search" placeholder="打名字或課別找人" value="' + esc(S.arg.q || "") + '" oninput="S.arg.q=this.value;smFilter()">';
   h += '<div class="smchips" id="smChips">' + smChips(ML, q) + "</div>";
   h += '<div class="list smbox" id="smList">' + smRows(ML, q) + '</div><div class="muted" style="margin-top:6px">可以打名字找，也可以在名單裡上下滑；上面點課別直接跳過去。</div>';
  }
 }
 if (D) {
  h += '<div class="card"><div class="mr"><b>已分享給 ' + esc(D.to) + "</b>" + pill("ok", "check", D.quiet ? "剛剛已通知過" : D.again ? "已再通知一次" : "已分享") + "</div>" + '<div class="muted">' + esc(D.to) + " 的 App 會跳出通知「" + esc(m.person.name) + " 向您分享了「" + esc(D.dept) + "」" + md(D.date) + " 的每日檢點表」，首頁最上面也會顯示，" + md(D.date) + " 當天就能填。<br>請記得先跟 " + esc(D.to) + " 講好。</div></div>";
 }
 if (L) {
  h += '<div class="card"><div class="mr"><b>' + esc(L.dept) + "　" + md(L.date) + " 代填連結</b>" + pill("ok", "check", "已產生") + "</div>" + '<div class="muted">只能在 ' + md(L.date) + "（" + wk(L.date) + "）當天使用，填那天的每日檢點表，23:59 失效。拿到連結的人送出時要寫姓名並當場簽名。</div>" + '<div class="cprow"><input class="field" id="shareUrl" readonly value="' + esc(L.url) + '" onclick="this.select()">' + '<button class="btn navy sm" id="cpBtn" onclick="copyShare()">' + ic("check", 18, 2.6) + "複製網址</button></div></div>";
 }
 h += '<div id="shareErr"></div>';
 if (!L && !D && S.arg.dept) h += '<div class="sec">同事沒有 App 帳號</div><button class="btn ghost" id="mkBtn" onclick="shareMake()">' + ic("ext", 22, 2.2) + "改用代填連結（傳 LINE，要當場簽名）</button>";
 $("app").innerHTML = h;
 if (L) bar('<button class="btn" onclick="shareTo(' + jsq("請幫忙填 " + L.dept + " " + md(L.date) + "（" + wk(L.date) + "）的每日檢點表，那天打開這個連結就能填：" + L.url) + ')">' + ic("chat", 22, 2.4) + "用 LINE／訊息傳給同事</button>"); else if (D) bar('<button class="btn" onclick="S.stack=[];go(\'home\',{},true)">' + ic("check", 22, 2.6) + "完成，回首頁</button>"); else bar("");
};

function smGroups(ML, q) {
 var xs = ML.filter((function(x) {
  return !q || x.name.indexOf(q) >= 0 || x.depts.join("、").indexOf(q) >= 0;
 })), by = {}, order = [];
 xs.forEach((function(x) {
  var g = x.same ? "同一課" : x.depts[0];
  if (!by[g]) {
   by[g] = [];
   order.push(g);
  }
  by[g].push(x);
 }));
 order.sort((function(a, b) {
  return a === "同一課" ? -1 : b === "同一課" ? 1 : a.localeCompare(b, "zh-Hant");
 }));
 return {
  n: xs.length,
  order,
  by
 };
}

function smRows(ML, q) {
 var G = smGroups(ML, q);
 if (!G.n) return '<div class="empty">找不到「' + esc(q) + "」</div>";
 var row = function(x) {
  var sub = x.depts.join("、") + (x.sig ? "" : "・還沒在 App 簽名，不能代填");
  return x.sig ? '<button class="li" onclick="shareMember(' + jsq(x.name) + ')"><span class="mn"><span class="nm">' + esc(x.name) + '</span><span class="mt">' + esc(sub) + "</span></span>" + pill("na", "chat", "分享") + "</button>" : '<div class="li off" aria-disabled="true"><span class="mn"><span class="nm">' + esc(x.name) + '</span><span class="mt">' + esc(sub) + "</span></span></div>";
 };
 return G.order.map((function(g, k) {
  return '<div class="smh" id="smg' + k + '">' + esc(g) + "<small>" + G.by[g].length + " 人</small></div>" + G.by[g].map(row).join("");
 })).join("");
}

function smChips(ML, q) {
 var G = smGroups(ML, q);
 if (G.order.length < 2) return "";
 return G.order.map((function(g, k) {
  return '<button class="smchip" onclick="smJump(' + k + ')">' + esc(g) + "</button>";
 })).join("");
}

function smJump(k) {
 var box = $("smList"), el = $("smg" + k);
 if (box && el) box.scrollTop = el.offsetTop - box.offsetTop;
}

function smFilter() {
 var q = (S.arg.q || "").trim(), el = $("smList"), ch = $("smChips");
 if (el && S.arg.members) {
  el.innerHTML = smRows(S.arg.members, q);
  el.scrollTop = 0;
 }
 if (ch && S.arg.members) ch.innerHTML = smChips(S.arg.members, q);
}

function shareMember(name) {
 var d = S.arg.date || today();
 if (!confirm("分享給 " + name + "，請他代填 " + md(d) + "（" + wk(d) + "）的每日檢點表？\n\n請先跟 " + name + " 講好；他的 App 會跳出通知。")) return;
 busyOn("分享中…");
 api("shareMember", {
  deptId: S.arg.dept,
  date: d,
  to: name
 }).then((function(r) {
  busyOff();
  S.arg = {
   dept: S.arg.dept,
   date: d,
   done: r
  };
  render();
 })).catch((function(e) {
  busyOff();
  $("shareErr").innerHTML = errBox("沒有分享成功", e.message);
  window.scrollTo(0, document.body.scrollHeight);
 }));
}

function copyShare() {
 var el = $("shareUrl"), txt = el.value, done = function() {
  var b = $("cpBtn");
  if (b) b.innerHTML = ic("check", 18, 2.6) + "已複製";
  toast("網址已複製，可以貼給同事", "ok");
 };
 var old = function() {
  el.removeAttribute("readonly");
  el.select();
  el.setSelectionRange(0, txt.length);
  var ok = false;
  try {
   ok = document.execCommand("copy");
  } catch (e) {}
  el.setAttribute("readonly", "");
  if (ok) done(); else toast("這支手機不讓 App 自動複製，請長按網址選「拷貝」", "err", 4e3);
 };
 if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, old); else old();
}

function shareMake() {
 var btn = $("mkBtn");
 btn.disabled = true;
 btn.className = "btn busy";
 btn.innerHTML = '<span class="spin"></span>產生中，約 3～5 秒…';
 api("shareCreate", {
  deptId: S.arg.dept,
  date: S.arg.date || today()
 }).then((function(r) {
  if (!r.url) r.url = location.origin + location.pathname + "#share=" + r.token;
  S.arg = {
   dept: S.arg.dept,
   date: S.arg.date,
   link: r
  };
  render();
 })).catch((function(e) {
  $("shareErr").innerHTML = errBox("沒有產生連結", e.message);
  btn.disabled = false;
  btn.className = "btn";
  btn.textContent = "再試一次";
 }));
}

function shareMe(d) {
 return {
  person: {
   name: "",
   role: "代填"
  },
  depts: [ {
   id: d.dept,
   mgr: false
  } ],
  forms: d.forms,
  months: [],
  signature: null,
  assigns: d.daily.map((function(x) {
   return {
    key: d.dept + "|" + x.form + "||",
    dept: d.dept,
    form: x.form,
    object: "",
    kind: "",
    daily: true,
    freq: "作業日",
    due: {
     state: x.state
    }
   };
  }))
 };
}

PAGES.proxy = function() {
 setTitle("代填每日檢點");
 var sh = S.share;
 if (!sh) {
  S.stack = [];
  return go(S.me ? "home" : "login", {}, true);
 }
 if (!sh.d) {
  $("app").innerHTML = loading("讀取連結中…");
  (sh.member ? api("shareOpenM", {
   link: sh.link
  }) : api("shareOpen", {
   share: sh.token
  }, {
   token: "-"
  })).then((function(d) {
   sh.d = d;
   S.me = shareMe(d);
   if (sh.member) S.me.person.name = sh.name;
   render();
  })).catch((function(e) {
   $("app").innerHTML = errBox(e.biz ? sh.member ? "這份代填分享不能用" : "這個連結不能用" : "連不上系統", e.message) + (e.biz ? "" : '<button class="btn navy" onclick="render()">再試一次</button>');
   if (sh.member) bar(shareExitBtn());
  }));
  return;
 }
 var d = sh.d;
 S.hero = '<div class="hero-in"><div class="brand"><span class="logo">' + '<img src="icon-192.png" alt="" style="width:100%;height:100%;border-radius:inherit;display:block">' + "</span>員和環安衛系統</div>" + '<div class="hn"><div class="h1">代填 ' + esc(d.dept) + '</div><div class="hsub">' + md(d.date) + "（" + wk(d.date) + "）的每日檢點・" + esc(d.creator) + " 請您幫忙・今天 23:59 前有效</div></div></div>";
 var h = "";
 if (sh.member) h += '<div class="box warn"><div class="r">' + ic("info", 22) + '<div class="bt"><b>' + esc(d.creator) + ' 向您分享了這一課的表單</b><div class="m">請先向 ' + esc(d.creator) + " 本人確認是否代填本日。送出會用您的電子簽名，不用再簽一次。</div></div></div></div>";
 if (d.locked) h += errBox("這個月已經送審", "不能再填，請洽單位負責人。");
 h += '<div class="sec">今天的每日檢點表</div><div class="list">' + d.daily.map((function(x) {
  var f = d.forms[x.form], key = d.dept + "|" + x.form + "||";
  var done = x.state === "done" || x.state === "nowork";
  var st = x.state === "done" ? '<span class="mt okt">' + esc(x.signer) + " 已檢點</span>" : x.state === "nowork" ? '<span class="mt">今日無作業</span>' : '<span class="mt">共 ' + f.items.length + " 項</span>";
  var pl = x.state === "done" ? pill("ok", "check", "已檢點") : x.state === "nowork" ? pill("na", "minus", "無作業") : pill("warn", "clock", "還沒檢點");
  return done && x.signer !== sh.name ? '<div class="li off" aria-disabled="true"><span class="mn"><span class="nm">' + esc(f.name) + "</span>" + st + "</span>" + pl + "</div>" : '<button class="li" ' + (d.locked ? "disabled " : "") + 'onclick="openFill(' + jsq(key) + "," + jsq(d.date) + ')"><span class="mn"><span class="nm">' + esc(f.name) + "</span>" + st + "</span>" + pl + "</button>";
 })).join("") + "</div>";
 h += '<div class="muted" style="margin-top:12px">已經有人檢點的表不能再改。填錯了請告訴 ' + esc(d.creator) + " 或單位負責人。</div>";
 $("app").innerHTML = h;
 if (sh.member) bar(shareExitBtn());
};

PAGES.psign = function() {
 var a = A(S.arg.key), fm = S.fill, f = F(a.form, fm && fm.date);
 if (!fm) return back();
 setTitle("簽名送出");
 if (S.share.member) {
  $("app").innerHTML = '<div class="h2">' + esc(f.name) + '</div><div class="lead">' + esc(S.share.d.dept) + "・" + md(fm.date) + (fm.noWork ? "・今日無作業" : "") + "</div>" + '<div class="box info"><div class="r">' + ic("pen", 22) + '<div class="bt"><b>以 ' + esc(S.share.name) + ' 的電子簽名送出</b><div class="m">紀錄上會寫「' + esc(S.share.name) + "」代 " + esc(S.share.d.creator) + " 檢點。請確認已經向 " + esc(S.share.d.creator) + ' 本人確認過要代填今天。</div></div></div></div><div id="psErr"></div>';
  bar('<button class="btn" id="psBtn" onclick="proxySubmit()">' + ic("check", 22, 2.8) + "確認並送出</button>");
  return;
 }
 var h = '<div class="h2">' + esc(f.name) + '</div><div class="lead">' + esc(S.share.d.dept) + "・" + md(fm.date) + (fm.noWork ? "・今日無作業" : "") + "</div>" + '<label class="nl req" for="pname">您的姓名</label><input id="pname" class="field" maxlength="20" autocomplete="name" placeholder="請寫全名" value="' + esc(S.share.name || "") + '" oninput="S.share.name=this.value">';
 if (!fm.noWork) h += '<div class="h2" style="margin-top:16px">在直的框裡，由上往下簽全名</div>' + '<div class="sigwrap"><div class="sigv"><div class="arw" aria-hidden="true"><span>由</span><span>上</span><span>往</span><span>下</span>' + '<svg class="ic" width="28" height="110" viewBox="0 0 28 110" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v98M4 90l10 12 10-12"/></svg></div>' + '<canvas id="cv" class="sigbox" aria-label="直式簽名區，由上往下簽"></canvas><span class="sp"></span></div>' + '<div class="right"><button class="btn ghost sm" onclick="sigClear()">' + ic("refresh", 18) + "清除重簽</button></div></div>";
 h += '<div id="psErr"></div>';
 $("app").innerHTML = h;
 bar('<button class="btn" id="psBtn" onclick="proxySubmit()">' + ic("check", 22, 2.8) + "簽名並送出</button>");
 if (!fm.noWork) sigInit();
};

function proxySubmit() {
 var a = A(S.arg.key), fm = S.fill, sh = S.share;
 if (sh.member) return proxySubmitM(a, fm, sh);
 var name = ($("pname").value || "").trim();
 sh.name = name;
 var nw = nameWhy(name);
 if (nw) {
  $("pname").classList.add("bad");
  $("pname").focus();
  return toast(esc(nw), "err", 4e3);
 }
 var img = "";
 if (!fm.noWork) {
  if (!SIG.drawn) return sigNudge();
  img = sigExport();
  if (!img) return toast("簽名太小，請簽大一點", "err");
 }
 var btn = $("psBtn");
 btn.disabled = true;
 btn.className = "btn busy";
 btn.innerHTML = '<span class="spin"></span>送出中…';
 fm.submitId = fm.submitId || newId();
 api("shareSubmit", {
  share: sh.token,
  submitId: fm.submitId,
  name,
  formId: a.form,
  results: fm.noWork ? {} : fm.r,
  notes: fm.noWork ? {} : fm.n,
  noWork: fm.noWork,
  imageV: img
 }, {
  token: "-"
 }).then((function() {
  draftDrop(fm);
  S.fill = null;
  sh.d = null;
  S.stack = [];
  S.page = "proxy";
  S.arg = {};
  render();
  toast("已送出，謝謝您", "ok", 3e3);
 })).catch((function(e) {
  if (!$("psErr")) return toast(esc(e.message), "err", 5e3);
  $("psErr").innerHTML = errBox("送出沒有成功", e.message);
  btn.disabled = false;
  btn.className = "btn";
  btn.textContent = "再送一次";
 }));
}

function proxySubmitM(a, fm, sh) {
 var btn = $("psBtn");
 btn.disabled = true;
 btn.className = "btn busy";
 btn.innerHTML = '<span class="spin"></span>送出中…';
 fm.submitId = fm.submitId || newId();
 api("shareSubmitM", {
  link: sh.link,
  submitId: fm.submitId,
  formId: a.form,
  results: fm.noWork ? {} : fm.r,
  notes: fm.noWork ? {} : fm.n,
  noWork: fm.noWork
 }).then((function() {
  draftDrop(fm);
  S.fill = null;
  sh.d = null;
  S.stack = [];
  S.page = "proxy";
  S.arg = {};
  render();
  toast("已送出，謝謝您", "ok", 3e3);
 })).catch((function(e) {
  if (!$("psErr")) return toast(esc(e.message), "err", 5e3);
  $("psErr").innerHTML = errBox("送出沒有成功", e.message);
  btn.disabled = false;
  btn.className = "btn";
  btn.textContent = "再送一次";
 }));
}

function shareEnter(id) {
 var x = (S.me.shared || []).filter((function(y) {
  return y.id === id;
 }))[0];
 if (!x) return;
 if (x.date !== today()) return toast(md(x.date) + " 當天才能填", "err");
 S.meBak = S.me;
 S.share = {
  member: true,
  link: id,
  name: S.me.person.name
 };
 S.stack = [];
 S.arg = {};
 go("proxy", {}, true);
}

function shareExitBtn() {
 return '<button class="btn ghost" onclick="shareExit()">' + ic("back", 22, 2.4) + "回到我的首頁</button>";
}

function shareExit() {
 if (S.meBak) S.me = S.meBak;
 S.meBak = null;
 S.share = null;
 S.fill = null;
 S.stack = [];
 S.arg = {};
 go("home", {}, true);
 refreshMe();
}

function sharedBlock() {
 var L = S.me && S.me.shared || [], t = today();
 if (!L.length) return "";
 return '<div class="sec">代填分享</div>' + L.map((function(x) {
  var on = x.date === t;
  return '<div class="box warn"><div class="r">' + ic("chat", 22) + '<div class="bt"><b>' + esc(x.from) + " 向您分享了「" + esc(x.dept) + "」" + md(x.date) + "（" + wk(x.date) + "）的每日檢點表</b>" + '<div class="m">請先向 ' + esc(x.from) + " 本人確認是否代填" + (on ? "本日" : " " + md(x.date)) + "。" + (on ? "送出會用您的電子簽名。" : md(x.date) + " 當天這裡會出現「開始代填」。") + (x.used ? "<br>已填：" + esc(x.used.replace(/\n/g, "、")) : "") + "</div>" + (on ? '<div style="margin-top:8px"><button class="btn sm" onclick="shareEnter(' + jsq(x.id) + ')">' + ic("pen", 18, 2.4) + "開始代填</button></div>" : "") + "</div></div></div>";
 })).join("");
}

function remDefault(a) {
 if (a.daily) return {
  on: false,
  time: "08:30",
  days: [ 1, 2, 3, 4, 5 ]
 };
 if (a.freq === "每月") return {
  on: false,
  time: "09:00",
  dom: 25
 };
 return {
  on: false,
  time: "09:00",
  before: a.warnDays || 30
 };
}

var MAIL_KINDS = [ [ "archive", "歸檔完成信（附 PDF）", "每月紀錄歸檔後寄給您，附有您簽名的檢點表（單位負責人附整份）" ], [ "review", "送審、待審核、退回通知信", "有紀錄等您審核或歸檔、您送審的月份被退回時寄給您" ], [ "status", "每月送審狀況信", "每月寄上個月各課的送審狀況（單位負責人、環安衛）" ], [ "notice", "其他通知信", "負責人異動、異常追蹤、教育訓練等" ] ];

PAGES.mailPref = function() {
 setTitle("通知信設定");
 if (!S.mailOff) S.mailOff = (S.me.mailOff || []).slice();
 var boss = isMgr() || isEhs();
 var h = '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><b>這裡只管要不要寄 Email 到公司信箱</b><div class="m">App 裡的「通知」照常都會收到，不能關。打勾＝要寄，取消打勾＝不寄。</div></div></div></div>';
 if (S.me.hasEmail === false) h += '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">名單上沒有登記您的 Email，目前本來就不會收到信；要收信請洽環安衛中心。</div></div></div></div>';
 h += MAIL_KINDS.filter((function(k) {
  return boss || k[0] !== "status";
 })).map((function(k) {
  var on = S.mailOff.indexOf(k[0]) < 0;
  return '<div class="ritem"><label class="ck"><input type="checkbox" id="mk_' + k[0] + '" ' + (on ? "checked" : "") + ' onchange="mailKind(' + jsq(k[0]) + ',this.checked)"><span>' + esc(k[1]) + '<small class="muted" style="display:block;font-weight:400">' + esc(k[2]) + "</small></span></label></div>";
 })).join("");
 if (boss) h += '<div class="muted sm2">關掉「送審、待審核」信後，有紀錄要審核時只會在 App 首頁和通知看到，請記得定期打開 App。</div>';
 $("app").innerHTML = h;
 bar('<button class="btn" id="mpBtn" onclick="mailSave()">' + ic("check", 22, 2.8) + "儲存通知設定</button>");
};

function mailKind(k, on) {
 S.mailOff = S.mailOff.filter((function(x) {
  return x !== k;
 }));
 if (!on) S.mailOff.push(k);
}

function mailSave() {
 var btn = $("mpBtn");
 btn.disabled = true;
 btn.className = "btn busy";
 btn.innerHTML = '<span class="spin"></span>儲存中…';
 api("mailPref", {
  off: S.mailOff
 }).then((function(r) {
  S.me.mailOff = r.off;
  S.mailOff = null;
  var raw = lsGet(LS.ME, null);
  if (raw) {
   raw.mailOff = r.off;
   lsSet(LS.ME, raw);
  }
  toast("已儲存", "ok");
  back();
 })).catch((function(e) {
  toast(esc(e.message), "err", 4e3);
  btn.disabled = false;
  btn.className = "btn";
  btn.textContent = "再試一次";
 }));
}

PAGES.remind = function() {
 setTitle("提醒設定");
 var R = lsGet(LS.REM, {});
 var list = (S.me.assigns || []).filter((function(a) {
  return !a.missingEquip && F(a.form);
 }));
 var h = '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><b>時間到，手機會自己跳通知</b><div class="m">勾選要提醒的項目後按下方按鈕，會下載一個行事曆檔，用手機的「行事曆」開啟加入（不用開著 App）。之後要改，先到行事曆刪掉舊的再重新加入。</div></div></div></div>';
 var row = function(key, title, freq, r) {
  var x = '<div class="ritem"><label class="ck"><input type="checkbox" ' + (r.on ? "checked" : "") + ' onchange="remSet(' + jsq(key) + ",'on',this.checked)\"><span>" + (Array.isArray(title) ? title.map((function(t) {
   return "<span>" + esc(t) + "</span>";
  })).join("") : esc(title)) + "</span></label>";
  if (r.on) {
   x += '<div class="ropts">';
   if (freq === "作業日") {
    x += "<span>每週</span>" + [ 1, 2, 3, 4, 5, 6 ].map((function(d) {
     var on = r.days.indexOf(d) >= 0;
     return '<button class="dchip' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="remDay(' + jsq(key) + "," + d + ')">' + "一二三四五六".charAt(d - 1) + "</button>";
    })).join("");
   } else if (freq === "每月" || freq === "review" || freq === "close") {
    x += '<span>每月</span><select class="field auto" aria-label="每月幾號" onchange="remSet(' + jsq(key) + ",'dom',Number(this.value))\">" + [ -1 ].concat(Array.from({
     length: 28
    }, (function(_, i) {
     return i + 1;
    }))).map((function(d) {
     return '<option value="' + d + '"' + (r.dom === d ? " selected" : "") + ">" + (d === -1 ? "最後一天" : d + " 日") + "</option>";
    })).join("") + "</select>";
   } else {
    x += '<span>到期前</span><input class="field auto num" type="number" aria-label="到期前幾天" value="' + esc(r.before) + '" onchange="remSet(' + jsq(key) + ",'before',Number(this.value))\"><span>天</span>";
   }
   x += '<input class="field auto" type="time" aria-label="提醒時間" value="' + esc(r.time) + '" onchange="remSet(' + jsq(key) + ",'time',this.value)\"></div>";
  }
  return x + "</div>";
 };
 if (!isEhs()) list.forEach((function(a) {
  var r = Object.assign(remDefault(a), R[a.key] || {});
  h += row(a.key, [ a.dept, "｜", aTitle(a), "（" + (a.daily ? "每個作業日" : a.freq) + "）" ], a.daily ? "作業日" : a.freq, r);
 }));
 if (!isEhs() && !isMgr()) h += row("close", "月底送單位負責人", "close", Object.assign({
  on: false,
  time: "16:00",
  dom: -1
 }, R.close || {}));
 if (isMgr() || isEhs()) h += row("review", "每月審核檢點紀錄", "review", Object.assign({
  on: false,
  time: "09:00",
  dom: isEhs() ? 8 : 3
 }, R.review || {}));
 $("app").innerHTML = h;
 bar('<button class="btn" onclick="makeIcs()">' + ic("cal", 22, 2.4) + "加到手機行事曆</button>");
};

function remGet(key) {
 var R = lsGet(LS.REM, {});
 var a = A(key);
 return Object.assign(a ? remDefault(a) : key === "close" ? {
  on: false,
  time: "16:00",
  dom: -1
 } : {
  on: false,
  time: "09:00",
  dom: isEhs() ? 8 : 3
 }, R[key] || {});
}

function remSet(key, k, v) {
 var R = lsGet(LS.REM, {});
 R[key] = remGet(key);
 R[key][k] = v;
 lsSet(LS.REM, R);
 var y = window.scrollY;
 render();
 window.scrollTo(0, y);
}

function remDay(key, d) {
 var r = remGet(key);
 var i = r.days.indexOf(d);
 if (i >= 0) r.days.splice(i, 1); else r.days.push(d);
 remSet(key, "days", r.days.sort());
}

function icsDate(s, t) {
 return s.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
}

function makeIcs() {
 var ev = [], now = (new Date).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", url = location.origin + location.pathname;
 var t = today(), tomorrow = ymd(new Date(Date.now() + 864e5));
 var add = function(uid, title, start, time, rrule) {
  ev.push([ "BEGIN:VEVENT", "UID:" + uid + "@yuanhe-check", "DTSTAMP:" + now, "DTSTART;TZID=Asia/Taipei:" + icsDate(start, time), "DURATION:PT10M", rrule ? "RRULE:" + rrule : "", "SUMMARY:" + title, "DESCRIPTION:" + url, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT" ].filter(String).join("\r\n"));
 };
 (S.me.assigns || []).filter((function(a) {
  return !a.missingEquip && F(a.form);
 })).forEach((function(a) {
  var r = remGet(a.key);
  if (!r.on) return;
  var title = "作業檢點：" + aTitle(a), uid = a.key.replace(/[^\w-]/g, "_") + "_" + S.me.person.id;
  if (a.daily) {
   if (!r.days.length) return;
   add(uid, title, t, r.time, "FREQ=WEEKLY;BYDAY=" + r.days.map((function(d) {
    return [ "MO", "TU", "WE", "TH", "FR", "SA" ][d - 1];
   })).join(","));
  } else if (a.freq === "每月") add(uid, title, t, r.time, "FREQ=MONTHLY;BYMONTHDAY=" + r.dom); else {
   var due = a.due && a.due.due ? a.due.due : tomorrow;
   var d = new Date(due + "T00:00:00");
   d.setDate(d.getDate() - (r.before || 0));
   var when = ymd(d) < tomorrow ? tomorrow : ymd(d);
   add(uid + "_" + when, title + "（期限 " + (a.due && a.due.due ? a.due.due : "請盡快") + "）", when, r.time, "");
  }
 }));
 [ "close", "review" ].forEach((function(k) {
  var r = remGet(k);
  if (!r.on) return;
  if (k === "close" && (isMgr() || isEhs())) return;
  if (k === "review" && !(isMgr() || isEhs())) return;
  add(k + "_" + S.me.person.id, k === "close" ? "作業檢點：月底送單位負責人" : "作業檢點：審核上月檢點紀錄", t, r.time, "FREQ=MONTHLY;BYMONTHDAY=" + r.dom);
 }));
 if (!ev.length) return toast("請先勾選要提醒的項目", "err");
 var tz = [ "BEGIN:VTIMEZONE", "TZID:Asia/Taipei", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800", "TZNAME:CST", "END:STANDARD", "END:VTIMEZONE" ].join("\r\n");
 var ics = [ "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Yuanhe EHS//Check//ZH", "CALSCALE:GREGORIAN", tz ].concat(ev).concat([ "END:VCALENDAR" ]).join("\r\n");
 var blob = new Blob([ ics ], {
  type: "text/calendar;charset=utf-8"
 });
 var a = document.createElement("a");
 a.href = URL.createObjectURL(blob);
 a.download = "作業檢點提醒.ics";
 document.body.appendChild(a);
 a.click();
 a.remove();
 toast("已下載，請用行事曆開啟加入", "ok", 3500);
}

PAGES.settings = function() {
 setTitle("設定");
 var m = S.me;
 $("app").innerHTML = (window.I18N ? '<div class="card"><div class="muted">語言</div>' + I18N.picker() + '<div class="mt" style="margin-top:6px">PDF 與試算表一律中文</div></div>' : "") + '<div class="card"><div class="kv"><div>姓名</div><div><b>' + esc(m.person.name) + "</b></div><div>身分</div><div>" + esc(m.person.role) + "</div><div>部門</div><div>" + esc(m.depts.map((function(d) {
  return d.id;
 })).join("、")) + "</div></div></div>" + '<div class="card"><div class="muted">我的簽名（送出時自動帶入）</div>' + (m.signature ? '<div class="sigimgs"><img src="' + esc(m.signature.image) + '" alt="橫式簽名"><img class="v" src="' + esc(m.signature.imageV) + '" alt="直式簽名"></div>' : "<div>尚未簽名</div>") + '<div><button class="btn ghost sm" onclick="go(\'sign\',{})">' + ic("pen", 18) + "重新簽名</button></div></div>" + '<div class="list">' + (isEhs() ? '<button class="li" onclick="go(\'exportData\')">' + ic("pdf", 22, 2.2) + '<span class="mn"><span class="nm">匯出與補發</span><span class="mt">挑人或部門匯出 PDF：下載、存 Drive／NAS、寄信補發</span></span><span class="chev">' + ic("right", 18) + "</span></button>" : "") + (isEhs() ? '<button class="li" onclick="sysReset()">' + ic("refresh", 22, 2.2) + '<span class="mn"><span class="nm">系統重新整理</span><span class="mt">後台試算表被動到、名單或資料讀不到時按（不刪資料）</span></span></button>' : "") + '<button class="li" onclick="go(\'mailPref\')">' + ic("mail", 22, 2.2) + '<span class="mn"><span class="nm">通知信設定</span><span class="mt">不想收的 Email 可以關掉</span></span><span class="chev">' + ic("right", 18) + "</span></button>" + '<button class="li" onclick="go(\'remind\')">' + ic("bell", 22, 2.2) + '<span class="mn"><span class="nm">提醒設定</span></span><span class="chev">' + ic("right", 18) + "</span></button>" + "<button class=\"li\" onclick=\"refreshMe().then(function(){toast('已更新','ok')})\">" + ic("refresh", 22, 2.2) + '<span class="mn"><span class="nm">重新讀取設定</span><span class="mt">環安衛中心改了表單或指派後按這裡</span></span></button>' + '<button class="li" onclick="logout()" style="color:var(--ngT)">' + ic("logout", 22, 2.2) + '<span class="mn"><span class="nm">換人使用／登出這支手機</span><span class="mt">換別人抄表時用；手機裡沒上傳的檢點會先保留</span></span></button>' + '</div><div class="ver">v' + APP_VERSION + "</div>";
};

function ymAdd(ym, n) {
 var d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1);
 return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
}

PAGES.exportData = function() {
 setTitle("匯出與補發");
 $("app").innerHTML = loading("讀取中…");
 apiR("exportOpts", {}).then((function(o) {
  if (S.page !== "exportData") return;
  S.expOpt = o;
  if (!S.exp) {
   var lm = ymAdd(today().slice(0, 7), -1);
   S.exp = {
    depts: [],
    forms: o.forms.map((function(f) {
     return f.id;
    })),
    from: lm,
    to: lm,
    unsigned: false
   };
  }
  if ((S.expTab || "who") === "who") ewRender(); else expRender();
 })).catch((function(e) {
  $("app").innerHTML = '<div class="empty">' + esc(e.message) + "</div>";
 }));
};

function expRender() {
 var o = S.expOpt, x = S.exp, units = [];
 o.depts.forEach((function(d) {
  if (units.indexOf(d.unit) < 0) units.push(d.unit);
 }));
 var ck = function(kind, v, label) {
  return '<label class="ck"><input type="checkbox" ' + (x[kind].indexOf(v) >= 0 ? "checked" : "") + ' onchange="expPick(' + jsq(kind) + "," + jsq(v) + ',this.checked)"><span>' + esc(label) + "</span></label>";
 };
 var h = expTabs() + '<div class="box info"><div class="r">' + ic("info", 22) + '<div class="bt"><b>每月核准後照常自動歸檔</b><div class="m">這裡是另外要資料時用（例如勞檢、稽核要看某幾個月或某幾張表）。一個部門一個月一份 PDF，多份會打包成 zip 下載。</div></div></div></div>';
 h += '<div class="card"><div class="muted">月份</div><div class="ropts"><input type="month" class="field" value="' + esc(x.from) + '" onchange="S.exp.from=this.value"><span>到</span><input type="month" class="field" value="' + esc(x.to) + '" onchange="S.exp.to=this.value"></div></div>';
 units.forEach((function(u) {
  var ds = o.depts.filter((function(d) {
   return d.unit === u;
  }));
  h += '<div class="ritem"><div class="sec"><span class="sl">' + esc(u) + '</span><button class="btn ghost sm" onclick="expAll(\'depts\',' + jsq(u) + ')">全選／全不選</button></div>' + ds.map((function(d) {
   return ck("depts", d.dept, d.dept);
  })).join("") + "</div>";
 }));
 h += '<div class="ritem"><div class="sec"><span class="sl">檢點表</span><button class="btn ghost sm" onclick="expAll(\'forms\',\'\')">全選／全不選</button></div>' + o.forms.map((function(f) {
  return ck("forms", f.id, f.name);
 })).join("") + "</div>";
 h += '<div class="ritem"><label class="ck"><input type="checkbox" ' + (x.unsigned ? "checked" : "") + ' onchange="S.exp.unsigned=this.checked"><span>也匯出還沒核准歸檔的月份' + '<small class="muted" style="display:block;font-weight:400">PDF 上不會有單位負責人簽名，檔名註明「未簽核」</small></span></label></div>';
 $("app").innerHTML = h;
 bar('<button class="btn" onclick="expRun()">' + ic("pdf", 22, 2.8) + "產生 PDF</button>");
}

function expPick(kind, v, on) {
 var a = S.exp[kind].filter((function(y) {
  return y !== v;
 }));
 if (on) a.push(v);
 S.exp[kind] = a;
}

function expAll(kind, unit) {
 var all = kind === "forms" ? S.expOpt.forms.map((function(f) {
  return f.id;
 })) : S.expOpt.depts.filter((function(d) {
  return d.unit === unit;
 })).map((function(d) {
  return d.dept;
 }));
 var has = all.every((function(v) {
  return S.exp[kind].indexOf(v) >= 0;
 }));
 S.exp[kind] = S.exp[kind].filter((function(v) {
  return all.indexOf(v) < 0;
 })).concat(has ? [] : all);
 expRender();
}

function expRun() {
 var x = S.exp, months = [];
 if (!x.depts.length) return toast("請勾選部門", "err");
 if (!x.forms.length) return toast("請勾選檢點表", "err");
 if (!x.from || !x.to || x.from > x.to) return toast("月份範圍不對", "err");
 for (var m = x.from; m <= x.to && months.length < 120; m = ymAdd(m, 1)) months.push(m);
 var jobs = [];
 x.depts.forEach((function(d) {
  months.forEach((function(mm) {
   jobs.push({
    dept: d,
    period: mm
   });
  }));
 }));
 if (jobs.length > S.expOpt.max) return toast("一次最多 " + S.expOpt.max + " 份（部門數 × 月數），目前 " + jobs.length + " 份，請縮小範圍", "err", 5e3);
 var files = [], skip = 0, i = 0;
 busyOn("產生 PDF 中…", "共 " + jobs.length + " 份，一份約 10～40 秒");
 var step = function() {
  if (i >= jobs.length) return Promise.resolve();
  var j = jobs[i++], t = $("busy") && $("busy").querySelector("b");
  if (t) t.textContent = "產生 PDF 中…（" + i + "/" + jobs.length + "）" + j.dept + " " + ymLabel(j.period);
  return api("exportPdf", {
   dept: j.dept,
   period: j.period,
   forms: x.forms,
   unsigned: x.unsigned
  }).then((function(r) {
   if (r.empty) skip++; else files.push({
    name: r.name,
    bytes: b64bytes(r.base64)
   });
   return step();
  }));
 };
 step().then((function() {
  busyOff();
  if (!files.length) return alert("選的範圍沒有任何紀錄" + (x.unsigned ? "" : "（還沒核准歸檔的月份沒有算進來）"));
  var one = files.length === 1;
  saveFile(one ? new Blob([ files[0].bytes ], {
   type: "application/pdf"
  }) : mkZip(files), one ? files[0].name : "作業檢點紀錄_匯出_" + today().replace(/-/g, "") + ".zip");
  toast("已下載 " + files.length + " 份" + (skip ? "（" + skip + " 份沒有紀錄，略過）" : ""), "ok", 4e3);
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
 }));
}

function b64bytes(b) {
 var bin = atob(b), u = new Uint8Array(bin.length);
 for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
 return u;
}

function saveFile(blob, name) {
 var a = document.createElement("a");
 a.href = URL.createObjectURL(blob);
 a.download = name;
 document.body.appendChild(a);
 a.click();
 a.remove();
}

function mkZip(files) {
 var T = [];
 for (var n = 0; n < 256; n++) {
  var c = n;
  for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  T[n] = c >>> 0;
 }
 var enc = new TextEncoder, parts = [], cen = [], off = 0, csz = 0;
 files.forEach((function(f) {
  var nm = enc.encode(f.name), d = f.bytes, crc = 4294967295;
  for (var i = 0; i < d.length; i++) crc = T[(crc ^ d[i]) & 255] ^ crc >>> 8;
  crc = (crc ^ 4294967295) >>> 0;
  var h = new DataView(new ArrayBuffer(30));
  h.setUint32(0, 67324752, true);
  h.setUint16(4, 20, true);
  h.setUint16(6, 2048, true);
  h.setUint16(12, 33, true);
  h.setUint32(14, crc, true);
  h.setUint32(18, d.length, true);
  h.setUint32(22, d.length, true);
  h.setUint16(26, nm.length, true);
  parts.push(new Uint8Array(h.buffer), nm, d);
  var e = new DataView(new ArrayBuffer(46));
  e.setUint32(0, 33639248, true);
  e.setUint16(4, 20, true);
  e.setUint16(6, 20, true);
  e.setUint16(8, 2048, true);
  e.setUint16(14, 33, true);
  e.setUint32(16, crc, true);
  e.setUint32(20, d.length, true);
  e.setUint32(24, d.length, true);
  e.setUint16(28, nm.length, true);
  e.setUint32(42, off, true);
  cen.push(new Uint8Array(e.buffer), nm);
  csz += 46 + nm.length;
  off += 30 + nm.length + d.length;
 }));
 var z = new DataView(new ArrayBuffer(22));
 z.setUint32(0, 101010256, true);
 z.setUint16(8, files.length, true);
 z.setUint16(10, files.length, true);
 z.setUint32(12, csz, true);
 z.setUint32(16, off, true);
 return new Blob(parts.concat(cen, [ new Uint8Array(z.buffer) ]), {
  type: "application/zip"
 });
}

function sysReset() {
 if (!confirm("系統重新整理？\n\n會檢查並修好後台試算表的表頭、清掉暫存、重建人員指派與功能權限。不會刪任何資料，約 10～30 秒。")) return;
 busyOn("重新整理中…");
 api("sysReset", {}).then((function(o) {
  busyOff();
  alert("完成（沒有刪任何資料）\n\n" + (o.heads.length ? "修好表頭：" + o.heads.join("、") : "表頭都正常") + "\n重建：" + o.steps.join("、"));
  return refreshMe();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
 }));
}

function logout() {
 var name = S.me.person.name, tok = lsGet(LS.TOKEN, "");
 var mine = (S.outbox || []).filter((function(j) {
  return j.token === tok && (j.status === "pending" || j.status === "error");
 }));
 if (mine.length && navigator.onLine && !S.flushing) {
  toast("先上傳您還沒送出的 " + mine.length + " 筆…", "", 2500);
  return flush().then((function() {
   return obRefresh();
  })).then((function() {
   var left = (S.outbox || []).filter((function(j) {
    return j.token === tok && j.status === "pending";
   }));
   if (left.length) logoutNow(name, tok, left.length); else logoutNow(name, tok, 0);
  }));
 }
 logoutNow(name, tok, mine.filter((function(j) {
  return j.status === "pending";
 })).length);
}

function logoutNow(name, tok, left) {
 if (!confirm(left ? "還有 " + left + " 筆檢點沒上傳，登出後要「" + name + "」本人重新登入才會上傳（資料留在這支手機）。確定登出？" : "登出 " + name + "？")) return;
 logoutDo(name, tok);
}

function logoutDo(name, tok) {
 obAll().then((function(a) {
  return Promise.all(a.filter((function(j) {
   return j.token === tok && !j.who;
  })).map((function(j) {
   j.who = name;
   return obPut(j);
  })));
 })).catch((function() {})).then((function() {
  api("logout", {}, {
   quiet: true,
   noRetry: true
  }).catch((function() {}));
  lsDel(LS.TOKEN);
  lsDel(LS.ME);
  authClear();
  rcClear();
  S.me = null;
  S.boot = null;
  S.pkgs = null;
  S.stack = [];
  go("login", {}, true);
  return obRefresh();
 }));
}

var SF_DRAFT = "chk.sfd", SF_GEN = {
 ok: [ "v", "V", "√", "✓", "ˇ", "o", "O", "○" ],
 ng: [ "x", "X", "×", "✗" ],
 na: [ "-", "/", "－", "／", "─", "—" ],
 care: [ "Δ", "△" ]
};

function sfWide() {
 return window.innerWidth >= 900;
}

function sfT(s) {
 return window.I18N && I18N.tr ? I18N.tr(s) : s;
}

function sfMine(v, review) {
 return (v.model.daily || []).map((function(x) {
  var a = (S.me.assigns || []).filter((function(y) {
   return y.daily && y.dept === v.dept && y.form === x.form;
  }))[0];
  var f = (a || review) && (F(x.form, v.period + "-01") || S.me.forms[x.form]);
  return (a || review) && f && f.items && f.items.length ? {
   a,
   x,
   f,
   key: a ? a.key : "r:" + x.form
  } : null;
 })).filter(Boolean);
}

function sfTiles(m) {
 if (!sfWide() || isEhs()) return "";
 return m.depts.filter((function(d) {
  return !demoDept(d.id) && m.assigns.some((function(a) {
   return a.dept === d.id && a.daily;
  }));
 })).map((function(d, i, all) {
  return tile("pen", "表格填寫（電腦版）", "go('sheetFill',{dept:" + jsq(d.id) + ",period:" + jsq(today().slice(0, 7)) + "})", "", all.length > 1 ? d.id : "像試算表一樣，一次填整個月");
 })).join("");
}

function sfDraftAll() {
 return lsGet(SF_DRAFT, {});
}

function sfDraftSave() {
 var sf = S.sf;
 if (!sf || sf.review) return;
 var all = sfDraftAll(), k = sf.dept + "|" + sf.period, any = Object.keys(sf.ed).some((function(x) {
  return Object.keys(sf.ed[x]).length;
 }));
 if (any) all[k] = sf.ed; else delete all[k];
 lsSet(SF_DRAFT, all);
}

PAGES.sheetFill = function() {
 var a = S.arg;
 setTitle("表格填寫");
 if (!S.sf || S.sf.arg !== a) S.sf = {
  arg: a,
  dept: a.dept,
  period: a.period,
  who: a.who || "",
  review: !!a.review,
  fi: 0,
  ed: a.review ? {} : sfDraftAll()[a.dept + "|" + a.period] || {},
  sel: {
   r0: 0,
   c0: 0,
   r1: 0,
   c1: 0
  },
  undo: []
 };
 if (a.review) setTitle("表格審核");
 var sf = S.sf;
 if (!sf.v) $("app").innerHTML = loading("讀取這個月的紀錄中…"); else sfRender();
 if (!sf.v || sf.stale) sfLoad();
};

function sfLoad() {
 var sf = S.sf;
 sf.stale = false;
 return api("monthView", sf.who ? {
  deptId: sf.dept,
  period: sf.period,
  who: sf.who
 } : {
  deptId: sf.dept,
  period: sf.period
 }, {
  quiet: !!sf.v
 }).then((function(v) {
  if (S.page !== "sheetFill" || S.sf !== sf) return;
  sf.v = v;
  sf.list = sfMine(v, sf.review);
  S.view = v;
  if (!sf.seeded) {
   sf.seeded = true;
   sfSeedSel();
  }
  sfRender();
 })).catch((function(e) {
  if (!sf.v) $("app").innerHTML = errBox("讀不到這個月的資料", e.message) + '<button class="btn navy" onclick="render()">再試一次</button>';
 }));
}

function sfSeedSel() {
 var sf = S.sf, it = sf.list[sf.fi];
 if (!it) return;
 var t = today(), n = sfDays(sf.period);
 for (var d = 1; d <= n; d++) {
  var date = sf.period + "-" + pad(d);
  if (date > t) break;
  if (workDay(date) && !sfLock(it, d) && !sfRec(it, d)) {
   sf.sel = {
    r0: 0,
    c0: d,
    r1: 0,
    c1: d
   };
   return;
  }
 }
 var c = Math.min(n, sf.period === t.slice(0, 7) ? Number(t.slice(8)) : 1);
 sf.sel = {
  r0: 0,
  c0: c,
  r1: 0,
  c1: c
 };
}

function sfDays(per) {
 return new Date(Number(per.slice(0, 4)), Number(per.slice(5)), 0).getDate();
}

function sfDate(d) {
 return S.sf.period + "-" + pad(d);
}

function sfRec(it, d) {
 var e = (S.sf.ed[it.key] || {})[d];
 if (e) return e;
 return sfBase(it, d);
}

function sfBase(it, d) {
 var j = it.a && pendJob(it.a, sfDate(d));
 if (j) return {
  r: j.body.results || {},
  n: j.body.notes || {},
  w: !!j.body.noWork,
  pend: true,
  signer: S.me.person.name
 };
 var r = it.x.days[d];
 return r ? {
  r: r.results || {},
  n: r.notes || {},
  w: !!r.noWork,
  signer: r.signer,
  unconf: r.unconf
 } : null;
}

function sfEmpty(x) {
 return !x || !x.w && !Object.keys(x.r || {}).length && !Object.keys(sfNotes(x)).length;
}

function sfSame(p, q) {
 if (sfEmpty(p) && sfEmpty(q)) return true;
 if (!p || !q) return false;
 return !!p.w === !!q.w && JSON.stringify(sfSort(p.r)) === JSON.stringify(sfSort(q.r)) && JSON.stringify(sfSort(sfNotes(p))) === JSON.stringify(sfSort(sfNotes(q)));
}

function sfNotes(r) {
 var o = {};
 Object.keys(r.n || {}).forEach((function(k) {
  if (String(r.n[k] || "").trim()) o[k] = r.n[k];
 }));
 return o;
}

function sfSort(o) {
 var x = {};
 Object.keys(o || {}).sort().forEach((function(k) {
  x[k] = o[k];
 }));
 return x;
}

function sfLock(it, d) {
 var sf = S.sf, v = sf.v, date = sfDate(d), t = today();
 if (sf.review) return "審核畫面，只能看";
 if (!(v.status === "填寫中" || v.status === "退回")) return "本月已送審（" + v.status + "），不能修改";
 if (date > t) return "未來的日子";
 if (demoDept(v.dept) && date !== t) return "示範區只能填今天";
 if (date < fillMin() + "-01") return "超過補填期限";
 var r = it.x.days[d], me = S.me.person.name;
 if (r && r.signer && r.signer !== me && !(r.noWork && !mgrOf(v.dept))) return "這天由 " + r.signer + " 檢點，不能修改";
 return "";
}

function sfDirty(it, d) {
 var e = (S.sf.ed[it.key] || {})[d];
 return !!e && !sfSame(e, sfBase(it, d));
}

function sfProb(it, d) {
 var e = (S.sf.ed[it.key] || {})[d];
 if (!e || e.w) return "";
 var f = it.f, miss = f.items.filter((function(q) {
  return !e.r[q.seq];
 }));
 if (miss.length) return "還有 " + miss.length + " 項沒填（第 " + miss[0].seq + " 項起）";
 for (var i = 0; i < f.items.length; i++) {
  var s = f.items[i].seq, w = noteWhy(f, e, s);
  if (w) return "第 " + s + " 項" + (w === "還沒寫" ? "要寫說明" : "：" + w);
 }
 return "";
}

function sfOpts(it, ri) {
 var q = it.f.items[ri];
 return q && q.opts || it.f.opts;
}

function sfMark(it, ri, k) {
 var o = sfOpts(it, ri).filter((function(x) {
  return x.k === k;
 }))[0];
 return o ? o.mark || o.label : k ? "?" : "";
}

function sfKeyOf(it, ri, s) {
 s = String(s == null ? "" : s).trim();
 if (!s) return "";
 var opts = sfOpts(it, ri);
 if (/^[1-9１-９]$/.test(s)) {
  var o = opts[Number(s.replace(/[１-９]/, (function(c) {
   return String.fromCharCode(c.charCodeAt(0) - 65248);
  }))) - 1];
  return o ? o.k : null;
 }
 var hit = opts.filter((function(o) {
  return o.mark === s || o.label === s;
 }))[0];
 if (hit) return hit.k;
 var g = Object.keys(SF_GEN).filter((function(k) {
  return SF_GEN[k].indexOf(s) >= 0;
 }))[0];
 return g && opts.some((function(o) {
  return o.k === g;
 })) ? g : null;
}

function sfRender() {
 var sf = S.sf, v = sf.v, list = sf.list, t = today();
 var h = '<div class="sfnav"><button class="btn ghost sm" onclick="sfGo(-1)">' + ic("back", 18, 2.8) + "上個月</button><b>" + esc(ymLabel(sf.period)) + "</b>" + '<button class="btn ghost sm" onclick="sfGo(1)"' + (sf.period >= t.slice(0, 7) ? " disabled" : "") + ">下個月" + ic("right", 18, 2.8) + "</button>" + '<span class="sfsp"></span>' + statusPill(v.status) + '<button class="btn ghost sm" onclick="go(\'month\',{dept:' + jsq(sf.dept) + ",period:" + jsq(sf.period) + '})">' + (sf.review ? "月曆檢視" : "月曆・送審") + "</button></div>";
 if (!list.length) {
  $("app").innerHTML = h + (sf.review ? '<div class="empty">這個月沒有每日檢點表。</div>' : '<div class="empty">這個月沒有指派給您的每日檢點表。</div>') + sfPeriodic();
  if (sf.review) sfRevBar(); else bar("");
  return;
 }
 if (sf.fi >= list.length) sf.fi = 0;
 h += sfDeptChips();
 h += '<div class="sftabs" role="tablist">' + list.map((function(it, i) {
  var n = Object.keys(sf.ed[it.key] || {}).filter((function(d) {
   return sfDirty(it, d);
  })).length, nb = sf.review ? sfBadDays(it).length : 0;
  return '<button role="tab" aria-selected="' + (i === sf.fi) + '" class="sftab' + (i === sf.fi ? " on" : "") + '" onclick="sfTab(' + i + ')">' + esc(it.x.name || it.f.name) + (n ? '<i class="sfdot">' + n + "</i>" : "") + (nb ? '<i class="sfdot ng">' + nb + "</i>" : "") + "</button>";
 })).join("") + "</div>";
 var it = list[sf.fi];
 if (sf.review) h += sfRevHead(); else if (sf.period === t.slice(0, 7) && !sfLock(it, Number(t.slice(8)))) h += '<div class="sftool"><button class="btn ghost sm" onclick="sfToday()">' + ic("check", 18, 3) + "今天（" + md(t) + '）全部正常</button><button class="btn ghost sm" onclick="sfTodayNoWork()">今天無作業</button></div>';
 if (!sf.review && !demoDept(v.dept) && (v.status === "填寫中" || v.status === "退回")) h += '<div class="sfhelp">' + ic("info", 16, 2.4) + "<span>點格子直接打字：1 或 V＝正常、2 或 X＝異常、3 或 -＝不適用（依各項的選項）。方向鍵、Tab、Enter 移動；拖曳或 Shift＋方向鍵選一整片一起填；可以從 Excel 複製貼上；Ctrl＋Z 復原。補填的日子會記下填寫時間，單位負責人與環安衛看得到。</span></div>";
 h += '<div class="sfwrap"><div class="sfgrid" id="sfg" tabindex="0" aria-label="' + esc(it.f.name) + '">' + sfTable(it) + '</div><div class="sfside" id="sfs"></div></div>' + sfPeriodic();
 $("app").innerHTML = h;
 for (var d = 1; d <= sfDays(sf.period); d++) sfPaintDay(it, d);
 sfMouse();
 sfPaintSel();
 sfSide();
 if (sf.review) sfRevBar(); else sfBar();
 var g = $("sfg");
 if (g && !document.querySelector(".sfside textarea:focus")) g.focus({
  preventScroll: true
 });
}

function sfTable(it) {
 var sf = S.sf, n = sfDays(sf.period), t = today(), f = it.f;
 var h = '<table><thead><tr><th class="t">項目</th>';
 for (var d = 1; d <= n; d++) {
  var date = sfDate(d), wd = !workDay(date);
  h += '<th class="sfh' + (wd ? " we" : "") + (date === t ? " td" : "") + '" data-c="' + d + '">' + d + "<small>" + esc(wk(date)) + "</small></th>";
 }
 h += "</tr></thead><tbody>";
 var g = null;
 f.items.forEach((function(q, ri) {
  if (q.group && q.group !== g) {
   g = q.group;
   h += '<tr class="sfg"><td class="t" colspan="' + (n + 1) + '">' + esc(g) + "</td></tr>";
  }
  h += '<tr><td class="t" data-r="' + ri + '"><span class="no">' + esc(q.seq) + "</span>" + esc(q.text) + "</td>";
  for (var d = 1; d <= n; d++) h += '<td id="sc' + ri + "_" + d + '" data-r="' + ri + '" data-c="' + d + '"></td>';
  h += "</tr>";
 }));
 var nr = f.items.length;
 h += '<tr class="sfw"><td class="t" data-r="' + nr + '">無作業（整天沒上班、沒作業）</td>';
 for (var d2 = 1; d2 <= n; d2++) h += '<td id="sc' + nr + "_" + d2 + '" data-r="' + nr + '" data-c="' + d2 + '"></td>';
 h += '</tr><tr class="sfsg"><td class="t">檢查人員</td>';
 for (var d3 = 1; d3 <= n; d3++) h += '<td id="sg' + d3 + '"></td>';
 h += "</tr></tbody></table>";
 return h;
}

function sfPaintDay(it, d) {
 var f = it.f, rec = sfRec(it, d), lock = S.sf.review ? "" : sfLock(it, d), dirty = sfDirty(it, d), prob = dirty ? sfProb(it, d) : "", nr = f.items.length;
 f.items.forEach((function(q, ri) {
  var el = $("sc" + ri + "_" + d);
  if (!el) return;
  var k = rec && !rec.w ? rec.r[q.seq] : "", bad = k && (k === "?" || isBad(f, k)), note = rec && String((rec.n || {})[q.seq] || "").trim();
  el.textContent = rec && rec.w ? "" : sfShow(sfMark(it, ri, k));
  el.className = sfKeep(el) + (lock ? "lk" : "") + (bad ? " bad" : "") + (dirty ? " dt" : rec && rec.pend ? " pd" : rec && rec.unconf ? " uc" : "") + (rec && rec.w ? " nw" : "") + (note ? " nt" : "") + (dirty && bad && f.noteFor.indexOf(k) >= 0 && noteWhy(f, rec, q.seq) ? " need" : "") + (dirty && !rec.w && !k ? " miss" : "") + (!rec && !lock && sfGap(d) ? " gap" : "");
  el.title = lock || (note ? sfT("說明") + "：" + rec.n[q.seq] : "");
 }));
 var w = $("sc" + nr + "_" + d);
 if (w) {
  w.textContent = rec && rec.w ? "無" : "";
  w.className = sfKeep(w) + (lock ? "lk" : "") + (dirty ? " dt" : rec && rec.pend ? " pd" : "") + (rec && rec.w ? " on" : "");
  w.title = lock;
 }
 var sg = $("sg" + d);
 if (sg) {
  sg.textContent = dirty ? prob ? "!" : "✎" : rec ? rec.w ? "" : String(rec.signer || "").slice(-2) : "";
  sg.className = dirty ? prob ? "need" : "dt" : rec && rec.pend ? "pd" : "";
  sg.title = dirty ? prob || sfT("存檔後帶入您的簽名") : rec && rec.pend ? sfT("已存，等待上傳") : "";
 }
 var th = document.querySelector('#sfg th[data-c="' + d + '"]');
 if (th) {
  th.classList.toggle("dt", dirty);
  var lt = sfLate(it, d);
  th.classList.toggle("late", !!lt);
  if (lt) th.title = sfT("補登") + " " + lt;
 }
}

function sfGap(d) {
 var date = sfDate(d);
 return date < today() && workDay(date) && !demoDept(S.sf.dept) && !(S.me.startPeriod && S.sf.period < S.me.startPeriod);
}

function sfShow(m) {
 return m === "ˇ" ? "✓" : m;
}

function sfKeep(el) {
 return (el.classList.contains("sel") ? "sel " : "") + (el.classList.contains("cur") ? "cur " : "");
}

function sfPaintSel() {
 var sf = S.sf, s = sf.sel, g = $("sfg");
 if (!g) return;
 g.querySelectorAll("td.sel,td.cur").forEach((function(e) {
  e.classList.remove("sel");
  e.classList.remove("cur");
 }));
 var r0 = Math.min(s.r0, s.r1), r1 = Math.max(s.r0, s.r1), c0 = Math.min(s.c0, s.c1), c1 = Math.max(s.c0, s.c1);
 for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
  var e = $("sc" + r + "_" + c);
  if (e) e.classList.add("sel");
 }
 var cur = $("sc" + s.r1 + "_" + s.c1);
 if (cur) {
  cur.classList.add("cur");
  sfScrollTo(cur);
 }
}

function sfScrollTo(el) {
 var g = $("sfg");
 if (!g) return;
 var gr = g.getBoundingClientRect(), er = el.getBoundingClientRect(), lw = 260;
 if (er.left < gr.left + lw) g.scrollLeft -= gr.left + lw - er.left + 8; else if (er.right > gr.right) g.scrollLeft += er.right - gr.right + 8;
 if (er.top < gr.top + 40) g.scrollTop -= gr.top + 40 - er.top + 4; else if (er.bottom > gr.bottom) g.scrollTop += er.bottom - gr.bottom + 4;
}

function sfSide() {
 var sf = S.sf, el = $("sfs"), it = sf.list[sf.fi];
 if (!el || !it) return;
 if (sf.review) return sfRevSide(el, it);
 var s = sf.sel, d = s.c1, ri = s.r1, f = it.f, q = f.items[ri], date = sfDate(d), rec = sfRec(it, d), lock = sfLock(it, d);
 var h = '<div class="card"><div class="mr"><b>' + md(date) + "（" + esc(wk(date)) + "）</b>" + (lock ? pill("na", "", sfT("不能修改")) : sfDirty(it, d) ? pill("warn", "pen", sfT("未存檔")) : rec && rec.pend ? pill("ok", "cloud", sfT("已存，等待上傳")) : rec ? pill("ok", "check", sfT("已送出")) : "") + "</div>";
 if (lock) h += '<div class="muted">' + esc(lock) + "</div>";
 if (q) {
  var k = rec && !rec.w ? rec.r[q.seq] : "";
  h += '<div class="sfq"><span class="sfno">' + esc(q.seq) + "</span>" + esc(q.text) + (q.method ? " <small>（" + esc(q.method) + "）</small>" : "") + "</div>";
  if (!lock && !(rec && rec.w)) h += '<div class="sfopts">' + sfOpts(it, ri).map((function(o, i) {
   return '<button class="opt ' + optClass(o.k) + (k === o.k ? " on" : "") + '" onclick="sfPut(' + jsq(o.k) + ')"><kbd>' + (i + 1) + "</kbd>" + esc(o.label) + "</button>";
  })).join("") + "</div>"; else if (k) h += '<div class="muted">' + esc(optLabel(f, q.seq, k)) + "</div>";
  if (k && f.noteFor.indexOf(k) >= 0) {
   var w = rec && !lock ? noteWhy(f, rec, q.seq) : "";
   h += '<label class="nl req" for="sfn">' + esc(f.noteTitle || "請說明異常狀況與處理方式") + "</label>" + '<textarea id="sfn" class="note"' + (lock ? " disabled" : "") + ' placeholder="' + esc(f.noteTitle || "請說明異常狀況與處理方式") + '" oninput="sfNote(this.value)" onkeydown="sfNoteKey(event)">' + esc(rec && rec.n[q.seq] || "") + "</textarea>" + '<div class="hint nbad" id="sfnh"' + (w && String((rec.n || {})[q.seq] || "").trim() ? "" : " hidden") + ">" + esc(w) + '</div><div class="muted sm2">' + esc(sfT("寫完按 Esc 回到表格")) + "</div>";
  } else if (rec && rec.n && rec.n[q.seq]) h += '<div class="muted">' + esc(sfT("說明") + "：" + rec.n[q.seq]) + "</div>";
 } else h += '<div class="muted">' + esc(rec && rec.w ? "這一天記為「無作業」，表上留空白。" : "這一天整天沒上班、沒作業，就在這一列打 1 或 V。") + "</div>";
 h += "</div>" + sfTodo();
 el.innerHTML = h;
}

function sfTodo() {
 var sf = S.sf, rows = [];
 sf.list.forEach((function(it, i) {
  Object.keys(sf.ed[it.key] || {}).sort((function(a, b) {
   return a - b;
  })).forEach((function(d) {
   if (!sfDirty(it, d)) return;
   var p = sfProb(it, d);
   if (p) rows.push({
    i,
    d: Number(d),
    t: md(sfDate(d)) + " " + (it.x.name || it.f.name),
    p
   });
  }));
 }));
 if (!rows.length) return "";
 return '<div class="card"><b>' + esc("還沒填完的日子（" + rows.length + "）") + '</b><div class="list">' + rows.slice(0, 30).map((function(x) {
  return '<button class="li" onclick="sfJump(' + x.i + "," + x.d + ')"><span class="mn"><span class="nm">' + esc(x.t) + '</span><span class="mt wn">' + esc(x.p) + "</span></span></button>";
 })).join("") + '</div><div class="muted sm2">' + esc(sfT("沒填完的先留在草稿，不會不見；填好再存檔。")) + "</div></div>";
}

function sfJump(i, d) {
 var sf = S.sf, it = sf.list[i], e = (sf.ed[it.key] || {})[d], ri = 0;
 if (e) {
  var miss = it.f.items.map((function(q, j) {
   return j;
  })).filter((function(j) {
   var s = it.f.items[j].seq;
   return !e.r[s] || noteWhy(it.f, e, s);
  }));
  ri = miss.length ? miss[0] : 0;
 }
 sf.sel = {
  r0: ri,
  c0: d,
  r1: ri,
  c1: d
 };
 if (i !== sf.fi) {
  sf.fi = i;
  sfRender();
 } else {
  sfPaintSel();
  sfSide();
  $("sfg").focus({
   preventScroll: true
  });
 }
}

function sfSaveList() {
 var sf = S.sf, ok = [], bad = 0;
 sf.list.forEach((function(it) {
  Object.keys(sf.ed[it.key] || {}).forEach((function(d) {
   if (!sfDirty(it, d)) return;
   if (sfProb(it, d)) bad++; else ok.push({
    it,
    d: Number(d)
   });
  }));
 }));
 return {
  ok,
  bad
 };
}

function sfBar() {
 var s = sfSaveList();
 if (!s.ok.length && !s.bad.length) return bar("");
 bar((s.ok.length ? '<button class="btn" id="sfBtn" onclick="sfSave()">' + ic("check", 22, 2.8) + "存檔並帶入簽名（" + s.ok.length + " 天）</button>" : '<button class="btn" disabled>還沒有填完的日子可以存</button>') + (s.bad.length ? '<div class="muted sm2">還沒填完 ' + s.bad.length + " 天（先留在草稿，右邊有清單）</div>" : ""));
}

function sfEditRec(it, d) {
 var ed = S.sf.ed[it.key] = S.sf.ed[it.key] || {};
 if (!ed[d]) {
  var b = sfBase(it, d);
  ed[d] = {
   r: Object.assign({}, b ? b.r : {}),
   n: Object.assign({}, b ? b.n : {}),
   w: !!(b && b.w)
  };
 }
 return ed[d];
}

function sfAfter(it, days) {
 var sf = S.sf, ed = sf.ed[it.key] || {};
 days.forEach((function(d) {
  if (ed[d] && sfSame(ed[d], sfBase(it, d))) delete ed[d];
  sfPaintDay(it, d);
 }));
 sfDraftSave();
 sfSide();
 sfBar();
 sfTabDots();
}

function sfTabDots() {
 var sf = S.sf;
 document.querySelectorAll(".sftab").forEach((function(b, i) {
  var it = sf.list[i];
  if (!it) return;
  var n = Object.keys(sf.ed[it.key] || {}).filter((function(d) {
   return sfDirty(it, d);
  })).length, dot = b.querySelector(".sfdot");
  if (n && !dot) {
   dot = document.createElement("i");
   dot.className = "sfdot";
   b.appendChild(dot);
  }
  if (dot) {
   if (n) dot.textContent = n; else dot.remove();
  }
 }));
}

function sfPush() {
 var sf = S.sf;
 sf.undo.push(JSON.stringify(sf.ed));
 if (sf.undo.length > 60) sf.undo.shift();
}

function sfUndo() {
 var sf = S.sf;
 if (!sf.undo.length) return toast("沒有可以復原的動作", "", 1500);
 sf.ed = JSON.parse(sf.undo.pop());
 var it = sf.list[sf.fi];
 for (var d = 1; d <= sfDays(sf.period); d++) sfPaintDay(it, d);
 sfDraftSave();
 sfSide();
 sfBar();
 sfTabDots();
}

function sfRect() {
 var s = S.sf.sel;
 return {
  r0: Math.min(s.r0, s.r1),
  r1: Math.max(s.r0, s.r1),
  c0: Math.min(s.c0, s.c1),
  c1: Math.max(s.c0, s.c1)
 };
}

function sfFill(fn, ext) {
 var sf = S.sf, it = sf.list[sf.fi], R = sfRect(), nr = it.f.items.length, days = [], skip = 0;
 if (ext) {
  R.r1 = Math.min(nr, ext.r1);
  R.c1 = Math.min(sfDays(sf.period), ext.c1);
  sf.sel = {
   r0: R.r0,
   c0: R.c0,
   r1: R.r1,
   c1: R.c1
  };
  sfPaintSel();
 }
 var one = R.r0 === R.r1 && R.c0 === R.c1;
 sfPush();
 for (var c = R.c0; c <= R.c1; c++) {
  if (sfLock(it, c)) {
   skip++;
   continue;
  }
  var touched = false;
  for (var r = R.r0; r <= R.r1; r++) {
   var val = fn(r, c);
   if (val === null || val === undefined) continue;
   var e = sfEditRec(it, c);
   if (r === nr) {
    e.w = !!val;
   } else {
    var s = it.f.items[r].seq;
    if (val) e.r[s] = val; else delete e.r[s];
    if (val) e.w = false;
   }
   touched = true;
  }
  if (touched) days.push(c);
 }
 if (!days.length) {
  sf.undo.pop();
  if (skip) toast(sfLock(it, R.c0) || "這幾天不能修改", "", 2200);
  return false;
 }
 sfAfter(it, days);
 if (skip && !one) toast("有 " + skip + " 天不能修改，已略過", "", 2200);
 return true;
}

function sfPut(k) {
 var sf = S.sf, it = sf.list[sf.fi], nr = it.f.items.length, idx = sfOpts(it, sf.sel.r1).map((function(o) {
  return o.k;
 })).indexOf(k);
 sfFill((function(r) {
  if (r === nr) return null;
  var o = sfOpts(it, r);
  return (o.filter((function(x) {
   return x.k === k;
  }))[0] || o[idx] || {}).k || null;
 }));
 sfAfterPut(k);
}

function sfAfterPut(k) {
 var sf = S.sf, it = sf.list[sf.fi], R = sfRect();
 if (R.r0 === R.r1 && R.c0 === R.c1 && R.r0 < it.f.items.length && it.f.noteFor.indexOf(k) >= 0) {
  var ta = $("sfn");
  if (ta && !String(ta.value).trim()) {
   ta.focus();
   return;
  }
 }
 if (R.r0 === R.r1 && R.c0 === R.c1) sfMove(1, 0, false);
}

function sfType(ch) {
 var sf = S.sf, it = sf.list[sf.fi], nr = it.f.items.length;
 if (sf.sel.r1 === nr && Math.min(sf.sel.r0, sf.sel.r1) === nr) {
  var on = !(sfRec(it, sf.sel.c1) || {}).w;
  if (sfFill((function(r) {
   return r === nr ? on : null;
  }))) sfMove(0, 1, false);
  return true;
 }
 var k0 = sfKeyOf(it, sf.sel.r1, ch);
 if (k0 === null) {
  toast("看不懂「" + esc(ch) + "」：請打 1／2／3 或 V／X／-", "err", 2200);
  return true;
 }
 if (!k0) return false;
 var ki = sfOpts(it, sf.sel.r1).map((function(o) {
  return o.k;
 })).indexOf(k0);
 sfFill((function(r) {
  if (r === nr) return null;
  var k = sfKeyOf(it, r, ch);
  if (k === null && ki >= 0) {
   var o = sfOpts(it, r)[ki];
   k = o ? o.k : null;
  }
  return k;
 }));
 sfAfterPut(k0);
 return true;
}

function sfClear() {
 var it = S.sf.list[S.sf.fi], nr = it.f.items.length;
 sfFill((function(r) {
  return r === nr ? false : "";
 }));
}

function sfNote(val) {
 var sf = S.sf, it = sf.list[sf.fi], d = sf.sel.c1, q = it.f.items[sf.sel.r1];
 if (!q || sfLock(it, d)) return;
 var e = sfEditRec(it, d);
 e.n[q.seq] = val;
 var ed = sf.ed[it.key];
 if (sfSame(e, sfBase(it, d))) delete ed[d];
 sfPaintDay(it, d);
 sfDraftSave();
 sfBar();
 sfTabDots();
 var w = String(val || "").trim() ? noteWhy(it.f, e, q.seq) : "", hn = $("sfnh");
 if (hn) {
  hn.textContent = w;
  hn.hidden = !w;
 }
 var sd = document.querySelector("#sfs .card + .card");
 var nt = sfTodo();
 if (sd) {
  if (nt) sd.outerHTML = nt; else sd.remove();
 } else if (nt) $("sfs").insertAdjacentHTML("beforeend", nt);
}

function sfNoteKey(e) {
 if (e.key === "Escape" || e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
  e.preventDefault();
  $("sfg").focus({
   preventScroll: true
  });
  sfMove(1, 0, false);
 } else if (e.key === "Tab") {
  e.preventDefault();
  $("sfg").focus({
   preventScroll: true
  });
  sfMove(0, e.shiftKey ? -1 : 1, false);
 }
}

function sfMove(dr, dc, ext) {
 var sf = S.sf, it = sf.list[sf.fi], s = sf.sel, nr = it.f.items.length, n = sfDays(sf.period);
 var r = Math.max(0, Math.min(nr, s.r1 + dr)), c = Math.max(1, Math.min(n, s.c1 + dc));
 sf.sel = ext ? {
  r0: s.r0,
  c0: s.c0,
  r1: r,
  c1: c
 } : {
  r0: r,
  c0: c,
  r1: r,
  c1: c
 };
 sfPaintSel();
 sfSide();
}

function sfKey(e) {
 if (S.page !== "sheetFill" || !S.sf || !S.sf.list || !S.sf.list.length) return;
 var a = document.activeElement;
 if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
 if (a && /^(BUTTON|A)$/.test(a.tagName) && (e.key === "Enter" || e.key === " ")) return;
 if (document.querySelector(".dlg,.pview,#busy")) return;
 var k = e.key, it = S.sf.list[S.sf.fi], ctl = e.ctrlKey || e.metaKey;
 if (S.sf.review && !(ctl && /^Page/.test(k)) && [ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Home", "End" ].indexOf(k) < 0) return;
 if (ctl && (k === "z" || k === "Z")) {
  e.preventDefault();
  return sfUndo();
 }
 if (ctl && k === "s") {
  e.preventDefault();
  return sfSave();
 }
 if (ctl && (k === "PageDown" || k === "PageUp")) {
  e.preventDefault();
  return sfTab((S.sf.fi + (k === "PageDown" ? 1 : -1) + S.sf.list.length) % S.sf.list.length);
 }
 if (ctl && k === "a") {
  e.preventDefault();
  S.sf.sel = {
   r0: 0,
   c0: 1,
   r1: it.f.items.length - 1,
   c1: sfDays(S.sf.period)
  };
  sfPaintSel();
  return sfSide();
 }
 if (ctl || e.altKey) return;
 var mv = {
  ArrowUp: [ -1, 0 ],
  ArrowDown: [ 1, 0 ],
  ArrowLeft: [ 0, -1 ],
  ArrowRight: [ 0, 1 ]
 }[k];
 if (mv) {
  e.preventDefault();
  return sfMove(mv[0], mv[1], e.shiftKey);
 }
 if (k === "Tab") {
  e.preventDefault();
  return sfMove(0, e.shiftKey ? -1 : 1, false);
 }
 if (k === "Enter") {
  e.preventDefault();
  var ta = $("sfn");
  if (ta && !e.shiftKey && !ta.disabled) return ta.focus();
  return sfMove(e.shiftKey ? -1 : 1, 0, false);
 }
 if (k === "Home") {
  e.preventDefault();
  return sfMove(0, -99, e.shiftKey);
 }
 if (k === "End") {
  e.preventDefault();
  return sfMove(0, 99, e.shiftKey);
 }
 if (k === "Delete" || k === "Backspace") {
  e.preventDefault();
  return sfClear();
 }
 if (k === " ") {
  e.preventDefault();
  return sfType("1");
 }
 if (k.length === 1 && sfType(k)) e.preventDefault();
}

function sfMouse() {
 var g = $("sfg");
 if (!g) return;
 var down = false;
 var cell = function(t) {
  var td = t.closest && t.closest("td[data-c],th[data-c],td[data-r]");
  return td && g.contains(td) ? td : null;
 };
 g.onmousedown = function(e) {
  var td = cell(e.target);
  if (!td || e.button !== 0) return;
  var sf = S.sf, it = sf.list[sf.fi], nr = it.f.items.length, n = sfDays(sf.period);
  if (td.tagName === "TH") {
   var c = Number(td.getAttribute("data-c"));
   sf.sel = e.shiftKey ? {
    r0: 0,
    c0: sf.sel.c0,
    r1: nr - 1,
    c1: c
   } : {
    r0: 0,
    c0: c,
    r1: nr - 1,
    c1: c
   };
  } else if (!td.hasAttribute("data-c")) {
   var r = Number(td.getAttribute("data-r"));
   sf.sel = {
    r0: r,
    c0: 1,
    r1: r,
    c1: n
   };
  } else {
   var r2 = Number(td.getAttribute("data-r")), c2 = Number(td.getAttribute("data-c"));
   sf.sel = e.shiftKey ? {
    r0: sf.sel.r0,
    c0: sf.sel.c0,
    r1: r2,
    c1: c2
   } : {
    r0: r2,
    c0: c2,
    r1: r2,
    c1: c2
   };
   down = true;
  }
  e.preventDefault();
  g.focus({
   preventScroll: true
  });
  sfPaintSel();
  sfSide();
 };
 g.onmouseover = function(e) {
  if (!down || !(e.buttons & 1)) {
   down = false;
   return;
  }
  var td = cell(e.target);
  if (!td || !td.hasAttribute("data-c") || td.tagName === "TH") return;
  var sf = S.sf, r = Number(td.getAttribute("data-r")), c = Number(td.getAttribute("data-c"));
  if (sf.sel.r1 === r && sf.sel.c1 === c) return;
  sf.sel.r1 = r;
  sf.sel.c1 = c;
  sfPaintSel();
 };
 g.onmouseup = function() {
  if (down) {
   down = false;
   sfSide();
  }
 };
 g.ondblclick = function(e) {
  var td = cell(e.target);
  if (!td || !td.hasAttribute("data-c") || td.tagName === "TH" || S.sf.review) return;
  var sf = S.sf, it = sf.list[sf.fi], r = Number(td.getAttribute("data-r")), c = Number(td.getAttribute("data-c"));
  if (r === it.f.items.length) return sfType("1");
  var o = sfOpts(it, r), rec = sfRec(it, c), cur = rec && !rec.w ? rec.r[it.f.items[r].seq] : "", i = o.map((function(x) {
   return x.k;
  })).indexOf(cur);
  sfFill((function(rr) {
   return rr === r ? o[(i + 1) % o.length].k : null;
  }));
 };
 g.oncopy = function(e) {
  var sf = S.sf, it = sf.list[sf.fi], R = sfRect(), nr = it.f.items.length, rows = [];
  for (var r = R.r0; r <= R.r1; r++) {
   var row = [];
   for (var c = R.c0; c <= R.c1; c++) {
    var rec = sfRec(it, c);
    row.push(r === nr ? rec && rec.w ? "無" : "" : rec && !rec.w ? sfMark(it, r, rec.r[it.f.items[r].seq]) : "");
   }
   rows.push(row.join("\t"));
  }
  e.clipboardData.setData("text/plain", rows.join("\n"));
  e.preventDefault();
  toast("已複製", "", 1200);
 };
 g.onpaste = function(e) {
  var txt = e.clipboardData && e.clipboardData.getData("text/plain") || "";
  if (!txt || S.sf.review) return;
  e.preventDefault();
  var sf = S.sf, it = sf.list[sf.fi], R = sfRect(), nr = it.f.items.length, rows = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((function(l) {
   return l.split("\t");
  }));
  var single = rows.length === 1 && rows[0].length === 1, bad = 0;
  sfFill((function(r, c) {
   var s = single ? rows[0][0] : (rows[r - R.r0] || [])[c - R.c0];
   if (!single && (r - R.r0 >= rows.length || c - R.c0 >= (rows[0] || []).length)) return null;
   s = String(s == null ? "" : s).trim();
   if (!s) return null;
   if (r === nr) return /^(無|無作業|v|V|1|✓|√)$/.test(s) ? true : null;
   var k = sfKeyOf(it, r, s);
   if (k === null) {
    bad++;
    return null;
   }
   return k;
  }), single ? null : {
   r1: R.r0 + rows.length - 1,
   c1: R.c0 + rows[0].length - 1
  });
  if (bad) toast("有 " + bad + " 格看不懂，沒有貼上", "err", 2600);
 };
}

function sfTab(i) {
 var sf = S.sf;
 if (i === sf.fi) return;
 sf.fi = i;
 sf.undo = [];
 sfSeedSel();
 sfRender();
}

function sfGo(k) {
 var sf = S.sf, np = addM(sf.period, k);
 if (np > today().slice(0, 7)) return;
 S.sf = null;
 go("sheetFill", sf.review ? {
  dept: sf.dept,
  period: np,
  who: sf.who || undefined,
  review: 1
 } : {
  dept: sf.dept,
  period: np
 }, true);
}

function sfSave() {
 var sf = S.sf, s = sfSaveList();
 if (!s.ok.length) return toast(s.bad ? "還沒填完的日子不能存，右邊有清單" : "沒有要存的", "", 2400);
 if (S.dev) return devBlock("表格填寫");
 var btn = $("sfBtn");
 if (btn) {
  btn.disabled = true;
  btn.className = "btn busy";
  btn.innerHTML = '<span class="spin"></span>' + esc(sfT("存檔中…"));
 }
 var tok = lsGet(LS.TOKEN, ""), who = S.me.person.name, p = Promise.resolve(), saved = [];
 s.ok.forEach((function(x) {
  var it = x.it, a = it.a, e = sf.ed[a.key][x.d], date = sfDate(x.d), notes = {};
  if (!e.w) Object.keys(e.n || {}).forEach((function(k) {
   if (k !== "*" && String(e.n[k] || "").trim() && isBad(it.f, e.r[k])) notes[k] = e.n[k];
  }));
  var body = {
   deptId: a.dept,
   formId: a.form,
   object: a.object || "",
   kind: a.kind || "",
   date,
   results: e.w ? {} : e.r,
   notes,
   extra: {},
   noWork: !!e.w
  };
  var job = {
   id: newId(),
   token: tok,
   who,
   key: a.key,
   body,
   created: Date.now(),
   status: "pending",
   label: it.f.name + " " + md(date),
   via: "grid"
  };
  p = p.then((function() {
   return obPut(job);
  })).then((function() {
   saved.push(x);
  }));
 }));
 p.then((function() {
  saved.forEach((function(x) {
   delete sf.ed[x.it.key][x.d];
  }));
  sfDraftSave();
  return obRefresh();
 })).then((function() {
  sfRender();
  toast("已存 " + saved.length + " 天，已帶入您的簽名；背景上傳中", "ok", 3500);
  flush().then((function() {
   if (S.page === "sheetFill" && S.sf === sf) {
    sf.stale = true;
    sfLoad();
   }
  }));
 })).catch((function(err) {
  toast("存檔失敗：" + esc(err.message), "err", 5e3);
  sfRender();
 }));
}

document.addEventListener("keydown", sfKey);

function slBox(v) {
 var open = v.status === "填寫中" || v.status === "退回";
 var h = '<a class="link" href="' + esc(v.sheetEdit || v.sheetUrl) + '" target="_blank" rel="noopener">' + ic("ext", 18, 2.2) + (v.sheetOpen ? "在 Google 試算表編輯" : "在 Google 試算表檢視（唯讀）") + "</a>";
 if (!open) return h;
 if (v.sheetOpen) return h + '<div class="slrow"><span class="muted sm2">已開放編輯到 ' + esc(v.sheetOpen) + '，時間到自動收回。在試算表改的內容，要本人回 App 確認才算簽名。</span><button class="btn ghost sm" onclick="slRelock()">立即收回</button></div>';
 return h + '<div class="slrow"><input type="password" class="field" id="slpw" placeholder="試算表編輯密碼（後台「設定」）" autocomplete="off" onkeydown="if(event.key===\'Enter\')slUnlock()"><button class="btn ghost sm" id="slBtn" onclick="slUnlock()">開放編輯 30 分鐘</button></div>';
}

function slUnlock() {
 var v = S.view, el = $("slpw"), pw = el ? el.value : "";
 if (!String(pw).trim()) {
  if (el) el.focus();
  return toast("請輸入試算表編輯密碼", "err");
 }
 var b = $("slBtn");
 if (b) {
  b.disabled = true;
  b.innerHTML = '<span class="spin"></span>';
 }
 api("sheetUnlock", {
  deptId: v.dept,
  period: v.period,
  pw
 }).then((function(r) {
  v.sheetOpen = r.until;
  v.sheetEdit = r.url;
  rcClear();
  monthRender();
  toast("已開放編輯到 " + esc(r.until) + "，點「在 Google 試算表編輯」", "ok", 4e3);
 })).catch((function(e) {
  if (b) {
   b.disabled = false;
   b.textContent = "開放編輯 30 分鐘";
  }
  toast(esc(e.message), "err", 4e3);
 }));
}

function slRelock() {
 var v = S.view;
 api("sheetRelock", {
  deptId: v.dept,
  period: v.period
 }).then((function() {
  v.sheetOpen = "";
  v.sheetEdit = "";
  rcClear();
  monthRender();
  toast("已收回，試算表恢復唯讀", "ok");
 })).catch((function(e) {
  toast(esc(e.message), "err", 4e3);
 }));
}

function sfBadDays(it) {
 return Object.keys(it.x.days).filter((function(d) {
  return dayBad(it.f, it.x.days[d]);
 }));
}

function sfLate(it, d) {
 var L = S.sf.v.model.late || {}, x = L[it.x.form];
 return x && x[d] ? String(x[d]).slice(5, 16) : "";
}

function sfBadList() {
 var out = [];
 S.sf.list.forEach((function(it, i) {
  Object.keys(it.x.days).sort((function(a, b) {
   return a - b;
  })).forEach((function(d) {
   var r = it.x.days[d];
   if (!r || r.noWork) return;
   it.f.items.forEach((function(q, ri) {
    var k = (r.results || {})[q.seq];
    if (!(k === "?" || k && it.f.noteFor.indexOf(k) >= 0)) return;
    out.push({
     i,
     d: Number(d),
     ri,
     t: md(sfDate(Number(d))) + " " + (it.x.name || it.f.name),
     q: "第 " + q.seq + " 項 " + q.text,
     k: k === "?" ? "?" : optLabel(it.f, q.seq, k),
     n: (r.notes || {})[q.seq] || ""
    });
   }));
  }));
 }));
 return out;
}

function sfRevHead() {
 var sf = S.sf, v = sf.v, days = 0, nw = 0, late = 0, uc = 0;
 sf.list.forEach((function(it) {
  Object.keys(it.x.days).forEach((function(d) {
   var r = it.x.days[d];
   if (r.noWork) nw++; else days++;
   if (r.unconf) uc++;
  }));
  late += Object.keys((v.model.late || {})[it.x.form] || {}).length;
 }));
 var nb = sfBadList().length;
 return '<div class="stats sfstats">' + (v.submitter ? "<span>送審人 <b>" + esc(v.submitter) + "</b></span>" : "") + "<span>每日表 <b>" + sf.list.length + "</b> 張</span><span>檢點 <b>" + days + "</b> 天次</span><span>無作業 <b>" + nw + "</b> 天次</span>" + (nb ? '<span class="ng">異常 <b>' + nb + "</b> 項</span>" : "<span>異常 <b>0</b> 項</span>") + (late ? '<span class="wn">補登 <b>' + late + "</b> 天次</span>" : "") + (uc ? '<span class="wn">試算表填的待確認 <b>' + uc + "</b></span>" : "") + "<span>定期檢查 <b>" + (v.model.periodic || []).length + "</b> 份</span></div>";
}

function sfRevSide(el, it) {
 var sf = S.sf, s = sf.sel, d = s.c1, q = it.f.items[s.r1], date = sfDate(d), r = it.x.days[d], lt = sfLate(it, d);
 var h = '<div class="card"><div class="mr"><b>' + md(date) + "（" + esc(wk(date)) + "）</b>" + (r && r.signer ? '<span class="muted">檢查人員 ' + esc(r.signer) + "</span>" : "") + "</div>";
 if (!r) h += '<div class="muted">這天沒有紀錄。</div>'; else if (r.noWork) h += '<div class="muted">這天記為「無作業」。</div>'; else if (q) {
  var k = (r.results || {})[q.seq];
  h += '<div class="sfq"><span class="sfno">' + esc(q.seq) + "</span>" + esc(q.text) + "</div>" + (k ? pill(k === "?" || isBad(it.f, k) ? "ng" : "ok", k === "?" || isBad(it.f, k) ? "x" : "check", k === "?" ? "?" : optLabel(it.f, q.seq, k)) : pill("na", "", "未填")) + ((r.notes || {})[q.seq] ? '<div class="ex"><b>說明</b>：' + esc(r.notes[q.seq]) + "</div>" : "");
 }
 if (lt) h += '<div class="muted" style="color:var(--orT)">補登：' + esc(lt) + " 登錄</div>";
 if (r && r.proxy) h += '<div class="muted" style="color:var(--orT)">' + esc(r.proxy) + "，簽名為代填人當場手寫</div>";
 if (r && r.unconf) h += '<div class="muted" style="color:var(--orT)">在試算表填的，本人還沒在 App 確認</div>';
 h += "</div>";
 var v = sf.v;
 if (v.problems && v.problems.length) h += '<div class="card"><b>送審檢查還有 ' + v.problems.length + ' 個問題</b><div class="list">' + v.problems.slice(0, 15).map((function(p) {
  return '<div class="li" style="min-height:44px"><span class="mn"><span class="mt wn">' + esc(p) + "</span></span></div>";
 })).join("") + "</div></div>";
 var bl = sfBadList();
 h += '<div class="card"><b>' + esc("異常一覽（" + bl.length + "）") + "</b>" + (bl.length ? '<div class="list">' + bl.slice(0, 40).map((function(x) {
  return '<button class="li" onclick="sfGoCell(' + x.i + "," + x.d + "," + x.ri + ')"><span class="mn"><span class="nm">' + esc(x.t) + '</span><span class="mt">' + esc(x.q + "：" + x.k) + "</span>" + (x.n ? '<span class="mt">' + esc("說明：" + x.n) + "</span>" : '<span class="mt wn">' + esc("沒有說明") + "</span>") + "</span></button>";
 })).join("") + "</div>" : '<div class="muted">這個月沒有異常項目。</div>') + "</div>";
 el.innerHTML = h;
}

function sfGoCell(i, d, ri) {
 var sf = S.sf;
 sf.sel = {
  r0: ri,
  c0: d,
  r1: ri,
  c1: d
 };
 if (i !== sf.fi) {
  sf.fi = i;
  sfRender();
 } else {
  sfPaintSel();
  sfSide();
  $("sfg").focus({
   preventScroll: true
  });
 }
}

function sfRevBar() {
 var v = S.sf.v, boss = mgrOf(v.dept), ehs = isEhs();
 if (v.status === "待主管審核" && boss && !ehs) {
  bar('<div class="sfrb"><textarea id="cm" class="note plain" placeholder="意見：核准可不填；退回要寫要改哪一天、哪一項，例：10/3、10/7 堆高機第 5 項沒寫異常說明">' + esc(S.cm || "") + "</textarea>" + '<button class="btn redline" onclick="doReview(\'return\')">退回</button><button class="btn" onclick="doReview(\'approve\')">' + ic("pen", 22) + "核准並簽名</button></div>");
 } else if (v.status === "待環安衛審核" && ehs) {
  bar('<div class="sfrb"><button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic("pdf", 20, 2.2) + '開啟 PDF</button><button class="btn redline" onclick="doEhs(\'return\')">退回</button><button class="btn" onclick="doEhs(\'approve\')">' + ic("check", 22, 2.8) + "核准歸檔</button></div>");
 } else if (v.status === "已歸檔" || v.status === "待環安衛審核") {
  bar('<button class="btn ghost" onclick="openPdf(' + jsq(v.monthId) + ')">' + ic("pdf", 20, 2.2) + "開啟 PDF</button>");
 } else bar(v.status === "填寫中" || v.status === "退回" ? '<button class="btn" disabled>本課還沒送審（' + esc(v.status) + "）</button>" : "");
}

function sfPeriodic() {
 var sf = S.sf, v = sf.v, forms = S.me.forms, h = "";
 if (!sf.review && !isEhs()) {
  var picks = (S.me.assigns || []).filter((function(a) {
   return a.dept === v.dept && a.pick && F(a.form);
  }));
  if (picks.length) h += '<div class="sec">我負責的定期檢查<small>每月、每年這類一次一張的表：點一下逐項填，附照片用電腦選檔案即可</small></div><div class="list sfplist">' + picks.map((function(a) {
   var f = F(a.form), ttl = f.name + (a.object ? "・" + a.object + (a.objectName ? " " + a.objectName : "") : "") + (a.kind ? "・" + a.kind : "");
   return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(ttl) + '</span><span class="mt">' + esc(dueMeta(a)) + "</span></span>" + duePill(a) + "</button>";
  })).join("") + "</div>";
 }
 var per = v.model.periodic || [];
 if (per.length) h += '<div class="sec">定期檢查（本月紀錄 ' + per.length + ' 份）</div><div class="sfper">' + per.map((function(x) {
  return sheetHtml(forms[x.form], x);
 })).join("") + "</div>"; else if (sf.review) h += '<div class="sec">定期檢查（本月）</div><div class="empty">這個月沒有定期檢查紀錄。</div>';
 return h;
}

function deskDaily(m) {
 if (isEhs()) return "";
 var t = today(), h = "", multi = m.depts.length > 1;
 m.depts.forEach((function(d) {
  var daily = m.assigns.filter((function(a) {
   return a.dept === d.id && a.daily && F(a.form);
  }));
  if (!daily.length) return;
  h += '<div class="card dkc"><div class="mr"><b>' + esc("每日檢點" + (multi ? "・" + d.id : "")) + "</b>" + (demoDept(d.id) ? "" : '<button class="btn ghost sm" onclick="S.sf=null;go(\'sheetFill\',{dept:' + jsq(d.id) + ",period:" + jsq(t.slice(0, 7)) + '})">' + ic("pen", 18, 2.4) + "用表格填寫整月</button>") + '</div><div class="list">' + daily.map((function(a) {
   var job = pendJob(a, t), f = F(a.form);
   var st = job ? pill("info", "up", "待上傳") : a.due.todayNoWork ? pill("na", "minus", "今日無作業") : a.due.todayDone ? pill("ok", "check", a.due.signer && a.due.signer !== m.person.name ? a.due.signer + " 已檢點" : "已檢點") : pill("warn", "pen", "今天未檢點");
   return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(f.name) + '</span><span class="mt">' + esc(f.items.length + " 項" + (a.object ? "・" + a.object : "")) + "</span></span>" + st + "</button>";
  })).join("") + "</div></div>";
 }));
 var due = m.assigns.filter((function(a) {
  return a.pick && a.due && (a.due.state === "overdue" || a.due.state === "soon") && F(a.form);
 }));
 if (due.length) h += '<div class="card dkc"><div class="mr"><b>' + esc("定期檢查快到期（" + due.length + "）") + '</b><button class="btn ghost sm" onclick="go(\'mine\')">我的表單</button></div><div class="list">' + due.slice(0, 8).map((function(a) {
  return '<button class="li" onclick="openFill(' + jsq(a.key) + ')"><span class="mn"><span class="nm">' + esc(pickName(a)) + '</span><span class="mt">' + esc(dueMeta(a)) + "</span></span>" + duePill(a) + "</button>";
 })).join("") + "</div></div>";
 return h;
}

function sfDeptChips() {
 var sf = S.sf;
 if (sf.review) return "";
 var ds = S.me.depts.filter((function(d) {
  return S.me.assigns.some((function(a) {
   return a.dept === d.id && a.daily;
  }));
 }));
 if (ds.length < 2) return "";
 return '<div class="chips">' + ds.map((function(d) {
  return '<button class="chip' + (d.id === sf.dept ? " on" : "") + '" aria-pressed="' + (d.id === sf.dept) + "\" onclick=\"S.sf=null;go('sheetFill',{dept:" + jsq(d.id) + ",period:" + jsq(sf.period) + '},true)">' + esc(d.id) + "</button>";
 })).join("") + "</div>";
}

function sfToday() {
 var sf = S.sf, it = sf.list[sf.fi], d = Number(today().slice(8)), nr = it.f.items.length;
 sf.sel = {
  r0: 0,
  c0: d,
  r1: nr - 1,
  c1: d
 };
 sfPaintSel();
 sfFill((function(r) {
  if (r === nr) return null;
  var rec = sfRec(it, d), s0 = it.f.items[r].seq, cur = rec && !rec.w ? rec.r[s0] : "";
  return cur && cur !== "" ? cur === "na" ? "na" : cur : sfOpts(it, r)[0].k;
 }));
 sfSide();
 toast("今天已填「" + esc(sfOpts(it, 0)[0].label) + "」，有異常的請個別改，再按存檔", "", 2600);
}

function sfTodayNoWork() {
 var sf = S.sf, it = sf.list[sf.fi], d = Number(today().slice(8)), nr = it.f.items.length;
 sf.sel = {
  r0: nr,
  c0: d,
  r1: nr,
  c1: d
 };
 sfPaintSel();
 sfFill((function(r) {
  return r === nr ? true : null;
 }));
 sfSide();
}

function tmxWant(tm) {
 if (!S.tmx || S.tmx.dept !== tm.dept || S.tmx.at !== tm) {
  S.tmx = {
   dept: tm.dept,
   at: tm,
   want: {}
  };
  tm.targets.forEach((function(x) {
   S.tmx.want[x.key] = x.now.slice();
  }));
 }
 return S.tmx.want;
}

function tmxDiff(tm) {
 var w = tmxWant(tm);
 return tm.targets.filter((function(x) {
  return w[x.key].slice().sort().join() !== x.now.slice().sort().join();
 })).map((function(x) {
  return {
   key: x.key,
   names: w[x.key].slice(),
   name: x.name
  };
 }));
}

function tmxHtml(tm) {
 var w = tmxWant(tm), ops = tm.people.filter((function(p) {
  return p.role === "檢點人員";
 }));
 var cols = tm.targets.filter((function(x) {
  return x.kind === "form";
 })).sort((function(a, b) {
  return (b.daily ? 1 : 0) - (a.daily ? 1 : 0);
 })).concat(tm.targets.filter((function(x) {
  return x.kind === "equip";
 })));
 if (!ops.length) return '<div class="empty">這一課還沒有檢點人員，人員新增請洽環安衛中心。</div>';
 var nf = cols.filter((function(x) {
  return x.kind === "form";
 })).length;
 var h = '<div class="muted upnote">每一列一位檢點人員、每一欄一張表或一台設備：勾選＝負責，同一項可以多人。改完按下方「今天起生效」或「下月起」一次存。人員、表單、設備的新增或停用請洽環安衛中心。</div>' + '<div class="tmx"><table><thead><tr><th class="t">檢點人員</th>' + (nf ? '<th class="grp" colspan="' + nf + '">表單</th>' : "") + (cols.length - nf ? '<th class="grp" colspan="' + (cols.length - nf) + '">設備</th>' : "") + '</tr><tr><th class="t"></th>' + cols.map((function(x) {
  return '<th class="c' + (x.daily ? " dly" : "") + '" title="' + esc(x.name) + '"><span>' + esc(x.name) + "</span>" + (x.daily ? "<small>每日</small>" : "") + "</th>";
 })).join("") + "</tr></thead><tbody>";
 ops.forEach((function(p) {
  var warn = !p.loggedIn || !p.signed;
  h += '<tr><td class="t"><b>' + esc(p.name) + '</b><small class="' + (warn ? "wn" : "") + '">' + esc((p.loggedIn ? "已登入" : "還沒登入") + "・" + (p.signed ? "已簽名" : "還沒簽名")) + "</small></td>";
  cols.forEach((function(x) {
   var on = w[x.key].indexOf(p.name) >= 0, was = x.now.indexOf(p.name) >= 0, nx = x.next && x.next.indexOf(p.name) >= 0 !== was;
   h += '<td class="' + (on !== was ? "chg" : "") + '"><label><input type="checkbox"' + (on ? " checked" : "") + ' aria-label="' + esc(p.name + "・" + x.name) + '" onchange="tmxTick(' + jsq(x.key) + "," + jsq(p.name) + ',this.checked)"></label>' + (nx ? '<i class="nx" title="' + esc(Number(tm.month.slice(5)) + " 月起" + (was ? "不負責" : "負責")) + '"></i>' : "") + "</td>";
  }));
  h += "</tr>";
 }));
 h += '<tr class="sum"><td class="t">負責人數</td>' + cols.map((function(x) {
  var n = w[x.key].length;
  return '<td class="' + (n ? "" : "none") + '">' + (n || "無") + "</td>";
 })).join("") + "</tr></tbody></table></div>";
 var none = cols.filter((function(x) {
  return !w[x.key].length;
 }));
 if (none.length) h += '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><b>' + esc(none.length + " 項沒有人負責") + '</b><div class="m">' + esc("沒有負責人＝本課不再使用（手機上看不到、不算缺漏）：" + none.map((function(x) {
  return x.name;
 })).join("、")) + "</div></div></div></div>";
 return h;
}

function tmxTick(key, name, on) {
 var tm = S.team, w = tmxWant(tm)[key];
 if (on && w.indexOf(name) < 0) w.push(name);
 if (!on) tmxWant(tm)[key] = w.filter((function(n) {
  return n !== name;
 }));
 var y = window.scrollY, g = document.querySelector(".tmx"), sx = g ? g.scrollLeft : 0;
 render();
 window.scrollTo(0, y);
 g = document.querySelector(".tmx");
 if (g) g.scrollLeft = sx;
}

function tmxBar(tm) {
 var n = tmxDiff(tm).length, mo = Number(tm.month.slice(5)) + " 月";
 bar('<div class="btns r21"><button class="btn"' + (n ? "" : " disabled") + " onclick=\"tmxSave('now')\">" + ic("check", 22, 2.8) + (n ? "今天起生效（" + n + " 項）" : "沒有變更") + "</button>" + '<button class="btn ghost"' + (n ? "" : " disabled") + " onclick=\"tmxSave('next')\">下月起（" + esc(mo) + "）</button></div>" + (n ? '<button class="btn ghost sm" onclick="S.tmx=null;render()">還原</button>' : ""));
}

function tmxSave(when) {
 var tm = S.team, ch = tmxDiff(tm);
 if (!ch.length) return;
 if (!navigator.onLine) return toast("沒有網路，調整要連上網路才能存", "err", 3500);
 var empty = ch.filter((function(c) {
  return !c.names.length;
 }));
 if (empty.length && !confirm(sfT("沒有勾任何人＝本課不再使用：") + empty.map((function(c) {
  return c.name;
 })).join("、") + "\n" + sfT("確定嗎？"))) return;
 busyOn("儲存中…", "共 " + ch.length + " 項");
 var i = 0, step = function() {
  if (i >= ch.length) {
   rcClear();
   return api("team", {
    deptId: tm.dept
   }).then((function(r) {
    S.team = r;
    S.teamAt = Date.now();
   }));
  }
  var c = ch[i++];
  return api(when === "now" ? "assignNow" : "nextSet", {
   deptId: tm.dept,
   target: c.key,
   names: c.names
  }).then(step);
 };
 step().then((function() {
  busyOff();
  S.tmx = null;
  toast(when === "now" ? "已改好 " + ch.length + " 項，今天起生效" : "已安排 " + ch.length + " 項，" + Number(tm.month.slice(5)) + " 月 1 日生效", "ok", 3500);
  if (when === "now") refreshMe();
  render();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message) + (i > 1 ? "（前 " + (i - 1) + " 項已存）" : ""), "err", 5e3);
  S.tmx = null;
  teamLoad(tm.dept).then((function() {
   render();
  }));
 }));
}

function revRole(v) {
 if (v.overview) return "";
 return v.status === "待主管審核" && mgrOf(v.dept) && !isEhs() ? "mgr" : v.status === "待環安衛審核" && isEhs() ? "ehs" : "";
}

function revHead(v, rev, pa) {
 var st = [ "送審", "單位負責人審核", "環安衛審核", v.who ? "全課到齊後歸檔" : "歸檔" ], cur = rev === "mgr" ? 1 : rev === "ehs" ? 2 : -1;
 var steps = '<div class="muted" style="margin:6px 0">' + st.map((function(t, i) {
  return i < cur ? t + " ✓" : i === cur ? '<b style="color:var(--info)">' + t + "（目前）</b>" : t;
 })).join(" → ") + "</div>";
 if (pa) return '<div class="card"><div class="fh"><b>' + esc(v.dept + "・" + ymLabel(v.period)) + "</b></div>" + steps + '<div class="box info"><div class="r"><span class="spin"></span><div class="bt"><b>上次按的「' + esc(pa.label) + '」正在確認結果</b><div class="m">Google 回應比較慢，系統會自動確認，<b>不用再按一次</b>。</div></div></div></div></div>';
 return '<div class="card" style="border:2px solid var(--info)"><div class="fh">' + ic("review", 22, 2.4) + "<b>審核中：" + esc((v.who ? v.who + "・" : "") + v.dept + "・" + ymLabel(v.period)) + "</b></div>" + steps + '<div class="muted">' + (rev === "mgr" ? "您是單位負責人。" : "您是環安衛。") + "看完下面的紀錄（異常日期會標紅），在最下面按<b>核准</b>或<b>退回</b>；還沒決定可以按<b>離開</b>，下次再審。</div></div>";
}

function revLeave() {
 S.revMode = "";
 S.cm = "";
 if (S.stack.length) back(); else go("home", {}, true);
}

var ACT_LS = "chk.act";

function actPending(mid) {
 if (!mid) return null;
 var a = lsGet(ACT_LS, {}) || {}, x = a[mid];
 if (x && Date.now() - x.at > 15 * 6e4) {
  delete a[mid];
  lsSet(ACT_LS, a);
  return null;
 }
 return x || null;
}

function actMark(mid, x) {
 var a = lsGet(ACT_LS, {}) || {};
 if (x) a[mid] = x; else delete a[mid];
 lsSet(ACT_LS, a);
}

function actSafe(v, action, body, label, okStates) {
 var mid = v.monthId || v.dept + "|" + v.period;
 actMark(mid, {
  label,
  ok: okStates,
  at: Date.now(),
  dept: v.dept,
  period: v.period
 });
 return api(action, body).then((function(r) {
  actMark(mid, null);
  return r;
 }), (function(e) {
  if (e.biz) {
   actMark(mid, null);
   throw e;
  }
  return actCheck(v, okStates, 4).then((function(done) {
   if (done) {
    actMark(mid, null);
    toast("已確認：" + label + "已完成", "ok", 3500);
    return null;
   }
   var err = new Error("Google 回應比較慢，系統還在確認「" + label + "」的結果。不用再按一次——稍後回到這個月份，會自動顯示結果。");
   err.biz = true;
   err.slow = true;
   throw err;
  }));
 }));
}

function actCheck(v, okStates, n) {
 return new Promise((function(res) {
  setTimeout(res, 4e3);
 })).then((function() {
  return api("monthView", v.who ? {
   deptId: v.dept,
   period: v.period,
   who: v.who
  } : {
   deptId: v.dept,
   period: v.period
  }, {
   quiet: true,
   noRetry: true
  });
 })).then((function(m) {
  return okStates.indexOf(m.status) >= 0;
 }), (function() {
  return false;
 })).then((function(ok) {
  return ok || n <= 1 ? ok : actCheck(v, okStates, n - 1);
 }));
}

function actWatch(v, pa) {
 if (S.actW) return;
 S.actW = true;
 actCheck(v, pa.ok, 6).then((function(ok) {
  S.actW = false;
  if (S.page !== "month" || !S.view || S.view.monthId !== v.monthId) return;
  if (ok) {
   actMark(v.monthId, null);
   toast("已確認：" + pa.label + "已完成", "ok", 3500);
   rcClear();
   S.view = null;
   render();
  } else {
   actMark(v.monthId, null);
   toast("還沒看到「" + pa.label + "」的結果，請確認畫面上的狀態再決定要不要重新操作", "", 6e3);
   rcClear();
   render();
  }
 }));
}

function crewCard(v) {
 var cr = (v.crew || []).filter((function(c) {
  return c.days || c.monthId;
 }));
 var ok = function(c) {
  return c.status === "環安衛已核准";
 };
 var miss = cr.filter((function(c) {
  return !ok(c);
 }));
 var h = '<div class="card"><div class="fh">' + ic("team", 22, 2.2) + "<b>每人送審（全員核准後整課歸檔、產生 PDF）</b></div>" + (cr.length ? miss.length ? '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt">' + function() {
  var ns = miss.filter((function(c) {
   return c.status === "尚未送審" || c.status === "退回";
  })), ip = miss.filter((function(c) {
   return c.status !== "尚未送審" && c.status !== "退回";
  }));
  return (ns.length ? "<b>尚未送審 " + ns.length + " 人：" + esc(ns.map((function(c) {
   return c.name + (c.status === "退回" ? "（退回修正中）" : "");
  })).join("、")) + "</b>" : "") + (ip.length ? '<div class="m">審核中 ' + ip.length + " 人：" + esc(ip.map((function(c) {
   return c.name + "（" + c.status + "）";
  })).join("、")) + "</div>" : "");
 }() + "</div></div></div>" : '<div class="box ok"><div class="r">' + ic("check", 22) + '<div class="bt"><b>全員已核准</b></div></div></div>' : '<div class="muted">這個月還沒有人填寫。</div>') + '<div class="list">' + cr.map((function(c) {
  var pillK = ok(c) ? "ok" : c.status === "退回" ? "ng" : c.status === "尚未送審" ? "na" : "warn";
  return '<button class="li" onclick="go(\'month\',{dept:' + jsq(v.dept) + ",period:" + jsq(v.period) + ",who:" + jsq(c.name) + '})"><span class="mn"><span class="nm">' + esc(c.name) + "</span>" + '<span class="mt">填寫 ' + c.days + " 天" + (c.n ? "・送出 " + c.n + " 份" : "") + "</span></span>" + pill(pillK, "", c.status) + "</button>";
 })).join("") + "</div></div>";
 return h;
}

function expTabs() {
 var t = S.expTab || "who";
 return '<div class="seg2" role="tablist"><button role="tab" aria-selected="' + (t === "who") + '" class="' + (t === "who" ? "on" : "") + '" onclick="S.expTab=\'who\';ewRender()">依人員匯出／補發</button>' + '<button role="tab" aria-selected="' + (t === "dept") + '" class="' + (t === "dept" ? "on" : "") + '" onclick="S.expTab=\'dept\';expRender()">依部門、月份、表單</button></div>';
}

function ewState() {
 if (!S.ew) S.ew = {
  dept: "",
  period: ymAdd(today().slice(0, 7), -1),
  data: null,
  pick: [],
  mode: "person",
  out: {
   download: false,
   drive: true,
   nas: true
  },
  mail: {
   me: true,
   mgr: false,
   op: false
  },
  unsigned: false,
  res: null
 };
 return S.ew;
}

function ewRender() {
 var o = S.expOpt, w = ewState(), h = expTabs();
 var step = function(n, title, on) {
  return '<div class="sec"' + (on ? "" : ' style="opacity:.45"') + '><span class="sl">' + n + "　" + title + "</span></div>";
 };
 h += step("①", "選部門和月份", true) + '<div class="card"><label class="nl" for="ewD">部門（課）</label><select id="ewD" class="field" onchange="S.ew.dept=this.value;ewLoad()"><option value="">請選擇</option>' + o.depts.map((function(d) {
  return "<option" + (d.dept === w.dept ? " selected" : "") + ">" + esc(d.dept) + "</option>";
 })).join("") + "</select>" + '<label class="nl" for="ewP">月份</label><input id="ewP" type="month" class="field" value="' + esc(w.period) + '" onchange="S.ew.period=this.value;ewLoad()"></div>';
 if (w.dept && !w.data) h += loading("讀取每個人的審核狀態…");
 if (!w.data) {
  h += step("②", "勾選要匯出的人", false) + step("③", "選檔案放哪裡", false) + step("④", "寄信（可不選）", false);
  $("app").innerHTML = h;
  bar("");
  if (w.dept && !w.loading) ewLoad();
  return;
 }
 var ppl = w.data.people, okN = ppl.filter((function(x) {
  return x.ok;
 })).length;
 var notOk = ppl.filter((function(x) {
  return !x.ok && w.pick.indexOf(x.name) >= 0;
 }));
 h += step("②", "勾選要匯出的人", true) + '<div class="card">' + (ppl.length ? '<div class="muted sm" style="margin-bottom:6px">已核准的 ' + okN + " 人已勾好。</div>" + ppl.map((function(x) {
  return '<label class="ck"><input type="checkbox" ' + (w.pick.indexOf(x.name) >= 0 ? "checked " : "") + 'onchange="ewPick(' + jsq(x.name) + ',this.checked)"><span>' + esc(x.name) + '<small class="muted" style="display:block;font-weight:400">' + (x.ok ? "已核准" : esc(x.mgrOk ? "主管已核准，環安衛還沒核准" : x.status) + "・PDF 沒有主管簽名") + (x.n ? "・" + x.n + " 份" : "") + "</small></span></label>";
 })).join("") : '<div class="empty">這個月沒有人填寫</div>') + (notOk.length ? '<div class="box warn" style="margin-top:8px"><div class="r">' + ic("warn", 20) + '<div class="bt"><b>' + esc(notOk.map((function(x) {
  return x.name;
 })).join("、")) + ' 還沒核准</b><div class="m">他們的 PDF 主管簽名欄是空白，檔名會加「(未簽核)」。</div></div></div></div>' : "") + (w.pick.length > 1 ? '<div style="margin-top:8px">' + [ "person", "merged" ].map((function(v) {
  return '<label class="ck"><input type="radio" name="ewM" ' + (w.mode === v ? "checked" : "") + ' onchange="S.ew.mode=' + jsq(v) + ';ewRender()"><span>' + (v === "person" ? "每人一個檔" : "合成一個檔") + "</span></label>";
 })).join("") + "</div>" : "") + "</div>";
 var go3 = w.pick.length > 0;
 var cb = function(grp, k, label, sub, dis) {
  return '<label class="ck' + (dis ? " off" : "") + '"><input type="checkbox" ' + (w[grp][k] && !dis ? "checked " : "") + (dis ? "disabled " : "") + 'onchange="S.ew.' + grp + "." + k + '=this.checked;ewRender()"><span>' + label + (sub ? '<small class="muted" style="display:block;font-weight:400">' + sub + "</small>" : "") + "</span></label>";
 };
 h += step("③", "選檔案放哪裡", go3);
 if (go3) h += '<div class="card">' + cb("out", "nas", "存到 NAS", "檢點紀錄資料夾／部門／年／月；同名檔案會被新的取代") + cb("out", "drive", "存到 Google 雲端硬碟", "系統 PDF 資料夾；同名檔案會被新的取代") + cb("out", "download", "下載到這台手機／電腦", "") + "</div>";
 h += step("④", "寄信（可不選）", go3);
 if (go3) {
  var mg = (w.data.mgrs || []).map((function(m) {
   return m.name + (m.email ? "" : "（沒有 Email，寄不到）");
  })).join("、") || "這課沒有設定單位負責人";
  h += '<div class="card">' + cb("mail", "me", "寄給我（" + esc(w.data.me.name) + "）", w.data.me.email ? "" : "人員名單沒有您的 Email，寄不到") + cb("mail", "mgr", "寄給單位負責人", esc(mg)) + cb("mail", "op", "寄給檢點人員本人", w.mode === "merged" && w.pick.length > 1 ? "合成一個檔時不能寄給個人" : "每人只收到自己的", w.mode === "merged" && w.pick.length > 1) + "</div>";
 }
 if (w.res) h += '<div class="sec">這次的結果</div><div class="card">' + w.res.map((function(r) {
  return '<div class="sml"><b>' + esc(r.name) + "</b>" + (r.lines || []).map((function(l) {
   return '<div class="muted">' + esc(l) + "</div>";
  })).join("") + "</div>";
 })).join("") + "</div>";
 $("app").innerHTML = h;
 bar(go3 ? '<button class="btn" onclick="ewRun()">' + ic("pdf", 22, 2.8) + esc(ewSummary()) + "</button>" : "");
}

function ewSummary() {
 var w = S.ew, n = w.mode === "merged" && w.pick.length > 1 ? 1 : w.pick.length, to = [], ml = [];
 if (w.out.nas) to.push("存 NAS");
 if (w.out.drive) to.push("存雲端硬碟");
 if (w.out.download) to.push("下載");
 if (w.mail.me) ml.push("我");
 if (w.mail.mgr) ml.push("主管");
 if (w.mail.op && !(w.mode === "merged" && w.pick.length > 1)) ml.push("本人");
 if (ml.length) to.push("寄給" + ml.join("、"));
 return "產生 " + n + " 份 PDF" + (to.length ? "，" + to.join("、") : "（請在 ③④ 選存哪或寄誰）");
}

function ewLoad() {
 var w = ewState();
 w.data = null;
 w.pick = [];
 w.res = null;
 if (!w.dept || !/^\d{4}-\d{2}$/.test(w.period)) return ewRender();
 w.loading = true;
 ewRender();
 api("exportPeople", {
  dept: w.dept,
  period: w.period
 }).then((function(d) {
  w.loading = false;
  if (S.page !== "exportData" || S.ew !== w || d.dept !== w.dept || d.period !== w.period) return;
  w.data = d;
  w.pick = d.people.filter((function(x) {
   return x.ok;
  })).map((function(x) {
   return x.name;
  }));
  ewRender();
 })).catch((function(e) {
  w.loading = false;
  toast(esc(e.message), "err", 4e3);
 }));
}

function ewPick(n, on) {
 var w = S.ew, y = window.scrollY;
 w.pick = w.pick.filter((function(x) {
  return x !== n;
 }));
 if (on) w.pick.push(n);
 ewRender();
 window.scrollTo(0, y);
}

function ewPickOk() {
 var w = S.ew;
 w.pick = w.data.people.filter((function(x) {
  return x.ok;
 })).map((function(x) {
  return x.name;
 }));
 ewRender();
}

function ewRun() {
 var w = S.ew;
 if (!w.pick.length) return toast("請在 ② 勾選要匯出的人", "err");
 w.unsigned = w.data.people.some((function(x) {
  return !x.ok && w.pick.indexOf(x.name) >= 0;
 }));
 var mail = {
  me: w.mail.me,
  mgr: w.mail.mgr,
  op: w.mail.op && w.mode === "person"
 };
 if (!w.out.download && !w.out.drive && !w.out.nas && !mail.me && !mail.mgr && !mail.op) return toast("請在 ③ 或 ④ 至少選一個：存 NAS、存雲端硬碟、下載或寄信", "err");
 var jobs = w.mode === "merged" ? [ w.pick.slice() ] : w.pick.map((function(n) {
  return [ n ];
 }));
 var files = [], res = [], i = 0;
 busyOn("匯出中…", "共 " + jobs.length + " 份，一份約 10～40 秒");
 var step = function() {
  if (i >= jobs.length) return Promise.resolve();
  var who = jobs[i++], t = $("busy") && $("busy").querySelector("b");
  if (t) t.textContent = "匯出中…（" + i + "/" + jobs.length + "）" + who.join("、");
  return api("exportRun", {
   dept: w.dept,
   period: w.period,
   who,
   out: w.out,
   mail,
   unsigned: w.unsigned
  }).then((function(r) {
   if (r.empty) res.push({
    name: who.join("、"),
    lines: [ "沒有可匯出的資料" + (r.skip && r.skip.length ? "：" + r.skip.join("、") : "") ]
   }); else {
    if (r.base64) files.push({
     name: r.name,
     bytes: b64bytes(r.base64)
    });
    res.push({
     name: r.name,
     lines: (r.done || []).concat(r.base64 ? [ "已下載" ] : []).concat(r.skip && r.skip.length ? [ "略過（還沒核准）：" + r.skip.join("、") ] : [])
    });
   }
   return step();
  }), (function(e) {
   res.push({
    name: who.join("、"),
    lines: [ "沒有成功：" + e.message ]
   });
   return step();
  }));
 };
 step().then((function() {
  busyOff();
  if (files.length) saveFile(files.length === 1 ? new Blob([ files[0].bytes ], {
   type: "application/pdf"
  }) : mkZip(files), files.length === 1 ? files[0].name : "作業檢點紀錄_" + w.dept + "_" + w.period + ".zip");
  w.res = res;
  ewRender();
  window.scrollTo(0, document.body.scrollHeight);
  toast("匯出完成（" + res.length + " 份），結果在最下面", "ok", 4e3);
 }));
}

var TEQ_POWER_CATS = [ "堆高機", "升降機" ];

function teqGroups(tm) {
 var g = {}, order = [];
 tm.targets.filter((function(x) {
  return x.kind === "equip";
 })).forEach((function(x) {
  var a = x.key.split(":"), k = a[1] + ":" + a.slice(2).join(":");
  if (!g[k]) {
   g[k] = {
    cat: a[1],
    obj: a.slice(2).join(":"),
    loc: x.loc || "",
    power: x.power || "",
    e: null,
    q: null
   };
   order.push(k);
  }
  if (x.key.charAt(0) === "Q") g[k].q = x; else {
   g[k].e = x;
   g[k].loc = x.loc || g[k].loc;
   g[k].power = x.power || "";
  }
 }));
 return order.map((function(k) {
  return g[k];
 }));
}

function teqWho(a) {
 return a && a.length ? a.join("、") : "沒有人";
}

function teqForms(gp) {
 var out = [];
 if (gp.e && gp.e.dailyForm) out.push({
  name: gp.e.dailyForm.name,
  freq: "每日"
 });
 (gp.q ? gp.q.periodic : gp.e ? gp.e.periodic : []).forEach((function(y) {
  out.push(y);
 }));
 return out;
}

function teqListHtml(tm) {
 var gs = teqGroups(tm), desk = isDesk(), ehs = isEhs(), h = "";
 h += '<div class="muted upnote">' + (desk ? "把左邊的同仁拖到設備卡上，就交給他負責；" : "") + "點一台設備可以換負責人、每日和定期分給不同人、或多人一起負責。" + (ehs ? "" : "新增或停用設備請洽環安衛中心。") + "</div>";
 if (ehs) h += '<button class="btn ghost" onclick="go(\'eqNew\',{dept:' + jsq(tm.dept) + '})">' + ic("plus", 18, 2.4) + "新增設備</button>";
 var cats = [];
 gs.forEach((function(x) {
  if (cats.indexOf(x.cat) < 0) cats.push(x.cat);
 }));
 var body = cats.map((function(c) {
  var list = gs.filter((function(x) {
   return x.cat === c;
  }));
  return '<div class="sec">' + esc(c) + "<small>" + list.length + ' 台</small></div><div class="teqs">' + list.map((function(x) {
   var none = !(x.e && x.e.now.length) || x.q && !x.q.now.length;
   var rows = x.q ? '<div class="teqr" data-drop="E"><span>每日</span><b>' + esc(teqWho(x.e && x.e.now)) + '</b></div><div class="teqr" data-drop="Q"><span>定期</span><b>' + esc(teqWho(x.q.now)) + "</b></div>" : '<div class="teqr" data-drop="E"><span>負責</span><b>' + esc(teqWho(x.e && x.e.now)) + "</b></div>";
   var fs = teqForms(x).map((function(y) {
    return y.freq;
   })).filter((function(v, i, a) {
    return v && a.indexOf(v) === i;
   })).join("・");
   return '<button class="teq' + (none ? " none" : "") + '" data-cat="' + esc(x.cat) + '" data-obj="' + esc(x.obj) + "\" onclick=\"go('teamEq',{dept:" + jsq(tm.dept) + ",cat:" + jsq(x.cat) + ",obj:" + jsq(x.obj) + '})">' + '<span class="teqh"><b data-raw>' + esc(x.obj) + "</b>" + (x.power === "電動" ? pill("info", "", "電動") : "") + "</span>" + (x.loc ? '<span class="mt" data-raw>' + esc(x.loc) + "</span>" : "") + rows + (fs ? '<span class="mt">' + esc(fs) + "</span>" : "") + "</button>";
  })).join("") + "</div>";
 })).join("") || '<div class="empty">本課沒有設備</div>';
 if (ehs && tm.ehs && tm.ehs.off.length) body += '<details class="edoth"><summary>停用中的設備（' + tm.ehs.off.length + '）</summary><div class="list">' + tm.ehs.off.map((function(x) {
  return '<div class="li"><span class="mn"><span class="nm" data-raw>' + esc(x.cat + " " + x.obj) + "</span>" + (x.loc ? '<span class="mt" data-raw>' + esc(x.loc) + "</span>" : "") + "</span>" + '<button class="btn sm ghost" onclick="teqSaveInfo(' + jsq(x.cat) + "," + jsq(x.obj) + ',{on:true})">恢復使用</button></div>';
 })).join("") + "</div></details>";
 if (!desk) return h + body;
 var ops = tm.people.filter((function(p) {
  return p.role === "檢點人員";
 }));
 return h + '<div class="teqdesk"><div class="teqppl"><div class="sec">本課同仁<small>拖到右邊設備上</small></div>' + ops.map((function(p) {
  return '<div class="chip teqp" draggable="true" data-name="' + esc(p.name) + '">' + esc(p.name) + "<small>" + (p.equips.length + p.forms.length) + "</small></div>";
 })).join("") + '</div><div class="teqmain">' + body + "</div></div>";
}

function teqDragInit(tm) {
 if (!isDesk()) return;
 var who = "";
 document.querySelectorAll(".teqp").forEach((function(el) {
  el.addEventListener("dragstart", (function(e) {
   who = el.getAttribute("data-name");
   e.dataTransfer.setData("text/plain", who);
   e.dataTransfer.effectAllowed = "copy";
  }));
 }));
 document.querySelectorAll(".teq").forEach((function(card) {
  card.addEventListener("dragover", (function(e) {
   e.preventDefault();
   card.classList.add("drop");
  }));
  card.addEventListener("dragleave", (function() {
   card.classList.remove("drop");
  }));
  card.addEventListener("drop", (function(e) {
   e.preventDefault();
   card.classList.remove("drop");
   var n = e.dataTransfer.getData("text/plain") || who, cat = card.getAttribute("data-cat"), obj = card.getAttribute("data-obj");
   var row = e.target.closest && e.target.closest("[data-drop]"), part = row ? row.getAttribute("data-drop") : "E";
   var gp = teqGroups(S.team).filter((function(x) {
    return x.cat === cat && x.obj === obj;
   }))[0];
   if (!gp || !n) return;
   var tg = part === "Q" && gp.q ? gp.q : gp.e, label = cat + " " + obj + (gp.q ? part === "Q" ? "・定期檢查" : "・每日檢點" : "");
   if (tg.now.indexOf(n) >= 0 && tg.now.length === 1) return toast(n + " 已經負責「" + label + "」", "ok", 2500);
   var keys = [ tg.key ];
   dlg("<b>" + esc(label) + "</b><p>目前：" + esc(teqWho(tg.now)) + "</p>", [ [ "改由 " + n + " 負責", function() {
    teqBatch(keys.map((function(k) {
     return {
      target: k,
      names: [ n ]
     };
    })), "now");
   }, "" ], tg.now.indexOf(n) < 0 && tg.now.length ? [ "加 " + n + " 一起負責", function() {
    teqBatch([ {
     target: tg.key,
     names: tg.now.concat([ n ])
    } ], "now");
   }, "ghost" ] : null ].filter(Boolean));
  }));
 }));
}

function teqDone(r, msg) {
 S.team = r;
 S.teamAt = Date.now();
 S.teamAll = null;
 busyOff();
 toast(msg, "ok", 3500);
 refreshMe();
 render();
}

function teqBatch(changes, when) {
 var tm = S.team;
 if (!changes.length) return;
 if (!navigator.onLine) return toast("沒有網路，調整要連上網路才能存", "err", 3500);
 busyOn("儲存中…");
 api("assignBatch", {
  deptId: tm.dept,
  changes,
  when
 }).then((function(r) {
  teqDone(r, when === "next" ? "已安排，" + Number(tm.month.slice(5)) + " 月 1 日生效" : "已改好，今天起生效；相關人員會收到通知");
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
 }));
}

PAGES.teamEq = function() {
 var tm = S.team;
 if (!tm) return back();
 var gp = teqGroups(tm).filter((function(x) {
  return x.cat === S.arg.cat && x.obj === S.arg.obj;
 }))[0];
 if (!gp) {
  if (!S.arg.off) toast("這台設備已停用或改了編號", "err");
  return back();
 }
 setTitle(gp.cat + " " + gp.obj);
 var ops = tm.people.filter((function(p) {
  return p.role === "檢點人員";
 })).map((function(p) {
  return p.name;
 }));
 var st = S.arg.st || (S.arg.st = {
  split: !!gp.q,
  d: (gp.e ? gp.e.now : []).slice(),
  q: (gp.q ? gp.q.now : gp.e ? gp.e.now : []).slice(),
  loc: gp.loc,
  power: gp.power,
  cat: gp.cat
 });
 var forms = teqForms(gp), hasDaily = forms.some((function(y) {
  return y.freq === "每日";
 })), hasPer = forms.some((function(y) {
  return y.freq !== "每日";
 }));
 var chips = function(part) {
  var w = st[part];
  return '<div class="chips wrap">' + ops.map((function(n) {
   return '<button class="chip' + (w.indexOf(n) >= 0 ? " on" : "") + '" onclick="teqPick(' + jsq(part) + "," + jsq(n) + ')">' + (w.indexOf(n) >= 0 ? ic("check", 16, 3) : "") + esc(n) + "</button>";
  })).join("") + "</div>" + (ops.length ? "" : '<div class="muted">本課還沒有檢點人員</div>');
 };
 var h = '<div class="card"><div class="mr"><b data-raw>' + esc(gp.cat + " " + gp.obj) + "</b>" + (gp.power === "電動" ? pill("info", "", "電動") : "") + "</div>" + (gp.loc ? '<div class="muted" data-raw>' + esc(gp.loc) + "</div>" : "") + '<div class="sec sm">要做的檢查</div>' + (forms.length ? forms.map((function(y) {
  return '<div class="muted">' + esc(y.name) + "・" + esc(y.freq) + (y.state ? " " + perPill(y) : "") + "</div>";
 })).join("") : '<div class="muted">本課沒有開這類設備的表</div>') + "</div>";
 if (st.split) {
  h += '<div class="sec">每日檢點<small>點名字選，可以多人</small></div>' + chips("d");
  h += '<div class="sec">定期檢查（每月、每年…）<small>點名字選，可以多人</small></div>' + chips("q");
 } else h += '<div class="sec">負責人<small>每日和定期全部；點名字選，可以多人</small></div>' + chips("d");
 if (hasDaily && hasPer) h += '<label class="ck"><input type="checkbox"' + (st.split ? " checked" : "") + ' onchange="teqSplitTick(this.checked)"><span>每日和定期分給不同人<small class="muted">　例：機械手臂每日給操作員、每月給保養的人</small></span></label>';
 var empty = !st.d.length || st.split && !st.q.length;
 if (empty) h += '<div class="box warn"><div class="r">' + ic("warn", 22) + '<div class="bt"><div class="m">' + (st.split && !st.q.length ? "定期檢查至少要一位負責人。" : "沒有負責人＝這台設備本課不再使用（手機上看不到、不算缺漏）。") + "</div></div></div></div>";
 h += '<div class="muted upnote">多人一起負責：任何一位填了就算完成。「今天起」馬上換人；「下月起」這個月照舊，下個月 1 日自動換。當事人都會收到 App 通知。</div>';
 var ehs = isEhs(), cats = ehs && tm.ehs ? tm.ehs.cats : [];
 h += '<div class="sec">設備資料</div><div class="card"><label class="nl" for="teqLoc">名稱或位置（車號、廠牌也寫這裡）</label><input id="teqLoc" class="field" value="' + esc(st.loc) + '" oninput="S.arg.st.loc=this.value">';
 if (ehs) {
  h += '<label class="nl" for="teqCat">設備類別（決定要做哪些檢查）</label><select id="teqCat" class="field" onchange="S.arg.st.cat=this.value">' + cats.map((function(c) {
   return "<option" + (c === st.cat ? " selected" : "") + ">" + esc(c) + "</option>";
  })).join("") + "</select>";
  if (TEQ_POWER_CATS.indexOf(st.cat) >= 0) h += '<label class="nl">動力</label><div class="seg">' + [ [ "", "引擎式" ], [ "電動", "電動" ] ].map((function(o) {
   return '<button class="' + (st.power === o[0] ? "on" : "") + '" onclick="S.arg.st.power=' + jsq(o[0]) + ';render()">' + o[1] + "</button>";
  })).join("") + "</div>";
 }
 h += '<div class="btns"><button class="btn ghost" onclick="teqInfoSave()">儲存設備資料</button>' + (ehs ? '<button class="btn ghost" onclick="teqOff()">停用這台設備</button>' : "") + "</div>" + (ehs ? "" : '<div class="muted sm2">改設備類別、電動或引擎式、停用設備，請洽環安衛中心。</div>') + "</div>";
 $("app").innerHTML = h;
 var chg = teqChanged(gp, st), splitChg = st.split !== !!gp.q, mo = Number(tm.month.slice(5)) + " 月";
 bar('<div class="btns r21"><button class="btn"' + (chg ? "" : " disabled") + " onclick=\"teqSave('now')\">" + ic("check", 22, 2.8) + (chg ? "今天起生效" : "沒有變更") + "</button>" + '<button class="btn ghost"' + (chg && !splitChg ? "" : " disabled") + " onclick=\"teqSave('next')\">下月起（" + esc(mo) + "）</button></div>");
};

function teqPick(part, n) {
 var w = S.arg.st[part], i = w.indexOf(n);
 if (i >= 0) w.splice(i, 1); else w.push(n);
 render();
}

function teqSplitTick(on) {
 var st = S.arg.st;
 st.split = on;
 if (on && !st.q.length) st.q = st.d.slice();
 render();
}

function teqSame(a, b) {
 return (a || []).slice().sort().join() === (b || []).slice().sort().join();
}

function teqChanged(gp, st) {
 if (st.split !== !!gp.q) return true;
 if (!teqSame(st.d, gp.e ? gp.e.now : [])) return true;
 return st.split && !teqSame(st.q, gp.q ? gp.q.now : []);
}

function teqSave(when) {
 var tm = S.team, st = S.arg.st, gp = teqGroups(tm).filter((function(x) {
  return x.cat === S.arg.cat && x.obj === S.arg.obj;
 }))[0];
 if (!gp) return;
 if (!navigator.onLine) return toast("沒有網路，調整要連上網路才能存", "err", 3500);
 if (st.split && !st.q.length) return toast("定期檢查至少要一位負責人", "err", 3500);
 if (!st.d.length && !confirm("沒有負責人＝這台設備本課不再使用。確定嗎？")) return;
 var done = function(r) {
  S.arg.st = null;
  teqDone(r, when === "next" ? "已安排，" + Number(tm.month.slice(5)) + " 月 1 日生效" : "已改好，今天起生效；相關人員會收到通知");
  back();
 };
 var fail = function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
 };
 busyOn("儲存中…");
 if (st.split !== !!gp.q) return api("eqSplit", {
  deptId: tm.dept,
  cat: gp.cat,
  obj: gp.obj,
  names: st.split ? st.q : [],
  daily: st.d
 }).then(done).catch(fail);
 var ch = [];
 if (!teqSame(st.d, gp.e ? gp.e.now : [])) ch.push({
  target: gp.e.key,
  names: st.d
 });
 if (st.split && gp.q && !teqSame(st.q, gp.q.now)) ch.push({
  target: gp.q.key,
  names: st.q
 });
 api("assignBatch", {
  deptId: tm.dept,
  changes: ch,
  when
 }).then(done).catch(fail);
}

function teqSaveInfo(cat, obj, v) {
 var tm = S.team;
 busyOn("儲存中…");
 return api("eqSave", Object.assign({
  deptId: tm.dept,
  cat,
  obj
 }, v)).then((function(r) {
  teqDone(r, "設備資料已更新");
  return r;
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
  throw e;
 }));
}

function teqInfoSave() {
 var st = S.arg.st, v = {
  name: st.loc
 };
 if (isEhs()) {
  v.power = st.power;
  if (st.cat !== S.arg.cat) v.newCat = st.cat;
 }
 teqSaveInfo(S.arg.cat, S.arg.obj, v).then((function() {
  if (v.newCat) {
   S.arg.cat = v.newCat;
  }
  S.arg.st = null;
  render();
 })).catch((function() {}));
}

function teqOff() {
 if (!confirm("停用「" + S.arg.cat + " " + S.arg.obj + "」？（報廢、移走用；之前的紀錄保留，可以再恢復）")) return;
 S.arg.off = true;
 teqSaveInfo(S.arg.cat, S.arg.obj, {
  on: false
 }).then((function() {
  if (S.page === "teamEq") back();
 })).catch((function() {}));
}

PAGES.eqNew = function() {
 var tm = S.team;
 if (!tm || !tm.ehs) return back();
 setTitle("新增設備");
 var n = S.arg.n || (S.arg.n = {
  cat: tm.ehs.cats[0] || "",
  obj: "",
  loc: "",
  power: "",
  owner: ""
 });
 var ops = tm.people.filter((function(p) {
  return p.role === "檢點人員";
 })).map((function(p) {
  return p.name;
 }));
 var h = '<div class="muted upnote">新增到「' + esc(tm.dept) + '」。設備類別決定要做哪些檢查；這一課有開的表才會出現在負責人的手機上（到「表單」分頁的「本課要用的表」設定）。</div><div class="card">' + '<label class="nl" for="enCat">設備類別</label><select id="enCat" class="field" onchange="S.arg.n.cat=this.value;render()">' + tm.ehs.cats.map((function(c) {
  return "<option" + (c === n.cat ? " selected" : "") + ">" + esc(c) + "</option>";
 })).join("") + "</select>" + '<label class="nl" for="enNo">設備編號</label><input id="enNo" class="field" placeholder="例：3號、M-070" value="' + esc(n.obj) + '" oninput="S.arg.n.obj=this.value">' + '<label class="nl" for="enLoc">名稱或位置（選填）</label><input id="enLoc" class="field" placeholder="例：倉庫、TOYOTA 8FB25" value="' + esc(n.loc) + '" oninput="S.arg.n.loc=this.value">' + (TEQ_POWER_CATS.indexOf(n.cat) >= 0 ? '<label class="nl">動力</label><div class="seg">' + [ [ "", "引擎式" ], [ "電動", "電動" ] ].map((function(o) {
  return '<button class="' + (n.power === o[0] ? "on" : "") + '" onclick="S.arg.n.power=' + jsq(o[0]) + ';render()">' + o[1] + "</button>";
 })).join("") + "</div>" : "") + '<label class="nl" for="enOw">負責人</label><select id="enOw" class="field" onchange="S.arg.n.owner=this.value"><option value="">先不指定</option>' + ops.map((function(o) {
  return "<option" + (o === n.owner ? " selected" : "") + ">" + esc(o) + "</option>";
 })).join("") + "</select></div>";
 $("app").innerHTML = h;
 bar('<button class="btn" onclick="eqNewGo()">' + ic("plus", 22, 2.8) + "新增這台設備</button>");
};

function eqNewGo() {
 var tm = S.team, n = S.arg.n;
 if (!String(n.obj).trim()) return toast("要填設備編號", "err");
 busyOn("新增中…");
 api("eqSave", {
  deptId: tm.dept,
  add: true,
  cat: n.cat,
  obj: n.obj.trim(),
  name: n.loc,
  power: n.power,
  owner: n.owner
 }).then((function(r) {
  S.arg.n = null;
  teqDone(r, "已新增「" + n.cat + " " + n.obj.trim() + "」");
  back();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
 }));
}

PAGES.deptForms = function() {
 var tm = S.team;
 if (!tm || !tm.ehs) return back();
 setTitle("本課要用的表");
 var w = S.arg.w || (S.arg.w = {}), cur = function(f) {
  return f.id in w ? w[f.id] : f.cur;
 };
 var sec = function(title, list) {
  if (!list.length) return "";
  return '<div class="sec">' + title + '</div><div class="list">' + list.map((function(f) {
   var v = cur(f), chg = v !== f.cur;
   return '<div class="li' + (chg ? " chg" : "") + '"><span class="mn"><span class="nm">' + esc(f.name) + "</span>" + (f.equip ? '<span class="mt">設備類別：' + esc(f.equip) + "</span>" : "") + "</span>" + '<select class="field sel" onchange="S.arg.w[' + jsq(f.id) + ']=this.value;render()"><option value="">不用</option>' + tm.ehs.freqs.map((function(q) {
    return "<option" + (q === v ? " selected" : "") + ">" + esc(q) + "</option>";
   })).join("") + "</select></div>";
  })).join("") + "</div>";
 };
 var fs = tm.ehs.forms;
 $("app").innerHTML = '<div class="muted upnote">「' + esc(tm.dept) + "」要做哪些檢查、多久一次。選「不用」＝這課看不到這張表。分設備的表，還要這課有那類設備才會出現。改好按下方儲存，今天起生效。</div>" + sec("不分設備的表", fs.filter((function(f) {
  return !f.equip;
 }))) + sec("分設備的表", fs.filter((function(f) {
  return f.equip;
 })));
 var n = Object.keys(w).filter((function(k) {
  return w[k] !== fs.filter((function(f) {
   return f.id === k;
  }))[0].cur;
 })).length;
 bar('<button class="btn"' + (n ? "" : " disabled") + ' onclick="deptFormsSave()">' + ic("check", 22, 2.8) + (n ? "儲存（" + n + " 項）" : "沒有變更") + "</button>");
};

function deptFormsSave() {
 var tm = S.team, w = S.arg.w, set = {};
 tm.ehs.forms.forEach((function(f) {
  if (f.id in w && w[f.id] !== f.cur) set[f.id] = w[f.id];
 }));
 busyOn("儲存中…");
 api("deptForms", {
  deptId: tm.dept,
  set
 }).then((function(r) {
  S.arg.w = null;
  teqDone(r, "已更新本課要用的表");
  back();
 })).catch((function(e) {
  busyOff();
  toast(esc(e.message), "err", 5e3);
 }));
}

function teamHandover(dept, name) {
 var tm = S.team, ops = tm.people.filter((function(p) {
  return p.role === "檢點人員" && p.name !== name;
 })).map((function(p) {
  return p.name;
 }));
 var mine = tm.targets.filter((function(x) {
  return x.now.indexOf(name) >= 0;
 }));
 if (!mine.length) return toast(name + " 目前沒有負責的表或設備", "ok");
 if (!ops.length) return toast("本課沒有其他檢點人員", "err");
 dlg("<b>" + esc(name) + " 的 " + mine.length + ' 項全部轉給誰？</b><p class="sm">今天起生效；跟別人一起負責的項目，只把 ' + esc(name) + " 換掉。</p>", ops.map((function(n) {
  return [ n, function() {
   teqBatch(mine.map((function(x) {
    var w = x.now.filter((function(k) {
     return k !== name;
    }));
    if (w.indexOf(n) < 0) w.push(n);
    return {
     target: x.key,
     names: w
    };
   })), "now");
  }, "ghost" ];
 })));
}
