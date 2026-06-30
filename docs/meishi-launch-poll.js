(function () {
  var script = document.currentScript;
  var appPage = (script && script.getAttribute("data-app")) || "owner-app.html";
  var appUrl = "http://127.0.0.1:8791/" + appPage;
  var label = appPage.indexOf("user") >= 0 ? "使用者画面" : "所有者設定";
  var st = document.getElementById("st");
  var tries = 0;
  var maxTries = 20;

  function setStatus(msg) {
    if (st) st.textContent = msg;
  }

  function retry() {
    if (tries >= maxTries) {
      setStatus("サーバーが見つかりません。start.bat を実行してから「" + label + " を開く」を押してください。");
      return;
    }
    setStatus("サーバー待機中… (" + tries + "/" + maxTries + ") start.bat を実行してください。");
    setTimeout(probe, 1500);
  }

  function probe() {
    tries++;
    var x = new XMLHttpRequest();
    x.timeout = 2000;
    x.open("GET", "http://127.0.0.1:8791/data/meishi-records.json", true);
    x.onload = function () {
      if (x.status >= 200 && x.status < 400) {
        setStatus("サーバーを検出しました。" + label + " を開きます…");
        location.replace(appUrl);
        return;
      }
      retry();
    };
    x.onerror = x.ontimeout = retry;
    try { x.send(); } catch (e) { retry(); }
  }

  setTimeout(probe, 800);
})();
