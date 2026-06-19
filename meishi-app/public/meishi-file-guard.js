/**
 * file:// で開いた場合、ローカルサーバーへ即転送（本体は http 経由でのみ動作）
 */
(function () {
  if (location.protocol !== "file:") return;
  var page = (location.pathname || "").replace(/\\/g, "/").split("/").pop() || "index.html";
  if (!/\.html$/i.test(page)) page = "index.html";
  location.replace("http://127.0.0.1:8791/" + page);
})();
