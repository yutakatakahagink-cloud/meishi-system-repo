/**
 * 名刺裏面デザイン UI（自由テキスト + 画像）
 */
(function () {
  var SNAP_THRESH = 6;
  var DRAG_START = 5;
  var SIZE_MIN = 6;
  var SIZE_MAX = 60;
  var SIZE_STEP = 1;
  var UL_LEN_MIN = 0;
  var UL_LEN_MAX = 80;
  var UL_THICK_MIN = 1;
  var UL_THICK_MAX = 8;
  var CARD_W_MM = 91;
  var CENTER_GAP_MM = 2;

  function pxFromEvent(e) { return e.touches ? e.touches[0] : e; }

  function bestSnap(dragEdges, targets, thresh) {
    var best = null;
    dragEdges.forEach(function (de) {
      targets.forEach(function (t) {
        var d = Math.abs(de - t);
        if (d <= thresh && (!best || d < best.d)) {
          best = { d: d, line: t };
        }
      });
    });
    return best;
  }

  function collectSnapTargets(cardEl, excludeNode, extraCardEls) {
    var cr = cardEl.getBoundingClientRect();
    var tx = [0, cr.width / 2, cr.width];
    var ty = [0, cr.height / 2, cr.height];
    function addNodesFrom(root) {
      if (!root) return;
      root.querySelectorAll(".btel, .imgel").forEach(function (n) {
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

  function guideForDrag(cardEl, node, nx, ny, extraCardEls) {
    var w = node.offsetWidth;
    var h = node.offsetHeight;
    var targets = collectSnapTargets(cardEl, node, extraCardEls);
    var sx = bestSnap([nx, nx + w / 2, nx + w], targets.tx, SNAP_THRESH);
    var sy = bestSnap([ny, ny + h / 2, ny + h], targets.ty, SNAP_THRESH);
    return { guideX: sx ? sx.line : null, guideY: sy ? sy.line : null };
  }

  function hasImageRef(im) {
    return !!(im && (im.src || im.path || im.libId || im.file));
  }

  function createBackCardUI(opts) {
    var cardEl = opts.cardEl;
    var getLayout = opts.getLayout;
    var readOnly = !!opts.readOnly;
    var hideTexts = !!opts.hideTexts;
    var hideImages = !!opts.hideImages;
    var snapExtraCardEls = [];
    if (opts.snapExtraCardEl) {
      snapExtraCardEls = Array.isArray(opts.snapExtraCardEl) ? opts.snapExtraCardEl.slice() : [opts.snapExtraCardEl];
    }
    var onSelect = opts.onSelect || function () {};
    var onLayoutChange = opts.onLayoutChange || function () {};
    var onCenterShiftChange = opts.onCenterShiftChange || function () {};
    var sel = null;
    var editingId = null;
    var built = false;
    var textNodes = {};
    var imgNodes = {};
    var guideLayer = null;
    var zoneLayer = null;
    var panelShowDesign = null;

    function imgSelId(id) { return "__img:" + id; }
    function isImgSel(s) { return s && s.indexOf("__img:") === 0; }

    function saveLayout() {
      onLayoutChange(getLayout());
    }
    var saveLayoutTimer = null;
    function saveLayoutSoon() {
      if (saveLayoutTimer) clearTimeout(saveLayoutTimer);
      saveLayoutTimer = setTimeout(function () {
        saveLayoutTimer = null;
        saveLayout();
      }, 100);
    }

    function isZoneSplitActive() {
      if (opts.zoneSplit === false) return false;
      var layout = getLayout();
      return !!(layout && layout.centerDivider);
    }

    function clampShift(mm) {
      if (window.MeishiCardUI && MeishiCardUI.clampCenterShiftMm) {
        return MeishiCardUI.clampCenterShiftMm(mm);
      }
      return Math.max(-40, Math.min(40, Math.round(mm)));
    }

    function getCenterShiftMm() {
      var layout = getLayout();
      if (layout && typeof layout.centerShiftMm === "number" && !isNaN(layout.centerShiftMm)) {
        return clampShift(layout.centerShiftMm);
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
      layout.centerShiftMm = clampShift(mm);
      updateZoneLayerVisual();
      if (!opts.visualOnly) onCenterShiftChange(layout.centerShiftMm);
    }

    function attachCenterLineDrag(handle) {
      handle.addEventListener("pointerdown", function (ev) {
        if (readOnly) return;
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        handle.setPointerCapture(ev.pointerId);
        cardEl.classList.add("is-dragging-center");
        var startShift = getCenterShiftMm();
        var startX = pxFromEvent(ev).clientX;
        var cardW = cardEl.clientWidth || 1;
        function mv(e2) {
          var deltaPx = pxFromEvent(e2).clientX - startX;
          var deltaMm = deltaPx * CARD_W_MM / cardW;
          setCenterShiftMm(startShift - deltaMm, { visualOnly: true });
        }
        function up(e2) {
          cardEl.classList.remove("is-dragging-center");
          try { handle.releasePointerCapture(e2.pointerId); } catch (e) {}
          handle.removeEventListener("pointermove", mv);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
          onCenterShiftChange(getCenterShiftMm());
          saveLayout();
        }
        handle.addEventListener("pointermove", mv);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      });
    }

    function ensureZoneLayer() {
      if (!isZoneSplitActive() || readOnly) return;
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
      if (isZoneSplitActive() && !readOnly) {
        cardEl.classList.add("zone-split", "design-mode");
        ensureZoneLayer();
        updateZoneLayerVisual();
      } else {
        if (!readOnly) cardEl.classList.add("design-mode");
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
      if (guideX != null) { vLine.style.display = "block"; vLine.style.left = guideX + "px"; }
      else vLine.style.display = "none";
      if (guideY != null) { hLine.style.display = "block"; hLine.style.top = guideY + "px"; }
      else hLine.style.display = "none";
    }

    function hideGuides() { showGuides(null, null); }

    function showDragGuides(guides, boxX, boxY, boxW, boxH, anchor) {
      var gx = guides.guideX != null ? guides.guideX : (anchor === "br" ? boxX + boxW : boxX + boxW / 2);
      var gy = guides.guideY != null ? guides.guideY : (anchor === "br" ? boxY + boxH : boxY + boxH / 2);
      showGuides(gx, gy);
    }

    function clampSize(n) {
      return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)));
    }

    function getSelectedText() {
      if (!sel || isImgSel(sel)) return null;
      var layout = getLayout();
      var st = (layout.texts || []).find(function (t) { return t.id === sel; });
      var node = textNodes[sel];
      if (!st || !node) return null;
      return { st: st, node: node };
    }

    function patchSelectedText(patch) {
      var hit = getSelectedText();
      if (!hit || readOnly) return;
      if (editingId === sel && patch.content != null) return;
      if (patch.size != null) patch.size = clampSize(patch.size);
      if (Object.prototype.hasOwnProperty.call(patch, "bg") && MeishiLayout.normalizeBg) {
        patch.bg = MeishiLayout.normalizeBg(patch.bg);
      }
      Object.assign(hit.st, patch);
      applyTextStyle(hit.node, hit.st, editingId === sel);
      saveLayout();
      if (panelShowDesign) panelShowDesign();
    }

    function bumpTextSize(delta) {
      var hit = getSelectedText();
      if (!hit) return;
      patchSelectedText({ size: clampSize((hit.st.size || 12) + delta) });
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

    function ensureImageAspectFit(raw, imgEl) {
      if (!raw || !imgEl) return;
      function run() {
        if (!fitImageBoxToNatural(raw, imgEl)) return;
        var sized = clampSizeInCard(raw.x || 0, raw.y || 0, raw.w || 16, raw.h || 12);
        raw.w = sized.w;
        raw.h = sized.h;
        var pos = clampPosInCard(raw.x || 0, raw.y || 0, raw.w, raw.h);
        raw.x = pos.x;
        raw.y = pos.y;
        if (imgNodes[raw.id]) {
          var n = imgNodes[raw.id];
          n.wrap.style.left = raw.x + "px";
          n.wrap.style.top = raw.y + "px";
          n.wrap.style.width = raw.w + "px";
          n.wrap.style.height = raw.h + "px";
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

    function applyTextStyle(node, st, skipContent) {
      if (!skipContent && st.id !== editingId && document.activeElement !== node) {
        node.textContent = st.content || "";
      }
      node.setAttribute("data-content", String(st.content || ""));
      node.style.fontSize = st.size + "px";
      node.style.color = st.color || "#222222";
      node.style.fontFamily = MeishiLayout.resolveBackFontFamily(st.font || "");
      node.style.fontWeight = st.bold ? "700" : "400";
      node.style.fontStyle = st.italic ? "italic" : "normal";
      node.style.textAlign = st.align || "left";
      if (MeishiLayout.applyTextBgStyle) MeishiLayout.applyTextBgStyle(node, st);
      node.style.whiteSpace = "pre-wrap";
      node.style.wordBreak = "break-word";
      applyUnderlineStyle(node, st);
      var maxW = Math.max(40, cardInnerWidth() - Math.max(0, st.x || 0));
      node.style.maxWidth = maxW + "px";
      var pos = clampPosInCard(st.x || 0, st.y || 0, node.offsetWidth || 40, node.offsetHeight || st.size || 12);
      st.x = pos.x;
      st.y = pos.y;
      node.style.left = st.x + "px";
      node.style.top = st.y + "px";
      node.style.zIndex = String(ensureItemZ(st, 20));
    }

    function clampUlLen(n) {
      var v = Math.round(Number(n) || 0);
      if (!isFinite(v)) v = 0;
      return Math.max(UL_LEN_MIN, Math.min(UL_LEN_MAX, v));
    }

    function clampUlThick(n) {
      var v = Math.round(Number(n) || 0);
      if (!isFinite(v) || v < UL_THICK_MIN) v = UL_THICK_MIN;
      return Math.max(UL_THICK_MIN, Math.min(UL_THICK_MAX, v));
    }

    function availUlWidth(st) {
      return Math.max(1, cardInnerWidth() - Math.max(0, (st && st.x) || 0));
    }

    function textRawContent(st, node) {
      if (st && node && (editingId === st.id || document.activeElement === node)) {
        return String(node.innerText || node.textContent || "");
      }
      return String((st && st.content) || "");
    }

    function measureTextPx(text, st, node) {
      var size = Math.max(6, (st && st.size) || 12);
      var family = MeishiLayout.resolveBackFontFamily((st && st.font) || "");
      var weight = (st && st.bold) ? "700" : "400";
      var style = (st && st.italic) ? "italic" : "normal";
      try {
        if (node && node.ownerDocument && node.isConnected) {
          var cs = window.getComputedStyle(node);
          if (cs.fontFamily) family = cs.fontFamily;
        }
      } catch (e0) {}
      try {
        var ctx = measureTextPx._ctx;
        if (!ctx) {
          measureTextPx._canvas = document.createElement("canvas");
          measureTextPx._ctx = measureTextPx._canvas.getContext("2d");
          ctx = measureTextPx._ctx;
        }
        if (ctx) {
          ctx.font = style + " " + weight + " " + size + "px " + family;
          var w = ctx.measureText(String(text || "")).width;
          if (isFinite(w) && w > 0) return w;
        }
      } catch (e1) {}
      return size * String(text || "").length;
    }

    /** 全角1文字分の幅（「あ」を実測。ulLen の単位） */
    function zenCharPx(st, node) {
      var w = measureTextPx("あ", st, node);
      var size = Math.max(6, (st && st.size) || 12);
      return Math.max(size * 0.8, w || size);
    }

    /** 最長行の見た目幅を全角文字数に換算（切り上げ） */
    function contentZenChars(st, node) {
      var unit = zenCharPx(st, node);
      var raw = textRawContent(st, node).replace(/\r\n/g, "\n");
      var lines = raw.split("\n");
      var maxPx = 0;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line) continue;
        var px = measureTextPx(line, st, node);
        if (px > maxPx) maxPx = px;
      }
      if (maxPx <= 0) return 0;
      return Math.max(1, Math.ceil(maxPx / unit - 1e-6));
    }

    /** 名刺の残り幅に収まる最大・全角文字数 */
    function maxUlLenFor(st, node) {
      var unit = zenCharPx(st, node);
      var maxW = availUlWidth(st);
      return Math.max(1, Math.min(UL_LEN_MAX, Math.floor(maxW / unit)));
    }

    /** 行高・下線太さを整数pxで固定し、改行行ごとの太さずれを防ぐ */
    function underlineLineMetrics(st) {
      var size = Math.max(6, (st && st.size) || 12);
      var thick = clampUlThick(st && st.ulThick);
      if (st) st.ulThick = thick;
      var lineH = Math.max(size + 2, Math.round(size * 1.3), thick + size);
      return { size: size, lineH: lineH, thick: thick };
    }

    function resolveUlColor(st) {
      var uc = st && st.ulColor ? String(st.ulColor).trim() : "";
      if (/^#[0-9A-Fa-f]{6}$/.test(uc)) return uc;
      var tc = st && st.color ? String(st.color).trim() : "";
      if (/^#[0-9A-Fa-f]{6}$/.test(tc)) return tc;
      return "#222222";
    }

    /** underline + ulLen: 改行後も全行に下線。ulLen>0 なら全角N文字分の固定幅 */
    function applyUnderlineStyle(node, st) {
      if (!node || !st) return;
      var on = !!st.underline;
      var ulLen = clampUlLen(st.ulLen);
      st.ulLen = ulLen;
      st.ulThick = clampUlThick(st.ulThick);
      if (!on) {
        node.style.textDecoration = "none";
        node.style.borderBottom = "";
        node.style.paddingBottom = "";
        node.style.width = "";
        node.style.minWidth = "";
        node.style.backgroundImage = "";
        node.style.backgroundRepeat = "";
        node.style.backgroundSize = "";
        node.style.backgroundPosition = "";
        node.style.lineHeight = "";
        node.removeAttribute("data-ul-fixed");
        node.removeAttribute("data-ul-lines");
        return;
      }
      var m = underlineLineMetrics(st);
      var ulCol = resolveUlColor(st);
      var gap = Math.max(0, m.lineH - m.thick);
      // 行ごとに下線（border-bottom だと最終行だけになるため gradient を使う）
      // em ではなく整数pxでタイルし、行ごとの太さのばらつきを防ぐ
      node.style.textDecoration = "none";
      node.style.borderBottom = "none";
      node.style.paddingBottom = "0";
      node.style.lineHeight = m.lineH + "px";
      node.style.backgroundImage =
        "repeating-linear-gradient(to bottom, transparent 0, transparent " +
        gap + "px, " + ulCol + " " + gap + "px, " + ulCol + " " + m.lineH + "px)";
      node.style.backgroundRepeat = "repeat-y";
      node.style.backgroundSize = "100% " + m.lineH + "px";
      node.style.backgroundPosition = "left top";
      node.setAttribute("data-ul-lines", "1");
      if (ulLen > 0) {
        var unit = zenCharPx(st, node);
        var avail = availUlWidth(st);
        var ulW = Math.min(avail, Math.max(unit, Math.round(unit * ulLen)));
        node.style.boxSizing = "border-box";
        node.style.width = ulW + "px";
        node.style.minWidth = ulW + "px";
        node.setAttribute("data-ul-fixed", String(ulLen));
      } else {
        node.style.width = "";
        node.style.minWidth = "";
        node.removeAttribute("data-ul-fixed");
      }
    }

    function bumpUlLen(delta) {
      var hit = getSelectedText();
      if (!hit || !hit.st) return;
      if (hit.node && editingId === hit.st.id) {
        syncTextContentFromNode(hit.node, hit.st);
      }
      // 全角1文字＝1ステップ（▲で +1、▼で -1）
      var n = contentZenChars(hit.st, hit.node);
      var cur = clampUlLen(hit.st.ulLen);
      var max = maxUlLenFor(hit.st, hit.node);
      var next;
      if (delta > 0) {
        if (cur < 1) next = Math.min(max, Math.max(n + 1, 1));
        else next = Math.min(max, cur + 1);
        if (next === cur && cur >= max) return;
        if (next < 1) return;
      } else {
        if (cur < 1) return;
        next = cur - 1;
        if (next <= n) next = 0;
      }
      patchSelectedText({ underline: 1, ulLen: next });
    }

    function bumpUlThick(delta) {
      var hit = getSelectedText();
      if (!hit || !hit.st) return;
      var cur = clampUlThick(hit.st.ulThick);
      var next = clampUlThick(cur + (delta > 0 ? 1 : -1));
      if (next === cur) return;
      patchSelectedText({ underline: 1, ulThick: next });
    }

    function layerableItems(layout) {
      var items = [];
      ((layout && layout.texts) || []).forEach(function (t) { if (t) items.push(t); });
      ((layout && layout.images) || []).forEach(function (im) { if (im) items.push(im); });
      return items;
    }

    function ensureItemZ(st, fallback) {
      var z = Number(st && st.z);
      if (!isFinite(z)) {
        z = fallback;
        if (st) st.z = z;
      } else {
        z = Math.round(z);
        st.z = z;
      }
      return z;
    }

    function nextLayerZ(layout) {
      var max = 0;
      layerableItems(layout).forEach(function (it) {
        var z = Number(it.z);
        if (isFinite(z) && z > max) max = z;
      });
      return Math.max(10, Math.round(max) + 1);
    }

    function rawImageIdFromSel(selId) {
      if (!isImgSel(selId)) return "";
      return String(selId).replace(/^__img:/, "");
    }

    function getSelectedLayerTarget() {
      if (!sel) return null;
      var layout = getLayout();
      if (!layout) return null;
      if (isImgSel(sel)) {
        var imgId = rawImageIdFromSel(sel);
        var im = ((layout.images) || []).find(function (x) { return x && x.id === imgId; });
        if (!im) return null;
        return { kind: "image", st: im, node: imgNodes[imgId] ? imgNodes[imgId].wrap : null };
      }
      if (textNodes[sel]) {
        var tx = ((layout.texts) || []).find(function (t) { return t && t.id === sel; });
        if (!tx) return null;
        return { kind: "text", st: tx, node: textNodes[sel] };
      }
      return null;
    }

    function applyLayerZToNode(hit) {
      if (!hit || !hit.st) return;
      var z = ensureItemZ(hit.st, hit.kind === "image" ? 10 : 20);
      if (hit.node) hit.node.style.zIndex = String(z);
    }

    function bringSelectedToFront() {
      if (readOnly) return false;
      var hit = getSelectedLayerTarget();
      if (!hit) return false;
      var layout = getLayout();
      hit.st.z = nextLayerZ(layout);
      applyLayerZToNode(hit);
      saveLayout();
      if (panelShowDesign) panelShowDesign();
      return true;
    }

    function sendSelectedToBack() {
      if (readOnly) return false;
      var hit = getSelectedLayerTarget();
      if (!hit) return false;
      var layout = getLayout();
      var min = Infinity;
      layerableItems(layout).forEach(function (it) {
        if (it === hit.st) return;
        var z = ensureItemZ(it, 10);
        if (z < min) min = z;
      });
      if (!isFinite(min)) min = 10;
      hit.st.z = min - 1;
      if (hit.st.z < 1) {
        var shift = 1 - hit.st.z;
        layerableItems(layout).forEach(function (it) {
          it.z = ensureItemZ(it, 10) + shift;
        });
      }
      applyLayerZToNode(hit);
      ((layout.texts) || []).forEach(function (t) {
        if (t && textNodes[t.id]) textNodes[t.id].style.zIndex = String(ensureItemZ(t, 20));
      });
      ((layout.images) || []).forEach(function (im) {
        if (im && imgNodes[im.id]) imgNodes[im.id].wrap.style.zIndex = String(ensureItemZ(im, 10));
      });
      saveLayout();
      if (panelShowDesign) panelShowDesign();
      return true;
    }

    function syncTextContentFromNode(node, st) {
      st.content = (node.innerText || "").replace(/\r\n/g, "\n");
      if (node) node.setAttribute("data-content", String(st.content || ""));
    }

    function exitInlineEdit(node, st) {
      if (!node || !st || editingId !== st.id) return;
      syncTextContentFromNode(node, st);
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
    }

    function attachInlineEdit(node, st) {
      node.addEventListener("blur", function () {
        if (editingId === st.id) exitInlineEdit(node, st);
      });
      node.addEventListener("input", function () {
        if (editingId !== st.id) return;
        syncTextContentFromNode(node, st);
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
      syncTextContentFromNode(node, st);
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
        var layout = MeishiCatalog.normalizeBackLayout
          ? MeishiCatalog.normalizeBackLayout(getLayout())
          : getLayout();
        layout.texts = layout.texts || [];
        var block;
        if (clip && clip.block) {
          block = MeishiLayout.clone(clip.block);
          if (plain !== "") block.content = plain;
        } else if (MeishiLayout.defTextBlock) {
          block = MeishiLayout.defTextBlock(layout.texts.length);
          block.content = plain || "テキスト";
        } else {
          block = {
            content: plain || "テキスト",
            x: 20, y: 20, size: 12, color: "#222222",
            bg: "", bold: 0, italic: 0, underline: 0, ulLen: 0, ulThick: 1, ulColor: "", font: "", align: "left",
          };
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
      if (readOnly) return false;
      if (!cardEl || !cardEl.isConnected) return false;
      var r = cardEl.getBoundingClientRect();
      return r.width > 8 && r.height > 8;
    }

    function registerTextClipShortcuts() {
      if (!window.MeishiTextClip || readOnly || cardEl._meishiClipReg) return;
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

    function updateSelectionHighlight() {
      Object.keys(textNodes).forEach(function (id) {
        textNodes[id].classList.toggle("sel", id === sel);
      });
      Object.keys(imgNodes).forEach(function (id) {
        imgNodes[id].wrap.classList.toggle("sel", sel === imgSelId(id));
      });
    }

    function attachDrag(node, st, isImage) {
      node.addEventListener("pointerdown", function (ev) {
        if (readOnly) return;
        if (ev.button !== 0) return;
        if (ev.target.classList.contains("rs")) return;
        if (!isImage && (editingId === st.id || node.classList.contains("is-editing"))) return;
        var id = node.dataset.id;
        var wasSelected = sel === id;
        if (sel !== id) {
          sel = id;
          updateSelectionHighlight();
          onSelect(id, getLayout());
        }
        var pid = ev.pointerId;
        var p = pxFromEvent(ev);
        var sx = p.clientX, sy = p.clientY, ox = st.x, oy = st.y;
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
        }
        function mv(e2) {
          if (ended || e2.pointerId !== pid) return;
          var q = pxFromEvent(e2);
          var dx = q.clientX - sx;
          var dy = q.clientY - sy;
          if (!dragging) {
            if (Math.abs(dx) < DRAG_START && Math.abs(dy) < DRAG_START) return;
            dragging = true;
            try { node.setPointerCapture(pid); } catch (e) {}
            cardEl.classList.add("is-dragging");
          }
          nx = Math.round(ox + dx);
          ny = Math.round(oy + dy);
          var boxW = isImage ? (st.w || node.offsetWidth || 1) : (node.offsetWidth || 1);
          var boxH = isImage ? (st.h || node.offsetHeight || 1) : (node.offsetHeight || 1);
          var clamped = clampPosInCard(nx, ny, boxW, boxH);
          nx = clamped.x;
          ny = clamped.y;
          var guides = guideForDrag(cardEl, node, nx, ny, snapExtraCardEls);
          showDragGuides(guides, nx, ny, node.offsetWidth, node.offsetHeight, "center");
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
            saveLayout();
          } else if (!isImage && wasSelected) {
            enterInlineEdit(node, st, false);
          }
          cardEl.classList.remove("is-dragging");
          try {
            if (node.hasPointerCapture && node.hasPointerCapture(pid)) node.releasePointerCapture(pid);
          } catch (e) {}
        }
        if (isImage) ev.preventDefault();
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
          nw = Math.max(16, Math.round(ow + (q.clientX - sx)));
          nh = Math.max(12, Math.round(oh + (q.clientY - sy)));
          var sized = clampSizeInCard(im.x, im.y, nw, nh);
          nw = sized.w;
          nh = sized.h;
          im.aspectFit = 1;
          var guides = guideForDrag(cardEl, wrap, im.x, im.y, snapExtraCardEls);
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

    function syncNodes() {
      var layout = MeishiCatalog.normalizeBackLayout(getLayout());
      if (!layout.texts) layout.texts = [];
      if (!layout.images) layout.images = [];
      var textIds = {};
      if (!hideTexts) {
        layout.texts.forEach(function (st) {
          if (!st.id) st.id = "txt" + Date.now();
          textIds[st.id] = st;
          var node = textNodes[st.id];
          if (!node) {
            node = document.createElement("div");
            node.className = "btel";
            node.dataset.id = st.id;
            if (!readOnly) {
              attachInlineEdit(node, st);
              attachDrag(node, st, false);
            } else {
              node.style.cursor = "default";
            }
            cardEl.appendChild(node);
            textNodes[st.id] = node;
          }
          applyTextStyle(node, st, st.id === editingId);
        });
      }
      Object.keys(textNodes).forEach(function (id) {
        if (!textIds[id]) { textNodes[id].remove(); delete textNodes[id]; }
      });

      var imgIds = {};
      if (!hideImages) {
        layout.images.forEach(function (raw) {
          if (!hasImageRef(raw)) return;
          var display = raw;
          if (window.MeishiImageLib) {
            var rs = MeishiImageLib.resolveImages([raw]);
            if (rs[0]) display = rs[0];
          }
          if (!raw.id) raw.id = "img" + Date.now();
          imgIds[raw.id] = raw;
          var n = imgNodes[raw.id];
          if (!n) {
            var wrap = document.createElement("div");
            wrap.className = "imgel";
            wrap.dataset.id = imgSelId(raw.id);
            var img = document.createElement("img");
            img.draggable = false;
            wrap.appendChild(img);
            var rsEl = document.createElement("div");
            rsEl.className = "rs";
            wrap.appendChild(rsEl);
            if (!readOnly) {
              attachDrag(wrap, raw, true);
              attachResize(rsEl, raw, wrap);
            } else {
              wrap.style.cursor = "default";
              if (rsEl) rsEl.style.display = "none";
            }
            cardEl.appendChild(wrap);
            imgNodes[raw.id] = { wrap: wrap, img: img, rs: rsEl, st: raw };
          } else {
            n.st = raw;
          }
          n = imgNodes[raw.id];
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
          n.wrap.style.zIndex = String(ensureItemZ(raw, 10));
        });
      }
      Object.keys(imgNodes).forEach(function (id) {
        if (!imgIds[id]) { imgNodes[id].wrap.remove(); delete imgNodes[id]; }
      });
      updateSelectionHighlight();
    }

    function ensureBuilt() {
      if (built) return;
      cardEl.innerHTML = "";
      textNodes = {};
      imgNodes = {};
      zoneLayer = null;
      if (readOnly) cardEl.classList.add("print-readonly");
      else {
        cardEl.classList.add("design-mode");
        ensureGuideLayer();
      }
      syncZoneMode();
      registerTextClipShortcuts();
      built = true;
    }

    function renderCard() {
      ensureBuilt();
      syncZoneMode();
      syncNodes();
      updateZoneLayerVisual();
    }

    function invalidate() {
      built = false;
      editingId = null;
      textNodes = {};
      imgNodes = {};
      guideLayer = null;
      zoneLayer = null;
      cardEl.innerHTML = "";
    }

    function editTextById(id, selectAll) {
      var node = textNodes[id];
      var layout = getLayout();
      var st = (layout.texts || []).find(function (t) { return t.id === id; });
      if (node && st) enterInlineEdit(node, st, selectAll !== false);
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
      return !!layout.centerDivider;
    }

    function getCenterDivider() {
      return isZoneSplitActive();
    }

    function bindBackDesignPanel(panel, panelIds) {
      if (!panel) return { showDesign: function () {} };
      panelIds = panelIds || {};
      function q(id, fallback) {
        return panel.querySelector("#" + (panelIds[id] || fallback));
      }
      var backDesSizeUp = q("sizeUp", "backDesSizeUp");
      var backDesSizeDown = q("sizeDown", "backDesSizeDown");
      var backDesSizeV = q("sizeV", "backDesSizeV");
      var backDesColor = q("color", "backDesColor");
      var backDesBg = q("bg", "backDesBg");
      var backDesBgNone = q("bgNone", "backDesBgNone");
      var backDesNorm = q("norm", "backDesNorm");
      var backDesBold = q("bold", "backDesBold");
      var backDesItalic = q("italic", "backDesItalic");
      var backDesUnderline = q("underline", "backDesUnderline");
      var backDesUlUp = q("ulUp", "backDesUlUp");
      var backDesUlDown = q("ulDown", "backDesUlDown");
      var backDesUlV = q("ulV", "backDesUlV");
      var backDesUlLenRow = q("ulLenRow", "backDesUlLenRow");
      var backDesUlThickUp = q("ulThickUp", "backDesUlThickUp");
      var backDesUlThickDown = q("ulThickDown", "backDesUlThickDown");
      var backDesUlThickV = q("ulThickV", "backDesUlThickV");
      var backDesUlThickRow = q("ulThickRow", "backDesUlThickRow");
      var backDesUlColor = q("ulColor", "backDesUlColor");
      var backDesUlColorRow = q("ulColorRow", "backDesUlColorRow");
      var designCtl = q("ctl", "backDesignCtl");
      var designNone = q("none", "backDesignNone");
      var textDelete = q("textDelete", "backDesTextDelete");
      var textDeleteRow = textDelete ? textDelete.closest(".des-row") : null;
      var backDesFont = q("font", "backDesFont");
      var layerRow = q("layerRow", "backDesignLayerRow");
      var desFront = q("front", "backDesFront");
      var desBack = q("back", "backDesBack");
      var alignAttr = panelIds.alignAttr || "data-back-al";

      function showDesign() {
        if (!designCtl || !designNone) return;
        var layerHit = getSelectedLayerTarget();
        if (layerRow) layerRow.style.display = layerHit ? "" : "none";
        if (!sel || isImgSel(sel)) {
          designCtl.style.display = "none";
          designNone.style.display = "";
          if (isImgSel(sel)) designNone.textContent = "画像が選択されています。ドラッグで移動、右下でサイズ変更。重ね順は下のボタンで変更できます。";
          else designNone.textContent = "テキストをクリックして直接入力できます。書式は右のパネルで変更してください。";
          if (textDeleteRow) textDeleteRow.style.display = "none";
          if (backDesUlLenRow) backDesUlLenRow.style.display = "none";
          if (backDesUlThickRow) backDesUlThickRow.style.display = "none";
          if (backDesUlColorRow) backDesUlColorRow.style.display = "none";
          return;
        }
        designNone.style.display = "none";
        designCtl.style.display = "";
        var hit = getSelectedText();
        if (!hit) return;
        var st = hit.st;
        if (backDesSizeV) backDesSizeV.textContent = st.size + "px";
        if (backDesSizeUp) backDesSizeUp.disabled = st.size >= SIZE_MAX;
        if (backDesSizeDown) backDesSizeDown.disabled = st.size <= SIZE_MIN;
        if (backDesColor) backDesColor.value = st.color && st.color.length === 7 ? st.color : "#222222";
        var bg = MeishiLayout.normalizeBg ? MeishiLayout.normalizeBg(st.bg) : (st.bg || "");
        if (backDesBg) {
          backDesBg._meishiSuppress = true;
          backDesBg.value = bg || "#ffffff";
          backDesBg._meishiSuppress = false;
        }
        if (backDesBgNone) backDesBgNone.classList.toggle("on", !bg);
        if (backDesNorm) backDesNorm.classList.toggle("on", !st.bold);
        if (backDesBold) backDesBold.classList.toggle("on", !!st.bold);
        if (backDesItalic) backDesItalic.classList.toggle("on", !!st.italic);
        if (backDesUnderline) backDesUnderline.classList.toggle("on", !!st.underline);
        var ulLen = clampUlLen(st.ulLen);
        var hitNode = (getSelectedText() || {}).node || null;
        var ulMax = maxUlLenFor(st, hitNode);
        if (backDesUlLenRow) backDesUlLenRow.style.display = st.underline ? "" : "none";
        if (backDesUlThickRow) backDesUlThickRow.style.display = st.underline ? "" : "none";
        if (backDesUlColorRow) backDesUlColorRow.style.display = st.underline ? "" : "none";
        if (backDesUlV) backDesUlV.textContent = ulLen > 0 ? (ulLen + "文字") : "自動";
        if (backDesUlUp) backDesUlUp.disabled = ulLen >= ulMax;
        if (backDesUlDown) backDesUlDown.disabled = ulLen <= UL_LEN_MIN;
        var ulThick = clampUlThick(st.ulThick);
        if (backDesUlThickV) backDesUlThickV.textContent = ulThick + "px";
        if (backDesUlThickUp) backDesUlThickUp.disabled = ulThick >= UL_THICK_MAX;
        if (backDesUlThickDown) backDesUlThickDown.disabled = ulThick <= UL_THICK_MIN;
        if (backDesUlColor) {
          backDesUlColor._meishiSuppress = true;
          backDesUlColor.value = resolveUlColor(st);
          backDesUlColor._meishiSuppress = false;
        }
        if (MeishiLayout.fillFontSelect) MeishiLayout.fillFontSelect(backDesFont, st.font || "");
        panel.querySelectorAll("[" + alignAttr + "]").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute(alignAttr) === st.align);
        });
        if (textDeleteRow) textDeleteRow.style.display = "";
      }

      panelShowDesign = showDesign;

      if (backDesSizeUp) backDesSizeUp.addEventListener("click", function () {
        bumpTextSize(SIZE_STEP);
        showDesign();
      });
      if (backDesSizeDown) backDesSizeDown.addEventListener("click", function () {
        bumpTextSize(-SIZE_STEP);
        showDesign();
      });
      if (backDesColor) backDesColor.addEventListener("input", function () {
        patchSelectedText({ color: this.value });
        showDesign();
      });
      if (backDesBg) backDesBg.addEventListener("input", function () {
        if (this._meishiSuppress) return;
        patchSelectedText({ bg: this.value });
        if (backDesBgNone) backDesBgNone.classList.remove("on");
        showDesign();
      });
      if (backDesBgNone) backDesBgNone.addEventListener("click", function () {
        patchSelectedText({ bg: "" });
        showDesign();
      });
      if (backDesNorm) backDesNorm.addEventListener("click", function () {
        patchSelectedText({ bold: 0 }); showDesign();
      });
      if (backDesBold) backDesBold.addEventListener("click", function () {
        patchSelectedText({ bold: 1 }); showDesign();
      });
      if (backDesItalic) backDesItalic.addEventListener("click", function () {
        var hit = getSelectedText();
        if (hit) patchSelectedText({ italic: hit.st.italic ? 0 : 1 });
        showDesign();
      });
      if (backDesUnderline) backDesUnderline.addEventListener("click", function () {
        var hit = getSelectedText();
        if (hit) patchSelectedText({ underline: hit.st.underline ? 0 : 1 });
        showDesign();
      });
      if (backDesUlUp) backDesUlUp.addEventListener("click", function () {
        bumpUlLen(1);
        showDesign();
      });
      if (backDesUlDown) backDesUlDown.addEventListener("click", function () {
        bumpUlLen(-1);
        showDesign();
      });
      if (backDesUlColor) backDesUlColor.addEventListener("input", function () {
        if (this._meishiSuppress) return;
        patchSelectedText({ underline: 1, ulColor: this.value });
        showDesign();
      });
      if (backDesUlThickUp) backDesUlThickUp.addEventListener("click", function () {
        bumpUlThick(1);
        showDesign();
      });
      if (backDesUlThickDown) backDesUlThickDown.addEventListener("click", function () {
        bumpUlThick(-1);
        showDesign();
      });
      if (backDesFont && !backDesFont._meishiBound) {
        backDesFont._meishiBound = true;
        if (MeishiLayout.fillFontSelect) MeishiLayout.fillFontSelect(backDesFont, "");
        backDesFont.addEventListener("change", function () {
          patchSelectedText({ font: this.value || "" });
          showDesign();
        });
      }
      panel.querySelectorAll("[" + alignAttr + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          patchSelectedText({ align: this.getAttribute(alignAttr) });
          showDesign();
        });
      });
      if (textDelete) {
        textDelete.addEventListener("click", function () {
          var hit = getSelectedText();
          if (!hit) return;
          removeTextBlock(hit.st.id);
        });
      }
      if (desFront) desFront.addEventListener("click", function () { bringSelectedToFront(); });
      if (desBack) desBack.addEventListener("click", function () { sendSelectedToBack(); });

      return { showDesign: showDesign };
    }

    return {
      renderCard: renderCard,
      invalidate: invalidate,
      bindBackDesignPanel: bindBackDesignPanel,
      clearSelection: function () { sel = null; updateSelectionHighlight(); },
      editTextById: editTextById,
      removeTextBlock: removeTextBlock,
      commitAllTextEdits: commitAllTextEdits,
      setCenterDivider: setCenterDivider,
      getCenterDivider: getCenterDivider,
      getSelection: function () { return sel; },
      setSelection: function (v) { sel = v; updateSelectionHighlight(); },
      bringSelectedToFront: bringSelectedToFront,
      sendSelectedToBack: sendSelectedToBack,
      nextLayerZ: function () { return nextLayerZ(getLayout()); },
    };
  }

  window.MeishiBackCardUI = { createBackCardUI: createBackCardUI };
})();
