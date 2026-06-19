/**
 * file:// 対策: サーバー起動済みなら即転送、未起動なら案内のみ（アプリ JS は動かさない）
 */
(function () {
  if (location.protocol !== "file:") return;

  window.__MEISHI_BLOCKED = true;
  var page = (location.pathname || "").replace(/\\/g, "/").split("/").pop() || "owner.html";
  var appUrl = "http://127.0.0.1:8791/" + page;
  var label = page.indexOf("user") >= 0 ? "使用者画面" : "所有者設定";

  function showHelp() {
    document.open();
    document.write(
      "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"utf-8\" />" +
      "<title>名刺印刷システム</title>" +
      "<style>body{font-family:'Segoe UI','Meiryo',sans-serif;max-width:520px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.7}" +
      "h1{color:#2f5597;font-size:1.3rem}.btn{display:inline-block;margin:1rem 0;padding:14px 24px;background:#2f5597;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}" +
      "code{background:#eef2f7;padding:2px 6px;border-radius:4px}</style></head><body>" +
      "<h1>名刺印刷システム</h1>" +
      "<p><strong>" + label + "</strong> を開くには、先にローカルサーバーを起動してください。</p>" +
      "<p>次のいずれかを<strong>ダブルクリック</strong>してください。</p>" +
      "<ul><li><code>start.bat</code>（このフォルダまたは meishi-app フォルダ）</li>" +
      "<li><code>所有者を開く.bat</code> / <code>使用者を開く.bat</code></li></ul>" +
      "<a class=\"btn\" href=\"" + appUrl + "\">▶ サーバー起動後にこちら（" + appUrl + "）</a>" +
      "<p style=\"color:#666;font-size:.9rem\">サーバー起動後、このボタンで " + label + " が開きます。</p>" +
      "</body></html>"
    );
    document.close();
    try { window.stop(); } catch (e) {}
  }

  var x = new XMLHttpRequest();
  x.timeout = 2500;
  x.open("GET", "http://127.0.0.1:8791/data/meishi-records.json", true);
  x.onload = function () {
    if (x.status >= 200 && x.status < 400) location.replace(appUrl);
    else showHelp();
  };
  x.onerror = x.ontimeout = showHelp;
  try { x.send(); } catch (e) { showHelp(); }
})();
