/**
 * 名刺レイアウト共通定義（使用者・所有者で共有）
 */
(function () {
  var ELS = [
    { id: "company", label: "会社・団体名", def: { x: 48, y: 8, size: 13, color: "#1f3a6e", bold: 1, align: "left" } },
    { id: "aff", label: "所属・役職", def: { x: 48, y: 30, size: 9, color: "#222", bold: 0, align: "left" } },
    { id: "name", label: "氏名", def: { x: 48, y: 48, size: 22, color: "#000", bold: 0, align: "left" } },
    { id: "qual", label: "資格", def: { x: 48, y: 86, size: 8, color: "#555", bold: 0, align: "left" } },
    { id: "koji", label: "工事件名", def: { x: 14, y: 100, size: 8, color: "#b3261e", bold: 0, align: "left" } },
    { id: "address", label: "住所", def: { x: 175, y: 120, size: 8, color: "#222", bold: 0, align: "left" } },
    { id: "telfax", label: "TEL/FAX", def: { x: 175, y: 134, size: 8, color: "#222", bold: 0, align: "left" } },
    { id: "mobile", label: "携帯", def: { x: 175, y: 148, size: 8, color: "#222", bold: 0, align: "left" } },
    { id: "email", label: "メール", def: { x: 175, y: 162, size: 8, color: "#222", bold: 0, align: "left" } },
    { id: "url", label: "URL", def: { x: 175, y: 176, size: 8, color: "#222", bold: 0, align: "left" } },
  ];
  var LK = "meishi_layout_v1";

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function defLayout() {
    var o = { el: {}, images: [] };
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

  window.MeishiLayout = {
    ELS: ELS,
    LK: LK,
    clone: clone,
    defLayout: defLayout,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    isValidLayout: isValidLayout,
  };
})();
