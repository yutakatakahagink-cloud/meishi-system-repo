/**
 * 会社マスタ（カタログ）・レイアウト正規化
 */
(function () {
  function emptyCatalog() {
    return {
      aff1: [],
      aff2: {},
      aff3: {},
      title: {},
      qual: {},
      mobile: {},
      email: {},
      names: [],
      postal: [],
      locations: [],
      urls: [],
      categories: [],
      notes: [],
    };
  }

  function emptyCompanyProfile(name) {
    return {
      company: name || "",
      catalog: emptyCatalog(),
      layout: null,
    };
  }

  function pathKey() {
    return Array.prototype.slice.call(arguments).map(function (v) {
      return v == null ? "" : String(v).trim();
    }).join("|");
  }

  function addUnique(arr, v) {
    v = v == null ? "" : String(v).trim();
    if (!v) return;
    if (arr.indexOf(v) < 0) arr.push(v);
  }

  function ensureList(obj, key) {
    if (!obj[key]) obj[key] = [];
    return obj[key];
  }

  function getListByPath(map, aff1, aff2, aff3, title) {
    var keys = [
      pathKey(aff1, aff2, aff3, title),
      pathKey(aff1, aff2, aff3),
      pathKey(aff1, aff2),
      pathKey(aff1),
      "*",
    ];
    for (var i = 0; i < keys.length; i++) {
      if (map && map[keys[i]] && map[keys[i]].length) return map[keys[i]];
    }
    return [];
  }

  function buildCatalogFromRecords(records, company) {
    var cat = emptyCatalog();
    var co = MeishiFields.norm(company);
    (records || []).forEach(function (r) {
      if (MeishiFields.norm(r.company) !== co) return;
      addUnique(cat.names, r.name);
      addUnique(cat.aff1, r.aff1);
      if (MeishiFields.norm(r.aff1)) addUnique(ensureList(cat.aff2, MeishiFields.norm(r.aff1)), r.aff2);
      var p2 = pathKey(r.aff1, r.aff2);
      if (p2 !== "|") addUnique(ensureList(cat.aff3, p2), r.aff3);
      var p3 = pathKey(r.aff1, r.aff2, r.aff3);
      if (p3 !== "||") addUnique(ensureList(cat.title, p3), r.title);
      if (p3 !== "||") {
        addUnique(ensureList(cat.qual, p3), r.qual);
        addUnique(ensureList(cat.mobile, p3), r.mobile);
        addUnique(ensureList(cat.email, p3), r.email);
      }
      addUnique(cat.postal, r.postal);
      addUnique(cat.urls, r.url);
      addUnique(cat.categories, r.category);
      addUnique(cat.notes, r.note);
      if (MeishiFields.norm(r.postal)) {
        var loc = cat.locations.find(function (x) { return x.postal === MeishiFields.norm(r.postal); });
        if (!loc) {
          cat.locations.push({
            postal: MeishiFields.norm(r.postal),
            address: MeishiFields.norm(r.address),
            tel: MeishiFields.norm(r.tel),
            fax: MeishiFields.norm(r.fax),
          });
        } else {
          if (r.address) loc.address = MeishiFields.norm(r.address);
          if (r.tel) loc.tel = MeishiFields.norm(r.tel);
          if (r.fax) loc.fax = MeishiFields.norm(r.fax);
        }
      }
    });
    cat.aff1.sort();
    cat.names.sort();
    return cat;
  }

  function mergeMapKeys(base, over) {
    var out = {};
    Object.keys(base || {}).concat(Object.keys(over || {})).forEach(function (k) {
      out[k] = MeishiFields.uniq((base[k] || []).concat((over || {})[k] || []));
    });
    return out;
  }

  function mergeCatalog(base, over) {
    var cat = emptyCatalog();
    var b = base || emptyCatalog();
    var o = over || emptyCatalog();
    cat.aff1 = MeishiFields.uniq((b.aff1 || []).concat(o.aff1 || [])).sort();
    cat.names = MeishiFields.uniq((b.names || []).concat(o.names || [])).sort();
    ["aff2", "aff3", "title", "qual", "mobile", "email"].forEach(function (k) {
      cat[k] = mergeMapKeys(b[k], o[k]);
    });
    cat.postal = MeishiFields.uniq((b.postal || []).concat(o.postal || []));
    cat.urls = MeishiFields.uniq((b.urls || []).concat(o.urls || []));
    cat.categories = MeishiFields.uniq((b.categories || []).concat(o.categories || []));
    cat.notes = MeishiFields.uniq((b.notes || []).concat(o.notes || []));
    var locMap = {};
    (b.locations || []).concat(o.locations || []).forEach(function (loc) {
      if (!loc || !loc.postal) return;
      locMap[loc.postal] = Object.assign({}, locMap[loc.postal] || {}, loc);
    });
    cat.locations = Object.keys(locMap).map(function (k) { return locMap[k]; });
    return cat;
  }

  function getAff2List(cat, aff1) { return (cat && cat.aff2 && cat.aff2[MeishiFields.norm(aff1)]) || []; }
  function getAff3List(cat, aff1, aff2) { return (cat && cat.aff3 && cat.aff3[pathKey(aff1, aff2)]) || []; }
  function getTitleList(cat, aff1, aff2, aff3) { return (cat && cat.title && cat.title[pathKey(aff1, aff2, aff3)]) || []; }
  function getQualList(cat, ctx) { return getListByPath(cat.qual, ctx.aff1, ctx.aff2, ctx.aff3, ctx.title); }
  function getMobileList(cat, ctx) { return getListByPath(cat.mobile, ctx.aff1, ctx.aff2, ctx.aff3, ctx.title); }
  function getEmailList(cat, ctx) { return getListByPath(cat.email, ctx.aff1, ctx.aff2, ctx.aff3, ctx.title); }

  function renameInList(arr, oldV, newV) {
    oldV = MeishiFields.norm(oldV);
    newV = MeishiFields.norm(newV);
    if (!oldV || !newV || oldV === newV) return;
    var i = -1;
    for (var j = 0; j < arr.length; j++) {
      if (MeishiFields.norm(arr[j]) === oldV) { i = j; break; }
    }
    if (i >= 0) arr[i] = newV;
    else addUnique(arr, newV);
  }

  function renameMapList(map, parentKey, oldV, newV) {
    parentKey = MeishiFields.norm(parentKey);
    var list = map[parentKey];
    if (!list) {
      Object.keys(map || {}).some(function (k) {
        if (MeishiFields.norm(k) !== parentKey) return false;
        list = map[k];
        parentKey = k;
        return true;
      });
    }
    if (!list) return;
    renameInList(list, oldV, newV);
  }

  function normalizeLayout(layout) {
    if (!layout || !layout.el) return MeishiLayout.defLayout();
    if (!Array.isArray(layout.images)) {
      layout.images = [];
      if (layout.img && (layout.img.src || layout.img.w)) {
        layout.images.push({
          id: "img1", src: layout.img.src || "",
          x: layout.img.x || 250, y: layout.img.y || 8, w: layout.img.w || 80, h: layout.img.h || 44,
        });
      }
    }
    if (!Array.isArray(layout.texts)) layout.texts = [];
    layout.texts = layout.texts.map(function (t, i) {
      if (!t || typeof t !== "object") return MeishiLayout.defTextBlock(i);
      if (!t.id) t.id = "txt" + Date.now() + i;
      if (t.content == null) t.content = "";
      if (typeof t.x !== "number") t.x = 20;
      if (typeof t.y !== "number") t.y = 20;
      if (typeof t.size !== "number") t.size = 12;
      if (!t.color) t.color = "#222222";
      if (t.bold == null) t.bold = 0;
      if (t.italic == null) t.italic = 0;
      if (t.underline == null) t.underline = 0;
      if (t.font == null) t.font = "";
      if (!t.align) t.align = "left";
      return t;
    });
    if (typeof layout.centerShiftMm !== "number" || isNaN(layout.centerShiftMm)) {
      layout.centerShiftMm = 5;
    }
    if (layout.centerDivider == null) layout.centerDivider = true;
    else layout.centerDivider = !!layout.centerDivider;
    var def = MeishiLayout.defLayout();
    MeishiLayout.ELS.forEach(function (e) {
      if (!layout.el[e.id]) {
        if (e.id === "title" && layout.el.aff) {
          layout.el.title = MeishiLayout.clone(layout.el.aff);
          layout.el.title.y = layout.el.aff.y + Math.max(11, Math.round((layout.el.aff.size || 9) * 1.25));
        } else {
          layout.el[e.id] = MeishiLayout.clone(def.el[e.id]);
        }
      }
      if (layout.el[e.id] && layout.el[e.id].font == null) layout.el[e.id].font = "";
    });
    return layout;
  }

  function normalizeBackLayout(layout) {
    if (!layout || typeof layout !== "object") return MeishiLayout.defBackLayout();
    if (!Array.isArray(layout.texts)) layout.texts = [];
    if (!Array.isArray(layout.images)) layout.images = [];
    layout.texts = layout.texts.map(function (t, i) {
      if (!t || typeof t !== "object") return MeishiLayout.defTextBlock(i);
      if (!t.id) t.id = "txt" + Date.now() + i;
      if (t.content == null) t.content = "";
      if (typeof t.x !== "number") t.x = 20;
      if (typeof t.y !== "number") t.y = 20;
      if (typeof t.size !== "number") t.size = 12;
      if (!t.color) t.color = "#222222";
      if (t.bold == null) t.bold = 0;
      if (t.italic == null) t.italic = 0;
      if (t.underline == null) t.underline = 0;
      if (t.font == null) t.font = "";
      if (!t.align) t.align = "left";
      return t;
    });
    if (typeof layout.centerShiftMm !== "number" || isNaN(layout.centerShiftMm)) {
      layout.centerShiftMm = 5;
    }
    if (layout.centerDivider == null) layout.centerDivider = false;
    else layout.centerDivider = !!layout.centerDivider;
    return layout;
  }

  function recordsEqual(a, b, skipNo) {
    return MeishiFields.COLUMNS.every(function (c) {
      if (skipNo && c.key === "no") return true;
      return MeishiFields.norm(a[c.key]) === MeishiFields.norm(b[c.key]);
    });
  }

  window.MeishiCatalog = {
    emptyCatalog: emptyCatalog,
    emptyCompanyProfile: emptyCompanyProfile,
    pathKey: pathKey,
    buildCatalogFromRecords: buildCatalogFromRecords,
    mergeCatalog: mergeCatalog,
    getAff2List: getAff2List,
    getAff3List: getAff3List,
    getTitleList: getTitleList,
    getQualList: getQualList,
    getMobileList: getMobileList,
    getEmailList: getEmailList,
    getListByPath: getListByPath,
    normalizeLayout: normalizeLayout,
    normalizeBackLayout: normalizeBackLayout,
    recordsEqual: recordsEqual,
    addUnique: addUnique,
    ensureList: ensureList,
    renameInList: renameInList,
    renameMapList: renameMapList,
  };
})();
