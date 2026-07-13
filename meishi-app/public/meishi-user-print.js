/**
 * 名刺印刷プレビュー（使用者画面・所有者プレビュー共通）
 * デザイン編集不可。項目選択・プレビュー・印刷のみ。
 */
(function () {
  var DEFAULT_IDS = {
    selName: "selName",
    selNameList: "selNameList",
    selNameToggle: "selNameToggle",
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
    var layoutBack = null;
    var cardUI = null;
    var backCardUI = null;
    var previewSide = "front";
    var storeHooked = false;
    var nameOptionsAll = [];
    var nameSearchComposing = false;
    var nameComboOpen = false;
    var nameComboActiveIndex = -1;

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

    function normalizeNameQuery(s) {
      return String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, "").replace(/　/g, "");
    }

    function nameMatchesQuery(name, query) {
      if (!query) return true;
      var n = String(name == null ? "" : name);
      var q = String(query);
      if (n.indexOf(q) >= 0) return true;
      return normalizeNameQuery(n).indexOf(normalizeNameQuery(q)) >= 0;
    }

    function getNameListEl() {
      var byId = el("selNameList");
      if (byId) return byId;
      var nameEl = el("selName");
      if (!nameEl) return null;
      var wrap = nameEl.closest(".name-combo") || nameEl.closest(".field");
      return wrap ? wrap.querySelector(".name-combo-list") : null;
    }

    function getNameToggleEl() {
      var byId = el("selNameToggle");
      if (byId) return byId;
      var nameEl = el("selName");
      if (!nameEl) return null;
      var wrap = nameEl.closest(".name-combo") || nameEl.closest(".field");
      return wrap ? wrap.querySelector(".name-combo-toggle") : null;
    }

    function filteredNameOptions(query, forceAll) {
      var q = forceAll ? "" : String(query || "");
      return nameOptionsAll.filter(function (v) { return nameMatchesQuery(v, q); });
    }

    function setNameComboOpen(open) {
      nameComboOpen = !!open;
      var inp = el("selName");
      var list = getNameListEl();
      if (inp) inp.setAttribute("aria-expanded", nameComboOpen ? "true" : "false");
      if (!list) return;
      if (nameComboOpen) list.hidden = false;
      else list.hidden = true;
    }

    function renderNameComboList(forceAll) {
      var inp = el("selName");
      var list = getNameListEl();
      if (!inp || !list) return;
      var query = forceAll ? "" : String(inp.value || "");
      var items = filteredNameOptions(query, !!forceAll);
      nameComboActiveIndex = -1;
      if (!items.length) {
        list.innerHTML = '<li class="is-empty">（該当なし）</li>';
        return;
      }
      list.innerHTML = items.map(function (v, i) {
        return '<li role="option" data-name="' + esc(v) + '" data-idx="' + i + '">' + esc(v) + "</li>";
      }).join("");
    }

    function commitNameValue(name, opts) {
      opts = opts || {};
      var inp = el("selName");
      var next = String(name || "").trim();
      var prev = S.name;
      S.name = next;
      if (inp) inp.value = next;
      setNameComboOpen(false);
      if (opts.skipRebuild) return;
      if (prev !== next || opts.forceRebuild) {
        if (inp) {
          try {
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (e) {
            var ev = document.createEvent("HTMLEvents");
            ev.initEvent("change", true, false);
            inp.dispatchEvent(ev);
          }
        }
        rebuild();
      }
    }

    function fillNameSelect(_values, _placeholder, skipAutoPick) {
      var inp = el("selName");
      if (!inp) return false;
      var field = inp.closest(".field");
      // プルダウンは常に全社員を候補にする
      nameOptionsAll = uniq(records.map(function (r) { return r.name; })).sort(function (a, b) {
        return String(a).localeCompare(String(b), "ja");
      });
      var changed = false;
      if (!nameOptionsAll.length) {
        inp.disabled = true;
        inp.value = "";
        if (field) field.classList.add("field-disabled");
        if (S.name !== "") { S.name = ""; changed = true; }
        renderNameComboList(true);
        setNameComboOpen(false);
        return changed;
      }
      inp.disabled = false;
      if (field) field.classList.remove("field-disabled");
      if (skipAutoPick) {
        if (S.name !== "") { S.name = ""; changed = true; }
        inp.value = "";
        renderNameComboList(true);
        return changed;
      }
      if (nameOptionsAll.length === 1 && !S.name) {
        S.name = nameOptionsAll[0];
        changed = true;
      }
      if (S.name && nameOptionsAll.indexOf(S.name) < 0) {
        S.name = "";
        changed = true;
      }
      if (!(document.activeElement === inp && !S.name && nameComboOpen)) {
        inp.value = S.name || "";
      }
      if (nameComboOpen) renderNameComboList(false);
      return changed;
    }

    function fillSelect(selEl, values, placeholder, stateKey, skipAutoPick) {
      if (!selEl) return false;
      if (selEl.tagName === "INPUT") return false;
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
      if (skipAutoPick) {
        selEl.value = "";
        if (S[stateKey] !== "") { S[stateKey] = ""; changed = true; }
        return changed;
      }
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

    function syncSelectionFromForm() {
      var co = el("selCompany");
      if (co) S.company = co.value || "";
      var a1 = el("selAff1");
      if (a1) S.aff1 = a1.value || "";
      var a2 = el("selAff2");
      if (a2) S.aff2 = a2.value || "";
    }

    function refreshLayoutFromStore() {
      syncSelectionFromForm();
      if (!S.company) return;
      layout = MeishiCatalog.normalizeLayout(MeishiLayout.clone(
        MeishiStore.getEffectiveLayout(S.company, S.aff1, S.aff2)
      ));
      layoutBack = MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(
        MeishiStore.getEffectiveBackLayout(S.company, S.aff1, S.aff2)
      ));
      if (cardUI) cardUI.invalidate();
      if (backCardUI) backCardUI.invalidate();
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
      refreshLayoutFromStore();
      if (!layout) {
        layout = MeishiCatalog.normalizeLayout(resolveStdLayout());
        if (cardUI) cardUI.invalidate();
      }
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

    function ensureBackCardUI() {
      if (backCardUI) return;
      var backEl = document.getElementById("pvCardBack");
      if (!backEl || !window.MeishiBackCardUI) return;
      backCardUI = MeishiBackCardUI.createBackCardUI({
        cardEl: backEl,
        readOnly: true,
        getLayout: function () { return layoutBack || MeishiLayout.defBackLayout(); },
        onLayoutChange: function () {},
        onSelect: function () {},
      });
    }

    function renderBackCard() {
      if (!S.company) return;
      if (!layoutBack) {
        layoutBack = MeishiCatalog.normalizeBackLayout(MeishiLayout.clone(
          MeishiStore.getEffectiveBackLayout(S.company, S.aff1, S.aff2)
        ));
      }
      ensureBackCardUI();
      if (backCardUI) backCardUI.renderCard();
    }

    function updatePreviewSideHint() {
      var hint = document.getElementById("pvSideHint");
      if (!hint) return;
      hint.textContent = previewSide === "back"
        ? "裏面プレビュー（会社・部署共通の裏面デザイン）"
        : "個人画像は氏名を選ぶと表示・印刷されます";
    }

    function setPreviewSide(side) {
      previewSide = side === "back" ? "back" : "front";
      var fw = document.getElementById("pvFrontWrap");
      var bw = document.getElementById("pvBackWrap");
      if (fw) fw.style.display = previewSide === "front" ? "" : "none";
      if (bw) bw.style.display = previewSide === "back" ? "" : "none";
      updatePreviewSideHint();
      if (previewSide === "back") {
        refreshLayoutFromStore();
        renderBackCard();
      } else {
        renderCard();
      }
    }

    function rebuild() {
      var guard = 0;
      var changed = true;
      while (changed && guard++ < 20) {
        changed = false;
        changed = fillNameSelect(filteredExcept("name").map(function (r) { return r.name; }), "氏名を選択") || changed;
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
      refreshLayoutFromStore();
      if (previewSide === "back") renderBackCard();
      else renderCard();
    }

    function bindSel(idKey, stateKey, resetKeys) {
      var node = el(idKey);
      if (!node || node._mpBound) return;
      if (node.tagName === "INPUT" && stateKey === "name") return;
      node._mpBound = true;
      node.addEventListener("change", function () {
        S[stateKey] = this.value;
        (resetKeys || []).forEach(function (k) { S[k] = ""; });
        rebuild();
      });
    }

    function highlightNameComboItem(idx) {
      var list = getNameListEl();
      if (!list) return;
      var items = list.querySelectorAll("li[data-name]");
      nameComboActiveIndex = idx;
      items.forEach(function (li, i) {
        li.classList.toggle("is-active", i === idx);
      });
      if (idx >= 0 && items[idx] && items[idx].scrollIntoView) {
        items[idx].scrollIntoView({ block: "nearest" });
      }
    }

    function openNameCombo(forceAll) {
      var inp = el("selName");
      if (!inp || inp.disabled) return;
      renderNameComboList(!!forceAll);
      setNameComboOpen(true);
      highlightNameComboItem(-1);
    }

    function bindNameCombo() {
      var inp = el("selName");
      var list = getNameListEl();
      var toggle = getNameToggleEl();
      if (!inp || inp._mpNameComboBound) return;
      inp._mpNameComboBound = true;

      function pickFromActiveOrQuery() {
        var items = filteredNameOptions(inp.value, false);
        if (nameComboActiveIndex >= 0 && items[nameComboActiveIndex]) {
          commitNameValue(items[nameComboActiveIndex]);
          return;
        }
        var q = String(inp.value || "").trim();
        if (nameOptionsAll.indexOf(q) >= 0) {
          commitNameValue(q);
          return;
        }
        if (items.length === 1) {
          commitNameValue(items[0]);
          return;
        }
      }

      inp.addEventListener("focus", function () {
        openNameCombo(!String(inp.value || "").trim());
      });
      inp.addEventListener("click", function () {
        openNameCombo(!String(inp.value || "").trim());
      });
      inp.addEventListener("compositionstart", function () { nameSearchComposing = true; });
      inp.addEventListener("compositionend", function () {
        nameSearchComposing = false;
        openNameCombo(false);
      });
      inp.addEventListener("input", function () {
        if (nameSearchComposing) return;
        // 入力中は確定氏名をいったん外し、候補を下に表示
        if (S.name && String(inp.value || "") !== S.name) S.name = "";
        openNameCombo(false);
      });
      inp.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          if (!nameComboOpen) openNameCombo(!String(inp.value || "").trim());
          var itemsDown = filteredNameOptions(inp.value, false);
          if (!itemsDown.length && !String(inp.value || "").trim()) {
            openNameCombo(true);
            itemsDown = filteredNameOptions("", true);
          }
          if (!itemsDown.length) return;
          highlightNameComboItem(Math.min(itemsDown.length - 1, nameComboActiveIndex + 1));
          return;
        }
        if (ev.key === "ArrowUp") {
          ev.preventDefault();
          if (!nameComboOpen) return;
          highlightNameComboItem(Math.max(-1, nameComboActiveIndex - 1));
          return;
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          pickFromActiveOrQuery();
          return;
        }
        if (ev.key === "Escape") {
          setNameComboOpen(false);
          if (S.name) inp.value = S.name;
          return;
        }
      });
      inp.addEventListener("blur", function () {
        setTimeout(function () {
          if (!nameComboOpen) return;
          setNameComboOpen(false);
          var q = String(inp.value || "").trim();
          if (!q) {
            if (S.name) commitNameValue("", { forceRebuild: true });
            return;
          }
          if (nameOptionsAll.indexOf(q) >= 0) {
            if (q !== S.name) commitNameValue(q);
            else inp.value = q;
            return;
          }
          var hits = filteredNameOptions(q, false);
          if (hits.length === 1) {
            commitNameValue(hits[0]);
            return;
          }
          // 未確定入力は選択値へ戻す
          inp.value = S.name || "";
        }, 150);
      });

      if (toggle && !toggle._mpBound) {
        toggle._mpBound = true;
        toggle.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
        toggle.addEventListener("click", function (ev) {
          ev.preventDefault();
          if (inp.disabled) return;
          if (nameComboOpen) {
            setNameComboOpen(false);
            return;
          }
          inp.focus();
          openNameCombo(true);
        });
      }

      if (list && !list._mpBound) {
        list._mpBound = true;
        list.addEventListener("mousedown", function (ev) {
          var li = ev.target.closest("li[data-name]");
          if (!li) return;
          ev.preventDefault();
          commitNameValue(li.getAttribute("data-name") || "");
        });
      }

      if (!document.documentElement._mpNameComboDocBound) {
        document.documentElement._mpNameComboDocBound = true;
        document.addEventListener("mousedown", function (ev) {
          var wrap = inp.closest(".name-combo");
          if (!wrap) return;
          if (wrap.contains(ev.target)) return;
          setNameComboOpen(false);
        });
      }
    }

    function bindInputs() {
      bindNameCombo();
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
        var inp2 = el(k);
        if (inp2 && !inp2._mpBound) {
          inp2._mpBound = true;
          inp2.addEventListener("input", renderCard);
        }
      });
      var btn = el("btnPrint");
      if (btn && !btn._mpBound) {
        btn._mpBound = true;
        btn.addEventListener("click", function () {
          if (cardUI) cardUI.clearSelection();
          var printArea = document.getElementById("printArea") || document.getElementById("pvPrintArea");
          if (window.MeishiPrintSheet && typeof window.MeishiPrintSheet.printFromArea === "function") {
            window.MeishiPrintSheet.printFromArea(printArea, {
              beforePrint: function () {
                if (typeof cfg.onBeforePrint === "function") cfg.onBeforePrint();
              },
              prepareRender: function () {
                renderCard();
                renderBackCard();
                if (typeof cfg.preparePrint === "function") cfg.preparePrint();
              },
              afterPrint: function () {
                renderCard();
                if (previewSide === "back") renderBackCard();
              },
            });
          } else {
            if (typeof cfg.onBeforePrint === "function") cfg.onBeforePrint();
            renderCard();
            renderBackCard();
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
      var nameInp = el("selName");
      if (nameInp) nameInp.value = "";
      setNameComboOpen(false);
      ["inQual", "inAddress", "inTel", "inFax", "inMobile", "inEmail", "inUrl", "inKoji"].forEach(function (k) {
        var inp = el(k);
        if (inp) inp.value = "";
      });
      layout = MeishiCatalog.normalizeLayout(MeishiLayout.defLayout());
      if (cardUI) cardUI.invalidate();
      var guard = 0;
      var changed = true;
      while (changed && guard++ < 20) {
        changed = false;
        changed = fillNameSelect(null, "氏名を選択", true) || changed;
        changed = fillSelect(el("selCompany"), filteredExcept("company").map(function (r) { return r.company; }), "会社・団体名", "company", true) || changed;
        changed = fillSelect(el("selAff1"), filteredExcept("aff1").map(function (r) { return r.aff1; }), "所属1", "aff1", true) || changed;
        changed = fillSelect(el("selAff2"), filteredExcept("aff2").map(function (r) { return r.aff2; }), "所属2", "aff2", true) || changed;
        changed = fillSelect(el("selAff3"), filteredExcept("aff3").map(function (r) { return r.aff3; }), "所属3", "aff3", true) || changed;
        changed = fillSelect(el("selTitle"), filteredExcept("title").map(function (r) { return r.title; }), "役職", "title", true) || changed;
        changed = fillSelect(el("selPostal"), filteredExcept("postal").map(function (r) { return r.postal; }), "郵便番号", "postal", true) || changed;
      }
      renderCard();
      if (previewSide === "back") renderBackCard();
      if (typeof cfg.onClear === "function") cfg.onClear();
    }

    function hookStore() {
      if (storeHooked) return;
      storeHooked = true;
      MeishiStore.onConfigChange(function () {
        reloadRecords();
        if (cfg.isActive && cfg.isActive()) {
          rebuild();
        } else {
          refreshLayoutFromStore();
          if (previewSide === "back") renderBackCard();
          else if (layout) renderCard();
        }
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
      renderBackCard: renderBackCard,
      setPreviewSide: setPreviewSide,
      clear: clear,
    };
  }

  window.MeishiUserPrint = {
    create: create,
    DEFAULT_IDS: DEFAULT_IDS,
  };
})();
