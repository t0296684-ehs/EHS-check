// 員和環安衛系統｜手機推播（10/28 Jason：App 的通知要能在手機跳出來；有開的人就有，沒開的照舊在 App 裡看）
// 載入順序：plat.js 之後、app.js 之前。共用 app.js 的 api、lsGet、gasUrl、toast、render（只在執行時呼叫）。頂層只放常數與函式。
// 流程：主選單「開啟手機通知」→ 手機問允許 → 跟推播服務訂閱 → 端點交給後端（pushSub）。
// 通知進來時後端叫醒手機，sw.js 用這裡存在手機 IndexedDB 的網址與登入權杖去拿最新幾則（pushPeek）顯示。
// iPhone：要先「加入主畫面」從主畫面打開才有推播（iOS 16.4 起）；在 Safari 裡開的會教他怎麼加。
var PUSH_DB = 'ehs-push', PUSH_LS_NO = 'chk.pushNo', PUSH_LS_SYNC = 'chk.pushSync';
function pushDb(fn) {
  try {
    var rq = indexedDB.open(PUSH_DB, 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
    rq.onsuccess = function () { try { fn(rq.result); } catch (e) {} };
  } catch (e) {}
}
/** 把系統網址、登入權杖、App 版本存給 sw.js（手機被叫醒時用來拿通知內容）。 */
function pushCfgSave() {
  var tok = lsGet(LS.TOKEN, ''); if (!tok) return;
  pushDb(function (db) { var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ url: gasUrl(), token: tok, ver: APP_VERSION }, 'cfg'); });
}
function pushIos() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function pushStandalone() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
/** 這支手機的狀態：on 已開／off 可以開／ios 要先加主畫面／denied 被拒絕／no 不支援。 */
function pushState() {
  var ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!ok) return Promise.resolve(pushIos() && !pushStandalone() ? 'ios' : 'no');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (s) { return s && Notification.permission === 'granted' ? 'on' : 'off'; }).catch(function () { return 'off'; });
}
function pushB64(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  var raw = atob(s), out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
/** 主選單上的卡片：還沒開才出現；開了就每天默默跟後端對一次（換人登入、訂閱換了都會更新）。 */
function pushCard() {
  if (S.dev || S.share || !S.me) return '';
  pushCfgSave();
  setTimeout(pushFill, 50);
  return '<div id="pushBox"></div>';
}
function pushFill() {
  var box = $('pushBox'); if (!box) return;
  pushState().then(function (st) {
    if (st === 'on') { pushSync(); box.innerHTML = ''; return; }
    if (lsGet(PUSH_LS_NO, '') === today() || st === 'no') { box.innerHTML = ''; return; }
    var no = '<button class="lnk" onclick="pushLater()">' + '今天先不要' + '</button>';
    if (st === 'ios') box.innerHTML = '<div class="box info"><div class="r">' + ic('bell', 22) + '<div class="bt"><div class="m"><b>' + '想讓手機跳出通知？' + '</b><br>' +
      'iPhone 要先把 App 加到主畫面：按 Safari 下方的「分享」→「加入主畫面」，之後從主畫面的圖示打開 App，再按這裡開啟。' + '</div>' + no + '</div></div></div>';
    else if (st === 'denied') box.innerHTML = '<div class="box warn"><div class="r">' + ic('bell', 22) + '<div class="bt"><div class="m">' +
      '這支手機擋掉了 App 的通知。要收通知請到手機「設定」→ 通知，找到這個 App（或瀏覽器）打開。' + '</div>' + no + '</div></div></div>';
    else box.innerHTML = '<div class="mcards"><button class="mcard" style="--c:#2F6FD6" onclick="pushEnable()"><span class="mi">' + ic('bell', 30, 2.1) + '</span>' +
      '<span class="mx"><b>' + '開啟手機通知' + '</b><small>' + '有新通知時手機會跳出來，不用一直打開 App 看' + '</small></span>' + ic('chev', 20, 2.6) + '</button>' + no + '</div>';
  });
}
function pushLater() { lsSet(PUSH_LS_NO, today()); var b = $('pushBox'); if (b) b.innerHTML = ''; }
function pushSub(test) {
  return api('pushKey', {}).then(function (k) {
    if (!k.on || !k.key) { var e = new Error('手機通知還沒開放'); e.biz = true; throw e; }
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushB64(k.key) });
      });
    });
  }).then(function (s) {
    var j = s.toJSON ? s.toJSON() : { endpoint: s.endpoint };
    return api('pushSub', { sub: { endpoint: j.endpoint }, ua: navigator.userAgent.slice(0, 120), test: !!test });
  });
}
function pushEnable() {
  if (!('Notification' in window)) return toast('這支手機不支援通知', 'warn');
  Notification.requestPermission().then(function (p) {
    if (p !== 'granted') { toast('沒有允許通知，之後可以到手機設定打開', 'warn'); return pushFill(); }
    busyOn('開啟手機通知…');
    pushCfgSave();
    return pushSub(true).then(function () {
      busyOff(); lsSet(PUSH_LS_SYNC, today()); toast('開好了！等一下會收到一則測試通知', 'ok'); pushFill();
    }).catch(function (e) { busyOff(); toast(e.message, 'warn'); });
  });
}
function pushSync() {
  if (lsGet(PUSH_LS_SYNC, '') === today()) return;
  lsSet(PUSH_LS_SYNC, today());
  pushSub(false).catch(function () { lsSet(PUSH_LS_SYNC, ''); });
}
