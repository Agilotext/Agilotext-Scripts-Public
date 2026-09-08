/**
 * Picker dashboard : icône + nom. Synchronise #default-template-select pour doSummary.
 * @version 1.0.0
 */
(function (global) {
  "use strict";

  function usable(models) {
    return models.filter(function (m) {
      return m.canUse && global.AgiloLibraryApi.isGenerationSafeId(m.promptModelId);
    });
  }

  function syncNative(select, models, selectedId) {
    if (!select) return;
    select.classList.add("agilo-lib-native-select");
    var keep = {};
    Array.prototype.forEach.call(select.options, function (opt) {
      keep[opt.value] = true;
    });
    models.forEach(function (m) {
      var val = String(m.promptModelId);
      if (keep[val]) return;
      var opt = document.createElement("option");
      opt.value = val;
      opt.textContent = m.cardTitle;
      select.appendChild(opt);
    });
    if (selectedId != null) select.value = String(selectedId);
  }

  function renderButton(btn, model) {
    var C = global.AgiloLibraryCore;
    if (!model) {
      btn.innerHTML = "<span>Choisir un modèle</span>";
      return;
    }
    btn.innerHTML =
      '<span class="agilo-lib-picker__ico" aria-hidden="true">' + C.iconHtml(model) + "</span>" +
      "<span>" + C.escapeHtml(model.cardTitle) +
      (model.isDefault ? " (défaut)" : "") + "</span>";
  }

  function mount(anchor, creds, pack) {
    var models = usable(pack.models || []);
    var select = document.getElementById("default-template-select");
    var selectedId = pack.defaultPromptModelId;
    if (selectedId == null && select && select.value) selectedId = select.value;
    if (selectedId == null && models[0]) selectedId = models[0].promptModelId;
    selectedId = selectedId != null ? Number(selectedId) : null;

    document.body.classList.add("agilo-lib-picker-on");
    syncNative(select, models, selectedId);

    var wrap = document.createElement("div");
    wrap.className = "agilo-lib agilo-lib-picker";
    wrap.innerHTML =
      '<button type="button" class="agilo-lib-picker__btn" aria-haspopup="listbox" aria-expanded="false"></button>' +
      '<div class="agilo-lib-picker__list" role="listbox"></div>';
    anchor.innerHTML = "";
    anchor.appendChild(wrap);

    var btn = wrap.querySelector(".agilo-lib-picker__btn");
    var list = wrap.querySelector(".agilo-lib-picker__list");

    function current() {
      return models.filter(function (m) { return Number(m.promptModelId) === Number(selectedId); })[0] || models[0];
    }

    function paintList() {
      var C = global.AgiloLibraryCore;
      list.innerHTML = models.map(function (m) {
        var active = Number(m.promptModelId) === Number(selectedId);
        return '<button type="button" class="agilo-lib-picker__opt' + (active ? " is-active" : "") +
          '" role="option" data-id="' + m.promptModelId + '" aria-selected="' + active + '">' +
          '<span class="agilo-lib-picker__ico" aria-hidden="true">' + C.iconHtml(m) + "</span>" +
          "<span>" + C.escapeHtml(m.cardTitle) + (m.isDefault ? " (défaut)" : "") + "</span></button>";
      }).join("");
    }

    function close() {
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }

    function open() {
      paintList();
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }

    renderButton(btn, current());
    paintList();

    btn.addEventListener("click", function () {
      if (wrap.classList.contains("is-open")) close();
      else open();
    });

    list.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-id]");
      if (!opt) return;
      var id = Number(opt.getAttribute("data-id"));
      try {
        global.AgiloLibraryApi.assertGenerationId(id);
      } catch (err) {
        global.AgiloLibraryCore.toast(err.message);
        return;
      }
      selectedId = id;
      models.forEach(function (m) { m.isDefault = Number(m.promptModelId) === id; });
      syncNative(select, models, id);
      if (select) select.value = String(id);
      renderButton(btn, current());
      close();
      global.AgiloLibraryApi.setDefault(creds, id).then(function (res) {
        if (!res.ok) global.AgiloLibraryCore.toast(res.message || "Défaut non enregistré.");
      });
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) close();
    });
  }

  function boot() {
    var cfg = global.AgiloLibraryApi.cfg();
    var anchor = document.querySelector(cfg.pickerSelector) || document.getElementById("agilo-prompt-picker-anchor");
    var select = document.getElementById("default-template-select");
    if (!anchor && !select) return;
    if (!anchor && select && select.parentNode) {
      anchor = document.createElement("div");
      anchor.id = "agilo-prompt-picker-anchor";
      select.parentNode.insertBefore(anchor, select);
    }
    global.AgiloLibraryApi.waitForCreds().then(function (creds) {
      return global.AgiloLibraryApi.fetchLists(creds).then(function (pack) {
        mount(anchor, creds, pack);
      });
    }).catch(function (err) {
      if (global.AgiloLibraryCore) global.AgiloLibraryCore.toast(err.message || "Reconnecte-toi.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.AgiloLibraryPicker = { mount: mount, boot: boot };
})(typeof window !== "undefined" ? window : globalThis);
