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
    var o = { el: {}, images: [], texts: [], centerShiftMm: 5, centerDivider: true };
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
      font: "",
      align: "left",
      z: 20 + i,
    };
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
    return { texts: [], images: [], centerShiftMm: 5, centerDivider: false };
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
