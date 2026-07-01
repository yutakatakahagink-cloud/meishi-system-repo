/**
 * 会社共通「共通データ」編集 UI
 * 左: 項目一覧（縦） / 右: クリックした項目の全データ＋紐づき
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

  function parsePathKey(pk) {
    var p = String(pk || "").split("|");
    return { aff1: p[0] || "", aff2: p[1] || "", aff3: p[2] || "", title: p[3] || "" };
  }

  function formatLink(parts) {
    var segs = [];
    if (parts.aff1) segs.push("所属1: " + parts.aff1);
    if (parts.aff2) segs.push("所属2: " + parts.aff2);
    if (parts.aff3) segs.push("所属3: " + parts.aff3);
    if (parts.title) segs.push("役職: " + parts.title);
    return segs.length ? segs.join(" › ") : "会社共通";
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

  function renameAff2(cat, aff1, oldV, newV) {
    aff1 = MeishiFields.norm(aff1); oldV = MeishiFields.norm(oldV); newV = MeishiFields.norm(newV);
    if (!aff1 || !oldV || !newV) return;
    var p2old = MeishiCatalog.pathKey(aff1, oldV);
    var p2new = MeishiCatalog.pathKey(aff1, newV);
    MeishiCatalog.renameMapList(cat.aff2, aff1, oldV, newV);
    rekeyMap(cat.aff3, p2old, p2new);
    rekeyMapPrefix(cat.title, p2old + "|", p2new + "|");
    rekeyMapPrefix(cat.qual, p2old + "|", p2new + "|");
    rekeyMapPrefix(cat.mobile, p2old + "|", p2new + "|");
    rekeyMapPrefix(cat.email, p2old + "|", p2new + "|");
  }

  function removeAff2(cat, aff1, v) {
    aff1 = MeishiFields.norm(aff1); v = MeishiFields.norm(v);
    if (cat.aff2[aff1]) cat.aff2[aff1] = cat.aff2[aff1].filter(function (x) { return x !== v; });
    var p2 = MeishiCatalog.pathKey(aff1, v);
    delete cat.aff3[p2];
    removeMapPrefix(cat.title, p2 + "|");
    removeMapPrefix(cat.qual, p2 + "|");
    removeMapPrefix(cat.mobile, p2 + "|");
    removeMapPrefix(cat.email, p2 + "|");
  }

  function renameAff3(cat, aff1, aff2, oldV, newV) {
    var p2 = MeishiCatalog.pathKey(aff1, aff2);
    var p3old = MeishiCatalog.pathKey(aff1, aff2, oldV);
    var p3new = MeishiCatalog.pathKey(aff1, aff2, newV);
    MeishiCatalog.renameMapList(cat.aff3, p2, oldV, newV);
    rekeyMap(cat.title, p3old, p3new);
    rekeyMapPrefix(cat.qual, p3old + "|", p3new + "|");
    rekeyMapPrefix(cat.mobile, p3old + "|", p3new + "|");
    rekeyMapPrefix(cat.email, p3old + "|", p3new + "|");
  }

  function removeAff3(cat, aff1, aff2, v) {
    var p2 = MeishiCatalog.pathKey(aff1, aff2);
    if (cat.aff3[p2]) cat.aff3[p2] = cat.aff3[p2].filter(function (x) { return x !== v; });
    var p3 = MeishiCatalog.pathKey(aff1, aff2, v);
    delete cat.title[p3]; delete cat.qual[p3]; delete cat.mobile[p3]; delete cat.email[p3];
    removeMapPrefix(cat.qual, p3 + "|");
    removeMapPrefix(cat.mobile, p3 + "|");
    removeMapPrefix(cat.email, p3 + "|");
  }

  function collectRows(cat, fieldId) {
    var rows = [];
    if (fieldId === "aff1") {
      (cat.aff1 || []).forEach(function (v) {
        rows.push({ value: v, link: "会社共通", meta: {} });
      });
      return rows;
    }
    if (fieldId === "aff2") {
      Object.keys(cat.aff2 || {}).forEach(function (a1) {
        (cat.aff2[a1] || []).forEach(function (v) {
          rows.push({ value: v, link: "所属1: " + a1, meta: { aff1: a1 } });
        });
      });
      return rows.sort(function (a, b) {
        return (a.meta.aff1 + a.value).localeCompare(b.meta.aff1 + b.value, "ja");
      });
    }
    if (fieldId === "aff3") {
      Object.keys(cat.aff3 || {}).forEach(function (pk) {
        var parts = parsePathKey(pk);
        (cat.aff3[pk] || []).forEach(function (v) {
          rows.push({
            value: v,
            link: formatLink({ aff1: parts.aff1, aff2: parts.aff2 }),
            meta: { aff1: parts.aff1, aff2: parts.aff2 },
          });
        });
      });
      return rows;
    }
    if (fieldId === "title") {
      Object.keys(cat.title || {}).forEach(function (pk) {
        var parts = parsePathKey(pk);
        (cat.title[pk] || []).forEach(function (v) {
          rows.push({
            value: v,
            link: formatLink({ aff1: parts.aff1, aff2: parts.aff2, aff3: parts.aff3 }),
            meta: { aff1: parts.aff1, aff2: parts.aff2, aff3: parts.aff3 },
          });
        });
      });
      return rows;
    }
    if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
      Object.keys(cat[fieldId] || {}).forEach(function (pk) {
        var parts = parsePathKey(pk);
        (cat[fieldId][pk] || []).forEach(function (v) {
          rows.push({ value: v, link: formatLink(parts), meta: { pk: pk, parts: parts } });
        });
      });
      return rows;
    }
    if (fieldId === "postal" || fieldId === "address" || fieldId === "tel" || fieldId === "fax") {
      (cat.locations || []).forEach(function (loc, i) {
        var v = loc[fieldId] || "";
        if (!v) return;
        var linkParts = [];
        if (loc.postal && fieldId !== "postal") linkParts.push("〒" + loc.postal);
        if (loc.address && fieldId !== "address") linkParts.push(loc.address);
        rows.push({
          value: v,
          link: linkParts.length ? linkParts.join(" / ") : "所在地セット",
          meta: { locIndex: i },
        });
      });
      return rows;
    }
    if (fieldId === "url") {
      (cat.urls || []).forEach(function (v) {
        rows.push({ value: v, link: "会社共通", meta: {} });
      });
      return rows;
    }
    return rows;
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
    if (fieldId === "aff1") {
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='所属1名' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    } else if (fieldId === "aff2") {
      html += "<div class='field'><label>紐づく所属1</label><select class='cat-new-aff1'>";
      html += "<option value=''>— 選択 —</option>";
      (cat.aff1 || []).forEach(function (a) { html += "<option>" + esc(a) + "</option>"; });
      html += "</select></div>";
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='所属2名' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    } else if (fieldId === "aff3") {
      html += "<div class='field'><label>紐づく所属1</label><select class='cat-new-aff1 cat-cascade-a1'>";
      html += "<option value=''>—</option>";
      (cat.aff1 || []).forEach(function (a) { html += "<option>" + esc(a) + "</option>"; });
      html += "</select></div>";
      html += "<div class='field'><label>紐づく所属2</label><select class='cat-new-aff2 cat-cascade-a2'><option value=''>—</option></select></div>";
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='所属3名' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    } else if (fieldId === "title") {
      html += "<div class='field'><label>所属1</label><select class='cat-new-aff1 cat-cascade-a1'><option value=''>—</option>";
      (cat.aff1 || []).forEach(function (a) { html += "<option>" + esc(a) + "</option>"; });
      html += "</select></div>";
      html += "<div class='field'><label>所属2</label><select class='cat-new-aff2 cat-cascade-a2'><option value=''>—</option></select></div>";
      html += "<div class='field'><label>所属3</label><select class='cat-new-aff3 cat-cascade-a3'><option value=''>—</option></select></div>";
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='役職名' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    } else if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
      var label = fieldId === "qual" ? "資格" : (fieldId === "mobile" ? "携帯番号" : "メール");
      html += "<div class='field'><label>所属1</label><select class='cat-new-aff1 cat-cascade-a1'><option value=''>—</option>";
      (cat.aff1 || []).forEach(function (a) { html += "<option>" + esc(a) + "</option>"; });
      html += "</select></div>";
      html += "<div class='field'><label>所属2</label><select class='cat-new-aff2 cat-cascade-a2'><option value=''>—</option></select></div>";
      html += "<div class='field'><label>所属3</label><select class='cat-new-aff3 cat-cascade-a3'><option value=''>—</option></select></div>";
      html += "<div class='field'><label>役職（任意）</label><select class='cat-new-title cat-cascade-t'><option value=''>—</option></select></div>";
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='" + esc(label) + "' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    } else if (fieldId === "postal" || fieldId === "address" || fieldId === "tel" || fieldId === "fax") {
      html += "<p class='hint'>郵便番号・住所・TEL・FAXはセットで追加します。</p>";
      html += "<div class='field'><label>郵便番号</label><input class='cat-new-postal' /></div>";
      html += "<div class='field'><label>住所</label><input class='cat-new-address' /></div>";
      html += "<div class='field'><label>TEL</label><input class='cat-new-tel' /></div>";
      html += "<div class='field'><label>FAX</label><input class='cat-new-fax' /></div>";
      html += "<button type='button' class='btn sm btn-loc-add'>所在地セットを追加</button>";
    } else if (fieldId === "url") {
      html += "<div class='btn-row'><input class='cat-new-val' placeholder='URL' /><button type='button' class='btn sm btn-row-add'>追加</button></div>";
    }
    html += "</div>";
    return html;
  }

  function bindCascadeSelects(box, cat) {
    var a1 = box.querySelector(".cat-cascade-a1");
    var a2 = box.querySelector(".cat-cascade-a2");
    var a3 = box.querySelector(".cat-cascade-a3");
    var t = box.querySelector(".cat-cascade-t");
    if (!a1) return;
    function fillA2() {
      if (!a2) return;
      var list = a1.value ? MeishiCatalog.getAff2List(cat, a1.value) : [];
      a2.innerHTML = "<option value=''>—</option>" + list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
      if (a3) { a3.innerHTML = "<option value=''>—</option>"; }
      if (t) { t.innerHTML = "<option value=''>—</option>"; }
    }
    function fillA3() {
      if (!a3) return;
      var list = (a1.value && a2.value) ? MeishiCatalog.getAff3List(cat, a1.value, a2.value) : [];
      a3.innerHTML = "<option value=''>—</option>" + list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
      if (t) { t.innerHTML = "<option value=''>—</option>"; }
    }
    function fillT() {
      if (!t) return;
      var list = (a1.value && a2.value && a3.value) ? MeishiCatalog.getTitleList(cat, a1.value, a2.value, a3.value) : [];
      t.innerHTML = "<option value=''>—</option>" + list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
    }
    a1.onchange = function () { fillA2(); };
    if (a2) a2.onchange = function () { fillA3(); };
    if (a3) a3.onchange = function () { fillT(); };
  }

  function renderDetailPanel(container, cat, fieldId, refresh, onMutate) {
    function emit(op) {
      if (onMutate) onMutate(op || null);
    }
    var ft = FIELD_TYPES.find(function (f) { return f.id === fieldId; }) || FIELD_TYPES[0];
    var rows = collectRows(cat, fieldId);
    var html = "<div class='cat-detail-head'><strong>" + esc(ft.label) + "</strong>";
    html += "<span class='hint'> — 全 " + rows.length + " 件</span></div>";

    html += "<div class='cat-table-wrap'><table class='cat-data-table'>";
    html += "<thead><tr><th>値</th><th>紐づき</th><th></th></tr></thead><tbody>";
    if (!rows.length) {
      html += "<tr><td colspan='3' class='hint'>（未登録）</td></tr>";
    } else {
      rows.forEach(function (row) {
        html += "<tr>";
        html += "<td class='col-val'>" + esc(row.value) + "</td>";
        html += "<td class='col-link'>" + esc(row.link) + "</td>";
        html += "<td class='col-act'>";
        if (fieldId === "postal" || fieldId === "address" || fieldId === "tel" || fieldId === "fax") {
          html += "<button type='button' class='linkbtn btn-loc-edit' data-i='" + row.meta.locIndex + "'>編集</button> ";
          html += "<button type='button' class='linkbtn btn-loc-del' data-i='" + row.meta.locIndex + "'>×</button>";
        } else {
          html += "<button type='button' class='linkbtn btn-cat-edit' data-v='" + escAttr(row.value) + "' data-meta='" + rowMetaAttr(row.meta) + "'>編集</button> ";
          html += "<button type='button' class='linkbtn btn-cat-del' data-v='" + escAttr(row.value) + "' data-meta='" + rowMetaAttr(row.meta) + "'>×</button>";
        }
        html += "</td></tr>";
      });
    }
    html += "</tbody></table></div>";
    html += renderAddForm(cat, fieldId);
    container.innerHTML = html;

    bindCascadeSelects(container, cat);

    container.querySelectorAll(".btn-cat-edit").forEach(function (btn) {
      btn.onclick = function () {
        var oldV = btn.getAttribute("data-v");
        var meta = JSON.parse(btn.getAttribute("data-meta") || "{}");
        var nv = prompt("新しい名称", oldV);
        if (nv == null) return;
        nv = nv.trim();
        if (!nv || nv === oldV) return;
        var op = null;
        if (fieldId === "aff1") { renameAff1(cat, oldV, nv); op = { type: "renameAff1", from: oldV, to: nv }; }
        else if (fieldId === "aff2") { renameAff2(cat, meta.aff1, oldV, nv); op = { type: "renameAff2", aff1: meta.aff1, from: oldV, to: nv }; }
        else if (fieldId === "aff3") { renameAff3(cat, meta.aff1, meta.aff2, oldV, nv); op = { type: "renameAff3", aff1: meta.aff1, aff2: meta.aff2, from: oldV, to: nv }; }
        else if (fieldId === "title") {
          MeishiCatalog.renameMapList(cat.title, MeishiCatalog.pathKey(meta.aff1, meta.aff2, meta.aff3), oldV, nv);
          op = { type: "renameTitle", aff1: meta.aff1, aff2: meta.aff2, aff3: meta.aff3, from: oldV, to: nv };
        }
        else if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
          MeishiCatalog.renameInList(cat[fieldId][meta.pk] || [], oldV, nv);
          op = { type: "renameField", field: fieldId, parts: meta.parts || {}, from: oldV, to: nv };
        } else if (fieldId === "url") {
          MeishiCatalog.renameInList(cat.urls, oldV, nv);
          op = { type: "renameUrl", from: oldV, to: nv };
        }
        emit(op);
        refresh();
      };
    });

    container.querySelectorAll(".btn-cat-del").forEach(function (btn) {
      btn.onclick = function () {
        var v = btn.getAttribute("data-v");
        var meta = JSON.parse(btn.getAttribute("data-meta") || "{}");
        if (!confirm("「" + v + "」を削除しますか？")) return;
        var op = null;
        if (fieldId === "aff1") { removeAff1(cat, v); op = { type: "deleteAff1", value: v }; }
        else if (fieldId === "aff2") { removeAff2(cat, meta.aff1, v); op = { type: "deleteAff2", aff1: meta.aff1, value: v }; }
        else if (fieldId === "aff3") { removeAff3(cat, meta.aff1, meta.aff2, v); op = { type: "deleteAff3", aff1: meta.aff1, aff2: meta.aff2, value: v }; }
        else if (fieldId === "title") {
          var pk = MeishiCatalog.pathKey(meta.aff1, meta.aff2, meta.aff3);
          if (cat.title[pk]) cat.title[pk] = cat.title[pk].filter(function (x) { return x !== v; });
          op = { type: "deleteTitle", aff1: meta.aff1, aff2: meta.aff2, aff3: meta.aff3, value: v };
        } else if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
          var arr = cat[fieldId][meta.pk] || [];
          var i = arr.indexOf(v);
          if (i >= 0) arr.splice(i, 1);
          op = { type: "deleteField", field: fieldId, parts: meta.parts || {}, value: v };
        } else if (fieldId === "url") {
          cat.urls = (cat.urls || []).filter(function (x) { return x !== v; });
          op = { type: "deleteUrl", value: v };
        }
        emit(op);
        refresh();
      };
    });

    var addBtn = container.querySelector(".btn-row-add");
    if (addBtn) {
      addBtn.onclick = function () {
        var v = (container.querySelector(".cat-new-val") || {}).value;
        v = v ? v.trim() : "";
        if (!v) return;
        if (fieldId === "aff1") MeishiCatalog.addUnique(cat.aff1, v);
        else if (fieldId === "aff2") {
          var a1 = (container.querySelector(".cat-new-aff1") || {}).value;
          if (!a1) return alert("所属1を選択してください");
          MeishiCatalog.addUnique(MeishiCatalog.ensureList(cat.aff2, a1), v);
        } else if (fieldId === "aff3") {
          var a1b = (container.querySelector(".cat-new-aff1") || {}).value;
          var a2b = (container.querySelector(".cat-new-aff2") || {}).value;
          if (!a1b || !a2b) return alert("所属1・所属2を選択してください");
          MeishiCatalog.addUnique(MeishiCatalog.ensureList(cat.aff3, MeishiCatalog.pathKey(a1b, a2b)), v);
        } else if (fieldId === "title") {
          var a1t = (container.querySelector(".cat-new-aff1") || {}).value;
          var a2t = (container.querySelector(".cat-new-aff2") || {}).value;
          var a3t = (container.querySelector(".cat-new-aff3") || {}).value;
          if (!a1t || !a2t || !a3t) return alert("所属1〜3を選択してください");
          MeishiCatalog.addUnique(MeishiCatalog.ensureList(cat.title, MeishiCatalog.pathKey(a1t, a2t, a3t)), v);
        } else if (fieldId === "qual" || fieldId === "mobile" || fieldId === "email") {
          var a1q = (container.querySelector(".cat-new-aff1") || {}).value;
          var a2q = (container.querySelector(".cat-new-aff2") || {}).value;
          var a3q = (container.querySelector(".cat-new-aff3") || {}).value;
          if (!a1q || !a2q || !a3q) return alert("所属1〜3を選択してください");
          var tit = (container.querySelector(".cat-new-title") || {}).value;
          var pk = tit
            ? MeishiCatalog.pathKey(a1q, a2q, a3q, tit)
            : MeishiCatalog.pathKey(a1q, a2q, a3q);
          MeishiCatalog.addUnique(MeishiCatalog.ensureList(cat[fieldId], pk), v);
        } else if (fieldId === "url") MeishiCatalog.addUnique(cat.urls, v);
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
        if (fieldId === "postal") {
          MeishiCatalog.addUnique(cat.postal, loc.postal);
        }
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

    var html = "<p class='hint'>左の項目をクリックすると、右に登録済みデータと紐づき先が表示されます。名称変更すると名刺データ・部署共通にも即時反映されます。最後に「会社共通を保存」を押してください。</p>";
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
