/* 員和電子抄表：畫面語言（中文／English／ภาษาไทย）
 * 做法：程式與資料一律中文不動；畫面畫好後，依字典把「整段文字」換成選的語言。
 *  - 只換畫面上的字；送出的資料、試算表、PDF、Email 永遠是中文（給主管、勞檢、稽核看）。
 *  - 字典查不到的字就維持中文，不會出錯。
 *  - 人名、部門名、使用者輸入的內容不在字典內，保持原樣。
 *  - 選中文時完全不作用（不掛觀察器），與舊版行為相同。
 * 字典在 i18n_dict.js（I18N_DICT），數字以 {0}{1}… 代入，例：「今天還有 {0} 張」。
 */
'use strict';
var I18N = (function () {
  var KEY = 'chk.lang';
  var LANGS = [['zh', '中文'], ['en', 'English'], ['th', 'ภาษาไทย']];
  var lang = 'zh';
  try { lang = JSON.parse(localStorage.getItem(KEY) || '"zh"') || 'zh'; } catch (e) {}
  if (!LANGS.some(function (l) { return l[0] === lang; })) lang = 'zh';
  var dict = {}, pats = [], busy = false, collect = null;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 0, OPTION: 0, CANVAS: 1, SVG: 1 };
  var HAN = /[㐀-鿿]/;

  function load() {
    var D = (typeof I18N_DICT !== 'undefined' && I18N_DICT) || {};
    dict = D[lang] || {};
    pats = [];
    Object.keys(dict).forEach(function (k) {
      if (k.indexOf('{0}') < 0 && k.indexOf('{s0}') < 0) return;
      // {0}{1}＝數字（含小數、斜線日期、冒號時間）；{s0}＝任意文字（人名、部門名）
      var names = [];
      var re = '^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(s?)(\d)\\?\}/g, function (m, s, d) {
        names.push(s + d); return s ? '(.+?)' : '([0-9０-９][0-9０-９.,:/／\\-]*)';
      }) + '$';
      pats.push({ re: new RegExp(re), names: names, to: dict[k], lit: k.replace(/\{s?\d\}/g, '').length });
    });
    pats.sort(function (a, b) { return b.lit - a.lit; });   // 固定字多的先比，避免「{s0} {s1}」這種寬鬆樣式搶先
  }
  function tr(s) {
    if (lang === 'zh' || s == null) return s;
    var raw = String(s), t = raw.trim();
    if (!t || !HAN.test(t)) return s;
    var hit = dict[t];
    if (hit === undefined) {
      for (var i = 0; i < pats.length; i++) {
        var m = pats[i].re.exec(t);
        if (!m) continue;
        var vals = {};
        pats[i].names.forEach(function (n, j) { vals[n] = m[j + 1]; });
        hit = pats[i].to.replace(/\{(s?\d)\}/g, function (x, n) { return vals[n] !== undefined ? (n.charAt(0) === 's' ? (dict[vals[n]] || vals[n]) : vals[n]) : x; });
        break;
      }
    }
    if (hit === undefined) { if (collect) collect[t] = 1; if (window.__i18nSink) try { window.__i18nSink(t); } catch (e) {} return s; }
    return raw.replace(t, hit);
  }
  function skip(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.nodeName] || SKIP[String(e.nodeName).toUpperCase()]) return true;
      if (e.hasAttribute && (e.hasAttribute('data-raw') || e.isContentEditable)) return true;
    }
    return false;
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skip(root.parentNode)) { var v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; } return; }
    if (root.nodeType !== 1 || skip(root)) return;
    ['placeholder', 'title', 'aria-label', 'alt'].forEach(function (a) {
      var v = root.getAttribute && root.getAttribute(a);
      if (v) { var n = tr(v); if (n !== v) root.setAttribute(a, n); }
    });
    if (root.nodeName === 'INPUT' && /^(button|submit)$/i.test(root.type) && root.value) root.value = tr(root.value);
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function apply(root) {
    if (lang === 'zh' || busy) return;
    busy = true;
    try { walk(root || document.body); if (document.title) document.title = tr(document.title); } finally { busy = false; }
  }
  function start() {
    if (lang === 'zh') return;
    load();
    document.documentElement.lang = lang;
    apply(document.body);
    new MutationObserver(function (ms) {
      if (busy) return;
      busy = true;
      try {
        ms.forEach(function (m) {
          if (m.type === 'characterData') walk(m.target);
          else for (var i = 0; i < m.addedNodes.length; i++) walk(m.addedNodes[i]);
        });
      } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    // 系統對話框（alert／confirm／prompt）的訊息也換
    ['alert', 'confirm', 'prompt'].forEach(function (f) {
      var o = window[f];
      window[f] = function (msg, def) { return o.call(window, tr(msg), def); };
    });
  }
  function set(l) {
    try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {}
    location.reload();
  }
  /** 語言切換列（登入頁、設定頁用）：三個按鈕，目前語言反白。 */
  function picker() {
    return '<div class="langpick" data-raw>' + LANGS.map(function (l) {
      return '<button type="button" class="btn sm ' + (l[0] === lang ? '' : 'ghost') + '" onclick="I18N.set(\'' + l[0] + '\')">' + l[1] + '</button>';
    }).join('') + '</div>';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  var WK = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], th: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] };
  function wkNames() { return WK[lang] || null; }
  return { tr: tr, set: set, picker: picker, wkNames: wkNames, apply: apply, lang: function () { return lang; },
           collect: function (on) { collect = on ? {} : null; }, missing: function () { return Object.keys(collect || {}); } };
})();
