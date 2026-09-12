/**
 * Picker dashboard A : popover sections + recherche. Synchronise #default-template-select.
 * @version 2.2.0
 */
(function (global) {
  "use strict";

  function Api() {
    return global.AgiloLibraryApi;
  }

  function Core() {
    return global.AgiloLibraryCore;
  }

  function acquiredId(m) {
    var n = Number(m && m.acquiredPromptModelId);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function matchQ(row, q) {
    if (!q) return true;
    var blob = [row.cardTitle, row.publicDescription, row.categoryKey].join(" ").toLowerCase();
    return blob.indexOf(String(q).toLowerCase()) !== -1;
  }

  function hasCse() {
    return !!(Api() && Api().hasCseAccess && Api().hasCseAccess());
  }

  function visibleModels(models, canCreate) {
    var list = (models || []).filter(function (m) {
      return !Api().isHiddenOfficial || !Api().isHiddenOfficial(m.promptModelId);
    });
    if (canCreate) return list.slice();
    return list.filter(function (m) {
      return m.canUse && Api().isGenerationSafeId(m.promptModelId);
    });
  }

  function groups(models, q) {
    var mine = [];
    var off = [];
    (models || []).forEach(function (row) {
      if (!matchQ(row, q)) return;
      if (String(row.type || "").toUpperCase() === "USER") mine.push(row);
      else off.push(row);
    });
    mine.sort(sortMine);
    return { mine: mine, off: off };
  }

  function rowTime(m) {
    var n = Number(m && (m.dtUpdate || m.dtCreation));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function sortMine(a, b) {
    var diff = rowTime(b) - rowTime(a);
    if (diff) return diff;
    return String((a && a.cardTitle) || "").localeCompare(String((b && b.cardTitle) || ""), "fr");
  }

  function titleText(m) {
    var name = String((m && m.cardTitle) || "");
    if (!m || String(m.type || "").toUpperCase() !== "USER") return name;
    var created = Number(m.dtCreation) || 0;
    var updated = Number(m.dtUpdate) || 0;
    var ts = updated || created;
    if (!ts) return name;
    var createdOnly = !created || !updated || Math.abs(updated - created) < 60000;
    var C = Core();
    var day = C && C.formatDate ? C.formatDate(ts) : "";
    if (!day || day === "-") return name;
    return name + " · " + (createdOnly ? "créé le " : "modifié le ") + day;
  }

  function canSelect(m) {
    if (!m) return false;
    if (m.packCse && !hasCse()) return false;
    var status = String(m.promptModelStatus || "READY").toUpperCase();
    if (status !== "READY" && status !== "ACTIVE") return false;
    if (acquiredId(m)) return true;
    if (m.packCse && hasCse()) return false;
    return !!(m.canUse && Api().isGenerationSafeId(m.promptModelId));
  }

  function showAdd(m, canCreate) {
    if (!canCreate || !m) return false;
    if (m.packCse && !hasCse()) return false;
    if (acquiredId(m)) return false;
    return !!(m.requiresUserCopy || Number(m.promptModelId) < -1);
  }

  function chooseId(m) {
    if (!m) return null;
    var copy = acquiredId(m);
    if (copy) return copy;
    return Number(m.promptModelId);
  }

  function addKind(m, canCreate) {
    if (!m) return "none";
    if (m.packCse && !hasCse()) return "cse-pack";
    if (acquiredId(m)) return "select-copy";
    if (showAdd(m, canCreate)) return "duplicate";
    if (canSelect(m)) return "select";
    return "none";
  }

  function makeOption(val, text) {
    if (typeof document !== "undefined" && document.createElement) {
      var opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      return opt;
    }
    return { value: val, textContent: text };
  }

  function syncNative(select, models, selectedId) {
    if (!select) return;
    if (select.classList && select.classList.add) {
      select.classList.add("agilo-lib-native-select");
    }
    if (select.required) select.required = false;
    var keep = {};
    Array.prototype.forEach.call(select.options || [], function (opt) {
      keep[String(opt.value)] = true;
    });
    (models || []).forEach(function (m) {
      if (!Api().isGenerationSafeId(m.promptModelId)) return;
      var val = String(m.promptModelId);
      if (keep[val]) return;
      keep[val] = true;
      var opt = makeOption(val, m.cardTitle || val);
      if (select.appendChild) select.appendChild(opt);
      else if (select.options && select.options.push) select.options.push(opt);
    });
    if (selectedId != null && Api().isGenerationSafeId(selectedId)) {
      select.value = String(selectedId);
    }
  }

  function writeSelect(select, id) {
    if (!select) return;
    select.value = String(id);
    if (typeof select.dispatchEvent !== "function") return;
    var ev;
    try {
      ev = typeof Event === "function" ? new Event("change", { bubbles: true }) : { type: "change", bubbles: true };
    } catch (err) {
      ev = { type: "change", bubbles: true };
    }
    select.dispatchEvent(ev);
  }

  function findSummaryToggle() {
    if (typeof document === "undefined") return null;
    return document.getElementById("toggle-summary") ||
      document.querySelector('[name="toggle-summary"]') ||
      document.querySelector('[data-option-type="summary"]');
  }

  function summaryOn() {
    var el = findSummaryToggle();
    if (!el) return true;
    return !!el.checked;
  }

  function hintHtml(summaryEnabled) {
    if (summaryEnabled) return "";
    return '<div class="agilo-lib-picker__hint" role="status" aria-live="polite">' +
      "Le compte rendu est désactivé pour cet envoi. Vous pouvez quand même définir votre modèle par défaut." +
      "</div>";
  }

  function packCta() {
    var A = Api();
    if (A.ctaForLocked) {
      var pack = A.ctaForLocked(true);
      if (pack) return pack;
    }
    return {
      href: A.ctaCsePackHref ? A.ctaCsePackHref() : "/offres/cse",
      label: "Voir l’offre CSE"
    };
  }

  function iconTile(m, locked) {
    var C = Core();
    var cls = "agilo-lib-picker__ico" + (locked ? " agilo-lib-picker__ico--locked" : "");
    return '<span class="' + cls + '" aria-hidden="true">' + C.iconHtml(m, 16) +
      (locked ? '<span class="agilo-lib-picker__locksoft">' + C.svgIcon("lock-soft", 10) + "</span>" : "") +
      "</span>";
  }

  function rowBadges(m, canCreate) {
    var C = Core();
    var bits = [];
    if (m.promptModelStatus && String(m.promptModelStatus).toUpperCase() !== "READY" &&
        String(m.promptModelStatus).toUpperCase() !== "ACTIVE") {
      bits.push('<span class="agilo-lib-badge">' + C.svgIcon("clock", 12) + " En création</span>");
    }
    if (acquiredId(m)) bits.push('<span class="agilo-lib-badge agilo-lib-badge--acquired">Dans Mes modèles</span>');
    if (m.packCse) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pack">CSE</span>');
    if (m.packCse && !hasCse()) {
      bits.push('<span class="agilo-lib-badge agilo-lib-badge--lock">Verrouillé</span>');
    } else if (!m.packCse && showAdd(m, canCreate)) {
      bits.push('<span class="agilo-lib-badge agilo-lib-badge--lock">Verrouillé</span>');
    }
    return bits.join("");
  }

  function safeId(models, preferred) {
    if (preferred != null && Api().isGenerationSafeId(preferred)) return Number(preferred);
    var i;
    for (i = 0; i < (models || []).length; i++) {
      var id = chooseId(models[i]);
      if (id != null && Api().isGenerationSafeId(id) && canSelect(models[i])) return Number(id);
    }
    return null;
  }

  function mount(anchor, creds, pack, access) {
    if (access && Api().applyCseUnlock) {
      pack = Object.assign({}, pack, { models: Api().applyCseUnlock(pack.models || [], access) });
    } else if (access && Api().setMemberAccess) {
      Api().setMemberAccess(access);
    }
    var canCreate = Api().canCreate(creds);
    var models = visibleModels(pack.models || [], canCreate);
    var select = typeof document !== "undefined" ? document.getElementById("default-template-select") : null;
    var selectedId = pack.defaultPromptModelId;
    if (selectedId == null && select && select.value) selectedId = select.value;
    selectedId = safeId(models, selectedId);
    var query = "";
    var hiIndex = 0;
    var adding = false;

    if (typeof document !== "undefined" && document.body) {
      document.body.classList.add("agilo-lib-picker-on");
    }
    syncNative(select, models, selectedId);
    writeSelect(select, selectedId);

    var wrap = document.createElement("div");
    wrap.className = "agilo-lib agilo-lib-picker";
    wrap.innerHTML =
      '<button type="button" class="agilo-lib-picker__btn" aria-haspopup="listbox" aria-expanded="false"></button>' +
      '<div class="agilo-lib-picker__panel" role="listbox">' +
      '<div class="agilo-lib-picker__hint" role="status" aria-live="polite" hidden></div>' +
      '<input type="search" class="agilo-lib-picker__search" placeholder="Rechercher un modèle" autocomplete="off">' +
      '<div class="agilo-lib-picker__list"></div>' +
      '<div class="agilo-lib-picker__foot"></div></div>';
    anchor.innerHTML = "";
    anchor.appendChild(wrap);

    var btn = wrap.querySelector(".agilo-lib-picker__btn");
    var panel = wrap.querySelector(".agilo-lib-picker__panel");
    var hint = wrap.querySelector(".agilo-lib-picker__hint");
    var search = wrap.querySelector(".agilo-lib-picker__search");
    var list = wrap.querySelector(".agilo-lib-picker__list");
    var foot = wrap.querySelector(".agilo-lib-picker__foot");

    function current() {
      var byId = models.filter(function (m) {
        return Number(m.promptModelId) === Number(selectedId);
      })[0];
      if (byId) return byId;
      var viaCopy = models.filter(function (m) {
        return acquiredId(m) === Number(selectedId);
      })[0];
      return viaCopy || models.filter(function (m) { return canSelect(m); })[0] || models[0];
    }

    function selectableFlat() {
      var g = groups(models, query);
      return g.mine.concat(g.off).filter(canSelect);
    }

    function renderButton() {
      var model = current();
      if (!model) {
        btn.innerHTML = "<span>Choisir un modèle</span>";
        return;
      }
      var showDefault = !!model.isDefault;
      btn.innerHTML =
        iconTile(model, false) +
        '<span class="agilo-lib-picker__grow"><span class="agilo-lib-picker__title" title="' +
        Core().escapeHtml(titleText(model)) + '">' +
        Core().escapeHtml(model.cardTitle) + "</span></span>" +
        (showDefault ? '<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>' : "") +
        '<span class="agilo-lib-picker__chev" aria-hidden="true">▾</span>';
    }

    function rowHtml(m, hi) {
      var C = Core();
      var active = Number(m.promptModelId) === Number(selectedId);
      var choosable = canSelect(m);
      var locked = !!(m.packCse && !hasCse()) || (!m.packCse && showAdd(m, canCreate));
      var cls = "agilo-lib-picker__opt" +
        (active ? " is-active" : "") +
        (choosable ? "" : " is-off") +
        (hi ? " is-hi" : "");
      var cta = "";
      var kind = addKind(m, canCreate);
      if (kind === "duplicate") {
        cta = '<button type="button" class="agilo-lib-picker__add" data-add="' +
          m.promptModelId + '"' + (adding ? " disabled" : "") + ">Ajouter pour l’utiliser</button>";
      } else if (kind === "cse-pack") {
        var pack = packCta();
        cta = '<a class="agilo-lib-picker__add" href="' + C.escapeHtml(pack.href) + '">' +
          C.escapeHtml(pack.label) + "</a>";
      }
      var check = active
        ? '<span class="agilo-lib-picker__check" aria-hidden="true">' + C.svgIcon("check", 14) + "</span>"
        : "";
      return '<div class="' + cls + '" role="option" data-id="' + m.promptModelId +
        '" aria-selected="' + active + '">' +
        iconTile(m, locked) +
        '<div class="agilo-lib-picker__opt-body">' +
        '<div class="agilo-lib-picker__opt-title">' +
        '<span class="agilo-lib-picker__opt-label" title="' + C.escapeHtml(titleText(m)) + '">' +
        C.escapeHtml(m.cardTitle) + "</span>" +
        rowBadges(m, canCreate) + check + "</div>" +
        cta +
        "</div></div>";
    }

    function paintHint() {
      if (!hint) return;
      if (summaryOn()) {
        hint.hidden = true;
        hint.textContent = "";
      } else {
        hint.hidden = false;
        hint.textContent = "Le compte rendu est désactivé pour cet envoi. Vous pouvez quand même définir votre modèle par défaut.";
      }
    }

    function paintList() {
      var g = groups(models, query);
      var html = "";
      var choosable = selectableFlat();
      var hiId = choosable[hiIndex] ? choosable[hiIndex].promptModelId : null;
      function block(title, rows, extraClass) {
        html += '<p class="agilo-lib-picker__sec' + (extraClass ? " " + extraClass : "") + '">' + title + "</p>";
        if (!rows.length) {
          html += '<p class="agilo-lib-picker__empty">' +
            (query ? "Aucun modèle ne correspond." : "Aucun modèle dans cette liste.") + "</p>";
          return;
        }
        rows.forEach(function (row) {
          html += rowHtml(row, Number(row.promptModelId) === Number(hiId));
        });
      }
      paintHint();
      if (canCreate) block("Mes modèles", g.mine);
      block("Modèles Agilotext", g.off, canCreate ? "agilo-lib-picker__sec--off" : "");
      list.innerHTML = html;
      var libHref = Api().appPath("bibliotheque");
      foot.innerHTML =
        "<span>Ce choix devient le défaut du compte.</span>" +
        '<a href="' + Core().escapeHtml(libHref) + '">Bibliothèque</a>';
    }

    function close() {
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }

    function open() {
      paintList();
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      setTimeout(function () {
        if (search) search.focus();
      }, 0);
    }

    function applyChoice(id) {
      try {
        Api().assertGenerationId(id);
      } catch (err) {
        Core().toast(err.message);
        return;
      }
      selectedId = Number(id);
      models.forEach(function (m) {
        m.isDefault = Number(m.promptModelId) === selectedId;
      });
      syncNative(select, models, selectedId);
      writeSelect(select, selectedId);
      renderButton();
      close();
      btn.focus();
      Api().setDefault(creds, selectedId).then(function (res) {
        if (!res.ok) Core().toast(res.message || "Défaut non enregistré.");
      });
    }

    function addCopy(sourceId) {
      if (!canCreate || adding) return;
      var src = models.filter(function (m) { return Number(m.promptModelId) === Number(sourceId); })[0];
      if (!src) return;
      if (acquiredId(src)) {
        applyChoice(acquiredId(src));
        return;
      }
      adding = true;
      paintList();
      Api().duplicate(creds, sourceId, src.cardTitle).then(function (res) {
        adding = false;
        if (!res.ok) {
          paintList();
          Core().toast(res.message || "Copie impossible.");
          return;
        }
        var newId = Number(res.promptModelId);
        if (!Api().isGenerationSafeId(newId)) {
          Core().toast("Copie reçue mais identifiant interdit.");
          paintList();
          return;
        }
        src.acquiredPromptModelId = newId;
        var exists = models.some(function (m) { return Number(m.promptModelId) === newId; });
        if (!exists) {
          models.unshift({
            promptModelId: newId,
            type: "USER",
            cardTitle: src.cardTitle,
            publicDescription: src.publicDescription || "",
            categoryKey: src.categoryKey,
            iconUrl: src.iconUrl,
            iconKey: src.iconKey,
            canUse: true,
            promptModelStatus: "READY",
            isDefault: true,
            dtCreation: Date.now(),
            dtUpdate: Date.now()
          });
        }
        applyChoice(newId);
        Api().fetchLists(creds).then(function (fresh) {
          models = visibleModels(fresh.models || [], canCreate);
          selectedId = safeId(models, selectedId);
          syncNative(select, models, selectedId);
          renderButton();
          if (wrap.classList.contains("is-open")) paintList();
        }).catch(function () { /* carte locale déjà là */ });
      });
    }

    renderButton();
    paintList();

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (wrap.classList.contains("is-open")) close();
      else open();
    });

    search.addEventListener("input", function (e) {
      query = e.target.value;
      hiIndex = 0;
      paintList();
    });
    search.addEventListener("click", function (e) { e.stopPropagation(); });
    search.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var rows = selectableFlat();
      if (rows[hiIndex]) applyChoice(chooseId(rows[hiIndex]));
    });

    list.addEventListener("click", function (e) {
      var add = e.target.closest("[data-add]");
      if (add) {
        e.preventDefault();
        e.stopPropagation();
        addCopy(add.getAttribute("data-add"));
        return;
      }
      if (e.target.closest("a[href]")) return;
      var opt = e.target.closest("[data-id]");
      if (!opt) return;
      var id = Number(opt.getAttribute("data-id"));
      var row = models.filter(function (m) { return Number(m.promptModelId) === id; })[0];
      if (!row || !canSelect(row)) {
        if (opt.classList.contains("is-off")) {
          Core().toast("Ajoutez ce modèle à Mes modèles pour l’utiliser.");
        }
        return;
      }
      applyChoice(chooseId(row));
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) close();
    });

    document.addEventListener("keydown", function (e) {
      if (!wrap.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        close();
        btn.focus();
        e.preventDefault();
        return;
      }
      var rows = selectableFlat();
      if (!rows.length) return;
      if (e.key === "ArrowDown") {
        hiIndex = Math.min(rows.length - 1, hiIndex + 1);
        paintList();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        hiIndex = Math.max(0, hiIndex - 1);
        paintList();
        e.preventDefault();
      } else if (e.key === "Enter" && document.activeElement !== search) {
        var row = rows[hiIndex];
        if (row) applyChoice(chooseId(row));
        e.preventDefault();
      }
    });

    var toggle = findSummaryToggle();
    if (toggle && !toggle.__agiloPickerBound) {
      toggle.__agiloPickerBound = true;
      toggle.addEventListener("change", function () {
        if (wrap.classList.contains("is-open")) paintList();
        else paintHint();
      });
    }
  }

  var pickerFailed = false;
  var pickerMounted = false;
  var pickerLoading = false;

  function boot() {
    if (typeof document === "undefined") return;
    if (pickerLoading) return;
    var cfg = Api().cfg();
    var anchor = document.querySelector(cfg.pickerSelector) || document.getElementById("agilo-prompt-picker-anchor");
    var select = document.getElementById("default-template-select");
    if (!anchor && !select) return;
    if (!anchor && select && select.parentNode) {
      anchor = document.createElement("div");
      anchor.id = "agilo-prompt-picker-anchor";
      select.parentNode.insertBefore(anchor, select);
    }
    pickerLoading = true;
    Api().waitForCreds().then(function (creds) {
      return Promise.all([
        Api().fetchLists(creds),
        Api().fetchMemberAccess(creds).catch(function () {
          return { hasCse: false, noun: "compte rendu", sources: [], businessTypes: [] };
        })
      ]).then(function (pair) {
        pickerFailed = false;
        pickerMounted = true;
        pickerLoading = false;
        mount(anchor, creds, pair[0], pair[1]);
      });
    }).catch(function (err) {
      pickerLoading = false;
      pickerFailed = true;
      var msg = "Reconnecte-toi.";
      if (Api().sanitizeUserMessage) {
        msg = Api().sanitizeUserMessage(err && err.message ? err.message : msg, false);
      }
      if (Core()) Core().toast(msg);
    });
    if (!global.__agiloLibPickerTokenBound && typeof global.addEventListener === "function") {
      global.__agiloLibPickerTokenBound = true;
      global.addEventListener("agilo:token", function (e) {
        if (!e || !e.detail || !e.detail.token) return;
        if (pickerFailed || !pickerMounted) boot();
      });
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  global.AgiloLibraryPicker = {
    VERSION: "2.2.0",
    mount: mount,
    boot: boot,
    _groups: groups,
    _canSelect: canSelect,
    _filter: matchQ,
    _syncNative: syncNative,
    _writeSelect: writeSelect,
    _visibleModels: visibleModels,
    _showAdd: showAdd,
    _addKind: addKind,
    _chooseId: chooseId,
    _sortMine: sortMine,
    _titleText: titleText,
    _hintHtml: hintHtml,
    _packCta: packCta
  };
})(typeof window !== "undefined" ? window : globalThis);
