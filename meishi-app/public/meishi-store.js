/**
 * 名刺印刷ソフト データ層 v4
 */
(function () {
  const CFG_KEY = "meishi_config_v1";
  const DESIGN_APPLY_UNDO_KEY = "meishi_design_apply_undo_v1";
  const REC_KEY = "meishi_records_v1";
  const IMG_LIB_KEY = "meishi_image_library_v1";
  const IMG_LIB_BACKUP_KEY = "meishi_image_library_v1_backup";
  const PREVIEW_PERSONAL_KEY = "meishi_preview_personal_v1";
  const PREVIEW_KOJI_KEY = "meishi_preview_koji_v1";
  const FB_CFG_PATH = "hh_data/meishi_config";
  const FB_AUTH_PATH = "hh_data/meishi_auth";
  const FB_REC_PATH = "hh_data/meishi_records";
  const FB_IMG_LIB_PATH = "hh_data/meishi_image_library";
  const FB_PREVIEW_PERSONAL_PATH = "hh_data/meishi_preview_personal";
  const FB_PREVIEW_KOJI_PATH = "hh_data/meishi_preview_koji";

  let _records = [];
  let _config = {
    ownerId: "admin",
    ownerPass: "1234",
    title: "名刺印刷システム",
    companySettings: {},
    deptSettings: {},
    imageLibrary: [],
  };
  let _ready = false;
  let _fbDb = null;
  let _useFirebase = false;
  let _fbCfgLoaded = false;
  let _fbAuthLoaded = false;
  let _suppress = false;
  let _suppressRecRemote = false;
  let _suppressRecRemoteTimer = null;
  let _suppressCfgRemote = false;
  let _suppressCfgRemoteTimer = null;
  let _cfgListeners = [];
  let _recListeners = [];
  let _fireCfgTimer = null;
  let _fireRecTimer = null;
  let _mergedRecordsCache = null;
  let _previewPersonal = {};
  let _previewKoji = {};
  let _suppressImgLibRemote = false;
  let _suppressImgLibRemoteTimer = null;
  let _suppressKojiRemote = false;
  let _suppressKojiRemoteTimer = null;
  const IDB_NAME = "meishi_app_v1";
  const IDB_STORE = "kv";
  const IDB_IMG_LIB = "imageLibrary";
  const IDB_PREVIEW_PERSONAL = "previewPersonal";

  function fireCfgNow() {
    if (_fireCfgTimer) {
      clearTimeout(_fireCfgTimer);
      _fireCfgTimer = null;
    }
    _cfgListeners.forEach(function (cb) { try { cb(getConfig()); } catch (e) {} });
  }
  function fireRecNow() {
    if (_fireRecTimer) {
      clearTimeout(_fireRecTimer);
      _fireRecTimer = null;
    }
    _mergedRecordsCache = null;
    _recListeners.forEach(function (cb) { try { cb(getRecords()); } catch (e) {} });
  }
  function fireCfg() {
    if (_fireCfgTimer) clearTimeout(_fireCfgTimer);
    _fireCfgTimer = setTimeout(function () {
      _fireCfgTimer = null;
      _mergedRecordsCache = null;
      _cfgListeners.forEach(function (cb) { try { cb(getConfig()); } catch (e) {} });
    }, 60);
  }
  function fireRec() {
    if (_fireRecTimer) clearTimeout(_fireRecTimer);
    _fireRecTimer = setTimeout(function () {
      _fireRecTimer = null;
      _mergedRecordsCache = null;
      _recListeners.forEach(function (cb) { try { cb(getRecords()); } catch (e) {} });
    }, 60);
  }

  function assetUrl(relPath) {
    var rel = String(relPath || "").replace(/^\//, "");
    var path = window.location.pathname || "/";
    var dir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
    if (dir === "") dir = "/";
    return window.location.origin + dir + rel;
  }
  /** 共有用ページ URL（携帯・他PC向け）。MEISHI_BASE_URL があれば常に本番URLを返す。 */
  function sharePageUrl(page, opts) {
    opts = opts || {};
    var p = String(page || "").replace(/^\//, "");
    var base = window.MEISHI_BASE_URL;
    var url;
    if (base && /^https?:\/\//i.test(String(base))) {
      url = String(base).replace(/\/?$/, "/") + p;
    } else if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      url = assetUrl(p);
    } else {
      try {
        url = new URL(p, window.location.href).href;
      } catch (e) {
        url = p;
      }
    }
    if (opts.hash) url += "#" + String(opts.hash).replace(/^#/, "");
    return url;
  }
  /** 使用者/所有者ページ URL（開く・コピー用）。表示中のサイト origin を優先。 */
  function publicPageUrl(page, opts) {
    opts = opts || {};
    var p = String(page || "").replace(/^\//, "");
    var url;
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      url = assetUrl(p);
    } else if (window.location.protocol === "file:") {
      try {
        url = new URL(p, window.location.href).href;
      } catch (e) {
        url = p;
      }
    } else {
      var base = window.MEISHI_BASE_URL;
      url = base ? String(base).replace(/\/?$/, "/") + p : assetUrl(p);
    }
    if (opts.hash) url += "#" + String(opts.hash).replace(/^#/, "");
    return url;
  }
  function isFileProtocol() {
    return typeof window.location !== "undefined" && window.location.protocol === "file:";
  }
  function loadJsonAsset(relPath, globalKey, defaultValue) {
    if (!isFileProtocol()) {
      return fetch(assetUrl(relPath), { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error(relPath + " HTTP " + res.status + " URL: " + assetUrl(relPath));
        return res.json();
      });
    }
    var jsPath = String(relPath || "").replace(/^\//, "").replace(/\.json$/i, ".js");
    return new Promise(function (resolve, reject) {
      if (Object.prototype.hasOwnProperty.call(window, globalKey)) {
        var cached = window[globalKey];
        try { delete window[globalKey]; } catch (e) {}
        resolve(cached);
        return;
      }
      var s = document.createElement("script");
      s.src = jsPath;
      s.onload = function () {
        var v = Object.prototype.hasOwnProperty.call(window, globalKey) ? window[globalKey] : defaultValue;
        try { delete window[globalKey]; } catch (e2) {}
        resolve(v);
      };
      s.onerror = function () {
        reject(new Error("データを読み込めません: " + jsPath + "（file:// 用）"));
      };
      document.head.appendChild(s);
    });
  }
  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }

  function normalizeLibraryItem(item) {
    if (!item) return null;
    var src = String(item.src || "").trim();
    if (src.indexOf("data:") === 0) {
      var label = item.label || item.file || "画像";
      return {
        id: item.id || ("lib-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7)),
        src: src,
        label: label,
        file: item.file || label,
      };
    }
    var file = String(item.file || "").replace(/^images\//, "").replace(/^\//, "");
    if (!file && item.path) file = String(item.path).replace(/^images\//, "").replace(/^\//, "");
    if (!file) return null;
    var base = file.replace(/\.[^.]+$/, "");
    return {
      id: item.id || base,
      file: file,
      path: "images/" + file,
      label: item.label || base || file,
    };
  }

  function loadLocalCfg() {
    try {
      var s = localStorage.getItem(CFG_KEY);
      if (s) {
        var c = JSON.parse(s);
        if (c && typeof c === "object") {
          delete c.imageLibrary;
          return c;
        }
      }
    } catch (e) {}
    return null;
  }
  function loadLocalRec() { try { var s = localStorage.getItem(REC_KEY); if (s) return JSON.parse(s); } catch (e) {} return null; }

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("indexedDB unavailable")); return; }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onerror = function () { reject(req.error); };
      req.onupgradeneeded = function (e) {
        e.target.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
    });
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readonly");
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbSet(key, value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function stripLegacyImageLibraryFromLocalConfig() {
    try {
      var s = localStorage.getItem(CFG_KEY);
      if (!s) return;
      var c = JSON.parse(s);
      if (!c || !Array.isArray(c.imageLibrary) || !c.imageLibrary.length) return;
      if (!localImageLibraryHasItems()) {
        var migrated = c.imageLibrary.map(normalizeLibraryItem).filter(Boolean);
        if (migrated.length) {
          var json = JSON.stringify(migrated);
          try { localStorage.setItem(IMG_LIB_KEY, json); } catch (e) {
            try { localStorage.setItem(IMG_LIB_KEY, JSON.stringify({ __idb: 1 })); } catch (e2) {}
          }
          try { localStorage.setItem(IMG_LIB_BACKUP_KEY, json); } catch (e3) {}
          void idbSet(IDB_IMG_LIB, migrated);
        }
      }
      delete c.imageLibrary;
      localStorage.setItem(CFG_KEY, JSON.stringify(c));
    } catch (e) {}
  }

  /** undefined = 未保存 / [] = 空で保存済み */
  function loadLocalImageLibrarySync() {
    try {
      var s = localStorage.getItem(IMG_LIB_KEY);
      if (s === null) return undefined;
      var parsed = JSON.parse(s);
      if (parsed && parsed.__idb === 1) return "__idb__";
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {}
    return undefined;
  }

  function hasLocalImageLibrarySaved() {
    try { return localStorage.getItem(IMG_LIB_KEY) !== null; } catch (e) {}
    return false;
  }

  function localImageLibraryHasItems() {
    var sync = loadLocalImageLibrarySync();
    if (sync === undefined) return false;
    if (sync === "__idb__") return true;
    return Array.isArray(sync) && sync.length > 0;
  }

  function shouldPreferRemoteData() {
    return !window.MEISHI_OWNER_PAGE;
  }

  function recordsHaveFurigana(arr) {
    return Array.isArray(arr) && arr.some(function (r) {
      return r && String(r.furigana || "").trim();
    });
  }

  function shouldUpgradeRecordsFromRemote(local, remote) {
    if (!Array.isArray(remote) || !remote.length) return false;
    if (!recordsHaveFurigana(remote)) return false;
    if (!Array.isArray(local) || !local.length) return true;
    if (!recordsHaveFurigana(local)) return true;
    if (local.length !== remote.length) return true;
    if (String(local[0].name || "") !== String(remote[0].name || "")) return true;
    return false;
  }

  async function loadImageLibraryFromStorage() {
    var sync = loadLocalImageLibrarySync();
    if (sync === "__idb__") {
      try {
        var idbVal = await idbGet(IDB_IMG_LIB);
        if (Array.isArray(idbVal) && idbVal.length) return idbVal;
      } catch (e) {}
      return [];
    }
    if (sync !== undefined && sync.length > 0) return sync;
    try {
      var idbVal2 = await idbGet(IDB_IMG_LIB);
      if (Array.isArray(idbVal2) && idbVal2.length) return idbVal2;
    } catch (e) {}
    try {
      var backup = localStorage.getItem(IMG_LIB_BACKUP_KEY);
      if (backup) {
        var parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length) return parsedBackup;
      }
    } catch (e) {}
    if (sync !== undefined) return sync;
    return undefined;
  }

  async function recoverImageLibraryFromFirebase() {
    if (!_useFirebase || !_fbDb) return null;
    try {
      var snap = await _fbDb.ref(FB_IMG_LIB_PATH).once("value");
      var remote = snap.val();
      var arr = Array.isArray(remote) ? remote.map(normalizeLibraryItem).filter(Boolean) : [];
      if (!arr.length) return null;
      _config.imageLibrary = arr;
      await saveImageLibraryToStorage(arr);
      fireCfg();
      return arr;
    } catch (e) {
      console.warn("[Meishi] recover from Firebase failed", e);
      return null;
    }
  }

  async function recoverImageLibrary() {
    var sources = [];
    try {
      var idbVal = await idbGet(IDB_IMG_LIB);
      if (Array.isArray(idbVal) && idbVal.length) sources.push(idbVal);
    } catch (e) {}
    try {
      var backup = localStorage.getItem(IMG_LIB_BACKUP_KEY);
      if (backup) {
        var parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length) sources.push(parsedBackup);
      }
    } catch (e) {}
    try {
      var cfgRaw = localStorage.getItem(CFG_KEY);
      if (cfgRaw) {
        var cfgObj = JSON.parse(cfgRaw);
        if (cfgObj && Array.isArray(cfgObj.imageLibrary) && cfgObj.imageLibrary.length) {
          sources.push(cfgObj.imageLibrary);
        }
      }
    } catch (e) {}
    try {
      var direct = localStorage.getItem(IMG_LIB_KEY);
      if (direct && direct.indexOf("__idb") < 0) {
        var parsedDirect = JSON.parse(direct);
        if (Array.isArray(parsedDirect) && parsedDirect.length) sources.push(parsedDirect);
      }
    } catch (e) {}
    var merged = [];
    var seen = {};
    sources.forEach(function (arr) {
      (arr || []).forEach(function (item) {
        var n = normalizeLibraryItem(item);
        if (!n || !n.src) return;
        var key = String(n.id || "") + "|" + String(n.src).slice(0, 96);
        if (seen[key]) return;
        seen[key] = true;
        merged.push(n);
      });
    });
    if (!merged.length) {
      var fbArr = await recoverImageLibraryFromFirebase();
      if (fbArr && fbArr.length) return { ok: true, count: fbArr.length, source: "firebase" };
      return { ok: false, count: 0 };
    }
    _config.imageLibrary = merged;
    await saveImageLibraryToStorage(merged);
    if (_useFirebase && _fbDb && window.MEISHI_OWNER_PAGE) await syncImageLibraryRemote(merged);
    fireCfg();
    return { ok: true, count: merged.length, source: "local" };
  }

  async function bootstrapLocalImageLibrary() {
    var lib = await loadImageLibraryFromStorage();
    if (lib && lib.length) {
      _config.imageLibrary = lib.map(normalizeLibraryItem).filter(Boolean);
      return;
    }
    if (window.MEISHI_OWNER_PAGE) await recoverImageLibrary();
  }

  async function tryPromoteLocalImageLibraryToRemote() {
    var lib = (await loadImageLibraryFromStorage() || []).map(normalizeLibraryItem).filter(Boolean);
    if (!lib.length) return;
    _config.imageLibrary = lib;
    if (window.MEISHI_OWNER_PAGE && _useFirebase && _fbDb) await syncImageLibraryRemote(lib);
  }

  async function saveImageLibraryToStorage(arr) {
    var data = (arr || []).map(normalizeLibraryItem).filter(Boolean);
    var json = JSON.stringify(data);
    try {
      localStorage.setItem(IMG_LIB_KEY, json);
      try { await idbSet(IDB_IMG_LIB, data); } catch (e2) {}
      if (data.length) {
        try { localStorage.setItem(IMG_LIB_BACKUP_KEY, json); } catch (e3) {}
      }
      return true;
    } catch (e) {
      try {
        await idbSet(IDB_IMG_LIB, data);
        localStorage.setItem(IMG_LIB_KEY, JSON.stringify({ __idb: 1 }));
        if (data.length) {
          try { localStorage.setItem(IMG_LIB_BACKUP_KEY, json); } catch (e3) {}
        }
        return true;
      } catch (e2) {
        console.warn("[Meishi] imageLibrary save failed (localStorage + IndexedDB)", e2);
        return false;
      }
    }
  }

  function loadLocalPreviewPersonalSync() {
    try {
      var s = localStorage.getItem(PREVIEW_PERSONAL_KEY);
      if (s === null) return undefined;
      var parsed = JSON.parse(s);
      if (parsed && parsed.__idb === 1) return "__idb__";
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {}
    return undefined;
  }

  function hasLocalPreviewPersonalSaved() {
    try { return localStorage.getItem(PREVIEW_PERSONAL_KEY) !== null; } catch (e) {}
    return false;
  }

  async function loadPreviewPersonalFromStorage() {
    var sync = loadLocalPreviewPersonalSync();
    if (sync === "__idb__") {
      try {
        var idbVal = await idbGet(IDB_PREVIEW_PERSONAL);
        return idbVal && typeof idbVal === "object" ? idbVal : {};
      } catch (e) {
        return {};
      }
    }
    if (sync !== undefined) return sync;
    return undefined;
  }

  async function savePreviewPersonalToStorage(obj) {
    var data = obj && typeof obj === "object" ? obj : {};
    var json = JSON.stringify(data);
    try {
      localStorage.setItem(PREVIEW_PERSONAL_KEY, json);
      try { await idbSet(IDB_PREVIEW_PERSONAL, data); } catch (e2) {}
      return true;
    } catch (e) {
      try {
        await idbSet(IDB_PREVIEW_PERSONAL, data);
        localStorage.setItem(PREVIEW_PERSONAL_KEY, JSON.stringify({ __idb: 1 }));
        return true;
      } catch (e2) {
        console.warn("[Meishi] previewPersonal save failed", e2);
        return false;
      }
    }
  }

  function imageLibraryForRemote(arr) {
    return (arr || []).map(normalizeLibraryItem).filter(function (x) {
      if (!x) return false;
      var src = String(x.src || "");
      if (src.indexOf("blob:") === 0) return false;
      return true;
    });
  }

  async function syncImageLibraryRemote(arr) {
    if (!_useFirebase || !_fbDb) return false;
    var payload = imageLibraryForRemote(arr);
    if (!payload.length) {
      if (window.MEISHI_OWNER_PAGE && localImageLibraryHasItems()) return false;
      if (!window.MEISHI_OWNER_PAGE) return false;
    }
    try {
      await _fbDb.ref(FB_IMG_LIB_PATH).set(payload.length ? payload : null);
      return true;
    } catch (e) {
      console.warn("[Meishi] image library remote save failed", e);
      return false;
    }
  }

  function configForMainStorage() {
    var c = clone(_config);
    if (c && typeof c === "object") delete c.imageLibrary;
    return c;
  }

  async function persistImageLibraryStore(lib) {
    var arr = (lib || []).map(normalizeLibraryItem).filter(Boolean);
    _config.imageLibrary = arr;
    var ok = await saveImageLibraryToStorage(arr);
    if (_useFirebase && _fbDb) {
      _suppressImgLibRemote = true;
      if (_suppressImgLibRemoteTimer) clearTimeout(_suppressImgLibRemoteTimer);
      _suppressImgLibRemoteTimer = setTimeout(function () { _suppressImgLibRemote = false; }, 10000);
      await syncImageLibraryRemote(arr);
    }
    return ok;
  }

  async function persistPreviewPersonalStore() {
    var ok = await savePreviewPersonalToStorage(_previewPersonal);
    if (_useFirebase && _fbDb) {
      try { _fbDb.ref(FB_PREVIEW_PERSONAL_PATH).set(_previewPersonal); } catch (e) {}
    }
    return ok;
  }

  async function applyLocalImageLibrary() {
    var lib = await loadImageLibraryFromStorage();
    if (lib !== undefined) {
      _config.imageLibrary = lib.map(normalizeLibraryItem).filter(Boolean);
      return;
    }
    _config.imageLibrary = [];
    await saveImageLibraryToStorage([]);
  }

  async function applyLocalPreviewPersonal() {
    var m = await loadPreviewPersonalFromStorage();
    if (m !== undefined) {
      _previewPersonal = m;
      return;
    }
    _previewPersonal = {};
    await savePreviewPersonalToStorage({});
  }

  function applyLocalPreviewKoji() {
    _previewKoji = loadLocalPreviewKoji() || {};
  }

  function imageLibraryFingerprint(arr) {
    return (arr || []).map(function (x) {
      if (!x) return "";
      var srcLen = x.src ? String(x.src).length : 0;
      return String(x.id || "") + ":" + srcLen + ":" + String(x.path || "") + ":" + String(x.file || "");
    }).join("|");
  }

  function imageLibrarySame(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return imageLibraryFingerprint(a) === imageLibraryFingerprint(b);
  }

  async function applyImageLibraryWithRemote(remoteLib) {
    var remoteArr = Array.isArray(remoteLib) ? remoteLib.map(normalizeLibraryItem).filter(Boolean) : [];
    var hasRemote = remoteArr.length > 0;

    if (!hasRemote) {
      var localArr = (await loadImageLibraryFromStorage() || []).map(normalizeLibraryItem).filter(Boolean);
      if (!localArr.length && window.MEISHI_OWNER_PAGE) {
        var rec = await recoverImageLibrary();
        if (rec.ok) return;
        localArr = getImageLibrary();
      }
      if (localArr.length) {
        _config.imageLibrary = localArr;
        // 起動時の空リモートではフルアップロードしない（遅延の主因だった）
        return;
      }
      if (!hasLocalImageLibrarySaved()) {
        _config.imageLibrary = [];
        await saveImageLibraryToStorage([]);
      } else {
        await applyLocalImageLibrary();
      }
      return;
    }

    if (shouldPreferRemoteData()) {
      var curLib = getImageLibrary();
      if (imageLibrarySame(curLib, remoteArr)) {
        if (!curLib.length) _config.imageLibrary = remoteArr;
        return;
      }
      _config.imageLibrary = remoteArr;
      await saveImageLibraryToStorage(remoteArr);
      return;
    }
    if (localImageLibraryHasItems() || getImageLibrary().length) {
      if (!getImageLibrary().length) await applyLocalImageLibrary();
      return;
    }
    if (hasRemote) {
      _config.imageLibrary = remoteArr;
      await saveImageLibraryToStorage(remoteArr);
      return;
    }
    await applyLocalImageLibrary();
  }

  async function applyPreviewPersonalWithRemote(remotePv) {
    var hasRemote = remotePv && typeof remotePv === "object" && Object.keys(remotePv).length > 0;
    if (shouldPreferRemoteData() && hasRemote) {
      _previewPersonal = remotePv;
      await savePreviewPersonalToStorage(_previewPersonal);
      return;
    }
    if (!hasLocalPreviewPersonalSaved()) {
      if (hasRemote) {
        _previewPersonal = remotePv;
        await savePreviewPersonalToStorage(_previewPersonal);
        return;
      }
    }
    await applyLocalPreviewPersonal();
  }

  function mergeDeptSettingsEntry(lv, rv, preferRemote) {
    if (preferRemote) {
      if (rv && typeof rv === "object") {
        return normalizeDeptProfile(clone(rv), rv.company, rv.aff1, rv.aff2);
      }
      if (lv && typeof lv === "object") {
        return normalizeDeptProfile(clone(lv), lv.company, lv.aff1, lv.aff2);
      }
      return normalizeDeptProfile({}, "", "", "");
    }
    if (!lv || typeof lv !== "object") {
      return normalizeDeptProfile(clone(rv), rv.company, rv.aff1, rv.aff2);
    }
    // 所有者端末で編集・保存した部署設定を優先（リモートの空 layout で上書きしない）
    return normalizeDeptProfile(clone(lv), lv.company || rv.company, lv.aff1 || rv.aff1, lv.aff2 != null ? lv.aff2 : (rv.aff2 || ""));
  }

  function mergeSettingsMaps(localMap, remoteMap, preferRemote) {
    localMap = localMap && typeof localMap === "object" ? localMap : {};
    remoteMap = remoteMap && typeof remoteMap === "object" ? remoteMap : {};
    if (preferRemote) {
      var remoteFirst = clone(remoteMap) || {};
      Object.keys(localMap).forEach(function (k) {
        if (!remoteFirst[k]) remoteFirst[k] = clone(localMap[k]);
      });
      return remoteFirst;
    }
    var out = clone(localMap) || {};
    Object.keys(remoteMap).forEach(function (k) {
      var rv = remoteMap[k];
      var lv = out[k];
      if (rv && typeof rv === "object" && lv && typeof lv === "object") {
        if (k.indexOf("|") >= 0) {
          out[k] = mergeDeptSettingsEntry(lv, rv, false);
        } else {
          out[k] = Object.assign({}, rv, lv);
          if (rv.forceLayoutFromRemote) {
            if (rv.layout && MeishiLayout.isValidLayout(rv.layout)) {
              out[k].layout = clone(rv.layout);
            }
            if (rv.layoutBack && MeishiLayout.isValidBackLayout(rv.layoutBack)) {
              out[k].layoutBack = clone(rv.layoutBack);
            } else if (rv.layoutBack && typeof rv.layoutBack === "object") {
              out[k].layoutBack = clone(rv.layoutBack);
            }
            delete out[k].forceLayoutFromRemote;
          } else {
            if (lv.layout && MeishiLayout.isValidLayout(lv.layout)) {
              out[k].layout = clone(lv.layout);
            } else if (rv.layout && MeishiLayout.isValidLayout(rv.layout)) {
              out[k].layout = clone(rv.layout);
            }
            if (lv.layoutBack && MeishiLayout.isValidBackLayout(lv.layoutBack)) {
              out[k].layoutBack = clone(lv.layoutBack);
            } else if (rv.layoutBack && MeishiLayout.isValidBackLayout(rv.layoutBack)) {
              out[k].layoutBack = clone(rv.layoutBack);
            }
          }
        }
      } else {
        out[k] = clone(rv);
      }
    });
    return out;
  }

  function authPayload() {
    return {
      ownerId: String(_config.ownerId == null ? "" : _config.ownerId).trim(),
      ownerPass: String(_config.ownerPass == null ? "" : _config.ownerPass),
      title: String(_config.title || "").trim() || "名刺印刷システム",
    };
  }

  function applyAuthFromRemote(auth) {
    if (!auth || typeof auth !== "object") return false;
    var applied = false;
    if (auth.ownerId != null && String(auth.ownerId).trim() !== "") {
      _config.ownerId = String(auth.ownerId).trim();
      applied = true;
    }
    if (auth.ownerPass != null) {
      _config.ownerPass = String(auth.ownerPass);
      applied = true;
    }
    if (auth.title != null && String(auth.title).trim() !== "") {
      _config.title = String(auth.title).trim();
      applied = true;
    }
    if (applied) {
      _fbAuthLoaded = true;
      _fbCfgLoaded = true;
    }
    return applied;
  }

  async function loadAuthFromFirebase() {
    if (!_useFirebase || !_fbDb) return false;
    try {
      var snap = await _fbDb.ref(FB_AUTH_PATH).once("value");
      if (applyAuthFromRemote(snap.val())) {
        try { localStorage.setItem(CFG_KEY, JSON.stringify(configForMainStorage())); } catch (e) {}
        return true;
      }
    } catch (e) {
      console.warn("[Meishi] auth read failed", e);
    }
    return false;
  }

  async function persistAuthRemote() {
    if (!_useFirebase || !_fbDb || _suppress) return false;
    var auth = authPayload();
    if (!auth.ownerId) return false;
    try {
      await _fbDb.ref(FB_AUTH_PATH).set(auth);
      _fbAuthLoaded = true;
      _fbCfgLoaded = true;
      return true;
    } catch (e) {
      console.warn("[Meishi] auth save failed", e);
      return false;
    }
  }

  function mergeConfigFromRemote(v) {
    if (!v || typeof v !== "object") return;
    var preferRemote = shouldPreferRemoteData();
    var localCo = _config.companySettings || {};
    var localDept = _config.deptSettings || {};
    // 画像ライブラリは別パス管理。設定マージでメモリ上の画像を消さない
    var keepLib = Array.isArray(_config.imageLibrary) ? _config.imageLibrary : null;
    _config = Object.assign({}, _config, v);
    if (v.ownerId != null && String(v.ownerId).trim() !== "") {
      _config.ownerId = String(v.ownerId).trim();
    }
    if (v.ownerPass != null) {
      _config.ownerPass = String(v.ownerPass);
    }
    if (v.title != null && String(v.title).trim() !== "") {
      _config.title = String(v.title).trim();
    }
    if (!_config.companySettings) _config.companySettings = {};
    if (!_config.deptSettings) _config.deptSettings = {};
    if (v.companySettings && typeof v.companySettings === "object") {
      _config.companySettings = mergeSettingsMaps(localCo, v.companySettings, preferRemote);
    }
    if (v.deptSettings && typeof v.deptSettings === "object") {
      _config.deptSettings = mergeSettingsMaps(localDept, v.deptSettings, preferRemote);
    }
    if (keepLib && keepLib.length) {
      _config.imageLibrary = keepLib;
    } else {
      delete _config.imageLibrary;
    }
    _fbCfgLoaded = true;
  }

  async function publishOwnerSnapshotToRemote() {
    if (!_useFirebase || !_fbDb || !window.MEISHI_OWNER_PAGE) return;
    var hasCo = Object.keys(_config.companySettings || {}).length > 0;
    var hasDept = Object.keys(_config.deptSettings || {}).length > 0;
    var hasLib = getImageLibrary().length > 0;
    var hasPv = Object.keys(_previewPersonal || {}).length > 0;
    if (!hasCo && !hasDept && !hasLib && !hasPv && !(_records && _records.length)) return;
    // 設定・レコードのみ。画像ライブラリの起動時フルアップロードは行わない（毎回数秒〜かかるため）
    persistCfg();
    persistRec();
  }

  function safeFbOnce(path) {
    return _fbDb.ref(path).once("value").then(function (snap) {
      return snap;
    }).catch(function (e) {
      console.warn("[Meishi] Firebase once failed: " + path, e);
      return null;
    });
  }

  async function syncAllToRemote() {
    if (!_useFirebase || !_fbDb) return { ok: false, reason: "firebase" };
    try {
      persistCfg();
      persistRec();
      await persistImageLibraryStore(getImageLibrary());
      await persistPreviewPersonalStore();
      return { ok: true };
    } catch (e) {
      console.warn("[Meishi] syncAllToRemote failed", e);
      return { ok: false, reason: String(e && e.message || e) };
    }
  }

  function verifyUserLogin(id, pw) {
    var c = _config;
    var eid = String(id == null ? "" : id).trim();
    var epw = String(pw == null ? "" : pw);
    var oid = String(c.ownerId == null ? "" : c.ownerId).trim();
    var opw = String(c.ownerPass == null ? "" : c.ownerPass);
    return eid === oid && epw === opw;
  }

  async function ensureFirebaseAuth() {
    if (typeof window.firebase === "undefined") return false;
    var auth = null;
    try {
      if (typeof window.firebase.auth === "function") auth = window.firebase.auth();
    } catch (e) {}
    if (!auth || typeof auth.signInAnonymously !== "function") {
      console.warn("[Meishi] firebase-auth 未読込のため匿名ログインをスキップします");
      return false;
    }
    try {
      if (auth.currentUser) return true;
      await auth.signInAnonymously();
      return !!auth.currentUser;
    } catch (e) {
      console.warn("[Meishi] Firebase 匿名ログイン失敗（Authentication で「匿名」を有効にしてください）", e);
      return false;
    }
  }

  function isDataLibraryItem(item) {
    return !!(item && item.src && String(item.src).indexOf("data:") === 0);
  }

  /** ファイル配置の画像のみパスを返す（data URL 登録画像は空文字） */
  function libraryItemStoragePath(item) {
    if (!item || isDataLibraryItem(item)) return "";
    var xp = String(item.path || "").replace(/^\//, "");
    var xf = String(item.file || "").replace(/^images\//, "").replace(/^\//, "");
    if (!xp && xf) xp = "images/" + xf;
    return xp;
  }

  function findLibraryItemForImage(im) {
    var lib = getImageLibrary();
    if (!im || !lib.length) return null;
    var src = String(im.src || "");
    var path = String(im.path || "").replace(/^\//, "");
    var file = String(im.file || "").replace(/^images\//, "").replace(/^\//, "");
    var libId = im.libId || im.id;
    for (var i = 0; i < lib.length; i++) {
      var x = lib[i];
      if (!x) continue;
      if (libId && x.id === libId) return x;
      var xp = libraryItemStoragePath(x);
      if (path && xp && (xp === path || ("images/" + file) === path)) return x;
      if (file && x.file && String(x.file).replace(/^images\//, "").replace(/^\//, "") === file) return x;
      if (src && x.src && src === x.src) return x;
      if (xp && src && src.indexOf(xp) >= 0) return x;
    }
    return null;
  }

  function findLibraryPathForImage(im) {
    var item = findLibraryItemForImage(im);
    return item ? libraryItemStoragePath(item) : "";
  }

  function normalizeLayoutImageForStore(im) {
    if (!im) return null;
    var o = clone(im);
    var libItem = findLibraryItemForImage(o);
    if (libItem) {
      if (!o.libId) o.libId = libItem.id;
      var libPath = libraryItemStoragePath(libItem);
      if (libPath) {
        o.path = String(libPath).replace(/^\//, "");
        if (o.path.indexOf("images/") !== 0) o.path = "images/" + o.path.replace(/^images\//, "");
        delete o.src;
        delete o.file;
        return o;
      }
      delete o.src;
      delete o.file;
      delete o.path;
      return o;
    }
    if (!o.path && o.file) {
      o.path = "images/" + String(o.file).replace(/^\//, "").replace(/^images\//, "");
    }
    if (o.path) {
      o.path = String(o.path).replace(/^\//, "");
      if (o.path.indexOf("images/") !== 0) o.path = "images/" + o.path;
      delete o.src;
      delete o.file;
      return o;
    }
    if (o.src && String(o.src).indexOf("images/") === 0) {
      o.path = String(o.src);
      delete o.src;
      delete o.file;
      return o;
    }
    if (o.src && /^https?:\/\//i.test(String(o.src))) {
      var m = String(o.src).match(/\/images\/(.+?)(?:\?|#|$)/i);
      if (m) {
        try { o.path = "images/" + decodeURIComponent(m[1]); } catch (e) { o.path = "images/" + m[1]; }
        delete o.src;
        delete o.file;
        return o;
      }
    }
    if (o.src && String(o.src).indexOf("data:") === 0) {
      delete o.file;
      return o;
    }
    if (o.libId) return o;
    if (!o.src) return null;
    return o;
  }

  function compactLayoutForStore(layout) {
    var l = MeishiCatalog.normalizeLayout(clone(layout));
    if (!l || !l.el) return l;
    l.images = (l.images || []).map(normalizeLayoutImageForStore).filter(Boolean);
    return l;
  }

  function compactBackLayoutForStore(layout) {
    var l = MeishiCatalog.normalizeBackLayout(clone(layout));
    if (!l) return l;
    l.images = (l.images || []).map(normalizeLayoutImageForStore).filter(Boolean);
    return l;
  }

  function persistCfg() {
    var payload = configForMainStorage();
    if (!payload || typeof payload !== "object") {
      console.warn("[Meishi] config save skipped (invalid payload)");
      return false;
    }
    var ok = true;
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(payload));
    } catch (e) {
      ok = false;
      console.warn("[Meishi] config localStorage failed", e);
    }
    if (_useFirebase && _fbDb && !_suppress) {
      _suppressCfgRemote = true;
      if (_suppressCfgRemoteTimer) clearTimeout(_suppressCfgRemoteTimer);
      _suppressCfgRemoteTimer = setTimeout(function () { _suppressCfgRemote = false; }, 10000);
      try {
        _fbDb.ref(FB_CFG_PATH).set(payload);
        _fbCfgLoaded = true;
        var lib = getImageLibrary();
        if (lib && lib.length) void persistImageLibraryStore(lib);
      } catch (e) {
        console.warn("[Meishi] config remote save failed", e);
      }
      void persistAuthRemote();
    }
    return ok;
  }
  function persistRec() {
    try { localStorage.setItem(REC_KEY, JSON.stringify(_records)); } catch (e) {}
    if (_useFirebase && _fbDb && !_suppress) {
      _suppressRecRemote = true;
      if (_suppressRecRemoteTimer) clearTimeout(_suppressRecRemoteTimer);
      _suppressRecRemoteTimer = setTimeout(function () { _suppressRecRemote = false; }, 15000);
      try { _fbDb.ref(FB_REC_PATH).set(_records); } catch (e) {}
    }
  }

  async function loadSeedRecords() {
    var data = await loadJsonAsset("data/meishi-records.json", "__MEISHI_DEFAULT_RECORDS__", []);
    if (!Array.isArray(data)) throw new Error("meishi-records が配列ではありません");
    return data;
  }
  async function loadRecords() {
    var local = loadLocalRec();
    var seed = await loadSeedRecords();
    if (local && local.length) {
      if (shouldUpgradeRecordsFromRemote(local, seed)) {
        _records = seed;
        try { localStorage.setItem(REC_KEY, JSON.stringify(_records)); } catch (e) {}
        return;
      }
      _records = local;
      return;
    }
    _records = seed;
  }

  function buildProfileFromRaw(raw, companyName) {
    var co = MeishiFields.norm(companyName);
    var p = MeishiCatalog.emptyCompanyProfile(co);
    if (raw && typeof raw === "object") {
      var c = clone(raw);
      if (c) Object.assign(p, c);
    }
    p.company = co;
    if (!p.catalog || typeof p.catalog !== "object") p.catalog = MeishiCatalog.emptyCatalog();
    if (p.layout) p.layout = MeishiCatalog.normalizeLayout(clone(p.layout));
    if (p.layoutBack) p.layoutBack = MeishiCatalog.normalizeBackLayout(clone(p.layoutBack));
    if (raw && raw.logo && p.layout) {
      if (!p.layout.images.some(function (im) { return im.src === raw.logo; })) {
        p.layout.images.push({ id: "logo1", src: raw.logo, x: 250, y: 8, w: 80, h: 44 });
      }
    }
    return p;
  }

  function hasSavedCatalog(raw) {
    if (!raw || !raw.catalog || typeof raw.catalog !== "object") return false;
    var c = raw.catalog;
    return !!(
      (c.aff1 && c.aff1.length) ||
      (c.locations && c.locations.length) ||
      (c.urls && c.urls.length) ||
      (c.postal && c.postal.length)
    );
  }

  function getCompanyProfileForEdit(company) {
    var key = MeishiFields.norm(company);
    var raw = (_config.companySettings || {})[key];
    var p = buildProfileFromRaw(raw, key);
    p.catalog = clone(p.catalog) || MeishiCatalog.emptyCatalog();
    if (!hasSavedCatalog(raw)) {
      p.catalog = MeishiCatalog.mergeCatalog(
        MeishiCatalog.buildCatalogFromRecords(_records, key),
        MeishiCatalog.emptyCatalog()
      );
    }
    if (p.url && (!p.catalog.urls || !p.catalog.urls.length)) {
      p.catalog.urls = MeishiFields.uniq([p.url].concat(p.catalog.urls || []));
    }
    return p;
  }

  function getCompanyProfile(company) {
    var p = getCompanyProfileForEdit(company);
    p.catalog = MeishiCatalog.mergeCatalog(
      MeishiCatalog.buildCatalogFromRecords(_records, company),
      clone(p.catalog)
    );
    return p;
  }

  function applyCatalogMutations(company, mutations, catalogForLocations, opts) {
    opts = opts || {};
    if (!window.MeishiCatalogSync || !mutations || !mutations.length) return { changed: false, recCount: 0 };
    var key = MeishiFields.norm(company);
    if (!key) return { changed: false, recCount: 0 };
    if (!_config.deptSettings) _config.deptSettings = {};
    if (!_records || !Array.isArray(_records)) _records = [];
    var before = JSON.stringify(_records);
    var sync = MeishiCatalogSync.syncRecordsFromCatalog(
      key,
      catalogForLocations || null,
      mutations,
      _records,
      _config.deptSettings,
      { syncLocations: !!catalogForLocations, inPlace: true }
    );
    var changed = false;
    var recCount = 0;
    if (sync.recChanged) {
      if (JSON.stringify(_records) !== before) {
        recCount = countRecordDiff(before, _records);
      }
      persistRec();
      if (!opts.skipFireRec) fireRec();
      changed = true;
    }
    if (sync.deptChanged) {
      _config.deptSettings = sync.deptSettings;
      persistCfg();
      if (!opts.skipFireCfg) fireCfg();
      changed = true;
    }
    return { changed: changed, recCount: recCount };
  }

  function countRecordDiff(beforeJson, recs) {
    try {
      var old = JSON.parse(beforeJson);
      var n = 0;
      for (var i = 0; i < recs.length; i++) {
        if (JSON.stringify(old[i]) !== JSON.stringify(recs[i])) n++;
      }
      return n;
    } catch (e) {
      return recs.length;
    }
  }

  /** 会社共通カタログ変更を名刺データへ直接反映（確実版） */
  function directPatchRecordOp(company, op) {
    if (!op || !_records || !Array.isArray(_records)) return 0;
    var co = MeishiFields.norm(company);
    var n = 0;
    _records.forEach(function (r) {
      if (MeishiFields.norm(r.company) !== co) return;
      if (op.type === "renameAff1" && MeishiFields.norm(r.aff1) === MeishiFields.norm(op.from)) {
        r.aff1 = op.to; n++;
      } else if (op.type === "renameAff2" && MeishiFields.norm(r.aff2) === MeishiFields.norm(op.from)) {
        if (op.aff1 && MeishiFields.norm(r.aff1) !== MeishiFields.norm(op.aff1)) return;
        r.aff2 = op.to; n++;
      } else if (op.type === "renameAff3" && MeishiFields.norm(r.aff3) === MeishiFields.norm(op.from)) {
        if (op.aff1 && MeishiFields.norm(r.aff1) !== MeishiFields.norm(op.aff1)) return;
        if (op.aff2 && MeishiFields.norm(r.aff2) !== MeishiFields.norm(op.aff2)) return;
        r.aff3 = op.to; n++;
      } else if (op.type === "renameTitle" && MeishiFields.norm(r.title) === MeishiFields.norm(op.from)) {
        if (op.aff1 && MeishiFields.norm(r.aff1) !== MeishiFields.norm(op.aff1)) return;
        if (op.aff2 && MeishiFields.norm(r.aff2) !== MeishiFields.norm(op.aff2)) return;
        if (op.aff3 && MeishiFields.norm(r.aff3) !== MeishiFields.norm(op.aff3)) return;
        r.title = op.to; n++;
      } else if (op.type === "renameUrl" && MeishiFields.norm(r.url) === MeishiFields.norm(op.from)) {
        r.url = op.to; n++;
      } else if (op.type === "renameField" && MeishiFields.norm(r[op.field]) === MeishiFields.norm(op.from)) {
        r[op.field] = op.to; n++;
      }
    });
    return n;
  }

  function syncRecordsFromCatalogDiff(company, oldCatalog, newCatalog, explicitOp, opts) {
    opts = opts || {};
    if (!window.MeishiCatalogSync) return { changed: false, recCount: 0 };
    var directCount = 0;
    if (explicitOp && explicitOp.type && explicitOp.type.indexOf("rename") === 0) {
      directCount = directPatchRecordOp(company, explicitOp);
      if (directCount > 0) persistRec();
    }
    var muts = explicitOp ? [explicitOp] : [];
    muts = MeishiCatalogSync.mergeMutations(
      muts,
      MeishiCatalogSync.inferMutations(oldCatalog || MeishiCatalog.emptyCatalog(), newCatalog || MeishiCatalog.emptyCatalog())
    );
    if (!muts.length && !directCount) return { changed: false, recCount: 0 };
    var result = muts.length
      ? applyCatalogMutations(company, muts, newCatalog, opts)
      : { changed: directCount > 0, recCount: directCount };
    if (directCount > 0 && (!result.recCount || result.recCount < directCount)) {
      result.recCount = directCount;
      result.changed = true;
    }
    return result;
  }

  function saveCompanyProfile(company, profile, mutations) {
    var key = MeishiFields.norm(company);
    if (!key) throw new Error("会社名を指定してください");
    _config.companySettings = _config.companySettings || {};
    var out = {
      company: key,
      catalog: clone(profile.catalog) || MeishiCatalog.emptyCatalog(),
    };
    if (profile.layout && MeishiLayout.isValidLayout(profile.layout)) {
      out.layout = compactLayoutForStore(profile.layout);
    }
    if (profile.layoutBack && MeishiLayout.isValidBackLayout(profile.layoutBack)) {
      out.layoutBack = compactBackLayoutForStore(profile.layoutBack);
    }

    _config.companySettings[key] = out;

    if (window.MeishiCatalogSync && mutations && mutations.length) {
      applyCatalogMutations(key, mutations, out.catalog, { skipFireCfg: true });
    }

    persistCfg();
    void persistImageLibraryStore(getImageLibrary());
    fireCfg();
  }

  function normalizeDeptProfile(raw, company, aff1, aff2) {
    var out = {
      company: MeishiFields.norm(company),
      aff1: MeishiFields.norm(aff1),
      aff2: MeishiFields.norm(aff2 || ""),
      layout: null,
      layoutBack: null,
      images: [],
    };
    if (!raw || typeof raw !== "object") return out;
    var layout = null;
    if (raw.layout && MeishiLayout.isValidLayout(raw.layout)) {
      layout = compactLayoutForStore(raw.layout);
    } else {
      var imgs = (raw.images && raw.images.length) ? raw.images : [];
      if (imgs.length) {
        var shell = MeishiLayout.defLayout();
        MeishiLayout.ELS.forEach(function (e) {
          if (shell.el[e.id]) shell.el[e.id].hidden = true;
        });
        shell.images = imgs;
        layout = compactLayoutForStore(shell);
      }
    }
    if (layout) {
      out.layout = layout;
      out.images = clone(layout.images || []);
    }
    if (raw.layoutBack && MeishiLayout.isValidBackLayout(raw.layoutBack)) {
      out.layoutBack = compactBackLayoutForStore(raw.layoutBack);
    }
    return out;
  }

  function migrateDeptKeys() {
    var ds = _config.deptSettings || {};
    var nds = {};
    var changed = false;
    Object.keys(ds).forEach(function (k) {
      var parts = k.split("|");
      if (parts.length === 2) {
        var nk = MeishiFields.deptKey(parts[0], parts[1], "");
        nds[nk] = normalizeDeptProfile(ds[k], parts[0], parts[1], "");
        changed = true;
      } else nds[k] = ds[k];
    });
    if (changed) _config.deptSettings = nds;
  }

  var PREFERRED_COMPANY_ORDER = ["日新興業株式会社", "日新三井住建綜合プラント"];

  function sortCompaniesPreferred(list) {
    var head = [];
    var used = {};
    PREFERRED_COMPANY_ORDER.forEach(function (pref) {
      list.forEach(function (c) {
        if (!used[c] && MeishiFields.norm(c) === MeishiFields.norm(pref)) {
          head.push(c);
          used[c] = true;
        }
      });
    });
    return head.concat(list.filter(function (c) { return !used[c]; }).sort());
  }

  function getCompanyList() {
    var fromRec = MeishiFields.uniq(_records.map(function (r) { return r.company; }));
    var fromCfg = Object.keys(_config.companySettings || {});
    return sortCompaniesPreferred(MeishiFields.uniq(fromRec.concat(fromCfg)));
  }

  function getAff1List(company) {
    var p = getCompanyProfile(company);
    if (p.catalog.aff1 && p.catalog.aff1.length) return p.catalog.aff1.slice();
    return MeishiFields.uniq(_records.filter(function (r) {
      return MeishiFields.norm(r.company) === MeishiFields.norm(company);
    }).map(function (r) { return r.aff1; })).sort();
  }

  function renameCompany(oldName, newName) {
    var oldK = MeishiFields.norm(oldName);
    var newK = MeishiFields.norm(newName);
    if (!oldK || !newK) throw new Error("会社名を入力してください");
    if (oldK === newK) return;
    if ((_config.companySettings || {})[newK]) throw new Error("変更先の会社名は既に存在します");

    _records.forEach(function (r) {
      if (MeishiFields.norm(r.company) === oldK) r.company = newK;
    });

    var cs = _config.companySettings || {};
    if (cs[oldK]) {
      cs[newK] = clone(cs[oldK]);
      if (cs[newK]) cs[newK].company = newK;
      delete cs[oldK];
    }

    var ds = _config.deptSettings || {};
    var nds = {};
    Object.keys(ds).forEach(function (k) {
      var d = ds[k];
      if (MeishiFields.norm(d.company) === oldK) {
        d.company = newK;
        nds[MeishiFields.deptKey(newK, d.aff1, d.aff2)] = d;
      } else nds[k] = d;
    });
    _config.deptSettings = nds;
    persistRec();
    persistCfg();
    fireCfg();
    fireRec();
  }

  function deleteCompany(company) {
    var key = MeishiFields.norm(company);
    if (!key) return;
    if (_config.companySettings) delete _config.companySettings[key];
    var ds = _config.deptSettings || {};
    Object.keys(ds).forEach(function (k) {
      if (MeishiFields.norm(ds[k].company) === key) delete ds[k];
    });
    persistCfg();
    fireCfg();
  }

  function addCompany(company) {
    var key = MeishiFields.norm(company);
    if (!key) throw new Error("会社名を入力してください");
    saveCompanyProfile(key, MeishiCatalog.emptyCompanyProfile(key));
  }

  /** 名刺デザインの文字・配置のみ（images を除く）を他会社へ適用 */
  function layoutTextOnlyFrom(layout) {
    var base = MeishiCatalog.normalizeLayout(clone(layout));
    if (!base) base = MeishiLayout.defLayout();
    base.images = [];
    return base;
  }

  function backLayoutTextOnlyFrom(layoutBack) {
    var base = MeishiCatalog.normalizeBackLayout(clone(layoutBack));
    if (!base) base = MeishiLayout.defBackLayout();
    base.images = [];
    return base;
  }

  function loadDesignApplyUndo() {
    try {
      var s = localStorage.getItem(DESIGN_APPLY_UNDO_KEY);
      if (!s) return null;
      var v = JSON.parse(s);
      if (!v || typeof v !== "object" || !v.companies || typeof v.companies !== "object") return null;
      return v;
    } catch (e) {
      return null;
    }
  }

  function saveDesignApplyUndo(snap) {
    try {
      if (!snap) {
        localStorage.removeItem(DESIGN_APPLY_UNDO_KEY);
        return;
      }
      localStorage.setItem(DESIGN_APPLY_UNDO_KEY, JSON.stringify(snap));
    } catch (e) {
      console.warn("[Meishi] design apply undo save failed", e);
    }
  }

  function snapshotCompanyDesigns(keys) {
    var companies = {};
    (keys || []).forEach(function (key) {
      var k = MeishiFields.norm(key);
      if (!k) return;
      var existing = getCompanyProfileForEdit(k);
      companies[k] = {
        layout: existing.layout ? clone(existing.layout) : null,
        layoutBack: existing.layoutBack ? clone(existing.layoutBack) : null,
      };
    });
    return companies;
  }

  function hasDesignApplyUndo() {
    var u = loadDesignApplyUndo();
    return !!(u && u.companies && Object.keys(u.companies).length);
  }

  function getDesignApplyUndoInfo() {
    var u = loadDesignApplyUndo();
    if (!u || !u.companies) return null;
    return {
      at: u.at || 0,
      source: u.source || "",
      targets: Object.keys(u.companies),
    };
  }

  /**
   * sourceCompany の表・裏デザインから画像以外（文字位置・書式・裏面テキスト等）を
   * 指定した会社・団体へ適用する。各社の既存画像は残す。
   * 適用前デザインは取り消し用に保存する（targets 必須）。
   * @returns {{ ok: boolean, count: number, source: string, targets: string[] }}
   */
  function applyCompanyDesignTextOnly(sourceCompany, opts) {
    opts = opts || {};
    var srcKey = MeishiFields.norm(sourceCompany || "日新興業株式会社");
    if (!srcKey) throw new Error("元になる会社名を指定してください");
    var src = getCompanyProfileForEdit(srcKey);
    if (!src.layout || !MeishiLayout.isValidLayout(src.layout)) {
      throw new Error("「" + srcKey + "」に名刺デザイン（表）がありません。先に会社共通を保存してください。");
    }
    if (!Array.isArray(opts.targets) || !opts.targets.length) {
      throw new Error("適用先の会社・団体を1社以上選んでください");
    }
    var frontText = layoutTextOnlyFrom(src.layout);
    var backText =
      src.layoutBack && MeishiLayout.isValidBackLayout(src.layoutBack)
        ? backLayoutTextOnlyFrom(src.layoutBack)
        : MeishiLayout.defBackLayout();

    var targets = opts.targets.map(function (c) { return MeishiFields.norm(c); }).filter(function (c) {
      return c && c !== srcKey;
    });
    if (!targets.length) throw new Error("適用先の会社・団体を1社以上選んでください");

    saveDesignApplyUndo({
      at: Date.now(),
      source: srcKey,
      companies: snapshotCompanyDesigns(targets),
    });

    _config.companySettings = _config.companySettings || {};
    var applied = [];
    targets.forEach(function (key) {
      if (!key || key === srcKey) return;
      var existing = getCompanyProfileForEdit(key);
      var keepFrontImgs =
        existing.layout && Array.isArray(existing.layout.images) ? clone(existing.layout.images) : [];
      var keepBackImgs =
        existing.layoutBack && Array.isArray(existing.layoutBack.images)
          ? clone(existing.layoutBack.images)
          : [];
      var newLayout = layoutTextOnlyFrom(frontText);
      newLayout.images = keepFrontImgs || [];
      var newBack = backLayoutTextOnlyFrom(backText);
      newBack.images = keepBackImgs || [];
      _config.companySettings[key] = {
        company: key,
        catalog: clone(existing.catalog) || MeishiCatalog.emptyCatalog(),
        layout: compactLayoutForStore(newLayout),
        layoutBack: compactBackLayoutForStore(newBack),
      };
      applied.push(key);
    });
    if (applied.length) {
      persistCfg();
      fireCfg();
    }
    return { ok: true, count: applied.length, source: srcKey, targets: applied };
  }

  /**
   * 「日新興業のデザインを他社へ」の直前スナップショットへ戻す。
   * @returns {{ ok: boolean, count: number, targets: string[] }}
   */
  function undoCompanyDesignTextApply() {
    var u = loadDesignApplyUndo();
    if (!u || !u.companies || !Object.keys(u.companies).length) {
      throw new Error("取り消せる「デザイン適用」の記録がありません（ブラウザに残っていません）");
    }
    _config.companySettings = _config.companySettings || {};
    var restored = [];
    Object.keys(u.companies).forEach(function (key) {
      var snap = u.companies[key];
      if (!snap || typeof snap !== "object") return;
      var existing = getCompanyProfileForEdit(key);
      var layout = snap.layout && MeishiLayout.isValidLayout(snap.layout)
        ? MeishiCatalog.normalizeLayout(clone(snap.layout))
        : null;
      var layoutBack = snap.layoutBack && MeishiLayout.isValidBackLayout(snap.layoutBack)
        ? MeishiCatalog.normalizeBackLayout(clone(snap.layoutBack))
        : null;
      _config.companySettings[key] = {
        company: key,
        catalog: clone(existing.catalog) || MeishiCatalog.emptyCatalog(),
        layout: layout ? compactLayoutForStore(layout) : existing.layout || null,
        layoutBack: layoutBack ? compactBackLayoutForStore(layoutBack) : existing.layoutBack || null,
      };
      restored.push(key);
    });
    saveDesignApplyUndo(null);
    if (restored.length) {
      persistCfg();
      fireCfg();
    }
    return { ok: true, count: restored.length, targets: restored };
  }

  function getMergedRecords() {
    if (_mergedRecordsCache) return _mergedRecordsCache;
    var cs = {};
    var ds = _config.deptSettings || {};
    var companyCache = Object.create(null);
    _records.forEach(function (r) {
      var ck = MeishiFields.norm(r.company);
      if (!ck) return;
      if (!companyCache[ck]) {
        var p = getCompanyProfileForEdit(r.company);
        var cat = p.catalog || {};
        var loc = (cat.locations && cat.locations[0]) || {};
        companyCache[ck] = {
          url: (cat.urls && cat.urls[0]) || p.url || "",
          postal: loc.postal || p.postal || "",
          address: loc.address || p.address || "",
          tel: loc.tel || p.tel || "",
          fax: loc.fax || p.fax || "",
        };
      }
      cs[ck] = companyCache[ck];
    });
    _mergedRecordsCache = _records.map(function (r) {
      return MeishiFields.mergeRecord(r, cs, ds);
    });
    return _mergedRecordsCache;
  }

  function getDeptSettingsRaw(company, aff1, aff2) {
    var k = MeishiFields.deptKey(company, aff1, aff2);
    return normalizeDeptProfile((_config.deptSettings || {})[k], company, aff1, aff2);
  }

  function collectDeptImages(dept) {
    if (!dept) return [];
    if (dept.layout && dept.layout.images && dept.layout.images.length) return clone(dept.layout.images);
    if (dept.images && dept.images.length) return clone(dept.images);
    return [];
  }

  function mergeDeptSettings(base, over) {
    var imgs = collectDeptImages(base).concat(collectDeptImages(over));
    var out = normalizeDeptProfile(null, over.company || base.company, over.aff1 || base.aff1, over.aff2 || base.aff2);
    out.images = imgs;
    if (imgs.length) {
      out.layout = MeishiLayout.defLayout();
      MeishiLayout.ELS.forEach(function (e) {
        if (out.layout.el[e.id]) out.layout.el[e.id].hidden = true;
      });
      out.layout.images = clone(imgs);
    }
    return out;
  }

  /** 印刷・プレビュー用（所属1共通＋所属2個別を合成） */
  function getDeptSettings(company, aff1, aff2) {
    aff1 = MeishiFields.deptAff1Key(aff1);
    aff2 = MeishiFields.norm(aff2);
    var specific = getDeptSettingsRaw(company, aff1, aff2);
    if (!aff2) return specific;
    var common = getDeptSettingsRaw(company, aff1, "");
    return mergeDeptSettings(common, specific);
  }

  /** 所有者画面の編集用（保存キーそのもの） */
  function getDeptSettingsForEdit(company, aff1, aff2) {
    aff1 = MeishiFields.deptAff1Key(aff1);
    return getDeptSettingsRaw(company, aff1, aff2);
  }

  function saveDeptSettings(company, aff1, aff2, data) {
    aff1 = MeishiFields.deptAff1Key(aff1);
    var k = MeishiFields.deptKey(company, aff1, aff2);
    _config.deptSettings = _config.deptSettings || {};
    var out = {
      company: MeishiFields.norm(company),
      aff1: MeishiFields.norm(aff1),
      aff2: MeishiFields.norm(aff2 || ""),
      layout: null,
      images: [],
    };
    if (data && data.layout && MeishiLayout.isValidLayout(data.layout)) {
      out.layout = compactLayoutForStore(data.layout);
      out.images = clone(out.layout.images || []);
    }
    if (data && data.layoutBack && MeishiLayout.isValidBackLayout(data.layoutBack)) {
      out.layoutBack = compactBackLayoutForStore(data.layoutBack);
    }
    _config.deptSettings[k] = out;
    var ok = persistCfg();
    void persistImageLibraryStore(getImageLibrary());
    if (!ok) return false;
    fireCfg();
    return true;
  }

  function getDeptLayout(company, aff1, aff2) {
    var dept = getDeptSettings(company, aff1, aff2);
    if (dept.layout && MeishiLayout.isValidLayout(dept.layout)) return MeishiCatalog.normalizeLayout(clone(dept.layout));
    return null;
  }

  function getAff2ListForDept(company, aff1) {
    return MeishiCatalog.getAff2List(getCompanyProfile(company).catalog, aff1);
  }

  function getCompanyLayout(company) {
    var p = getCompanyProfileForEdit(company);
    if (p.layout && MeishiLayout.isValidLayout(p.layout)) return MeishiCatalog.normalizeLayout(clone(p.layout));
    var std = _config.defaultLayout;
    return std && MeishiLayout.isValidLayout(std) ? MeishiCatalog.normalizeLayout(clone(std)) : MeishiLayout.defLayout();
  }

  function getPrintImages(company, aff1, aff2, personalImages) {
    var layout = getCompanyLayout(company);
    var imgs = (layout.images || []).slice();
    var dept = getDeptSettings(company, aff1, aff2);
    var dLayout = dept.layout;
    if (dLayout && dLayout.images) imgs = imgs.concat(dLayout.images);
    else if (dept.images) imgs = imgs.concat(dept.images);
    if (personalImages && personalImages.length && window.MeishiImageLib) {
      imgs = imgs.concat(MeishiImageLib.resolveImages(personalImages));
    } else if (personalImages && personalImages.length) {
      imgs = imgs.concat(clone(personalImages));
    }
    if (window.MeishiImageLib) imgs = MeishiImageLib.resolveImages(imgs);
    return imgs.filter(function (im) { return im && im.src; });
  }

  function getEffectiveLayout(company, aff1, aff2) {
    var base = getCompanyLayout(company);
    var dept = getDeptLayout(company, aff1, aff2);
    if (!dept) return base;
    var merged = MeishiLayout.clone(base);
    if (dept.images && dept.images.length) merged.images = (merged.images || []).concat(MeishiLayout.clone(dept.images));
    if (dept.texts && dept.texts.length) merged.texts = (merged.texts || []).concat(MeishiLayout.clone(dept.texts));
    return MeishiCatalog.normalizeLayout(merged);
  }

  function getCompanyLayoutBack(company) {
    var p = getCompanyProfileForEdit(company);
    if (p.layoutBack && MeishiLayout.isValidBackLayout(p.layoutBack)) {
      return MeishiCatalog.normalizeBackLayout(clone(p.layoutBack));
    }
    return MeishiLayout.defBackLayout();
  }

  function getDeptLayoutBack(company, aff1, aff2) {
    var dept = getDeptSettings(company, aff1, aff2);
    if (dept.layoutBack && MeishiLayout.isValidBackLayout(dept.layoutBack)) {
      return MeishiCatalog.normalizeBackLayout(clone(dept.layoutBack));
    }
    return null;
  }

  function getEffectiveBackLayout(company, aff1, aff2) {
    var base = getCompanyLayoutBack(company);
    var dept = getDeptLayoutBack(company, aff1, aff2);
    var merged = MeishiLayout.clone(base);
    if (dept) {
      if (dept.texts && dept.texts.length) {
        merged.texts = (merged.texts || []).concat(MeishiLayout.clone(dept.texts));
      }
      if (dept.images && dept.images.length) {
        merged.images = (merged.images || []).concat(MeishiLayout.clone(dept.images));
      }
    }
    return MeishiCatalog.normalizeBackLayout(merged);
  }

  function resolveBackLayoutImages(layout) {
    var imgs = (layout && layout.images) ? layout.images.slice() : [];
    if (window.MeishiImageLib) imgs = MeishiImageLib.resolveImages(imgs);
    return imgs.filter(function (im) { return im && (im.src || im.path || im.libId); });
  }

  function nextRecordNo() {
    var max = 0;
    _records.forEach(function (r) {
      var n = parseInt(String(r.no || "").replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return String(max + 1);
  }

  function findRecordByNo(no) {
    no = MeishiFields.norm(no);
    for (var i = 0; i < _records.length; i++) {
      if (MeishiFields.norm(_records[i].no) === no) return i;
    }
    return -1;
  }

  async function initFirebase() {
    var cfg = window.MEISHI_FIREBASE_CONFIG;
    if (!(cfg && cfg.databaseURL) || typeof window.firebase === "undefined") return;
    try {
      if (window.firebase.apps && window.firebase.apps.length) _fbDb = window.firebase.app().database();
      else { window.firebase.initializeApp(cfg); _fbDb = window.firebase.database(); }
      _useFirebase = true;
    } catch (e) { return; }

    await ensureFirebaseAuth();

    // 軽量パスのみ待機。巨大な画像ライブラリは待たない（ローカル表示→裏同期）
    var settled = await Promise.all([
      loadAuthFromFirebase().catch(function (e) {
        console.warn("[Meishi] auth load failed", e);
      }),
      safeFbOnce(FB_REC_PATH),
      safeFbOnce(FB_CFG_PATH),
      safeFbOnce(FB_PREVIEW_PERSONAL_PATH),
      safeFbOnce(FB_PREVIEW_KOJI_PATH),
    ]);
    var snapRec = settled[1];
    var snapCfg = settled[2];
    var snapPv = settled[3];
    var snapKoji = settled[4];

    try {
      var rv = snapRec && snapRec.val();
      if (rv && Array.isArray(rv) && rv.length) {
        var localRec = loadLocalRec();
        if (shouldPreferRemoteData() || !localRec || !localRec.length || shouldUpgradeRecordsFromRemote(localRec, rv)) {
          _records = rv;
          _mergedRecordsCache = null;
          try { localStorage.setItem(REC_KEY, JSON.stringify(_records)); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("[Meishi] Firebase records apply failed", e);
    }

    try {
      var v = snapCfg && snapCfg.val();
      if (v && typeof v === "object") {
        mergeConfigFromRemote(v);
        try { localStorage.setItem(CFG_KEY, JSON.stringify(configForMainStorage())); } catch (e) {}
      }
    } catch (e) {
      console.warn("[Meishi] Firebase config apply failed（hh_data/meishi_config）", e);
    }

    // 設定マージ後、画像が消えていればローカルから復帰（リモート画像の完了は待たない）
    if (!getImageLibrary().length) {
      try { await applyLocalImageLibrary(); } catch (e) {}
    }

    try {
      var remotePv = snapPv ? snapPv.val() : null;
      await applyPreviewPersonalWithRemote(remotePv);
    } catch (e) {
      console.warn("[Meishi] Firebase preview personal apply failed", e);
    }

    try {
      var remoteKoji = snapKoji ? snapKoji.val() : null;
      if (remoteKoji && typeof remoteKoji === "object") {
        if (shouldPreferRemoteData() || !Object.keys(_previewKoji || {}).length) {
          _previewKoji = remoteKoji;
          try { localStorage.setItem(PREVIEW_KOJI_KEY, JSON.stringify(_previewKoji)); } catch (e) {}
        } else {
          Object.keys(remoteKoji).forEach(function (k) {
            if (!_previewKoji[k] && remoteKoji[k]) _previewKoji[k] = remoteKoji[k];
          });
          try { localStorage.setItem(PREVIEW_KOJI_KEY, JSON.stringify(_previewKoji)); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("[Meishi] Firebase preview koji apply failed", e);
    }

    try { _fbDb.ref(FB_CFG_PATH + "/imageLibrary").remove(); } catch (e) {}

    try {
      _fbDb.ref(FB_AUTH_PATH).on("value", function (snap) {
        if (_suppressCfgRemote) return;
        if (applyAuthFromRemote(snap.val())) {
          try { localStorage.setItem(CFG_KEY, JSON.stringify(configForMainStorage())); } catch (e) {}
          fireCfg();
        }
      });
    } catch (e) {}
    try {
      _fbDb.ref(FB_CFG_PATH).on("value", function (snap) {
        if (_suppressCfgRemote) return;
        var val = snap.val();
        if (val && typeof val === "object") {
          mergeConfigFromRemote(val);
          try { localStorage.setItem(CFG_KEY, JSON.stringify(configForMainStorage())); } catch (e) {}
          fireCfg();
        }
      });
    } catch (e) {}
    try {
      _fbDb.ref(FB_REC_PATH).on("value", function (snap) {
        if (_suppressRecRemote) return;
        var v2 = snap.val();
        if (v2 && Array.isArray(v2)) {
          _records = v2;
          _mergedRecordsCache = null;
          try { localStorage.setItem(REC_KEY, JSON.stringify(_records)); } catch (e) {}
          fireRec();
        }
      });
    } catch (e) {}
    try {
      _fbDb.ref(FB_IMG_LIB_PATH).on("value", function (snap) {
        if (_suppressImgLibRemote) return;
        var val = snap.val();
        // リモート空でも起動フルアップロードしない（以前は毎回6秒以上かかっていた）
        if (!val || !val.length) {
          if (!getImageLibrary().length) {
            void applyLocalImageLibrary().then(function () { fireCfg(); });
          }
          return;
        }
        void applyImageLibraryWithRemote(val).then(function () { fireCfg(); });
      });
    } catch (e) {}

    try {
      _fbDb.ref(FB_PREVIEW_KOJI_PATH).on("value", function (snap) {
        if (_suppressKojiRemote) return;
        var val = snap.val();
        if (val && typeof val === "object") {
          _previewKoji = val;
          try { localStorage.setItem(PREVIEW_KOJI_KEY, JSON.stringify(_previewKoji)); } catch (e) {}
        }
      });
    } catch (e) {}

    // ローカルに画像が無く、使用者画面などリモート必須のときだけ初回取得を待機
    if (!getImageLibrary().length && shouldPreferRemoteData()) {
      try {
        var snapImg = await safeFbOnce(FB_IMG_LIB_PATH);
        await applyImageLibraryWithRemote(snapImg ? snapImg.val() : null);
      } catch (e) {
        console.warn("[Meishi] Firebase image library initial load failed", e);
      }
    }
  }

  async function init() {
    _ready = false;
    _fbAuthLoaded = false;
    stripLegacyImageLibraryFromLocalConfig();
    var local = loadLocalCfg();
    var localAuth = null;
    if (local) {
      localAuth = {
        ownerId: local.ownerId,
        ownerPass: local.ownerPass,
        title: local.title,
      };
      delete local.ownerId;
      delete local.ownerPass;
      _config = Object.assign({}, _config, local);
    }
    if (!_config.companySettings) _config.companySettings = {};
    if (!_config.deptSettings) _config.deptSettings = {};
    delete _config.imageLibrary;
    _config.imageLibrary = [];
    try { await loadRecords(); }
    catch (e) {
      var msg = (e && e.message) || String(e);
      if (String(msg).indexOf("Failed to fetch") !== -1 || (e && e.name === "TypeError")) {
        throw new Error(
          "名刺データを読み込めませんでした（Failed to fetch）。\n\n" +
            "・start.bat で Python サーバーを起動し、http://127.0.0.1:8791/ から開いているか確認してください。\n" +
            "・owner.html / user.html を直接開く場合は data/meishi-records.js があるか確認してください。"
        );
      }
      throw new Error("名刺データを読み込めませんでした。\n" + msg);
    }
    // ローカル画像を先に載せ、UI はすぐ開けるようにする
    await bootstrapLocalImageLibrary();
    applyLocalPreviewKoji();
    await initFirebase();
    if (localAuth && String(localAuth.ownerId || "").trim()) {
      var localOid = String(localAuth.ownerId).trim();
      var remoteOid = String(_config.ownerId || "").trim();
      var preferLocal =
        !_fbAuthLoaded ||
        (window.MEISHI_OWNER_PAGE && localOid && localOid !== remoteOid);
      if (preferLocal) applyAuthFromRemote(localAuth);
    }
    if (_useFirebase && String(_config.ownerId || "").trim()) {
      await persistAuthRemote();
    }
    if (_useFirebase && !_fbAuthLoaded) {
      _config.ownerId = "";
      _config.ownerPass = "";
    }
    await publishOwnerSnapshotToRemote();
    migrateDeptKeys();
    _ready = true;
  }

  function isValidLayout(v) { return MeishiLayout.isValidLayout(v); }

  function getImageLibrary() {
    var raw = _config.imageLibrary;
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeLibraryItem).filter(Boolean);
  }

  async function setImageLibrary(arr) {
    var ok = await persistImageLibraryStore(arr || []);
    fireCfg();
    return ok;
  }

  function previewPersonalKey(recordNo) {
    return String(recordNo == null ? "" : recordNo).trim();
  }

  function getPreviewPersonalImages(recordNo) {
    var k = previewPersonalKey(recordNo);
    if (!k || !_previewPersonal[k]) return [];
    return clone(_previewPersonal[k]) || [];
  }

  async function savePreviewPersonalImages(recordNo, images) {
    var k = previewPersonalKey(recordNo);
    if (!k) return false;
    _previewPersonal[k] = clone(images) || [];
    return persistPreviewPersonalStore();
  }

  function loadLocalPreviewKoji() {
    try {
      var raw = localStorage.getItem(PREVIEW_KOJI_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function persistPreviewKojiStore() {
    try { localStorage.setItem(PREVIEW_KOJI_KEY, JSON.stringify(_previewKoji || {})); } catch (e) {}
    if (_useFirebase && _fbDb && !_suppress) {
      _suppressKojiRemote = true;
      if (_suppressKojiRemoteTimer) clearTimeout(_suppressKojiRemoteTimer);
      _suppressKojiRemoteTimer = setTimeout(function () { _suppressKojiRemote = false; }, 8000);
      try { _fbDb.ref(FB_PREVIEW_KOJI_PATH).set(_previewKoji || {}); } catch (e) {}
    }
    return true;
  }

  function getPreviewKoji(recordNo) {
    var k = previewPersonalKey(recordNo);
    if (!k) return "";
    return String((_previewKoji && _previewKoji[k]) || "").trim();
  }

  function savePreviewKoji(recordNo, text) {
    var k = previewPersonalKey(recordNo);
    if (!k) return false;
    var v = String(text || "").trim();
    if (!_previewKoji || typeof _previewKoji !== "object") _previewKoji = {};
    if (v) _previewKoji[k] = v;
    else delete _previewKoji[k];
    return persistPreviewKojiStore();
  }

  async function addToImageLibrary(items) {
    var lib = getImageLibrary();
    var seenPath = {};
    var seenId = {};
    lib.forEach(function (x) {
      if (x.path) seenPath[x.path] = true;
      seenId[x.id] = true;
    });
    var added = 0;
    (items || []).forEach(function (item) {
      var n = normalizeLibraryItem(item);
      if (!n || seenId[n.id]) return;
      if (n.path && seenPath[n.path]) return;
      lib.push(n);
      seenId[n.id] = true;
      if (n.path) seenPath[n.path] = true;
      added++;
    });
    if (added) await setImageLibrary(lib);
    return added;
  }

  async function removeFromImageLibrary(idOrPath) {
    var key = String(idOrPath || "");
    await setImageLibrary(getImageLibrary().filter(function (x) {
      return x.id !== key && x.path !== key && x.file !== key;
    }));
  }

  window.MeishiStore = {
    init: init,
    getRecords: function () { return clone(_records) || []; },
    getMergedRecords: getMergedRecords,
    saveRecords: function (arr) { _records = clone(arr); persistRec(); fireRec(); },
    updateRecord: function (index, rec) {
      if (index < 0 || index >= _records.length) return;
      _records[index] = Object.assign({}, MeishiFields.emptyRecord(), rec);
      persistRec(); fireRec();
    },
    addRecord: function (rec) { _records.push(Object.assign({}, MeishiFields.emptyRecord(), rec || {})); persistRec(); fireRec(); },
    deleteRecord: function (index) { if (index >= 0 && index < _records.length) { _records.splice(index, 1); persistRec(); fireRec(); } },
    resetRecordsFromSeed: async function () { _records = await loadSeedRecords(); persistRec(); fireRec(); },
    findRecordByNo: findRecordByNo,
    nextRecordNo: nextRecordNo,
    getConfig: function () { return clone(_config); },
    saveConfig: function (obj) { _config = Object.assign({}, _config, obj || {}); persistCfg(); fireCfg(); },
    saveConfigAsync: async function (obj) {
      _config = Object.assign({}, _config, obj || {});
      var localOk = persistCfg();
      var authOk = await persistAuthRemote();
      fireCfg();
      return { localOk: localOk, authOk: authOk };
    },
    getImageLibrary: getImageLibrary,
    setImageLibrary: setImageLibrary,
    addToImageLibrary: addToImageLibrary,
    removeFromImageLibrary: removeFromImageLibrary,
    getPreviewPersonalImages: getPreviewPersonalImages,
    savePreviewPersonalImages: savePreviewPersonalImages,
    getPreviewKoji: getPreviewKoji,
    savePreviewKoji: savePreviewKoji,
    getCompanyProfile: getCompanyProfile,
    getCompanyProfileForEdit: getCompanyProfileForEdit,
    saveCompanyProfile: saveCompanyProfile,
    applyCatalogMutations: applyCatalogMutations,
    syncRecordsFromCatalogDiff: syncRecordsFromCatalogDiff,
    getCompanySettings: getCompanyProfile,
    saveCompanySettings: function (co, data) {
      var p = getCompanyProfile(co);
      Object.assign(p, data || {});
      saveCompanyProfile(co, p);
    },
    renameCompany: renameCompany,
    deleteCompany: deleteCompany,
    addCompany: addCompany,
    applyCompanyDesignTextOnly: applyCompanyDesignTextOnly,
    undoCompanyDesignTextApply: undoCompanyDesignTextApply,
    hasDesignApplyUndo: hasDesignApplyUndo,
    getDesignApplyUndoInfo: getDesignApplyUndoInfo,
    getDeptSettings: getDeptSettings,
    getDeptSettingsForEdit: getDeptSettingsForEdit,
    saveDeptSettings: saveDeptSettings,
    getCompanyList: getCompanyList,
    getAff1List: getAff1List,
    getAff2List: getAff2ListForDept,
    getCompanyLayout: getCompanyLayout,
    getCompanyLayoutBack: getCompanyLayoutBack,
    getDeptLayout: getDeptLayout,
    getDeptLayoutBack: getDeptLayoutBack,
    getEffectiveLayout: getEffectiveLayout,
    getEffectiveBackLayout: getEffectiveBackLayout,
    resolveBackLayoutImages: resolveBackLayoutImages,
    getPrintImages: getPrintImages,
    getDefaultLayout: function () {
      var v = _config.defaultLayout;
      return isValidLayout(v) ? MeishiCatalog.normalizeLayout(clone(v)) : null;
    },
    saveDefaultLayout: function (layout) {
      if (!isValidLayout(layout)) throw new Error("無効なレイアウト");
      this.saveConfig({ defaultLayout: MeishiCatalog.normalizeLayout(clone(layout)) });
    },
    clearDefaultLayout: function () {
      var c = Object.assign({}, _config);
      delete c.defaultLayout;
      _config = c;
      persistCfg();
      fireCfg();
    },
    useFirebase: function () { return _useFirebase; },
    firebaseConfigLoaded: function () { return _fbCfgLoaded; },
    firebaseAuthLoaded: function () { return _fbAuthLoaded; },
    refreshAuthFromFirebase: loadAuthFromFirebase,
    syncAllToRemote: syncAllToRemote,
    recoverImageLibrary: recoverImageLibrary,
    verifyUserLogin: verifyUserLogin,
    onConfigChange: function (cb) { if (typeof cb === "function") _cfgListeners.push(cb); },
    onRecordsChange: function (cb) { if (typeof cb === "function") _recListeners.push(cb); },
    userUrl: function () { return sharePageUrl("user.html"); },
    ownerUrl: function () { return sharePageUrl("owner.html"); },
    get ready() { return _ready; },
  };
})();
