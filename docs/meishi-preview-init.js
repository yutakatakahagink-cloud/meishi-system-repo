/**
 * 名刺印刷プレビューパネル（所有者プレビュー・使用者画面で共通）
 */
(function () {
  var PREVIEW_IDS = {
    selName: "pvSelName",
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
    inMobile: "pvInMobile",
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

    function refreshPreviewPersonal() {
      if (!pvPersonalUI) return;
      pvPersonalUI.renderCard();
    }

    function loadPreviewPersonalImages() {
      var idx = findPreviewRecordIndex();
      var hint = document.getElementById("pvPersonalHint");
      if (idx < 0) {
        pvPersonalLayout = newPersonalLayout();
        if (hint) hint.textContent = "氏名を選ぶと、その人専用の画像を設定できます。";
      } else {
        var rec = MeishiStore.getRecords()[idx];
        pvPersonalLayout = newPersonalLayout();
        pvPersonalLayout.images = MeishiStore.getPreviewPersonalImages(rec.no);
        if (window.MeishiImageLib) {
          pvPersonalLayout.images = MeishiImageLib.resolveImages(pvPersonalLayout.images);
        }
        if (hint) hint.textContent = "編集中: #" + rec.no + " " + rec.name + " の個人画像";
      }
      if (pvPersonalUI) pvPersonalUI.invalidate();
      refreshPreviewPersonal();
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

    function initPreviewPersonal() {
      if (!pvPersonalLayout) pvPersonalLayout = newPersonalLayout();
      if (!pvPersonalUI) {
        pvPersonalUI = MeishiCardUI.createCardUI({
          cardEl: document.getElementById("pvCardPersonal"),
          getLayout: function () { return pvPersonalLayout; },
          getElText: function () { return ""; },
          getImages: function () { return pvPersonalLayout.images || []; },
          hideElements: true,
          onLayoutChange: function () {},
          onSelect: function () {},
        });
      }
      if (!pvPersonalHooked) {
        pvPersonalHooked = true;
        ["pvSelName", "pvSelCompany", "pvSelAff1", "pvSelAff2", "pvSelAff3", "pvSelTitle"].forEach(function (id) {
          var node = document.getElementById(id);
          if (node) node.addEventListener("change", loadPreviewPersonalImages);
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
      }
      loadPreviewPersonalImages();
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
          textFlow: true,
          isActive: cfg.isActive || function () { return true; },
          onBeforePrint: function () {
            if (userPrint) {
              userPrint.renderCard();
              if (userPrint.renderBackCard) userPrint.renderBackCard();
            }
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
