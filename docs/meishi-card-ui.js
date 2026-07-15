/**
 * 名刺プレビュー・デザイン編集 UI（使用者・所有者で共有）
 * ドラッグ中は DOM 再生成せず style のみ更新して軽量化。
 * 編集時は他要素・カード端／中心への水平垂直ガイドを表示（吸着・位置制限なし）。
 */
(function () {
  var SNAP_THRESH = 6;
  var FLOW_PAD = 0;
  var CARD_W_MM = 91;
  var CENTER_GAP_MM = 2;
  var DRAG_START = 5;
  var SIZE_MIN = 6;
  var SIZE_MAX = 60;
  var SIZE_STEP = 1;

  /** 表裏共通: 自由テキストのクリップボード + Ctrl+C / Ctrl+V */
  (function initMeishiTextClip() {
    if (window.MeishiTextClip) return;
    var uis = [];
    function isOutsideCardField(el) {
      if (!el || !el.tagName) return false;
      var tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
      return !(el.closest && el.closest(".meishi"));
    }
    function findActiveUi(ev) {
      var t = ev && ev.target;
      var fallback = null;
      for (var i = 0; i < uis.length; i++) {
        var ui = uis[i];
        if (!ui || typeof ui.isActive !== "function" || !ui.isActive()) continue;
        if (t && typeof ui.contains === "function" && ui.contains(t)) return ui;
        if (!fallback) fallback = ui;
      }
      return fallback;
    }
    document.addEventListener("keydown", function (ev) {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
      var key = String(ev.key || "").toLowerCase();
      if (key !== "c" && key !== "v") return;
      if (isOutsideCardField(ev.target)) return;
      var ui = findActiveUi(ev);
      if (!ui) return;
      if (key === "c") {
        if (typeof ui.copy === "function" && ui.copy()) {
          if (!(typeof ui.isEditing === "function" && ui.isEditing())) ev.preventDefault();
        }
        return;
      }
      if (typeof ui.isEditing === "function" && ui.isEditing()) {
        if (typeof ui.pasteEdit === "function" && ui.pasteEdit()) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        return;
      }
      if (typeof ui.paste === "function" && ui.paste()) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
    window.MeishiTextClip = {
      get: function () { return window.__MEISHI_TEXT_CLIP__ || null; },
      set: function (payload) { window.__MEISHI_TEXT_CLIP__ = payload || null; },
      register: function (api) {
        if (!api || uis.indexOf(api) >= 0) return;
        uis.push(api);
      },
    };
  })();

  function maxCenterShiftMm() {
    return (CARD_W_MM - CENTER_GAP_MM) / 2;
  }

  function clampCenterShiftMm(mm) {
    var max = maxCenterShiftMm();
    return Math.max(-max, Math.min(max, Math.round(mm)));
  }

  function formatCenterShiftLabel(mm) {
    if (!mm) return "中央";
    if (mm > 0) return "左へ " + mm + "mm";
    return "右へ " + (-mm) + "mm";
  }
  /** プレビュー時の縦位置調整の並び（左右はゾーン別に処理） */
  var FLOW_STACK_ORDER = [
    "company", "aff", "title", "name", "qual", "koji",
    "address", "telfax", "mobile", "email", "url",
  ];
  /** 長いときに改行してよい項目 */
  var WRAP_ELIGIBLE_IDS = {
    company: true, aff: true, title: true, qual: true, koji: true,
    address: true, mobile: true, email: true, url: true,
    // name は中央線越え時に改行せず文字サイズ縮小（SHRINK_TO_ZONE_IDS）
  };
  /** 中央線（ゾーン幅）を超えるとき折り返しではなくフォント縮小する項目 */
  var SHRINK_TO_ZONE_IDS = { name: true };
  /** 改行しない項目（TEL/FAX など1行表示） */
  var NO_WRAP_IDS = { telfax: true };

  function pxFromEvent(e) { return e.touches ? e.touches[0] : e; }

  function bestSnap(dragEdges, targets, thresh) {
    var best = null;
    dragEdges.forEach(function (de) {
      targets.forEach(function (t) {
        var d = Math.abs(de - t);
        if (d <= thresh && (!best || d < best.d)) {
          best = { d: d, delta: t - de, line: t };
        }
      });
    });
    return best;
  }

  function collectSnapTargets(cardEl, excludeNode, zoneEdges, extraCardEls) {
    var cr = cardEl.getBoundingClientRect();
    var tx = [0, cr.width / 2, cr.width];
    var ty = [0, cr.height / 2, cr.height];
    if (zoneEdges) {
      tx.push(zoneEdges.leftEnd, zoneEdges.centerStart, zoneEdges.centerEnd, zoneEdges.rightStart);
    }
    function addNodesFrom(root) {
      if (!root) return;
      root.querySelectorAll(".el, .btel, .imgel").forEach(function (n) {
        if (n === excludeNode) return;
        var r = n.getBoundingClientRect();
        var l = r.left - cr.left;
        var t = r.top - cr.top;
        tx.push(l, l + r.width / 2, l + r.width);
        ty.push(t, t + r.height / 2, t + r.height);
      });
    }
    addNodesFrom(cardEl);
    (extraCardEls || []).forEach(addNodesFrom);
    return { tx: tx, ty: ty };
  }

  function snapDragPosition(cardEl, node, nx, ny, zoneEdges, extraCardEls) {
    var w = node.offsetWidth;
    var h = node.offsetHeight;
    var targets = collectSnapTargets(cardEl, node, zoneEdges, extraCardEls);
    var sx = bestSnap([nx, nx + w / 2, nx + w], targets.tx, SNAP_THRESH);
    var sy = bestSnap([ny, ny + h / 2, ny + h], targets.ty, SNAP_THRESH);
    return {
      nx: nx,
      ny: ny,
      guideX: sx ? sx.line : null,
      guideY: sy ? sy.line : null,
    };
  }

  function snapResizeBox(cardEl, node, x, y, nw, nh, zoneEdges, extraCardEls) {
    var targets = collectSnapTargets(cardEl, node, zoneEdges, extraCardEls);
    var sr = bestSnap([x + nw], targets.tx, SNAP_THRESH);
    var sb = bestSnap([y + nh], targets.ty, SNAP_THRESH);
    return {
      w: Math.max(16, nw),
      h: Math.max(12, nh),
      guideX: sr ? sr.line : null,
      guideY: sb ? sb.line : null,
    };
  }

  function createCardUI(opts) {
    var cardEl = opts.cardEl;
    var getLayout = opts.getLayout;
    var getElText = opts.getElText;
    var readOnly = !!opts.readOnly;
    var hideElements = !!opts.hideElements;
    var textFlow = !!opts.textFlow;
    var zoneSplitForcedOff = opts.zoneSplit === false;
    var getImages = opts.getImages || function () {
      var layout = MeishiCatalog.normalizeLayout(getLayout());
      return (layout.images || []).filter(function (im) { return im && im.src; });
    };
    var onSelect = opts.onSelect || function () {};
    var onCenterShiftChange = opts.onCenterShiftChange || function () {};
    var snapExtraCardEls = [];
    if (opts.snapExtraCardEl) {
      snapExtraCardEls = Array.isArray(opts.snapExtraCardEl) ? opts.snapExtraCardEl.slice() : [opts.snapExtraCardEl];
    }
    var sel = null;
    var built = false;
    var elNodes = {};
    var imgNodes = {};
    var textNodes = {};
    var editingId = null;
    var guideLayer = null;
    var zoneLayer = null;
    var panelShowDesign = null;

    function isZoneSplitActive() {
      if (zoneSplitForcedOff) return false;
      var layout = getLayout();
      if (layout && layout.centerDivider === false) return false;
      return true;
    }

    function getCenterShiftMm() {
      var layout = getLayout();
      if (layout && typeof layout.centerShiftMm === "number" && !isNaN(layout.centerShiftMm)) {
        return clampCenterShiftMm(layout.centerShiftMm);
      }
      return 5;
    }

    function getCardZones() {
      var w = cardEl.clientWidth || 1;
      var centerPx = w * (CENTER_GAP_MM / CARD_W_MM);
      var shiftPx = w * (getCenterShiftMm() / CARD_W_MM);
      var centerStart = Math.max(0, Math.min((w - centerPx) / 2 - shiftPx, w - centerPx));
      return {
        cardW: w,
        centerStart: centerStart,
        centerEnd: centerStart + centerPx,
        leftEnd: centerStart,
        rightStart: centerStart + centerPx,
      };
    }

    function updateZoneLayerVisual() {
      if (!zoneLayer) return;
      var z = getCardZones();
      var leftMm = (z.centerStart / z.cardW) * CARD_W_MM;
      var rightMm = (z.centerEnd / z.cardW) * CARD_W_MM;
      zoneLayer.style.background = "linear-gradient(90deg,transparent 0,transparent " + leftMm + "mm,rgba(47,85,151,.05) " + leftMm + "mm,rgba(47,85,151,.05) " + rightMm + "mm,transparent " + rightMm + "mm)";
      var handle = zoneLayer.querySelector(".card-zone-drag");
      if (handle) {
        handle.style.left = z.centerStart + "px";
        handle.style.width = Math.max(4, z.centerEnd - z.centerStart) + "px";
      }
    }

    function setCenterShiftMm(mm, opts) {
      opts = opts || {};
      var layout = getLayout();
      if (!layout) return;
      layout.centerShiftMm = clampCenterShiftMm(mm);
      updateZoneLayerVisual();
      if (!opts.visualOnly) applyZoneChangeToText();
      onCenterShiftChange(layout.centerShiftMm);
    }

    function applyZoneChangeToText() {
      if (hideElements) return;
      var layout = getLayout();
      MeishiLayout.ELS.forEach(function (e) {
        var node = elNodes[e.id];
        var st = layout.el[e.id];
        if (!node || !st) return;
        applyElStyle(node, st, getElText(e.id), e.label, e.id);
      });
      reflowTextElements(layout);
    }

    function attachCenterLineDrag(handle) {
      handle.addEventListener("pointerdown", function (ev) {
        if (readOnly || hideElements) return;
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        handle.setPointerCapture(ev.pointerId);
        cardEl.classList.add("is-dragging-center");
        var startShift = getCenterShiftMm();
        var startX = pxFromEvent(ev).clientX;
        var cardW = cardEl.clientWidth || 1;
        function shiftFromDelta(clientX) {
          var deltaPx = clientX - startX;
          var deltaMm = deltaPx * CARD_W_MM / cardW;
          return clampCenterShiftMm(startShift - deltaMm);
        }
        function mv(e2) {
          setCenterShiftMm(shiftFromDelta(pxFromEvent(e2).clientX), { visualOnly: true });
        }
        function up(e2) {
          cardEl.classList.remove("is-dragging-center");
          try { handle.releasePointerCapture(e2.pointerId); } catch (e) {}
          handle.removeEventListener("pointermove", mv);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
          applyZoneChangeToText();
          saveLayout();
        }
        handle.addEventListener("pointermove", mv);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      });
    }

    function zoneSnapEdges() {
      if (!isZoneSplitActive() || readOnly) return null;
      return getCardZones();
    }

    function useAutoWrap() {
      // 会社／部署／プレビューで折り返し条件を統一（非表示カードは除外）
      return isZoneSplitActive() && !hideElements;
    }

    function useZoneTextLayout() {
      return isZoneSplitActive() && !hideElements;
    }

    /** 左欄 or 右欄（中央2mm帯には文字を置かない） */
    function textElementSide(st) {
      var zones = getCardZones();
      if (st.x >= zones.rightStart) return "right";
      if (st.x < zones.leftEnd) return "left";
      return st.x >= (zones.leftEnd + zones.rightStart) / 2 ? "right" : "left";
    }

    function textBoxInCenterGap(x, w) {
      var zones = getCardZones();
      return x < zones.rightStart && x + w > zones.leftEnd;
    }

    function enforceZoneBounds(node, st) {
      if (!useZoneTextLayout()) return;
      var zones = getCardZones();
      var w = node.offsetWidth;
      if (w <= 0) return;
      var side = textElementSide(st);
      if (side === "left") {
        st.x = Math.max(0, Math.min(st.x, zones.leftEnd - w));
      } else {
        st.x = Math.max(zones.rightStart, Math.min(st.x, zones.cardW - w));
      }
      if (textBoxInCenterGap(st.x, w)) {
        if (side === "left") st.x = Math.max(0, zones.leftEnd - w);
        else st.x = zones.rightStart;
      }
      node.style.left = st.x + "px";
    }

    function clampTextDragX(node, nx, pointerXInCard) {
      if (!useZoneTextLayout()) return nx;
      var zones = getCardZones();
      var w = node.offsetWidth || 1;
      var gapMid = (zones.leftEnd + zones.rightStart) / 2;
      var targetSide = pointerXInCard >= gapMid ? "right" : "left";
      if (targetSide === "left") return Math.max(0, Math.min(nx, zones.leftEnd - w));
      return Math.max(zones.rightStart, Math.min(nx, zones.cardW - w));
    }

    function ensureZoneLayer() {
      if (!isZoneSplitActive() || readOnly || hideElements) return;
      if (!zoneLayer || zoneLayer.parentNode !== cardEl) {
        zoneLayer = document.createElement("div");
        zoneLayer.className = "card-zone-layer";
        cardEl.insertBefore(zoneLayer, cardEl.firstChild);
      }
      if (!zoneLayer.querySelector(".card-zone-drag")) {
        var handle = document.createElement("div");
        handle.className = "card-zone-drag";
        handle.title = "中央線をドラッグして左右に移動";
        zoneLayer.appendChild(handle);
        attachCenterLineDrag(handle);
      }
    }

    function clearZoneLayer() {
      if (zoneLayer) {
        try { zoneLayer.remove(); } catch (e) {}
        zoneLayer = null;
      }
    }

    function syncZoneMode() {
      if (!readOnly) cardEl.classList.add("design-mode");
      else cardEl.classList.remove("design-mode");

      var on = isZoneSplitActive() && !hideElements;
      if (on) {
        cardEl.classList.add("zone-split");
        if (!readOnly) {
          ensureZoneLayer();
          updateZoneLayerVisual();
        } else {
          clearZoneLayer();
        }
      } else {
        cardEl.classList.remove("zone-split");
        clearZoneLayer();
      }
    }

    function ensureGuideLayer() {
      if (readOnly) return;
      if (guideLayer && guideLayer.parentNode === cardEl) return;
      guideLayer = document.createElement("div");
      guideLayer.className = "snap-guides";
      guideLayer.setAttribute("aria-hidden", "true");
      var vLine = document.createElement("div");
      vLine.className = "snap-v";
      var hLine = document.createElement("div");
      hLine.className = "snap-h";
      guideLayer.appendChild(vLine);
      guideLayer.appendChild(hLine);
      cardEl.appendChild(guideLayer);
    }

    function showGuides(guideX, guideY) {
      if (!guideLayer) return;
      var vLine = guideLayer.querySelector(".snap-v");
      var hLine = guideLayer.querySelector(".snap-h");
      if (guideX != null) {
        vLine.style.display = "block";
        vLine.style.left = guideX + "px";
      } else vLine.style.display = "none";
      if (guideY != null) {
        hLine.style.display = "block";
        hLine.style.top = guideY + "px";
      } else hLine.style.display = "none";
    }

    function hideGuides() {
      showGuides(null, null);
    }

    function showDragGuides(snapped, boxX, boxY, boxW, boxH, anchor) {
      var gx;
      var gy;
      if (anchor === "br") {
        gx = snapped.guideX != null ? snapped.guideX : (boxX + boxW);
        gy = snapped.guideY != null ? snapped.guideY : (boxY + boxH);
      } else {
        gx = snapped.guideX != null ? snapped.guideX : (boxX + boxW / 2);
        gy = snapped.guideY != null ? snapped.guideY : (boxY + boxH / 2);
      }
      showGuides(gx, gy);
    }

    function saveLayout() {
      if (typeof opts.onLayoutChange === "function") opts.onLayoutChange(getLayout());
    }
    var saveLayoutTimer = null;
    function saveLayoutSoon() {
      if (saveLayoutTimer) clearTimeout(saveLayoutTimer);
      saveLayoutTimer = setTimeout(function () {
        saveLayoutTimer = null;
        saveLayout();
      }, 100);
    }

    function imgSelId(id) { return "__img:" + id; }
    function isImgSel(s) { return s && s.indexOf("__img:") === 0; }

    function updateSelectionHighlight() {
      Object.keys(elNodes).forEach(function (id) {
        elNodes[id].classList.toggle("sel", id === sel);
      });
      Object.keys(textNodes).forEach(function (id) {
        textNodes[id].classList.toggle("sel", id === sel);
      });
      Object.keys(imgNodes).forEach(function (id) {
        imgNodes[id].wrap.classList.toggle("sel", sel === imgSelId(id));
      });
    }

    function textMaxWidth(st) {
      if (!isZoneSplitActive()) return Math.max(32, cardEl.clientWidth - st.x - FLOW_PAD);
      var zones = getCardZones();
      var x = st.x;
      var pad = FLOW_PAD;
      if (textElementSide(st) === "right") return Math.max(16, zones.cardW - x - pad);
      return Math.max(16, zones.leftEnd - x - pad);
    }

    function singleLineHeight(st) {
      return Math.ceil(st.size * 1.3) + 2;
    }

    function clearTextWrapStyle(node) {
      node.style.whiteSpace = "pre";
      node.style.wordBreak = "";
      node.style.overflowWrap = "";
      node.style.maxWidth = "";
      node.style.width = "";
      node.removeAttribute("data-text-wrapped");
      node.removeAttribute("data-zone-side");
    }

    /** 住所：折り返し時は「丁目」の直後で改行（既に改行あり／丁目なしはそのまま） */
    function preferAddressBreakAfterChome(txt) {
      var s = String(txt == null ? "" : txt).replace(/\r\n/g, "\n");
      if (!s || s.indexOf("\n") >= 0) return s;
      var at = s.indexOf("丁目");
      if (at < 0) return s;
      at += 2;
      if (at >= s.length) return s;
      return s.slice(0, at) + "\n" + s.slice(at).replace(/^\s+/, "");
    }

    function applyTextWrapIfOverflow(node, st, txt, elId) {
      clearTextWrapStyle(node);
      if (!useAutoWrap() || !txt || NO_WRAP_IDS[elId] || !WRAP_ELIGIBLE_IDS[elId]) return false;
      if (SHRINK_TO_ZONE_IDS[elId]) return false;
      var side = textElementSide(st);
      var mw = textMaxWidth(st);
      var lineH = singleLineHeight(st);

      // 1行で収まるか（nowrap で幅超過を判定）
      node.textContent = txt;
      node.style.whiteSpace = "nowrap";
      node.style.maxWidth = mw + "px";
      node.style.width = mw + "px";
      var needsWrap = node.scrollWidth > mw + 0.5 || node.scrollHeight > lineH + 1;
      if (!needsWrap) {
        clearTextWrapStyle(node);
        node.textContent = txt;
        return false;
      }

      // 住所は「丁目」の後で明示改行
      if (elId === "address") {
        var broken = preferAddressBreakAfterChome(txt);
        if (broken !== txt && broken.indexOf("\n") >= 0) {
          node.textContent = broken;
          node.style.whiteSpace = "pre-wrap";
          node.style.wordBreak = "keep-all";
          node.style.overflowWrap = "normal";
          node.style.maxWidth = mw + "px";
          node.style.width = mw + "px";
          if (textElementSide(st) !== side) {
            clearTextWrapStyle(node);
            node.textContent = txt;
            return false;
          }
          node.setAttribute("data-text-wrapped", "1");
          node.setAttribute("data-zone-side", side);
          return true;
        }
      }

      node.textContent = txt;
      node.style.whiteSpace = "pre-wrap";
      node.style.wordBreak = "break-word";
      node.style.overflowWrap = "anywhere";
      node.style.maxWidth = mw + "px";
      node.style.width = mw + "px";
      if (node.scrollHeight <= lineH + 1) {
        clearTextWrapStyle(node);
        return false;
      }
      if (textElementSide(st) !== side) {
        clearTextWrapStyle(node);
        return false;
      }
      node.setAttribute("data-text-wrapped", "1");
      node.setAttribute("data-zone-side", side);
      return true;
    }

    /** 氏名など：中央線（ゾーン幅）を超える場合は1行のままフォントを縮小 */
    function fitFontSizeToZoneWidth(node, st, maxW) {
      clearTextWrapStyle(node);
      node.style.whiteSpace = "nowrap";
      node.style.wordBreak = "normal";
      node.style.overflowWrap = "normal";
      node.style.maxWidth = maxW + "px";
      node.style.width = "";
      node.style.overflow = "visible";
      node.style.textOverflow = "";
      var base = st.size;
      var minPx = Math.max(8, Math.round(base * 0.45));
      node.style.fontSize = base + "px";
      if (node.scrollWidth <= maxW + 0.5) return base;
      var lo = minPx;
      var hi = base;
      var best = minPx;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        node.style.fontSize = mid + "px";
        if (node.scrollWidth <= maxW + 0.5) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      node.style.fontSize = best + "px";
      node.setAttribute("data-font-fitted", "1");
      return best;
    }

    function applyElStyle(node, st, txt, label, elId) {
      if (st.hidden) node.style.display = "none";
      else node.style.display = "";
      if (!txt) {
        node.classList.add("empty");
        node.textContent = "〔" + label + "〕";
        if (readOnly) node.style.display = "none";
        clearTextWrapStyle(node);
        node.removeAttribute("data-font-fitted");
      } else {
        node.classList.remove("empty");
        node.textContent = txt;
      }
      node.style.left = st.x + "px";
      node.style.top = st.y + "px";
      node.style.fontSize = st.size + "px";
      node.style.color = st.color;
      node.style.fontFamily = MeishiLayout.resolveBackFontFamily(st.font || "");
      node.style.fontWeight = st.bold ? "700" : "400";
      node.style.textAlign = st.align;
      if (MeishiLayout.applyTextBgStyle) MeishiLayout.applyTextBgStyle(node, st);
      node.style.overflow = "";
      node.style.textOverflow = "";
      node.removeAttribute("data-font-fitted");
      if (useZoneTextLayout() && txt && SHRINK_TO_ZONE_IDS[elId]) {
        fitFontSizeToZoneWidth(node, st, textMaxWidth(st));
        enforceZoneBounds(node, st);
        return;
      }
      if (useZoneTextLayout() && txt) {
        var mw = textMaxWidth(st);
        node.style.maxWidth = mw + "px";
        if (NO_WRAP_IDS[elId]) {
          node.style.whiteSpace = "nowrap";
          node.style.overflow = "hidden";
          node.style.textOverflow = "ellipsis";
          node.style.width = "";
          node.removeAttribute("data-text-wrapped");
        } else if (useAutoWrap()) {
          applyTextWrapIfOverflow(node, st, txt, elId);
        } else {
          clearTextWrapStyle(node);
          node.style.maxWidth = mw + "px";
        }
        enforceZoneBounds(node, st);
      } else if (NO_WRAP_IDS[elId] && useAutoWrap()) {
        node.style.whiteSpace = "nowrap";
        node.style.maxWidth = "";
        node.style.width = "";
      } else if (useAutoWrap() && txt) {
        applyTextWrapIfOverflow(node, st, txt, elId);
      } else {
        clearTextWrapStyle(node);
      }
    }

    function hasLineBreak(txt) {
      return !!(txt && /[\r\n]/.test(txt));
    }

    /** デザイン上「表示」の項目か（非表示なら縦ずらしの対象外） */
    function isElShownInLayout(layout, elId) {
      var elSt = layout && layout.el && layout.el[elId];
      return !!(elSt && !elSt.hidden);
    }

    /**
     * プレビュー用縦ずらし
     * 資格が「表示」かつ空 → 所属・役職↓／携帯が「表示」かつ空 → メール・工事件名↑
     * 対象項目が非表示ならずらさない
     */
    function flowBaseY(id, st, layout) {
      if (!textFlow || !readOnly) return st.y;
      var y = st.y;
      if ((id === "aff" || id === "title")
          && isElShownInLayout(layout, id)
          && isElShownInLayout(layout, "qual")
          && !String(getElText("qual") || "").trim()) {
        if (!hasLineBreak(getElText(id))) {
          y += singleLineHeight(layout.el.qual);
        }
      }
      if ((id === "email" || id === "koji")
          && isElShownInLayout(layout, id)
          && isElShownInLayout(layout, "mobile")
          && !String(getElText("mobile") || "").trim()) {
        if (!hasLineBreak(getElText(id))) {
          y -= singleLineHeight(layout.el.mobile);
        }
      }
      return y;
    }

    function collectFlowItems(layout, zoneSide) {
      var items = [];
      FLOW_STACK_ORDER.forEach(function (id) {
        var node = elNodes[id];
        var st = layout.el[id];
        if (!node || !st || st.hidden || node.style.display === "none") return;
        if (textElementSide(st) !== zoneSide) return;
        var txt = getElText(id);
        if (!txt) return;
        items.push({ node: node, st: st, baseY: flowBaseY(id, st, layout), id: id });
      });
      items.sort(function (a, b) { return a.baseY - b.baseY; });
      return items;
    }

    function elementExtraHeight(item) {
      var lineH = singleLineHeight(item.st);
      var h = item.node.offsetHeight || lineH;
      var extra = Math.max(0, h - lineH);
      if (extra > 0) return extra;
      // 住所が改行を含む2段なら、続く TEL/FAX/URL を1行分下げる
      if (item.id === "address" && hasLineBreak(getElText("address"))) {
        return lineH;
      }
      return 0;
    }

    function reflowTextElements(layout) {
      if (!textFlow || hideElements) return;
      ["left", "right"].forEach(function (zoneSide) {
        var items = collectFlowItems(layout, zoneSide);
        if (!items.length) return;
        var wrapPush = 0;
        items.forEach(function (item) {
          item.node.style.top = (item.baseY + wrapPush) + "px";
          wrapPush += elementExtraHeight(item);
        });
      });
    }

    function ensureBuilt() {
      if (built) return;
      cardEl.innerHTML = "";
      elNodes = {};
      textNodes = {};
      zoneLayer = null;
      editingId = null;
      if (readOnly) cardEl.classList.add("print-readonly");
      else cardEl.classList.remove("print-readonly");
      if (textFlow) cardEl.classList.add("text-flow");
      else cardEl.classList.remove("text-flow");
      syncZoneMode();
      if (!hideElements) {
        MeishiLayout.ELS.forEach(function (e) {
          var st = getLayout().el[e.id];
          if (!st) return;
          var d = document.createElement("div");
          d.className = "el";
          d.dataset.id = e.id;
          if (!readOnly) attachDrag(d, st, false);
          else d.style.cursor = "default";
          cardEl.appendChild(d);
          elNodes[e.id] = d;
        });
      }
      if (!readOnly) ensureGuideLayer();
      registerTextClipShortcuts();
      built = true;
    }

    function hasImageRef(im) {
      return !!(im && (im.src || im.path || im.libId || im.file));
    }

    function syncImageNodes() {
      var layout = MeishiCatalog.normalizeLayout(getLayout());
      if (!layout.images) layout.images = [];
      var pairs = [];
      if (readOnly) {
        getImages().forEach(function (im) {
          if (!hasImageRef(im)) return;
          var display = im;
          if (window.MeishiImageLib) {
            var rs = MeishiImageLib.resolveImages([im]);
            if (rs[0]) display = rs[0];
          }
          pairs.push({ raw: im, display: display });
        });
      } else {
        layout.images.forEach(function (raw) {
          if (!hasImageRef(raw)) return;
          var display = raw;
          if (window.MeishiImageLib) {
            var rs = MeishiImageLib.resolveImages([raw]);
            if (rs[0]) display = rs[0];
          }
          pairs.push({ raw: raw, display: display });
        });
      }
      var ids = {};
      pairs.forEach(function (pair) {
        var raw = pair.raw;
        var display = pair.display;
        if (!raw.id) raw.id = "img" + (layout.images.length + 1);
        ids[raw.id] = raw;
        var node = imgNodes[raw.id];
        if (!node) {
          var wrap = document.createElement("div");
          wrap.className = "imgel";
          wrap.dataset.id = imgSelId(raw.id);
          var img = document.createElement("img");
          img.draggable = false;
          wrap.appendChild(img);
          var rs = document.createElement("div");
          rs.className = "rs";
          wrap.appendChild(rs);
          if (!readOnly) {
            attachDrag(wrap, raw, true);
            attachResize(rs, raw, wrap);
          } else {
            wrap.style.cursor = "default";
            if (rs) rs.style.display = "none";
          }
          cardEl.appendChild(wrap);
          imgNodes[raw.id] = { wrap: wrap, img: img, rs: rs, st: raw };
        } else {
          node.st = raw;
        }
        var n = imgNodes[raw.id];
        var nextSrc = display.src || "";
        if (n._src !== nextSrc) {
          n._src = nextSrc;
          n.img.src = nextSrc;
          raw.aspectFit = 0;
        }
        ensureImageAspectFit(raw, n.img);
        var sized = clampSizeInCard(raw.x || 0, raw.y || 0, raw.w || 16, raw.h || 12);
        raw.w = sized.w;
        raw.h = sized.h;
        var pos = clampPosInCard(raw.x || 0, raw.y || 0, raw.w, raw.h);
        raw.x = pos.x;
        raw.y = pos.y;
        n.wrap.style.left = raw.x + "px";
        n.wrap.style.top = raw.y + "px";
        n.wrap.style.width = raw.w + "px";
        n.wrap.style.height = raw.h + "px";
      });
      Object.keys(imgNodes).forEach(function (id) {
        if (!ids[id]) {
          imgNodes[id].wrap.remove();
          delete imgNodes[id];
        }
      });
    }

    function cardInnerWidth() {
      var w = cardEl.clientWidth;
      if (w > 0) return w;
      return Math.round(91 * 96 / 25.4);
    }

    function cardInnerHeight() {
      var h = cardEl.clientHeight;
      if (h > 0) return h;
      return Math.round(55 * 96 / 25.4);
    }

    /** 名刺枠内に収まるよう x/y を制限（右端・下端まで可、枠外不可） */
    function clampPosInCard(x, y, boxW, boxH) {
      var cw = cardInnerWidth();
      var ch = cardInnerHeight();
      var w = Math.max(1, Math.round(boxW || 1));
      var h = Math.max(1, Math.round(boxH || 1));
      return {
        x: Math.max(0, Math.min(Math.round(x), Math.max(0, cw - w))),
        y: Math.max(0, Math.min(Math.round(y), Math.max(0, ch - h))),
      };
    }

    function clampSizeInCard(x, y, w, h) {
      var cw = cardInnerWidth();
      var ch = cardInnerHeight();
      var left = Math.max(0, Math.round(x) || 0);
      var top = Math.max(0, Math.round(y) || 0);
      return {
        w: Math.max(16, Math.min(Math.round(w), Math.max(16, cw - left))),
        h: Math.max(12, Math.min(Math.round(h), Math.max(12, ch - top))),
      };
    }

    /** 枠内余白をなくすため、画像の縦横比に合わせてボックス寸法を合わせる（初回のみ） */
    function fitImageBoxToNatural(raw, imgEl) {
      if (!raw || !imgEl || raw.aspectFit) return false;
      var nw = imgEl.naturalWidth;
      var nh = imgEl.naturalHeight;
      if (!nw || !nh) return false;
      var boxW = Math.max(16, raw.w || 80);
      var boxH = Math.max(12, raw.h || 44);
      var imgAspect = nw / nh;
      var boxAspect = boxW / boxH;
      if (Math.abs(boxAspect - imgAspect) >= 0.015) {
        if (imgAspect >= boxAspect) {
          raw.w = boxW;
          raw.h = Math.max(12, Math.round(boxW / imgAspect));
        } else {
          raw.h = boxH;
          raw.w = Math.max(16, Math.round(boxH * imgAspect));
        }
      }
      raw.aspectFit = 1;
      return true;
    }

    function ensureImageAspectFit(raw, imgEl, after) {
      if (!raw || !imgEl) return;
      function run() {
        if (fitImageBoxToNatural(raw, imgEl)) {
          var sized = clampSizeInCard(raw.x || 0, raw.y || 0, raw.w || 16, raw.h || 12);
          raw.w = sized.w;
          raw.h = sized.h;
          var pos = clampPosInCard(raw.x || 0, raw.y || 0, raw.w, raw.h);
          raw.x = pos.x;
          raw.y = pos.y;
          if (typeof after === "function") after();
          else if (imgNodes[raw.id]) {
            var n = imgNodes[raw.id];
            n.wrap.style.left = raw.x + "px";
            n.wrap.style.top = raw.y + "px";
            n.wrap.style.width = raw.w + "px";
            n.wrap.style.height = raw.h + "px";
          }
        } else if (typeof after === "function") {
          after();
        }
      }
      if (imgEl.complete && imgEl.naturalWidth) run();
      else {
        imgEl.addEventListener("load", function onLoad() {
          imgEl.removeEventListener("load", onLoad);
          run();
        });
      }
    }

    function applyFreeTextStyle(node, st, skipContent) {
      if (!skipContent && st.id !== editingId && document.activeElement !== node) {
        node.textContent = st.content || "";
      }
      node.setAttribute("data-content", String(st.content || ""));
      node.style.fontSize = st.size + "px";
      node.style.color = st.color || "#222222";
      node.style.fontFamily = MeishiLayout.resolveBackFontFamily(st.font || "");
      node.style.fontWeight = st.bold ? "700" : "400";
      node.style.fontStyle = st.italic ? "italic" : "normal";
      node.style.textDecoration = st.underline ? "underline" : "none";
      node.style.textAlign = st.align || "left";
      if (MeishiLayout.applyTextBgStyle) MeishiLayout.applyTextBgStyle(node, st);
      node.style.whiteSpace = "pre-wrap";
      node.style.wordBreak = "break-word";
      var maxW = Math.max(40, cardInnerWidth() - Math.max(0, st.x || 0));
      node.style.maxWidth = maxW + "px";
      // サイズ確定後に枠内へ
      var pos = clampPosInCard(st.x || 0, st.y || 0, node.offsetWidth || 40, node.offsetHeight || st.size || 12);
      st.x = pos.x;
      st.y = pos.y;
      node.style.left = st.x + "px";
      node.style.top = st.y + "px";
      node.style.zIndex = "5";
    }

    function syncFreeTextContentFromNode(node, st) {
      st.content = (node.innerText || "").replace(/\r\n/g, "\n");
      if (node) node.setAttribute("data-content", String(st.content || ""));
    }

    function exitInlineEdit(node, st) {
      if (!node || !st || editingId !== st.id) return;
      syncFreeTextContentFromNode(node, st);
      node.contentEditable = "false";
      node.classList.remove("is-editing");
      editingId = null;
      saveLayout();
    }

    function commitAllTextEdits() {
      if (!editingId) return;
      var node = textNodes[editingId];
      var layout = getLayout();
      var st = ((layout && layout.texts) || []).find(function (t) { return t && t.id === editingId; });
      if (node && st) exitInlineEdit(node, st);
      else editingId = null;
    }

    function enterInlineEdit(node, st, selectAll) {
      if (readOnly || !node || !st) return;
      editingId = st.id;
      sel = st.id;
      updateSelectionHighlight();
      onSelect(st.id, getLayout());
      node.contentEditable = "true";
      node.classList.add("is-editing");
      if (node.textContent !== (st.content || "")) node.textContent = st.content || "";
      node.focus();
      if (selectAll) {
        try {
          var range = document.createRange();
          range.selectNodeContents(node);
          var selObj = window.getSelection();
          if (selObj) { selObj.removeAllRanges(); selObj.addRange(range); }
        } catch (e) {}
      }
      if (panelShowDesign) panelShowDesign();
    }

    function attachInlineEdit(node, st) {
      node.addEventListener("blur", function () {
        if (editingId === st.id) exitInlineEdit(node, st);
      });
      node.addEventListener("input", function () {
        if (editingId !== st.id) return;
        syncFreeTextContentFromNode(node, st);
        saveLayoutSoon();
      });
      node.addEventListener("keydown", function (ev) {
        if (editingId !== st.id) return;
        if (ev.key === "Escape") {
          ev.preventDefault();
          node.blur();
        }
        ev.stopPropagation();
      });
      node.addEventListener("dblclick", function (ev) {
        if (readOnly) return;
        ev.preventDefault();
        ev.stopPropagation();
        enterInlineEdit(node, st, false);
      });
      node.addEventListener("contextmenu", function (ev) {
        if (readOnly) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (editingId !== st.id) {
          sel = st.id;
          updateSelectionHighlight();
          onSelect(st.id, getLayout());
          if (panelShowDesign) panelShowDesign();
        }
        showTextContextMenu(ev.clientX, ev.clientY, st, node);
      });
    }

    var textCtxMenu = null;
    function hideTextContextMenu() {
      if (textCtxMenu) {
        try { textCtxMenu.remove(); } catch (e) {}
        textCtxMenu = null;
      }
      document.removeEventListener("pointerdown", onTextCtxOutside, true);
    }
    function onTextCtxOutside(ev) {
      if (textCtxMenu && !textCtxMenu.contains(ev.target)) hideTextContextMenu();
    }
    function getMeishiTextClip() {
      return window.MeishiTextClip ? window.MeishiTextClip.get() : (window.__MEISHI_TEXT_CLIP__ || null);
    }
    function setMeishiTextClip(payload) {
      if (window.MeishiTextClip) window.MeishiTextClip.set(payload);
      else window.__MEISHI_TEXT_CLIP__ = payload || null;
    }
    function selectionTextInNode(node) {
      try {
        var s = window.getSelection();
        if (!s || s.rangeCount === 0 || s.isCollapsed) return "";
        if (!node.contains(s.anchorNode) && !node.contains(s.focusNode)) return "";
        return String(s.toString() || "");
      } catch (e) {
        return "";
      }
    }
    function writeSystemClipboard(text) {
      var t = String(text == null ? "" : text);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).catch(function () {});
        return;
      }
      try {
        var ta = document.createElement("textarea");
        ta.value = t;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch (e) {}
    }
    function copyFreeText(st, node) {
      if (!st) return;
      var selected = (editingId === st.id) ? selectionTextInNode(node) : "";
      var plain = selected || String(st.content || "");
      var block = MeishiLayout.clone(st);
      delete block.id;
      setMeishiTextClip({ block: block, plain: plain });
      writeSystemClipboard(plain);
    }
    function insertPlainAtCaret(node, st, plain) {
      if (!node || plain == null) return;
      node.focus();
      var ok = false;
      try {
        ok = document.execCommand("insertText", false, plain);
      } catch (e) { ok = false; }
      if (!ok) {
        var cur = String(st.content || "");
        st.content = cur + plain;
        node.textContent = st.content;
      }
      syncFreeTextContentFromNode(node, st);
      saveLayoutSoon();
    }
    function pasteFreeText(st, node) {
      var clip = getMeishiTextClip();
      function finishWithPlain(plain) {
        plain = String(plain == null ? "" : plain);
        if (st && editingId === st.id && node) {
          insertPlainAtCaret(node, st, plain);
          return true;
        }
        var layout = MeishiCatalog.normalizeLayout(getLayout());
        layout.texts = layout.texts || [];
        var block;
        if (clip && clip.block) {
          block = MeishiLayout.clone(clip.block);
          if (plain !== "") block.content = plain;
        } else {
          block = MeishiLayout.defTextBlock(layout.texts.length);
          block.content = plain || "テキスト";
        }
        block.id = "txt" + Date.now();
        if (st) {
          block.x = Math.max(0, (st.x || 0) + 12);
          block.y = Math.max(0, (st.y || 0) + 12);
        } else {
          block.x = typeof block.x === "number" ? block.x : 20;
          block.y = typeof block.y === "number" ? block.y : 20;
        }
        layout.texts.push(block);
        saveLayout();
        renderCard();
        editTextById(block.id, true);
        return true;
      }
      if (clip && (clip.plain != null || clip.block)) {
        return finishWithPlain(clip.plain != null ? clip.plain : (clip.block && clip.block.content) || "");
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) { finishWithPlain(t); }).catch(function () {
          finishWithPlain("");
        });
        return true;
      }
      return finishWithPlain("");
    }

    function findSelectedFreeText() {
      var id = editingId || (textNodes[sel] ? sel : null);
      if (!id) return null;
      var layout = getLayout();
      var texts = (layout && layout.texts) || [];
      for (var i = 0; i < texts.length; i++) {
        if (texts[i] && texts[i].id === id) return { st: texts[i], node: textNodes[id] || null };
      }
      return null;
    }

    function isCardSurfaceActive() {
      if (readOnly || hideElements) return false;
      if (!cardEl || !cardEl.isConnected) return false;
      var r = cardEl.getBoundingClientRect();
      return r.width > 8 && r.height > 8;
    }

    function registerTextClipShortcuts() {
      if (!window.MeishiTextClip || readOnly || hideElements || cardEl._meishiClipReg) return;
      cardEl._meishiClipReg = true;
      window.MeishiTextClip.register({
        isActive: isCardSurfaceActive,
        contains: function (n) { return !!(cardEl && n && cardEl.contains(n)); },
        isEditing: function () { return !!editingId; },
        copy: function () {
          var hit = findSelectedFreeText();
          if (!hit || !hit.st) return false;
          copyFreeText(hit.st, hit.node);
          return true;
        },
        paste: function () {
          var clip = getMeishiTextClip();
          if (!clip || (clip.plain == null && !clip.block)) return false;
          var hit = findSelectedFreeText();
          pasteFreeText(hit ? hit.st : null, hit ? hit.node : null);
          return true;
        },
        pasteEdit: function () {
          var hit = findSelectedFreeText();
          if (!hit || !hit.st || !hit.node || editingId !== hit.st.id) return false;
          var clip = getMeishiTextClip();
          if (!clip) return false;
          var plain = clip.plain != null ? clip.plain : ((clip.block && clip.block.content) || "");
          insertPlainAtCaret(hit.node, hit.st, plain);
          return true;
        },
      });
    }

    function showTextContextMenu(clientX, clientY, st, node) {
      hideTextContextMenu();
      textCtxMenu = document.createElement("div");
      textCtxMenu.className = "meishi-text-ctx";
      textCtxMenu.setAttribute("role", "menu");
      function addItem(label, fn) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          hideTextContextMenu();
          fn();
        });
        textCtxMenu.appendChild(btn);
      }
      addItem("コピー", function () { copyFreeText(st, node); });
      addItem("ペースト", function () { pasteFreeText(st, node); });
      addItem("削除", function () {
        if (editingId === st.id) exitInlineEdit(node, st);
        removeTextBlock(st.id);
      });
      document.body.appendChild(textCtxMenu);
      var pad = 4;
      var mw = textCtxMenu.offsetWidth || 110;
      var mh = textCtxMenu.offsetHeight || 100;
      var left = Math.min(clientX, window.innerWidth - mw - pad);
      var top = Math.min(clientY, window.innerHeight - mh - pad);
      textCtxMenu.style.left = Math.max(pad, left) + "px";
      textCtxMenu.style.top = Math.max(pad, top) + "px";
      setTimeout(function () {
        document.addEventListener("pointerdown", onTextCtxOutside, true);
      }, 0);
    }

    function syncFreeTextNodes() {
      if (hideElements) return;
      var layout = MeishiCatalog.normalizeLayout(getLayout());
      var texts = layout.texts || [];
      var ids = {};
      texts.forEach(function (st) {
        if (!st || !st.id) return;
        ids[st.id] = st;
        var node = textNodes[st.id];
        if (!node) {
          node = document.createElement("div");
          node.className = "btel";
          node.dataset.id = st.id;
          if (!readOnly) {
            attachDrag(node, st, false);
            attachInlineEdit(node, st);
          } else {
            node.style.cursor = "default";
          }
          cardEl.appendChild(node);
          textNodes[st.id] = node;
        }
        applyFreeTextStyle(node, st, editingId === st.id);
      });
      Object.keys(textNodes).forEach(function (id) {
        if (!ids[id]) {
          textNodes[id].remove();
          delete textNodes[id];
          if (editingId === id) editingId = null;
        }
      });
    }

    function renderCard() {
      ensureBuilt();
      syncZoneMode();
      var layout = getLayout();
      if (!hideElements) {
        if (textFlow) {
          ["left", "right"].forEach(function (zoneSide) {
            FLOW_STACK_ORDER.forEach(function (id) {
              var st = layout.el[id];
              if (!st || textElementSide(st) !== zoneSide) return;
              var node = elNodes[id];
              if (!node) return;
              var meta = MeishiLayout.ELS.find(function (e) { return e.id === id; }) || { label: id };
              applyElStyle(node, st, getElText(id), meta.label, id);
            });
          });
        } else {
          MeishiLayout.ELS.forEach(function (e) {
            var node = elNodes[e.id];
            var st = layout.el[e.id];
            if (!node || !st) return;
            applyElStyle(node, st, getElText(e.id), e.label, e.id);
          });
        }
        reflowTextElements(layout);
        syncFreeTextNodes();
      }
      syncImageNodes();
      updateZoneLayerVisual();
      updateSelectionHighlight();
    }

    function attachDrag(node, st, isImage) {
      node.addEventListener("pointerdown", function (ev) {
        if (readOnly) return;
        if (ev.button !== 0) return;
        if (ev.target.classList.contains("rs")) return;
        if (!isImage && (editingId === st.id || node.classList.contains("is-editing"))) return;
        var id = node.dataset.id;
        var wasSelected = sel === id;
        var isFreeText = !isImage && !!textNodes[id];
        if (sel !== id) {
          sel = id;
          updateSelectionHighlight();
          onSelect(id, getLayout());
          if (panelShowDesign) panelShowDesign();
        }
        var pid = ev.pointerId;
        var p = pxFromEvent(ev);
        var sx = p.clientX, sy = p.clientY, ox = st.x, oy = st.y;
        var isTextDrag = !isImage && !isFreeText && useZoneTextLayout() && node.classList.contains("el");
        var isImageDrag = !!isImage || node.classList.contains("imgel");
        var raf = 0, nx = ox, ny = oy;
        var dragging = false;
        var ended = false;
        function detachPointer() {
          document.removeEventListener("pointermove", mv, true);
          document.removeEventListener("pointerup", up, true);
          document.removeEventListener("pointercancel", up, true);
        }
        function applyPos() {
          raf = 0;
          st.x = nx; st.y = ny;
          node.style.left = nx + "px";
          node.style.top = ny + "px";
          if (isTextDrag) node.style.maxWidth = textMaxWidth(st) + "px";
          if (isFreeText) node.style.maxWidth = Math.max(40, cardInnerWidth() - st.x) + "px";
        }
        function mv(e2) {
          if (ended || e2.pointerId !== pid) return;
          var q = pxFromEvent(e2);
          var dx = q.clientX - sx;
          var dy = q.clientY - sy;
          if (!dragging) {
            if (isFreeText && Math.abs(dx) < DRAG_START && Math.abs(dy) < DRAG_START) return;
            dragging = true;
            try { node.setPointerCapture(pid); } catch (e) {}
            cardEl.classList.add("is-dragging");
          }
          var rawNx = Math.round(ox + dx);
          var rawNy = Math.round(oy + dy);
          var pointerX = q.clientX - cardEl.getBoundingClientRect().left;
          nx = isTextDrag ? clampTextDragX(node, rawNx, pointerX) : rawNx;
          ny = rawNy;
          var boxW = node.offsetWidth || (isImage ? (st.w || 1) : 1);
          var boxH = node.offsetHeight || (isImage ? (st.h || 1) : 1);
          if (isImage) {
            boxW = st.w || boxW;
            boxH = st.h || boxH;
          }
          var clamped = clampPosInCard(nx, ny, boxW, boxH);
          nx = clamped.x;
          ny = clamped.y;
          var guides = snapDragPosition(cardEl, node, nx, ny, zoneSnapEdges(), snapExtraCardEls);
          if (isImageDrag || isFreeText) showDragGuides(guides, nx, ny, node.offsetWidth, node.offsetHeight, "center");
          else showGuides(guides.guideX, guides.guideY);
          if (!raf) raf = requestAnimationFrame(applyPos);
        }
        function up(e2) {
          if (ended) return;
          if (e2.pointerId !== pid) return;
          ended = true;
          detachPointer();
          if (raf) cancelAnimationFrame(raf);
          if (dragging) {
            applyPos();
            hideGuides();
            if (useZoneTextLayout() && id && !isImgSel(id) && !isFreeText) {
              var st2 = getLayout().el[id];
              var lbl2 = (MeishiLayout.ELS.find(function (e) { return e.id === id; }) || {}).label || id;
              if (st2) applyElStyle(node, st2, getElText(id), lbl2, id);
            }
            saveLayout();
          } else if (isFreeText && wasSelected) {
            enterInlineEdit(node, st, false);
          }
          cardEl.classList.remove("is-dragging");
          try {
            if (node.hasPointerCapture && node.hasPointerCapture(pid)) node.releasePointerCapture(pid);
          } catch (e) {}
        }
        if (isImage) ev.preventDefault();
        else if (!isFreeText) ev.preventDefault();
        document.addEventListener("pointermove", mv, true);
        document.addEventListener("pointerup", up, true);
        document.addEventListener("pointercancel", up, true);
      });
    }

    function attachResize(handle, im, wrap) {
      handle.addEventListener("pointerdown", function (ev) {
        if (readOnly) return;
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        var pid = ev.pointerId;
        try { handle.setPointerCapture(pid); } catch (e) {}
        cardEl.classList.add("is-dragging");
        var p = pxFromEvent(ev);
        var sx = p.clientX, sy = p.clientY, ow = im.w, oh = im.h;
        var raf = 0, nw = ow, nh = oh;
        var ended = false;
        function detachPointer() {
          document.removeEventListener("pointermove", mv, true);
          document.removeEventListener("pointerup", up, true);
          document.removeEventListener("pointercancel", up, true);
        }
        function applySize() {
          raf = 0;
          im.w = nw; im.h = nh;
          wrap.style.width = nw + "px";
          wrap.style.height = nh + "px";
        }
        function mv(e2) {
          if (ended || e2.pointerId !== pid) return;
          var q = pxFromEvent(e2);
          var rawW = Math.max(16, Math.round(ow + (q.clientX - sx)));
          var rawH = Math.max(12, Math.round(oh + (q.clientY - sy)));
          var sized = clampSizeInCard(im.x, im.y, rawW, rawH);
          nw = sized.w;
          nh = sized.h;
          im.aspectFit = 1;
          var guides = snapResizeBox(cardEl, wrap, im.x, im.y, nw, nh, zoneSnapEdges(), snapExtraCardEls);
          showDragGuides(guides, im.x, im.y, nw, nh, "br");
          if (!raf) raf = requestAnimationFrame(applySize);
        }
        function up(e2) {
          if (ended) return;
          if (e2.pointerId !== pid) return;
          ended = true;
          detachPointer();
          if (raf) cancelAnimationFrame(raf);
          applySize();
          hideGuides();
          cardEl.classList.remove("is-dragging");
          try {
            if (handle.hasPointerCapture && handle.hasPointerCapture(pid)) handle.releasePointerCapture(pid);
          } catch (e) {}
          saveLayout();
        }
        document.addEventListener("pointermove", mv, true);
        document.addEventListener("pointerup", up, true);
        document.addEventListener("pointercancel", up, true);
      });
    }

    function selectEl(id) {
      if (sel === id) return;
      sel = id;
      updateSelectionHighlight();
      onSelect(id, getLayout());
    }

    function invalidate() {
      built = false;
      editingId = null;
      elNodes = {};
      imgNodes = {};
      textNodes = {};
      guideLayer = null;
      zoneLayer = null;
      cardEl.innerHTML = "";
    }

    function isFixedEl(id) {
      return !!(id && getLayout().el && getLayout().el[id] && MeishiLayout.ELS.some(function (e) { return e.id === id; }));
    }

    function getSelectedStyleTarget() {
      if (!sel || isImgSel(sel)) return null;
      if (textNodes[sel]) {
        var layout = getLayout();
        var st = (layout.texts || []).find(function (t) { return t.id === sel; });
        if (!st) return null;
        return { kind: "text", st: st, node: textNodes[sel] };
      }
      if (isFixedEl(sel)) {
        var stEl = getLayout().el[sel];
        var nodeEl = elNodes[sel];
        if (!stEl || !nodeEl) return null;
        return { kind: "el", st: stEl, node: nodeEl, id: sel };
      }
      return null;
    }

    function clampSize(n) {
      return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)));
    }

    function applySelectedStyle(patch) {
      if (readOnly) return;
      var hit = getSelectedStyleTarget();
      if (!hit) return;
      if (patch.size != null) patch.size = clampSize(patch.size);
      if (Object.prototype.hasOwnProperty.call(patch, "bg") && MeishiLayout.normalizeBg) {
        patch.bg = MeishiLayout.normalizeBg(patch.bg);
      }
      Object.assign(hit.st, patch);
      if (hit.kind === "text") {
        applyFreeTextStyle(hit.node, hit.st, editingId === sel);
      } else {
        var lbl = (MeishiLayout.ELS.find(function (e) { return e.id === hit.id; }) || {}).label || hit.id;
        applyElStyle(hit.node, hit.st, getElText(hit.id), lbl, hit.id);
      }
      saveLayout();
      if (panelShowDesign) panelShowDesign();
    }

    function bumpSelectedSize(delta) {
      var hit = getSelectedStyleTarget();
      if (!hit) return;
      applySelectedStyle({ size: clampSize((hit.st.size || 12) + delta) });
    }

    function bindDesignPanel(panel) {
      if (!panel) return;
      var desSizeUp = panel.querySelector("#desSizeUp");
      var desSizeDown = panel.querySelector("#desSizeDown");
      var desSizeV = panel.querySelector("#desSizeV");
      var desColor = panel.querySelector("#desColor");
      var desBg = panel.querySelector("#desBg");
      var desBgNone = panel.querySelector("#desBgNone");
      var desNorm = panel.querySelector("#desNorm");
      var desBold = panel.querySelector("#desBold");
      var desTarget = panel.querySelector("#desTarget");
      var designCtl = panel.querySelector("#designCtl");
      var designNone = panel.querySelector("#designNone");
      var desShow = panel.querySelector("#desShow");
      var desHide = panel.querySelector("#desHide");
      var desShowRow = desShow ? desShow.closest(".des-row") : null;
      var desFont = panel.querySelector("#desFont");

      function showDesign() {
        if (!designCtl || !designNone) return;
        if (!sel || isImgSel(sel)) {
          designCtl.style.display = "none";
          designNone.style.display = "";
          if (isImgSel(sel)) designNone.textContent = "画像が選択されています。右下の青い丸でサイズ変更、ドラッグで移動できます。";
          else designNone.textContent = "項目またはテキストをクリックすると、ここで文字サイズ・書体・色などを変更できます。";
          return;
        }
        var hit = getSelectedStyleTarget();
        if (!hit) {
          designCtl.style.display = "none";
          designNone.style.display = "";
          return;
        }
        designNone.style.display = "none";
        designCtl.style.display = "";
        var st = hit.st;
        if (desTarget) {
          if (hit.kind === "text") desTarget.textContent = "対象: 自由テキスト";
          else {
            var lbl = (MeishiLayout.ELS.find(function (e) { return e.id === hit.id; }) || {}).label || hit.id;
            desTarget.textContent = "対象: " + lbl;
          }
        }
        if (desSizeV) desSizeV.textContent = st.size + "px";
        if (desSizeUp) desSizeUp.disabled = st.size >= SIZE_MAX;
        if (desSizeDown) desSizeDown.disabled = st.size <= SIZE_MIN;
        if (desColor) desColor.value = st.color && st.color.length === 7 ? st.color : "#222222";
        var bg = MeishiLayout.normalizeBg ? MeishiLayout.normalizeBg(st.bg) : (st.bg || "");
        if (desBg) desBg.value = bg || "#ffffff";
        if (desBgNone) desBgNone.classList.toggle("on", !bg);
        if (desNorm) desNorm.classList.toggle("on", !st.bold);
        if (desBold) desBold.classList.toggle("on", !!st.bold);
        if (MeishiLayout.fillFontSelect) MeishiLayout.fillFontSelect(desFont, st.font || "");
        panel.querySelectorAll("[data-al]").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-al") === st.align);
        });
        if (desShowRow) desShowRow.style.display = hit.kind === "el" ? "" : "none";
      }

      panelShowDesign = showDesign;

      if (desSizeUp) desSizeUp.addEventListener("click", function () {
        bumpSelectedSize(SIZE_STEP);
      });
      if (desSizeDown) desSizeDown.addEventListener("click", function () {
        bumpSelectedSize(-SIZE_STEP);
      });
      if (desColor) desColor.addEventListener("input", function () {
        applySelectedStyle({ color: this.value });
      });
      if (desBg) desBg.addEventListener("input", function () {
        applySelectedStyle({ bg: this.value });
      });
      if (desBgNone) desBgNone.addEventListener("click", function () {
        applySelectedStyle({ bg: "" });
      });
      if (desNorm) desNorm.addEventListener("click", function () {
        applySelectedStyle({ bold: 0 });
      });
      if (desBold) desBold.addEventListener("click", function () {
        applySelectedStyle({ bold: 1 });
      });
      if (desFont && !desFont._meishiBound) {
        desFont._meishiBound = true;
        if (MeishiLayout.fillFontSelect) MeishiLayout.fillFontSelect(desFont, "");
        desFont.addEventListener("change", function () {
          applySelectedStyle({ font: this.value || "" });
        });
      }
      panel.querySelectorAll("[data-al]").forEach(function (b) {
        b.addEventListener("click", function () {
          applySelectedStyle({ align: this.getAttribute("data-al") });
        });
      });
      if (desShow) desShow.addEventListener("click", function () {
        if (!getSelectedStyleTarget() || getSelectedStyleTarget().kind !== "el") return;
        applySelectedStyle({ hidden: false });
      });
      if (desHide) desHide.addEventListener("click", function () {
        if (!getSelectedStyleTarget() || getSelectedStyleTarget().kind !== "el") return;
        applySelectedStyle({ hidden: true });
      });
      var desTextDel = panel.querySelector("#desTextDelete");
      var desTextDelRow = desTextDel ? desTextDel.closest(".des-row") : null;
      if (desTextDel) {
        desTextDel.addEventListener("click", function () {
          var hit = getSelectedStyleTarget();
          if (!hit || hit.kind !== "text") return;
          removeTextBlock(hit.st.id);
        });
      }
      var _showDesignPrev = showDesign;
      showDesign = function () {
        _showDesignPrev();
        var hit = getSelectedStyleTarget();
        if (desTextDelRow) desTextDelRow.style.display = hit && hit.kind === "text" ? "" : "none";
      };
      panelShowDesign = showDesign;

      return {
        showDesign: showDesign,
        clearSelection: function () { sel = null; updateSelectionHighlight(); showDesign(); },
      };
    }

    function editTextById(id, selectAll) {
      var node = textNodes[id];
      var layout = getLayout();
      var st = (layout.texts || []).find(function (t) { return t.id === id; });
      if (node && st) enterInlineEdit(node, st, selectAll !== false);
    }

    function addTextBlock() {
      var layout = MeishiCatalog.normalizeLayout(getLayout());
      layout.texts = layout.texts || [];
      var block = MeishiLayout.defTextBlock(layout.texts.length);
      layout.texts.push(block);
      saveLayout();
      renderCard();
      editTextById(block.id, true);
      return block;
    }

    function removeTextBlock(id) {
      var layout = getLayout();
      if (!layout || !Array.isArray(layout.texts) || !id) return false;
      var next = layout.texts.filter(function (t) { return t.id !== id; });
      if (next.length === layout.texts.length) return false;
      layout.texts = next;
      if (sel === id) sel = null;
      if (editingId === id) editingId = null;
      if (textNodes[id]) {
        try { textNodes[id].remove(); } catch (e) {}
        delete textNodes[id];
      }
      saveLayout();
      renderCard();
      if (panelShowDesign) panelShowDesign();
      return true;
    }

    function setCenterDivider(on) {
      var layout = getLayout();
      if (!layout) return false;
      layout.centerDivider = !!on;
      if (layout.centerDivider && (typeof layout.centerShiftMm !== "number" || isNaN(layout.centerShiftMm))) {
        layout.centerShiftMm = 5;
      }
      saveLayout();
      syncZoneMode();
      renderCard();
      return layout.centerDivider;
    }

    function getCenterDivider() {
      return isZoneSplitActive();
    }

    return {
      renderCard: renderCard,
      selectEl: selectEl,
      bindDesignPanel: bindDesignPanel,
      clearSelection: function () { sel = null; updateSelectionHighlight(); },
      invalidate: invalidate,
      getSelection: function () { return sel; },
      setSelection: function (v) { sel = v; updateSelectionHighlight(); },
      editTextById: editTextById,
      addTextBlock: addTextBlock,
      removeTextBlock: removeTextBlock,
      commitAllTextEdits: commitAllTextEdits,
      setCenterDivider: setCenterDivider,
      getCenterDivider: getCenterDivider,
    };
  }

  window.MeishiCardUI = {
    createCardUI: createCardUI,
    clampCenterShiftMm: clampCenterShiftMm,
    maxCenterShiftMm: maxCenterShiftMm,
    formatCenterShiftLabel: formatCenterShiftLabel,
  };
})();
