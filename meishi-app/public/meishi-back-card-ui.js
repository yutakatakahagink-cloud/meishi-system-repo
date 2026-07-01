/**
 * 名刺裏面デザイン UI（自由テキスト + 画像）
 */
(function () {
  var SNAP_THRESH = 6;

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
    var sel = null;
    var built = false;
    var textNodes = {};
    var imgNodes = {};
    var guideLayer = null;

    function imgSelId(id) { return "__img:" + id; }
    function isImgSel(s) { return s && s.indexOf("__img:") === 0; }

    function saveLayout() {
      onLayoutChange(getLayout());
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

    function applyTextStyle(node, st) {
      node.textContent = st.content || "";
      node.style.left = st.x + "px";
      node.style.top = st.y + "px";
      node.style.fontSize = st.size + "px";
      node.style.color = st.color;
      node.style.fontWeight = st.bold ? "700" : "400";
      node.style.textAlign = st.align || "left";
      node.style.whiteSpace = "pre-wrap";
      node.style.wordBreak = "break-word";
      node.style.maxWidth = Math.max(40, (cardEl.clientWidth || 300) - st.x - 8) + "px";
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
        var raf = 0, nx = ox, ny = oy;
        function applyPos() {
          raf = 0;
          st.x = nx; st.y = ny;
          node.style.left = nx + "px";
          node.style.top = ny + "px";
        }
        function mv(e2) {
          var q = pxFromEvent(e2);
          nx = Math.round(ox + (q.clientX - sx));
          ny = Math.round(oy + (q.clientY - sy));
          var guides = guideForDrag(cardEl, node, nx, ny, snapExtraCardEls);
          showDragGuides(guides, nx, ny, node.offsetWidth, node.offsetHeight, isImage ? "center" : "center");
          if (!raf) raf = requestAnimationFrame(applyPos);
        }
        function up() {
          if (raf) cancelAnimationFrame(raf);
          applyPos();
          hideGuides();
          cardEl.classList.remove("is-dragging");
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
          nw = Math.max(16, Math.round(ow + (q.clientX - sx)));
          nh = Math.max(12, Math.round(oh + (q.clientY - sy)));
          var guides = guideForDrag(cardEl, wrap, im.x, im.y, snapExtraCardEls);
          showDragGuides(guides, im.x, im.y, nw, nh, "br");
          if (!raf) raf = requestAnimationFrame(applySize);
        }
        function up() {
          if (raf) cancelAnimationFrame(raf);
          applySize();
          hideGuides();
          cardEl.classList.remove("is-dragging");
          saveLayout();
        }
        handle.addEventListener("pointermove", mv);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
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
            if (!readOnly) attachDrag(node, st, false);
            else node.style.cursor = "default";
            cardEl.appendChild(node);
            textNodes[st.id] = node;
          }
          applyTextStyle(node, st);
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
      if (readOnly) cardEl.classList.add("print-readonly");
      else {
        cardEl.classList.add("design-mode");
        ensureGuideLayer();
      }
      built = true;
    }

    function renderCard() {
      ensureBuilt();
      syncNodes();
    }

    function invalidate() {
      built = false;
      textNodes = {};
      imgNodes = {};
      guideLayer = null;
      cardEl.innerHTML = "";
    }

    function bindBackDesignPanel(panel, panelIds) {
      if (!panel) return { showDesign: function () {} };
      panelIds = panelIds || {};
      function q(id, fallback) {
        return panel.querySelector("#" + (panelIds[id] || fallback));
      }
      var backDesContent = q("content", "backDesContent");
      var backDesSize = q("size", "backDesSize");
      var backDesSizeV = q("sizeV", "backDesSizeV");
      var backDesColor = q("color", "backDesColor");
      var backDesNorm = q("norm", "backDesNorm");
      var backDesBold = q("bold", "backDesBold");
      var designCtl = q("ctl", "backDesignCtl");
      var designNone = q("none", "backDesignNone");
      var alignAttr = panelIds.alignAttr || "data-back-al";

      function patchText(patch) {
        if (readOnly || !sel || isImgSel(sel)) return;
        var layout = getLayout();
        var st = (layout.texts || []).find(function (t) { return t.id === sel; });
        var node = textNodes[sel];
        if (!st || !node) return;
        Object.assign(st, patch);
        applyTextStyle(node, st);
        saveLayout();
      }

      function showDesign() {
        if (!designCtl || !designNone) return;
        if (!sel || isImgSel(sel)) {
          designCtl.style.display = "none";
          designNone.style.display = "";
          if (isImgSel(sel)) designNone.textContent = "画像が選択されています。ドラッグで移動、右下でサイズ変更できます。";
          else designNone.textContent = "テキストまたは画像をクリックして編集します。「＋テキスト」で自由入力の文字を追加できます。";
          return;
        }
        designNone.style.display = "none";
        designCtl.style.display = "";
        var layout = getLayout();
        var st = (layout.texts || []).find(function (t) { return t.id === sel; });
        if (!st) return;
        if (backDesContent) backDesContent.value = st.content || "";
        if (backDesSize) backDesSize.value = st.size;
        if (backDesSizeV) backDesSizeV.textContent = st.size + "px";
        if (backDesColor) backDesColor.value = st.color && st.color.length === 7 ? st.color : "#222222";
        if (backDesNorm) backDesNorm.classList.toggle("on", !st.bold);
        if (backDesBold) backDesBold.classList.toggle("on", !!st.bold);
        panel.querySelectorAll("[" + alignAttr + "]").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute(alignAttr) === st.align);
        });
      }

      if (backDesContent) backDesContent.addEventListener("input", function () {
        patchText({ content: this.value });
        showDesign();
      });
      if (backDesSize) backDesSize.addEventListener("input", function () {
        patchText({ size: +this.value });
        if (backDesSizeV) backDesSizeV.textContent = this.value + "px";
      });
      if (backDesColor) backDesColor.addEventListener("input", function () {
        patchText({ color: this.value });
      });
      if (backDesNorm) backDesNorm.addEventListener("click", function () {
        patchText({ bold: 0 }); showDesign();
      });
      if (backDesBold) backDesBold.addEventListener("click", function () {
        patchText({ bold: 1 }); showDesign();
      });
      panel.querySelectorAll("[" + alignAttr + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          patchText({ align: this.getAttribute(alignAttr) });
          showDesign();
        });
      });

      return { showDesign: showDesign };
    }

    return {
      renderCard: renderCard,
      invalidate: invalidate,
      bindBackDesignPanel: bindBackDesignPanel,
      clearSelection: function () { sel = null; updateSelectionHighlight(); },
      getSelection: function () { return sel; },
      setSelection: function (v) { sel = v; updateSelectionHighlight(); },
    };
  }

  window.MeishiBackCardUI = { createBackCardUI: createBackCardUI };
})();
