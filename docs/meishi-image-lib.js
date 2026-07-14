/**
 * 画像フォルダ（images/）と会社別画像保存ボックスの選択・URL解決
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

  function activeCompany(opts) {
    opts = opts || {};
    if (opts.company) return opts.company;
    if (window.MeishiStore && MeishiStore.getImageLibraryContext) {
      return MeishiStore.getImageLibraryContext();
    }
    return "";
  }

  function libraryItemById(libId, company) {
    if (!libId || !window.MeishiStore) return null;
    var lib = MeishiStore.getImageLibrary(company || activeCompany());
    for (var i = 0; i < lib.length; i++) {
      if (lib[i] && lib[i].id === libId) return lib[i];
    }
    // 他社も含めて libId 検索（印刷時のフォールバック）
    if (MeishiStore.getImageLibraries) {
      var map = MeishiStore.getImageLibraries() || {};
      var keys = Object.keys(map);
      for (var k = 0; k < keys.length; k++) {
        var arr = map[keys[k]] || [];
        for (var j = 0; j < arr.length; j++) {
          if (arr[j] && arr[j].id === libId) return arr[j];
        }
      }
    }
    return null;
  }

  function itemUrl(item) {
    if (!item) return "";
    if (item.libId) {
      var linked = libraryItemById(item.libId, item.company);
      if (linked) return itemUrl(linked);
    }
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

  function resolveImages(images, company) {
    return (images || []).map(function (im) {
      if (!im) return null;
      var o = Object.assign({}, im);
      if (o.libId) {
        var linked = libraryItemById(o.libId, company || o.company);
        if (linked) {
          o.src = itemUrl(linked);
          if (o.src) return o;
        }
      }
      if (o.src && o.src.indexOf("data:") === 0) return o;
      if (o.path) o.src = assetUrl(o.path);
      else if (o.src && o.src.indexOf("images/") === 0) o.src = assetUrl(o.src);
      else if (o.file) o.src = assetUrl("images/" + String(o.file).replace(/^\//, "").replace(/^images\//, ""));
      return o.src ? o : null;
    }).filter(Boolean);
  }

  function createDefaultImage(item, index, prefix) {
    var i = index || 0;
    var out = {
      id: (prefix || "img") + Date.now() + i,
      src: itemUrl(item),
      x: i * 12,
      y: i * 12,
      w: 80,
      h: 44,
    };
    if (item.id) out.libId = item.id;
    if (item.company) out.company = item.company;
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

  /** 指定会社（未指定時はコンテキスト会社）の画像保存ボックスから選択 */
  function pick(callback, opts) {
    if (!window.MeishiStore) return;
    opts = opts || {};
    var co = activeCompany(opts);
    if (co && MeishiStore.setImageLibraryContext) MeishiStore.setImageLibraryContext(co);
    var items = MeishiStore.getImageLibrary(co);
    if (!items.length) {
      alert("この会社・団体の画像保存ボックスに画像がありません。\n\n先に「＋ 追加」で画像を登録してください。");
      return;
    }
    openPicker(items, {
      title: "名刺に使う画像を選択" + (co ? "（" + co + "）" : ""),
      hint: "この会社・団体の画像保存ボックスに登録済みの画像です。",
      okLabel: "名刺に追加",
    }, callback);
  }

  function pickFromFolder(callback, opts) {
    opts = opts || {};
    var co = activeCompany(opts);
    loadManifest().then(function (m) {
      var items = (m.items || []).slice();
      if (opts.excludeRegistered && window.MeishiStore) {
        var reg = {};
        MeishiStore.getImageLibrary(co).forEach(function (x) {
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
          '<p class="hint">フォルダに画像がありません、またはすべて登録済みです。</p>',
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
