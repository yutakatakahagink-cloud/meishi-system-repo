/**
 * owner.html / user.html 用ランチャー
 * - file:// … 起動案内のみ（アプリ JS は読み込まない）
 * - http(s):// … 本体ページへ転送
 */
(function () {
  var script = document.currentScript;
  var appPage = (script && script.getAttribute("data-app")) || "owner-app.html";
  var label = (script && script.getAttribute("data-label")) || "アプリ";
  var serverBase = "http://127.0.0.1:8791/";
  var appUrl = serverBase + appPage;

  if (location.protocol === "http:" || location.protocol === "https:") {
    var here = (location.pathname || "").replace(/\\/g, "/").split("/").pop() || "";
    if (here !== appPage) {
      location.replace(appPage + location.search + location.hash);
    }
    return;
  }

  if (location.protocol !== "file:") return;

  document.open();
  document.write(
    "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"utf-8\" />" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />" +
    "<title>名刺印刷システム — 起動</title>" +
    "<style>body{font-family:'Segoe UI','Meiryo',sans-serif;max-width:560px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.7;color:#222}" +
    "h1{font-size:1.35rem;color:#2f5597}code{background:#eef2f7;padding:2px 6px;border-radius:4px}" +
    ".btn{display:inline-block;margin:1rem 0;background:#2f5597;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600}" +
    ".btn:hover{background:#21406f}.status{margin:1rem 0;padding:12px;background:#fff8e6;border:1px solid #f0d78c;border-radius:8px;font-size:.92rem}" +
    ".note{color:#666;font-size:.9rem}</style></head><body>" +
    "<h1>名刺印刷システム</h1>" +
    "<p><strong>" + label + "</strong> を開くにはローカルサーバーが必要です。</p>" +
    "<div class=\"status\" id=\"st\">① <code>meishi-app\\start.bat</code> をダブルクリックしてサーバーを起動してください。</div>" +
    "<ol><li><code>meishi-app</code> フォルダの <code>start.bat</code> を実行</li>" +
    "<li>または <code>所有者を開く.bat</code> / <code>使用者を開く.bat</code> を実行</li>" +
    "<li>起動後、自動で画面が切り替わります（最大30秒）</li></ol>" +
    "<a class=\"btn\" id=\"openBtn\" href=\"" + appUrl + "\">▶ " + label + " を開く</a>" +
    "<p class=\"note\">URL: <a href=\"" + appUrl + "\">" + appUrl + "</a></p>" +
    "<script src=\"meishi-launch-poll.js\" data-app=\"" + appPage + "\"><\/script>" +
    "</body></html>"
  );
  document.close();
})();
