/**
 * 名刺印刷プレビューパネル（所有者プレビュー・使用者画面で共通）
 */
(function () {
  var PREVIEW_IDS = {
    selName: "pvSelName",
    selNameList: "pvSelNameList",
    selNameToggle: "pvSelNameToggle",
    selCompany: "pvSelCompany",
    selAff1: "pvSelAff1",
    selAff2: "pvSelAff2",
    selAff3: "pvSelAff3",
    selTitle: "pvSelTitle",
    selPostal: "pvSelPostal",
    inQual: "pvInQual",
    inAddress: "pvInAddress",
    inTel: "pvInTel",
    inFax: "pvInFax",
    selMobile: "pvSelMobile",
    inEmail: "pvInEmail",
    inUrl: "pvInUrl",
    inKoji: "pvInKoji",
    card: "pvCard",
    btnPrint: "pvBtnPrint",
    btnClear: "pvBtnClear",
  };

  function create(cfg) {
    cfg = cfg || {};
    var userPrint = null;
    var pvPersonalLayout = null;
    var pvPersonalUI = null;
    var pvPersonalHooked = false;
    var pvSideToggleHooked = false;

    function newPersonalLayout() {
      var layout = MeishiLayout.defLayout();
      MeishiLayout.ELS.forEach(function (e) {
        if (layout.el[e.id]) layout.el[e.id].hidden = true;
      });
      layout.images = [];
      return layout;
    }

    function previewField(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || "").trim() : "";
    }

    function findPreviewRecordIndex() {
      var name = previewField("pvSelName");
      if (!name) return -1;
      var company = previewField("pvSelCompany");
      var aff1 = previewField("pvSelAff1");
      var aff2 = previewField("pvSelAff2");
      var aff3 = previewField("pvSelAff3");
      var title = previewField("pvSelTitle");
      var recs = MeishiStore.getRecords();
      var best = -1;
      var bestScore = -1;
      recs.forEach(function (r, i) {
        if (MeishiFields.norm(r.name) !== MeishiFields.norm(name)) return;
        var score = 1;
        if (company && MeishiFields.norm(r.company) === MeishiFields.norm(company)) score += 2;
        if (aff1 && MeishiFields.norm(r.aff1) === MeishiFields.norm(aff1)) score += 2;
        if (aff2 && MeishiFields.norm(r.aff2) === MeishiFields.norm(aff2)) score += 2;
        if (aff3 && MeishiFields.norm(r.aff3) === MeishiFields.norm(aff3)) score += 1;
        if (title && MeishiFields.norm(r.title) === MeishiFields.norm(title)) score += 1;
        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    }

    function escAttr(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function renderPersonalImgList() {
      var list = document.getElementById("pvPersonalImgList");
      if (!list) return;
      var imgs = (pvPersonalLayout && pvPersonalLayout.images) || [];
      if (!imgs.length) {
        list.innerHTML = "<span class='hint'>（個人画像なし）</span>";
        return;
      }
      list.innerHTML = imgs.map(function (im, i) {
        var src = window.MeishiImageLib ? MeishiImageLib.itemUrl(im) : (im.src || "");
        return "<div class='img-item'><img src='" + escAttr(src) + "' alt='' />"
          + "<button type='button' class='linkbtn' data-pv-img-i='" + i + "' data-pv-img-id='" + escAttr(im.id || "") + "'>削除</button></div>";
      }).join("");
      list.querySelectorAll("[data-pv-img-i]").forEach(function (btn) {
        btn.onclick = function () {
          if (!pvPersonalLayout) return;
          var id = btn.getAttribute("data-pv-img-id");
          var i = +btn.getAttribute("data-pv-img-i");
          if (id && pvPersonalUI && pvPersonalUI.removeImageById) {
            pvPersonalUI.removeImageById(id);
          } else if (pvPersonalLayout.images && pvPersonalLayout.images[i]) {
            pvPersonalLayout.images.splice(i, 1);
            if (pvPersonalUI) pvPersonalUI.invalidate();
            refreshPreviewPersonal();
          }
          renderPersonalImgList();
        };
      });
    }

    function refreshPreviewPersonal() {
      if (!pvPersonalUI) return;
      pvPersonalUI.renderCard();
      renderPersonalImgList();
    }

    function loadPreviewPersonalImages() {
      var idx = findPreviewRecordIndex();
      var hint = document.getElementById("pvPersonalHint");
      var kojiEl = document.getElementById("pvInKoji");
      if (idx < 0) {
        pvPersonalLayout = newPersonalLayout();
        if (hint) hint.textContent = "氏名を選ぶと、その人専用の画像を設定できます。画像はリストの「削除」または画像を選んで Delete キーで消せます。";
        if (kojiEl && !kojiEl._kojiTyping) kojiEl.value = "";
      } else {
        var rec = MeishiStore.getRecords()[idx];
        pvPersonalLayout = newPersonalLayout();
        pvPersonalLayout.images = MeishiStore.getPreviewPersonalImages(rec.no);
        if (window.MeishiImageLib) {
          pvPersonalLayout.images = MeishiImageLib.resolveImages(pvPersonalLayout.images);
        }
        if (hint) hint.textContent = "編集中: #" + rec.no + " " + rec.name + " の個人画像（削除可）";
        if (kojiEl && !kojiEl._kojiTyping && MeishiStore.getPreviewKoji) {
          kojiEl.value = MeishiStore.getPreviewKoji(rec.no) || "";
        }
      }
      if (pvPersonalUI) pvPersonalUI.invalidate();
      refreshPreviewPersonal();
    }

    function savePreviewRecordField(field, value) {
      var idx = findPreviewRecordIndex();
      if (idx < 0 || !MeishiStore.updateRecord) return;
      var rec = Object.assign({}, MeishiFields.emptyRecord(), MeishiStore.getRecords()[idx]);
      rec[field] = String(value == null ? "" : value).trim();
      MeishiStore.updateRecord(idx, rec);
      if (userPrint && userPrint.scheduleRebuild) userPrint.scheduleRebuild();
      else if (userPrint && userPrint.rebuild) userPrint.rebuild();
    }

    function fillQualEmailDatalists() {
      var company = previewField("pvSelCompany");
      if (!company) return;
      var cat = MeishiStore.getCompanyProfileForEdit(company).catalog || MeishiCatalog.emptyCatalog();
      function fillList(id, values) {
        var dl = document.getElementById(id);
        if (!dl) return;
        dl.innerHTML = (values || []).map(function (v) {
          return "<option value=\"" + escAttr(v) + "\">";
        }).join("");
      }
      fillList("pvQualList", MeishiCatalog.getQualList(cat));
      fillList("pvEmailList", MeishiCatalog.getEmailList(cat));
    }

    function savePreviewKojiForSelection() {
      var idx = findPreviewRecordIndex();
      var kojiEl = document.getElementById("pvInKoji");
      if (!kojiEl || !MeishiStore.savePreviewKoji) return;
      if (idx < 0) return;
      var rec = MeishiStore.getRecords()[idx];
      MeishiStore.savePreviewKoji(rec.no, kojiEl.value || "");
    }

    function savePreviewPersonalImages() {
      var idx = findPreviewRecordIndex();
      if (idx < 0) return alert("氏名を選んでから保存してください");
      var rec = MeishiStore.getRecords()[idx];
      var imgs = MeishiLayout.clone((pvPersonalLayout && pvPersonalLayout.images) || []);
      MeishiStore.savePreviewPersonalImages(rec.no, imgs).then(function (ok) {
        if (!ok) {
          alert("個人画像の保存に失敗しました。画像サイズが大きすぎる可能性があります。");
          return;
        }
        if (typeof cfg.onPersonalSaved === "function") cfg.onPersonalSaved("個人画像を保存しました");
      });
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

    function bindEditablePreviewField(inputId, recordKey) {
      var inp = document.getElementById(inputId);
      if (!inp || inp._pvFieldBound) return;
      inp._pvFieldBound = true;
      inp.removeAttribute("readonly");
      var timer = null;
      function commit() {
        inp._pvTyping = false;
        savePreviewRecordField(recordKey, inp.value);
      }
      inp.addEventListener("input", function () {
        inp._pvTyping = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(commit, 450);
        if (userPrint && userPrint.scheduleRenderCard) userPrint.scheduleRenderCard();
        else if (userPrint && userPrint.renderCard) userPrint.renderCard();
      });
      inp.addEventListener("change", commit);
      inp.addEventListener("blur", commit);
    }

    function initPreviewPersonal() {
      if (!pvPersonalLayout) pvPersonalLayout = newPersonalLayout();
      if (!pvPersonalUI) {
        pvPersonalUI = MeishiCardUI.createCardUI({
          cardEl: document.getElementById("pvCardPersonal"),
          getLayout: function () { return pvPersonalLayout; },
          getElText: function () { return ""; },
          getImages: function () { return pvPersonalLayout.images || []; },
          hideElements: true,
          isActive: function () {
            return !!(cfg.isActive ? cfg.isActive() : true);
          },
          onLayoutChange: function () {
            renderPersonalImgList();
          },
          onSelect: function () {},
        });
      }
      if (!pvPersonalHooked) {
        pvPersonalHooked = true;
        ["pvSelName", "pvSelCompany", "pvSelAff1", "pvSelAff2", "pvSelAff3", "pvSelTitle"].forEach(function (id) {
          var node = document.getElementById(id);
          if (node) node.addEventListener("change", function () {
            loadPreviewPersonalImages();
            fillQualEmailDatalists();
          });
        });
        if (cfg.allowPersonalEdit !== false) {
          var btnImg = document.getElementById("pvBtnImages");
          if (btnImg) btnImg.onclick = function () {
            if (findPreviewRecordIndex() < 0) return alert("先に氏名を選んでください");
            pickImagesIntoLayout(pvPersonalLayout, "pv", function () {
              if (pvPersonalUI) pvPersonalUI.invalidate();
              refreshPreviewPersonal();
            });
          };
          var btnSave = document.getElementById("pvBtnSavePersonal");
          if (btnSave) btnSave.onclick = savePreviewPersonalImages;
        }
        bindEditablePreviewField("pvInQual", "qual");
        bindEditablePreviewField("pvInEmail", "email");
        var kojiEl = document.getElementById("pvInKoji");
        if (kojiEl && !kojiEl._kojiBound) {
          kojiEl._kojiBound = true;
          var kojiSaveTimer = null;
          function scheduleKojiSave() {
            if (kojiSaveTimer) clearTimeout(kojiSaveTimer);
            kojiSaveTimer = setTimeout(function () {
              kojiEl._kojiTyping = false;
              savePreviewKojiForSelection();
            }, 400);
          }
          kojiEl.addEventListener("input", function () {
            kojiEl._kojiTyping = true;
            scheduleKojiSave();
            if (userPrint && userPrint.scheduleRenderCard) userPrint.scheduleRenderCard();
            else if (userPrint && userPrint.renderCard) userPrint.renderCard();
          });
          kojiEl.addEventListener("change", function () {
            kojiEl._kojiTyping = false;
            savePreviewKojiForSelection();
          });
          kojiEl.addEventListener("blur", function () {
            kojiEl._kojiTyping = false;
            savePreviewKojiForSelection();
          });
        }
      }
      loadPreviewPersonalImages();
      fillQualEmailDatalists();
    }

    function initPreviewSideToggle() {
      if (pvSideToggleHooked) return;
      var tg = document.getElementById("pvSideToggle");
      if (!tg || !userPrint || !userPrint.setPreviewSide) return;
      pvSideToggleHooked = true;
      tg.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-side]");
        if (!b) return;
        tg.querySelectorAll("button[data-side]").forEach(function (btn) {
          btn.classList.toggle("on", btn === b);
        });
        userPrint.setPreviewSide(b.getAttribute("data-side"));
      });
    }

    function init() {
      if (!userPrint) {
        userPrint = MeishiUserPrint.create({
          ids: PREVIEW_IDS,
          // プレビュー時は資格・携帯・住所段数に応じた縦ずらしを有効化
          textFlow: true,
          isActive: cfg.isActive || function () { return true; },
          onBeforePrint: function () {
            if (userPrint) {
              userPrint.renderCard();
              if (userPrint.renderBackCard) userPrint.renderBackCard();
            }
            refreshPreviewPersonal();
          },
          preparePrint: function () {
            refreshPreviewPersonal();
          },
          onClear: function () {
            loadPreviewPersonalImages();
          },
        });
        userPrint.init();
        initPreviewPersonal();
        initPreviewSideToggle();
      } else {
        userPrint.rebuild();
        loadPreviewPersonalImages();
        initPreviewSideToggle();
      }
    }

    return {
      init: init,
      rebuild: function () {
        if (userPrint) userPrint.rebuild();
      },
    };
  }

  window.MeishiPreviewPanel = {
    create: create,
    PREVIEW_IDS: PREVIEW_IDS,
  };
})();
