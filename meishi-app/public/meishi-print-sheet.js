/**
 * A4・名刺10面印刷（ラベル屋さん / エーワン 51003 相当）
 * 91×55mm × 2列×5段、上11mm・左14mm・等倍・余白0
 */
(function (w) {
  "use strict";

  var SHEET_CLASS = "meishi-a4-sheet";
  var OVERLAY_CLASS = "meishi-a4-print-overlay";

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
      c.classList.remove("sel");
      c.querySelectorAll(".sel").forEach(function (n) { n.classList.remove("sel"); });
      if (i > 0) c.classList.add("meishi-overlay");
      wrap.appendChild(c);
    });
    return wrap;
  }

  function buildA4Sheet(stageEl) {
    var cardWrap = cloneCardStage(stageEl);
    var sheet = document.createElement("div");
    sheet.className = SHEET_CLASS + " " + OVERLAY_CLASS;
    sheet.setAttribute("role", "document");
    sheet.setAttribute("aria-label", "名刺印刷用 A4 10面");

    var i;
    for (i = 0; i < LAYOUT.slots; i++) {
      var slot = document.createElement("div");
      slot.className = "meishi-print-slot";
      slot.appendChild(cardWrap.cloneNode(true));
      sheet.appendChild(slot);
    }
    return sheet;
  }

  function findStageInArea(areaEl) {
    if (!areaEl) return null;
    var stack = areaEl.querySelector(".stage.stack");
    if (stack) return stack;
    return areaEl.querySelector(".stage");
  }

  function removeExistingOverlay(areaEl) {
    if (!areaEl) return;
    areaEl.querySelectorAll("." + OVERLAY_CLASS).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
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
    var stage = findStageInArea(area);
    if (!stage || !stage.querySelector(".meishi")) {
      w.print();
      return;
    }

    removeExistingOverlay(area);
    var sheet = buildA4Sheet(stage);
    area.appendChild(sheet);
    area.classList.add("meishi-print-area--sheet");
    stage.setAttribute("data-meishi-print-hidden", "1");

    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      removeExistingOverlay(area);
      stage.removeAttribute("data-meishi-print-hidden");
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
    printFromArea: printFromArea,
    printHint: "印刷設定: 用紙 A4／倍率 100%（拡大縮小なし）／余白 なし／背景のグラフィック ON",
  };
})(typeof window !== "undefined" ? window : this);
