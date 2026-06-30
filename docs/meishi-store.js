/**
 * 名刺印刷ソフト データ層 v4
 */
(function () {
  const CFG_KEY = "meishi_config_v1";
  const REC_KEY = "meishi_records_v1";
  const IMG_LIB_KEY = "meishi_image_library_v1";
  const PREVIEW_PERSONAL_KEY = "meishi_preview_personal_v1";
  const FB_CFG_PATH = "meishi_config";
  const FB_REC_PATH = "meishi_records";
  const FB_IMG_LIB_PATH = "meishi_image_library";
  const FB_PREVIEW_PERSONAL_PATH = "meishi_preview_personal";

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
  let _suppress = false;
  let _suppressRecRemote = false;
  let _suppressRecRemoteTimer = null;
  let _suppressCfgRemote = false;
  let _suppressCfgRemoteTimer = null;
  let _cfgListeners = [];
  let _recListeners = [];
  let _previewPersonal = {};
  let _suppressImgLibRemote = false;
  let _suppressImgLibRemoteTimer = null;
  const IDB_NAME = "meishi_app_v1";
  const IDB_STORE = "kv";
  const IDB_IMG_LIB = "imageLibrary";
  const IDB_PREVIEW_PERSONAL = "previewPersonal";

  function fireCfg() { _cfgListeners.forEach(function (cb) { try { cb(getConfig()); } catch (e) {} }); }
  function fireRec() { _recListeners.forEach(function (cb) { try { cb(getRecords()); } catch (e) {} }); }

  function assetUrl(relPath) {
    var rel = String(relPath || "").replace(/^\//, "");
    var path = window.location.pathname || "/";
    var dir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
    if (dir === "") dir = "/";
    return window.location.origin + dir + rel;
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
      if (c && c.imageLibrary) {
        delete c.imageLibrary;
        localStorage.setItem(CFG_KEY, JSON.stringify(c));
      }
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

  async function loadImageLibraryFromStorage() {
    var sync = loadLocalImageLibrarySync();
    if (sync === "__idb__") {
      try {
        var idbVal = await idbGet(IDB_IMG_LIB);
        return Array.isArray(idbVal) ? idbVal : [];
      } catch (e) {
        return [];
      }
    }
    if (sync !== undefined) return sync;
    return undefined;
  }

  async function saveImageLibraryToStorage(arr) {
    var data = (arr || []).map(normalizeLibraryItem).filter(Boolean);
    var json = JSON.stringify(data);
    try {
      localStorage.setItem(IMG_LIB_KEY, json);
      try { await idbSet(IDB_IMG_LIB, data); } catch (e2) {}
      return true;
    } catch (e) {
      try {
        await idbSet(IDB_IMG_LIB, data);
        localStorage.setItem(IMG_LIB_KEY, JSON.stringify({ __idb: 1 }));
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
    return (arr || []).filter(function (x) {
      var src = String(x && x.src || "");
      return src.indexOf("data:") !== 0;
    }).map(normalizeLibraryItem).filter(Boolean);
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
      try { _fbDb.ref(FB_IMG_LIB_PATH).set(imageLibraryForRemote(arr)); } catch (e) {}
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

  async function syncImageLibraryFromRemoteOnce(remoteLib) {
    if (hasLocalImageLibrarySaved()) return;
    var arr = Array.isArray(remoteLib) ? remoteLib.map(normalizeLibraryItem).filter(Boolean) : [];
    _config.imageLibrary = arr;
    await persistImageLibraryStore(arr);
  }

  function mergeDeptSettingsEntry(lv, rv) {
    if (!lv || typeof lv !== "object") {
      return normalizeDeptProfile(clone(rv), rv.company, rv.aff1, rv.aff2);
    }
    // 端末で編集・保存した部署設定を優先（リモートの空 layout で上書きしない）
    return normalizeDeptProfile(clone(lv), lv.company || rv.company, lv.aff1 || rv.aff1, lv.aff2 != null ? lv.aff2 : (rv.aff2 || ""));
  }

  function mergeSettingsMaps(localMap, remoteMap) {
    localMap = localMap && typeof localMap === "object" ? localMap : {};
    remoteMap = remoteMap && typeof remoteMap === "object" ? remoteMap : {};
    var out = clone(localMap) || {};
    Object.keys(remoteMap).forEach(function (k) {
      var rv = remoteMap[k];
      var lv = out[k];
      if (rv && typeof rv === "object" && lv && typeof lv === "object") {
        if (k.indexOf("|") >= 0) out[k] = mergeDeptSettingsEntry(lv, rv);
        else {
          out[k] = Object.assign({}, lv, rv);
          if (lv.layout && MeishiLayout.isValidLayout(lv.layout) && !(rv.layout && MeishiLayout.isValidLayout(rv.layout))) {
            out[k].layout = clone(lv.layout);
          }
        }
      } else {
        out[k] = clone(rv);
      }
    });
    return out;
  }

  function mergeConfigFromRemote(v) {
    if (!v || typeof v !== "object") return;
    var localCo = _config.companySettings || {};
    var localDept = _config.deptSettings || {};
    _config = Object.assign({}, _config, v);
    if (!_config.companySettings) _config.companySettings = {};
    if (!_config.deptSettings) _config.deptSettings = {};
    if (v.companySettings && typeof v.companySettings === "object") {
      _config.companySettings = mergeSettingsMaps(localCo, v.companySettings);
    }
    if (v.deptSettings && typeof v.deptSettings === "object") {
      _config.deptSettings = mergeSettingsMaps(localDept, v.deptSettings);
    }
    delete _config.imageLibrary;
    void applyLocalImageLibrary();
  }

  function findLibraryPathForImage(im) {
    var lib = getImageLibrary();
    if (!im || !lib.length) return "";
    var src = String(im.src || "");
    var path = String(im.path || "").replace(/^\//, "");
    var file = String(im.file || "").replace(/^images\//, "").replace(/^\//, "");
    var libId = im.libId || im.id;
    for (var i = 0; i < lib.length; i++) {
      var x = lib[i];
      if (!x) continue;
      var xp = String(x.path || "").replace(/^\//, "");
      var xf = String(x.file || "").replace(/^images\//, "").replace(/^\//, "");
      if (!xp && xf) xp = "images/" + xf;
      if (libId && x.id === libId) return xp;
      if (path && (xp === path || ("images/" + xf) === path)) return xp;
      if (file && xf === file) return xp;
      if (src && x.src && src === x.src) return xp;
      if (src && xp && src.indexOf(xp) >= 0) return xp;
    }
    return "";
  }

  function normalizeLayoutImageForStore(im) {
    if (!im) return null;
    var o = clone(im);
    var libPath = findLibraryPathForImage(o);
    if (libPath) o.path = libPath.replace(/^\//, "");
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
    if (!o.src) return null;
    return o;
  }

  function compactLayoutForStore(layout) {
    var l = MeishiCatalog.normalizeLayout(clone(layout));
    if (!l || !l.el) return l;
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
      try { _fbDb.ref(FB_CFG_PATH).set(payload); } catch (e) {}
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
    var seed = await loadSeedRecords();
    var local = loadLocalRec();
    _records = (local && local.length) ? local : seed;
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

    _config.companySettings[key] = out;

    if (window.MeishiCatalogSync && mutations && mutations.length) {
      applyCatalogMutations(key, mutations, out.catalog, { skipFireCfg: true });
    }

    persistCfg();
    fireCfg();
  }

  function normalizeDeptProfile(raw, company, aff1, aff2) {
    var out = {
      company: MeishiFields.norm(company),
      aff1: MeishiFields.norm(aff1),
      aff2: MeishiFields.norm(aff2 || ""),
      layout: null,
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

  function getMergedRecords() {
    var cs = {};
    var ds = _config.deptSettings || {};
    _records.forEach(function (r) {
      var p = getCompanyProfileForEdit(r.company);
      var cat = p.catalog || {};
      var loc = (cat.locations && cat.locations[0]) || {};
      cs[MeishiFields.norm(r.company)] = {
        url: (cat.urls && cat.urls[0]) || p.url || "",
        postal: loc.postal || p.postal || "",
        address: loc.address || p.address || "",
        tel: loc.tel || p.tel || "",
        fax: loc.fax || p.fax || "",
      };
    });
    return _records.map(function (r) {
      return MeishiFields.mergeRecord(r, cs, ds);
    });
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
    aff2 = MeishiFields.norm(aff2);
    var specific = getDeptSettingsRaw(company, aff1, aff2);
    if (!aff2) return specific;
    var common = getDeptSettingsRaw(company, aff1, "");
    return mergeDeptSettings(common, specific);
  }

  /** 所有者画面の編集用（保存キーそのもの） */
  function getDeptSettingsForEdit(company, aff1, aff2) {
    return getDeptSettingsRaw(company, aff1, aff2);
  }

  function saveDeptSettings(company, aff1, aff2, data) {
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
    _config.deptSettings[k] = out;
    var ok = persistCfg();
    if (!ok) return false;
    fireCfg();
    fireRec();
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
    return MeishiCatalog.normalizeLayout(merged);
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

    try {
      var snapRec = await _fbDb.ref(FB_REC_PATH).once("value");
      var rv = snapRec.val();
      if (rv && Array.isArray(rv) && rv.length) { _records = rv; try { localStorage.setItem(REC_KEY, JSON.stringify(_records)); } catch (e) {} }
    } catch (e) {}

    try {
      var snap = await _fbDb.ref(FB_CFG_PATH).once("value");
      var v = snap.val();
      if (v && typeof v === "object") {
        mergeConfigFromRemote(v);
        try { localStorage.setItem(CFG_KEY, JSON.stringify(configForMainStorage())); } catch (e) {}
      } else {
        _suppress = true;
        try { await _fbDb.ref(FB_CFG_PATH).set(configForMainStorage()); } catch (e) {}
        _suppress = false;
      }
    } catch (e) {}

    try {
      var snapImg = await _fbDb.ref(FB_IMG_LIB_PATH).once("value");
      await syncImageLibraryFromRemoteOnce(snapImg.val());
    } catch (e) {}

    try {
      if (!hasLocalPreviewPersonalSaved()) {
        var snapPv = await _fbDb.ref(FB_PREVIEW_PERSONAL_PATH).once("value");
        var remotePv = snapPv.val();
        if (remotePv && typeof remotePv === "object") {
          _previewPersonal = remotePv;
          await persistPreviewPersonalStore();
        }
      }
    } catch (e) {}

    await applyLocalImageLibrary();
    await applyLocalPreviewPersonal();

    try { _fbDb.ref(FB_CFG_PATH + "/imageLibrary").remove(); } catch (e) {}

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
        var v = snap.val();
        if (v && Array.isArray(v)) {
          _records = v;
          try { localStorage.setItem(REC_KEY, JSON.stringify(_records)); } catch (e) {}
          fireRec();
        }
      });
    } catch (e) {}
  }

  async function init() {
    _ready = false;
    stripLegacyImageLibraryFromLocalConfig();
    var local = loadLocalCfg();
    if (local) _config = Object.assign({}, _config, local);
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
    await initFirebase();
    await applyLocalImageLibrary();
    await applyLocalPreviewPersonal();
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
    getImageLibrary: getImageLibrary,
    setImageLibrary: setImageLibrary,
    addToImageLibrary: addToImageLibrary,
    removeFromImageLibrary: removeFromImageLibrary,
    getPreviewPersonalImages: getPreviewPersonalImages,
    savePreviewPersonalImages: savePreviewPersonalImages,
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
    getDeptSettings: getDeptSettings,
    getDeptSettingsForEdit: getDeptSettingsForEdit,
    saveDeptSettings: saveDeptSettings,
    getCompanyList: getCompanyList,
    getAff1List: getAff1List,
    getAff2List: getAff2ListForDept,
    getCompanyLayout: getCompanyLayout,
    getDeptLayout: getDeptLayout,
    getEffectiveLayout: getEffectiveLayout,
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
    onConfigChange: function (cb) { if (typeof cb === "function") _cfgListeners.push(cb); },
    onRecordsChange: function (cb) { if (typeof cb === "function") _recListeners.push(cb); },
    userUrl: function () { return publicPageUrl("user.html", { hash: "preview" }); },
    ownerUrl: function () { return publicPageUrl("owner.html", { hash: "preview" }); },
    get ready() { return _ready; },
  };
})();
