/**
 * 名刺プレビュー・デザイン編集 UI（使用者・所有者で共有）
 * ドラッグ中は DOM 再生成せず style のみ更新して軽量化。
 * 編集時は他要素・カード端／中心へスナップ（縦横軸合わせ）。
 */
(function () {
  var SNAP_THRESH = 6;
  var FLOW_PAD = 6;
  var CARD_W_MM = 91;
  var CENTER_GAP_MM = 2;

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
      root.querySelectorAll(".el, .imgel").forEach(function (n) {
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
    var left = nx;
    var top = ny;
    var targets = collectSnapTargets(cardEl, node, zoneEdges, extraCardEls);
    var sx = bestSnap([left, left + w / 2, left + w], targets.tx, SNAP_THRESH);
    var sy = bestSnap([top, top + h / 2, top + h], targets.ty, SNAP_THRESH);
    return {
      nx: nx + (sx ? sx.delta : 0),
      ny: ny + (sy ? sy.delta : 0),
      guideX: sx ? sx.line : null,
      guideY: sy ? sy.line : null,
    };
  }

  function snapResizeBox(cardEl, node, x, y, nw, nh, zoneEdges, extraCardEls) {
    var targets = collectSnapTargets(cardEl, node, zoneEdges, extraCardEls);
    var sr = bestSnap([x + nw], targets.tx, SNAP_THRESH);
    var sb = bestSnap([y + nh], targets.ty, SNAP_THRESH);
    return {
      w: Math.max(16, nw + (sr ? sr.delta : 0)),
      h: Math.max(12, nh + (sb ? sb.delta : 0)),
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
    var zoneSplit = opts.zoneSplit !== false;
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
    var guideLayer = null;
    var zoneLayer = null;

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
      if (!zoneSplit || readOnly) return null;
      return getCardZones();
    }

    function useAutoWrap() {
      return zoneSplit && (textFlow || !readOnly);
    }

    function useZoneTextLayout() {
      return zoneSplit && !hideElements;
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
      if (!zoneSplit || readOnly || hideElements) return;
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
      Object.keys(imgNodes).forEach(function (id) {
        imgNodes[id].wrap.classList.toggle("sel", sel === imgSelId(id));
      });
    }

    function textMaxWidth(st) {
      if (!zoneSplit) return Math.max(32, cardEl.clientWidth - st.x - FLOW_PAD);
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
      if (readOnly) cardEl.classList.add("print-readonly");
      else cardEl.classList.remove("print-readonly");
      if (textFlow) cardEl.classList.add("text-flow");
      else cardEl.classList.remove("text-flow");
      if (zoneSplit && !hideElements) {
        cardEl.classList.add("zone-split");
        if (!readOnly) {
          cardEl.classList.add("design-mode");
          ensureZoneLayer();
        } else {
          cardEl.classList.remove("design-mode");
        }
      } else {
        cardEl.classList.remove("design-mode", "zone-split");
      }
      if (!hideElements) {
        MeishiLayout.ELS.forEach(function (e) {
          var st = getLayout().el[e.id];
          if (!st) return;
          var d = document.createElement("div");
          d.className = "el";
          d.dataset.id = e.id;
          if (!readOnly) attachDrag(d, st);
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
            attachDrag(wrap, raw);
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

    function renderCard() {
      ensureBuilt();
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
      }
      syncImageNodes();
      updateZoneLayerVisual();
      updateSelectionHighlight();
    }

    function attachDrag(node, st) {
      node.addEventListener("pointerdown", function (ev) {
        if (readOnly) return;
        if (ev.button !== 0) return;
        if (ev.target.classList.contains("rs")) return;
        ev.preventDefault();
        var id = node.dataset.id;
        if (sel !== id) {
          sel = id;
          updateSelectionHighlight();
          onSelect(id, getLayout());
        }
        node.setPointerCapture(ev.pointerId);
        cardEl.classList.add("is-dragging");
        var p = pxFromEvent(ev);
        var sx = p.clientX, sy = p.clientY, ox = st.x, oy = st.y;
        var isTextDrag = useZoneTextLayout() && node.classList.contains("el");
        var isImageDrag = node.classList.contains("imgel");
        var raf = 0, nx = ox, ny = oy;
        function applyPos() {
          raf = 0;
          st.x = nx; st.y = ny;
          node.style.left = nx + "px";
          node.style.top = ny + "px";
          if (isTextDrag) node.style.maxWidth = textMaxWidth(st) + "px";
        }
        function mv(e2) {
          var q = pxFromEvent(e2);
          var rawNx = Math.round(ox + (q.clientX - sx));
          var rawNy = Math.round(oy + (q.clientY - sy));
          var snapped = snapDragPosition(cardEl, node, rawNx, rawNy, zoneSnapEdges(), snapExtraCardEls);
          var pointerX = q.clientX - cardEl.getBoundingClientRect().left;
          nx = isTextDrag ? clampTextDragX(node, snapped.nx, pointerX) : snapped.nx;
          ny = snapped.ny;
          if (isImageDrag) showDragGuides(snapped, nx, ny, node.offsetWidth, node.offsetHeight, "center");
          else showGuides(snapped.guideX, snapped.guideY);
          if (!raf) raf = requestAnimationFrame(applyPos);
        }
        function up(e2) {
          if (raf) cancelAnimationFrame(raf);
          applyPos();
          hideGuides();
          cardEl.classList.remove("is-dragging");
          try { node.releasePointerCapture(e2.pointerId); } catch (e) {}
          node.removeEventListener("pointermove", mv);
          node.removeEventListener("pointerup", up);
          node.removeEventListener("pointercancel", up);
          if (useZoneTextLayout() && id && !isImgSel(id)) {
            var st2 = getLayout().el[id];
            var lbl2 = (MeishiLayout.ELS.find(function (e) { return e.id === id; }) || {}).label || id;
            if (st2) applyElStyle(node, st2, getElText(id), lbl2, id);
          }
          saveLayout();
        }
        node.addEventListener("pointermove", mv);
        node.addEventListener("pointerup", up);
        node.addEventListener("pointercancel", up);
      });
    }

    function attachResize(handle, im, wrap) {
      handle.addEventListener("pointerdown", function (ev) {
        if (readOnly) return;
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        handle.setPointerCapture(ev.pointerId);
        cardEl.classList.add("is-dragging");
        var p = pxFromEvent(ev);
        var sx = p.clientX, sy = p.clientY, ow = im.w, oh = im.h;
        var raf = 0, nw = ow, nh = oh;
        function applySize() {
          raf = 0;
          im.w = nw; im.h = nh;
          wrap.style.width = nw + "px";
          wrap.style.height = nh + "px";
        }
        function mv(e2) {
          var q = pxFromEvent(e2);
          var rawW = Math.max(16, Math.round(ow + (q.clientX - sx)));
          var rawH = Math.max(12, Math.round(oh + (q.clientY - sy)));
          var snapped = snapResizeBox(cardEl, wrap, im.x, im.y, rawW, rawH, zoneSnapEdges(), snapExtraCardEls);
          nw = snapped.w;
          nh = snapped.h;
          showDragGuides(snapped, im.x, im.y, nw, nh, "br");
          if (!raf) raf = requestAnimationFrame(applySize);
        }
        function up(e2) {
          if (raf) cancelAnimationFrame(raf);
          applySize();
          hideGuides();
          cardEl.classList.remove("is-dragging");
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

    function selectEl(id) {
      if (sel === id) return;
      sel = id;
      updateSelectionHighlight();
      onSelect(id, getLayout());
    }

    function invalidate() {
      built = false;
      elNodes = {};
      imgNodes = {};
      guideLayer = null;
      zoneLayer = null;
      cardEl.innerHTML = "";
    }

    function bindDesignPanel(panel) {
      if (!panel) return;
      var desSize = panel.querySelector("#desSize");
      var desSizeV = panel.querySelector("#desSizeV");
      var desColor = panel.querySelector("#desColor");
      var desNorm = panel.querySelector("#desNorm");
      var desBold = panel.querySelector("#desBold");
      var desTarget = panel.querySelector("#desTarget");
      var designCtl = panel.querySelector("#designCtl");
      var designNone = panel.querySelector("#designNone");

      function patchSelected(patch) {
        if (readOnly) return;
        if (!sel || isImgSel(sel)) return;
        var st = getLayout().el[sel];
        var node = elNodes[sel];
        if (!st || !node) return;
        Object.assign(st, patch);
        var lbl = (MeishiLayout.ELS.find(function (e) { return e.id === sel; }) || {}).label || sel;
        applyElStyle(node, st, getElText(sel), lbl, sel);
        saveLayout();
      }

      function showDesign() {
        if (!designCtl || !designNone) return;
        if (!sel || isImgSel(sel)) {
          designCtl.style.display = "none";
          designNone.style.display = "";
          if (isImgSel(sel)) designNone.textContent = "画像が選択されています。右下の青い丸でサイズ変更、ドラッグで移動できます。";
          else designNone.textContent = "名刺上の項目をクリックすると、ここで文字サイズ・色・太さ・配置を変更できます。";
          return;
        }
        designNone.style.display = "none";
        designCtl.style.display = "";
        var st = getLayout().el[sel];
        var lbl = (MeishiLayout.ELS.find(function (e) { return e.id === sel; }) || {}).label || sel;
        if (desTarget) desTarget.textContent = "対象: " + lbl;
        if (desSize) desSize.value = st.size;
        if (desSizeV) desSizeV.textContent = st.size + "px";
        if (desColor) desColor.value = st.color.length === 7 ? st.color : "#222222";
        if (desNorm) desNorm.classList.toggle("on", !st.bold);
        if (desBold) desBold.classList.toggle("on", !!st.bold);
        panel.querySelectorAll("[data-al]").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-al") === st.align);
        });
      }

      if (desSize) desSize.addEventListener("input", function () {
        if (!sel || isImgSel(sel)) return;
        patchSelected({ size: +this.value });
        if (desSizeV) desSizeV.textContent = this.value + "px";
        showDesign();
      });
      if (desColor) desColor.addEventListener("input", function () {
        if (!sel || isImgSel(sel)) return;
        patchSelected({ color: this.value });
      });
      if (desNorm) desNorm.addEventListener("click", function () {
        if (!sel || isImgSel(sel)) return;
        patchSelected({ bold: 0 });
        showDesign();
      });
      if (desBold) desBold.addEventListener("click", function () {
        if (!sel || isImgSel(sel)) return;
        patchSelected({ bold: 1 });
        showDesign();
      });
      panel.querySelectorAll("[data-al]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!sel || isImgSel(sel)) return;
          patchSelected({ align: this.getAttribute("data-al") });
          showDesign();
        });
      });
      var desShow = panel.querySelector("#desShow");
      var desHide = panel.querySelector("#desHide");
      if (desShow) desShow.addEventListener("click", function () {
        if (!sel || isImgSel(sel)) return;
        patchSelected({ hidden: false });
      });
      if (desHide) desHide.addEventListener("click", function () {
        if (!sel || isImgSel(sel)) return;
        patchSelected({ hidden: true });
      });

      return {
        showDesign: showDesign,
        clearSelection: function () { sel = null; updateSelectionHighlight(); showDesign(); },
      };
    }

    return {
      renderCard: renderCard,
      selectEl: selectEl,
      bindDesignPanel: bindDesignPanel,
      clearSelection: function () { sel = null; updateSelectionHighlight(); },
      invalidate: invalidate,
      getSelection: function () { return sel; },
      setSelection: function (v) { sel = v; updateSelectionHighlight(); },
    };
  }

  window.MeishiCardUI = {
    createCardUI: createCardUI,
    clampCenterShiftMm: clampCenterShiftMm,
    maxCenterShiftMm: maxCenterShiftMm,
    formatCenterShiftLabel: formatCenterShiftLabel,
  };
})();
