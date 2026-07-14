/**
 * 名刺プレビュー・デザイン編集 UI（使用者・所有者で共有）
 * ドラッグ中は DOM 再生成せず style のみ更新して軽量化。
 * 編集時は他要素・カード端／中心への水平垂直ガイドを表示（吸着・位置制限なし）。
 */
(function () {
  var SNAP_THRESH = 6;
  var FLOW_PAD = 6;
  var CARD_W_MM = 91;
  var CENTER_GAP_MM = 2;
  var DRAG_START = 5;
  var SIZE_MIN = 6;
  var SIZE_MAX = 60;
  var SIZE_STEP = 1;

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
    company: true, aff: true, title: true, name: true, qual: true, koji: true,
    address: true, mobile: true, email: true, url: true,
  };
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

    function setCenterShiftMm(mm) {
      var layout = getLayout();
      if (!layout) return;
      layout.centerShiftMm = clampCenterShiftMm(mm);
      updateZoneLayerVisual();
      applyZoneChangeToText();
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
          setCenterShiftMm(shiftFromDelta(pxFromEvent(e2).clientX));
        }
        function up(e2) {
          cardEl.classList.remove("is-dragging-center");
          try { handle.releasePointerCapture(e2.pointerId); } catch (e) {}
          handle.removeEventListener("pointermove", mv);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
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
      return isZoneSplitActive() && (textFlow || !readOnly);
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

    function applyTextWrapIfOverflow(node, st, txt, elId) {
      clearTextWrapStyle(node);
      if (!useAutoWrap() || !txt || NO_WRAP_IDS[elId] || !WRAP_ELIGIBLE_IDS[elId]) return false;
      var side = textElementSide(st);
      var mw = textMaxWidth(st);
      var lineH = singleLineHeight(st);
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

    function applyElStyle(node, st, txt, label, elId) {
      if (st.hidden) node.style.display = "none";
      else node.style.display = "";
      if (!txt) {
        node.classList.add("empty");
        node.textContent = "〔" + label + "〕";
        if (readOnly) node.style.display = "none";
        clearTextWrapStyle(node);
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
      node.style.overflow = "";
      node.style.textOverflow = "";
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

    /** プレビュー：資格が空なら所属・役職を一段下げる（改行ありは除く） */
    function flowBaseY(id, st, layout) {
      if (!textFlow || !readOnly) return st.y;
      if (id !== "aff" && id !== "title") return st.y;
      if (getElText("qual")) return st.y;
      if (hasLineBreak(getElText(id))) return st.y;
      var qualSt = layout.el.qual;
      if (qualSt) return st.y + singleLineHeight(qualSt);
      return st.y;
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

    function reflowTextElements(layout) {
      if (!textFlow || hideElements) return;
      ["left", "right"].forEach(function (zoneSide) {
        var items = collectFlowItems(layout, zoneSide);
        if (!items.length) return;
        var wrapPush = 0;
        items.forEach(function (item) {
          item.node.style.top = (item.baseY + wrapPush) + "px";
          if (item.node.getAttribute("data-text-wrapped") === "1") {
            var extra = Math.max(0, item.node.offsetHeight - singleLineHeight(item.st));
            wrapPush += extra;
          }
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
        n.img.src = display.src || "";
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

    function applyFreeTextStyle(node, st, skipContent) {
      if (!skipContent && st.id !== editingId && document.activeElement !== node) {
        node.textContent = st.content || "";
      }
      node.style.left = st.x + "px";
      node.style.top = st.y + "px";
      node.style.fontSize = st.size + "px";
      node.style.color = st.color;
      node.style.fontFamily = MeishiLayout.resolveBackFontFamily(st.font || "");
      node.style.fontWeight = st.bold ? "700" : "400";
      node.style.fontStyle = st.italic ? "italic" : "normal";
      node.style.textDecoration = st.underline ? "underline" : "none";
      node.style.textAlign = st.align || "left";
      node.style.whiteSpace = "pre-wrap";
      node.style.wordBreak = "break-word";
      node.style.maxWidth = Math.max(40, cardInnerWidth() - st.x - 8) + "px";
    }

    function syncFreeTextContentFromNode(node, st) {
      st.content = (node.innerText || "").replace(/\r\n/g, "\n");
    }

    function exitInlineEdit(node, st) {
      if (!node || !st || editingId !== st.id) return;
      syncFreeTextContentFromNode(node, st);
      node.contentEditable = "false";
      node.classList.remove("is-editing");
      editingId = null;
      saveLayout();
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
        saveLayout();
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
        if (editingId === st.id) exitInlineEdit(node, st);
        sel = st.id;
        updateSelectionHighlight();
        onSelect(st.id, getLayout());
        if (panelShowDesign) panelShowDesign();
        showTextDeleteMenu(ev.clientX, ev.clientY, st.id);
      });
    }

    var textCtxMenu = null;
    function hideTextDeleteMenu() {
      if (textCtxMenu) {
        try { textCtxMenu.remove(); } catch (e) {}
        textCtxMenu = null;
      }
      document.removeEventListener("pointerdown", onTextCtxOutside, true);
    }
    function onTextCtxOutside(ev) {
      if (textCtxMenu && !textCtxMenu.contains(ev.target)) hideTextDeleteMenu();
    }
    function showTextDeleteMenu(clientX, clientY, textId) {
      hideTextDeleteMenu();
      textCtxMenu = document.createElement("div");
      textCtxMenu.className = "meishi-text-ctx";
      textCtxMenu.setAttribute("role", "menu");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "削除";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideTextDeleteMenu();
        removeTextBlock(textId);
      });
      textCtxMenu.appendChild(btn);
      document.body.appendChild(textCtxMenu);
      var pad = 4;
      var mw = textCtxMenu.offsetWidth || 96;
      var mh = textCtxMenu.offsetHeight || 36;
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
          if (isFreeText) node.style.maxWidth = Math.max(40, cardInnerWidth() - st.x - 8) + "px";
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
          nw = rawW;
          nh = rawH;
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
      var desNorm = panel.querySelector("#desNorm");
      var desBold = panel.querySelector("#desBold");
      var desTarget = panel.querySelector("#desTarget");
      var designCtl = panel.querySelector("#designCtl");
      var designNone = panel.querySelector("#designNone");
      var desShow = panel.querySelector("#desShow");
      var desHide = panel.querySelector("#desHide");
      var desShowRow = desShow ? desShow.closest(".des-row") : null;

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
        if (desNorm) desNorm.classList.toggle("on", !st.bold);
        if (desBold) desBold.classList.toggle("on", !!st.bold);
        panel.querySelectorAll("[data-font]").forEach(function (b) {
          b.classList.toggle("on", (b.getAttribute("data-font") || "") === (st.font || ""));
        });
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
      if (desNorm) desNorm.addEventListener("click", function () {
        applySelectedStyle({ bold: 0 });
      });
      if (desBold) desBold.addEventListener("click", function () {
        applySelectedStyle({ bold: 1 });
      });
      panel.querySelectorAll("[data-font]").forEach(function (b) {
        b.addEventListener("click", function () {
          applySelectedStyle({ font: this.getAttribute("data-font") || "" });
        });
      });
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
