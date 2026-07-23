/**
 * 所有者画面ロジック
 */
(function () {
  var editRecIdx = -1;
  var copySourceRec = null;
  var recFilter = "";

  var REC_TEXT_INPUT_KEYS = { name: 1, furigana: 1, qual: 1, mobile: 1, email: 1 };
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
    if (MeishiStore.useFirebase() && MeishiStore.firebaseAuthLoaded()) {
      b.textContent = MeishiStore.firebaseConfigLoaded() ? "全端末で共有中" : "同期中…";
      b.style.background = "rgba(40,180,99,.35)";
    } else if (MeishiStore.useFirebase()) {
      b.textContent = "同期未完了";
      b.style.background = "rgba(243,156,18,.35)";
    } else {
      b.textContent = "この端末のみ";
      b.style.background = "rgba(243,156,18,.35)";
    }
  }

  function syncRemoteAfterSave() {
    if (!MeishiStore.syncAllToRemote) return;
    void MeishiStore.syncAllToRemote().then(function () { setBadge(); });
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
    if (window.MEISHI_ADMIN_PAGE && (id === "company" || id === "dept" || id === "records")) {
      refreshCoPickOptions();
    }
    if (id === "company") {
      if (coSide === "back") refreshCoBackDesign();
      else refreshCoDesign();
      applyAdminUiLocks();
    }
    if (id === "dept") {
      fillDeptPanel();
      if (deSide === "back") refreshDeptBackDesign(true);
      else refreshDeptDesign(true);
      applyAdminUiLocks();
    }
    if (id === "preview") initPreviewPanel();
    if (id === "records") {
      renderRecTable();
      refreshRecFormIfOpen();
      applyAdminUiLocks();
    }
  }

  function applyAdminUiLocks() {
    if (!window.MEISHI_ADMIN_PAGE) return;
    var can = !!(currentCo && MeishiStore.adminCanEditCompany && MeishiStore.adminCanEditCompany(currentCo));
    [
      "btnSaveCoCatalog", "btnSaveCoDesign", "btnCoAdd", "btnCoRename", "btnCoDel", "btnCoSyncCat",
      "btnCoFrontText", "btnCoImgPick", "btnCoFrontDivider", "btnCoDesReset",
      "btnCoBackText", "btnCoBackImgPick", "btnCoBackDivider", "btnCoBackDesReset",
      "btnSaveDept", "btnRecSave", "btnRecDel", "btnRecAdd"
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !can;
    });
    var hint = document.getElementById("adminEditHint");
    if (hint) {
      hint.style.display = can || !currentCo ? "none" : "";
      hint.textContent = "この会社は担当外です。編集は担当会社のみ可能です。他社の印刷は「プレビュー」タブから行えます。";
    }
  }

  function setupAdminShell() {
    if (!window.MEISHI_ADMIN_PAGE) return;
    var basic = document.getElementById("panel-basic");
    if (basic) {
      basic.innerHTML =
        '<div class="card"><h2>担当者メニュー</h2>' +
        '<p class="hint" id="adminWho"></p>' +
        '<p class="hint">担当会社のデザイン・データは「会社共通」「部署共通」「名刺データ」で編集できます。' +
        '担当外の会社は「プレビュー」から選択して印刷のみ可能です。</p>' +
        '<p class="hint" id="adminEditHint" style="display:none;color:#b3261e"></p>' +
        '<button type="button" class="btn sm danger" id="btnAdminLogout">ログアウト</button></div>' +
        '<div class="card"><h2>画像保存ボックス（担当会社）</h2>' +
        '<p class="hint">担当会社ごとの画像を登録します。</p>' +
        '<div class="btn-row">' +
        '<select id="imgLibCoPick" style="max-width:280px"></select>' +
        '<button type="button" class="btn sm" id="btnImgLibAdd">＋ 追加</button>' +
        '<button type="button" class="btn sm ghost" id="btnImgLibRecover">画像を復元</button>' +
        '<input type="file" id="imgLibFileInput" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple hidden />' +
        "</div>" +
        '<div id="imgLibBox" class="img-lib-box empty">（未登録）</div></div>';
      var btn = document.getElementById("btnAdminLogout");
      if (btn) {
        btn.onclick = function () {
          MeishiStore.clearAdminSession();
          location.reload();
        };
      }
      var imgLibCoPick = document.getElementById("imgLibCoPick");
      if (imgLibCoPick) {
        imgLibCoPick.onchange = function () {
          getImgLibCompany();
          renderImgLibBox();
        };
      }
      var addBtn = document.getElementById("btnImgLibAdd");
      if (addBtn) addBtn.onclick = addImagesToLibrary;
      var recBtn = document.getElementById("btnImgLibRecover");
      if (recBtn) recBtn.onclick = recoverImagesFromBackup;
      var fileInp = document.getElementById("imgLibFileInput");
      if (fileInp) fileInp.onchange = onImgLibFilesSelected;
      fillImgLibCoPick();
      // 担当会社のみ
      if (MeishiStore.adminCanEditCompany) {
        var sel = document.getElementById("imgLibCoPick");
        if (sel) {
          [].slice.call(sel.options).forEach(function (opt) {
            if (!MeishiStore.adminCanEditCompany(opt.value)) opt.remove();
          });
        }
      }
      renderImgLibBox();
    }
    var hid = document.getElementById("coHiddenForUser");
    if (hid) {
      var lab = hid.closest("label");
      if (lab) lab.style.display = "none";
    }
  }

  function refreshAdminWho() {
    var el = document.getElementById("adminWho");
    if (!el || !MeishiStore.getAdminSession) return;
    var s = MeishiStore.getAdminSession();
    if (!s) { el.textContent = ""; return; }
    el.textContent = "ログイン中: " + (s.label || s.id) + " ／ 担当: " + (s.companies || []).join("、");
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
    }, { company: currentCo || MeishiStore.getImageLibraryContext() });
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
    fillImgLibCoPick();
    renderImgLibBox();
    renderAdminAccountsUi();
  }

  function getImgLibCompany() {
    var sel = document.getElementById("imgLibCoPick");
    var v = sel && sel.value ? sel.value : (currentCo || "日新興業株式会社");
    if (MeishiStore.setImageLibraryContext) MeishiStore.setImageLibraryContext(v);
    return v;
  }

  function fillImgLibCoPick() {
    var sel = document.getElementById("imgLibCoPick");
    if (!sel) return;
    var cur = sel.value || currentCo || "日新興業株式会社";
    var list = MeishiStore.getCompanyList();
    sel.innerHTML = list.map(function (c) {
      return '<option value="' + String(c).replace(/"/g, "&quot;") + '">' + String(c).replace(/</g, "&lt;") + "</option>";
    }).join("");
    if (list.indexOf(cur) >= 0) sel.value = cur;
    else if (list.length) sel.value = list[0];
    getImgLibCompany();
  }

  function renderImgLibBox() {
    var box = document.getElementById("imgLibBox");
    if (!box) return;
    var co = getImgLibCompany();
    var lib = MeishiStore.getImageLibrary(co);
    box.innerHTML = "";
    if (!lib.length) {
      box.className = "img-lib-box empty";
      box.textContent = "（未登録）「＋ 追加」から「" + co + "」用の画像を登録してください。";
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
        if (!confirm("「" + co + "」の画像保存ボックスから削除しますか？")) return;
        MeishiStore.removeFromImageLibrary(item.id, co).then(function () {
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

  function recoverImagesFromBackup() {
    if (!MeishiStore.recoverImageLibrary) {
      alert("復元機能が利用できません。ページを再読み込みしてください。");
      return;
    }
    void MeishiStore.recoverImageLibrary().then(function (r) {
      renderImgLibBox();
      syncRemoteAfterSave();
      if (r && r.ok) {
        alert(r.count + " 件の画像を復元しました。");
        initPreviewPanel();
      } else {
        alert(
          "復元できる画像が見つかりませんでした。\n\n" +
            "・同じブラウザ・同じ開き方（file:// または http://127.0.0.1:8791）で owner.html を開いているか確認してください。\n" +
            "・ブラウザのバックアップや以前の端末に残っている場合は、そちらから「＋ 追加」で再登録してください。"
        );
      }
    });
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
    var co = getImgLibCompany();
    MeishiStore.addToImageLibrary(batch, co).then(function (n) {
      renderImgLibBox();
      if (n > 0) syncRemoteAfterSave();
      if (n > 0) alert(n + " 件を「" + co + "」の画像保存ボックスに追加しました");
      else alert("選択した画像は既に登録済みです");
      if (n > 0 && !MeishiStore.getImageLibrary(co).length) {
        alert("画像の保存に失敗した可能性があります。ファイルサイズを小さくして再度お試しください。");
      }
    });
  }

  function defaultUserPageUrl() {
    return MeishiStore.userUrl();
  }

  function refreshUserUrlFields() {
    var userUrl = defaultUserPageUrl();
    document.getElementById("userUrl").value = userUrl;
    var ownerInp = document.getElementById("ownerUrl");
    if (ownerInp) ownerInp.value = MeishiStore.ownerUrl();
    var adminInp = document.getElementById("adminUrl");
    if (adminInp) {
      // user / owner と同様、共有用の本番 URL（他PC・携帯向け）
      adminInp.value = MeishiStore.adminUrl
        ? MeishiStore.adminUrl()
        : MeishiStore.sharePageUrl("admin.html");
    }
  }

  function renderAdminCompaniesChecks(selected) {
    var box = document.getElementById("adminAccCompanies");
    if (!box) return;
    selected = selected || [];
    var selMap = {};
    selected.forEach(function (c) { selMap[MeishiFields.norm(c)] = true; });
    var list = MeishiStore.getCompanyList();
    if (!list.length) {
      box.innerHTML = '<span class="hint">会社がありません</span>';
      return;
    }
    box.className = "img-lib-box admin-acc-companies";
    box.innerHTML = list.map(function (c, i) {
      var id = "adminAccCo" + i;
      var checked = selMap[MeishiFields.norm(c)] ? " checked" : "";
      return (
        '<label class="admin-acc-co-item">' +
        '<input type="checkbox" id="' + id + '" value="' + String(c).replace(/"/g, "&quot;") + '"' + checked + " />" +
        "<span>" + String(c).replace(/</g, "&lt;") + "</span></label>"
      );
    }).join("");
  }

  function collectAdminCompanyChecks() {
    var box = document.getElementById("adminAccCompanies");
    if (!box) return [];
    var out = [];
    box.querySelectorAll('input[type="checkbox"]:checked').forEach(function (el) {
      out.push(el.value);
    });
    return out;
  }

  function renderAdminAccountsUi() {
    var listEl = document.getElementById("adminAccountsList");
    if (!listEl) return;
    var accounts = MeishiStore.getAdminAccounts ? MeishiStore.getAdminAccounts() : [];
    renderAdminCompaniesChecks([]);
    if (!accounts.length) {
      listEl.className = "img-lib-box empty";
      listEl.textContent = "（未登録）下のフォームから追加してください。";
      return;
    }
    listEl.className = "img-lib-box";
    listEl.innerHTML = accounts.map(function (a) {
      return (
        '<div class="img-lib-item admin-acc-row">' +
        '<div class="admin-acc-row-main"><strong>' + String(a.label || a.id).replace(/</g, "&lt;") + "</strong>" +
        "（ID: " + String(a.id).replace(/</g, "&lt;") + "）" +
        '<span class="hint admin-acc-companies-text">　担当: ' +
        (a.companies || []).map(function (c) { return String(c).replace(/</g, "&lt;"); }).join("、") +
        "</span></div>" +
        '<button type="button" class="btn sm danger" data-admin-del="' + String(a.id).replace(/"/g, "&quot;") + '">削除</button></div>'
      );
    }).join("");
    listEl.querySelectorAll("[data-admin-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-admin-del");
        if (!confirm("管理者アカウント「" + id + "」を削除しますか？")) return;
        var next = (MeishiStore.getAdminAccounts() || []).filter(function (a) { return a.id !== id; });
        MeishiStore.saveAdminAccounts(next);
        syncRemoteAfterSave();
        renderAdminAccountsUi();
      };
    });
  }

  function syncCoHiddenCheckbox() {
    var el = document.getElementById("coHiddenForUser");
    if (!el || !currentCo) return;
    el.checked = !!(MeishiStore.isCompanyHidden && MeishiStore.isCompanyHidden(currentCo));
  }

  function copyTextToClipboard(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { alert(okMsg || "コピーしました"); }).catch(function () {});
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      alert(okMsg || "コピーしました");
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function openPageUrl(url) {
    try {
      url = new URL(url, window.location.href).href;
    } catch (e) {
      return;
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

  function coPickIds() {
    return ["coPick", "recCatalogCoPick"];
  }

  function syncCoPickValue(v) {
    coPickIds().forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (v && [].some.call(el.options, function (o) { return o.value === v; })) el.value = v;
      else if (el.options.length) el.selectedIndex = 0;
    });
    var primary = document.getElementById("coPick") || document.getElementById("recCatalogCoPick");
    currentCo = primary ? primary.value : (v || "");
  }

  function refreshCoPickOptions() {
    var list = MeishiStore.getCompanyList();
    if (window.MEISHI_ADMIN_PAGE && MeishiStore.adminCanEditCompany) {
      // 会社共通・部署・データ編集は担当会社のみ
      var tab = document.querySelector(".tabs button.on");
      var tabId = tab ? tab.getAttribute("data-tab") : "company";
      if (tabId !== "preview") {
        list = list.filter(function (c) { return MeishiStore.adminCanEditCompany(c); });
      }
    }
    var cur = currentCo;
    var primary = document.getElementById("coPick") || document.getElementById("recCatalogCoPick");
    if (primary && primary.value) cur = primary.value;
    var html = list.length
      ? list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("")
      : '<option value="">（担当会社なし）</option>';
    coPickIds().forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = html;
    });
    if (cur && list.indexOf(cur) >= 0) syncCoPickValue(cur);
    else if (list.length) syncCoPickValue(list[0]);
    else currentCo = "";
  }

  function onCoPickChange(ev) {
    var v = ev && ev.target ? ev.target.value : "";
    syncCoPickValue(v);
    fillCoPanel();
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
    var primary = document.getElementById("coPick") || document.getElementById("recCatalogCoPick");
    currentCo = primary ? primary.value : currentCo;
    syncCoPickValue(currentCo);
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
    if (MeishiStore.setImageLibraryContext) MeishiStore.setImageLibraryContext(currentCo);
    var imgSel = document.getElementById("imgLibCoPick");
    if (imgSel && currentCo) {
      if ([].some.call(imgSel.options, function (o) { return o.value === currentCo; })) {
        imgSel.value = currentCo;
      }
      renderImgLibBox();
    }
    syncCoHiddenCheckbox();
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

  function afterCoCatalogSaveRefresh() {
    window._coCatalogMutations = [];
    window._coSavedCatalogSnapshot = cloneCat(MeishiStore.getCompanyProfileForEdit(currentCo).catalog);
    window._coEditingCatalog = cloneCat(window._coSavedCatalogSnapshot);
    window._coSyncBaseline = cloneCat(window._coSavedCatalogSnapshot);
    renderCatalogEditor(window._coEditingCatalog);
    refreshRecFormIfOpen();
    renderRecTable();
    fillDeptPanel();
    initPreviewPanel();
    syncRemoteAfterSave();
  }

  function afterCoDesignSaveRefresh() {
    reloadCoLayoutFromStore();
    refreshCoDesign();
    refreshCoBackDesign();
    initPreviewPanel();
    syncRemoteAfterSave();
  }

  /** 互換: 両方まとめて保存したあと用 */
  function afterCoSaveRefresh() {
    afterCoCatalogSaveRefresh();
    afterCoDesignSaveRefresh();
  }

  function collectCoProfile() {
    return {
      company: currentCo,
      catalog: cloneCat(window._coEditingCatalog) || MeishiCatalog.emptyCatalog(),
      layout: MeishiCatalog.normalizeLayout(MeishiLayout.clone(coLayout)),
      layoutBack: MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(coLayoutBack || MeishiLayout.defBackLayout())),
    };
  }

  /** 共通データのみ保存（未保存のデザイン編集は上書きしない） */
  function collectCoCatalogProfile() {
    var existing = MeishiStore.getCompanyProfileForEdit(currentCo) || {};
    return {
      company: currentCo,
      catalog: cloneCat(window._coEditingCatalog) || MeishiCatalog.emptyCatalog(),
      layout: existing.layout ? MeishiLayout.clone(existing.layout) : null,
      layoutBack: existing.layoutBack ? MeishiLayout.clone(existing.layoutBack) : null,
    };
  }

  /** 名刺デザインのみ保存（未保存の共通データ編集は上書きしない） */
  function collectCoDesignProfile() {
    var existing = MeishiStore.getCompanyProfileForEdit(currentCo) || {};
    return {
      company: currentCo,
      catalog: cloneCat(existing.catalog) || MeishiCatalog.emptyCatalog(),
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
    syncCoFrontDividerBtn();
  }

  function ensureCoCenterShift() {
    if (!coLayout) return;
    coLayout.centerShiftMm = MeishiCardUI.clampCenterShiftMm(
      coLayout.centerShiftMm != null ? coLayout.centerShiftMm : 5
    );
    if (coLayout.centerDivider == null) coLayout.centerDivider = true;
  }

  function syncDividerButton(btnId, isOn) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.textContent = isOn ? "中央線を削除" : "中央線を追加";
  }

  function syncCoFrontDividerBtn() {
    syncDividerButton("btnCoFrontDivider", !!(coLayout && coLayout.centerDivider !== false));
  }

  function syncCoBackDividerBtn() {
    syncDividerButton("btnCoBackDivider", !!(coLayoutBack && coLayoutBack.centerDivider));
  }

  function syncDeBackDividerBtn() {
    syncDividerButton("btnDeBackDivider", !!(deLayoutBack && deLayoutBack.centerDivider));
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
        onLayoutChange: function () {},
        onSelect: function () { if (coBackPanel) coBackPanel.showDesign(); },
      });
      coBackPanel = coBackUI.bindBackDesignPanel(document.getElementById("coBackDesignPanel"));
    }
    coBackUI.renderCard();
    if (coBackPanel) coBackPanel.showDesign();
    renderCoBackImgList();
    syncCoBackDividerBtn();
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
    if (window.MEISHI_ADMIN_PAGE && MeishiStore.adminCanEditCompany) {
      list = list.filter(function (c) { return MeishiStore.adminCanEditCompany(c); });
    }
    var coSel = document.getElementById("deCoPick");
    var curCo = coSel.value;
    coSel.innerHTML = list.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
    if (curCo && list.indexOf(curCo) >= 0) coSel.value = curCo;
    fillDeptAff1();
  }

  function fillDeptAff1() {
    var pk = getDeptPickers();
    var curA1 = pk.aff1;
    var unaff = MeishiFields.UNAFFILIATED_AFF1;
    var affs = MeishiStore.getAff1List(pk.co).filter(function (v) {
      return MeishiFields.norm(v) && MeishiFields.norm(v) !== unaff;
    });
    // 所属なしの氏名用デザイン設定
    affs = [unaff].concat(affs);
    var sel = document.getElementById("deAff1Pick");
    sel.innerHTML = affs.map(function (v) {
      var label = v === unaff ? "無所属（所属1なし）" : v;
      return "<option value='" + esc(v) + "'>" + esc(label) + "</option>";
    }).join("");
    if (curA1 && affs.indexOf(curA1) >= 0) sel.value = curA1;
    else if (MeishiFields.isUnaffiliatedAff1(curA1)) sel.value = unaff;
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
      if (MeishiFields.isUnaffiliatedAff1(pk.aff1)) {
        summary.innerHTML += "<div class='hint'>「無所属」は名刺データの所属1が空の人に適用されます。</div>";
      } else {
        summary.innerHTML += "<div class='hint'>この設定は「" + esc(pk.aff1) + "」配下の所属2";
        if (aff2list.length) summary.innerHTML += "（" + esc(aff2list.join("、")) + "）";
        summary.innerHTML += "すべてに適用されます。</div>";
      }
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
    syncRemoteAfterSave();
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
    if (deBackUI && deBackUI.commitAllTextEdits) deBackUI.commitAllTextEdits();
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
        onLayoutChange: function () {},
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
        onLayoutChange: function () {},
        onSelect: function () {
          var none = document.getElementById("deBackDesignNone");
          var ctl = document.getElementById("deBackDesignCtl");
          if (none) none.style.display = "none";
          if (ctl) ctl.style.display = "";
          if (deBackPanel) deBackPanel.showDesign();
        },
      });
      deBackPanel = deBackUI.bindBackDesignPanel(document.getElementById("deBackDesignPanel"), {
        sizeUp: "deBackDesSizeUp",
        sizeDown: "deBackDesSizeDown",
        sizeV: "deBackDesSizeV",
        color: "deBackDesColor",
        bg: "deBackDesBg",
        bgNone: "deBackDesBgNone",
        norm: "deBackDesNorm",
        bold: "deBackDesBold",
        italic: "deBackDesItalic",
        underline: "deBackDesUnderline",
        ctl: "deBackDesignCtl",
        none: "deBackDesignNone",
        textDelete: "deBackDesTextDelete",
        font: "deBackDesFont",
        alignAttr: "data-de-back-al",
        fontAttr: "data-de-back-font",
      });
    }
    deCoBackUI.renderCard();
    deBackUI.renderCard();
    if (deBackPanel) deBackPanel.showDesign();
    renderDeBackImgList();
    syncDeBackDividerBtn();
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
    // getRecords() は毎回 clone のため indexOf では元 index が取れない。
    // admin の会社フィルタ後にフォールバックすると別人の行が開くので、map 時の index を保持する。
    var all = MeishiStore.getRecords();
    var indexed = all.map(function (r, i) { return { r: r, i: i }; });
    if (window.MEISHI_ADMIN_PAGE && MeishiStore.adminCanEditCompany) {
      indexed = indexed.filter(function (x) {
        return MeishiStore.adminCanEditCompany(x.r.company);
      });
    }
    document.getElementById("recCount").textContent = indexed.length + " 件";
    document.querySelector("#recTbl thead").innerHTML =
      "<tr>" + MeishiFields.COLUMNS.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + "</tr>";
    var q = recFilter.toLowerCase();
    document.querySelector("#recTbl tbody").innerHTML = indexed.map(function (x) {
      var r = x.r;
      var realIdx = x.i;
      var txt = MeishiFields.COLUMNS.map(function (c) { return r[c.key] || ""; }).join(" ");
      if (q && txt.toLowerCase().indexOf(q) < 0) return "";
      return "<tr data-i='" + realIdx + "' class='" + (realIdx === editRecIdx ? "sel" : "") + "'>" +
        MeishiFields.COLUMNS.map(function (c) { return "<td>" + esc(r[c.key] || "") + "</td>"; }).join("") + "</tr>";
    }).join("");
  }

  /** 名刺データ行から会社ごとの候補値を集める（共通データ未登録でも選択できるようにする） */
  function recordFieldValues(company, key) {
    var co = MeishiFields.norm(company);
    if (!co || !key) return [];
    var out = [];
    MeishiStore.getRecords().forEach(function (r) {
      if (!r) return;
      if (co && MeishiFields.norm(r.company) !== co) return;
      var v = r[key];
      if (v == null || String(v).trim() === "") return;
      out.push(String(v).trim());
    });
    return MeishiFields.uniq(out);
  }

  function fieldOptions(company, key, ctx) {
    var cat;
    if (window._coEditingCatalog && MeishiFields.norm(company) === MeishiFields.norm(currentCo)) {
      cat = window._coEditingCatalog;
    } else {
      cat = MeishiStore.getCompanyProfileForEdit(company).catalog || MeishiCatalog.emptyCatalog();
    }
    if (key === "company") return MeishiStore.getCompanyList();
    if (key === "aff1") {
      return MeishiFields.uniq((cat.aff1 || []).concat(recordFieldValues(company, "aff1")));
    }
    if (key === "aff2") {
      return MeishiFields.uniq(MeishiCatalog.getAff2List(cat).concat(recordFieldValues(company, "aff2")));
    }
    if (key === "aff3") {
      return MeishiFields.uniq(MeishiCatalog.getAff3List(cat).concat(recordFieldValues(company, "aff3")));
    }
    if (key === "title") {
      // 共通データの役職マスタ ＋ 名刺データに既にある役職
      return MeishiFields.uniq(MeishiCatalog.getTitleList(cat).concat(recordFieldValues(company, "title")))
        .sort(function (a, b) { return String(a).localeCompare(String(b), "ja"); });
    }
    if (key === "postal") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.postal; }).concat(cat.postal || []).concat(recordFieldValues(company, "postal")));
    if (key === "address") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.address; }).filter(Boolean).concat(recordFieldValues(company, "address")));
    if (key === "tel") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.tel; }).filter(Boolean).concat(recordFieldValues(company, "tel")));
    if (key === "fax") return MeishiFields.uniq((cat.locations || []).map(function (l) { return l.fax; }).filter(Boolean).concat(recordFieldValues(company, "fax")));
    if (key === "url") return MeishiFields.uniq((cat.urls || []).concat(recordFieldValues(company, "url")));
    if (key === "category") return MeishiFields.uniq((cat.categories || []).concat(recordFieldValues(company, "category")));
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

  /** 名刺データ上で、この行がどの会社・所属に紐づくかを明示 */
  function bindingSummaryHtml(ctx) {
    var labels = [];
    if (ctx.company) labels.push({ k: "会社", v: ctx.company });
    if (ctx.aff1) labels.push({ k: "所属1", v: ctx.aff1 });
    if (ctx.aff2) labels.push({ k: "所属2", v: ctx.aff2 });
    if (ctx.aff3) labels.push({ k: "所属3", v: ctx.aff3 });
    if (ctx.title) labels.push({ k: "役職", v: ctx.title });
    var path = labels.length
      ? labels.map(function (x) { return x.v; }).join(" › ")
      : "（会社・所属・役職を選ぶとここに表示されます）";
    var detail = labels.length
      ? labels.map(function (x) { return "<span class='rec-bind-chip'><em>" + esc(x.k) + "</em>" + esc(x.v) + "</span>"; }).join("")
      : "";
    return "<div class='rec-binding-box'>"
      + "<strong>この名刺の紐づけ</strong>"
      + "<div class='rec-binding-path'>" + esc(path) + "</div>"
      + (detail ? "<div class='rec-binding-chips'>" + detail + "</div>" : "")
      + "<p class='hint' style='margin:8px 0 0'>共通データは候補一覧です。実際の紐づけは、上の会社・所属・役職の選択で決まります。</p>"
      + "</div>";
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
    var html = bindingSummaryHtml(ctx);
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
    // 役職は所属に紐づかないマスタのため、所属変更ではクリアしない
    if (k === "company") { rec.aff1 = rec.aff2 = rec.aff3 = rec.title = ""; }
    if (k === "aff1") { rec.aff2 = rec.aff3 = ""; }
    if (k === "aff2") { rec.aff3 = ""; }
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
      var ownerId = document.getElementById("ownerId").value.trim();
      var ownerPass = document.getElementById("ownerPass").value;
      if (!ownerId) return alert("ログインIDを入力してください");
      if (!ownerPass) return alert("パスワードを入力してください");
      var payload = {
        title: document.getElementById("title").value.trim() || "名刺印刷システム",
        ownerId: ownerId,
        ownerPass: ownerPass,
      };
      var save = MeishiStore.saveConfigAsync
        ? MeishiStore.saveConfigAsync(payload)
        : Promise.resolve({ localOk: true, authOk: !MeishiStore.useFirebase() });
      save.then(function (r) {
        refreshUserUrlFields();
        setBadge();
        var msg = "保存しました";
        if (MeishiStore.useFirebase() && (!r || !r.authOk)) {
          msg += "\n\n※ ログイン情報の共有に失敗しました。ネットワークを確認し、もう一度「保存」を押してください。";
        } else if (MeishiStore.useFirebase()) {
          msg += "\n\n携帯・他PCは「使用者ページ」の本番URLから、同じ ID / パスワードでログインできます。";
        }
        alert(msg);
      });
    };
    document.getElementById("btnCopy").onclick = function () {
      var url = document.getElementById("userUrl").value || defaultUserPageUrl();
      copyTextToClipboard(url, "使用者URLをコピーしました");
    };
    document.getElementById("btnQr").onclick = showUserQr;
    document.getElementById("btnQrClose").onclick = hideUserQr;
    document.getElementById("qrModal").onclick = function (e) {
      if (e.target === document.getElementById("qrModal")) hideUserQr();
    };
    document.getElementById("btnOpen").onclick = function () {
      openPageUrl(document.getElementById("userUrl").value || defaultUserPageUrl());
    };
    var btnCopyOwner = document.getElementById("btnCopyOwner");
    if (btnCopyOwner) {
      btnCopyOwner.onclick = function () {
        copyTextToClipboard(document.getElementById("ownerUrl").value || MeishiStore.ownerUrl(), "所有者URLをコピーしました");
      };
    }
    var btnOpenOwner = document.getElementById("btnOpenOwner");
    if (btnOpenOwner) {
      btnOpenOwner.onclick = function () {
        openPageUrl(document.getElementById("ownerUrl").value || MeishiStore.ownerUrl());
      };
    }
    var btnCopyAdmin = document.getElementById("btnCopyAdmin");
    if (btnCopyAdmin) {
      btnCopyAdmin.onclick = function () {
        copyTextToClipboard(
          document.getElementById("adminUrl").value || MeishiStore.adminUrl(),
          "admin URLをコピーしました"
        );
      };
    }
    var btnOpenAdmin = document.getElementById("btnOpenAdmin");
    if (btnOpenAdmin) {
      btnOpenAdmin.onclick = function () {
        openPageUrl(document.getElementById("adminUrl").value || MeishiStore.adminUrl());
      };
    }
    var imgLibCoPick = document.getElementById("imgLibCoPick");
    if (imgLibCoPick) {
      imgLibCoPick.onchange = function () {
        getImgLibCompany();
        renderImgLibBox();
      };
    }
    var coHidden = document.getElementById("coHiddenForUser");
    if (coHidden) {
      coHidden.onchange = function () {
        if (!currentCo) return;
        var list = MeishiStore.getHiddenCompanies ? MeishiStore.getHiddenCompanies() : [];
        var key = MeishiFields.norm(currentCo);
        if (coHidden.checked) {
          if (list.indexOf(key) < 0) list.push(key);
        } else {
          list = list.filter(function (c) { return MeishiFields.norm(c) !== key; });
        }
        MeishiStore.setHiddenCompanies(list);
        syncRemoteAfterSave();
      };
    }
    var btnAdminAccAdd = document.getElementById("btnAdminAccAdd");
    if (btnAdminAccAdd) {
      btnAdminAccAdd.onclick = function () {
        var id = (document.getElementById("adminAccId").value || "").trim();
        var pass = document.getElementById("adminAccPass").value || "";
        var label = (document.getElementById("adminAccLabel").value || "").trim() || id;
        var companies = collectAdminCompanyChecks();
        if (!id) return alert("ログインIDを入力してください");
        if (!pass) return alert("パスワードを入力してください");
        if (!companies.length) return alert("担当会社を1つ以上選んでください");
        var accounts = MeishiStore.getAdminAccounts() || [];
        if (accounts.some(function (a) { return a.id === id; })) {
          return alert("同じIDのアカウントが既にあります");
        }
        accounts.push({ id: id, pass: pass, label: label, companies: companies });
        MeishiStore.saveAdminAccounts(accounts);
        syncRemoteAfterSave();
        document.getElementById("adminAccId").value = "";
        document.getElementById("adminAccPass").value = "";
        document.getElementById("adminAccLabel").value = "";
        renderAdminAccountsUi();
        alert("管理者アカウントを追加しました");
      };
    }
    var btnAdminAccSave = document.getElementById("btnAdminAccSave");
    if (btnAdminAccSave) {
      btnAdminAccSave.onclick = function () {
        MeishiStore.saveAdminAccounts(MeishiStore.getAdminAccounts() || []);
        syncRemoteAfterSave();
        alert("管理者アカウント設定を保存しました");
      };
    }
    document.getElementById("btnImgLibAdd").onclick = addImagesToLibrary;
    document.getElementById("btnImgLibRecover").onclick = recoverImagesFromBackup;
    document.getElementById("imgLibFileInput").onchange = onImgLibFilesSelected;
    coPickIds().forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.onchange = onCoPickChange;
    });
    document.getElementById("btnCoAdd").onclick = function () {
      var n = document.getElementById("coNewName").value.trim();
      if (!n) return alert("会社名を入力してください");
      MeishiStore.addCompany(n);
      document.getElementById("coNewName").value = "";
      fillCoPick();
      syncCoPickValue(n);
      fillCoPanel();
    };
    document.getElementById("btnCoRename").onclick = function () {
      var n = document.getElementById("coRename").value.trim();
      if (!n) return;
      try {
        MeishiStore.renameCompany(currentCo, n);
        fillCoPick();
        syncCoPickValue(n);
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
    var btnSaveCatalog = document.getElementById("btnSaveCoCatalog");
    if (btnSaveCatalog) {
      btnSaveCatalog.onclick = function () {
        syncCoCatalogToRecords(null);
        var pending = collectCoSaveMutations();
        MeishiStore.saveCompanyProfile(currentCo, collectCoCatalogProfile(), pending);
        afterCoCatalogSaveRefresh();
        alert("共通データを保存し、関連データを更新しました");
      };
    }
    var btnSaveDesign = document.getElementById("btnSaveCoDesign");
    if (btnSaveDesign) {
      btnSaveDesign.onclick = function () {
        if (coUI && coUI.commitAllTextEdits) coUI.commitAllTextEdits();
        if (coBackUI && coBackUI.commitAllTextEdits) coBackUI.commitAllTextEdits();
        MeishiStore.saveCompanyProfile(currentCo, collectCoDesignProfile(), null);
        afterCoDesignSaveRefresh();
        alert("名刺デザインを保存しました");
      };
    }
    document.getElementById("btnCoImgPick").onclick = function () {
      pickImagesIntoLayout(coLayout, "co", function () { refreshCoDesign(); });
    };
    document.getElementById("btnCoFrontText").onclick = function () {
      if (!coLayout) coLayout = MeishiLayout.defLayout();
      coLayout = MeishiCatalog.normalizeLayout(coLayout);
      coLayout.texts = coLayout.texts || [];
      var block = MeishiLayout.defTextBlock(coLayout.texts.length);
      coLayout.texts.push(block);
      if (coUI) coUI.invalidate();
      refreshCoDesign();
      if (coUI && coUI.editTextById) coUI.editTextById(block.id, true);
    };
    document.getElementById("btnCoDesReset").onclick = function () {
      if (!confirm("デザインを初期化しますか？")) return;
      coLayout = MeishiLayout.defLayout();
      if (coUI) coUI.invalidate();
      refreshCoDesign();
    };
    document.getElementById("btnCoFrontDivider").onclick = function () {
      if (!coLayout) coLayout = MeishiLayout.defLayout();
      var next = coLayout.centerDivider === false;
      if (coUI && coUI.setCenterDivider) coUI.setCenterDivider(next);
      else {
        coLayout.centerDivider = next;
        refreshCoDesign();
      }
      syncCoFrontDividerBtn();
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
    document.getElementById("btnCoBackDivider").onclick = function () {
      if (!coLayoutBack) coLayoutBack = MeishiLayout.defBackLayout();
      var next = !coLayoutBack.centerDivider;
      if (coBackUI && coBackUI.setCenterDivider) coBackUI.setCenterDivider(next);
      else {
        coLayoutBack.centerDivider = next;
        refreshCoBackDesign();
      }
      syncCoBackDividerBtn();
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
    document.getElementById("btnDeBackDivider").onclick = function () {
      var pk = getDeptPickers();
      pk.aff1 = document.getElementById("deAff1Pick").value;
      if (!pk.co || !pk.aff1) return alert("会社と所属1を選択してください");
      if (!deLayoutBack) loadDeptLayout();
      if (!deLayoutBack) deLayoutBack = MeishiLayout.defBackLayout();
      var next = !deLayoutBack.centerDivider;
      if (deBackUI && deBackUI.setCenterDivider) deBackUI.setCenterDivider(next);
      else {
        deLayoutBack.centerDivider = next;
        refreshDeptBackDesign();
      }
      syncDeBackDividerBtn();
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
    document.getElementById("recSearch").oninput = function () {
      recFilter = this.value;
      if (window._recSearchTimer) clearTimeout(window._recSearchTimer);
      window._recSearchTimer = setTimeout(function () { renderRecTable(); }, 150);
    };
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
        setBadge();
        refreshUserUrlFields();
        refreshCoPickOptions();
        fillImgLibCoPick();
        renderImgLibBox();
        var coOn = document.getElementById("panel-company") && document.getElementById("panel-company").classList.contains("on");
        if (coOn) fillCoPanel();
        fillDeptPanel();
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
    initAdmin: async function () {
      var ADMIN_REMEMBER_KEY = "meishi_admin_saved_login";
      var loginView = document.getElementById("adminLoginView");
      var mainView = document.getElementById("adminMainView");
      var loggingIn = false;
      var EDITOR_SCRIPTS = [
        "meishi-layout.js?v=20250714q",
        "meishi-image-lib.js?v=20250714ad",
        "meishi-card-ui.js?v=20250723b",
        "meishi-back-card-ui.js?v=20250723b",
        "meishi-print-sheet.js?v=20250714z",
        "meishi-user-print.js?v=20250715k",
        "meishi-preview-init.js?v=20250715m",
      ];
      var editorScriptsPromise = null;

      function loadScript(src) {
        return new Promise(function (resolve, reject) {
          if (document.querySelector('script[src="' + src + '"]')) {
            resolve();
            return;
          }
          var s = document.createElement("script");
          s.src = src;
          s.onload = function () { resolve(); };
          s.onerror = function () { reject(new Error("script load failed: " + src)); };
          document.head.appendChild(s);
        });
      }

      function ensureEditorScripts() {
        if (window.MeishiCardUI && window.MeishiPreviewPanel) return Promise.resolve();
        if (editorScriptsPromise) return editorScriptsPromise;
        editorScriptsPromise = EDITOR_SCRIPTS.reduce(function (p, src) {
          return p.then(function () { return loadScript(src); });
        }, Promise.resolve());
        return editorScriptsPromise;
      }

      function restoreAdminSavedLogin() {
        try {
          var raw = localStorage.getItem(ADMIN_REMEMBER_KEY);
          if (!raw) return;
          var d = JSON.parse(raw);
          if (!d || typeof d !== "object") return;
          var idEl = document.getElementById("adminLoginId");
          var pwEl = document.getElementById("adminLoginPass");
          var chk = document.getElementById("adminLoginRemember");
          if (idEl) idEl.value = d.id || "";
          if (pwEl) pwEl.value = d.pw || "";
          if (chk) chk.checked = true;
        } catch (e) {}
      }
      function persistAdminRemember(id, pass) {
        var chk = document.getElementById("adminLoginRemember");
        if (chk && chk.checked) {
          try {
            localStorage.setItem(ADMIN_REMEMBER_KEY, JSON.stringify({ id: id, pw: pass }));
          } catch (e) {}
        } else {
          try { localStorage.removeItem(ADMIN_REMEMBER_KEY); } catch (e2) {}
        }
      }
      function revealMain() {
        if (loginView) loginView.hidden = true;
        if (mainView) mainView.hidden = false;
        setupAdminShell();
        refreshAdminWho();
        showTab("company");
      }
      function wireAdminUi() {
        bindEvents();
        setBadge();
        fillCoPick();
        fillDeptPanel();
        renderRecTable();
        MeishiStore.onConfigChange(function () {
          refreshAdminWho();
          setBadge();
          refreshCoPickOptions();
          applyAdminUiLocks();
        });
        MeishiStore.onRecordsChange(function () { renderRecTable(); });
        applyAdminUiLocks();
      }
      async function enterMainAfterLogin() {
        if (!MeishiStore.ready) {
          try { await MeishiStore.init(); } catch (e) {
            alert(e.message || e);
            return false;
          }
        }
        try { await ensureEditorScripts(); } catch (e) {
          alert("画面の読み込みに失敗しました。再読み込みしてください。\n" + (e.message || e));
          return false;
        }
        wireAdminUi();
        revealMain();
        return true;
      }

      restoreAdminSavedLogin();
      // ログイン欄はすぐ使える。認証・管理者アカウントだけ先読み
      try {
        if (MeishiStore.initAuthFast) await MeishiStore.initAuthFast();
      } catch (e) { console.warn(e); }
      // 名刺データ等は裏で読み込み
      void MeishiStore.init().catch(function (e) { console.warn("[Meishi] init", e); });
      void ensureEditorScripts().catch(function () {});

      var sess = MeishiStore.getAdminSession && MeishiStore.getAdminSession();
      if (sess) {
        await enterMainAfterLogin();
        return;
      }

      var btn = document.getElementById("btnAdminLogin");
      if (btn) {
        btn.onclick = async function () {
          if (loggingIn) return;
          var id = (document.getElementById("adminLoginId").value || "").trim();
          var pass = document.getElementById("adminLoginPass").value || "";
          var err = document.getElementById("adminLoginErr");
          loggingIn = true;
          btn.disabled = true;
          try {
            if (MeishiStore.useFirebase() && MeishiStore.refreshAuthFromFirebase) {
              try { await MeishiStore.initAuthFast(); } catch (e) {}
            }
            var r = MeishiStore.verifyAdminLogin(id, pass);
            if (!r || !r.ok) {
              if (err) err.textContent = "ID またはパスワードが違います";
              return;
            }
            persistAdminRemember(id, pass);
            MeishiStore.setAdminSession(r.account);
            if (err) err.textContent = "読み込み中…";
            var ok = await enterMainAfterLogin();
            if (!ok && err) err.textContent = "";
            else if (err) err.textContent = "";
          } finally {
            loggingIn = false;
            btn.disabled = false;
          }
        };
      }
      var passEl = document.getElementById("adminLoginPass");
      if (passEl) {
        passEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && btn) btn.click();
        });
      }
    },
  };
})();
