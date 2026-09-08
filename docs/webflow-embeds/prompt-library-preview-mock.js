/**
 * Jeux de données locaux pour l’aperçu file:// (?mock=free|pro|business).
 * Jamais chargé dans l’embed Webflow.
 */
(function (global) {
  "use strict";

  function official() {
    var meta = global.AgiloLibraryStandards.BY_ID;
    return Object.keys(meta).map(function (id) {
      var m = meta[id];
      return {
        promptModelId: Number(id),
        promptModelName: m.cardTitle,
        cardTitle: m.cardTitle,
        publicDescription: m.publicDescription,
        publicExample: m.publicExample,
        type: "STANDARD",
        promptModelType: "STANDARD",
        iconKey: m.iconKey,
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

  function userModel(i, extra) {
    extra = extra || {};
    return Object.assign({
      promptModelId: 2000 + i,
      promptModelName: extra.cardTitle || ("Mon CR " + (i + 1)),
      cardTitle: extra.cardTitle || ("Mon CR " + (i + 1)),
      publicDescription: extra.publicDescription || "Format personnalisé pour mes rendez-vous.",
      publicExample: "Décisions · Responsables · Échéances",
      type: "USER",
      promptModelType: "USER",
      iconKey: extra.iconKey || "custom",
      categoryKey: extra.categoryKey || "custom",
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
    if (persona === "free") {
      models.forEach(function (m) { m.canCopyOfficial = false; m.canDuplicate = false; });
    } else if (persona === "pro") {
      models.push(userModel(0, { cardTitle: "Mon compte rendu client", isDefault: true }));
      models.push(userModel(1, { cardTitle: "Note projet interne" }));
      models.push(userModel(2, { cardTitle: "Suivi commercial" }));
      models.forEach(function (m) { if (m.promptModelId === 0) m.isDefault = false; });
    } else {
      models.push(userModel(0, { cardTitle: "Mon compte rendu client", isDefault: true, pinned: true }));
      var n = persona === "business-dense" ? 48 : 12;
      for (var i = 1; i < n; i++) models.push(userModel(i));
      models.forEach(function (m) { if (m.promptModelId === 0) m.isDefault = false; });
    }
    var pinCount = models.filter(function (m) { return m.pinned; }).length;
    return {
      models: models,
      defaultPromptModelId: models.filter(function (m) { return m.isDefault; })[0].promptModelId,
      pinCount: pinCount,
      pinMax: 5,
      creds: { email: "preview@agilotext.com", token: "mock", edition: edition },
      access: { hasCse: false, noun: "compte rendu", sources: [] }
    };
  }

  function patchApi(store) {
    var Api = global.AgiloLibraryApi;
    Api.canCreate = function (creds) {
      return creds && creds.edition !== "free";
    };
    Api.setDefault = function (creds, id) {
      store.models.forEach(function (m) { m.isDefault = Number(m.promptModelId) === Number(id); });
      return Promise.resolve({ ok: true, data: {} });
    };
    Api.setPinned = function (creds, id, pinned) {
      var n = store.models.filter(function (m) { return m.pinned; }).length;
      if (pinned && n >= 5) {
        return Promise.resolve({ ok: false, code: "error_pin_limit", message: "5 épingles maximum. Désépingle un modèle d’abord." });
      }
      store.models.forEach(function (m) {
        if (Number(m.promptModelId) === Number(id)) m.pinned = !!pinned;
      });
      return Promise.resolve({ ok: true, data: {} });
    };
    Api.duplicate = function (creds, sourceId, name) {
      var src = store.models.filter(function (m) { return Number(m.promptModelId) === Number(sourceId); })[0];
      var copy = userModel(store.models.length, {
        cardTitle: name,
        publicDescription: src && src.publicDescription,
        iconKey: (src && src.iconKey) || "custom"
      });
      store.models.push(copy);
      return Promise.resolve({ ok: true, data: { promptModelId: copy.promptModelId } });
    };
    Api.rename = function (creds, id, name) {
      store.models.forEach(function (m) {
        if (Number(m.promptModelId) === Number(id)) m.cardTitle = name;
      });
      return Promise.resolve({ ok: true, data: {} });
    };
    Api.deleteModel = function (creds, id) {
      store.models = store.models.filter(function (m) { return Number(m.promptModelId) !== Number(id); });
      return Promise.resolve({ ok: true, data: {} });
    };
    Api.listVersions = function () {
      return Promise.resolve({
        ok: true,
        versions: [
          { versionId: "v3", label: "Actuelle", createdAt: new Date().toISOString(), isCurrent: true },
          { versionId: "v2", label: "Après personnalisation", createdAt: new Date(Date.now() - 86400000).toISOString(), isCurrent: false },
          { versionId: "v1", label: "Création", createdAt: new Date(Date.now() - 172800000).toISOString(), isCurrent: false }
        ]
      });
    };
    Api.restoreVersion = function () { return Promise.resolve({ ok: true, data: {} }); };
    Api.createFromWizard = function (creds, draft) {
      var copy = userModel(store.models.length, {
        cardTitle: draft.name,
        publicDescription: draft.objective,
        publicExample: draft.structure,
        iconKey: "wand"
      });
      store.models.push(copy);
      return Promise.resolve({ ok: true, data: { promptModelId: copy.promptModelId } });
    };
    Api.waitPromptReady = function (creds, id) {
      return Promise.resolve({ ok: true, status: "READY" });
    };
    Api.fetchLists = function () {
      return Promise.resolve({
        models: store.models,
        defaultPromptModelId: (store.models.filter(function (m) { return m.isDefault; })[0] || {}).promptModelId,
        pinCount: store.models.filter(function (m) { return m.pinned; }).length,
        pinMax: 5
      });
    };
  }

  function mount(host, persona) {
    var key = persona === "business-dense" ? "business-dense" : (persona || "business");
    if (key === "business") key = "business";
    var built = packFor(key);
    var store = { models: built.models };
    patchApi(store);
    global.AgiloLibraryCatalog.mount(host, built.creds, built.access, {
      models: store.models,
      pinMax: 5,
      pinCount: built.pinCount
    });
  }

  global.AgiloLibraryPreviewMock = { mount: mount, packFor: packFor };
})(typeof window !== "undefined" ? window : globalThis);
