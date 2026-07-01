/**
 * A4・名刺10面印刷（ラベル屋さん / エーワン 51003 相当）
 * 91×55mm × 2列×5段、上11mm・左14mm・等倍・余白0
 * 表面1ページ＋裏面1ページ（短辺とじ両面印刷用）
 */
(function (w) {
  "use strict";

  var SHEET_CLASS = "meishi-a4-sheet";
  var OVERLAY_CLASS = "meishi-a4-print-overlay";
  var BUNDLE_CLASS = "meishi-a4-print-bundle";

  /** @type {Readonly<{paperW:number,paperH:number,cardW:number,cardH:number,cols:number,rows:number,slots:number,marginTop:number,marginLeft:number,gapH:number,gapV:number,ref:string}>} */
  var LAYOUT = {
    paperW: 210,
    paperH: 297,
    cardW: 91,
    cardH: 55,
    cols: 2,
    rows: 5,
    slots: 10,
    marginTop: 11,
    marginLeft: 14,
    gapH: 0,
    gapV: 0,
    ref: "A-One 51003 / ラベル屋さん 名刺10面（91×55mm・2列×5段）",
  };

  function cloneCardStage(stageEl) {
    var wrap = document.createElement("div");
    wrap.className = "meishi-print-card-wrap";
    if (!stageEl) return wrap;
    var cards = stageEl.querySelectorAll(".meishi");
    if (!cards.length) return wrap;
    cards.forEach(function (card, i) {
      var c = card.cloneNode(true);
      c.classList.remove("sel", "is-editing");
      c.querySelectorAll(".sel, .is-editing").forEach(function (n) {
        n.classList.remove("sel", "is-editing");
      });
      if (i > 0) c.classList.add("meishi-overlay");
      wrap.appendChild(c);
    });
    return wrap;
  }

  function buildA4Sheet(stageEl, side) {
    var cardWrap = cloneCardStage(stageEl);
    var sheet = document.createElement("div");
    sheet.className = SHEET_CLASS;
    if (side === "back") sheet.classList.add("meishi-a4-sheet--duplex-back");
    else sheet.classList.add("meishi-a4-sheet--front");
    sheet.setAttribute("role", "document");
    sheet.setAttribute("aria-label", side === "back" ? "名刺印刷用 A4 裏面10面" : "名刺印刷用 A4 表面10面");

    var i;
    for (i = 0; i < LAYOUT.slots; i++) {
      var slot = document.createElement("div");
      slot.className = "meishi-print-slot";
      slot.appendChild(cardWrap.cloneNode(true));
      sheet.appendChild(slot);
    }
    return sheet;
  }

  function findPrintStages(areaEl) {
    var front = null;
    var back = null;
    if (!areaEl) return { front: front, back: back };

    var frontWrap = areaEl.querySelector("#pvFrontWrap");
    if (frontWrap) front = frontWrap.querySelector(".stage");
    if (!front) {
      var stack = areaEl.querySelector(".stage.stack");
      if (stack) front = stack;
      else front = areaEl.querySelector(".stage");
    }

    var backWrap = areaEl.querySelector("#pvBackWrap");
    if (backWrap) back = backWrap.querySelector(".stage");

    return { front: front, back: back };
  }

  function stageHasCard(stageEl) {
    return !!(stageEl && stageEl.querySelector(".meishi"));
  }

  function removeExistingOverlay(areaEl) {
    if (!areaEl) return;
    areaEl.querySelectorAll("." + OVERLAY_CLASS).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function hidePreviewBoxes(areaEl) {
    if (!areaEl) return;
    areaEl.querySelectorAll(".preview-scale-box").forEach(function (box) {
      box.setAttribute("data-meishi-print-hidden", "1");
    });
  }

  function showPreviewBoxes(areaEl) {
    if (!areaEl) return;
    areaEl.querySelectorAll(".preview-scale-box[data-meishi-print-hidden]").forEach(function (box) {
      box.removeAttribute("data-meishi-print-hidden");
    });
  }

  function buildPrintBundle(areaEl) {
    var stages = findPrintStages(areaEl);
    if (!stageHasCard(stages.front)) return null;

    var bundle = document.createElement("div");
    bundle.className = OVERLAY_CLASS + " " + BUNDLE_CLASS;
    bundle.appendChild(buildA4Sheet(stages.front, "front"));

    if (stageHasCard(stages.back)) {
      bundle.appendChild(buildA4Sheet(stages.back, "back"));
    }

    return bundle;
  }

  /**
   * @param {string|HTMLElement} printAreaIdOrEl printArea 要素
   * @param {{beforePrint?:Function,afterPrint?:Function}} [opts]
   */
  function printFromArea(printAreaIdOrEl, opts) {
    opts = opts || {};
    var area = typeof printAreaIdOrEl === "string"
      ? document.getElementById(printAreaIdOrEl)
      : printAreaIdOrEl;
    if (!area) {
      w.print();
      return;
    }

    var bundle = buildPrintBundle(area);
    if (!bundle) {
      w.print();
      return;
    }

    removeExistingOverlay(area);
    area.appendChild(bundle);
    area.classList.add("meishi-print-area--sheet");
    hidePreviewBoxes(area);

    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      removeExistingOverlay(area);
      showPreviewBoxes(area);
      area.classList.remove("meishi-print-area--sheet");
      if (typeof opts.afterPrint === "function") opts.afterPrint();
    }

    if (typeof opts.beforePrint === "function") opts.beforePrint();

    w.addEventListener("afterprint", cleanup);
    w.print();
    setTimeout(cleanup, 1500);
  }

  w.MeishiPrintSheet = {
    LAYOUT: LAYOUT,
    buildA4Sheet: buildA4Sheet,
    buildPrintBundle: buildPrintBundle,
    printFromArea: printFromArea,
    printHint: "印刷設定: 用紙 A4／倍率 100%／余白 なし／背景のグラフィック ON。両面印刷時は1枚目＝表面・2枚目＝裏面。用紙を短辺とじで裏返してから2枚目を印刷してください。",
    duplexHint: "両面印刷: 1枚目（表面）印刷後、用紙を短辺とじで裏返し、2枚目（裏面）を印刷すると表裏が1枚の名刺に揃います。",
  };
})(typeof window !== "undefined" ? window : this);
