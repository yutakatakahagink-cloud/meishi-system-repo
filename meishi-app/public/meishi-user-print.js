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
    btnPreview: "btnPreview",
    btnClear: "btnClear",
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

    function filteredExcept(skipKey) {
      return records.filter(function (r) {
        if (skipKey !== "name" && S.name && r.name !== S.name) return false;
        if (skipKey !== "company" && S.company && r.company !== S.company) return false;
        if (skipKey !== "aff1" && S.aff1 && (r.aff1 || "") !== S.aff1) return false;
        if (skipKey !== "aff2" && S.aff2 && (r.aff2 || "") !== S.aff2) return false;
        if (skipKey !== "aff3" && S.aff3 && (r.aff3 || "") !== S.aff3) return false;
        if (skipKey !== "title" && S.title && (r.title || "") !== S.title) return false;
        if (skipKey !== "postal" && S.postal && (r.postal || "") !== S.postal) return false;
        return true;
      });
    }

    function filtered() {
      return filteredExcept(null);
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
        return [el("selAff1").value, el("selAff2").value, el("selAff3").value]
          .filter(Boolean).join("　");
      }
      if (id === "title") return el("selTitle").value;
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
        changed = fillSelect(el("selName"), filteredExcept("name").map(function (r) { return r.name; }).sort(), "氏名を選択", "name") || changed;
        changed = fillSelect(el("selCompany"), filteredExcept("company").map(function (r) { return r.company; }), "会社・団体名", "company") || changed;
        changed = fillSelect(el("selAff1"), filteredExcept("aff1").map(function (r) { return r.aff1; }), "所属1", "aff1") || changed;
        changed = fillSelect(el("selAff2"), filteredExcept("aff2").map(function (r) { return r.aff2; }), "所属2", "aff2") || changed;
        changed = fillSelect(el("selAff3"), filteredExcept("aff3").map(function (r) { return r.aff3; }), "所属3", "aff3") || changed;
        changed = fillSelect(el("selTitle"), filteredExcept("title").map(function (r) { return r.title; }), "役職", "title") || changed;
        changed = fillSelect(el("selPostal"), filteredExcept("postal").map(function (r) { return r.postal; }), "郵便番号", "postal") || changed;
      }
      var rows = filtered();
      el("inUrl").value = firstNonEmpty(rows, "url");
      el("inMobile").value = firstNonEmpty(rows, "mobile");
      el("inEmail").value = firstNonEmpty(rows, "email");
      el("inQual").value = firstNonEmpty(rows, "qual");
      var locRows = S.postal ? rows.filter(function (r) { return (r.postal || "") === S.postal; }) : rows;
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
      bindSel("selName", "name", []);
      bindSel("selCompany", "company", []);
      bindSel("selAff1", "aff1", []);
      bindSel("selAff2", "aff2", []);
      bindSel("selAff3", "aff3", []);
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
      var btnPv = el("btnPreview");
      if (btnPv && !btnPv._mpBound) {
        btnPv._mpBound = true;
        btnPv.addEventListener("click", function () {
          rebuild();
          var card = el("card");
          if (card && card.scrollIntoView) {
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      }
      var btnClr = el("btnClear");
      if (btnClr && !btnClr._mpBound) {
        btnClr._mpBound = true;
        btnClr.addEventListener("click", clear);
      }
    }

    function clear() {
      S = { name: "", company: "", aff1: "", aff2: "", aff3: "", title: "", postal: "" };
      var koji = el("inKoji");
      if (koji) koji.value = "";
      initLayout();
      rebuild();
      if (typeof cfg.onClear === "function") cfg.onClear();
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
      clear: clear,
    };
  }

  window.MeishiUserPrint = {
    create: create,
    DEFAULT_IDS: DEFAULT_IDS,
  };
})();
