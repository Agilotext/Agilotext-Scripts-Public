/**
 * Métadonnées publiques des modèles Agilotext 0–7.
 * Fallback si le serveur n’a pas encore seedé standard_prompt_model_metadata.
 * Aucun promptContent ici.
 * @version 1.3.0
 */
(function (global) {
  "use strict";

  var CATEGORIES = [
    { key: "all", label: "Tous" },
    { key: "general", label: "Réunions" },
    { key: "rh", label: "RH" },
    { key: "cse", label: "CSE / PV" },
    { key: "dictation", label: "Dictée" },
    { key: "webinar", label: "Webinaire" },
    { key: "sales", label: "Commercial" },
    { key: "strategy", label: "Stratégie" },
    { key: "education", label: "Formation" },
    { key: "legacy", label: "Anciens modèles" }
  ];

  var BY_ID = {
    0: {
      cardTitle: "Compte rendu de réunion",
      publicDescription: "Compte rendu polyvalent pour une réunion professionnelle, un point projet ou un rendez-vous client.",
      publicExample: "Décisions, actions et responsables · Points d’accord · Prochaine étape datée",
      iconKey: "document",
      categoryKey: "general",
      sortOrder: 10,
      featured: true
    },
    7: {
      cardTitle: "Procès-verbal CSE",
      publicDescription: "Procès-verbal détaillé et chronologique d’une réunion plénière du CSE, avec attribution des échanges, décisions et votes.",
      publicExample: "Ordre du jour et quorum · Questions des élus · Votes, décisions et annexes",
      iconKey: "meeting",
      categoryKey: "cse",
      sortOrder: 20,
      featured: true
    },
    6: {
      cardTitle: "Dictée vocale",
      publicDescription: "Mise en forme fidèle d’une dictée vocale, avec application des commandes de ponctuation et de présentation.",
      publicExample: "Fidélité à l’oral · Commandes de ponctuation · Aucun résumé du fond",
      iconKey: "report",
      categoryKey: "dictation",
      sortOrder: 30,
      featured: true
    },
    1: {
      cardTitle: "Compte rendu de webinaire",
      publicDescription: "Compte rendu pédagogique d’un webinaire, structuré autour des intervenants, enseignements et questions-réponses.",
      publicExample: "Intervenants et déroulé · Enseignements clés · Questions-réponses",
      iconKey: "report",
      categoryKey: "webinar",
      sortOrder: 40,
      featured: false
    },
    3: {
      cardTitle: "Compte rendu commercial CAB",
      publicDescription: "Compte rendu commercial structuré selon la méthode CAB : caractéristiques, avantages et bénéfices.",
      publicExample: "Caractéristiques entendues · Avantages perçus · Bénéfices et prochaine relance",
      iconKey: "briefcase",
      categoryKey: "sales",
      sortOrder: 50,
      featured: false
    },
    2: {
      cardTitle: "Analyse SWOT",
      publicDescription: "Analyse d’une réunion selon les forces, faiblesses, opportunités et menaces.",
      publicExample: "Quatre quadrants SWOT · Faits entendus · Pistes d’action",
      iconKey: "idea",
      categoryKey: "strategy",
      sortOrder: 60,
      featured: false
    },
    4: {
      cardTitle: "Résumé de cours",
      publicDescription: "Résumé pédagogique d’un cours ou d’une formation, avec notions clés, exemples et ressources.",
      publicExample: "Notions à retenir · Exemples cités · Ressources mentionnées",
      iconKey: "education",
      categoryKey: "education",
      sortOrder: 70,
      featured: false
    },
    5: {
      cardTitle: "PV générique (ancien)",
      publicDescription: "Ancien modèle de procès-verbal générique, conservé pour compatibilité avec les usages existants.",
      publicExample: "Décisions · Actions · Informations",
      iconKey: "document",
      categoryKey: "legacy",
      sortOrder: 80,
      featured: false
    }
  };

  function get(id) {
    return BY_ID[Number(id)] || null;
  }

  function applyTo(card) {
    if (!card) return card;
    var meta = get(card.promptModelId);
    if (!meta) return card;
    if (!card.publicDescription) card.publicDescription = meta.publicDescription;
    if (!card.publicExample) card.publicExample = meta.publicExample;
    var key = String(card.iconKey || "");
    var live = global.AgiloLibraryApi && global.AgiloLibraryApi.cfg && global.AgiloLibraryApi.cfg().library2Live;
    if (!live) {
      if (global.AgiloLibraryCore && global.AgiloLibraryCore.resolveIconKey && key) {
        key = global.AgiloLibraryCore.resolveIconKey(key);
      }
      if (!key || key === "document" || key === "custom") card.iconKey = meta.iconKey;
      else card.iconKey = key;
    }
    var cat = String(card.categoryKey || "");
    if (!cat || cat === "custom" || (cat === "general" && meta.categoryKey !== "general")) {
      card.categoryKey = meta.categoryKey;
    }
    if (!card.featured && meta.featured) card.featured = true;
    var order = Number(card.displayOrder || card.sortOrder || 0);
    if (!order || order === 1000) card.displayOrder = meta.sortOrder;
    if (meta.cardTitle && card.type === "STANDARD") {
      var raw = String(card.cardTitle || card.promptModelName || "");
      var looksOfficial = /modèle par default|proces-verbal|procès-verbal|dictée vocale avec|compte rendu de webinaire|compte rendu swot|modèle pour commerciaux|pv générique|résumé de cours/i.test(raw);
      if (!raw || looksOfficial) card.cardTitle = meta.cardTitle;
    }
    return card;
  }

  global.AgiloLibraryStandards = {
    VERSION: "1.3.0",
    CATEGORIES: CATEGORIES,
    BY_ID: BY_ID,
    get: get,
    applyTo: applyTo
  };
})(typeof window !== "undefined" ? window : globalThis);
