/**
 * 名刺印刷ソフト データ層 v2
 *  - 名刺レコード: data/meishi-records.json（静的・226件）を読み込み
 *  - 設定(config): 所有者が決めるログインID/パスワード等。Firebase Realtime DB /meishi_config に保存（全端末共有）。
 *    Firebase が無ければ localStorage のみ。
 */
(function () {
  const CFG_KEY = "meishi_config_v1";
  const FB_CFG_PATH = "meishi_config";

  let _records = [];
  let _config = { ownerId: "admin", ownerPass: "1234", title: "名刺印刷システム" };
  let _ready = false;
  let _fbDb = null;
  let _useFirebase = false;
  let _suppress = false;
  let _cfgListeners = [];

  function fireCfg() {
    _cfgListeners.forEach(function (cb) { try { cb(_config); } catch (e) {} });
  }

  function assetUrl(relPath) {
    var rel = String(relPath || "").replace(/^\//, "");
    var path = window.location.pathname || "/";
    var dir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
    if (dir === "") dir = "/";
    return window.location.origin + dir + rel;
  }

  function loadLocalCfg() {
    try {
      var s = localStorage.getItem(CFG_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  }
  function persistCfg() {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(_config)); } catch (e) {}
    if (_useFirebase && _fbDb && !_suppress) {
      try { _fbDb.ref(FB_CFG_PATH).set(_config); } catch (e) {}
    }
  }

  async function loadRecords() {
    var url = assetUrl("data/meishi-records.json");
    try {
      var res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      _records = await res.json();
    } catch (e) {
      console.error("[MeishiStore] レコード読込失敗", e);
      throw new Error(
        "名刺データを読み込めませんでした。\n" +
        "・ローカルで開く場合は start.bat からサーバー起動して http://127.0.0.1:8791/ で開いてください。\n" +
        "・試したURL: " + url
      );
    }
  }

  async function initFirebase() {
    var cfg = window.MEISHI_FIREBASE_CONFIG;
    if (!(cfg && cfg.databaseURL) || typeof window.firebase === "undefined") return;
    try {
      if (window.firebase.apps && window.firebase.apps.length > 0) _fbDb = window.firebase.app().database();
      else { window.firebase.initializeApp(cfg); _fbDb = window.firebase.database(); }
      _useFirebase = true;
    } catch (e) { console.warn("[MeishiStore] Firebase初期化失敗", e); return; }
    try {
      var snap = await _fbDb.ref(FB_CFG_PATH).once("value");
      var v = snap.val();
      if (v && typeof v === "object") {
        _config = Object.assign({}, _config, v);
        try { localStorage.setItem(CFG_KEY, JSON.stringify(_config)); } catch (e) {}
      } else {
        _suppress = true;
        try { await _fbDb.ref(FB_CFG_PATH).set(_config); } catch (e) {}
        _suppress = false;
      }
    } catch (e) { console.warn("[MeishiStore] config初回読込失敗", e); }
    try {
      _fbDb.ref(FB_CFG_PATH).on("value", function (snap) {
        var v = snap.val();
        if (v && typeof v === "object") {
          _config = Object.assign({}, _config, v);
          try { localStorage.setItem(CFG_KEY, JSON.stringify(_config)); } catch (e) {}
          fireCfg();
        }
      });
    } catch (e) {}
  }

  async function init() {
    _ready = false;
    var local = loadLocalCfg();
    if (local) _config = Object.assign({}, _config, local);
    await loadRecords();
    await initFirebase();
    _ready = true;
  }

  function cloneLayout(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }
  function isValidLayout(v) {
    return v && typeof v === "object" && v.el && typeof v.el === "object";
  }

  window.MeishiStore = {
    init: init,
    getRecords: function () { return _records.slice(); },
    getConfig: function () { return Object.assign({}, _config); },
    saveConfig: function (obj) { _config = Object.assign({}, _config, obj || {}); persistCfg(); fireCfg(); },
    getDefaultLayout: function () {
      var v = _config.defaultLayout;
      return isValidLayout(v) ? cloneLayout(v) : null;
    },
    saveDefaultLayout: function (layout) {
      if (!isValidLayout(layout)) throw new Error("無効なレイアウトです");
      this.saveConfig({ defaultLayout: cloneLayout(layout) });
    },
    clearDefaultLayout: function () {
      var c = Object.assign({}, _config);
      delete c.defaultLayout;
      _config = c;
      persistCfg();
      fireCfg();
    },
    useFirebase: function () { return _useFirebase; },
    onConfigChange: function (cb) { if (typeof cb === "function") _cfgListeners.push(cb); },
    userUrl: function () {
      var base = window.MEISHI_BASE_URL;
      if (base) return String(base).replace(/\/?$/, "/") + "user.html";
      return assetUrl("user.html");
    },
    ownerUrl: function () {
      var base = window.MEISHI_BASE_URL;
      if (base) return String(base).replace(/\/?$/, "/") + "owner.html";
      return assetUrl("owner.html");
    },
    get ready() { return _ready; },
  };
})();
