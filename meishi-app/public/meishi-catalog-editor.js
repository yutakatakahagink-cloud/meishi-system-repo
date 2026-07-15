/**
 * 会社共通「共通データ」編集 UI
 * 左: 項目一覧（縦） / 右: 候補マスタの追加・編集・削除
 * 紐づけ（誰に属するか）は名刺データ編集側で判断する
 */
(function () {
  var FIELD_TYPES = [
    { id: "aff1", label: "所属1" },
    { id: "aff2", label: "所属2" },
    { id: "aff3", label: "所属3" },
    { id: "title", label: "役職" },
    { id: "qual", label: "資格" },
    { id: "mobile", label: "携帯" },
    { id: "email", label: "メール" },
    { id: "postal", label: "郵便番号" },
    { id: "address", label: "住所" },
    { id: "tel", label: "TEL" },
    { id: "fax", label: "FAX" },
    { id: "url", label: "URL" },
  ];

  var MAP_FIELDS = { aff2: 1, aff3: 1, title: 1, qual: 1, mobile: 1, email: 1 };
  var PLACEHOLDERS = {
    aff1: "所属1名",
    aff2: "所属2名",
    aff3: "所属3名",
    title: "役職名",
    qual: "資格",
    mobile: "携帯番号",
    email: "メール",
    url: "URL",
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  function getCtx() {
    if (!window._catCtx) window._catCtx = { field: "aff1" };
    return window._catCtx;
  }

  function rekeyMap(map, oldKey, newKey) {
    if (!map || oldKey === newKey) return;
    if (map[oldKey]) { map[newKey] = map[oldKey]; delete map[oldKey]; }
  }

  function rekeyMapPrefix(map, oldPrefix, newPrefix) {
    if (!map) return;
    Object.keys(map).slice().forEach(function (k) {
      if (k.indexOf(oldPrefix) === 0) {
        map[newPrefix + k.slice(oldPrefix.length)] = map[k];
        delete map[k];
      }
    });
  }

  function removeMapPrefix(map, prefix) {
    if (!map) return;
    Object.keys(map).slice().forEach(function (k) {
      if (k.indexOf(prefix) === 0) delete map[k];
    });
  }

  function renameAff1(cat, oldV, newV) {
    oldV = MeishiFields.norm(oldV); newV = MeishiFields.norm(newV);
    if (!oldV || !newV || oldV === newV) return;
    MeishiCatalog.renameInList(cat.aff1, oldV, newV);
    rekeyMap(cat.aff2, oldV, newV);
    rekeyMapPrefix(cat.aff3, oldV + "|", newV + "|");
    rekeyMapPrefix(cat.title, oldV + "|", newV + "|");
    rekeyMapPrefix(cat.qual, oldV + "|", newV + "|");
    rekeyMapPrefix(cat.mobile, oldV + "|", newV + "|");
    rekeyMapPrefix(cat.email, oldV + "|", newV + "|");
  }

  function removeAff1(cat, v) {
    v = MeishiFields.norm(v);
    cat.aff1 = (cat.aff1 || []).filter(function (x) { return x !== v; });
    delete cat.aff2[v];
    removeMapPrefix(cat.aff3, v + "|");
    removeMapPrefix(cat.title, v + "|");
    removeMapPrefix(cat.qual, v + "|");
    removeMapPrefix(cat.mobile, v + "|");
    removeMapPrefix(cat.email, v + "|");
  }

  function uniqValueRows(values) {
    var seen = Object.create(null);
    var rows = [];
    (values || []).forEach(function (v) {
      v = MeishiFields.norm(v);
      if (!v || seen[v]) return;
      seen[v] = 1;
      rows.push({ value: v, meta: { value: v } });
    });
    return rows.sort(function (a, b) {
      return String(a.value).localeCompare(String(b.value), "ja");
    });
  }

  function collectRows(cat, fieldId) {
    if (fieldId === "aff1") return uniqValueRows(cat.aff1);
    if (fieldId === "aff2") return uniqValueRows(MeishiCatalog.flattenMapLists(cat.aff2));
    if (fieldId === "aff3") return uniqValueRows(MeishiCatalog.flattenMapLists(cat.aff3));
    if (fieldId === "title") return uniqValueRows(MeishiCatalog.flattenMapLists(cat.title));
    if (fieldId === "qual") return uniqValueRows(MeishiCatalog.flattenMapLists(cat.qual));
    if (fieldId === "mobile") return uniqValueRows(MeishiCatalog.flattenMapLists(cat.mobile));
    if (fieldId === "email") return uniqValueRows(MeishiCatalog.flattenMapLists(cat.email));
    if (fieldId === "url") return uniqValueRows(cat.urls);
    if (fieldId === "postal" || fieldId === "address" || fieldId === "tel" || fieldId === "fax") {
      var rows = [];
      (cat.locations || []).forEach(function (loc, i) {
        var v = loc[fieldId] || "";
        if (!v) return;
        var extra = [];
        if (fieldId !== "postal" && loc.postal) extra.push("〒" + loc.postal);
        if (fieldId !== "address" && loc.address) extra.push(loc.address);
        rows.push({
          value: extra.length ? (v + "（" + extra.join(" / ") + "）") : v,
          meta: { locIndex: i, rawValue: v },
        });
      });
      return rows;
    }
    return [];
  }

  function countRows(cat, fieldId) {
    return collectRows(cat, fieldId).length;
  }

  function rowMetaAttr(meta) {
    return escAttr(JSON.stringify(meta || {}));
  }

  function renderAddForm(cat, fieldId) {
    var html = "<div class='cat-add-form'>";
    html += "<div class='cat-add-title'>追加</div>";
    if (fieldId === "postal" || fieldId === "address" || fieldId === "tel" || fieldId === "fax") {
      html += "<p class='hint'>郵便番号・住所・TEL・FAXはセットで追加します。</p>";
      html += "<div class='field'><label>郵便番号</label><input class='cat-new-postal' /></div>";
      html += "<div class='field'><label>住所</label><input class='cat-new-address' /></div>";
      html += "<div class='field'><label>TEL</label><input class='cat-new-tel' /></div>";
      html += "<div class='field'><label>FAX</label><input class='cat-new-fax' /></div>";
      html += "<button type='button' class='btn sm btn-loc-add'>所在地セットを追加</button>";
    } else {
      var ph = PLACEHOLDERS[fieldId] || "値";
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='" + esc(ph) + "' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    }
    html += "</div>";
    return html;
  }

  function emitRenameOp(fieldId, oldV, newV) {
    if (fieldId === "aff1") return { type: "renameAff1", from: oldV, to: newV };
    if (fieldId === "aff2") return { type: "renameAff2", aff1: "*", from: oldV, to: newV };
    if (fieldId === "aff3") return { type: "renameAff3", aff1: "*", aff2: "*", from: oldV, to: newV };
    if (fieldId === "title") return { type: "renameTitle", aff1: "*", aff2: "*", aff3: "*", from: oldV, to: newV };
    if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
      return { type: "renameField", field: fieldId, parts: {}, from: oldV, to: newV };
    }
    if (fieldId === "url") return { type: "renameUrl", from: oldV, to: newV };
    return null;
  }

  function emitDeleteOp(fieldId, v) {
    if (fieldId === "aff1") return { type: "deleteAff1", value: v };
    if (fieldId === "aff2") return { type: "deleteAff2", aff1: "*", value: v };
    if (fieldId === "aff3") return { type: "deleteAff3", aff1: "*", aff2: "*", value: v };
    if (fieldId === "title") return { type: "deleteTitle", aff1: "*", aff2: "*", aff3: "*", value: v };
    if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
      return { type: "deleteField", field: fieldId, parts: {}, value: v };
    }
    if (fieldId === "url") return { type: "deleteUrl", value: v };
    return null;
  }

  function renameCatalogValue(cat, fieldId, oldV, newV) {
    if (fieldId === "aff1") renameAff1(cat, oldV, newV);
    else if (MAP_FIELDS[fieldId]) {
      MeishiCatalog.renameInAllMapLists(cat[fieldId], oldV, newV);
      MeishiCatalog.addUnique(MeishiCatalog.ensureList(cat[fieldId], "*"), newV);
    } else if (fieldId === "url") MeishiCatalog.renameInList(cat.urls, oldV, newV);
  }

  function deleteCatalogValue(cat, fieldId, v) {
    if (fieldId === "aff1") removeAff1(cat, v);
    else if (MAP_FIELDS[fieldId]) MeishiCatalog.removeFromAllMapLists(cat[fieldId], v);
    else if (fieldId === "url") cat.urls = (cat.urls || []).filter(function (x) { return x !== v; });
  }

  function addCatalogValue(cat, fieldId, v) {
    if (fieldId === "aff1") MeishiCatalog.addUnique(cat.aff1, v);
    else if (MAP_FIELDS[fieldId]) MeishiCatalog.addUnique(MeishiCatalog.ensureList(cat[fieldId], "*"), v);
    else if (fieldId === "url") MeishiCatalog.addUnique(cat.urls, v);
  }

  function renderDetailPanel(container, cat, fieldId, refresh, onMutate) {
    function emit(op) {
      if (onMutate) onMutate(op || null);
    }
    var ft = FIELD_TYPES.find(function (f) { return f.id === fieldId; }) || FIELD_TYPES[0];
    var rows = collectRows(cat, fieldId);
    var html = "<div class='cat-detail-head'><strong>" + esc(ft.label) + "</strong>";
    html += "<span class='hint'> — 全 " + rows.length + " 件</span></div>";

    html += "<div class='cat-table-wrap'><table class='cat-data-table no-link'>";
    html += "<thead><tr><th class='col-act'>操作</th><th class='col-val'>値</th></tr></thead><tbody>";
    if (!rows.length) {
      html += "<tr><td colspan='2' class='hint'>（未登録）</td></tr>";
    } else {
      rows.forEach(function (row) {
        html += "<tr>";
        html += "<td class='col-act'>";
        if (fieldId === "postal" || fieldId === "address" || fieldId === "tel" || fieldId === "fax") {
          html += "<button type='button' class='linkbtn btn-loc-edit' data-i='" + row.meta.locIndex + "'>編集</button> ";
          html += "<button type='button' class='linkbtn btn-loc-del' data-i='" + row.meta.locIndex + "'>×</button>";
        } else {
          html += "<button type='button' class='linkbtn btn-cat-edit' data-v='" + escAttr(row.meta.value || row.value) + "' data-meta='" + rowMetaAttr(row.meta) + "'>編集</button> ";
          html += "<button type='button' class='linkbtn btn-cat-del' data-v='" + escAttr(row.meta.value || row.value) + "' data-meta='" + rowMetaAttr(row.meta) + "'>×</button>";
        }
        html += "</td>";
        html += "<td class='col-val'>" + esc(row.value) + "</td>";
        html += "</tr>";
      });
    }
    html += "</tbody></table></div>";
    html += renderAddForm(cat, fieldId);
    container.innerHTML = html;

    container.querySelectorAll(".btn-cat-edit").forEach(function (btn) {
      btn.onclick = function () {
        var oldV = btn.getAttribute("data-v");
        var nv = prompt("新しい名称", oldV);
        if (nv == null) return;
        nv = nv.trim();
        if (!nv || nv === oldV) return;
        renameCatalogValue(cat, fieldId, oldV, nv);
        emit(emitRenameOp(fieldId, oldV, nv));
        refresh();
      };
    });

    container.querySelectorAll(".btn-cat-del").forEach(function (btn) {
      btn.onclick = function () {
        var v = btn.getAttribute("data-v");
        if (!confirm("「" + v + "」を削除しますか？")) return;
        deleteCatalogValue(cat, fieldId, v);
        emit(emitDeleteOp(fieldId, v));
        refresh();
      };
    });

    var addBtn = container.querySelector(".btn-row-add");
    if (addBtn) {
      addBtn.onclick = function () {
        var v = (container.querySelector(".cat-new-val") || {}).value;
        v = v ? v.trim() : "";
        if (!v) return;
        addCatalogValue(cat, fieldId, v);
        refresh();
      };
    }

    var locAdd = container.querySelector(".btn-loc-add");
    if (locAdd) {
      locAdd.onclick = function () {
        var po = (container.querySelector(".cat-new-postal") || {}).value.trim();
        if (!po) return alert("郵便番号を入力してください");
        cat.locations = cat.locations || [];
        cat.locations.push({
          postal: po,
          address: (container.querySelector(".cat-new-address") || {}).value.trim(),
          tel: (container.querySelector(".cat-new-tel") || {}).value.trim(),
          fax: (container.querySelector(".cat-new-fax") || {}).value.trim(),
        });
        MeishiCatalog.addUnique(cat.postal, po);
        emit();
        refresh();
      };
    }

    container.querySelectorAll(".btn-loc-edit").forEach(function (btn) {
      btn.onclick = function () {
        var loc = cat.locations[+btn.getAttribute("data-i")];
        if (!loc) return;
        var oldPostal = loc.postal;
        var labels = { postal: "郵便番号", address: "住所", tel: "TEL", fax: "FAX" };
        var nv = prompt(labels[fieldId] || "値", loc[fieldId] || "");
        if (nv == null) return;
        loc[fieldId] = nv.trim();
        if (fieldId === "postal") MeishiCatalog.addUnique(cat.postal, loc.postal);
        emit({
          type: "updateLocation",
          oldPostal: oldPostal,
          loc: { postal: loc.postal, address: loc.address, tel: loc.tel, fax: loc.fax },
        });
        refresh();
      };
    });
    container.querySelectorAll(".btn-loc-del").forEach(function (btn) {
      btn.onclick = function () {
        var idx = +btn.getAttribute("data-i");
        var loc = cat.locations[idx];
        if (loc && loc.postal) emit({ type: "deleteLocation", postal: loc.postal });
        cat.locations.splice(idx, 1);
        refresh();
      };
    });
  }

  function render(container, cat, onRefresh, onMutate) {
    if (!container || !cat) return;
    var ctx = getCtx();
    if (!ctx.field) ctx.field = "aff1";

    function refresh() {
      if (onRefresh) onRefresh();
      else render(container, cat, onRefresh, onMutate);
    }

    var html = "<p class='hint'>各項目の候補を追加・編集・削除します。誰に紐づくかは下の「名刺データ編集」で会社・所属・役職を選んで判断します。変更後は「共通データを保存」を押してください。</p>";
    html += "<div class='cat-master-detail'>";
    html += "<nav class='cat-field-nav'>";
    FIELD_TYPES.forEach(function (ft) {
      var n = countRows(cat, ft.id);
      html += "<button type='button' class='cat-field-btn" + (ctx.field === ft.id ? " on" : "") + "' data-field='" + ft.id + "'>";
      html += "<span class='cat-field-label'>" + esc(ft.label) + "</span>";
      html += "<span class='cat-count'>" + n + "</span></button>";
    });
    html += "</nav>";
    html += "<div class='cat-detail-panel' id='catDetailBox'></div>";
    html += "</div>";

    container.innerHTML = html;

    container.querySelectorAll(".cat-field-btn").forEach(function (btn) {
      btn.onclick = function () {
        ctx.field = btn.getAttribute("data-field");
        refresh();
      };
    });

    renderDetailPanel(document.getElementById("catDetailBox"), cat, ctx.field, refresh, onMutate);
  }

  window.MeishiCatalogEditor = { render: render, getCtx: getCtx };
})();
