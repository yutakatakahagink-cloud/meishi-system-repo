/**
 * 所有者画面ロジック
 */
(function () {
  var editRecIdx = -1;
  var copySourceRec = null;
  var recFilter = "";

  var REC_TEXT_INPUT_KEYS = { name: 1, qual: 1, mobile: 1, email: 1 };
  var coUI = null;
  var coPanel = null;
  var coLayout = null;
  var coLayoutBack = null;
  var coBackUI = null;
  var coBackPanel = null;
  var coSide = "front";
  var currentCo = "";
  var deCoUI = null;
  var deUI = null;
  var deCoLayout = null;
  var deLayout = null;
  var deCoLayoutBack = null;
  var deLayoutBack = null;
  var deCoBackUI = null;
  var deBackUI = null;
  var deBackPanel = null;
  var deSide = "front";
  var currentDeptKey = "";
  var previewPanel = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function setBadge() {
    var b = document.getElementById("syncBadge");
    if (MeishiStore.useFirebase()) { b.textContent = "全端末で共有中"; b.style.background = "rgba(40,180,99,.35)"; }
    else { b.textContent = "この端末のみ"; b.style.background = "rgba(243,156,18,.35)"; }
  }

  function isPreviewDeepLink() {
    var h = (location.hash || "").replace(/^#/, "").toLowerCase();
    return h === "preview" || h === "print" || h === "editor";
  }

  function applyPreviewOnlyMode() {
    if (!isPreviewDeepLink()) return;
    var tabs = document.getElementById("tabs");
    if (tabs) tabs.style.display = "none";
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("on"); });
    var prev = document.getElementById("panel-preview");
    if (prev) prev.classList.add("on");
    initPreviewPanel();
  }

  function showTab(id) {
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === id);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("on", p.id === "panel-" + id);
    });
    if (id === "company") {
      if (coSide === "back") refreshCoBackDesign();
      else refreshCoDesign();
    }
    if (id === "dept") {
      fillDeptPanel();
      if (deSide === "back") refreshDeptBackDesign(true);
      else refreshDeptDesign(true);
    }
    if (id === "preview") initPreviewPanel();
    if (id === "records") {
      renderRecTable();
      refreshRecFormIfOpen();
    }
  }

  function showSyncStatus(msg) {
    var el = document.getElementById("recSyncStatus");
    if (!el) return;
    el.textContent = msg || "";
    if (msg) {
      clearTimeout(showSyncStatus._t);
      showSyncStatus._t = setTimeout(function () { el.textContent = ""; }, 4000);
    }
  }

  function initPreviewPanel() {
    if (!previewPanel) {
      previewPanel = MeishiPreviewPanel.create({
        isActive: function () {
          var p = document.getElementById("panel-preview");
          return p && p.classList.contains("on");
        },
        onPersonalSaved: showSyncStatus,
      });
    }
    previewPanel.init();
  }

  function pickImagesIntoLayout(layout, prefix, done) {
    MeishiImageLib.pick(function (items) {
      layout.images = layout.images || [];
      items.forEach(function (item, i) {
        layout.images.push(MeishiImageLib.createDefaultImage(item, i, prefix));
      });
      if (typeof done === "function") done();
    });
  }

  function pickImagesIntoBackLayout(layout, prefix, done) {
    pickImagesIntoLayout(layout, prefix, done);
  }

  function bindSideToggle(toggleId, onSwitch) {
    var tg = document.getElementById(toggleId);
    if (!tg || tg._sideBound) return;
    tg._sideBound = true;
    tg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-side]");
      if (!b) return;
      tg.querySelectorAll("button[data-side]").forEach(function (btn) {
        btn.classList.toggle("on", btn === b);
      });
      onSwitch(b.getAttribute("data-side"));
    });
  }

  function switchCoSide(side) {
    coSide = side === "back" ? "back" : "front";
    var front = document.getElementById("coFrontDesign");
    var back = document.getElementById("coBackDesign");
    if (front) front.style.display = coSide === "front" ? "" : "none";
    if (back) back.style.display = coSide === "back" ? "" : "none";
    if (coSide === "back") refreshCoBackDesign();
    else refreshCoDesign();
  }

  function switchDeSide(side) {
    deSide = side === "back" ? "back" : "front";
    var front = document.getElementById("deFrontDesign");
    var back = document.getElementById("deBackDesign");
    if (front) front.style.display = deSide === "front" ? "" : "none";
    if (back) back.style.display = deSide === "back" ? "" : "none";
    if (deSide === "back") refreshDeptBackDesign(false);
    else refreshDeptDesign(false);
  }

  function fillBasic() {
    var c = MeishiStore.getConfig();
    document.getElementById("title").value = c.title || "";
    document.getElementById("ownerId").value = c.ownerId || "";
    document.getElementById("ownerPass").value = c.ownerPass || "";
    refreshUserUrlFields();
    renderImgLibBox();
  }

  function renderImgLibBox() {
    var box = document.getElementById("imgLibBox");
    if (!box) return;
    var lib = MeishiStore.getImageLibrary();
    box.innerHTML = "";
    if (!lib.length) {
      box.className = "img-lib-box empty";
      box.textContent = "（未登録）「＋ 追加」からエクスプローラーで画像を選んで登録してください。";
      return;
    }
    box.className = "img-lib-box";
    lib.forEach(function (item) {
      var wrap = document.createElement("div");
      wrap.className = "img-lib-item";
      var del = document.createElement("button");
      del.type = "button";
      del.className = "linkbtn";
      del.title = "削除";
      del.textContent = "×";
      var img = document.createElement("img");
      img.alt = "";
      img.src = window.MeishiImageLib ? MeishiImageLib.itemUrl(item) : (item.src || "");
      var span = document.createElement("span");
      span.textContent = item.label || item.file || item.id;
      del.onclick = function () {
        if (!confirm("画像保存ボックスから削除しますか？\n（名刺に設定済みの画像は表示されなくなる場合があります）")) return;
        MeishiStore.removeFromImageLibrary(item.id).then(function () {
          renderImgLibBox();
        });
      };
      wrap.appendChild(del);
      wrap.appendChild(img);
      wrap.appendChild(span);
      box.appendChild(wrap);
    });
  }

  function addImagesToLibrary() {
    var inp = document.getElementById("imgLibFileInput");
    if (inp) inp.click();
  }

  function onImgLibFilesSelected(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    var pending = 0;
    var batch = [];
    Array.prototype.forEach.call(files, function (f, i) {
      if (!f.type || f.type.indexOf("image/") !== 0) return;
      pending++;
      var fr = new FileReader();
      fr.onload = function () {
        var base = f.name.replace(/\.[^.]+$/, "") || "画像";
        batch.push({
          id: "lib-" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 6),
          file: f.name,
          label: base,
          src: fr.result,
        });
        pending--;
        if (pending === 0) finishImgLibBatch(batch);
      };
      fr.onerror = function () {
        pending--;
        if (pending === 0) finishImgLibBatch(batch);
      };
      fr.readAsDataURL(f);
    });
    e.target.value = "";
    if (pending === 0) alert("画像ファイル（PNG/JPG/SVG 等）を選んでください");
  }

  function finishImgLibBatch(batch) {
    if (!batch.length) {
      alert("読み込める画像がありませんでした");
      return;
    }
    MeishiStore.addToImageLibrary(batch).then(function (n) {
      renderImgLibBox();
      if (n > 0) alert(n + " 件を画像保存ボックスに追加しました");
      else alert("選択した画像は既に登録済みです");
      if (n > 0 && !MeishiStore.getImageLibrary().length) {
        alert("画像の保存に失敗した可能性があります。ファイルサイズを小さくして再度お試しください。");
      }
    });
  }

  function defaultUserPageUrl() {
    return MeishiStore.userUrl();
  }

  function refreshUserUrlFields() {
    var url = defaultUserPageUrl();
    document.getElementById("userUrl").value = url;
  }

  function openUserPage() {
    var url = document.getElementById("userUrl").value || defaultUserPageUrl();
    try {
      url = new URL(url, window.location.href).href;
    } catch (e) {
      url = defaultUserPageUrl();
    }
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function showUserQr() {
    var url = document.getElementById("userUrl").value || defaultUserPageUrl();
    var modal = document.getElementById("qrModal");
    var img = document.getElementById("qrImg");
    var label = document.getElementById("qrUrl");
    if (!modal || !img) return;
    img.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(url);
    if (label) label.textContent = url;
    modal.hidden = false;
  }

  function hideUserQr() {
    var modal = document.getElementById("qrModal");
    if (modal) modal.hidden = true;
  }

  function fillCoPick() {
    refreshCoPickOptions();
    fillCoPanel();
  }

  function refreshCoPickOptions() {
    var list = MeishiStore.getCompanyList();
    var sel = document.getElementById("coPick");
    var cur = sel.value || currentCo;
    sel.innerHTML = list.length
      ? list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("")
      : '<option value="">（会社なし）</option>';
    if (cur && list.indexOf(cur) >= 0) sel.value = cur;
    else if (list.length) sel.value = list[0];
    currentCo = sel.value;
  }

  function companyDefaults(co) {
    var cat;
    if (window._coEditingCatalog && MeishiFields.norm(co || currentCo) === MeishiFields.norm(currentCo)) {
      cat = window._coEditingCatalog;
    } else {
      cat = MeishiStore.getCompanyProfileForEdit(co || currentCo).catalog;
    }
    cat = cat || MeishiCatalog.emptyCatalog();
    var loc = (cat.locations && cat.locations[0]) || {};
    return {
      url: (cat.urls && cat.urls[0]) || "",
      postal: loc.postal || "",
      address: loc.address || "",
      tel: loc.tel || "",
      fax: loc.fax || "",
    };
  }

  function cloneCat(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function fillCoPanel() {
    var prevCo = currentCo;
    currentCo = document.getElementById("coPick").value;
    if (!currentCo) return;
    window._coCatalogMutations = [];
    var p = MeishiStore.getCompanyProfileForEdit(currentCo);
    window._coSavedCatalogSnapshot = cloneCat(p.catalog);
    window._coEditingCatalog = cloneCat(p.catalog);
    window._coSyncBaseline = cloneCat(p.catalog);
    if (!window._catCtx || prevCo !== currentCo) {
      window._catCtx = { field: "aff1" };
    }
    renderCatalogEditor(window._coEditingCatalog);
    coLayout = p.layout ? MeishiCatalog.normalizeLayout(MeishiLayout.clone(p.layout)) : MeishiLayout.defLayout();
    coLayoutBack = p.layoutBack && MeishiLayout.isValidBackLayout(p.layoutBack)
      ? MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(p.layoutBack))
      : MeishiLayout.defBackLayout();
    if (coUI && prevCo && prevCo !== currentCo) {
      coUI.invalidate();
      if (coPanel && coPanel.clearSelection) coPanel.clearSelection();
    }
    if (coBackUI && prevCo && prevCo !== currentCo) {
      coBackUI.invalidate();
      if (coBackUI.clearSelection) coBackUI.clearSelection();
    }
    if (coSide === "back") refreshCoBackDesign();
    else refreshCoDesign();
  }

  function renderCatalogEditor(cat) {
    if (!window._coCatalogMutations) window._coCatalogMutations = [];
    MeishiCatalogEditor.render(document.getElementById("coCatalogBody"), cat, function () {
      renderCatalogEditor(cat);
    }, function (op) {
      syncCoCatalogToRecords(op);
    });
  }

  function syncCoCatalogToRecords(explicitOp) {
    if (!window.MeishiCatalogSync || !currentCo || !window._coEditingCatalog) return;
    if (!window._coSyncBaseline) window._coSyncBaseline = cloneCat(window._coEditingCatalog);
    window._coCatalogSyncing = true;
    try {
      var result = MeishiStore.syncRecordsFromCatalogDiff(
        currentCo,
        window._coSyncBaseline,
        window._coEditingCatalog,
        explicitOp || null,
        { skipFireRec: true, skipFireCfg: true }
      );
      if (result.changed) {
        window._coSyncBaseline = cloneCat(window._coEditingCatalog);
        renderRecTable();
        refreshRecFormIfOpen();
        fillDeptPanel();
        if (result.recCount > 0) {
          showSyncStatus("名刺データ " + result.recCount + " 件を更新しました");
        }
      }
    } finally {
      window._coCatalogSyncing = false;
    }
  }

  function collectCoSaveMutations() {
    if (window.MeishiCatalogSync && window._coSyncBaseline && window._coEditingCatalog) {
      return MeishiCatalogSync.inferMutations(window._coSyncBaseline, window._coEditingCatalog);
    }
    return window._coCatalogMutations || [];
  }

  function reloadCoLayoutFromStore() {
    if (!currentCo) return;
    var p = MeishiStore.getCompanyProfileForEdit(currentCo);
    coLayout = p.layout ? MeishiCatalog.normalizeLayout(MeishiLayout.clone(p.layout)) : MeishiLayout.defLayout();
    coLayoutBack = p.layoutBack && MeishiLayout.isValidBackLayout(p.layoutBack)
      ? MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(p.layoutBack))
      : MeishiLayout.defBackLayout();
    if (coUI) coUI.invalidate();
    if (coBackUI) coBackUI.invalidate();
  }

  function afterCoSaveRefresh() {
    window._coCatalogMutations = [];
    reloadCoLayoutFromStore();
    window._coSavedCatalogSnapshot = cloneCat(MeishiStore.getCompanyProfileForEdit(currentCo).catalog);
    window._coEditingCatalog = cloneCat(window._coSavedCatalogSnapshot);
    window._coSyncBaseline = cloneCat(window._coSavedCatalogSnapshot);
    renderCatalogEditor(window._coEditingCatalog);
    refreshRecFormIfOpen();
    renderRecTable();
    fillDeptPanel();
    refreshCoDesign();
    refreshCoBackDesign();
    initPreviewPanel();
  }

  function collectCoProfile() {
    return {
      company: currentCo,
      catalog: cloneCat(window._coEditingCatalog) || MeishiCatalog.emptyCatalog(),
      layout: MeishiCatalog.normalizeLayout(MeishiLayout.clone(coLayout)),
      layoutBack: MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(coLayoutBack || MeishiLayout.defBackLayout())),
    };
  }

  function sampleText(id) {
    var d = companyDefaults(currentCo);
    var m = {
      company: currentCo || "会社名", aff: "所属1　所属2", title: "役職", name: "山田 太郎",
      qual: "資格", koji: "工事件名",
      address: (d.postal ? "〒" + d.postal + " " : "") + (d.address || ""),
      telfax: [d.tel ? "TEL " + d.tel : "", d.fax ? "FAX " + d.fax : ""].filter(Boolean).join("　"),
      mobile: "携帯 090-0000-0000", email: "mail@example.co.jp", url: d.url || "",
    };
    return m[id] || "";
  }

  function deptSampleText(id) {
    var coEl = document.getElementById("deCoPick");
    var co = coEl ? coEl.value : currentCo;
    var d = companyDefaults(co);
    var m = {
      company: co || "会社名", aff: "所属1　所属2", title: "役職", name: "山田 太郎",
      qual: "資格", koji: "工事件名",
      address: (d.postal ? "〒" + d.postal + " " : "") + (d.address || ""),
      telfax: [d.tel ? "TEL " + d.tel : "", d.fax ? "FAX " + d.fax : ""].filter(Boolean).join("　"),
      mobile: "携帯 090-0000-0000", email: "mail@example.co.jp", url: d.url || "",
    };
    return m[id] || "";
  }

  function refreshCoDesign() {
    if (!coLayout) return;
    if (!coUI) {
      coUI = MeishiCardUI.createCardUI({
        cardEl: document.getElementById("coDesCard"),
        getLayout: function () { return coLayout; },
        getElText: sampleText,
        getImages: function () {
          var imgs = coLayout.images || [];
          return window.MeishiImageLib ? MeishiImageLib.resolveImages(imgs) : imgs;
        },
        onLayoutChange: function () {},
        onSelect: function () { if (coPanel) coPanel.showDesign(); },
      });
      coPanel = coUI.bindDesignPanel(document.getElementById("coDesignPanel"));
    }
    ensureCoCenterShift();
    coUI.renderCard();
    if (coPanel) coPanel.showDesign();
    renderCoImgList();
  }

  function ensureCoCenterShift() {
    if (!coLayout) return;
    coLayout.centerShiftMm = MeishiCardUI.clampCenterShiftMm(
      coLayout.centerShiftMm != null ? coLayout.centerShiftMm : 5
    );
  }

  function renderCoImgList() {
    var list = document.getElementById("coImgList");
    if (!list) return;
    list.innerHTML = (coLayout.images || []).map(function (im, i) {
      var src = window.MeishiImageLib ? MeishiImageLib.itemUrl(im) : (im.src || "");
      return "<div class='img-item'><img src='" + esc(src) + "' /><button type='button' data-i='" + i + "' class='linkbtn'>削除</button></div>";
    }).join("");
    list.querySelectorAll("[data-i]").forEach(function (btn) {
      btn.onclick = function () {
        coLayout.images.splice(+btn.getAttribute("data-i"), 1);
        refreshCoDesign();
      };
    });
  }

  function refreshCoBackDesign() {
    if (!coLayoutBack) coLayoutBack = MeishiLayout.defBackLayout();
    if (!coBackUI) {
      coBackUI = MeishiBackCardUI.createBackCardUI({
        cardEl: document.getElementById("coDesCardBack"),
        getLayout: function () { return coLayoutBack; },
        onLayoutChange: function () { renderCoBackImgList(); },
        onSelect: function () { if (coBackPanel) coBackPanel.showDesign(); },
      });
      coBackPanel = coBackUI.bindBackDesignPanel(document.getElementById("coBackDesignPanel"));
    }
    coBackUI.renderCard();
    if (coBackPanel) coBackPanel.showDesign();
    renderCoBackImgList();
  }

  function renderCoBackImgList() {
    var list = document.getElementById("coBackImgList");
    if (!list || !coLayoutBack) return;
    list.innerHTML = (coLayoutBack.images || []).map(function (im, i) {
      var src = window.MeishiImageLib ? MeishiImageLib.itemUrl(im) : (im.src || "");
      return "<div class='img-item'><img src='" + esc(src) + "' /><button type='button' data-i='" + i + "' class='linkbtn'>削除</button></div>";
    }).join("");
    list.querySelectorAll("[data-i]").forEach(function (btn) {
      btn.onclick = function () {
        coLayoutBack.images.splice(+btn.getAttribute("data-i"), 1);
        if (coBackUI) coBackUI.invalidate();
        refreshCoBackDesign();
      };
    });
  }

  function getDeptPickers() {
    return {
      co: document.getElementById("deCoPick").value,
      aff1: document.getElementById("deAff1Pick").value,
      aff2: document.getElementById("deAff2Pick").value,
    };
  }

  function fillDeptPanel() {
    var list = MeishiStore.getCompanyList();
    var coSel = document.getElementById("deCoPick");
    var curCo = coSel.value;
    coSel.innerHTML = list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
    if (curCo && list.indexOf(curCo) >= 0) coSel.value = curCo;
    fillDeptAff1();
  }

  function fillDeptAff1() {
    var pk = getDeptPickers();
    var curA1 = pk.aff1;
    var affs = MeishiStore.getAff1List(pk.co);
    var sel = document.getElementById("deAff1Pick");
    sel.innerHTML = affs.length
      ? affs.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("")
      : '<option value="">（なし）</option>';
    if (curA1 && affs.indexOf(curA1) >= 0) sel.value = curA1;
    fillDeptAff2();
  }

  function fillDeptAff2() {
    var pk = getDeptPickers();
    pk.aff1 = document.getElementById("deAff1Pick").value;
    var sel = document.getElementById("deAff2Pick");
    var curA2 = sel.value;
    var affs = pk.aff1 ? MeishiStore.getAff2List(pk.co, pk.aff1) : [];
    var html = '<option value="">（所属1共通）</option>';
    html += affs.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
    sel.innerHTML = html;
    if (!pk.aff1) {
      sel.disabled = true;
      sel.value = "";
    } else {
      sel.disabled = false;
      if (curA2 === "" || affs.indexOf(curA2) >= 0) sel.value = curA2;
      else sel.value = "";
    }
    fillDeptReadonly();
    currentDeptKey = "";
    loadDeptLayout();
    if (deSide === "back") refreshDeptBackDesign(false);
    else refreshDeptDesign(false);
  }

  function fillDeptReadonly() {
    var pk = getDeptPickers();
    pk.aff1 = document.getElementById("deAff1Pick").value;
    pk.aff2 = document.getElementById("deAff2Pick").value;
    var d = companyDefaults(pk.co);
    var p = MeishiStore.getCompanyProfile(pk.co);
    var cat = p.catalog || {};
    var summary = document.getElementById("deRoSummary");
    var aff2Label = pk.aff2 ? pk.aff2 : "（所属1共通）";
    summary.innerHTML =
      "<div><strong>選択:</strong> " + esc(pk.co) + " / " + esc(pk.aff1 || "—") + " / " + esc(aff2Label) + "</div>";
    if (!pk.aff2 && pk.aff1) {
      var aff2list = MeishiCatalog.getAff2List(cat, pk.aff1);
      summary.innerHTML += "<div class='hint'>この設定は「" + esc(pk.aff1) + "」配下の所属2";
      if (aff2list.length) summary.innerHTML += "（" + esc(aff2list.join("、")) + "）";
      summary.innerHTML += "すべてに適用されます。</div>";
    }
    summary.innerHTML +=
      "<div><strong>URL:</strong> " + esc(d.url || "—") + "</div>" +
      "<div><strong>郵便番号:</strong> " + esc(d.postal || "—") + " / <strong>住所:</strong> " + esc(d.address || "—") + "</div>" +
      "<div><strong>TEL:</strong> " + esc(d.tel || "—") + " / <strong>FAX:</strong> " + esc(d.fax || "—") + "</div>";

    var catHtml = "<div><strong>所属1:</strong> " + esc((cat.aff1 || []).join("、")) + "</div>";
    if (pk.aff1) {
      catHtml += "<div><strong>所属2（" + esc(pk.aff1) + "）:</strong> " + esc(MeishiCatalog.getAff2List(cat, pk.aff1).join("、")) + "</div>";
    }
    if (pk.aff1 && pk.aff2) {
      catHtml += "<div><strong>所属3:</strong> " + esc(MeishiCatalog.getAff3List(cat, pk.aff1, pk.aff2).join("、")) + "</div>";
    }
    document.getElementById("deRoCatalog").innerHTML = catHtml;
  }

  function newDeptLayout() {
    var layout = MeishiLayout.defLayout();
    MeishiLayout.ELS.forEach(function (e) {
      if (layout.el[e.id]) layout.el[e.id].hidden = true;
    });
    layout.images = [];
    return layout;
  }

  function loadDeptLayout() {
    var pk = getDeptPickers();
    pk.aff1 = document.getElementById("deAff1Pick").value;
    pk.aff2 = document.getElementById("deAff2Pick").value;
    var key = MeishiFields.deptKey(pk.co, pk.aff1, pk.aff2);
    if (key === currentDeptKey && deLayout) return;
    currentDeptKey = key;
    deCoLayout = MeishiCatalog.normalizeLayout(MeishiLayout.clone(MeishiStore.getCompanyLayout(pk.co)));
    deCoLayoutBack = MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(MeishiStore.getCompanyLayoutBack(pk.co)));
    var dept = MeishiStore.getDeptSettingsForEdit(pk.co, pk.aff1, pk.aff2);
    if (dept.layout && MeishiLayout.isValidLayout(dept.layout)) {
      deLayout = MeishiCatalog.normalizeLayout(MeishiLayout.clone(dept.layout));
      if (!(deLayout.images && deLayout.images.length) && dept.images && dept.images.length) {
        deLayout.images = MeishiLayout.clone(dept.images);
      }
    } else if (dept.images && dept.images.length) {
      deLayout = newDeptLayout();
      deLayout.images = MeishiLayout.clone(dept.images);
    } else {
      deLayout = newDeptLayout();
    }
    if (dept.layoutBack && MeishiLayout.isValidBackLayout(dept.layoutBack)) {
      deLayoutBack = MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(dept.layoutBack));
    } else {
      deLayoutBack = MeishiLayout.defBackLayout();
    }
    if (deCoUI) deCoUI.invalidate();
    if (deUI) deUI.invalidate();
    if (deCoBackUI) deCoBackUI.invalidate();
    if (deBackUI) deBackUI.invalidate();
  }

  function reloadDeptLayoutFromStore() {
    currentDeptKey = "";
    loadDeptLayout();
  }

  function afterDeptSaveRefresh() {
    reloadDeptLayoutFromStore();
    if (deCoUI) deCoUI.invalidate();
    if (deCoBackUI) deCoBackUI.invalidate();
    if (deSide === "back") refreshDeptBackDesign();
    else refreshDeptDesign();
  }

  function collectDeptProfile() {
    var pk = getDeptPickers();
    pk.aff1 = document.getElementById("deAff1Pick").value;
    pk.aff2 = document.getElementById("deAff2Pick").value;
    if (!deLayout) loadDeptLayout();
    if (!deLayout) deLayout = newDeptLayout();
    if (!deLayoutBack) loadDeptLayout();
    if (!deLayoutBack) deLayoutBack = MeishiLayout.defBackLayout();
    return {
      company: pk.co,
      aff1: pk.aff1,
      aff2: pk.aff2,
      layout: MeishiCatalog.normalizeLayout(MeishiLayout.clone(deLayout)),
      layoutBack: MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(deLayoutBack)),
    };
  }

  function saveCurrentDeptLayout() {
    var pk = getDeptPickers();
    pk.aff1 = document.getElementById("deAff1Pick").value;
    pk.aff2 = document.getElementById("deAff2Pick").value;
    if (!pk.co || !pk.aff1) {
      alert("会社と所属1を選択してください");
      return false;
    }
    window._deptSaving = true;
    try {
      return MeishiStore.saveDeptSettings(pk.co, pk.aff1, pk.aff2, collectDeptProfile());
    } finally {
      window._deptSaving = false;
    }
  }

  function refreshDeptDesign(forceReload) {
    if (forceReload) reloadDeptLayoutFromStore();
    else if (!deLayout) loadDeptLayout();
    var pk = getDeptPickers();
    pk.co = document.getElementById("deCoPick").value;
    pk.aff1 = document.getElementById("deAff1Pick").value;
    pk.aff2 = document.getElementById("deAff2Pick").value;
    if (!pk.co) return;
    deCoLayout = MeishiCatalog.normalizeLayout(MeishiLayout.clone(MeishiStore.getCompanyLayout(pk.co)));

    if (!deCoUI) {
      deCoUI = MeishiCardUI.createCardUI({
        cardEl: document.getElementById("deCoBaseCard"),
        getLayout: function () { return deCoLayout; },
        getElText: deptSampleText,
        getImages: function () {
          var imgs = deCoLayout.images || [];
          return window.MeishiImageLib ? MeishiImageLib.resolveImages(imgs) : imgs;
        },
        readOnly: true,
        onLayoutChange: function () {},
        onSelect: function () {},
      });
    }
    if (!deUI) {
      deUI = MeishiCardUI.createCardUI({
        cardEl: document.getElementById("deDesCard"),
        getLayout: function () { return deLayout; },
        getElText: deptSampleText,
        getImages: function () {
          var imgs = deLayout.images || [];
          return window.MeishiImageLib ? MeishiImageLib.resolveImages(imgs) : imgs;
        },
        hideElements: true,
        snapExtraCardEl: document.getElementById("deCoBaseCard"),
        onLayoutChange: function () { renderDeImgList(); },
        onSelect: function () {
          var none = document.getElementById("deDesignNone");
          var ctl = document.getElementById("deDesignCtl");
          if (none) none.style.display = "none";
          if (ctl) ctl.style.display = "";
          var tgt = document.getElementById("deDesTarget");
          if (tgt) tgt.textContent = "部署画像（ドラッグで移動・右下でサイズ変更）";
        },
      });
    }
    deCoUI.renderCard();
    deUI.renderCard();
    renderDeImgList();
  }

  function renderDeImgList() {
    var list = document.getElementById("deImgList");
    if (!list || !deLayout) return;
    list.innerHTML = (deLayout.images || []).map(function (im, i) {
      var src = window.MeishiImageLib ? MeishiImageLib.itemUrl(im) : (im.src || "");
      return "<div class='img-item'><img src='" + esc(src) + "' /><button type='button' data-i='" + i + "' class='linkbtn'>削除</button></div>";
    }).join("");
    list.querySelectorAll("[data-i]").forEach(function (btn) {
      btn.onclick = function () {
        deLayout.images.splice(+btn.getAttribute("data-i"), 1);
        if (deUI) deUI.invalidate();
        refreshDeptDesign();
      };
    });
  }

  function refreshDeptBackDesign(forceReload) {
    if (forceReload) reloadDeptLayoutFromStore();
    else if (!deLayoutBack) loadDeptLayout();
    var pk = getDeptPickers();
    pk.co = document.getElementById("deCoPick").value;
    pk.aff1 = document.getElementById("deAff1Pick").value;
    pk.aff2 = document.getElementById("deAff2Pick").value;
    if (!pk.co) return;
    deCoLayoutBack = MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(MeishiStore.getCompanyLayoutBack(pk.co)));

    if (!deCoBackUI) {
      deCoBackUI = MeishiBackCardUI.createBackCardUI({
        cardEl: document.getElementById("deCoBaseCardBack"),
        getLayout: function () { return deCoLayoutBack; },
        readOnly: true,
        onLayoutChange: function () {},
        onSelect: function () {},
      });
    }
    if (!deBackUI) {
      deBackUI = MeishiBackCardUI.createBackCardUI({
        cardEl: document.getElementById("deDesCardBack"),
        getLayout: function () { return deLayoutBack; },
        snapExtraCardEl: document.getElementById("deCoBaseCardBack"),
        onLayoutChange: function () { renderDeBackImgList(); },
        onSelect: function () {
          var none = document.getElementById("deBackDesignNone");
          var ctl = document.getElementById("deBackDesignCtl");
          if (none) none.style.display = "none";
          if (ctl) ctl.style.display = "";
          if (deBackPanel) deBackPanel.showDesign();
        },
      });
      deBackPanel = deBackUI.bindBackDesignPanel(document.getElementById("deBackDesignPanel"), {
        content: "deBackDesContent",
        size: "deBackDesSize",
        sizeV: "deBackDesSizeV",
        color: "deBackDesColor",
        norm: "deBackDesNorm",
        bold: "deBackDesBold",
        ctl: "deBackDesignCtl",
        none: "deBackDesignNone",
        alignAttr: "data-de-back-al",
      });
    }
    deCoBackUI.renderCard();
    deBackUI.renderCard();
    if (deBackPanel) deBackPanel.showDesign();
    renderDeBackImgList();
  }

  function renderDeBackImgList() {
    var list = document.getElementById("deBackImgList");
    if (!list || !deLayoutBack) return;
    list.innerHTML = (deLayoutBack.images || []).map(function (im, i) {
      var src = window.MeishiImageLib ? MeishiImageLib.itemUrl(im) : (im.src || "");
      return "<div class='img-item'><img src='" + esc(src) + "' /><button type='button' data-i='" + i + "' class='linkbtn'>削除</button></div>";
    }).join("");
    list.querySelectorAll("[data-i]").forEach(function (btn) {
      btn.onclick = function () {
        deLayoutBack.images.splice(+btn.getAttribute("data-i"), 1);
        if (deBackUI) deBackUI.invalidate();
        refreshDeptBackDesign();
      };
    });
  }

  function renderRecTable() {
    var recs = MeishiStore.getRecords();
    document.getElementById("recCount").textContent = recs.length + " 件";
    document.querySelector("#recTbl thead").innerHTML =
      "<tr>" + MeishiFields.COLUMNS.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + "</tr>";
    var q = recFilter.toLowerCase();
    document.querySelector("#recTbl tbody").innerHTML = recs.map(function (r, i) {
      var txt = MeishiFields.COLUMNS.map(function (c) { return r[c.key] || ""; }).join(" ");
      if (q && txt.toLowerCase().indexOf(q) < 0) return "";
      return "<tr data-i='" + i + "' class='" + (i === editRecIdx ? "sel" : "") + "'>" +
        MeishiFields.COLUMNS.map(function (c) { return "<td>" + esc(r[c.key] || "") + "</td>"; }).join("") + "</tr>";
    }).join("");
  }

  function fieldOptions(company, key, ctx) {
    var cat;
    if (window._coEditingCatalog && MeishiFields.norm(company) === MeishiFields.norm(currentCo)) {
      cat = window._coEditingCatalog;
    } else {
      cat = MeishiStore.getCompanyProfileForEdit(company).catalog || MeishiCatalog.emptyCatalog();
    }
    if (key === "company") return MeishiStore.getCompanyList();
    if (key === "aff1") return cat.aff1 || [];
    if (key === "aff2") return MeishiCatalog.getAff2List(cat, ctx.aff1);
    if (key === "aff3") return MeishiCatalog.getAff3List(cat, ctx.aff1, ctx.aff2);
    if (key === "title") return MeishiCatalog.getTitleList(cat, ctx.aff1, ctx.aff2, ctx.aff3);
    if (key === "postal") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.postal; }).concat(cat.postal || []));
    if (key === "address") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.address; }).filter(Boolean));
    if (key === "tel") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.tel; }).filter(Boolean));
    if (key === "fax") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.fax; }).filter(Boolean));
    if (key === "url") return cat.urls || [];
    if (key === "category") return cat.categories || [];
    return [];
  }

  function textFieldHtml(c, rec) {
    return "<div class='field'><label>" + c.label + "</label><input type='text' data-k='" + c.key + "' value='" + esc(rec[c.key] || "") + "' /></div>";
  }

  function selectFieldHtml(c, rec, ctx) {
    var opts = fieldOptions(ctx.company || rec.company, c.key, ctx);
    var cur = rec[c.key] || "";
    var html = "<option value=''>（選択）</option>";
    if (cur) {
      var inOpts = opts.some(function (v) { return MeishiFields.norm(v) === MeishiFields.norm(cur); });
      if (!inOpts) html += "<option selected>" + esc(cur) + "</option>";
    }
    opts.forEach(function (v) {
      html += "<option" + (MeishiFields.norm(v) === MeishiFields.norm(cur) ? " selected" : "") + ">" + esc(v) + "</option>";
    });
    return "<div class='field'><label>" + c.label + "</label><select data-k='" + c.key + "'>" + html + "</select></div>";
  }

  function refreshRecFormIfOpen() {
    var card = document.getElementById("recFormCard");
    if (!card || card.style.display === "none") return;
    var rec;
    if (editRecIdx >= 0 && !copySourceRec) {
      var rows = MeishiStore.getRecords();
      rec = editRecIdx < rows.length
        ? Object.assign({}, MeishiFields.emptyRecord(), rows[editRecIdx])
        : readRecFromForm();
    } else {
      rec = readRecFromForm();
    }
    rebuildRecFormFields(rec);
  }

  function readRecFormCtx() {
    var g = function (k) {
      var el = document.querySelector("#recFormFields [data-k='" + k + "']");
      return el ? (el.tagName === "SELECT" || el.tagName === "INPUT" ? el.value.trim() : "") : "";
    };
    return { company: g("company"), aff1: g("aff1"), aff2: g("aff2"), aff3: g("aff3"), title: g("title"), postal: g("postal") };
  }

  function rebuildRecFormFields(rec) {
    rec = rec || MeishiFields.emptyRecord();
    var ctx = {
      company: rec.company, aff1: rec.aff1, aff2: rec.aff2, aff3: rec.aff3, title: rec.title, postal: rec.postal,
    };
    var html = "";
    MeishiFields.COLUMNS.forEach(function (c) {
      if (c.key === "no") {
        html += "<div class='field'><label>" + c.label + "</label><input data-k='no' value='" + esc(rec.no || "") + "' readonly /></div>";
        return;
      }
      if (REC_TEXT_INPUT_KEYS[c.key]) {
        html += textFieldHtml(c, rec);
        return;
      }
      html += selectFieldHtml(c, rec, ctx);
    });
    document.getElementById("recFormFields").innerHTML = html;
    document.querySelectorAll("#recFormFields select[data-k]").forEach(function (sel) {
      sel.addEventListener("change", onRecFieldChange);
    });
    applyLocAuto();
  }

  function onRecFieldChange(ev) {
    var rec = readRecFromForm();
    var k = ev.target.getAttribute("data-k");
    if (k === "company") { rec.aff1 = rec.aff2 = rec.aff3 = rec.title = ""; }
    if (k === "aff1") { rec.aff2 = rec.aff3 = rec.title = ""; }
    if (k === "aff2") { rec.aff3 = rec.title = ""; }
    if (k === "aff3") rec.title = "";
    rebuildRecFormFields(rec);
  }

  function applyLocAuto() {
    var co = (document.querySelector("[data-k='company']") || {}).value;
    var po = (document.querySelector("[data-k='postal']") || {}).value;
    if (!co || !po) return;
    var p = MeishiStore.getCompanyProfileForEdit(co);
    var loc = (p.catalog.locations || []).find(function (l) { return l.postal === po; });
    if (!loc) return;
    function setSel(k, v) {
      if (!v) return;
      var el = document.querySelector("#recFormFields [data-k='" + k + "']");
      if (!el || el.tagName !== "SELECT") return;
      var hit = false;
      Array.prototype.forEach.call(el.options, function (opt) {
        if (MeishiFields.norm(opt.value) === MeishiFields.norm(v)) { opt.selected = true; hit = true; }
      });
      if (!hit) {
        var o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        o.selected = true;
        el.appendChild(o);
      }
    }
    setSel("address", loc.address);
    setSel("tel", loc.tel);
    setSel("fax", loc.fax);
  }

  function readRecFromForm() {
    var rec = MeishiFields.emptyRecord();
    document.querySelectorAll("#recFormFields [data-k]").forEach(function (el) {
      rec[el.getAttribute("data-k")] = el.value.trim();
    });
    return rec;
  }

  function openRecForm(idx, copyFrom) {
    editRecIdx = idx;
    copySourceRec = copyFrom || null;
    var rec;
    if (copyFrom) {
      rec = JSON.parse(JSON.stringify(copyFrom));
      rec.no = MeishiStore.nextRecordNo();
      document.getElementById("recFormTitle").textContent = "データコピー（新規番号 " + rec.no + "）";
    } else if (idx >= 0) {
      rec = Object.assign({}, MeishiFields.emptyRecord(), MeishiStore.getRecords()[idx]);
      document.getElementById("recFormTitle").textContent = "行 #" + rec.no + " を編集";
    } else {
      rec = MeishiFields.emptyRecord();
      rec.no = MeishiStore.nextRecordNo();
      document.getElementById("recFormTitle").textContent = "新規行（番号 " + rec.no + "）";
    }
    rebuildRecFormFields(rec);
    document.getElementById("recFormCard").style.display = "";
    renderRecTable();
  }

  function bindEvents() {
    document.getElementById("tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tab]");
      if (b) showTab(b.getAttribute("data-tab"));
    });
    document.getElementById("btnSaveBasic").onclick = function () {
      MeishiStore.saveConfig({
        title: document.getElementById("title").value.trim() || "名刺印刷システム",
        ownerId: document.getElementById("ownerId").value.trim(),
        ownerPass: document.getElementById("ownerPass").value,
      });
      alert("保存しました");
    };
    document.getElementById("btnCopy").onclick = function () {
      var url = document.getElementById("userUrl").value || defaultUserPageUrl();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { alert("URLをコピーしました"); }).catch(function () {});
      } else {
        var inp = document.getElementById("userUrl");
        inp.focus();
        inp.select();
        try { document.execCommand("copy"); alert("URLをコピーしました"); } catch (e) {}
      }
    };
    document.getElementById("btnQr").onclick = showUserQr;
    document.getElementById("btnQrClose").onclick = hideUserQr;
    document.getElementById("qrModal").onclick = function (e) {
      if (e.target === document.getElementById("qrModal")) hideUserQr();
    };
    document.getElementById("btnOpen").onclick = openUserPage;
    document.getElementById("btnImgLibAdd").onclick = addImagesToLibrary;
    document.getElementById("imgLibFileInput").onchange = onImgLibFilesSelected;
    document.getElementById("coPick").onchange = fillCoPanel;
    document.getElementById("btnCoAdd").onclick = function () {
      var n = document.getElementById("coNewName").value.trim();
      if (!n) return alert("会社名を入力してください");
      MeishiStore.addCompany(n);
      document.getElementById("coNewName").value = "";
      fillCoPick();
      document.getElementById("coPick").value = n;
      fillCoPanel();
    };
    document.getElementById("btnCoRename").onclick = function () {
      var n = document.getElementById("coRename").value.trim();
      if (!n) return;
      try {
        MeishiStore.renameCompany(currentCo, n);
        fillCoPick();
        document.getElementById("coPick").value = n;
        fillCoPanel();
        alert("会社名を変更しました");
      } catch (e) { alert(e.message || e); }
    };
    document.getElementById("btnCoDel").onclick = function () {
      if (!confirm("会社共通設定「" + currentCo + "」を削除しますか？\n（名刺データ行は残ります）")) return;
      MeishiStore.deleteCompany(currentCo);
      fillCoPick();
    };
    document.getElementById("btnCoSyncCat").onclick = function () {
      window._coEditingCatalog = MeishiCatalog.mergeCatalog(
        MeishiCatalog.buildCatalogFromRecords(MeishiStore.getRecords(), currentCo),
        window._coEditingCatalog || MeishiCatalog.emptyCatalog()
      );
      MeishiStore.saveCompanyProfile(currentCo, collectCoProfile(), collectCoSaveMutations());
      afterCoSaveRefresh();
      alert("名刺データからマスタを取り込み、関連データを更新しました");
    };
    document.getElementById("btnSaveCo").onclick = function () {
      syncCoCatalogToRecords(null);
      var pending = collectCoSaveMutations();
      MeishiStore.saveCompanyProfile(currentCo, collectCoProfile(), pending);
      afterCoSaveRefresh();
      alert("会社共通を保存し、関連データを更新しました");
    };
    document.getElementById("btnCoImgPick").onclick = function () {
      pickImagesIntoLayout(coLayout, "co", function () { refreshCoDesign(); });
    };
    document.getElementById("btnCoDesReset").onclick = function () {
      if (!confirm("デザインを初期化しますか？")) return;
      coLayout = MeishiLayout.defLayout();
      if (coUI) coUI.invalidate();
      refreshCoDesign();
    };
    document.getElementById("btnCoBackText").onclick = function () {
      if (!coLayoutBack) coLayoutBack = MeishiLayout.defBackLayout();
      coLayoutBack.texts = coLayoutBack.texts || [];
      var block = MeishiLayout.defTextBlock(coLayoutBack.texts.length);
      coLayoutBack.texts.push(block);
      if (coBackUI) coBackUI.invalidate();
      refreshCoBackDesign();
      if (coBackUI && coBackUI.editTextById) coBackUI.editTextById(block.id, true);
    };
    document.getElementById("btnCoBackImgPick").onclick = function () {
      if (!coLayoutBack) coLayoutBack = MeishiLayout.defBackLayout();
      pickImagesIntoBackLayout(coLayoutBack, "co-back", function () {
        if (coBackUI) coBackUI.invalidate();
        refreshCoBackDesign();
      });
    };
    document.getElementById("btnCoBackDesReset").onclick = function () {
      if (!confirm("裏面デザインを初期化しますか？")) return;
      coLayoutBack = MeishiLayout.defBackLayout();
      if (coBackUI) coBackUI.invalidate();
      refreshCoBackDesign();
    };
    bindSideToggle("coSideToggle", switchCoSide);
    bindSideToggle("deSideToggle", switchDeSide);
    document.getElementById("deCoPick").onchange = function () { currentDeptKey = ""; fillDeptAff1(); };
    document.getElementById("deAff1Pick").onchange = function () { currentDeptKey = ""; fillDeptAff2(); };
    document.getElementById("deAff2Pick").onchange = function () { currentDeptKey = ""; fillDeptAff2(); };
    document.getElementById("btnSaveDept").onclick = function () {
      var ok = saveCurrentDeptLayout();
      if (ok === false) return;
      if (!ok) return alert("保存に失敗しました。ストレージ容量などをご確認ください。");
      afterDeptSaveRefresh();
      alert("部署共通を保存しました");
    };
    document.getElementById("btnDeDesReset").onclick = function () {
      if (!confirm("この部署の追加画像をすべて削除しますか？")) return;
      deLayout = newDeptLayout();
      if (deUI) deUI.invalidate();
      refreshDeptDesign();
    };
    document.getElementById("btnDeImgPick").onclick = function () {
      var pk = getDeptPickers();
      pk.aff1 = document.getElementById("deAff1Pick").value;
      if (!pk.co || !pk.aff1) return alert("会社と所属1を選択してください");
      if (!deLayout) loadDeptLayout();
      pickImagesIntoLayout(deLayout, "dept", function () {
        if (deUI) deUI.invalidate();
        refreshDeptDesign();
      });
    };
    document.getElementById("btnDeBackText").onclick = function () {
      var pk = getDeptPickers();
      pk.aff1 = document.getElementById("deAff1Pick").value;
      if (!pk.co || !pk.aff1) return alert("会社と所属1を選択してください");
      if (!deLayoutBack) loadDeptLayout();
      if (!deLayoutBack) deLayoutBack = MeishiLayout.defBackLayout();
      deLayoutBack.texts = deLayoutBack.texts || [];
      var block = MeishiLayout.defTextBlock(deLayoutBack.texts.length);
      deLayoutBack.texts.push(block);
      if (deBackUI) deBackUI.invalidate();
      refreshDeptBackDesign();
      if (deBackUI && deBackUI.editTextById) deBackUI.editTextById(block.id, true);
    };
    document.getElementById("btnDeBackImgPick").onclick = function () {
      var pk = getDeptPickers();
      pk.aff1 = document.getElementById("deAff1Pick").value;
      if (!pk.co || !pk.aff1) return alert("会社と所属1を選択してください");
      if (!deLayoutBack) loadDeptLayout();
      if (!deLayoutBack) deLayoutBack = MeishiLayout.defBackLayout();
      pickImagesIntoBackLayout(deLayoutBack, "dept-back", function () {
        if (deBackUI) deBackUI.invalidate();
        refreshDeptBackDesign();
      });
    };
    document.getElementById("btnDeBackDesReset").onclick = function () {
      if (!confirm("この部署の裏面追加（テキスト・画像）をすべて削除しますか？")) return;
      deLayoutBack = MeishiLayout.defBackLayout();
      if (deBackUI) deBackUI.invalidate();
      refreshDeptBackDesign();
    };
    document.getElementById("recSearch").oninput = function () { recFilter = this.value; renderRecTable(); };
    document.querySelector("#recTbl tbody").addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-i]");
      if (tr) openRecForm(+tr.getAttribute("data-i"));
    });
    document.getElementById("btnRecNew").onclick = function () { copySourceRec = null; openRecForm(-1); };
    document.getElementById("btnRecCopy").onclick = function () {
      if (editRecIdx < 0) return alert("コピー元の行を一覧から選んでください");
      openRecForm(-1, MeishiStore.getRecords()[editRecIdx]);
    };
    document.getElementById("btnRecCancel").onclick = function () {
      editRecIdx = -1; copySourceRec = null;
      document.getElementById("recFormCard").style.display = "none";
      renderRecTable();
    };
    document.getElementById("btnRecSave").onclick = function () {
      var rec = readRecFromForm();
      if (!rec.name) return alert("氏名を入力してください");
      if (!rec.company) return alert("会社を選択してください");
      if (copySourceRec && MeishiCatalog.recordsEqual(rec, copySourceRec, true)) {
        return alert("コピー元と内容が同一のため登録できません。変更してから保存してください。");
      }
      if (editRecIdx >= 0 && !copySourceRec) MeishiStore.updateRecord(editRecIdx, rec);
      else MeishiStore.addRecord(rec);
      editRecIdx = -1; copySourceRec = null;
      document.getElementById("recFormCard").style.display = "none";
      fillCoPick();
      renderRecTable();
      alert("保存しました");
    };
    document.getElementById("btnRecDel").onclick = function () {
      if (editRecIdx < 0 || copySourceRec) return;
      if (!confirm("削除しますか？")) return;
      MeishiStore.deleteRecord(editRecIdx);
      editRecIdx = -1;
      document.getElementById("recFormCard").style.display = "none";
      fillCoPick();
      renderRecTable();
    };
    document.getElementById("selRecNo").onchange = function () {
      var idx = MeishiStore.findRecordByNo(this.value);
      if (idx >= 0) openRecForm(idx);
    };
  }

  window.OwnerAdmin = {
    init: async function () {
      bindEvents();
      refreshUserUrlFields();
      try { await MeishiStore.init(); } catch (e) {
        alert(e.message || e);
        refreshUserUrlFields();
        return;
      }
      setBadge();
      fillBasic();
      fillCoPick();
      fillDeptPanel();
      renderRecTable();
      var nos = MeishiStore.getRecords().map(function (r) { return r.no; }).filter(Boolean);
      document.getElementById("selRecNo").innerHTML =
        "<option value=''>行番号で選択</option>" + nos.map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("");
      MeishiStore.onConfigChange(function () {
        if (window._coCatalogSyncing || window._deptSaving) return;
        fillBasic();
        refreshCoPickOptions();
        var deptOn = document.getElementById("panel-dept") && document.getElementById("panel-dept").classList.contains("on");
        if (!deptOn) fillDeptPanel();
        refreshRecFormIfOpen();
        var prevOn = document.getElementById("panel-preview") && document.getElementById("panel-preview").classList.contains("on");
        if (prevOn) initPreviewPanel();
      });
      MeishiStore.onRecordsChange(function () {
        refreshCoPickOptions();
        renderRecTable();
        refreshRecFormIfOpen();
        var nos2 = MeishiStore.getRecords().map(function (r) { return r.no; }).filter(Boolean);
        document.getElementById("selRecNo").innerHTML =
          "<option value=''>行番号で選択</option>" + nos2.map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("");
      });
      applyPreviewOnlyMode();
    },
  };
})();
