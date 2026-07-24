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
    selMobile: "selMobile",
    inQual: "inQual",
    inAddress: "inAddress",
    inTel: "inTel",
    inFax: "inFax",
    inEmail: "inEmail",
    inUrl: "inUrl",
    inKoji: "inKoji",
    card: "card",
    btnPrint: "btnPrint",
    btnPreview: "btnPreview",
    btnClear: "btnClear",
  };

  function uniq(arr) {
    var seen = Object.create(null);
    var s = [];
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i];
      if (x == null) continue;
      var str = String(x);
      if (!str.trim() || seen[str]) continue;
      seen[str] = 1;
      s.push(x);
    }
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
    var S = { name: "", company: "", aff1: "", aff2: "", aff3: "", title: "", postal: "", mobile: "" };
    var layout = null;
    var layoutBack = null;
    var cardUI = null;
    var backCardUI = null;
    var previewSide = "front";
    var storeHooked = false;
    var nameOptionsAll = [];
    /** 所属などとは独立。氏名の手入力検索用の全氏名一覧 */
    var nameOptionsUniverse = [];
    var nameFuriganaMap = Object.create(null);
    var nameSearchComposing = false;
    var nameComboOpen = false;
    var nameComboActiveIndex = -1;
    /** "cascade"=プルダウン（会社・所属該当） / "search"=手入力で全氏名検索 */
    var nameListMode = "cascade";
    var selectSig = {};
    var rebuildRaf = 0;
    var renderCardRaf = 0;

    function rebuildNameUniverse() {
      var kana = Object.create(null);
      var seen = Object.create(null);
      var names = [];
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        var n = r && r.name != null ? String(r.name).trim() : "";
        if (!n || seen[n]) {
          if (n && r.furigana && !kana[n]) kana[n] = String(r.furigana).trim();
          continue;
        }
        seen[n] = 1;
        names.push(n);
        if (r.furigana) kana[n] = String(r.furigana).trim();
      }
      names.sort(compareNamesAiroWithMap(kana));
      nameOptionsUniverse = names;
      nameFuriganaMap = kana;
    }

    /** カタカナ→ひらがな（あいうえお順用） */
    function toHiraganaKey(s) {
      return String(s || "").replace(/[\u30A1-\u30F6]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0x60);
      });
    }

    function compareNamesAiroWithMap(kanaMap) {
      return function (a, b) {
        var ka = toHiraganaKey((kanaMap && kanaMap[a]) || a);
        var kb = toHiraganaKey((kanaMap && kanaMap[b]) || b);
        var c = ka.localeCompare(kb, "ja");
        return c || String(a).localeCompare(String(b), "ja");
      };
    }

    function compareNamesAiro(a, b) {
      return compareNamesAiroWithMap(nameFuriganaMap)(a, b);
    }

    function sortNamesAiro(list) {
      return (list || []).slice().sort(compareNamesAiro);
    }

    function reloadRecords() {
      records = MeishiStore.getMergedRecords();
      selectSig = {};
      rebuildNameUniverse();
    }

    function collectField(matchFn, field) {
      var seen = Object.create(null);
      var out = [];
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (!matchFn(r)) continue;
        var v = field === "name" ? r.name
          : field === "company" ? r.company
          : field === "aff1" ? r.aff1
          : field === "aff2" ? r.aff2
          : field === "aff3" ? r.aff3
          : field === "title" ? r.title
          : field === "mobile" ? r.mobile
          : r.postal;
        if (v == null || String(v).trim() === "") continue;
        var key = String(v);
        if (seen[key]) continue;
        seen[key] = 1;
        out.push(v);
      }
      return out;
    }

    /** 氏名／会社／所属などの候補を一度に算出（フィルタ規則は従来どおり） */
    function computeCascadeOptions() {
      var name = S.name;
      var company = S.company;
      var aff1 = S.aff1;
      var aff2 = S.aff2;
      var aff3 = S.aff3;
      var title = S.title;
      return {
        name: collectField(function (r) {
          if (company && r.company !== company) return false;
          if (aff1 && (r.aff1 || "") !== aff1) return false;
          if (aff2 && (r.aff2 || "") !== aff2) return false;
          if (aff3 && (r.aff3 || "") !== aff3) return false;
          return true;
        }, "name").sort(compareNamesAiro),
        company: collectField(function (r) {
          if (name && r.name !== name) return false;
          return true;
        }, "company"),
        aff1: collectField(function (r) {
          if (name && r.name !== name) return false;
          if (company && r.company !== company) return false;
          return true;
        }, "aff1"),
        aff2: collectField(function (r) {
          if (name && r.name !== name) return false;
          if (company && r.company !== company) return false;
          if (aff1 && (r.aff1 || "") !== aff1) return false;
          return true;
        }, "aff2"),
        aff3: collectField(function (r) {
          if (name && r.name !== name) return false;
          if (company && r.company !== company) return false;
          if (aff1 && (r.aff1 || "") !== aff1) return false;
          if (aff2 && (r.aff2 || "") !== aff2) return false;
          return true;
        }, "aff3"),
        title: collectField(function (r) {
          if (name && r.name !== name) return false;
          if (company && r.company !== company) return false;
          if (aff1 && (r.aff1 || "") !== aff1) return false;
          if (aff2 && (r.aff2 || "") !== aff2) return false;
          if (aff3 && (r.aff3 || "") !== aff3) return false;
          return true;
        }, "title"),
        postal: collectField(function (r) {
          if (name && r.name !== name) return false;
          if (company && r.company !== company) return false;
          if (aff1 && (r.aff1 || "") !== aff1) return false;
          if (aff2 && (r.aff2 || "") !== aff2) return false;
          if (aff3 && (r.aff3 || "") !== aff3) return false;
          if (title && (r.title || "") !== title) return false;
          return true;
        }, "postal"),
        mobile: collectField(function (r) {
          if (name && r.name !== name) return false;
          if (company && r.company !== company) return false;
          if (aff1 && (r.aff1 || "") !== aff1) return false;
          if (aff2 && (r.aff2 || "") !== aff2) return false;
          if (aff3 && (r.aff3 || "") !== aff3) return false;
          if (title && (r.title || "") !== title) return false;
          return true;
        }, "mobile"),
      };
    }

    function optionValuesFor(field) {
      return computeCascadeOptions()[field] || [];
    }

    function filterRecords(opts) {
      opts = opts || {};
      return records.filter(function (r) {
        if (!opts.skipName && S.name && r.name !== S.name) return false;
        if (!opts.skipCompany && S.company && r.company !== S.company) return false;
        if (!opts.skipAff1 && S.aff1 && (r.aff1 || "") !== S.aff1) return false;
        if (!opts.skipAff2 && S.aff2 && (r.aff2 || "") !== S.aff2) return false;
        if (!opts.skipAff3 && S.aff3 && (r.aff3 || "") !== S.aff3) return false;
        if (!opts.skipTitle && S.title && (r.title || "") !== S.title) return false;
        if (!opts.skipPostal && S.postal && (r.postal || "") !== S.postal) return false;
        return true;
      });
    }

    function filteredExcept(skipKey) {
      var opts = {};
      if (skipKey === "name") opts.skipName = true;
      if (skipKey === "company") opts.skipCompany = true;
      if (skipKey === "aff1") opts.skipAff1 = true;
      if (skipKey === "aff2") opts.skipAff2 = true;
      if (skipKey === "aff3") opts.skipAff3 = true;
      if (skipKey === "title") opts.skipTitle = true;
      if (skipKey === "postal") opts.skipPostal = true;
      return filterRecords(opts);
    }

    function filtered() {
      return filterRecords({});
    }

    function pruneAgainst(opts) {
      var changed = false;
      function prune(key) {
        if (!S[key]) return;
        var values = opts[key] || [];
        if (values.indexOf(S[key]) >= 0) return;
        S[key] = "";
        changed = true;
      }
      // 氏名は所属・会社の絞り込みで消さない（検索で全氏名を選べる）
      prune("company");
      prune("aff1");
      prune("aff2");
      prune("aff3");
      prune("title");
      prune("postal");
      prune("mobile");
      return changed;
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
      if (normalizeNameQuery(n).indexOf(normalizeNameQuery(q)) >= 0) return true;
      var f = nameFuriganaMap[n] || "";
      if (f && (f.indexOf(q) >= 0 || normalizeNameQuery(f).indexOf(normalizeNameQuery(q)) >= 0)) return true;
      return false;
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

    function filteredNameOptions(query) {
      var q = String(query || "");
      var source;
      if (nameListMode === "search") {
        // 手入力検索: 全氏名
        source = nameOptionsUniverse.length ? nameOptionsUniverse : nameOptionsAll;
      } else {
        // プルダウン: 会社・所属などカスケード該当の氏名（未選択時は全氏名）
        source = nameOptionsAll.length ? nameOptionsAll : nameOptionsUniverse;
      }
      return sortNamesAiro(source.filter(function (v) { return nameMatchesQuery(v, q); }));
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

    function renderNameComboList() {
      var inp = el("selName");
      var list = getNameListEl();
      if (!inp || !list) return;
      var query = nameListMode === "search" ? String(inp.value || "") : "";
      var items = filteredNameOptions(query);
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
      // カスケード候補内の氏名なら会社・所属を維持。全検索で別の人を選んだときだけクリア
      if (prev !== next) {
        if (nameOptionsAll.indexOf(next) < 0) {
          S.company = "";
          S.aff1 = "";
          S.aff2 = "";
          S.aff3 = "";
          S.title = "";
          S.postal = "";
          S.mobile = "";
        }
      }
      nameListMode = "cascade";
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

    function fillNameSelect(nameValues, _placeholder, skipAutoPick) {
      var inp = el("selName");
      if (!inp) return false;
      var field = inp.closest(".field");
      nameOptionsAll = sortNamesAiro(Array.isArray(nameValues) ? nameValues : optionValuesFor("name"));
      var changed = false;
      inp.disabled = false;
      if (field) field.classList.remove("field-disabled");
      if (skipAutoPick) {
        if (S.name !== "") { S.name = ""; changed = true; }
        inp.value = "";
        nameListMode = "cascade";
        renderNameComboList();
        return changed;
      }
      // 氏名未選択かつカスケード候補が1件だけのときだけ自動選択
      if (nameOptionsAll.length === 1 && !S.name) {
        S.name = nameOptionsAll[0];
        changed = true;
      }
      // 入力中は入力内容を壊さない。それ以外は確定氏名を表示
      if (!(document.activeElement === inp && nameComboOpen)) {
        inp.value = S.name || "";
      }
      if (nameComboOpen) renderNameComboList();
      return changed;
    }

    function fillSelect(selEl, values, placeholder, stateKey, skipAutoPick) {
      if (!selEl) return false;
      if (selEl.tagName === "INPUT") return false;
      var arr = uniq(values);
      var field = selEl.closest(".field");
      var changed = false;
      var nextVal = "";
      if (skipAutoPick) {
        nextVal = "";
        if (S[stateKey] !== "") { S[stateKey] = ""; changed = true; }
      } else if (arr.length === 1) {
        // 候補が1件なら所属2・3も含め自動選択
        if (S[stateKey] !== arr[0]) changed = true;
        S[stateKey] = arr[0];
        nextVal = arr[0];
      } else if (stateKey === "mobile" && arr.length >= 1) {
        // 複数ある場合は先頭を初期選択しつつ、ドロップダウンで切替可能
        if (!S[stateKey] || arr.indexOf(S[stateKey]) < 0) {
          if (S[stateKey] !== arr[0]) changed = true;
          S[stateKey] = arr[0];
        }
        nextVal = S[stateKey];
      } else if (S[stateKey] && arr.indexOf(S[stateKey]) >= 0) {
        nextVal = S[stateKey];
      } else {
        if (S[stateKey] !== "") { S[stateKey] = ""; changed = true; }
        nextVal = "";
      }
      var sig = (skipAutoPick ? "1" : "0") + "|" + arr.join("\u0001") + "|" + nextVal;
      if (selectSig[stateKey] === sig) {
        if (arr.length === 0) {
          selEl.disabled = true;
          if (field) field.classList.add("field-disabled");
        }
        return changed;
      }
      selectSig[stateKey] = sig;
      if (arr.length === 0) {
        selEl.innerHTML = "<option value=\"\">（該当なし）</option>";
        selEl.disabled = true;
        selEl.value = "";
        if (field) field.classList.add("field-disabled");
        return changed;
      }
      selEl.disabled = false;
      if (field) field.classList.remove("field-disabled");
      selEl.innerHTML = "<option value=\"\">" + esc(placeholder || "（選択）") + "</option>" +
        arr.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
      selEl.value = nextVal;
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
        var mEl = el("selMobile");
        var m = mEl ? mEl.value : "";
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

    function scheduleRenderCard() {
      if (renderCardRaf) return;
      renderCardRaf = requestAnimationFrame(function () {
        renderCardRaf = 0;
        renderCard();
      });
    }

    function applyCascadeOptions(opts, skipAutoPick) {
      var changed = false;
      changed = fillNameSelect(opts.name, "氏名を選択", skipAutoPick) || changed;
      changed = fillSelect(el("selCompany"), opts.company, "会社・団体名", "company", skipAutoPick) || changed;
      changed = fillSelect(el("selAff1"), opts.aff1, "所属1", "aff1", skipAutoPick) || changed;
      changed = fillSelect(el("selAff2"), opts.aff2, "所属2", "aff2", skipAutoPick) || changed;
      changed = fillSelect(el("selAff3"), opts.aff3, "所属3", "aff3", skipAutoPick) || changed;
      changed = fillSelect(el("selTitle"), opts.title, "役職", "title", skipAutoPick) || changed;
      changed = fillSelect(el("selPostal"), opts.postal, "郵便番号", "postal", skipAutoPick) || changed;
      changed = fillSelect(el("selMobile"), opts.mobile, "携帯", "mobile", skipAutoPick) || changed;
      return changed;
    }

    function rebuild() {
      var opts = computeCascadeOptions();
      if (pruneAgainst(opts)) opts = computeCascadeOptions();
      // 氏名選択後、紐づく候補が1件ずつのとき連鎖的に自動選択
      var guard = 0;
      while (guard++ < 8) {
        if (!applyCascadeOptions(opts, false)) break;
        opts = computeCascadeOptions();
        if (pruneAgainst(opts)) opts = computeCascadeOptions();
      }
      var rows = filtered();
      el("inUrl").value = firstNonEmpty(rows, "url");
      var emailEl = el("inEmail");
      if (emailEl && !emailEl._pvTyping) emailEl.value = firstNonEmpty(rows, "email");
      var qualEl = el("inQual");
      if (qualEl && !qualEl._pvTyping) qualEl.value = firstNonEmpty(rows, "qual");
      var locRows = S.postal ? rows.filter(function (r) { return (r.postal || "") === S.postal; }) : rows;
      el("inAddress").value = firstNonEmpty(locRows, "address");
      el("inTel").value = firstNonEmpty(locRows, "tel");
      el("inFax").value = firstNonEmpty(locRows, "fax");
      refreshLayoutFromStore();
      if (previewSide === "back") renderBackCard();
      else renderCard();
    }

    function scheduleRebuild() {
      if (rebuildRaf) return;
      rebuildRaf = requestAnimationFrame(function () {
        rebuildRaf = 0;
        rebuild();
      });
    }

    function bindSel(idKey, stateKey, resetKeys) {
      var node = el(idKey);
      if (!node || node._mpBound) return;
      if (node.tagName === "INPUT" && stateKey === "name") return;
      node._mpBound = true;
      node.addEventListener("change", function () {
        S[stateKey] = this.value;
        (resetKeys || []).forEach(function (k) { S[k] = ""; });
        // 会社・所属を変えても氏名はクリアしない（氏名欄から全氏名を再検索できる）
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

    function openNameCombo(mode) {
      var inp = el("selName");
      if (!inp || inp.disabled) return;
      nameListMode = mode === "search" ? "search" : "cascade";
      renderNameComboList();
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
        var items = filteredNameOptions(nameListMode === "search" ? inp.value : "");
        if (nameComboActiveIndex >= 0 && items[nameComboActiveIndex]) {
          commitNameValue(items[nameComboActiveIndex]);
          return;
        }
        var q = String(inp.value || "").trim();
        var universe = nameOptionsUniverse.length ? nameOptionsUniverse : nameOptionsAll;
        if (universe.indexOf(q) >= 0) {
          commitNameValue(q);
          return;
        }
        if (items.length === 1) {
          commitNameValue(items[0]);
          return;
        }
      }

      inp.addEventListener("focus", function () {
        openNameCombo("cascade");
      });
      inp.addEventListener("click", function () {
        openNameCombo("cascade");
      });
      inp.addEventListener("compositionstart", function () { nameSearchComposing = true; });
      inp.addEventListener("compositionend", function () {
        nameSearchComposing = false;
        openNameCombo("search");
      });
      inp.addEventListener("input", function () {
        if (nameSearchComposing) return;
        // 入力中は確定氏名をいったん外し、全氏名から候補を表示
        if (S.name && String(inp.value || "") !== S.name) S.name = "";
        openNameCombo("search");
      });
      inp.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          if (!nameComboOpen) openNameCombo(String(inp.value || "").trim() ? "search" : "cascade");
          var itemsDown = filteredNameOptions(nameListMode === "search" ? inp.value : "");
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
          nameListMode = "cascade";
          if (S.name) inp.value = S.name;
          return;
        }
      });
      inp.addEventListener("blur", function () {
        setTimeout(function () {
          if (!nameComboOpen) {
            nameListMode = "cascade";
            return;
          }
          setNameComboOpen(false);
          var q = String(inp.value || "").trim();
          if (!q) {
            if (S.name) commitNameValue("", { forceRebuild: true });
            nameListMode = "cascade";
            return;
          }
          var universe = nameOptionsUniverse.length ? nameOptionsUniverse : nameOptionsAll;
          if (universe.indexOf(q) >= 0) {
            if (q !== S.name) commitNameValue(q);
            else inp.value = q;
            nameListMode = "cascade";
            return;
          }
          var hits = filteredNameOptions(q);
          if (hits.length === 1) {
            commitNameValue(hits[0]);
            nameListMode = "cascade";
            return;
          }
          // 未確定入力は選択値へ戻す
          inp.value = S.name || "";
          nameListMode = "cascade";
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
            nameListMode = "cascade";
            return;
          }
          inp.focus();
          openNameCombo("cascade");
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
      bindSel("selCompany", "company", ["aff1", "aff2", "aff3", "title", "postal", "mobile"]);
      bindSel("selAff1", "aff1", ["aff2", "aff3", "title", "postal", "mobile"]);
      bindSel("selAff2", "aff2", ["aff3", "title", "postal", "mobile"]);
      bindSel("selAff3", "aff3", ["title", "postal", "mobile"]);
      bindSel("selTitle", "title", ["postal", "mobile"]);
      var sp = el("selPostal");
      if (sp && !sp._mpBound) {
        sp._mpBound = true;
        sp.addEventListener("change", function () { S.postal = this.value; rebuild(); });
      }
      var sm = el("selMobile");
      if (sm && !sm._mpBound) {
        sm._mpBound = true;
        sm.addEventListener("change", function () { S.mobile = this.value; rebuild(); });
      }
      ["inQual", "inAddress", "inTel", "inFax", "inEmail", "inUrl", "inKoji"].forEach(function (k) {
        var inp2 = el(k);
        if (inp2 && !inp2._mpBound) {
          inp2._mpBound = true;
          inp2.addEventListener("input", scheduleRenderCard);
        }
      });
      var btn = el("btnPrint");
      if (btn && !btn._mpBound) {
        btn._mpBound = true;
        btn.addEventListener("click", function () {
          if (cardUI && cardUI.commitAllTextEdits) cardUI.commitAllTextEdits();
          if (backCardUI && backCardUI.commitAllTextEdits) backCardUI.commitAllTextEdits();
          if (cardUI) cardUI.clearSelection();
          if (backCardUI && backCardUI.clearSelection) backCardUI.clearSelection();
          var printArea = document.getElementById("printArea") || document.getElementById("pvPrintArea");
          if (window.MeishiPrintSheet && typeof window.MeishiPrintSheet.printFromArea === "function") {
            window.MeishiPrintSheet.printFromArea(printArea, {
              beforePrint: function () {
                if (cardUI && cardUI.commitAllTextEdits) cardUI.commitAllTextEdits();
                if (backCardUI && backCardUI.commitAllTextEdits) backCardUI.commitAllTextEdits();
                refreshLayoutFromStore();
                if (typeof cfg.onBeforePrint === "function") cfg.onBeforePrint();
              },
              prepareRender: function () {
                refreshLayoutFromStore();
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
            refreshLayoutFromStore();
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
      S = { name: "", company: "", aff1: "", aff2: "", aff3: "", title: "", postal: "", mobile: "" };
      selectSig = {};
      var nameInp = el("selName");
      if (nameInp) nameInp.value = "";
      setNameComboOpen(false);
      ["inQual", "inAddress", "inTel", "inFax", "inEmail", "inUrl", "inKoji"].forEach(function (k) {
        var inp = el(k);
        if (inp) inp.value = "";
      });
      layout = MeishiCatalog.normalizeLayout(MeishiLayout.defLayout());
      if (cardUI) cardUI.invalidate();
      applyCascadeOptions(computeCascadeOptions(), true);
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
          scheduleRebuild();
        } else {
          refreshLayoutFromStore();
          if (previewSide === "back") renderBackCard();
          else if (layout) scheduleRenderCard();
        }
      });
      MeishiStore.onRecordsChange(function () {
        reloadRecords();
        if (cfg.isActive && cfg.isActive()) scheduleRebuild();
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

    function forceSelectValue(selEl, value) {
      if (!selEl) return;
      var v = String(value == null ? "" : value);
      if (v && ![].some.call(selEl.options || [], function (o) { return o.value === v; })) {
        var opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        selEl.appendChild(opt);
      }
      selEl.value = v;
    }

    /** 名刺データ編集などから、プレビューと同じ描画状態へ反映 */
    function applyRecord(rec, opts) {
      opts = opts || {};
      rec = rec || {};
      reloadRecords();
      S.name = String(rec.name || "").trim();
      S.company = String(rec.company || "").trim();
      S.aff1 = String(rec.aff1 || "").trim();
      S.aff2 = String(rec.aff2 || "").trim();
      S.aff3 = String(rec.aff3 || "").trim();
      S.title = String(rec.title || "").trim();
      S.postal = String(rec.postal || "").trim();
      S.mobile = String(rec.mobile || "").trim();

      var nameInp = el("selName");
      if (nameInp) nameInp.value = S.name;
      forceSelectValue(el("selCompany"), S.company);
      forceSelectValue(el("selAff1"), S.aff1);
      forceSelectValue(el("selAff2"), S.aff2);
      forceSelectValue(el("selAff3"), S.aff3);
      forceSelectValue(el("selTitle"), S.title);
      forceSelectValue(el("selPostal"), S.postal);
      forceSelectValue(el("selMobile"), S.mobile);

      var qualEl = el("inQual");
      if (qualEl) qualEl.value = rec.qual || "";
      var addrEl = el("inAddress");
      if (addrEl) addrEl.value = rec.address || "";
      var telEl = el("inTel");
      if (telEl) telEl.value = rec.tel || "";
      var faxEl = el("inFax");
      if (faxEl) faxEl.value = rec.fax || "";
      var emailEl = el("inEmail");
      if (emailEl) emailEl.value = rec.email || "";
      var urlEl = el("inUrl");
      if (urlEl) urlEl.value = rec.url || "";
      var kojiEl = el("inKoji");
      if (kojiEl) {
        if (opts.koji != null) kojiEl.value = String(opts.koji);
        else if (rec.no && MeishiStore.getPreviewKoji) kojiEl.value = MeishiStore.getPreviewKoji(rec.no) || "";
        else kojiEl.value = "";
      }

      if (S.company && MeishiStore.setImageLibraryContext) {
        MeishiStore.setImageLibraryContext(S.company);
      }
      previewSide = "front";
      refreshLayoutFromStore();
      if (!layout) layout = MeishiCatalog.normalizeLayout(resolveStdLayout());
      if (cardUI && cardUI.invalidate) cardUI.invalidate();
      ensureCardUI();
      renderCard();
      if (typeof opts.onApplied === "function") opts.onApplied();
    }

    return {
      init: init,
      rebuild: rebuild,
      renderCard: renderCard,
      renderBackCard: renderBackCard,
      setPreviewSide: setPreviewSide,
      scheduleRenderCard: scheduleRenderCard,
      applyRecord: applyRecord,
      clear: clear,
    };
  }

  window.MeishiUserPrint = {
    create: create,
    DEFAULT_IDS: DEFAULT_IDS,
  };
})();
