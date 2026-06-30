/**

 * 会社共通カタログ編集 → 名刺データ・部署共通の同期

 */

(function () {

  function norm(v) { return MeishiFields.norm(v); }

  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }



  function recordMatchesCo(r, co) {

    return norm(r.company) === norm(co);

  }



  function recordMatchesParts(r, parts) {

    if (!parts) return true;

    if (parts.aff1 && norm(r.aff1) !== norm(parts.aff1)) return false;

    if (parts.aff2 && norm(r.aff2) !== norm(parts.aff2)) return false;

    if (parts.aff3 && norm(r.aff3) !== norm(parts.aff3)) return false;

    if (parts.title && norm(r.title) !== norm(parts.title)) return false;

    return true;

  }



  function rekeyDept(deptSettings, matchFn, mapFn) {

    var nds = {};

    var changed = false;

    Object.keys(deptSettings).forEach(function (k) {

      var d = clone(deptSettings[k]);

      if (matchFn(d, k)) {

        d = mapFn(d) || d;

        var nk = MeishiFields.deptKey(d.company, d.aff1, d.aff2);

        nds[nk] = d;

        if (k !== nk) changed = true;

        else {

          var od = deptSettings[k];

          if (norm(d.aff1) !== norm(od.aff1) || norm(d.aff2) !== norm(od.aff2)) changed = true;

        }

      } else nds[k] = deptSettings[k];

    });

    return { deptSettings: nds, changed: changed };

  }



  function deleteDept(deptSettings, matchFn) {

    var nds = {};

    var changed = false;

    Object.keys(deptSettings).forEach(function (k) {

      if (matchFn(deptSettings[k], k)) changed = true;

      else nds[k] = deptSettings[k];

    });

    return { deptSettings: nds, changed: changed };

  }



  function applyRenameAff2(recs, co, m) {

    var n = 0;

    recs.forEach(function (r) {

      if (!recordMatchesCo(r, co) || norm(r.aff2) !== norm(m.from)) return;

      if (m.aff1 && norm(r.aff1) !== norm(m.aff1)) return;

      r.aff2 = m.to;

      n++;

    });

    return n > 0;

  }



  function syncRecordsFromCatalog(company, catalog, mutations, records, deptSettings, opts) {

    opts = opts || {};

    var co = norm(company);

    var recs = opts.inPlace ? records : clone(records);

    var ds = opts.inPlace ? deptSettings : clone(deptSettings);

    if (!recs) recs = [];

    if (!ds) ds = {};

    var recChanged = false;

    var deptChanged = false;



    (mutations || []).forEach(function (m) {

      if (m.type === "renameAff1") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff1) !== norm(m.from)) return;

          r.aff1 = m.to; recChanged = true;

        });

        var r1 = rekeyDept(ds, function (d) {

          return norm(d.company) === co && norm(d.aff1) === norm(m.from);

        }, function (d) { d.aff1 = m.to; return d; });

        ds = r1.deptSettings; deptChanged = r1.changed || deptChanged;

      } else if (m.type === "deleteAff1") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff1) !== norm(m.value)) return;

          r.aff1 = r.aff2 = r.aff3 = r.title = r.qual = "";

          recChanged = true;

        });

        var d1 = deleteDept(ds, function (d) {

          return norm(d.company) === co && norm(d.aff1) === norm(m.value);

        });

        ds = d1.deptSettings; deptChanged = d1.changed || deptChanged;

      } else if (m.type === "renameAff2") {

        if (applyRenameAff2(recs, co, m)) recChanged = true;

        var r2 = rekeyDept(ds, function (d) {

          return norm(d.company) === co && norm(d.aff1) === norm(m.aff1) && norm(d.aff2) === norm(m.from);

        }, function (d) { d.aff2 = m.to; return d; });

        ds = r2.deptSettings; deptChanged = r2.changed || deptChanged;

      } else if (m.type === "deleteAff2") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff2) !== norm(m.value)) return;

          if (m.aff1 && norm(r.aff1) !== norm(m.aff1)) return;

          r.aff2 = r.aff3 = r.title = r.qual = "";

          recChanged = true;

        });

        var d2 = deleteDept(ds, function (d) {

          return norm(d.company) === co && norm(d.aff1) === norm(m.aff1) && norm(d.aff2) === norm(m.value);

        });

        ds = d2.deptSettings; deptChanged = d2.changed || deptChanged;

      } else if (m.type === "renameAff3") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff1) !== norm(m.aff1) || norm(r.aff2) !== norm(m.aff2) || norm(r.aff3) !== norm(m.from)) return;

          r.aff3 = m.to; recChanged = true;

        });

      } else if (m.type === "deleteAff3") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff1) !== norm(m.aff1) || norm(r.aff2) !== norm(m.aff2) || norm(r.aff3) !== norm(m.value)) return;

          r.aff3 = r.title = r.qual = "";

          recChanged = true;

        });

      } else if (m.type === "renameTitle") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff1) !== norm(m.aff1) || norm(r.aff2) !== norm(m.aff2) || norm(r.aff3) !== norm(m.aff3) || norm(r.title) !== norm(m.from)) return;

          r.title = m.to; recChanged = true;

        });

      } else if (m.type === "deleteTitle") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.aff1) !== norm(m.aff1) || norm(r.aff2) !== norm(m.aff2) || norm(r.aff3) !== norm(m.aff3) || norm(r.title) !== norm(m.value)) return;

          r.title = r.qual = "";

          recChanged = true;

        });

      } else if (m.type === "renameField") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || !recordMatchesParts(r, m.parts)) return;

          if (norm(r[m.field]) === norm(m.from)) { r[m.field] = m.to; recChanged = true; }

        });

      } else if (m.type === "deleteField") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || !recordMatchesParts(r, m.parts)) return;

          if (norm(r[m.field]) === norm(m.value)) { r[m.field] = ""; recChanged = true; }

        });

      } else if (m.type === "renameUrl") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.url) !== norm(m.from)) return;

          r.url = m.to; recChanged = true;

        });

      } else if (m.type === "deleteUrl") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.url) !== norm(m.value)) return;

          r.url = ""; recChanged = true;

        });

      } else if (m.type === "updateLocation") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.postal) !== norm(m.oldPostal)) return;

          if (m.loc.postal) r.postal = m.loc.postal;

          if (m.loc.address != null) r.address = m.loc.address;

          if (m.loc.tel != null) r.tel = m.loc.tel;

          if (m.loc.fax != null) r.fax = m.loc.fax;

          recChanged = true;

        });

      } else if (m.type === "deleteLocation") {

        recs.forEach(function (r) {

          if (!recordMatchesCo(r, co) || norm(r.postal) !== norm(m.postal)) return;

          r.postal = r.address = r.tel = r.fax = "";

          recChanged = true;

        });

      }

    });



    (catalog && opts.syncLocations !== false ? (catalog.locations || []) : []).forEach(function (loc) {

      if (!loc || !loc.postal) return;

      recs.forEach(function (r) {

        if (!recordMatchesCo(r, co) || norm(r.postal) !== norm(loc.postal)) return;

        if (loc.address && norm(r.address) !== norm(loc.address)) { r.address = loc.address; recChanged = true; }

        if (loc.tel && norm(r.tel) !== norm(loc.tel)) { r.tel = loc.tel; recChanged = true; }

        if (loc.fax && norm(r.fax) !== norm(loc.fax)) { r.fax = loc.fax; recChanged = true; }

      });

    });



    return {

      records: recs,

      deptSettings: ds,

      recChanged: recChanged,

      deptChanged: deptChanged,

    };

  }



  function inferRenames(oldArr, newArr) {
    oldArr = oldArr || [];
    newArr = newArr || [];
    var removed = oldArr.filter(function (x) {
      return !newArr.some(function (y) { return norm(y) === norm(x); });
    });
    var added = newArr.filter(function (x) {
      return !oldArr.some(function (y) { return norm(y) === norm(x); });
    });
    if (removed.length === 1 && added.length === 1) {
      return [{ from: removed[0], to: added[0] }];
    }
    return [];
  }

  function inferDeletes(oldArr, newArr) {
    return (oldArr || []).filter(function (x) {
      return !(newArr || []).some(function (y) { return norm(y) === norm(x); });
    });
  }



  /** 保存前・編集後カタログ差分から変更を推定 */

  function inferMutations(oldCat, newCat) {

    var muts = [];

    oldCat = oldCat || MeishiCatalog.emptyCatalog();

    newCat = newCat || MeishiCatalog.emptyCatalog();



    inferRenames(oldCat.aff1, newCat.aff1).forEach(function (p) {

      muts.push({ type: "renameAff1", from: p.from, to: p.to });

    });

    inferDeletes(oldCat.aff1, newCat.aff1).forEach(function (v) {

      if ((newCat.aff1 || []).indexOf(v) < 0) muts.push({ type: "deleteAff1", value: v });

    });



    MeishiFields.uniq(Object.keys(oldCat.aff2 || {}).concat(Object.keys(newCat.aff2 || {}))).forEach(function (a1) {

      inferRenames((oldCat.aff2 || {})[a1], (newCat.aff2 || {})[a1]).forEach(function (p) {

        muts.push({ type: "renameAff2", aff1: a1, from: p.from, to: p.to });

      });

      inferDeletes((oldCat.aff2 || {})[a1], (newCat.aff2 || {})[a1]).forEach(function (v) {

        muts.push({ type: "deleteAff2", aff1: a1, value: v });

      });

    });



    MeishiFields.uniq(Object.keys(oldCat.aff3 || {}).concat(Object.keys(newCat.aff3 || {}))).forEach(function (pk) {

      var parts = pk.split("|");

      inferRenames((oldCat.aff3 || {})[pk], (newCat.aff3 || {})[pk]).forEach(function (p) {

        muts.push({ type: "renameAff3", aff1: parts[0] || "", aff2: parts[1] || "", from: p.from, to: p.to });

      });

      inferDeletes((oldCat.aff3 || {})[pk], (newCat.aff3 || {})[pk]).forEach(function (v) {

        muts.push({ type: "deleteAff3", aff1: parts[0] || "", aff2: parts[1] || "", value: v });

      });

    });



    MeishiFields.uniq(Object.keys(oldCat.title || {}).concat(Object.keys(newCat.title || {}))).forEach(function (pk) {

      var parts = pk.split("|");

      inferRenames((oldCat.title || {})[pk], (newCat.title || {})[pk]).forEach(function (p) {

        muts.push({ type: "renameTitle", aff1: parts[0] || "", aff2: parts[1] || "", aff3: parts[2] || "", from: p.from, to: p.to });

      });

      inferDeletes((oldCat.title || {})[pk], (newCat.title || {})[pk]).forEach(function (v) {

        muts.push({ type: "deleteTitle", aff1: parts[0] || "", aff2: parts[1] || "", aff3: parts[2] || "", value: v });

      });

    });



    inferRenames(oldCat.urls, newCat.urls).forEach(function (p) {

      muts.push({ type: "renameUrl", from: p.from, to: p.to });

    });

    inferDeletes(oldCat.urls, newCat.urls).forEach(function (v) {

      muts.push({ type: "deleteUrl", value: v });

    });



    (oldCat.locations || []).forEach(function (oldLoc) {

      if (!oldLoc || !oldLoc.postal) return;

      var newLoc = (newCat.locations || []).find(function (l) { return norm(l.postal) === norm(oldLoc.postal); });

      if (!newLoc) {

        muts.push({ type: "deleteLocation", postal: oldLoc.postal });

        return;

      }

      if (norm(oldLoc.address) !== norm(newLoc.address) || norm(oldLoc.tel) !== norm(newLoc.tel) || norm(oldLoc.fax) !== norm(newLoc.fax) || norm(oldLoc.postal) !== norm(newLoc.postal)) {

        muts.push({ type: "updateLocation", oldPostal: oldLoc.postal, loc: clone(newLoc) });

      }

    });

    (newCat.locations || []).forEach(function (newLoc) {

      if (!newLoc || !newLoc.postal) return;

      var oldLoc = (oldCat.locations || []).find(function (l) { return norm(l.postal) === norm(newLoc.postal); });

      if (!oldLoc) {

        muts.push({ type: "updateLocation", oldPostal: newLoc.postal, loc: clone(newLoc) });

      }

    });



    return muts;

  }



  function mutationKey(m) {

    return [m.type, m.aff1 || "", m.aff2 || "", m.aff3 || "", m.from || "", m.to || "", m.value || "", m.oldPostal || "", m.postal || ""].join("\t");

  }



  function mergeMutations() {

    var seen = {};

    var out = [];

    for (var i = 0; i < arguments.length; i++) {

      (arguments[i] || []).forEach(function (m) {

        var k = mutationKey(m);

        if (seen[k]) return;

        seen[k] = true;

        out.push(m);

      });

    }

    return out;

  }



  window.MeishiCatalogSync = {

    syncRecordsFromCatalog: syncRecordsFromCatalog,

    inferMutations: inferMutations,

    mergeMutations: mergeMutations,

  };

})();


