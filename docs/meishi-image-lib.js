/**
 * 画像フォルダ（images/）と画像保存ボックス（config.imageLibrary）の選択・URL解決
 */
(function () {
  var manifest = null;
  var manifestPromise = null;
  var modalEl = null;

  function assetUrl(relPath) {
    var rel = String(relPath || "").replace(/^\//, "");
    var path = window.location.pathname || "/";
    var dir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
    if (dir === "") dir = "/";
    return window.location.origin + dir + rel;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function itemUrl(item) {
    if (!item) return "";
    var src = String(item.src || "");
    if (src.indexOf("data:") === 0 || src.indexOf("http") === 0 || src.indexOf("blob:") === 0) return src;
    if (item.path) return assetUrl(item.path);
    if (item.file) return entryUrl(item);
    return "";
  }

  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(assetUrl("images/manifest.json"), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        manifest = data && Array.isArray(data.items) ? data : { items: [] };
        return manifest;
      })
      .catch(function () {
        manifest = { items: [] };
        return manifest;
      });
    return manifestPromise;
  }

  function entryUrl(item) {
    return assetUrl("images/" + String(item.file || "").replace(/^\//, ""));
  }

  function resolveImages(images) {
    return (images || []).map(function (im) {
      if (!im) return null;
      var o = Object.assign({}, im);
      if (o.src && o.src.indexOf("data:") === 0) return o;
      if (o.path) o.src = assetUrl(o.path);
      else if (o.src && o.src.indexOf("images/") === 0) o.src = assetUrl(o.src);
      return o.src ? o : null;
    }).filter(Boolean);
  }

  function createDefaultImage(item, index, prefix) {
    var i = index || 0;
    var out = {
      id: (prefix || "img") + Date.now() + i,
      src: itemUrl(item),
      x: 20 + i * 10,
      y: 8,
      w: 80,
      h: 44,
    };
    if (item.path) out.path = item.path;
    else if (item.file && String(item.src || "").indexOf("data:") !== 0) {
      out.path = "images/" + String(item.file).replace(/^\//, "").replace(/^images\//, "");
    }
    return out;
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.id = "meishiImgPickerModal";
    modalEl.className = "img-picker-modal";
    modalEl.hidden = true;
    modalEl.innerHTML =
      '<div class="img-picker-dialog">' +
      '<h3 id="meishiImgPickerTitle">画像を選択</h3>' +
      '<p class="hint" id="meishiImgPickerHint"></p>' +
      '<div class="img-picker-grid" id="meishiImgPickerGrid"></div>' +
      '<div class="btn-row" style="justify-content:flex-end;margin-top:12px">' +
      '<button type="button" class="btn sm ghost" id="meishiImgPickerCancel">キャンセル</button>' +
      '<button type="button" class="btn sm" id="meishiImgPickerOk">追加</button>' +
      "</div></div>";
    document.body.appendChild(modalEl);
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) closeModal();
    });
    modalEl.querySelector("#meishiImgPickerCancel").onclick = closeModal;
    return modalEl;
  }

  var pickCb = null;
  var pickItems = [];
  var selectedIds = {};

  function closeModal() {
    if (modalEl) modalEl.hidden = true;
    pickCb = null;
    pickItems = [];
    selectedIds = {};
  }

  function renderGrid(items, emptyHtml) {
    var grid = modalEl.querySelector("#meishiImgPickerGrid");
    if (!items.length) {
      grid.innerHTML = emptyHtml || '<p class="hint">選択できる画像がありません。</p>';
      return;
    }
    grid.innerHTML = items.map(function (item) {
      return (
        '<label class="img-picker-item">' +
        '<input type="checkbox" data-id="' + esc(item.id) + '" />' +
        '<img src="' + esc(itemUrl(item)) + '" alt="" />' +
        "<span>" + esc(item.label || item.file || item.id) + "</span>" +
        "</label>"
      );
    }).join("");
    grid.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.onchange = function () {
        if (cb.checked) selectedIds[cb.getAttribute("data-id")] = true;
        else delete selectedIds[cb.getAttribute("data-id")];
      };
    });
  }

  function openPicker(items, opts, callback) {
    if (typeof callback !== "function") return;
    opts = opts || {};
    pickCb = callback;
    pickItems = items || [];
    selectedIds = {};
    ensureModal();
    modalEl.querySelector("#meishiImgPickerTitle").textContent = opts.title || "画像を選択";
    modalEl.querySelector("#meishiImgPickerHint").textContent = opts.hint || "";
    modalEl.querySelector("#meishiImgPickerOk").textContent = opts.okLabel || "追加";
    renderGrid(pickItems, opts.emptyHtml);
    modalEl.querySelector("#meishiImgPickerOk").onclick = function () {
      var chosen = pickItems.filter(function (item) { return selectedIds[item.id]; });
      closeModal();
      if (chosen.length) callback(chosen);
    };
    modalEl.hidden = false;
  }

  /** 画像保存ボックスに登録済みの画像のみ（名刺設定用） */
  function pick(callback) {
    if (!window.MeishiStore) return;
    var items = MeishiStore.getImageLibrary();
    if (!items.length) {
      alert("画像保存ボックスに画像がありません。\n\n基本・URL タブの「画像保存ボックス」で、images フォルダから追加してください。");
      return;
    }
    openPicker(items, {
      title: "名刺に使う画像を選択",
      hint: "画像保存ボックスに登録済みの画像です。",
      okLabel: "名刺に追加",
    }, callback);
  }

  /** images フォルダから選択（保存ボックスへの登録用） */
  function pickFromFolder(callback, opts) {
    opts = opts || {};
    loadManifest().then(function (m) {
      var items = (m.items || []).slice();
      if (opts.excludeRegistered && window.MeishiStore) {
        var reg = {};
        MeishiStore.getImageLibrary().forEach(function (x) {
          reg[x.path] = true;
          reg[x.id] = true;
          reg[x.file] = true;
        });
        items = items.filter(function (item) {
          var path = "images/" + String(item.file || "").replace(/^\//, "");
          return !reg[path] && !reg[item.id];
        });
      }
      openPicker(items, {
        title: opts.title || "images フォルダから追加",
        hint: opts.hint || "PC の images フォルダに置いた画像です。追加後は画像保存ボックスに登録され、名刺設定で使えます。",
        okLabel: opts.okLabel || "保存ボックスに追加",
        emptyHtml: opts.emptyHtml ||
          '<p class="hint">フォルダに画像がありません、またはすべて登録済みです。<br><code>meishi-app/public/images/</code> に PNG/JPG/SVG を置き、<code>Update-ImageManifest.ps1</code> を実行してください。</p>',
      }, callback);
    });
  }

  window.MeishiImageLib = {
    loadManifest: loadManifest,
    pick: pick,
    pickFromFolder: pickFromFolder,
    assetUrl: assetUrl,
    entryUrl: entryUrl,
    itemUrl: itemUrl,
    createDefaultImage: createDefaultImage,
    resolveImages: resolveImages,
  };
})();
