/**
 * 名刺裏面デザイン UI（自由テキスト + 画像）
 */
(function () {
  var SNAP_THRESH = 6;
  var DRAG_START = 5;
  var SIZE_MIN = 6;
  var SIZE_MAX = 60;
  var SIZE_STEP = 1;
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

    function setCenterShiftMm(mm) {
      var layout = getLayout();
      if (!layout) return;
      layout.centerShiftMm = clampShift(mm);
      updateZoneLayerVisual();
      onCenterShiftChange(layout.centerShiftMm);
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
          setCenterShiftMm(startShift - deltaMm);
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

    function applyTextStyle(node, st, skipContent) {
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

    function syncTextContentFromNode(node, st) {
      st.content = (node.innerText || "").replace(/\r\n/g, "\n");
    }

    function exitInlineEdit(node, st) {
      if (!node || !st || editingId !== st.id) return;
      syncTextContentFromNode(node, st);
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
    }

    function attachInlineEdit(node, st) {
      node.addEventListener("blur", function () {
        if (editingId === st.id) exitInlineEdit(node, st);
      });
      node.addEventListener("input", function () {
        if (editingId !== st.id) return;
        syncTextContentFromNode(node, st);
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
          n.img.src = display.src || "";
          n.wrap.style.left = raw.x + "px";
          n.wrap.style.top = raw.y + "px";
          n.wrap.style.width = raw.w + "px";
          n.wrap.style.height = raw.h + "px";
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
      var backDesNorm = q("norm", "backDesNorm");
      var backDesBold = q("bold", "backDesBold");
      var backDesItalic = q("italic", "backDesItalic");
      var backDesUnderline = q("underline", "backDesUnderline");
      var designCtl = q("ctl", "backDesignCtl");
      var designNone = q("none", "backDesignNone");
      var textDelete = q("textDelete", "backDesTextDelete");
      var textDeleteRow = textDelete ? textDelete.closest(".des-row") : null;
      var alignAttr = panelIds.alignAttr || "data-back-al";
      var fontAttr = panelIds.fontAttr || "data-back-font";

      function showDesign() {
        if (!designCtl || !designNone) return;
        if (!sel || isImgSel(sel)) {
          designCtl.style.display = "none";
          designNone.style.display = "";
          if (isImgSel(sel)) designNone.textContent = "画像が選択されています。ドラッグで移動、右下でサイズ変更できます。";
          else designNone.textContent = "テキストをクリックして直接入力できます。書式は右のパネルで変更してください。";
          if (textDeleteRow) textDeleteRow.style.display = "none";
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
        if (backDesNorm) backDesNorm.classList.toggle("on", !st.bold);
        if (backDesBold) backDesBold.classList.toggle("on", !!st.bold);
        if (backDesItalic) backDesItalic.classList.toggle("on", !!st.italic);
        if (backDesUnderline) backDesUnderline.classList.toggle("on", !!st.underline);
        panel.querySelectorAll("[" + fontAttr + "]").forEach(function (b) {
          b.classList.toggle("on", (b.getAttribute(fontAttr) || "") === (st.font || ""));
        });
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
      panel.querySelectorAll("[" + fontAttr + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          patchSelectedText({ font: this.getAttribute(fontAttr) || "" });
          showDesign();
        });
      });
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

      return { showDesign: showDesign };
    }

    return {
      renderCard: renderCard,
      invalidate: invalidate,
      bindBackDesignPanel: bindBackDesignPanel,
      clearSelection: function () { sel = null; updateSelectionHighlight(); },
      editTextById: editTextById,
      removeTextBlock: removeTextBlock,
      setCenterDivider: setCenterDivider,
      getCenterDivider: getCenterDivider,
      getSelection: function () { return sel; },
      setSelection: function (v) { sel = v; updateSelectionHighlight(); },
    };
  }

  window.MeishiBackCardUI = { createBackCardUI: createBackCardUI };
})();
