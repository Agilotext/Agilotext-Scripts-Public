/**
 * Jeux de données locaux pour l’aperçu v2 (?mock=free|pro|business|business-dense).
 * Couvre : 8 STANDARD, USER, 2 CSE verrouillés, 1 modèle en création, catalogue 40 icônes
 * (URLs publiques getPromptIcon), contenu prompt, suggestion d’icône, Studio factice.
 * Jamais chargé dans l’embed Webflow.
 */
(function (global) {
  "use strict";

  var ICON_BASE = "https://api.agilotext.com/api/v1/library2/getPromptIcon?version=1&iconKey=";
  var ICONS = [
    { iconKey: "file-text", labelFr: "Document, compte rendu", category: "reunion" },
    { iconKey: "users", labelFr: "Réunion, élus, CSE", category: "cse" },
    { iconKey: "mic", labelFr: "Dictée vocale", category: "dictee" },
    { iconKey: "presentation", labelFr: "Présentation, webinaire", category: "webinar" },
    { iconKey: "briefcase", labelFr: "Commercial, vente", category: "commercial" },
    { iconKey: "chart", labelFr: "Analyse, stratégie", category: "strategie" },
    { iconKey: "graduation-cap", labelFr: "Formation, cours", category: "formation" },
    { iconKey: "archive", labelFr: "Archive, ancien modèle", category: "legacy" },
    { iconKey: "document", labelFr: "Document générique", category: "reunion" },
    { iconKey: "custom", labelFr: "Modèle personnel", category: "ui" },
    { iconKey: "mail", labelFr: "Courrier, email", category: "communication" },
    { iconKey: "calendar", labelFr: "Agenda, réunion datée", category: "reunion" },
    { iconKey: "clipboard", labelFr: "Ordre du jour, points", category: "reunion" },
    { iconKey: "list-todo", labelFr: "Actions, to-do", category: "reunion" },
    { iconKey: "chat-bubble", labelFr: "Échanges, questions", category: "communication" },
    { iconKey: "handshake", labelFr: "Accord, partenariat", category: "commercial" },
    { iconKey: "gavel", labelFr: "Juridique, délibération", category: "juridique" },
    { iconKey: "scale", labelFr: "Droit, équilibre", category: "juridique" },
    { iconKey: "judge", labelFr: "Instance, audience", category: "juridique" },
    { iconKey: "conference-room", labelFr: "Salle, comité", category: "reunion" },
    { iconKey: "megaphone", labelFr: "Annonce, communication interne", category: "communication" },
    { iconKey: "target", labelFr: "Objectif, cible", category: "strategie" },
    { iconKey: "lightbulb", labelFr: "Idée, atelier", category: "strategie" },
    { iconKey: "book", labelFr: "Référentiel, support", category: "formation" },
    { iconKey: "hospital", labelFr: "Santé, établissement", category: "sante" },
    { iconKey: "medicine", labelFr: "Pharmacie, traitement", category: "sante" },
    { iconKey: "shield", labelFr: "Sécurité, SSCT", category: "cse" },
    { iconKey: "sparkle", labelFr: "Nouveau, mis en avant", category: "ui" },
    { iconKey: "wand", labelFr: "Création assistée", category: "ui" },
    { iconKey: "clock", labelFr: "Durée, horaire", category: "reunion" },
    { iconKey: "pin-tack", labelFr: "Épinglé, important", category: "ui" },
    { iconKey: "folder", labelFr: "Dossier, classer", category: "documents" },
    { iconKey: "newspaper", labelFr: "Actualité, revue", category: "communication" },
    { iconKey: "globe", labelFr: "International, filiale", category: "strategie" },
    { iconKey: "map", labelFr: "Territoire, site", category: "strategie" },
    { iconKey: "phone", labelFr: "Appel, entretien tel", category: "communication" },
    { iconKey: "video", labelFr: "Visio, visio-conférence", category: "webinar" },
    { iconKey: "camera", labelFr: "Captation, enregistrement", category: "dictee" },
    { iconKey: "headphones", labelFr: "Écoute, relecture audio", category: "dictee" },
    { iconKey: "signature", labelFr: "Signature, validation", category: "juridique" }
  ].map(function (ic) {
    ic.url = ICON_BASE + encodeURIComponent(ic.iconKey);
    ic.label = ic.labelFr;
    return ic;
  });

  var STANDARD_ICONS = { 0: "file-text", 1: "presentation", 2: "chart", 3: "briefcase", 4: "graduation-cap", 5: "archive", 6: "mic", 7: "users" };

  var PROMPT_SAMPLE = [
    "Tu es un assistant chargé de rédiger un compte rendu professionnel à partir d’une transcription.",
    "",
    "Objectif : produire une synthèse fidèle, structurée et actionnable, destinée aux participants et à leur hiérarchie.",
    "",
    "Structure attendue :",
    "1. Contexte de la réunion (date, participants, ordre du jour)",
    "2. Points discutés, dans l’ordre de la réunion",
    "3. Décisions prises, avec le nom du décideur",
    "4. Actions à mener : responsable, échéance, priorité",
    "5. Points en suspens et prochaine réunion",
    "",
    "Consignes :",
    "- Reste factuel, ne reformule pas les positions des participants.",
    "- Conserve les chiffres, dates et noms propres tels qu’ils apparaissent.",
    "- N’invente jamais une décision absente de la transcription.",
    "",
    "Transcription :",
    "${CONTENT}"
  ].join("\n");

  function iconUrl(key) { return key ? ICON_BASE + encodeURIComponent(key) : ""; }

  function official() {
    var meta = global.AgiloLibraryStandards.BY_ID;
    return Object.keys(meta).map(function (id) {
      var m = meta[id];
      var key = STANDARD_ICONS[Number(id)] || "document";
      return {
        promptModelId: Number(id),
        promptModelName: m.cardTitle,
        cardTitle: m.cardTitle,
        publicDescription: m.publicDescription,
        publicExample: m.publicExample,
        type: "STANDARD",
        promptModelType: "STANDARD",
        iconKey: key,
        iconUrl: iconUrl(key),
        categoryKey: m.categoryKey,
        displayOrder: m.sortOrder,
        featured: !!m.featured,
        hasHtml: Number(id) === 0 || Number(id) === 7,
        pinned: Number(id) === 0,
        isDefault: Number(id) === 0,
        canUse: true,
        canSetDefault: true,
        canPin: true,
        canCopyOfficial: true,
        canDuplicate: false,
        canEdit: false,
        canDelete: false,
        canManageVersions: false
      };
    });
  }

  function cseLocked(id, title) {
    return {
      promptModelId: id,
      promptModelName: title,
      cardTitle: title,
      publicDescription: "Procès-verbal de réunion plénière : ordre du jour, délibérations, votes et avis motivés.",
      publicExample: "Ordre du jour · Délibérations · Votes · Avis",
      type: "STANDARD",
      promptModelType: "STANDARD",
      iconKey: "users",
      iconUrl: iconUrl("users"),
      categoryKey: "cse",
      displayOrder: 50,
      featured: false,
      hasHtml: true,
      pinned: false,
      isDefault: false,
      canUse: false,
      canSetDefault: false,
      canPin: false,
      canCopyOfficial: false,
      canDuplicate: false,
      canEdit: false,
      canDelete: false,
      canManageVersions: false,
      lockReasonCode: "SUBSCRIPTION_ACCESS_REQUIRED",
      lockReasonMessage: "Réservé au Pack CSE (890 € TTC / an).",
      businessType: "cse",
      packCse: true
    };
  }

  var USER_KEYS = ["conference-room", "handshake", "clipboard", "target", "phone", "lightbulb", "calendar", "list-todo", "video", "book", "gavel", "folder"];

  function userModel(i, extra) {
    extra = extra || {};
    var key = extra.iconKey || USER_KEYS[i % USER_KEYS.length];
    return Object.assign({
      promptModelId: 2000 + i,
      promptModelName: extra.cardTitle || ("Mon CR " + (i + 1)),
      cardTitle: extra.cardTitle || ("Mon CR " + (i + 1)),
      publicDescription: extra.publicDescription || "Format personnalisé pour mes rendez-vous : décisions, responsables, échéances.",
      publicExample: "Décisions · Responsables · Échéances",
      type: "USER",
      promptModelType: "USER",
      iconKey: key,
      iconUrl: iconUrl(key),
      categoryKey: "custom",
      displayOrder: 1000,
      featured: false,
      hasHtml: i % 3 === 0,
      pinned: i < 2,
      isDefault: false,
      canUse: true,
      canSetDefault: true,
      canPin: true,
      canCopyOfficial: false,
      canDuplicate: true,
      canEdit: true,
      canDelete: true,
      canManageVersions: true,
      dtCreation: Date.now() - i * 86400000,
      dtUpdate: Date.now() - i * 3600000
    }, extra);
  }

  function packFor(persona) {
    var models = official();
    var edition = "ent";
    if (persona === "free") edition = "free";
    if (persona === "pro") edition = "pro";
    models.push(cseLocked(8, "PV de réunion plénière CSE"));
    models.push(cseLocked(9, "PV CSSCT"));
    if (persona === "free") {
      models.forEach(function (m) { m.canCopyOfficial = false; m.canDuplicate = false; });
    } else if (persona === "pro") {
      models.push(userModel(0, { cardTitle: "Mon compte rendu client", isDefault: true }));
      models.push(userModel(1, { cardTitle: "Note projet interne" }));
      models.push(userModel(2, { cardTitle: "Suivi commercial", promptModelStatus: "PENDING" }));
      models.forEach(function (m) { if (m.promptModelId === 0) m.isDefault = false; });
    } else {
      models.push(userModel(0, { cardTitle: "Comité de direction hebdo", isDefault: true, pinned: true }));
      models.push(userModel(1, { cardTitle: "Entretien annuel RH" }));
      models.push(userModel(2, { cardTitle: "Point projet client (en création)", promptModelStatus: "PENDING" }));
      var n = persona === "business-dense" ? 48 : 12;
      for (var i = 3; i < n; i++) models.push(userModel(i));
      models.forEach(function (m) { if (m.promptModelId === 0) m.isDefault = false; });
    }
    var pinCount = models.filter(function (m) { return m.pinned; }).length;
    return {
      models: models,
      defaultPromptModelId: (models.filter(function (m) { return m.isDefault; })[0] || {}).promptModelId,
      pinCount: pinCount,
      pinMax: 5,
      creds: { email: "preview@agilotext.com", token: "mock", edition: edition },
      access: { hasCse: false, noun: "compte rendu", sources: [], businessTypes: [] }
    };
  }

  function guessIcon(name) {
    var n = String(name || "").toLowerCase();
    if (/cse|élu|pv/.test(n)) return "users";
    if (/client|vente|commercial|devis/.test(n)) return "handshake";
    if (/rh|entretien|recrut/.test(n)) return "phone";
    if (/codir|comité|direction|comex/.test(n)) return "conference-room";
    if (/formation|cours|atelier/.test(n)) return "graduation-cap";
    if (/juridi|contrat|délib/.test(n)) return "gavel";
    if (/santé|médic|hôpital/.test(n)) return "hospital";
    if (/projet|action|suivi/.test(n)) return "list-todo";
    return "file-text";
  }

  function patchApi(store) {
    var Api = global.AgiloLibraryApi;
    Api.canCreate = function (creds) { return creds && creds.edition !== "free"; };
    Api.setDefault = function (creds, id) {
      store.models.forEach(function (m) { m.isDefault = Number(m.promptModelId) === Number(id); });
      return delay({ ok: true, data: {} });
    };
    Api.setPinned = function (creds, id, pinned) {
      var n = store.models.filter(function (m) { return m.pinned; }).length;
      if (pinned && n >= 5) return delay({ ok: false, code: "error_pin_limit", message: "5 épingles maximum. Désépinglez un modèle d’abord." });
      store.models.forEach(function (m) { if (Number(m.promptModelId) === Number(id)) m.pinned = !!pinned; });
      return delay({ ok: true, data: {} });
    };
    Api.duplicate = function (creds, sourceId, name) {
      var src = store.models.filter(function (m) { return Number(m.promptModelId) === Number(sourceId); })[0];
      var copy = userModel(store.models.length, { cardTitle: name, publicDescription: src && src.publicDescription, iconKey: (src && src.iconKey) || "custom" });
      store.models.push(copy);
      return delay({ ok: true, data: { promptModelId: copy.promptModelId }, promptModelId: copy.promptModelId });
    };
    Api.rename = function (creds, id, name) {
      store.models.forEach(function (m) { if (Number(m.promptModelId) === Number(id)) { m.cardTitle = name; m.promptModelName = name; } });
      return delay({ ok: true, data: {} });
    };
    Api.deleteModel = function (creds, id) {
      store.models = store.models.filter(function (m) { return Number(m.promptModelId) !== Number(id); });
      return delay({ ok: true, data: {} });
    };
    Api.listVersions = function () {
      return delay({
        ok: true,
        versions: [
          { versionId: "v3", label: "Actuelle", createdAt: new Date().toISOString(), isCurrent: true },
          { versionId: "v2", label: "Après personnalisation", createdAt: new Date(Date.now() - 86400000).toISOString(), isCurrent: false },
          { versionId: "v1", label: "Création", createdAt: new Date(Date.now() - 172800000).toISOString(), isCurrent: false }
        ]
      });
    };
    Api.restoreVersion = function () { return delay({ ok: true, data: {} }); };
    Api.createFromWizard = function (creds, draft) {
      var copy = userModel(store.models.length, {
        cardTitle: draft.name,
        publicDescription: draft.objective,
        publicExample: draft.structure,
        iconKey: draft.iconKey || guessIcon(draft.name),
        promptModelStatus: "PENDING",
        pinned: false,
        hasHtml: false
      });
      store.models.push(copy);
      return delay({ ok: true, data: { promptModelId: copy.promptModelId, iconKey: copy.iconKey, iconUrl: copy.iconUrl } }, 600);
    };
    Api.waitPromptReady = function (creds, id) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          store.models.forEach(function (m) { if (Number(m.promptModelId) === Number(id)) m.promptModelStatus = "READY"; });
          resolve({ ok: true, status: "READY" });
        }, 2500);
      });
    };
    Api.fetchLists = function () {
      return delay({
        models: store.models,
        defaultPromptModelId: (store.models.filter(function (m) { return m.isDefault; })[0] || {}).promptModelId,
        pinCount: store.models.filter(function (m) { return m.pinned; }).length,
        pinMax: 5
      }, 80);
    };
    Api.getPromptIconCatalog = function () { return delay({ ok: true, icons: ICONS.slice() }, 250); };
    Api.suggestPromptModelIcon = function (creds, name) {
      return delay({ ok: true, iconKey: guessIcon(name), confidence: 0.86 }, 500);
    };
    Api.setPromptModelUserIcon = function (creds, id, key) {
      store.models.forEach(function (m) {
        if (Number(m.promptModelId) === Number(id)) { m.iconKey = key; m.iconUrl = iconUrl(key); }
      });
      return delay({ ok: true, data: {} });
    };
    Api.getPromptContent = function (creds, id) {
      var m = store.models.filter(function (x) { return Number(x.promptModelId) === Number(id); })[0];
      var txt = PROMPT_SAMPLE.replace("compte rendu professionnel", "compte rendu « " + ((m && m.cardTitle) || id) + " »");
      return delay({ ok: true, data: { promptModelContent: txt }, text: txt }, 450);
    };
    Api.forgetPromptContent = function () {};
    Api.track = function (name, params) {
      try { console.info("[track]", name, params || {}); } catch (_) { /* ignore */ }
      return true;
    };
  }

  function delay(value, ms) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms == null ? 120 : ms); });
  }

  /** Studio factice : panneau plein écran, bouton Enregistrer sous → événement agilo-ps-models-changed. */
  function installFakeStudio(store) {
    if (global.AgiloPromptStudio) return;
    var panel = null;
    function close() {
      if (panel) panel.remove();
      panel = null;
      document.body.classList.remove("agilo-ps-lock");
    }
    global.AgiloPromptStudio = {
      openModalAndSelect: function (id, overrides) {
        var m = store.models.filter(function (x) { return String(x.promptModelId) === String(id); })[0];
        var auth = overrides && overrides.getAuth ? overrides.getAuth() : null;
        document.body.classList.add("agilo-ps-lock");
        panel = document.createElement("div");
        panel.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(31,33,36,.55);display:flex;align-items:center;justify-content:center;padding:1rem";
        panel.innerHTML =
          '<div style="background:#fff;border-radius:12px;max-width:44rem;width:100%;padding:1.25rem;font-family:inherit">' +
          '<h2 style="margin:0 0 .5rem;font-size:1.1rem">Prompt Studio (factice) · ' + (m ? m.cardTitle : id) + "</h2>" +
          '<p style="margin:0 0 .75rem;color:#525252;font-size:.85rem">getAuth → ' + (auth ? auth.username + " / " + auth.edition : "null") + "</p>" +
          '<textarea style="width:100%;min-height:14rem;font:12px/1.5 ui-monospace,monospace;border:1px solid #343a4040;border-radius:8px;padding:.6rem">' +
          PROMPT_SAMPLE.replace(/</g, "&lt;") + "</textarea>" +
          '<div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.75rem">' +
          '<button type="button" data-fs="saveas" style="min-height:40px;padding:0 .9rem;border-radius:10px;border:1px solid #174a96;background:#174a96;color:#fff;font:inherit">Enregistrer sous</button>' +
          '<button type="button" data-fs="close" style="min-height:40px;padding:0 .9rem;border-radius:10px;border:1px solid #343a4040;background:#fff;font:inherit">Fermer</button>' +
          "</div></div>";
        document.body.appendChild(panel);
        panel.addEventListener("click", function (e) {
          var b = e.target.closest("[data-fs]");
          if (!b) return;
          if (b.getAttribute("data-fs") === "saveas") {
            var copy = userModel(store.models.length, { cardTitle: (m ? m.cardTitle : "Modèle") + " V2", iconKey: m && m.iconKey, pinned: false });
            store.models.push(copy);
            global.dispatchEvent(new CustomEvent("agilo-ps-models-changed", { detail: { promptId: copy.promptModelId, promptName: copy.cardTitle } }));
          }
          close();
        });
      },
      init: function () {}
    };
  }

  function mount(host, persona) {
    var key = persona === "business-dense" ? "business-dense" : (persona || "business");
    var built = packFor(key);
    var store = { models: built.models };
    patchApi(store);
    installFakeStudio(store);
    var Cat = global.AgiloLibraryCatalogV2 || global.AgiloLibraryCatalog;
    if (global.AgiloLibraryApi.setActiveCreds) global.AgiloLibraryApi.setActiveCreds(built.creds);
    Cat.mount(host, built.creds, built.access, { models: store.models, pinMax: 5, pinCount: built.pinCount });
    var screen = "";
    try { screen = new URLSearchParams(location.search).get("screen") || ""; } catch (_) { screen = ""; }
    if (screen === "creating" || screen === "created" || screen === "pending") {
      var st = Cat._state && Cat._state();
      var Wiz = global.AgiloLibraryWizardV2;
      if (st && Wiz) {
        Wiz.reset({ restore: false });
        st.wizardOpen = true;
        st.creating = screen === "creating";
        if (screen === "creating") {
          st.created = null;
          st.createdPending = false;
        } else {
          var um = store.models.filter(function (m) { return m.type === "USER"; })[0] || store.models[0];
          st.created = um;
          st.createdPending = screen === "pending";
          st.creating = false;
        }
        if (typeof Cat._paint === "function") Cat._paint(host);
      }
    }
  }

  global.AgiloLibraryPreviewMock = { mount: mount, packFor: packFor, ICONS: ICONS, PROMPT_SAMPLE: PROMPT_SAMPLE };
})(typeof window !== "undefined" ? window : globalThis);
