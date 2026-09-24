/**
 * Découpe Prénom / Nom pour corriger l'orthographe d'un interlocuteur.
 * Tests : node scripts/pages/editor/confidence-v1/agilo-speaker-name.test.mjs
 * Copie runtime dans Code-main-editor-IFRAME_V04-confidence.js (un pin).
 */
(function (root) {
  'use strict';

  var PARTICLES = { de: 1, du: 1, des: 1, van: 1, von: 1, di: 1, le: 1 };

  function isJunkSpeakerLabel(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return true;
    return /^(speaker|locuteur|spk)[\s._-]*\d+$/i.test(t);
  }

  function isPersonNameLabel(s) {
    return !isJunkSpeakerLabel(s);
  }

  function displayLabel(s) {
    return String(s == null ? '' : s).trim();
  }

  function splitPersonName(label) {
    var parts = String(label || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { prenom: '', nom: '' };
    if (parts.length === 1) return { prenom: parts[0], nom: '' };
    var nomStart = parts.length - 1;
    if (parts.length >= 3 && PARTICLES[String(parts[parts.length - 2]).toLowerCase()]) {
      nomStart = parts.length - 2;
    }
    return {
      prenom: parts.slice(0, nomStart).join(' '),
      nom: parts.slice(nomStart).join(' ')
    };
  }

  function joinPersonName(prenom, nom) {
    var a = String(prenom || '').trim();
    var b = String(nom || '').trim();
    if (a && b) return a + ' ' + b;
    return a || b;
  }

  root.AgiloSpeakerName = {
    isPersonNameLabel: isPersonNameLabel,
    displayLabel: displayLabel,
    splitPersonName: splitPersonName,
    joinPersonName: joinPersonName
  };
})(typeof window !== 'undefined' ? window : globalThis);
