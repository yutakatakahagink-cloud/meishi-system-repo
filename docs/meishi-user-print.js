/**
 * 名刺印刷プレビュー（使用者画面・所有者プレビュー共通）
 * デザイン編集不可。項目選択・プレビュー・印刷のみ。
 */
(function () {
  var DEFAULT_IDS = {
    selName: "selName",
    selCompany: "selCompany",
    selAff1: "selAff1",
    selAff2: "selAff2",
    selAff3: "selAff3",
    selTitle: "selTitle",
    selPostal: "selPostal",
    inQual: "inQual",
    inAddress: "inAddress",
    inTel: "inTel",
    inFax: "inFax",
    inMobile: "inMobile",
    inEmail: "inEmail",
    inUrl: "inUrl",
    inKoji: "inKoji",
    card: "card",
    btnPrint: "btnPrint",
  };

  function uniq(arr) {
    var s = [];
    arr.forEach(function (x) {
      if (x != null && String(x).trim() !== "" && s.indexOf(x) < 0) s.push(x);
    });
    return s;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function create(cfg) {
    cfg = cfg || {};
    var ids = Object.assign({}, DEFAULT_IDS, cfg.ids || {});
    function el(key) { return document.getElementById(ids[key]); }

    var records = [];
    var S = { name: "", company: "", aff1: "", aff2: "", aff3: "", title: "", postal: "" };
    var layout = null;
    var cardUI = null;
    var storeHooked = false;

    function reloadRecords() {
      records = MeishiStore.getMergedRecords();
    }

    function filtered(level) {
      return records.filter(function (r) {
        if (S.name && r.name !== S.name) return false;
        if (level >= 1 && S.company && r.company !== S.company) return false;
        if (level >= 2 && S.aff1 && (r.aff1 || "") !== S.aff1) return false;
        if (level >= 3 && S.aff2 && (r.aff2 || "") !== S.aff2) return false;
        if (level >= 4 && S.aff3 && (r.aff3 || "") !== S.aff3) return false;
        if (level >= 5 && S.title && (r.title || "") !== S.title) return false;
        return true;
      });
    }

    function firstNonEmpty(rows, key) {
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][key] && String(rows[i][key]).trim() !== "") return rows[i][key];
      }
      return "";
    }

    function fillSelect(selEl, values, placeholder, stateKey) {
      var arr = uniq(values);
      var field = selEl.closest(".field");
      var changed = false;
      if (arr.length === 0) {
        selEl.innerHTML = "<option value=\"\">（該当なし）</option>";
        selEl.disabled = true;
        selEl.value = "";
        if (field) field.classList.add("field-disabled");
        if (S[stateKey] !== "") { S[stateKey] = ""; changed = true; }
        return changed;
      }
      selEl.disabled = false;
      if (field) field.classList.remove("field-disabled");
      selEl.innerHTML = "<option value=\"\">" + esc(placeholder || "（選択）") + "</option>" +
        arr.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
      if (arr.length === 1) {
        if (S[stateKey] !== arr[0]) changed = true;
        S[stateKey] = arr[0];
        selEl.value = arr[0];
        return changed;
      }
      if (S[stateKey] && arr.indexOf(S[stateKey]) >= 0) {
        selEl.value = S[stateKey];
        return false;
      }
      if (S[stateKey] !== "") { S[stateKey] = ""; changed = true; }
      selEl.value = "";
      return changed;
    }

    function resolveStdLayout() {
      if (S.company) {
        var eff = MeishiStore.getEffectiveLayout(S.company, S.aff1, S.aff2);
        if (eff) return MeishiCatalog.normalizeLayout(MeishiLayout.clone(eff));
      }
      var std = MeishiStore.getDefaultLayout();
      return std ? MeishiLayout.clone(std) : MeishiLayout.defLayout();
    }

    function initLayout() {
      layout = MeishiCatalog.normalizeLayout(resolveStdLayout());
      if (cardUI) cardUI.invalidate();
    }

    function elText(id) {
      if (id === "company") return el("selCompany").value;
      if (id === "aff") {
        return [el("selAff1").value, el("selAff2").value, el("selAff3").value, el("selTitle").value]
          .filter(Boolean).join("　");
      }
      if (id === "name") return el("selName").value;
      if (id === "qual") return el("inQual").value;
      if (id === "koji") return el("inKoji").value;
      if (id === "address") {
        var p = el("inAddress").value;
        var po = el("selPostal").value;
        return (po ? "〒" + po + " " : "") + p;
      }
      if (id === "telfax") {
        var t = el("inTel").value;
        var f = el("inFax").value;
        return [t ? "TEL " + t : "", f ? "FAX " + f : ""].filter(Boolean).join("\u3000");
      }
      if (id === "mobile") {
        var m = el("inMobile").value;
        return m ? "携帯 " + m : "";
      }
      if (id === "email") return el("inEmail").value;
      if (id === "url") return el("inUrl").value;
      return "";
    }

    function ensureCardUI() {
      if (cardUI) return;
      cardUI = MeishiCardUI.createCardUI({
        cardEl: el("card"),
        readOnly: true,
        textFlow: !!cfg.textFlow,
        getLayout: function () { return layout; },
        getElText: elText,
        getImages: function () {
          if (!S.company) return [];
          return MeishiStore.getPrintImages(S.company, S.aff1, S.aff2);
        },
        onLayoutChange: function () {},
        onSelect: function () {},
      });
    }

    function renderCard() {
      ensureCardUI();
      cardUI.renderCard();
    }

    function rebuild() {
      var guard = 0;
      var changed = true;
      while (changed && guard++ < 20) {
        changed = false;
        changed = fillSelect(el("selName"), records.map(function (r) { return r.name; }).sort(), "氏名を選択", "name") || changed;
        var byName = filtered(0);
        changed = fillSelect(el("selCompany"), byName.map(function (r) { return r.company; }), "会社・団体名", "company") || changed;
        var byCo = filtered(1);
        changed = fillSelect(el("selAff1"), byCo.map(function (r) { return r.aff1; }), "所属1", "aff1") || changed;
        var b2 = filtered(2);
        changed = fillSelect(el("selAff2"), b2.map(function (r) { return r.aff2; }), "所属2", "aff2") || changed;
        var b3 = filtered(3);
        changed = fillSelect(el("selAff3"), b3.map(function (r) { return r.aff3; }), "所属3", "aff3") || changed;
        var b4 = filtered(4);
        changed = fillSelect(el("selTitle"), b4.map(function (r) { return r.title; }), "役職", "title") || changed;
        var b5 = filtered(5);
        changed = fillSelect(el("selPostal"), b5.map(function (r) { return r.postal; }), "郵便番号", "postal") || changed;
      }
      var byCo2 = filtered(1);
      var b5f = filtered(5);
      el("inUrl").value = firstNonEmpty(byCo2, "url");
      el("inMobile").value = firstNonEmpty(b5f.length ? b5f : byCo2, "mobile");
      el("inEmail").value = firstNonEmpty(b5f.length ? b5f : byCo2, "email");
      el("inQual").value = firstNonEmpty(b5f.length ? b5f : byCo2, "qual");
      var locRows = S.postal ? b5f.filter(function (r) { return (r.postal || "") === S.postal; }) : (b5f.length ? b5f : byCo2);
      el("inAddress").value = firstNonEmpty(locRows, "address");
      el("inTel").value = firstNonEmpty(locRows, "tel");
      el("inFax").value = firstNonEmpty(locRows, "fax");
      if (S.company) {
        layout = resolveStdLayout();
        layout = MeishiCatalog.normalizeLayout(layout);
        if (cardUI) cardUI.invalidate();
      }
      renderCard();
    }

    function bindSel(idKey, stateKey, resetKeys) {
      var node = el(idKey);
      if (!node || node._mpBound) return;
      node._mpBound = true;
      node.addEventListener("change", function () {
        S[stateKey] = this.value;
        (resetKeys || []).forEach(function (k) { S[k] = ""; });
        rebuild();
      });
    }

    function bindInputs() {
      bindSel("selName", "name", ["company", "aff1", "aff2", "aff3", "title", "postal"]);
      bindSel("selCompany", "company", ["aff1", "aff2", "aff3", "title", "postal"]);
      bindSel("selAff1", "aff1", ["aff2", "aff3", "title"]);
      bindSel("selAff2", "aff2", ["aff3", "title"]);
      bindSel("selAff3", "aff3", ["title"]);
      bindSel("selTitle", "title", []);
      var sp = el("selPostal");
      if (sp && !sp._mpBound) {
        sp._mpBound = true;
        sp.addEventListener("change", function () { S.postal = this.value; rebuild(); });
      }
      ["inQual", "inAddress", "inTel", "inFax", "inMobile", "inEmail", "inUrl", "inKoji"].forEach(function (k) {
        var inp = el(k);
        if (inp && !inp._mpBound) {
          inp._mpBound = true;
          inp.addEventListener("input", renderCard);
        }
      });
      var btn = el("btnPrint");
      if (btn && !btn._mpBound) {
        btn._mpBound = true;
        btn.addEventListener("click", function () {
          if (cardUI) cardUI.clearSelection();
          if (typeof cfg.onBeforePrint === "function") cfg.onBeforePrint();
          renderCard();
          var printArea = document.getElementById("printArea") || document.getElementById("pvPrintArea");
          if (window.MeishiPrintSheet && typeof window.MeishiPrintSheet.printFromArea === "function") {
            window.MeishiPrintSheet.printFromArea(printArea, {
              afterPrint: function () { renderCard(); },
            });
          } else {
            window.print();
            renderCard();
          }
        });
      }
    }

    function hookStore() {
      if (storeHooked) return;
      storeHooked = true;
      MeishiStore.onConfigChange(function () {
        reloadRecords();
        if (cfg.isActive && cfg.isActive()) rebuild();
      });
      MeishiStore.onRecordsChange(function () {
        reloadRecords();
        if (cfg.isActive && cfg.isActive()) rebuild();
      });
    }

    function init() {
      S = { name: "", company: "", aff1: "", aff2: "", aff3: "", title: "", postal: "" };
      reloadRecords();
      bindInputs();
      hookStore();
      initLayout();
      ensureCardUI();
      rebuild();
    }

    return {
      init: init,
      rebuild: rebuild,
      renderCard: renderCard,
    };
  }

  window.MeishiUserPrint = {
    create: create,
    DEFAULT_IDS: DEFAULT_IDS,
  };
})();
