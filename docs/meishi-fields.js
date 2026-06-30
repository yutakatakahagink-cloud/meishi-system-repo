/**
 * 名刺 Excel 列定義・マージ（全社→部署→個人）
 */
(function () {
  var COLUMNS = [
    { key: "no", label: "番号" },
    { key: "name", label: "氏名" },
    { key: "company", label: "会社・団体名" },
    { key: "aff1", label: "所属1" },
    { key: "aff2", label: "所属2" },
    { key: "aff3", label: "所属3" },
    { key: "title", label: "役職" },
    { key: "qual", label: "資格" },
    { key: "mobile", label: "携帯" },
    { key: "email", label: "メール" },
    { key: "postal", label: "郵便番号" },
    { key: "address", label: "住所" },
    { key: "tel", label: "TEL" },
    { key: "fax", label: "FAX" },
    { key: "url", label: "URL" },
    { key: "note", label: "備考" },
    { key: "category", label: "区分" },
  ];
  var SHARED_KEYS = ["company", "url", "postal", "address", "tel", "fax"];
  var DEPT_KEYS = ["postal", "address", "tel", "fax", "logo"];

  function deptKey(company, aff1, aff2) {
    return [company, aff1, aff2].map(function (v) { return String(v || "").trim(); }).join("|");
  }
  function emptyRecord() {
    var o = {};
    COLUMNS.forEach(function (c) { o[c.key] = ""; });
    return o;
  }
  function norm(v) {
    return v == null ? "" : String(v).trim();
  }
  function overlay(base, over) {
    var o = Object.assign({}, base || {});
    if (!over) return o;
    Object.keys(over).forEach(function (k) {
      if (over[k] != null && String(over[k]).trim() !== "") o[k] = String(over[k]).trim();
    });
    return o;
  }
  function mergeRecord(rec, companySettings, deptSettings) {
    var c = (companySettings || {})[norm(rec.company)] || {};
    var dCommon = (deptSettings || {})[deptKey(rec.company, rec.aff1, "")] || {};
    var d = (deptSettings || {})[deptKey(rec.company, rec.aff1, rec.aff2)] || {};
    return overlay(overlay(overlay(c, dCommon), d), rec);
  }
  function uniq(arr) {
    var s = [];
    arr.forEach(function (x) {
      x = norm(x);
      if (x && s.indexOf(x) < 0) s.push(x);
    });
    return s;
  }

  window.MeishiFields = {
    COLUMNS: COLUMNS,
    SHARED_KEYS: SHARED_KEYS,
    DEPT_KEYS: DEPT_KEYS,
    deptKey: deptKey,
    emptyRecord: emptyRecord,
    mergeRecord: mergeRecord,
    overlay: overlay,
    norm: norm,
    uniq: uniq,
  };
})();
