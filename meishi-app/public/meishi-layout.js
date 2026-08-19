/**
 * 名刺レイアウト共通定義（使用者・所有者で共有）
 */
(function () {
  var ELS = [
    { id: "company", label: "会社・団体名", def: { x: 48, y: 8, size: 13, color: "#1f3a6e", bg: "", bold: 1, align: "left" } },
    { id: "aff", label: "所属", def: { x: 48, y: 30, size: 9, color: "#222", bg: "", bold: 0, align: "left" } },
    { id: "title", label: "役職", def: { x: 48, y: 42, size: 9, color: "#222", bg: "", bold: 0, align: "left" } },
    { id: "name", label: "氏名", def: { x: 48, y: 48, size: 22, color: "#000", bg: "", bold: 0, align: "left" } },
    { id: "qual", label: "資格", def: { x: 48, y: 86, size: 8, color: "#555", bg: "", bold: 0, align: "left" } },
    { id: "koji", label: "工事件名", def: { x: 14, y: 100, size: 8, color: "#b3261e", bg: "", bold: 0, align: "left" } },
    { id: "address", label: "住所", def: { x: 175, y: 120, size: 8, color: "#222", bg: "", bold: 0, align: "left" } },
    { id: "telfax", label: "TEL/FAX", def: { x: 175, y: 134, size: 8, color: "#222", bg: "", bold: 0, align: "left" } },
    { id: "mobile", label: "携帯", def: { x: 175, y: 148, size: 8, color: "#222", bg: "", bold: 0, align: "left" } },
    { id: "email", label: "メール", def: { x: 175, y: 162, size: 8, color: "#222", bg: "", bold: 0, align: "left" } },
    { id: "url", label: "URL", def: { x: 175, y: 176, size: 8, color: "#222", bg: "", bold: 0, align: "left" } },
  ];
  var LK = "meishi_layout_v1";

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function defLayout() {
    var o = { el: {}, images: [], texts: [], shapes: [], centerShiftMm: 5, centerDivider: true };
    ELS.forEach(function (e) { o.el[e.id] = clone(e.def); });
    return o;
  }
  function loadLocal(key) {
    try {
      var s = localStorage.getItem(key || LK);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  }
  function saveLocal(layout, key) {
    try { localStorage.setItem(key || LK, JSON.stringify(layout)); } catch (e) {}
  }
  function isValidLayout(v) {
    return v && typeof v === "object" && v.el && typeof v.el === "object";
  }

  function defTextBlock(index) {
    var i = index || 0;
    return {
      id: "txt" + Date.now() + i,
      content: "テキスト",
      x: 20 + i * 8,
      y: 20 + i * 8,
      size: 12,
      color: "#222222",
      bg: "",
      bold: 0,
      italic: 0,
      underline: 0,
      ulLen: 0,
      ulThick: 5,
      ulThickUnit: "em",
      ulStyle: "solid",
      ulColor: "",
      font: "",
      align: "left",
      lineHeight: 1.3,
      z: 20 + i,
      fixed: 0,
    };
  }

  function defFixedTextBlock(index) {
    var t = defTextBlock(index);
    t.content = "固定項目";
    t.fixed = 1;
    return t;
  }

  var EXTRA_FIELD_KINDS = [
    { id: "address", label: "住所", elId: "address", placeholder: "住所" },
    { id: "telfax", label: "TEL・FAX", elId: "telfax", placeholder: "TEL / FAX" },
  ];

  function extraFieldMeta(kind) {
    var id = String(kind || "");
    for (var i = 0; i < EXTRA_FIELD_KINDS.length; i++) {
      if (EXTRA_FIELD_KINDS[i].id === id) return EXTRA_FIELD_KINDS[i];
    }
    return null;
  }

  function defExtraFieldBlock(kind, index, styleSrc) {
    var meta = extraFieldMeta(kind) || EXTRA_FIELD_KINDS[0];
    var t = defTextBlock(index);
    t.field = meta.id;
    t.fixed = 1;
    t.content = meta.placeholder;
    if (styleSrc && typeof styleSrc === "object") {
      if (typeof styleSrc.size === "number") t.size = styleSrc.size;
      if (styleSrc.color) t.color = styleSrc.color;
      if (styleSrc.bold != null) t.bold = styleSrc.bold ? 1 : 0;
      if (styleSrc.font != null) t.font = styleSrc.font;
      if (styleSrc.align) t.align = styleSrc.align;
      if (typeof styleSrc.x === "number") t.x = styleSrc.x;
      if (typeof styleSrc.y === "number") t.y = styleSrc.y + Math.max(12, Math.round((styleSrc.size || 9) * 1.4));
    }
    return t;
  }

  var BACK_FONTS = [
    { id: "", label: "標準" },
    { id: "gothic", label: "ゴシック" },
    { id: "mincho", label: "明朝" },
    { id: "yu-gothic", label: "游ゴシック" },
    { id: "yu-mincho", label: "游明朝" },
    { id: "meiryo", label: "メイリオ" },
    { id: "meiryo-ui", label: "Meiryo UI" },
    { id: "yu-gothic-ui", label: "Yu Gothic UI" },
    { id: "ms-gothic", label: "ＭＳ ゴシック" },
    { id: "ms-mincho", label: "ＭＳ 明朝" },
    { id: "ms-pgothic", label: "ＭＳ Ｐゴシック" },
    { id: "ms-pmincho", label: "ＭＳ Ｐ明朝" },
    { id: "biz-udgothic", label: "BIZ UDゴシック" },
    { id: "biz-udmincho", label: "BIZ UD明朝" },
    { id: "ud-digi", label: "UDデジタル教科書体" },
    { id: "hiragino-sans", label: "ヒラギノ角ゴ" },
    { id: "hiragino-mincho", label: "ヒラギノ明朝" },
    { id: "arial", label: "Arial" },
    { id: "arial-black", label: "Arial Black" },
    { id: "helvetica", label: "Helvetica" },
    { id: "times", label: "Times New Roman" },
    { id: "georgia", label: "Georgia" },
    { id: "courier", label: "Courier New" },
    { id: "consolas", label: "Consolas" },
    { id: "segoe", label: "Segoe UI" },
    { id: "verdana", label: "Verdana" },
    { id: "tahoma", label: "Tahoma" },
    { id: "trebuchet", label: "Trebuchet MS" },
    { id: "impact", label: "Impact" },
  ];

  var FONT_FAMILY_MAP = {
    "": '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
    gothic: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
    mincho: '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif',
    "yu-gothic": '"Yu Gothic", "YuGothic", "Hiragino Sans", "Meiryo", sans-serif',
    "yu-mincho": '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "MS PMincho", serif',
    meiryo: 'Meiryo, "メイリオ", "Hiragino Sans", sans-serif',
    "meiryo-ui": '"Meiryo UI", Meiryo, "メイリオ", sans-serif',
    "yu-gothic-ui": '"Yu Gothic UI", "Yu Gothic", "Meiryo UI", sans-serif',
    "ms-gothic": '"MS Gothic", "ＭＳ ゴシック", "MS PGothic", monospace',
    "ms-mincho": '"MS Mincho", "ＭＳ 明朝", "MS PMincho", serif',
    "ms-pgothic": '"MS PGothic", "ＭＳ Ｐゴシック", "MS Gothic", sans-serif',
    "ms-pmincho": '"MS PMincho", "ＭＳ Ｐ明朝", "MS Mincho", serif',
    "biz-udgothic": '"BIZ UDGothic", "BIZ UDPGothic", "Yu Gothic", sans-serif',
    "biz-udmincho": '"BIZ UDMincho", "BIZ UDPMincho", "Yu Mincho", serif',
    "ud-digi": '"UD Digi Kyokasho N-R", "UD Digi Kyokasho NK-R", "Yu Gothic", sans-serif',
    "hiragino-sans": '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    "hiragino-mincho": '"Hiragino Mincho ProN", "Hiragino Mincho Pro", "Yu Mincho", serif',
    arial: 'Arial, Helvetica, sans-serif',
    "arial-black": '"Arial Black", Arial, sans-serif',
    helvetica: 'Helvetica, Arial, sans-serif',
    times: '"Times New Roman", Times, serif',
    georgia: 'Georgia, "Times New Roman", serif',
    courier: '"Courier New", Courier, monospace',
    consolas: 'Consolas, "Courier New", monospace',
    segoe: '"Segoe UI", Tahoma, sans-serif',
    verdana: 'Verdana, Geneva, sans-serif',
    tahoma: 'Tahoma, "Segoe UI", sans-serif',
    trebuchet: '"Trebuchet MS", Tahoma, sans-serif',
    impact: 'Impact, Haettenschweiler, sans-serif',
  };

  function resolveBackFontFamily(fontId) {
    var key = fontId == null ? "" : String(fontId);
    if (Object.prototype.hasOwnProperty.call(FONT_FAMILY_MAP, key)) {
      return FONT_FAMILY_MAP[key];
    }
    return FONT_FAMILY_MAP[""];
  }

  function fillFontSelect(sel, currentId) {
    if (!sel) return;
    var cur = currentId == null ? "" : String(currentId);
    if (!sel._meishiFontsFilled) {
      sel.innerHTML = BACK_FONTS.map(function (f) {
        return '<option value="' + String(f.id).replace(/"/g, "&quot;") + '">' + f.label + "</option>";
      }).join("");
      sel._meishiFontsFilled = true;
    }
    if (cur && !BACK_FONTS.some(function (f) { return f.id === cur; })) {
      var opt = document.createElement("option");
      opt.value = cur;
      opt.textContent = cur;
      sel.appendChild(opt);
    }
    sel.value = cur;
  }

  function normalizeBg(bg) {
    var v = bg == null ? "" : String(bg).trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase();
    return "";
  }

  function applyTextBgStyle(node, st) {
    if (!node) return;
    var bg = normalizeBg(st && st.bg);
    if (bg) {
      node.style.backgroundColor = bg;
      node.setAttribute("data-has-bg", "1");
    } else {
      node.style.backgroundColor = "transparent";
      node.removeAttribute("data-has-bg");
    }
  }

  function defBackLayout() {
    return { texts: [], images: [], shapes: [], centerShiftMm: 5, centerDivider: false };
  }

  var SHAPE_KINDS = [
    { id: "rect", label: "四角形" },
    { id: "roundRect", label: "角丸四角形" },
    { id: "ellipse", label: "楕円" },
    { id: "line", label: "直線" },
    { id: "arrow", label: "矢印" },
  ];

  function defShape(kind, i) {
    var k = String(kind || "rect");
    if (!SHAPE_KINDS.some(function (s) { return s.id === k; })) k = "rect";
    var lineLike = k === "line" || k === "arrow";
    return {
      id: "shp" + Date.now() + (i || 0),
      kind: k,
      x: 28 + (i || 0) * 8,
      y: 28 + (i || 0) * 8,
      w: lineLike ? 90 : 72,
      h: lineLike ? 12 : 40,
      fill: lineLike ? "" : "#dbe6f5",
      stroke: "#2f5597",
      strokeW: lineLike ? 2 : 1.5,
      z: 4 + (i || 0),
    };
  }

  function normalizeShape(sh, i) {
    if (!sh || typeof sh !== "object") return defShape("rect", i);
    var kinds = SHAPE_KINDS.map(function (s) { return s.id; });
    var kind = String(sh.kind || "rect");
    if (kinds.indexOf(kind) < 0) kind = "rect";
    var lineLike = kind === "line" || kind === "arrow";
    var fill = sh.fill == null ? (lineLike ? "" : "#dbe6f5") : String(sh.fill).trim();
    if (fill && !/^#[0-9A-Fa-f]{6}$/.test(fill) && fill !== "none") fill = lineLike ? "" : "#dbe6f5";
    if (fill === "none") fill = "";
    var stroke = String(sh.stroke || "#2f5597").trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(stroke)) stroke = "#2f5597";
    var sw = Number(sh.strokeW);
    if (!isFinite(sw) || sw < 0) sw = lineLike ? 2 : 1.5;
    sw = Math.max(0, Math.min(12, Math.round(sw * 10) / 10));
    return {
      id: sh.id || ("shp" + Date.now() + i),
      kind: kind,
      x: typeof sh.x === "number" ? sh.x : 28,
      y: typeof sh.y === "number" ? sh.y : 28,
      w: typeof sh.w === "number" ? Math.max(8, sh.w) : (lineLike ? 90 : 72),
      h: typeof sh.h === "number" ? Math.max(4, sh.h) : (lineLike ? 12 : 40),
      fill: fill,
      stroke: stroke,
      strokeW: sw,
      z: isFinite(Number(sh.z)) ? Math.round(Number(sh.z)) : 4,
    };
  }

  function shapeSvgInner(st) {
    var w = Math.max(8, Number(st.w) || 72);
    var h = Math.max(4, Number(st.h) || 40);
    var fill = st.fill ? String(st.fill) : "none";
    var stroke = st.stroke || "#2f5597";
    var sw = Math.max(0.5, Number(st.strokeW) || 1.5);
    var kind = st.kind || "rect";
    var common = ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" vector-effect="non-scaling-stroke"';
    if (kind === "ellipse") {
      return '<ellipse cx="' + (w / 2) + '" cy="' + (h / 2) + '" rx="' + Math.max(1, w / 2 - sw) + '" ry="' + Math.max(1, h / 2 - sw) + '"' + common + " />";
    }
    if (kind === "roundRect") {
      var rx = Math.min(12, Math.min(w, h) * 0.18);
      return '<rect x="' + sw + '" y="' + sw + '" width="' + Math.max(1, w - sw * 2) + '" height="' + Math.max(1, h - sw * 2) + '" rx="' + rx + '"' + common + " />";
    }
    if (kind === "line" || kind === "arrow") {
      var y = h / 2;
      var x1 = sw;
      var x2 = Math.max(x1 + 1, w - sw);
      var line = '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" vector-effect="non-scaling-stroke" />';
      if (kind === "arrow") {
        var ah = Math.max(4, Math.min(10, h * 0.45));
        var aw = Math.max(6, Math.min(14, w * 0.12));
        line += '<polygon points="' + x2 + "," + y + " " + (x2 - aw) + "," + (y - ah) + " " + (x2 - aw) + "," + (y + ah) + '" fill="' + stroke + '" stroke="none" />';
      }
      return line;
    }
    return '<rect x="' + sw + '" y="' + sw + '" width="' + Math.max(1, w - sw * 2) + '" height="' + Math.max(1, h - sw * 2) + '"' + common + " />";
  }

  function pickShapeKind(cb) {
    var overlay = document.createElement("div");
    overlay.className = "cat-modal";
    overlay.innerHTML = "<div class='cat-modal-dialog' role='dialog' aria-modal='true'><h3>図形を挿入</h3>" +
      "<p class='hint' style='margin:0 0 10px'>Excelと同様に四角形・楕円・線・矢印を名刺へ置けます。配置後にドラッグと右下のハンドルでサイズを変えられます。</p>" +
      "<div class='shape-pick-grid'>" +
      SHAPE_KINDS.map(function (k) {
        return "<button type='button' class='btn sm ghost' data-kind='" + k.id + "'>" + k.label + "</button>";
      }).join("") +
      "</div><div class='btn-row'><button type='button' class='btn sm ghost' data-cancel>キャンセル</button></div></div>";
    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) { close(); return; }
      var cancel = ev.target.closest("[data-cancel]");
      if (cancel) { close(); return; }
      var btn = ev.target.closest("[data-kind]");
      if (btn) {
        var kind = btn.getAttribute("data-kind");
        close();
        if (typeof cb === "function") cb(kind);
      }
    });
    document.body.appendChild(overlay);
  }

  function pickExtraField(getChoices, cb) {
    var overlay = document.createElement("div");
    overlay.className = "cat-modal";
    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function showKinds() {
      overlay.innerHTML = "<div class='cat-modal-dialog' role='dialog' aria-modal='true'><h3>項目を追加</h3>" +
        "<p class='hint' style='margin:0 0 10px'>氏名が変わっても同じ内容で出す住所・TEL/FAXを追加します。配置と文言は共通デザインに保存されます。</p>" +
        "<div class='shape-pick-grid'>" +
        EXTRA_FIELD_KINDS.map(function (k) {
          return "<button type='button' class='btn sm ghost' data-kind='" + k.id + "'>" + k.label + "</button>";
        }).join("") +
        "</div><div class='btn-row'><button type='button' class='btn sm ghost' data-cancel>キャンセル</button></div></div>";
    }
    function showValues(kind) {
      var meta = extraFieldMeta(kind) || { id: kind, label: kind, placeholder: kind };
      var choices = [];
      try { choices = (typeof getChoices === "function" ? getChoices(kind) : []) || []; } catch (e) { choices = []; }
      var listHtml = choices.length
        ? choices.map(function (v, i) {
            return "<button type='button' class='btn sm ghost' data-val='" + i + "'>" + String(v).replace(/</g, "&lt;") + "</button>";
          }).join("")
        : "<p class='hint' style='margin:0'>マスタに候補がありません。下に直接入力してください。</p>";
      overlay.innerHTML = "<div class='cat-modal-dialog' role='dialog' aria-modal='true'><h3>固定する" + meta.label + "</h3>" +
        "<p class='hint' style='margin:0 0 10px'>表示する内容を選ぶか、入力してください。名刺上で後から直せます。</p>" +
        "<div class='shape-pick-grid' style='max-height:220px;overflow:auto'>" + listHtml + "</div>" +
        "<div class='field' style='margin-top:10px'><label>手入力</label><input type='text' id='extraFieldCustom' placeholder='" + meta.placeholder + "' /></div>" +
        "<div class='btn-row'>" +
        "<button type='button' class='btn sm ghost' data-back>戻る</button>" +
        "<button type='button' class='btn sm' data-custom>この内容で追加</button>" +
        "<button type='button' class='btn sm ghost' data-cancel>キャンセル</button>" +
        "</div></div>";
      overlay._extraKind = kind;
      overlay._extraChoices = choices;
    }
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) { close(); return; }
      if (ev.target.closest("[data-cancel]")) { close(); return; }
      if (ev.target.closest("[data-back]")) { showKinds(); return; }
      var kindBtn = ev.target.closest("[data-kind]");
      if (kindBtn) { showValues(kindBtn.getAttribute("data-kind")); return; }
      var valBtn = ev.target.closest("[data-val]");
      if (valBtn) {
        var idx = Number(valBtn.getAttribute("data-val"));
        var val = (overlay._extraChoices || [])[idx] || "";
        var kind = overlay._extraKind;
        close();
        if (typeof cb === "function") cb(kind, val);
        return;
      }
      if (ev.target.closest("[data-custom]")) {
        var inp = overlay.querySelector("#extraFieldCustom");
        var kind2 = overlay._extraKind;
        var typed = inp ? String(inp.value || "").trim() : "";
        var meta2 = extraFieldMeta(kind2);
        close();
        if (typeof cb === "function") cb(kind2, typed || (meta2 && meta2.placeholder) || "");
      }
    });
    showKinds();
    document.body.appendChild(overlay);
  }

  function isValidBackLayout(v) {
    return v && typeof v === "object" && Array.isArray(v.texts) && Array.isArray(v.images);
  }

  window.MeishiLayout = {
    ELS: ELS,
    LK: LK,
    clone: clone,
    defLayout: defLayout,
    defBackLayout: defBackLayout,
    defTextBlock: defTextBlock,
    defFixedTextBlock: defFixedTextBlock,
    EXTRA_FIELD_KINDS: EXTRA_FIELD_KINDS,
    extraFieldMeta: extraFieldMeta,
    defExtraFieldBlock: defExtraFieldBlock,
    pickExtraField: pickExtraField,
    SHAPE_KINDS: SHAPE_KINDS,
    defShape: defShape,
    normalizeShape: normalizeShape,
    shapeSvgInner: shapeSvgInner,
    pickShapeKind: pickShapeKind,
    BACK_FONTS: BACK_FONTS,
    resolveBackFontFamily: resolveBackFontFamily,
    fillFontSelect: fillFontSelect,
    normalizeBg: normalizeBg,
    applyTextBgStyle: applyTextBgStyle,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    isValidLayout: isValidLayout,
    isValidBackLayout: isValidBackLayout,
  };
})();
