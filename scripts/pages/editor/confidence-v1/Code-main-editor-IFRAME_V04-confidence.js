// Agilotext - Main Editor (Transcript Editor Principal)
// BRANCHE TEST CONFIDENCE — ne pas remplacer V04 prod
// Prod : ../Code-main-editor-IFRAME_V04.js (inchangé)
// ⚠️ Ce fichier est chargé depuis GitHub (confidence-v1)
// Correspond à: code-main-editor dans Webflow

(function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn, { once: true });
})(() => {
  'use strict';

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const editorRoot = document.getElementById('editorRoot');
  const SOFT_CANCEL = true;

  const EDITION = (function () {
    const raw = window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || editorRoot?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'ent';
    const v = String(raw || '').toLowerCase().trim();
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    return 'ent';
  })();

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const waitFrames = (n = 1) => new Promise(res => {
    const step = i => i ? requestAnimationFrame(() => step(i - 1)) : res();
    step(Math.max(1, n));
  });

  // JSON Nico -> UI
  const msToSec = ms => Math.max(0, Math.floor((+ms || 0) / 1000));
  const decodeNL = s => String(s || '')
    .replace(/\\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  function mapNicoJsonToSegments(j) {
    const arr = Array.isArray(j?.segments) ? j.segments : [];
    return arr.map((r, i) => ({
      id: r.id || `s${i}`,
      start: msToSec(r.milli_start),
      end: Number.isFinite(r.milli_end) ? msToSec(r.milli_end) : null,
      speaker: String(r.speaker || '').trim(),
      text: decodeNL(r.text)
    }));
  }


  function isVisible(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return !el.hasAttribute('hidden') && cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function tokenKey(email, edition) {
    return `agilo:token:${String(edition || 'ent').toLowerCase()}:${String(email || '').toLowerCase()}`;
  }

  // ⚡️ CUSTOM SCROLL HELPER
  function agiloFindScrollContainer(el) {
    for (let p = el?.parentElement; p; p = p.parentElement) {
      if (p === document.body || p === document.documentElement) break;
      const cs = getComputedStyle(p);
      const oy = cs.overflowY || cs.overflow;
      const ox = cs.overflowX || cs.overflow;
      const scrollableY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && p.scrollHeight > p.clientHeight + 2;
      const scrollableX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && p.scrollWidth > p.clientWidth + 2;
      if (scrollableY || scrollableX) return p;
    }
    return null;
  }
  function agiloIsOutOfView(el, container, { top = 100, bottom = 120 } = {}) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!container || container === document.body || container === document.documentElement) {
      return (r.top < top) || (r.bottom > innerHeight - bottom);
    }
    const c = container.getBoundingClientRect();
    return (r.top < c.top + top) || (r.bottom > c.bottom - bottom);
  }
  function agiloScrollIntoView(el, { behavior = 'smooth', block = 'center', allowWindow = true } = {}) {
    if (!el) return;
    const pane = el.closest('.edtr-pane, .ag-panel, #pane-transcript, #pane-summary, #pane-chat');
    const container = agiloFindScrollContainer(el) || agiloFindScrollContainer(pane) || pane;
    if (container && container !== document.body && container !== document.documentElement) {
      const r = el.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const currentScroll = container.scrollTop;
      const relTop = r.top - c.top;
      const desiredRelTop = (container.clientHeight / 2) - (el.offsetHeight / 2);
      container.scrollTo({ top: currentScroll + relTop - desiredRelTop, behavior });
      return;
    }
    if (allowWindow) {
      el.scrollIntoView({ behavior, block });
    }
  }

  function trimSplitNewlines(left, right) {
    const leftClean = String(left ?? '').replace(/\n+$/, '');
    const rightClean = String(right ?? '').replace(/^\n+/, '');
    return { left: leftClean, right: rightClean };
  }
  function shouldScrollFollow(armed, outOfView) {
    return !!armed && !!outOfView;
  }
  function resolveActiveSegmentIndex(currentTime, segments, activeSeg) {
    if (!Array.isArray(segments) || !segments.length) return -1;
    const t = Number(currentTime) || 0;
    const inSeg = (s) => Number.isFinite(s.start) && Number.isFinite(s.end) && t >= s.start && t < s.end;
    let k = activeSeg;
    if (k < 0 || !inSeg(segments[k])) k = segments.findIndex(inSeg);
    return k;
  }
  function foldSpeakerSearch(s) {
    return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function isJunkSpeakerLabel(s) {
    const t = String(s ?? '').trim();
    if (!t) return true;
    return /^(speaker|locuteur|spk)[\s._-]*\d+$/i.test(t);
  }
  var SPEAKER_NAME_PARTICLES = { de: 1, du: 1, des: 1, van: 1, von: 1, di: 1, le: 1 };
  function isPersonNameLabel(s) {
    return !isJunkSpeakerLabel(s);
  }
  function splitPersonName(label) {
    const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { prenom: '', nom: '' };
    if (parts.length === 1) return { prenom: parts[0], nom: '' };
    let nomStart = parts.length - 1;
    if (parts.length >= 3 && SPEAKER_NAME_PARTICLES[String(parts[parts.length - 2]).toLowerCase()]) {
      nomStart = parts.length - 2;
    }
    return {
      prenom: parts.slice(0, nomStart).join(' '),
      nom: parts.slice(nomStart).join(' ')
    };
  }
  function joinPersonName(prenom, nom) {
    const a = String(prenom || '').trim();
    const b = String(nom || '').trim();
    if (a && b) return a + ' ' + b;
    return a || b;
  }
  function filterSpeakerRoster(names, query) {
    const list = Array.isArray(names) ? names : [];
    const q = foldSpeakerSearch(query);
    if (!q) return list.slice();
    return list.filter((n) => foldSpeakerSearch(n).includes(q));
  }
  function shouldCreateSpeakerFromQuery(query, names) {
    const q = foldSpeakerSearch(String(query ?? '').trim());
    if (!q) return false;
    const list = Array.isArray(names) ? names : [];
    return !list.some((n) => foldSpeakerSearch(n) === q);
  }
  function speakerRosterStorageKey(jobId) {
    const id = String(jobId ?? '').trim();
    if (!id) return '';
    return 'agilo:speaker-roster:' + id;
  }
  function computePopoverPlace({ anchor, size, viewport, pad, stickyBottom } = {}) {
    const a = anchor || {};
    const w = Number(size && size.width) || 0;
    const h = Number(size && size.height) || 0;
    const vw = Number(viewport && viewport.width) || 0;
    const vh = Number(viewport && viewport.height) || 0;
    const p = Number.isFinite(Number(pad)) ? Number(pad) : 8;
    const minTop = Math.max(0, Number(stickyBottom) || 0) + p;
    let left = Number(a.left) || 0;
    left = Math.max(p, Math.min(left, vw - w - p));
    let top = (Number(a.bottom) || 0) + p;
    if (top + h > vh - p) top = (Number(a.top) || 0) - h - p;
    top = Math.max(minTop, Math.min(top, vh - h - p));
    return { top, left };
  }
  function anchorVisibleInPane(anchor, pane) {
    const a = anchor || {};
    const view = pane || {};
    const ar = {
      left: Number(a.left) || 0,
      top: Number(a.top) || 0,
      right: Number.isFinite(Number(a.right)) ? Number(a.right) : (Number(a.left) || 0),
      bottom: Number.isFinite(Number(a.bottom)) ? Number(a.bottom) : (Number(a.top) || 0)
    };
    const pr = {
      left: Number(view.left) || 0,
      top: Number(view.top) || 0,
      right: Number.isFinite(Number(view.right)) ? Number(view.right) : Infinity,
      bottom: Number.isFinite(Number(view.bottom)) ? Number(view.bottom) : Infinity
    };
    return !(ar.right <= pr.left || ar.left >= pr.right || ar.bottom <= pr.top || ar.top >= pr.bottom);
  }
  function clampOffset(n, max) {
    const m = Math.max(0, Number(max) || 0);
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(Math.floor(v), m));
  }
  function sliceTextAt(text, offset) {
    const s = String(text ?? '');
    const off = clampOffset(offset, s.length);
    return { left: s.slice(0, off), right: s.slice(off) };
  }
  function computeMidStart(start, end) {
    const hasS = start != null && start !== '' && Number.isFinite(Number(start));
    const hasE = end != null && end !== '' && Number.isFinite(Number(end));
    if (!hasS && !hasE) return null;
    const s = hasS ? Number(start) : 0;
    const e = hasE ? Number(end) : (hasS ? Number(start) + 1 : 1);
    return Math.round((s + e) / 2);
  }
  function hasSpeakerLabels(segments) {
    const list = Array.isArray(segments) ? segments : [];
    const speakers = list.map((seg) => String((seg && seg.speaker) || '').trim());
    const unique = [];
    const seen = Object.create(null);
    speakers.forEach((name) => {
      if (seen[name]) return;
      seen[name] = 1;
      unique.push(name);
    });
    if (unique.length === 1 && (unique[0] === '' || unique[0] === 'Speaker_A')) return false;
    return unique.length > 1 || (unique.length === 1 && unique[0] !== '' && unique[0] !== 'Speaker_A');
  }
  function createFollowController(opts) {
    let armed = true;
    let programmatic = false;
    const onChange = opts && typeof opts.onChange === 'function' ? opts.onChange : null;
    function setArmed(next) {
      const v = !!next;
      if (armed === v) return;
      armed = v;
      if (onChange) onChange(armed);
    }
    return {
      get armed() { return armed; },
      get programmatic() { return programmatic; },
      arm() { setArmed(true); },
      disarm() { if (!programmatic) setArmed(false); },
      beginProgrammatic() { programmatic = true; },
      endProgrammatic() { programmatic = false; },
      shouldScroll(outOfView) { return shouldScrollFollow(armed, outOfView); }
    };
  }
  window.AgiloTranscriptComfort = window.AgiloTranscriptComfort || {
    trimSplitNewlines, shouldScrollFollow, resolveActiveSegmentIndex,
    foldSpeakerSearch, isJunkSpeakerLabel, filterSpeakerRoster, shouldCreateSpeakerFromQuery, speakerRosterStorageKey,
    computePopoverPlace, anchorVisibleInPane,
    clampOffset, sliceTextAt, computeMidStart, hasSpeakerLabels,
    createFollowController
  };

  function dispatchTranscriptFollow(armed) {
    try {
      document.dispatchEvent(new CustomEvent('agilo:transcript-follow', { detail: { armed: !!armed } }));
    } catch { /* ignore */ }
  }
  function removePaneFollowLeftover() {
    const css = document.getElementById('agilo-transcript-follow-css');
    if (css) css.remove();
    const leftover = document.getElementById('agilo-transcript-follow');
    if (!leftover) return;
    if (leftover.closest('#agilo-audio-sticky')) return;
    if (leftover.closest('#agilo-audio-wrap')) return;
    if (leftover.closest('#ag-editor-chrome-dock')) return;
    if (leftover.closest('#pane-transcript')) leftover.remove();
  }
  function bindFollowPause(sc) {
    const follow = window.AgiloTranscriptFollow;
    if (!follow || !sc || sc.__followPauseBound) return;
    sc.__followPauseBound = true;
    const pause = () => follow.disarm();
    sc.addEventListener('wheel', pause, { passive: true });
    sc.addEventListener('touchmove', pause, { passive: true });
  }
  function applySplitTrimNearCaret() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const n = sel.anchorNode;
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const seg = el && el.closest && el.closest('.ag-seg');
    if (!seg) return;
    const prev = (seg.previousElementSibling && seg.previousElementSibling.classList.contains('ag-seg'))
      ? seg.previousElementSibling : null;
    const nextBox = seg.querySelector('.ag-seg__text');
    const prevBox = prev && prev.querySelector('.ag-seg__text');
    if (!nextBox) return;
    const cleaned = trimSplitNewlines(prevBox ? prevBox.textContent : '', nextBox.textContent || '');
    if (prevBox && prevBox.textContent !== cleaned.left) prevBox.textContent = cleaned.left;
    if (nextBox.textContent !== cleaned.right) nextBox.textContent = cleaned.right;
    try { if (typeof window.syncDomToModel === 'function') window.syncDomToModel(); } catch { }
  }
  function bindSplitTrim() {
    if (document.__agiloSplitTrimBound) return;
    document.__agiloSplitTrimBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest('.ag-ux-plus')) return;
      if (e.target.closest('.ag-speaker-picker')) return;
      startPlusSpeakerFlow(e);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (!isPlusSpeakerShortcut(e)) return;
      startPlusSpeakerFlow(e);
    }, true);
  }

  function pickTranscriptEl() {
    return byId('transcriptEditor') || byId('ag-transcript') || document.querySelector('[data-editor="transcript"]') || null;
  }
  function pickSummaryEl() {
    return byId('summaryEditor') || byId('ag-summary') || document.querySelector('[data-editor="summary"]') || null;
  }
  const editors = {
    transcript: pickTranscriptEl(),
    summary: pickSummaryEl(),
    conversation: byId('conversationEditor') || byId('ag-conversation') || null
  };

  if (!window.__agiloSummaryMailCopyListener) {
    window.__agiloSummaryMailCopyListener = true;
    window.addEventListener('message', (ev) => {
      try {
        const d = ev.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === 'agilo:summary-mail-copy' && d.ok) {
          if (typeof window.toast === 'function') {
            window.toast(d.mode === 'html' ? 'HTML du mail copié dans le presse-papier' : 'Texte du mail copié');
          }
          return;
        }
        if (d.type === 'agilo:summary-open-chat') {
          if (typeof openChatTab === 'function') openChatTab();
        }
      } catch (_) { }
    });
  }

  /** Clés V3_STRUCT (templates type Valtus) : hors de cette liste, les lignes sont du corps multi-lignes. */
  const __AGILO_V3_STRUCT_KEYS = new Set([
    'candidate_name', 'candidate_gender', 'client_name', 'client_company', 'mission_title', 'role_title',
    'years_exp', 'tjm', 'dispo', 'dispo_literal', 'mobility',
    'bullet1_title', 'bullet1_body', 'bullet2_title', 'bullet2_body', 'bullet3_title', 'bullet3_body',
    'closing_reco'
  ]);

  function agiloParseV3StructInner(raw) {
    if (!raw || !String(raw).trim()) return null;
    const lines = String(raw).replace(/\r/g, '').split('\n');
    const out = {};
    let curKey = null;
    const buf = [];
    const flush = () => {
      if (curKey) out[curKey] = buf.join('\n').trim();
      buf.length = 0;
    };
    for (const line of lines) {
      const m = line.match(/^([a-z][a-z0-9_]*)\s*:\s*(.*)$/i);
      const key = m && m[1] ? m[1].toLowerCase() : '';
      if (m && __AGILO_V3_STRUCT_KEYS.has(key)) {
        flush();
        curKey = key;
        buf.push(m[2] != null ? m[2] : '');
      } else if (curKey) {
        buf.push(line);
      }
    }
    flush();
    return out;
  }

  /** Document iframe ou nœud racine du compte-rendu (ex. #summaryEditor en injection directe). */
  function agiloFindV3StructInRoot(root) {
    if (!root) return null;
    const walkTop = root.nodeType === 9
      ? (root.body || root.documentElement)
      : root;
    if (!walkTop) return null;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (!doc) return null;
    try {
      const w = doc.createTreeWalker(walkTop, NodeFilter.SHOW_COMMENT, null, false);
      let n;
      while ((n = w.nextNode())) {
        const d = n.data || '';
        if (d.indexOf('V3_STRUCT') !== -1) {
          return d
            .replace(/^\s*V3_STRUCT\s*/i, '')
            .replace(/\s*END_V3_STRUCT\s*$/i, '')
            .trim();
        }
      }
    } catch (e) { /* ignore */ }
    try {
      const html = root.nodeType === 9
        ? (root.documentElement && root.documentElement.innerHTML)
        : (walkTop.innerHTML || (walkTop.textContent && String(root.outerHTML || '')) || '');
      if (html) {
        const m = String(html).match(/V3_STRUCT\s*([\s\S]*?)\s*END_V3_STRUCT/);
        if (m) return m[1].trim();
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /** Chaîne complète côté API (le round-trip innerHTML de sanitizeHtml efface souvent les commentaires). */
  function agiloFindV3StructInHtmlString(s) {
    if (!s || typeof s !== 'string') return null;
    const m = s.match(/<!--\s*V3_STRUCT\s*([\s\S]*?)\s*END_V3_STRUCT\s*-->/i) ||
      s.match(/V3_STRUCT\s*([\s\S]*?)\s*END_V3_STRUCT/);
    return m ? m[1].trim() : null;
  }

  function agiloEnsureCompteRenduEmailBlockCss(idoc) {
    try {
      if (!idoc.head || idoc.querySelector('link[data-agilo-email-block-css]')) return;
      const link = idoc.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-agilo-email-block-css', '1');
      link.href = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/agilo-iframe-email-block.css?v=3';
      idoc.head.appendChild(link);
    } catch (e) {
      if (window.AGILO_DEBUG) console.warn('[agilo] email block css', e);
    }
  }

  function agiloV3DataToSubjectLine(data) {
    const segs = ['Présentation de profil'];
    if (data.candidate_name) segs.push('— ' + data.candidate_name);
    if (data.role_title) segs.push('— ' + data.role_title);
    if (data.client_company) segs.push('— ' + data.client_company);
    return segs.join(' ');
  }

  function agiloV3DataToBodyPlain(data) {
    if (!data) return '';
    const lines = ['Bonjour,', ''];
    for (let i = 1; i <= 3; i++) {
      const t = data['bullet' + i + '_title'];
      const b = data['bullet' + i + '_body'];
      if (t) {
        lines.push(t);
        if (b) lines.push(b);
        lines.push('');
      } else if (b) {
        lines.push(b, '');
      }
    }
    const info = [];
    if (data.tjm) info.push('TJM (indicatif) : ' + data.tjm + ' €/jour');
    if (data.dispo_literal || data.dispo) info.push('Disponibilité : ' + (data.dispo_literal || data.dispo));
    if (data.mobility) info.push('Mobilité : ' + data.mobility);
    if (info.length) {
      lines.push(info.join(' · '));
      lines.push('');
    }
    if (data.closing_reco) {
      lines.push(data.closing_reco);
      lines.push('');
    }
    lines.push('Cordialement,');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function agiloEscHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function agiloSimpleMdInline(text) {
    return agiloEscHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function agiloSimpleMarkdownToHtml(md) {
    const src = String(md == null ? '' : md).replace(/\r/g, '');
    if (!src.trim()) return '';
    const lines = src.split('\n');
    const out = [];
    let inUl = false;
    let inOl = false;
    const closeLists = function () {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] || '';
      const line = raw.trim();
      if (!line) { closeLists(); continue; }
      const hu = line.match(/^(#{1,6})\s+(.*)$/);
      if (hu) {
        closeLists();
        const lvl = Math.min(6, hu[1].length);
        out.push('<h' + lvl + '>' + agiloSimpleMdInline(hu[2]) + '</h' + lvl + '>');
        continue;
      }
      const lu = line.match(/^[-*]\s+(.*)$/);
      if (lu) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push('<li>' + agiloSimpleMdInline(lu[1]) + '</li>');
        continue;
      }
      const lo = line.match(/^\d+\.\s+(.*)$/);
      if (lo) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push('<li>' + agiloSimpleMdInline(lo[1]) + '</li>');
        continue;
      }
      closeLists();
      out.push('<p>' + agiloSimpleMdInline(line) + '</p>');
    }
    closeLists();
    return out.join('\n');
  }

  function agiloV3DataToBodyDisplayHtml(data) {
    if (!data) return '';
    const parts = ['<p>' + agiloEscHtml('Bonjour,') + '</p>'];
    for (let i = 1; i <= 3; i++) {
      const t = data['bullet' + i + '_title'];
      const b = data['bullet' + i + '_body'];
      if (t) parts.push('<p><strong>' + agiloSimpleMdInline(t) + '</strong></p>');
      if (b) parts.push('<div class="agilo-v3-mail-bodypre">' + agiloSimpleMarkdownToHtml(b) + '</div>');
    }
    const info = [];
    if (data.tjm) info.push('TJM (indicatif) : ' + data.tjm + ' €/jour');
    if (data.dispo_literal || data.dispo) info.push('Disponibilité : ' + (data.dispo_literal || data.dispo));
    if (data.mobility) info.push('Mobilité : ' + data.mobility);
    if (info.length) parts.push('<p>' + agiloEscHtml(info.join(' · ')) + '</p>');
    if (data.closing_reco) parts.push('<div class="agilo-v3-mail-bodypre">' + agiloSimpleMarkdownToHtml(data.closing_reco) + '</div>');
    parts.push('<p>' + agiloEscHtml('Cordialement,') + '</p>');
    return parts.join('\n');
  }

  function agiloWireCompteRenduEmailBlock(targetDoc, block, subject, bodyPlain) {
    if (!targetDoc || !block) return;
    const su = String(subject || '').trim();
    const bt = String(bodyPlain || '');
    const copyText = 'Objet : ' + su + '\n\n' + bt;
    const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(su) + '&body=' + encodeURIComponent(bt);
    const outlookUrl = 'https://outlook.office.com/mail/deeplink/compose?subject=' + encodeURIComponent(su) + '&body=' + encodeURIComponent(bt);
    const mailtoUrl = 'mailto:?subject=' + encodeURIComponent(su) + '&body=' + encodeURIComponent(bt);
    const copyBtn = block.querySelector('.agilo-email-btn-copy');
    const openConversationBtn = block.querySelector('.agilo-summary-open-chat-btn');
    const directGmail = block.querySelector('a[data-agilo-mail-app="gmail"]');
    const directOutlook = block.querySelector('a[data-agilo-mail-app="outlook"]');
    const directDefault = block.querySelector('a[data-agilo-mail-app="default"]');
    const copyIconDefault = copyBtn ? copyBtn.innerHTML : '';
    const copyIconChecked = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="agilo-email-icon copy-icon paste"><path fill="none" d="M0 0h24v24H0z"></path><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>';
    const toastFn = typeof window.toast === 'function' ? window.toast : function () { };
    if (copyBtn) copyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      (async function () {
        try {
          const copyPlainText = async function () {
            if (navigator.clipboard && window.isSecureContext && typeof navigator.clipboard.writeText === 'function') {
              await navigator.clipboard.writeText(copyText);
              return;
            }
            const ta = document.createElement('textarea');
            ta.value = copyText;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          };

          let copyMode = 'text';
          const bodyNode = block.querySelector('.agilo-email-block-body');
          const htmlBody = bodyNode ? String(bodyNode.innerHTML || '').trim() : '';
          const htmlPayload = '<div>'
            + '<p><strong>Objet :</strong> ' + agiloEscHtml(su) + '</p>'
            + htmlBody
            + '</div>';

          if (
            navigator.clipboard && window.isSecureContext
            && typeof navigator.clipboard.write === 'function'
            && typeof window.ClipboardItem !== 'undefined'
            && htmlBody
          ) {
            const item = new ClipboardItem({
              'text/plain': new Blob([copyText], { type: 'text/plain' }),
              'text/html': new Blob([htmlPayload], { type: 'text/html' })
            });
            await navigator.clipboard.write([item]);
            copyMode = 'html';
          } else {
            await copyPlainText();
          }

          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'agilo:summary-mail-copy', ok: true, mode: copyMode }, '*');
            }
          } catch (err) { }
          copyBtn.classList.add('agilo-email-btn-copied');
          copyBtn.innerHTML = copyIconChecked;
          toastFn(copyMode === 'html' ? 'Mail copié (mise en forme conservée)' : 'Texte du mail copié');
          setTimeout(function () {
            copyBtn.classList.remove('agilo-email-btn-copied');
            copyBtn.innerHTML = copyIconDefault;
          }, 2000);
        } catch (err) {
          toastFn('Échec de la copie');
        }
      })();
    });
    if (openConversationBtn) {
      openConversationBtn.addEventListener('click', function (e) {
        e.preventDefault();
        try {
          if (typeof openChatTab === 'function') {
            openChatTab();
            return;
          }
        } catch (_) { }
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'agilo:summary-open-chat' }, '*');
          }
        } catch (_) { }
      });
    }
    if (directGmail) {
      directGmail.href = gmailUrl;
      directGmail.target = '_blank';
      directGmail.rel = 'noopener noreferrer';
    }
    if (directOutlook) {
      directOutlook.href = outlookUrl;
      directOutlook.target = '_blank';
      directOutlook.rel = 'noopener noreferrer';
    }
    if (directDefault) {
      directDefault.href = mailtoUrl;
      directDefault.removeAttribute('target');
    }
  }

  /**
   * Même présentation que l’e-mail de l’onglet Conversation (carte, copie, menu Gmail/Outlook/mailto).
   */
  function agiloBuildCompteRenduConversationEmailFromV3(targetDoc, data, subject, bodyPlain) {
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const block = targetDoc.createElement('div');
    block.className = 'mail-ready agilo-email-block agilo-email-block--in-summary';
    block.setAttribute('data-agilo-mail-from', 'v3-struct');
    block.setAttribute('data-agilo-v3-compte-rendu-mail', '1');

    const header = targetDoc.createElement('div');
    header.className = 'agilo-email-block-header';
    const label = targetDoc.createElement('span');
    label.className = 'agilo-email-block-label';
    label.textContent = 'Email';
    const tools = targetDoc.createElement('div');
    tools.className = 'agilo-email-block-tools';
    const copyBtn = targetDoc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'agilo-email-btn agilo-email-btn-copy';
    copyBtn.setAttribute('aria-label', 'Copier le mail');
    copyBtn.setAttribute('title', 'Copier le mail');
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="agilo-email-icon copy-icon"><path fill="none" d="M0 0h24v24H0z"></path><rect fill="none" height="24" width="24"></rect><path fill="currentColor" d="M18,2H9C7.9,2,7,2.9,7,4v12c0,1.1,0.9,2,2,2h9c1.1,0,2-0.9,2-2V4C20,2.9,19.1,2,18,2z M18,16H9V4h9V16z M3,15v-2h2v2H3z M3,9.5h2v2H3V9.5z M10,20h2v2h-2V20z M3,18.5v-2h2v2H3z M5,22c-1.1,0-2-0.9-2-2h2V22z M8.5,22h-2v-2h2V22z M13.5,22L13.5,22l0-2h2v0C15.5,21.1,14.6,22,13.5,22z M5,6L5,6l0,2H3v0C3,6.9,3.9,6,5,6z"></path></svg>';
    const directWrap = targetDoc.createElement('div');
    directWrap.className = 'agilo-email-direct-links';
    const gmailSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="52 42 88 66" width="20" height="20" class="agilo-email-logo-gmail"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/><path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>';
    const outlookSvg = '<img src="https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6995e36911a4849150741ca6_Microsoft_Office_Outlook_(2018%E2%80%932024).svg" width="20" height="20" alt="" class="agilo-email-logo-outlook">';
    const defaultMailSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" class="agilo-email-logo-default"><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M3.75 5.25L3 6V18L3.75 18.75H20.25L21 18V6L20.25 5.25H3.75ZM4.5 7.6955V17.25H19.5V7.69525L11.9999 14.5136L4.5 7.6955ZM18.3099 6.75H5.68986L11.9999 12.4864L18.3099 6.75Z"/></svg>';
    [
      { app: 'gmail', label: 'Gmail', icon: gmailSvg },
      { app: 'outlook', label: 'Outlook', icon: outlookSvg },
      { app: 'default', label: 'Mail', icon: defaultMailSvg }
    ].forEach(function (item) {
      const a = targetDoc.createElement('a');
      a.href = '#';
      a.className = 'agilo-email-btn agilo-email-btn-link';
      a.setAttribute('data-agilo-mail-app', item.app);
      a.setAttribute('aria-label', item.label);
      a.setAttribute('title', item.label);
      a.innerHTML = '<span class="agilo-email-icon">' + item.icon + '</span><span class="agilo-email-link-label">' + item.label + '</span>';
      directWrap.appendChild(a);
    });
    tools.appendChild(copyBtn);
    tools.appendChild(directWrap);
    header.appendChild(label);
    header.appendChild(tools);
    const subjLine = targetDoc.createElement('div');
    subjLine.className = 'agilo-email-block-subject';
    subjLine.innerHTML = '<span class="agilo-email-block-subject-label">Objet</span> ' + esc(subject);
    const bodyWrap = targetDoc.createElement('div');
    bodyWrap.className = 'agilo-email-block-body agilo-email-block-body--md';
    bodyWrap.innerHTML = agiloV3DataToBodyDisplayHtml(data);
    const hint = targetDoc.createElement('div');
    hint.className = 'agilo-email-summary-hint';
    hint.innerHTML = '<p class="agilo-email-summary-hint__text">Pour modifier / copier-coller avant envoi, ouvrez l\'onglet Conversation.</p>';
    const openConversationBtn = targetDoc.createElement('button');
    openConversationBtn.type = 'button';
    openConversationBtn.className = 'agilo-email-btn agilo-summary-open-chat-btn';
    openConversationBtn.setAttribute('aria-label', 'Ouvrir la conversation');
    openConversationBtn.textContent = 'Ouvrir Conversation';
    hint.appendChild(openConversationBtn);
    block.appendChild(header);
    block.appendChild(subjLine);
    block.appendChild(bodyWrap);
    block.appendChild(hint);
    agiloWireCompteRenduEmailBlock(targetDoc, block, subject, bodyPlain);
    return block;
  }

  /**
   * Comptes rendus avec mail uniquement dans &lt;!--V3_STRUCT--&gt; (souvent effacé par sanitizeHtml) :
   * construit la carte e-mail (comme l’onglet Conversation).
   * @param {Document|Element} ctx Document iframe ou conteneur du compte-rendu.
   * @param {string} [rawHtml] HTML brut reçu (injection directe, pour retrouver le bloc si le DOM a perdu les commentaires).
   */
  function agiloMaterializeV3StructMailIfMissing(ctx, rawHtml) {
    try {
      if (!ctx) return;
      const isDoc = ctx.nodeType === 9;
      const searchRoot = isDoc ? (ctx.body || ctx.documentElement) : ctx;
      if (!searchRoot) return;
      if (searchRoot.querySelector('[data-agilo-v3-compte-rendu-mail]')) return;
      if (searchRoot.querySelector('.mail-ready .agilo-email-block')) return;

      var shells = searchRoot.querySelectorAll('.mail-ready');
      for (var si = 0; si < shells.length; si++) {
        var s = shells[si];
        if (s.querySelector('.agilo-email-block')) continue;
        if (s.getAttribute('data-agilo-v3-compte-rendu-mail')) continue;
        var t = (s.textContent || '').replace(/\s/g, ' ').trim();
        if (t.length < 2) s.remove();
      }

      var src = agiloFindV3StructInRoot(isDoc ? ctx : searchRoot);
      if (!src && rawHtml) src = agiloFindV3StructInHtmlString(rawHtml);
      if (!src) return;
      const data = agiloParseV3StructInner(src);
      if (!data) return;
      if (!data.candidate_name && !data.bullet1_title && !data.bullet1_body) return;
      const internal = searchRoot.querySelector('.internal-report');
      if (!internal || !internal.parentNode) return;
      const targetDoc = isDoc ? ctx : (ctx.ownerDocument || document);
      agiloEnsureCompteRenduEmailBlockCss(targetDoc);
      const subject = agiloV3DataToSubjectLine(data);
      const bodyPlain = agiloV3DataToBodyPlain(data);
      const block = agiloBuildCompteRenduConversationEmailFromV3(targetDoc, data, subject, bodyPlain);
      internal.parentNode.insertBefore(block, internal);
      const ab = searchRoot.querySelector('.report-card > .actions-bar');
      if (ab) ab.style.setProperty('display', 'none');
    } catch (e) {
      if (window.AGILO_DEBUG) console.warn('[agilo] materialize v3 struct mail', e);
    }
  }

  /**
   * Compte-rendu HTML (document complet) : le bloc .mail-ready doit apparaître tôt
   * (souvent déplacé sous le long .internal-report par erreur de génération).
   */
  function agiloReorderCompteRenduMailBlock(idoc) {
    try {
      if (!idoc || !idoc.body) return;
      const mail = idoc.querySelector('.mail-ready');
      const internal = idoc.querySelector('.internal-report');
      if (!mail || !internal) return;
      if (internal.compareDocumentPosition(mail) & Node.DOCUMENT_POSITION_FOLLOWING) {
        internal.parentNode.insertBefore(mail, internal);
      }
    } catch (e) {
      if (window.AGILO_DEBUG) console.warn('[agilo] reorder mail block', e);
    }
  }

  /**
   * Surcharge copyMailText / copyMailHtml (templates Valtus & co.) : sélecteur élargi + feedback.
   * S’exécute dans le document de l’iframe.
   */
  function agiloInjectCompteRenduCopyBridge(idoc) {
    if (!idoc || !idoc.body) return;
    const s = idoc.createElement('script');
    s.setAttribute('data-agilo', 'compte-rendu-copy-bridge');
    s.textContent = [
      '(function(){',
      'function _find(){',
      '  var a=document.querySelector(".mail-ready"); if(a) return a;',
      '  a=document.querySelector("[data-agilo-summary-mail]"); if(a) return a;',
      '  var q=document.querySelectorAll(".zone-title, .report-card h2, .report-card h3, .v3-notes h2, .v3-notes h3");',
      '  for(var i=0;i<q.length;i++){ var tx=(q[i].textContent||"").toLowerCase();',
      '    if(/mail|e-?mail|courrier|message|objet\\s*:/.test(tx)&&/pr[eê]t|cop|adress|cher\\s+/.test(tx)){',
      '      var p=q[i].closest("section,article,div"); if(p) return p; } }',
      '  return null;',
      '}',
      'function _ok(mode){ try{ if(window.parent&&window.parent!==window) window.parent.postMessage({type:"agilo:summary-mail-copy",ok:true,mode:mode||"text"},"*");}catch(e){} }',
      'function _fail(){ try{ if(window.parent&&window.parent!==window) window.parent.postMessage({type:"agilo:summary-mail-copy",ok:false,mode:"text"},"*");}catch(e){} }',
      'function _cb(t,mode){ if(navigator.clipboard&&window.isSecureContext) return navigator.clipboard.writeText(t).then(function(){_ok(mode);}).catch(function(){_legacy(t,mode);}); _legacy(t,mode); }',
      'function _legacy(t,mode){ var ta=document.createElement("textarea"); ta.value=t; ta.style.cssText="position:fixed;left:-9999px;"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); _ok(mode);}catch(e){} document.body.removeChild(ta); }',
      'window.copyMailText=function(){ var el=_find(); if(!el){ alert("Aucun bloc « mail prêt à copier » détecté (souvent la classe .mail-ready manque dans le HTML généré).\\nSélectionnez le texte à la main, ou corrigez le modèle côté serveur."); _fail(); return; }',
      '  try{ el.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(x){} var t=(el.innerText||el.textContent||"").replace(/\\r\\n/g,"\\n").trim(); _cb(t,"text"); };',
      'window.copyMailHtml=function(){ var el=_find(); if(!el){ window.copyMailText(); return; } try{ el.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(x){} var h=(el.outerHTML||"").trim(); _cb(h,"html"); };',
      '})();'
    ].join('');
    idoc.body.appendChild(s);
  }

  // ✅ ISOLATION : Fonction pour injecter le summary dans un iframe si contient des styles globaux
  // ⚠️ IMPORTANT : Placée APRÈS la déclaration de editors et pickSummaryEl()
  function injectSummaryContent(html) {
    const el = editors.summary || pickSummaryEl();
    if (!el || !html) return;

    // Détecter si le HTML contient des styles globaux problématiques
    const hasGlobalStyles = html.includes('<head') ||
      html.includes('<body') ||
      /\*\s*\{/.test(html) ||
      /body\s*\{/.test(html);

    if (hasGlobalStyles) {
      // ✅ STOCKER le HTML brut pour le PDF (Aspose ne peut pas accéder à l'iframe)
      el.setAttribute('data-raw-html', html);
      el.setAttribute('data-is-iframe', 'true');

      // Isoler dans un iframe
      const iframe = document.createElement('iframe');
      iframe.className = 'ag-summary-iframe';
      iframe.style.cssText = 'width:100%; border:none; min-height:max(600px,100svh); background:white;';

      // Vider summaryEditor avant d'ajouter l'iframe
      el.innerHTML = '';
      el.appendChild(iframe);

      // Écrire le contenu dans l'iframe (plus fiable que srcdoc)
      iframe.onload = function () {
        try {
          const idoc = this.contentDocument || this.contentWindow.document;
          idoc.open();
          idoc.write(html);
          idoc.close();

          agiloMaterializeV3StructMailIfMissing(idoc);
          agiloReorderCompteRenduMailBlock(idoc);
          agiloInjectCompteRenduCopyBridge(idoc);

          const ifr = this;
          const resolveSummarySvhFloorPx = () => {
            try {
              const probe = document.createElement('div');
              probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:100svh;visibility:hidden;pointer-events:none;';
              document.documentElement.appendChild(probe);
              const h = Math.round(probe.getBoundingClientRect().height);
              probe.remove();
              if (h > 200) return h;
            } catch (e) { /* ignore */ }
            return Math.round(
              typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 880
            );
          };
          const summarySvhFloorPx = resolveSummarySvhFloorPx();
          const scheduleSummaryIframeFit = () => {
            try {
              const body = idoc.body;
              if (!body) return;
              const root = idoc.documentElement;
              const measured = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                root ? root.scrollHeight : 0,
                root ? root.offsetHeight : 0
              );
              const nextH = Math.max(measured + 24, summarySvhFloorPx);
              ifr.style.height = nextH + 'px';
              ifr.style.minHeight = summarySvhFloorPx + 'px';
            } catch (e) {
              console.warn('[Editor] Erreur ajustement hauteur iframe:', e);
            }
          };
          [0, 120, 450, 1400].forEach((ms) => setTimeout(scheduleSummaryIframeFit, ms));
        } catch (e) {
          console.error('[Editor] Erreur écriture iframe:', e);
          // Fallback : utiliser srcdoc si contentDocument ne fonctionne pas
          try {
            this.srcdoc = html;
          } catch (e2) {
            console.error('[Editor] Erreur srcdoc fallback:', e2);
            // Ne jamais injecter le HTML riche dans le parent : fuite CSS globale
            // (historique : barre d'onglets qui disparaît sur Chromium).
            el.removeAttribute('data-raw-html');
            el.setAttribute('data-is-iframe', 'false');
            el.setAttribute('data-iframe-failed', 'true');
            el.innerHTML =
              '<div class="ag-alert ag-alert--warn" role="alert">' +
              'Impossible d’afficher ce compte rendu de façon isolée. Rechargez la page ou régénérez le compte rendu.' +
              '</div>';
          }
        }
      };

      // Déclencher le chargement si l'iframe est déjà chargé
      if (iframe.contentDocument) {
        iframe.onload();
      }
    } else {
      // ✅ STOCKER aussi le HTML brut pour les templates simples (cohérence)
      el.setAttribute('data-raw-html', html);
      el.setAttribute('data-is-iframe', 'false');

      // ✅ Injection directe (templates simples) - Sanitizer UNIQUEMENT ici
      el.innerHTML = sanitizeHtml(html);
      agiloMaterializeV3StructMailIfMissing(el, html);
    }

    // Appliquer les attributs readonly
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('readonly', 'true');
    el.style.userSelect = 'text';
    el.style.cursor = 'default';
    el.classList.add('ag-summary-readonly');
  }

  // ✅ DÉTECTION ET CORRECTION DU PROBLÈME DE CACHE
  // Vérifie si le HTML devrait être dans un iframe mais ne l'est pas (problème de cache)
  function checkAndFixCacheIssue(html) {
    // Ne vérifier qu'une seule fois par chargement de page
    if (window.__agiloCacheCheckDone) return false;

    const summaryEl = editors.summary || pickSummaryEl();
    if (!summaryEl || !html) return false;

    // Vérifier si on a déjà été rechargé à cause du cache (éviter les boucles infinies)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('_cache_bust') || urlParams.has('_force_reload')) {
      window.__agiloCacheCheckDone = true;
      return false;
    }

    // Détecter si le HTML devrait être dans un iframe
    const shouldBeIframe = html.includes('<head') ||
      html.includes('<body') ||
      /\*\s*\{/.test(html) ||
      /body\s*\{/.test(html);

    if (!shouldBeIframe) return false; // Pas de problème si pas besoin d'iframe

    // Vérifier l'état actuel
    const isIframe = summaryEl.getAttribute('data-is-iframe');
    const hasIframeElement = summaryEl.querySelector('iframe.ag-summary-iframe');

    // Si le HTML devrait être dans un iframe mais ne l'est pas → problème de cache
    if (shouldBeIframe && (isIframe !== 'true' || !hasIframeElement)) {
      console.warn('[Editor] ⚠️ Problème de cache détecté : iframe manquant alors que requis. Rechargement avec cache-buster...');

      // Afficher un message à l'utilisateur (optionnel)
      if (window.toast) {
        window.toast('Mise à jour nécessaire, rechargement en cours...', { duration: 2000 });
      }

      // Marquer comme fait pour éviter les appels multiples
      window.__agiloCacheCheckDone = true;

      // Recharger avec cache-buster après un court délai
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('_cache_bust', Date.now().toString());
        url.searchParams.set('_force_reload', '1');
        // Utiliser replace pour éviter d'ajouter une entrée dans l'historique
        window.location.replace(url.toString());
      }, 500);

      return true;
    }

    return false;
  }

  // ✅ FONCTION GLOBALE : Récupérer le HTML brut pour le PDF (Aspose)
  // Cette fonction est utilisée par le backend pour récupérer le HTML complet
  // même si le contenu est dans un iframe
  window.getSummaryContentForPDF = function () {
    const summaryEditor = document.getElementById('summaryEditor') ||
      document.getElementById('ag-summary') ||
      document.querySelector('[data-editor="summary"]');

    if (!summaryEditor) return '';

    // Priorité 1 : HTML brut stocké dans data-raw-html (recommandé)
    const rawHtml = summaryEditor.getAttribute('data-raw-html');
    if (rawHtml) {
      return rawHtml;
    }

    // Priorité 2 : Essayer d'extraire de l'iframe (fallback)
    const iframe = summaryEditor.querySelector('.ag-summary-iframe');
    if (iframe && iframe.contentDocument) {
      try {
        const doc = iframe.contentDocument;
        return doc.documentElement.outerHTML;
      } catch (e) {
        console.warn('[Editor] Impossible d\'extraire le contenu de l\'iframe:', e);
      }
    }

    // Priorité 3 : innerHTML normal (templates simples sans iframe)
    return summaryEditor.innerHTML;
  };

  function toast(msg) {
    let tRoot = byId('toaster') || byId('ag-toasts');
    if (!tRoot) { tRoot = document.createElement('div'); tRoot.id = 'toaster'; tRoot.className = 'toaster ag-toasts'; document.body.appendChild(tRoot); }
    const div = document.createElement('div'); div.className = 'toast'; div.textContent = msg; tRoot.appendChild(div);
    setTimeout(() => { div.style.opacity = 0; setTimeout(() => div.remove(), 220); }, 2200);
  }
  window.toast = window.toast || toast;


  const fmtHMS = (s) => {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const HH = String(h).padStart(2, '0'), MM = String(m).padStart(2, '0'), SS = String(sec).padStart(2, '0');
    return h ? `${HH}:${MM}:${SS}` : `${MM}:${SS}`;
  };




  /* ====================== Errors / Alerts ====================== */
  function parseMaybeJson(raw, contentType = '') {
    const looksJson =
      (contentType || '').includes('application/json') ||
      /^\s*\{/.test(raw || '');
    if (!looksJson) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function normCode(code = '') {
    const s = String(code || '')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-.]/g, '_')
      .toUpperCase();
    return s || 'UNKNOWN_ERROR';
  }

  /** Détails techniques pour bloc <details> : javaException, stack, complété par raw si nécessaire. */
  function technicalDetailsFromJson(json, rawFallback = '') {
    if (!json || typeof json !== 'object')
      return String(rawFallback || '').trim();
    const chunks = [];
    const ex = String(json.javaException || '').trim();
    const en = String(json.exceptionName || '').trim();
    if (ex) chunks.push(ex);
    else if (en) chunks.push(en);
    const st = String(json.javaStackTrace || json.exceptionStackTrace || '').trim();
    if (st) chunks.push(st);
    let s = chunks.filter(Boolean).join('\n\n').trim();
    const um = String(json.userErrorMessage || '').trim();
    if (um && s.startsWith(um)) s = s.slice(um.length).replace(/^[\s:]+/, '').trim();
    if (!s && rawFallback) s = String(rawFallback).trim();
    return s;
  }

  function humanizeError({ where = 'summary', code = '', json = null, httpStatus = 0 }) {
    const um = String(json?.userErrorMessage || '').trim();
    if (um) return um;

    const C = normCode(code);
    const isSummary = where === 'summary';

    const tech = `${json?.exceptionName || json?.javaException || ''} ${json?.exceptionStackTrace || json?.javaStackTrace || ''}`;

    if (/CLIENTABORTEXCEPTION|BROKEN PIPE/i.test(tech)) {
      return "La connexion a été interrompue pendant le téléchargement. Réessayez.";
    }
    if (/CONNEXION.*RE-?INITIALIS[ÉE]E/i.test(tech)) {
      return "Connexion ré-initialisée par le correspondant. Réessayez.";
    }

    if (C === 'HTTP_ERROR' && isSummary && (httpStatus === 404 || httpStatus === 204)) {
      return "Aucun compte-rendu disponible pour ce transcript (pas encore généré).";
    }

    const M = {
      ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS: "Vous n'avez pas demandé de compte-rendu pour cette transcription.",
      READY_SUMMARY_PENDING: "Résumé en préparation…",
      NOT_READY: "Résumé en préparation…",
      READY_SUMMARY_ON_ERROR: "La génération du compte-rendu a échoué.",
      /** receiveSummary KO utilise error_message = error_summary_on_error (distinct du transcript_status READY_SUMMARY_ON_ERROR). */
      ERROR_SUMMARY_ON_ERROR: "La génération du compte-rendu a échoué.",
      ERROR_TRANSCRIPT_NOT_READY: "Le transcript n'est pas encore prêt.",
      ERROR_TRANSCRIPT_FILE_NOT_EXISTS: "Cette transcription n’est plus sur le serveur. Ce n’est pas le comportement prévu de l’offre Business. Contactez le support avec le numéro du job.",
      ON_ERROR: "Le serveur a signalé une erreur.",
      ERROR_INVALID_TOKEN: "Session expirée ou invalide. Veuillez vous reconnecter.",
      NETWORK_ERROR: "Problème réseau lors de la récupération des données. Veuillez réessayer.",
      BODY_READ_ERROR: "Le chargement du document a été interrompu. Nouvelle tentative en cours…",
      HTTP_ERROR: `Réponse serveur inattendue (HTTP ${httpStatus || '???'})`,
      CANCELLED: "Chargement interrompu (changement de transcript).",
      UNKNOWN_ERROR: "Une erreur est survenue."
    };

    return M[C] || M.UNKNOWN_ERROR;
  }

  // Toujours afficher les sauts de ligne dans le contenteditable
  (function ensurePrewrap() {
    if (!document.getElementById('ag-prewrap')) {
      const s = document.createElement('style'); s.id = 'ag-prewrap';
      s.textContent = '.ag-seg__text{white-space:pre-wrap}';
      document.head.appendChild(s);
    }
  })();
  // Canon CE -> texte visible (div/br -> \n), NBSP -> espace
  window.visibleTextFromBox = window.visibleTextFromBox || function (box) {
    if (!box) return '';
    const clone = box.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const BLOCKS = 'div,p,li,blockquote,pre,section,article,header,footer,h1,h2,h3,h4,h5,h6,ul,ol';
    clone.querySelectorAll(BLOCKS).forEach((el, i) => {
      if (i > 0 || el.previousSibling) el.before('\n');
    });
    return (clone.textContent || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00A0/g, ' ');
  };


  function renderAlert(htmlMsg, details = '') {
    const safe = document.createElement('div');
    safe.className = 'ag-alert ag-alert--warn';
    const esc = s => String(s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
    safe.innerHTML = `
    <div class="ag-alert__title">${esc(htmlMsg)}</div>
    ${details ? `<details class="ag-alert__details"><summary>Détails techniques</summary><pre>${esc(details)}</pre></details>` : ''}
  `;
    return safe;
  }


  async function resolveEmail() {
    // 1. Essayer d'abord les sources directes
    const fromAttr = document.querySelector('[name="memberEmail"]')?.getAttribute('value') || '';
    const fromText = document.querySelector('[data-ms-member="email"]')?.textContent || '';
    let now = (byId('memberEmail')?.value || fromAttr || fromText || window.memberEmail || localStorage.getItem('agilo:username') || '').trim();
    if (now) return now;

    // 2. Essayer Memberstack avec timeout et gestion d'erreur améliorée
    if (window.$memberstackDom?.getMember) {
      try {
        // Timeout pour éviter d'attendre trop longtemps en cas de connexion instable
        const memberstackPromise = window.$memberstackDom.getMember();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Memberstack timeout')), 5000)
        );

        const r = await Promise.race([memberstackPromise, timeoutPromise]);
        now = (r?.data?.email || '').trim();
        if (now) {
          // Sauvegarder dans localStorage pour les prochaines fois
          try {
            localStorage.setItem('agilo:username', now);
          } catch (e) { }
          return now;
        }
      } catch (err) {
        // Détecter les erreurs réseau spécifiques
        const isNetworkError = err?.code === 'ERR_NETWORK'
          || err?.message?.includes('Network Error')
          || err?.message?.includes('ERR_ADDRESS_UNREACHABLE')
          || err?.message?.includes('timeout')
          || err?.name === 'NetworkError';

        if (window.AGILO_DEBUG || isNetworkError) {
          console.warn('[agilo] getMember error (Memberstack non accessible):', err);
        }
        // En cas d'erreur réseau, on continue avec les fallbacks
      }
    }

    // 3. Dernier recours : vérifier localStorage
    const lastChance = localStorage.getItem('agilo:username');
    if (lastChance) return lastChance.trim();

    return '';
  }
  function readAuthSnapshot() {
    const edition = (editorRoot?.dataset.edition || EDITION || 'ent').trim();
    const email = editorRoot?.dataset.username
      || byId('memberEmail')?.value
      || document.querySelector('[name="memberEmail"]')?.value
      || localStorage.getItem('agilo:username')
      || window.memberEmail
      || '';
    const key = tokenKey(email, edition);
    const token = editorRoot?.dataset.token
      || window.globalToken
      || localStorage.getItem(key)
      || localStorage.getItem('agilo:token')
      || '';
    return { username: (email || '').trim(), token: token || '', edition, KEY: key };
  }
  function waitForTokenEvent(ms = 8000, email = '', edition = '') {
    return new Promise(res => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; res(null); } }, ms);
      const h = (e) => {
        if (done) return;
        const d = e?.detail || {};
        const okEmail = email ? (String(d.email || '').toLowerCase() === String(email).toLowerCase()) : true;
        const okEd = edition ? (String(d.edition || '').toLowerCase() === String(edition).toLowerCase()) : true;
        if (d.token && okEmail && okEd) {
          done = true; clearTimeout(timer);
          res({ username: d.email, token: d.token, edition: String(d.edition || edition) });
        }
      };
      window.addEventListener('agilo:token', h, { once: true, passive: true });
    });
  }
  async function ensureAuth() {
    let auth = readAuthSnapshot();
    if (!auth.username) auth.username = await resolveEmail();

    if (!auth.token && auth.username) {
      if (typeof window.getToken === 'function') {
        try { window.getToken(auth.username, auth.edition); } catch { }
      }
      const fromEvt = await waitForTokenEvent(8000, auth.username, auth.edition);
      if (fromEvt?.token) {
        auth.token = fromEvt.token;
        try { localStorage.setItem(auth.KEY, auth.token); } catch { }
        window.globalToken = auth.token;
      } else {
        const snap = readAuthSnapshot();
        if (snap.token) auth = snap;
      }
    }

    if (auth.username) { try { localStorage.setItem('agilo:username', auth.username); } catch { } }
    try { localStorage.setItem('agilo:edition', auth.edition); } catch { }
    return auth;
  }
  async function refreshToken(auth) {
    if (!auth?.username) return '';
    try { localStorage.removeItem(auth.KEY); } catch { }
    if (typeof window.getToken === 'function') {
      try { window.getToken(auth.username, auth.edition); } catch { }
    }
    const evt = await waitForTokenEvent(8000, auth.username, auth.edition);
    const tok = evt?.token || window.globalToken || '';
    if (tok) {
      try { localStorage.setItem(auth.KEY, tok); } catch { }
      window.globalToken = tok;
    }
    return tok || '';
  }

  async function fetchWithTimeout(url, opts = {}) {
    const { timeout = 20000, signal } = opts;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const composite = new AbortController();
    function linkAbort(src) {
      if (!src) return;
      if (src.aborted) composite.abort();
      src.addEventListener('abort', () => composite.abort(), { once: true });
    }
    linkAbort(signal);
    linkAbort(ctrl.signal);
    try {
      return await fetch(url, { ...opts, signal: composite.signal, credentials: 'omit', cache: 'no-store' });
    } finally { clearTimeout(t); }
  }

  let lastNetToast = 0;
  const netToast = msg => { const now = Date.now(); if (now - lastNetToast > 15000) { lastNetToast = now; toast(msg); } };

  async function apiGetWithRetry(kind, jobId, auth, retryCount = 0, signal) {
    const base =
      (kind === 'summary')
        ? `${API_BASE}/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`
        : `${API_BASE}/receiveTextJson?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;

    const url = (kind === 'summary') ? (base + '&format=html') : base;

    let r, raw;
    try {
      const TIMEOUT_MS = (kind === 'transcript') ? 45000 : 20000;
      r = await fetchWithTimeout(url, { signal, timeout: TIMEOUT_MS });
      raw = await r.text();
    } catch (e) {
      const errDetail = `${e?.name}: ${e?.message}`;
      console.error(`[agilo:fetch] ${kind} job=${jobId} retry=${retryCount}: ${errDetail}`);
      if (e?.name === 'AbortError') {
        return { ok: false, code: 'CANCELLED', httpStatus: 0, json: null, raw: '' };
      }
      if (retryCount < 2) {
        netToast('Connexion instable, nouvelle tentative…');
        await wait(2000 * Math.pow(2, retryCount));
        return apiGetWithRetry(kind, jobId, auth, retryCount + 1, signal);
      }
      return { ok: false, code: 'NETWORK_ERROR', httpStatus: 0, json: null, raw: '', _debug: errDetail };
    }

    if (!r.ok) {
      if ((r.status === 401 || r.status === 403) && retryCount < 3) {
        const nt = await refreshToken(auth);
        if (nt) {
          auth.token = nt;
          await wait(400 * Math.pow(1.5, retryCount));
          return apiGetWithRetry(kind, jobId, auth, retryCount + 1, signal);
        }
      }
      return { ok: false, code: 'HTTP_ERROR', httpStatus: r.status, json: parseMaybeJson(raw, r.headers.get('content-type') || ''), raw };
    }

    const ct = r.headers.get('content-type') || '';
    const json = parseMaybeJson(raw, ct);

    // ⚠️ PROTECTION : Si le JSON est mal formé mais contient une erreur explicite, on force le KO
    if (!json && (raw.includes('"status": "KO"') || raw.includes('"status":"KO"') || raw.includes('"errorMessage"'))) {
      const fallbackJson = { status: 'KO', errorMessage: 'INVALID_JSON_RESPONSE', exceptionStackTrace: raw };
      return { ok: false, code: 'API_ERROR_BAD_JSON', httpStatus: r.status, json: fallbackJson, raw };
    }

    if (json && (json.status === 'KO' || json.errorMessage)) {
      const code = String(json.errorMessage || json.status || '').toLowerCase();
      const tech = (json?.exceptionName || json?.javaException || '') + ' ' + (json?.exceptionStackTrace || json?.javaStackTrace || '');
      if (retryCount < 3) {
        if (/invalid[_-]?token/.test(code)) {
          const nt = await refreshToken(auth);
          if (nt) {
            auth.token = nt;
            await wait(500 * Math.pow(1.5, retryCount));
            return apiGetWithRetry(kind, jobId, auth, retryCount + 1, signal);
          }
        } else if (/CLIENTABORTEXCEPTION|BROKEN PIPE/i.test(tech) || /CONNEXION.*RE-?INITIALIS[ÉE]E/i.test(tech)) {
          netToast('Connexion interrompue détectée. Réessai automatique...');
          await wait(1000 * Math.pow(2, retryCount));
          return apiGetWithRetry(kind, jobId, auth, retryCount + 1, signal);
        }
      }
      return { ok: false, code: json.errorMessage || json.status || 'UNKNOWN_ERROR', json, raw };
    }

    return { ok: true, payload: raw, contentType: ct };
  }


  function sanitizeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object, embed').forEach(n => n.remove());
    div.querySelectorAll('*').forEach(n => {
      [...n.attributes].forEach(a => {
        const name = a.name.toLowerCase();
        const val = String(a.value || '');
        if (name.startsWith('on') || /^javascript:/i.test(val)) n.removeAttribute(a.name);
      });
    });
    return div.innerHTML;
  }
  function isBlankHtml(html) {
    const s = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
    return s.length === 0;
  }

  function enableLink(el, href) {
    if (!el) return;
    if (el.__agiloBlocker) { el.removeEventListener('click', el.__agiloBlocker); el.__agiloBlocker = null; }
    el.classList.remove('is-disabled');
    el.removeAttribute('aria-disabled');
    el.removeAttribute('title');
    el.setAttribute('href', href);
    el.setAttribute('target', '_blank');
  }
  function disableLink(el, msg = 'Indisponible') {
    if (!el) return;
    if (el.__agiloBlocker) el.removeEventListener('click', el.__agiloBlocker);
    el.__agiloBlocker = (e) => { e.preventDefault(); toast(msg); };
    el.addEventListener('click', el.__agiloBlocker);
    el.classList.add('is-disabled');
    el.setAttribute('aria-disabled', 'true');
    el.setAttribute('title', msg);
    el.removeAttribute('target');
    el.setAttribute('href', 'javascript:void(0)');
  }
  function updateDownloadLinks(jobId, auth, { summaryEmpty = false } = {}) {
    const dl = {
      t_txt: $('.download_wrapper-link_transcript_txt'),
      t_rtf: $('.download_wrapper-link_transcript_rtf'),
      t_doc: $('.download_wrapper-link_transcript_doc'),
      t_docx: $('.download_wrapper-link_transcript_docx'),
      t_pdf: $('.download_wrapper-link_transcript_pdf'),
      s_txt: $('.download_wrapper-link_summary_txt'),
      s_rtf: $('.download_wrapper-link_summary_rtf'),
      s_doc: $('.download_wrapper-link_summary_doc'),
      s_docx: $('.download_wrapper-link_summary_docx'),
      s_pdf: $('.download_wrapper-link_summary_pdf')
    };
    if (!jobId || !auth?.username || !auth?.token) return;

    const baseQ = `jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;

    enableLink(dl.t_txt, `${API_BASE}/receiveText?${baseQ}&format=txt`);
    enableLink(dl.t_rtf, `${API_BASE}/receiveText?${baseQ}&format=rtf`);
    enableLink(dl.t_doc, `${API_BASE}/receiveText?${baseQ}&format=doc`);
    enableLink(dl.t_docx, `${API_BASE}/receiveText?${baseQ}&format=docx`);
    enableLink(dl.t_pdf, `${API_BASE}/receiveText?${baseQ}&format=pdf`);

    if (summaryEmpty) {
      ['s_txt', 's_rtf', 's_doc', 's_docx', 's_pdf'].forEach(k => disableLink(dl[k], 'Résumé non disponible pour le moment'));
    } else {
      enableLink(dl.s_txt, `${API_BASE}/receiveSummary?${baseQ}&format=html`);
      enableLink(dl.s_rtf, `${API_BASE}/receiveSummary?${baseQ}&format=rtf`);
      enableLink(dl.s_doc, `${API_BASE}/receiveSummary?${baseQ}&format=doc`);
      enableLink(dl.s_docx, `${API_BASE}/receiveSummary?${baseQ}&format=docx`);
      enableLink(dl.s_pdf, `${API_BASE}/receiveSummary?${baseQ}&format=pdf`);
    }

    const share = byId('shareLink');
    if (share) {
      const u = new URL(share.href || location.href);
      u.searchParams.set('jobId', jobId);
      u.searchParams.set('edition', auth.edition);
      share.href = u.toString();
    }
  }

  window._segments = Array.isArray(window._segments) ? window._segments : [];
  let _activeSeg = -1;
  let _selectedSegs = new Set();
  let _bulkBar = null, _bulkBarCount = null, _bulkDelBtn = null;
  let __mode = 'plain';

  function scrollToActivePlaybackSegment({ force = false } = {}) {
    const follow = _transcriptFollow;
    if (!follow || !follow.armed) return;
    if (__mode !== 'structured') return;
    const root = editors.transcript;
    const audio = byId('agilo-audio');
    if (!root || !audio || !Array.isArray(window._segments) || !window._segments.length) return;
    const k = resolveActiveSegmentIndex(audio.currentTime || 0, window._segments, _activeSeg);
    if (k < 0) return;
    const el = root.children[k];
    if (!el) return;
    if (k !== _activeSeg) {
      if (_activeSeg >= 0) root.children[_activeSeg]?.classList.remove('is-active');
      _activeSeg = k;
    }
    el.classList.add('is-active');
    const pane = el.closest('.edtr-pane, .ag-panel, #pane-transcript, #pane-summary, #pane-chat');
    const container = agiloFindScrollContainer(el) || agiloFindScrollContainer(pane) || pane;
    bindFollowPause(container);
    const outOfView = agiloIsOutOfView(el, container, { top: 100, bottom: 120 });
    if (!force && !follow.shouldScroll(outOfView)) return;
    follow.beginProgrammatic();
    agiloScrollIntoView(el, { allowWindow: false });
    requestAnimationFrame(() => { follow.endProgrammatic(); });
  }

  const _transcriptFollow = createFollowController({
    onChange(armed) {
      dispatchTranscriptFollow(armed);
      if (armed) scrollToActivePlaybackSegment({ force: true });
    }
  });
  window.AgiloTranscriptFollow = _transcriptFollow;

  function syncDomToModel() {
    const root = editors.transcript;
    if (!root || !Array.isArray(window._segments) || !window._segments.length) return;
    if (__mode === 'structured') {
      Array.from(root.querySelectorAll(':scope > .ag-seg')).forEach((segEl, idx) => {
        const box = segEl.querySelector('.ag-seg__text');
        if (box && window._segments[idx]) {
          window._segments[idx].text = window.visibleTextFromBox(box);
        }
      });
    } else {
      const plain = root.querySelector('.ag-plain');
      if (plain && window._segments[0]) {
        window._segments[0].text = window.visibleTextFromBox(plain);
      }
    }
  }
  window.syncDomToModel = syncDomToModel;

  const NUCLEO_PATHS = {
    pencil: '<path d="M13.953 7.57799L15.062 6.46898C15.648 5.88298 15.648 4.93298 15.062 4.34798L13.653 2.93898C13.067 2.35298 12.117 2.35298 11.532 2.93898L10.423 4.04799L13.953 7.57799Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M8.6544 5.81461L4.147 10.322C3.897 10.572 3.718 10.884 3.627 11.226L2.5 15.499L6.773 14.372C7.115 14.282 7.427 14.102 7.677 13.852L12.1844 9.3446" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M10.4044 7.56461L6.26501 11.704" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    search: '<path d="M15.75 15.75L11.6386 11.6386" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 4.7125 10.7875 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    meeting: '<path d="M5.75 8.25049C6.8546 8.25049 7.75 7.35549 7.75 6.25049C7.75 5.14549 6.8546 4.25049 5.75 4.25049C4.6454 4.25049 3.75 5.14549 3.75 6.25049C3.75 7.35549 4.6454 8.25049 5.75 8.25049Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M9.60903 15.1225C10.132 14.9475 10.439 14.3785 10.245 13.8635C9.56003 12.0455 7.80903 10.7515 5.75103 10.7515C3.69303 10.7515 1.94203 12.0455 1.25703 13.8635C1.06303 14.3795 1.37003 14.9485 1.89303 15.1225C2.85503 15.4435 4.17403 15.7505 5.75203 15.7505C7.33003 15.7505 8.64803 15.4435 9.60903 15.1225Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    plus: '<line x1="9" y1="3.25" x2="9" y2="14.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="3.25" y1="9" x2="14.75" y2="9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    userPlus: '<path d="M9 7.2505C10.5188 7.2505 11.75 6.0195 11.75 4.5005C11.75 2.9815 10.5188 1.7505 9 1.7505C7.4812 1.7505 6.25 2.9815 6.25 4.5005C6.25 6.0195 7.4812 7.2505 9 7.2505Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M17.25 14.7505H12.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M14.75 12.2505V17.2505" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12.2164 10.677C11.2752 10.102 10.1839 9.7505 8.99999 9.7505C6.44899 9.7505 4.26099 11.2805 3.29099 13.4705C2.92599 14.2955 3.37799 15.2444 4.23799 15.5154C5.46299 15.9014 7.08389 16.2495 8.99999 16.2495C9.22329 16.2495 9.43029 16.2319 9.64399 16.2214" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    check: '<polyline points="2.75 9.25 6.75 14.25 15.25 3.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>'
  };
  function nucleoIcon(name, className) {
    const paths = NUCLEO_PATHS[name] || '';
    const cls = className ? ` class="${className}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none"${cls} aria-hidden="true">${paths}</svg>`;
  }

  function buildRenameBtn() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Renommer');
    btn.className = 'rename-btn absolute';
    btn.innerHTML = nucleoIcon('pencil', 'icon-1x1-small-5');
    return btn;
  }

  /* --- COULEURS AUTOMATIQUES LOCUTEURS (Palette Agilotext Extended) --- */
  /* Gère une infinité de participants par rotation modulo 20 */
  const SPK_COLORS = [
    // 1. Les Piliers (Marque)
    '#174a96', '#fd7e14', '#1c661a', '#a82633',
    // 2. Les Secondaires "Corporate"
    '#6f42c1', '#0891b2', '#b45309', '#be185d',
    // 3. Les Complémentaires "Soft"
    '#0ea5e9', '#15803d', '#d946ef', '#854d0e',
    '#4b5563', '#4338ca', '#0f766e', '#9f1239',
    '#a16207', '#7c2d12', '#374151', '#1d4ed8'
  ];

  function getSpeakerColor(name) {
    if (!name) return '#666';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const c = SPK_COLORS[Math.abs(hash) % SPK_COLORS.length];
    return c;
  }

  const UNDO_MAX = 20;
  const _undoStack = [];
  let _undoSaveTimer = null;

  function getSegList(root) {
    if (!root) return [];
    return root.querySelectorAll(':scope > .ag-seg');
  }
  function getSegIndex(root, segEl) {
    return Array.prototype.indexOf.call(getSegList(root), segEl);
  }

  function hideUndoToasts() {
    const tRoot = byId('toaster') || byId('ag-toasts');
    if (tRoot) tRoot.querySelectorAll('.toast--undo').forEach(n => n.remove());
  }
  function hideUndoBar() { hideUndoToasts(); }

  function scheduleUndoExpiry() {
    clearTimeout(_undoSaveTimer);
    if (_undoStack.length === 0) return;
    _undoSaveTimer = setTimeout(() => {
      _undoStack.length = 0;
      hideUndoBar();
      if (typeof window.agiloSaveNow === 'function') window.agiloSaveNow();
    }, 4500);
  }

  function showUndoBar() {
    hideUndoToasts();
    const entry = _undoStack[_undoStack.length - 1];
    if (!entry) return;
    const msg = entry.label || 'Action effectuée';
    const t = toast(msg + ' — <button class="ag-undo-link" style="color:#fff;text-decoration:underline;background:none;border:none;padding:0;cursor:pointer;font:inherit;">Annuler</button>', 4000);
    if (t) {
      t.classList.add('toast--undo');
      const btn = t.querySelector('.ag-undo-link');
      if (btn) btn.onclick = (e) => { e.preventDefault(); applyUndo(); };
    }
  }

  function syncSelectedClasses() {
    const root = editors.transcript; if (!root) return;
    const segs = getSegList(root);
    segs.forEach((el) => { el.classList.remove('is-selected'); });
    _selectedSegs.forEach((i) => { if (segs[i]) segs[i].classList.add('is-selected'); });
  }

  function clearSegSelection() {
    const root = editors.transcript;
    if (root) root.querySelectorAll('.ag-seg.is-selected').forEach((el) => { el.classList.remove('is-selected'); });
    _selectedSegs.clear();
    if (_bulkBar) _bulkBar.setAttribute('hidden', '');
  }

  function updateBulkBar() {
    if (!_bulkBar) ensureBulkBar();
    if (!_bulkBar) return;
    if (_selectedSegs.size === 0) {
      _bulkBar.setAttribute('hidden', '');
      return;
    }
    if (_bulkBarCount) _bulkBarCount.textContent = `${_selectedSegs.size} segment(s) sélectionné(s)`;
    _bulkBar.removeAttribute('hidden');
  }

  function ensureBulkBar() {
    if (_bulkBar) return;
    const root = editors.transcript; if (!root) return;
    const host = root.closest('#pane-transcript, .edtr-pane, [id$="transcript"]') || document.body;
    _bulkBar = document.createElement('div');
    _bulkBar.id = 'agilo-bulk-bar';
    _bulkBar.setAttribute('hidden', '');
    _bulkBar.setAttribute('role', 'status');
    _bulkBar.setAttribute('aria-live', 'polite');
    _bulkBarCount = document.createElement('span');
    _bulkBarCount.className = 'agilo-bulk-bar__count';
    _bulkDelBtn = document.createElement('button');
    _bulkDelBtn.type = 'button';
    _bulkDelBtn.className = 'agilo-bulk-bar__btn';
    _bulkDelBtn.textContent = 'Supprimer la sélection';
    _bulkDelBtn.addEventListener('click', () => { deleteSelectedSegments({ requireConfirm: true }); });
    _bulkBar.appendChild(_bulkBarCount);
    _bulkBar.appendChild(_bulkDelBtn);
    host.appendChild(_bulkBar);
  }

  function deleteSelectedSegments({ requireConfirm = true } = {}) {
    const root = editors.transcript; if (!root) return false;
    if (_selectedSegs.size === 0) return false;
    const asc = Array.from(_selectedSegs).sort((a, b) => a - b);
    const nSel = asc.length;
    if (!window._segments || window._segments.length - nSel < 1) {
      toast('Impossible : suppression vide le transcript.');
      return false;
    }
    if (requireConfirm && !confirm(`Supprimer ${nSel} segment(s) ?`)) return false;
    const snapshots = asc.map((i) => Object.assign({}, window._segments[i]));
    for (let k = asc.length - 1; k >= 0; k--) {
      window._segments.splice(asc[k], 1);
    }
    clearSegSelection();
    pushUndo({ type: 'bulk', snapshots, indices: asc, label: `${nSel} segment(s) supprimés` });
    _activeSeg = -1;
    renderSegments(window._segments);
    return true;
  }

  function pushUndo(entry) {
    _undoStack.push(entry);
    if (_undoStack.length > UNDO_MAX) _undoStack.shift();
    scheduleUndoExpiry();
    showUndoBar();
  }

  function applyUndo() {
    const entry = _undoStack.pop();
    if (!entry) return;
    if (entry.type === 'one') {
      window._segments.splice(entry.indices[0], 0, entry.snapshots[0]);
    } else if (entry.type === 'bulk') {
      for (let k = entry.indices.length - 1; k >= 0; k--) {
        window._segments.splice(entry.indices[k], 0, entry.snapshots[k]);
      }
    }
    _activeSeg = -1;
    clearSegSelection();
    renderSegments(window._segments);
    hideUndoToasts();
    toast(entry.label ? `Annulé : ${entry.label}` : 'Action annulée');
    if (_undoStack.length === 0) {
      clearTimeout(_undoSaveTimer);
    }
  }

  function deleteSegEl(segEl) {
    const root = editors.transcript; if (!root) return;
    if (!window._segments || window._segments.length <= 1) {
      toast('Impossible de supprimer le dernier segment.');
      return;
    }
    const idx = getSegIndex(root, segEl);
    if (idx < 0) return;
    const snapshot = Object.assign({}, window._segments[idx]);
    window._segments.splice(idx, 1);
    segEl.remove();
    if (_activeSeg === idx) _activeSeg = -1;
    else if (_activeSeg > idx) _activeSeg--;
    const next = new Set();
    _selectedSegs.forEach((i) => {
      if (i === idx) return;
      next.add(i > idx ? i - 1 : i);
    });
    _selectedSegs = next;
    updateBulkBar();
    
    pushUndo({ type: 'one', snapshots: [snapshot], indices: [idx], label: 'Segment supprimé' });
    syncSelectedClasses();
  }

  function buildDeleteBtn() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Supprimer ce segment (annulable 4 s)');
    btn.setAttribute('aria-keyshortcuts', 'Control+Shift+Backspace');
    btn.className = 'delete-seg-btn absolute';
    btn.dataset.action = 'delete-seg';
    btn.title = 'Supprimer ce segment — annulable pendant 4 s\nRaccourci : Ctrl+Maj+Retour Arrière';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>';
    return btn;
  }

  let _ensureSegButtonsTimer = null;

  function ensureSegButtons() {
    const root = editors.transcript;
    if (!root || __mode !== 'structured') return;
    const segs = getSegList(root);
    segs.forEach((seg, idx) => {
      if (!seg.dataset.id) {
        seg.dataset.id = `s${idx}_${Date.now()}`;
      }
      const head = seg.querySelector('.ag-seg__head');
      if (head && !head.querySelector('.delete-seg-btn')) {
        head.appendChild(buildDeleteBtn());
      }
    });
  }

  function scheduleEnsureSegButtons() {
    clearTimeout(_ensureSegButtonsTimer);
    _ensureSegButtonsTimer = setTimeout(ensureSegButtons, 150);
  }

  function setupSegButtonsObserver(root) {
    if (!root || root.__segButtonsObserver) return;
    const observer = new MutationObserver(scheduleEnsureSegButtons);
    observer.observe(root, { childList: true, subtree: true });
    root.__segButtonsObserver = observer;
    ensureSegButtons();
  }

  function setSpeakerStyle(el, name) {
    if (!el) return;
    el.style.color = getSpeakerColor(name);
    el.style.fontWeight = '600';
  }

  function renderSegments(segments) {
    const root = editors.transcript; if (!root) return;

    root.innerHTML = '';
    root.dataset.mode = __mode;

    if (!segments || !segments.length) {
      const box = document.createElement('div');
      box.className = 'ag-plain';
      box.contentEditable = 'true';
      box.spellcheck = false;
      box.textContent = '';
      root.appendChild(box);
      root.setAttribute('contenteditable', 'false');
      _selectedSegs.clear();
      if (_bulkBar) _bulkBar.setAttribute('hidden', '');
      return;
    }

    const frag = document.createDocumentFragment();

    segments.forEach((s, i) => {
      const art = document.createElement('article');
      art.className = 'ag-seg';

      art.dataset.id = s.id || `s${i}`;
      if (Number.isFinite(s.start)) art.dataset.start = String(s.start);
      if (Number.isFinite(s.end)) art.dataset.end = String(s.end);
      art.dataset.speaker = s.speaker || '';

      if (__mode === 'structured') {
        const header = document.createElement('header');
        header.className = 'ag-seg__head';

        const btnTime = document.createElement('button');
        btnTime.className = 'time';
        btnTime.type = 'button';
        const hasStart = Number.isFinite(s.start);
        const tText = hasStart ? fmtHMS(s.start) : '00:00';
        btnTime.textContent = tText;
        btnTime.dataset.action = 'seek';
        btnTime.dataset.t = hasStart ? String(s.start) : '0';
        btnTime.title = hasStart ? `Aller à ${tText}` : 'Aller au début (00:00)';
        header.appendChild(btnTime);

        const spanSpk = document.createElement('span');
        spanSpk.className = 'speaker';
        const spkName = (s.speaker || '').trim();
        spanSpk.textContent = spkName;
        setSpeakerStyle(spanSpk, spkName);
        header.appendChild(spanSpk);

        const rename = buildRenameBtn();
        header.appendChild(rename);
        const delBtn = buildDeleteBtn();
        header.appendChild(delBtn);
        art.appendChild(header);
      }

      const body = document.createElement('div');
      body.className = 'ag-seg__text';
      body.contentEditable = 'true';
      body.spellcheck = false;
      body.textContent = s.text || '';
      art.appendChild(body);

      frag.appendChild(art);
    });

    root.appendChild(frag);
    root.setAttribute('contenteditable', 'false');
    _selectedSegs.clear();
    if (_bulkBar) _bulkBar.setAttribute('hidden', '');
    setupSegButtonsObserver(root);

    if (!root.__bound) {
      root.addEventListener('click', (e) => {
        if (__mode !== 'structured' || !e.shiftKey) return;
        const art = e.target.closest('.ag-seg');
        if (!art || e.target.closest('button, .speaker')) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = getSegIndex(root, art);
        if (idx < 0) return;
        if (_selectedSegs.has(idx)) {
          _selectedSegs.delete(idx);
          art.classList.remove('is-selected');
        } else {
          _selectedSegs.add(idx);
          art.classList.add('is-selected');
        }
        updateBulkBar();
      });

      root.addEventListener('click', (e) => {
        const btn = e.target.closest('button.time[data-action="seek"]');
        if (!btn || __mode !== 'structured') return;
        const t = parseFloat(btn.dataset.t || '0');
        const audio = byId('agilo-audio');
        if (!audio) { toast('Lecteur audio introuvable.'); return; }
        try { audio.currentTime = t; if (audio.paused) audio.play().catch(() => { }); } catch { }
        try { _transcriptFollow.arm(); } catch { }
        try { scrollToActivePlaybackSegment({ force: true }); } catch { }
      });

      root.addEventListener('click', (e) => {
        if (__mode !== 'structured') return;
        const btn = e.target.closest('.rename-btn');
        if (btn) {
          e.preventDefault(); e.stopPropagation();
          try { window.getSelection()?.removeAllRanges(); } catch { }
          try { document.activeElement?.blur?.(); } catch { }
          const segEl = btn.closest('.ag-seg');
          if (!segEl) return;
          doRenameFor(segEl, {
            triggerEl: btn,
            renameAllEmpty: !!(e.shiftKey || e.altKey),
            keyState: { shift: e.shiftKey, alt: e.altKey }
          });
          return;
        }
        const sp = e.target.closest('.speaker');
        if (!sp || e.target.closest('.rename-btn')) return;
        e.preventDefault(); e.stopPropagation();
        try { window.getSelection()?.removeAllRanges(); } catch { }
        const segEl = sp.closest('.ag-seg');
        if (!segEl) return;
        doRenameFor(segEl, {
          triggerEl: sp,
          renameAllEmpty: !!(e.shiftKey || e.altKey),
          keyState: { shift: e.shiftKey, alt: e.altKey }
        });
      });

      root.addEventListener('click', (e) => {
        if (__mode !== 'structured') return;
        const btn = e.target.closest('[data-action="delete-seg"]');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        const segEl = btn.closest('.ag-seg');
        if (!segEl) return;
        const idx = getSegIndex(root, segEl);
        if (_selectedSegs.size > 1 && idx >= 0 && _selectedSegs.has(idx)) {
          deleteSelectedSegments({ requireConfirm: true });
          return;
        }
        deleteSegEl(segEl);
      });

      root.addEventListener('input', (e) => {
        const node = e.target.closest('.ag-seg__text'); if (!node) return;
        try { _transcriptFollow.disarm(); } catch { }
        const segEl = node.closest('.ag-seg');
        const idx = Array.prototype.indexOf.call(root.children, segEl);
        if (idx > -1 && window._segments[idx]) {
          window._segments[idx].text = window.visibleTextFromBox(node);
          if (window.AgiloConfidence && typeof window.AgiloConfidence.markSegmentModified === 'function') {
            window.AgiloConfidence.markSegmentModified(idx);
          }
        }
      });
      root.addEventListener('focusin', (e) => {
        if (e.target.closest && e.target.closest('.ag-seg__text')) {
          try { _transcriptFollow.disarm(); } catch { }
        }
      });

      root.addEventListener('paste', (e) => {
        const node = e.target.closest('.ag-seg__text');
        if (!node || !e.clipboardData || e.defaultPrevented) return;
        const text = e.clipboardData.getData('text/plain');
        if (text == null) return;
        e.preventDefault();
        document.execCommand('insertText', false, text);
      }, true);

      root.addEventListener('keydown', (e) => {
        const node = e.target.closest('.ag-seg__text'); if (!node) return;
        if (e.key === 'Backspace' || e.key === 'Delete') {
          const textContent = (node.innerText || node.textContent || '').trim();
          const selection = window.getSelection();
          const range = selection?.rangeCount > 0 ? selection.getRangeAt(0) : null;
          if (textContent.length <= 1) {
            const isAtStart = range && range.startOffset === 0 && range.startContainer === node;
            const isAtEnd = range && range.endOffset === (node.textContent?.length || 0) && range.endContainer === node;
            if ((e.key === 'Backspace' && isAtStart) || (e.key === 'Delete' && isAtEnd)) {
              e.preventDefault();
              e.stopPropagation();
              if (!textContent) {
                node.textContent = ' ';
                const newRange = document.createRange();
                newRange.selectNodeContents(node);
                newRange.collapse(false);
                selection?.removeAllRanges();
                selection?.addRange(newRange);
              }
              return false;
            }
          }
        }
      });

      if (!root.__agiloDocKeys) {
        root.__agiloDocKeys = true;
        document.addEventListener('keydown', (e) => {
          const tr = editors.transcript;
          if (!tr) return;
          if (__mode !== 'structured') return;
          if (e.key === 'Escape' && _selectedSegs.size > 0) {
            e.preventDefault();
            clearSegSelection();
            return;
          }

          const key = String(e.key || '');
          const target = e.target;
          const targetIsEditable = !!(target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.contentEditable === 'true' ||
            target.closest?.('.ag-seg__text')
          ));

          if (_selectedSegs.size > 0 && (key === 'Backspace' || key === 'Delete') && !targetIsEditable) {
            e.preventDefault();
            e.stopPropagation();
            deleteSelectedSegments({ requireConfirm: true });
            return;
          }
          
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'Backspace') {
            const segEl = e.target && e.target.closest && e.target.closest('.ag-seg');
            if (!segEl || !tr.contains(segEl)) return;
            e.preventDefault();
            e.stopPropagation();
            deleteSegEl(segEl);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (key === 'z' || key === 'Z') && _undoStack.length > 0) {
            // Vérifier si le focus est dans un champ texte
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.contentEditable === 'true')) {
              // On laisse le navigateur gérer l'undo natif SI on est dans le texte du segment
              // sauf si on veut vraiment notre propre undo global.
              // Ici on laisse passer pour le texte.
              return;
            }
            e.preventDefault();
            applyUndo();
          }
        }, true);
      }

      root.__bound = true;
    }
  }
  window.renderSegments = renderSegments;


  function normalizeName(name) {
    let s = String(name || '').trim();
    s = s.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, '').replace(/[,;:—-]+$/, '').replace(/\s+/g, ' ');
    if (s.length % 2 === 0) {
      const a = s.slice(0, s.length / 2), b = s.slice(s.length / 2);
      if (a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0) s = a;
    }
    return s;
  }

  const toolbar = {
    srch: byId('srchQuery') || byId('ag-search'),
    prev: byId('srchPrev') || document.querySelector('[data-action="search-prev"]'),
    next: byId('srchNext') || document.querySelector('[data-action="search-next"]'),
    repl: byId('replText') || byId('ag-replace'),
    btnRepl: byId('btnReplace') || document.querySelector('[data-action="replace-one"]'),
    btnReplAll: byId('btnReplaceAll') || document.querySelector('[data-action="replace-all"]')
  };

  let HITS = [], CUR = -1, chip = null;
  if (toolbar.srch && !byId('srchCountChip')) {
    chip = document.createElement('span'); chip.id = 'srchCountChip'; chip.className = 'srch-count-chip'; chip.textContent = '0';
    toolbar.srch.insertAdjacentElement('afterend', chip);
  } else { chip = byId('srchCountChip'); }
  const updChip = () => { if (chip) chip.textContent = HITS.length ? `${CUR + 1}/${HITS.length}` : '0'; };

  function getActivePaneRoot() {
    const chatPane = byId('pane-chat');
    const chatViewEl = byId('chatView');
    if (isVisible(chatPane) && chatViewEl) return chatViewEl;
    const active = document.querySelector('.edtr-pane.is-active') || document.querySelector('.ag-panel.is-active')
      || document.querySelector('.edtr-pane:not([hidden])') || document.querySelector('.ag-panel:not([hidden])');
    if (!active) return editors.transcript || editors.summary || editors.conversation;
    if (/(^|-)summary$/.test(active.id)) return editors.summary || active;
    if (/(^|-)conversation$/.test(active.id)) return editors.conversation || active;
    return editors.transcript || active;
  }
  function getScopes() {
    const pane = getActivePaneRoot(); if (!pane) return [];
    if (pane.id === 'chatView') {
      const bubbles = Array.from(pane.querySelectorAll('.msg-bubble'));
      return bubbles.length ? bubbles : [pane];
    }
    const inTranscript = $$('.ag-seg__text', pane);
    return inTranscript.length ? inTranscript : [pane];
  }
  function clearScope(scope) {
    scope.querySelectorAll('.search-hit').forEach(span => span.replaceWith(document.createTextNode(span.textContent || '')));
    scope.normalize();
  }
  function clearAll() { getScopes().forEach(clearScope); HITS = []; CUR = -1; updChip(); }

  function buildRx(q) {
    if (!q) return null;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(esc, 'gi');
  }

  function highlight() {
    const q = (toolbar.srch?.value || '').trim();
    const rx = buildRx(q);
    clearAll();
    if (!rx) return;

    const scopes = getScopes(); const collector = [];
    scopes.forEach(scope => {
      scope.normalize();
      const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n?.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode?.closest('.search-hit,script,style,iframe')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let nodes = [], n; while (n = w.nextNode()) nodes.push(n);
      nodes.forEach(node => {
        const text = node.textContent || ''; if (!text) return;
        rx.lastIndex = 0; let last = 0, m = null; const frag = document.createDocumentFragment();
        while ((m = rx.exec(text)) !== null) {
          const i = m.index, j = i + m[0].length;
          if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
          const span = document.createElement('span'); span.className = 'search-hit'; span.textContent = text.slice(i, j);
          frag.appendChild(span); collector.push(span); last = j; if (!m[0].length) break;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      });
    });
    HITS = collector; CUR = HITS.length ? 0 : -1;
    if (CUR >= 0) {
      HITS[CUR].classList.add('is-current');
      agiloScrollIntoView(HITS[CUR], { allowWindow: false });
    }
    updChip();
  }

  function goto(delta) {
    if (!HITS.length) return;
    HITS.forEach(h => h.classList.remove('is-current'));
    CUR = (CUR + delta + HITS.length) % HITS.length;
    const el = HITS[CUR];
    el.classList.add('is-current');
    agiloScrollIntoView(el, { allowWindow: false });
    updChip();
    const pos = toolbar.srch?.value.length || 0;
    toolbar.srch?.focus({ preventScroll: true });
    try { toolbar.srch?.setSelectionRange(pos, pos); } catch { }
  }

  function markConfidenceModifiedForScope(scope) {
    if (!window.AgiloConfidence || typeof window.AgiloConfidence.markSegmentModified !== 'function') return;
    const root = editors.transcript;
    const segEl = scope?.closest?.('.ag-seg');
    if (!root || !segEl) return;
    const idx = Array.prototype.indexOf.call(root.children, segEl);
    if (idx >= 0) window.AgiloConfidence.markSegmentModified(idx);
  }

  function replaceOne() {
    if (getActivePaneRoot()?.id === 'chatView') { toast('Remplacement désactivé dans Conversation'); return; }
    if (CUR < 0 || !HITS[CUR]) return;
    const repl = toolbar.repl?.value ?? '';
    const el = HITS[CUR];
    const scope = el.closest?.('.ag-seg__text');
    el.textContent = repl;
    el.parentNode?.normalize?.();
    syncDomToModel();
    markConfidenceModifiedForScope(scope);
    const keep = CUR; highlight();
    if (HITS.length) { CUR = Math.min(keep, HITS.length - 1); HITS[CUR]?.classList.add('is-current'); updChip(); }
  }

  function replaceAll() {
    if (getActivePaneRoot()?.id === 'chatView') { toast('Remplacement désactivé dans Conversation'); return; }
    const q = (toolbar.srch?.value || '').trim(); if (!q) return;
    const rx = buildRx(q); if (!rx) return;
    const repl = toolbar.repl?.value ?? '';
    const changedScopes = new Set();
    getScopes().forEach(scope => {
      const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n?.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode?.closest('script,style,iframe')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let n, nodes = []; while (n = w.nextNode()) nodes.push(n);
      nodes.forEach(node => {
        const before = node.textContent || '';
        const after = before.replace(rx, repl);
        if (after !== before) {
          node.textContent = after;
          changedScopes.add(scope);
        }
      });
      scope.normalize();
    });
    syncDomToModel();
    changedScopes.forEach(markConfidenceModifiedForScope);
    highlight(); toast('Remplacements effectués');
  }

  let tDeb = null; const deb = (fn, d = 110) => { clearTimeout(tDeb); tDeb = setTimeout(fn, d); };
  toolbar.srch?.addEventListener('input', () => deb(highlight));
  toolbar.next?.addEventListener('click', () => goto(+1));
  toolbar.prev?.addEventListener('click', () => goto(-1));
  toolbar.btnRepl?.addEventListener('click', replaceOne);
  toolbar.btnReplAll?.addEventListener('click', replaceAll);
  toolbar.srch?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goto(-1) : goto(+1); } });

  function ag_countOccurrencesByName(name) {
    const target = String(name || '').trim();
    return window._segments.reduce((n, s) => n + (+((s.speaker || '').trim() === target)), 0);
  }
  function ag_contiguousRangeFrom(idx, name) {
    const target = String(name || '').trim();
    let start = idx, end = idx;
    while (start - 1 >= 0 && (String(window._segments[start - 1].speaker || '').trim() === target)) start--;
    while (end + 1 < window._segments.length && (String(window._segments[end + 1].speaker || '').trim() === target)) end++;
    return { start, end, count: Math.max(0, end - start + 1) };
  }
  function ag_applyRenameScope({ scope, oldName, newName, idx }) {
    const root = editors.transcript; if (!root) return 0;
    const targets = [];
    if (scope === 'one') targets.push(idx);
    else if (scope === 'contiguous') {
      const { start, end } = ag_contiguousRangeFrom(idx, oldName);
      for (let i = start; i <= end; i++) targets.push(i);
    } else if (scope === 'all') {
      window._segments.forEach((s, i) => { if ((s.speaker || '').trim() === String(oldName || '').trim()) targets.push(i); });
    } else if (scope === 'empty') {
      window._segments.forEach((s, i) => { if (!String(s.speaker || '').trim()) targets.push(i); });
    }
    const max = root.children.length;
    const unique = Array.from(new Set(targets)).filter(i => i >= 0 && i < max);
    unique.forEach(i => {
      (window._segments || (window._segments = []))[i] = (window._segments[i] || {});
      window._segments[i].speaker = newName;
      const el = root.children[i];
      if (!el) return;
      el.dataset.speaker = newName;
      const sp = el.querySelector('.speaker');
      if (sp) { sp.textContent = newName; sp.classList.remove('is-placeholder'); setSpeakerStyle(sp, newName); }
    });
    return unique.length;
  }
  function stickyBottomY() {
    const sticky = byId('agilo-audio-sticky');
    const wrap = byId('agilo-audio-wrap');
    const el = sticky || wrap;
    if (!el || !el.getBoundingClientRect) return 0;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight) return 0;
    return Math.max(0, r.bottom);
  }
  function paneRectForAnchor() {
    const pane = byId('pane-transcript') || editors.transcript;
    if (pane && pane.getBoundingClientRect) return pane.getBoundingClientRect();
    return { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  }
  function ag_bindAnchoredPopover(panel, anchor, { onClose } = {}) {
    const off = [];
    let raf = 0;
    let unbound = false;
    const on = (t, ev, fn, opt) => {
      if (!t) return;
      t.addEventListener(ev, fn, opt || false);
      off.push(() => t.removeEventListener(ev, fn, opt || false));
    };
    function unbind() {
      if (unbound) return;
      unbound = true;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      off.forEach((fn) => fn());
    }
    function placeNow() {
      if (!panel.isConnected || unbound) return;
      const aEl = (anchor && anchor.isConnected) ? anchor : null;
      const r = aEl
        ? aEl.getBoundingClientRect()
        : { top: innerHeight / 2, left: innerWidth / 2, bottom: innerHeight / 2, right: innerWidth / 2 };
      if (aEl && !anchorVisibleInPane(r, paneRectForAnchor())) {
        unbind();
        if (typeof onClose === 'function') onClose();
        return;
      }
      const pos = computePopoverPlace({
        anchor: r,
        size: { width: panel.offsetWidth, height: panel.offsetHeight },
        viewport: { width: innerWidth, height: innerHeight },
        pad: 8,
        stickyBottom: stickyBottomY()
      });
      panel.style.top = pos.top + 'px';
      panel.style.left = pos.left + 'px';
    }
    function place() {
      if (raf || unbound) return;
      raf = requestAnimationFrame(() => { raf = 0; placeNow(); });
    }
    const scrollOpt = { capture: true, passive: true };
    on(window, 'scroll', place, scrollOpt);
    on(window, 'resize', place);
    const pane = byId('pane-transcript');
    const root = editors.transcript || byId('transcriptEditor');
    if (pane) {
      if (anchor && anchor.getAttribute && anchor.getAttribute('data-agilo-plus-ghost')) {
        on(pane, 'scroll', () => {
          unbind();
          if (typeof onClose === 'function') onClose();
        }, scrollOpt);
      } else {
        on(pane, 'scroll', place, scrollOpt);
      }
    }
    if (root && root !== pane) {
      if (anchor && anchor.getAttribute && anchor.getAttribute('data-agilo-plus-ghost')) {
        on(root, 'scroll', () => {
          unbind();
          if (typeof onClose === 'function') onClose();
        }, scrollOpt);
      } else {
        on(root, 'scroll', place, scrollOpt);
      }
    }
    const stopWheel = (e) => { e.stopPropagation(); };
    on(panel, 'wheel', stopWheel);
    on(panel, 'touchmove', stopWheel, { passive: true });
    on(document, 'click', (e) => {
      if (unbound) return;
      if (panel.contains(e.target)) return;
      unbind();
      if (typeof onClose === 'function') onClose();
    }, true);
    on(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      unbind();
      if (typeof onClose === 'function') onClose();
    });
    try { _transcriptFollow.disarm(); } catch { }
    panel.style.visibility = 'hidden';
    if (!panel.parentNode) document.body.appendChild(panel);
    placeNow();
    panel.style.visibility = '';
    return { place: placeNow, unbind };
  }
  function ag_showRenameMenu(anchor, { oldName, counts, onSelect, forEmpty = false }) {
    document.querySelectorAll('.ag-rename-menu, .ag-rename-backdrop').forEach(n => n.remove());
    const menu = document.createElement('div');
    menu.className = 'ag-rename-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Appliquer le renommage');
    const hd = document.createElement('div'); hd.className = 'ag-rename-menu__hd'; hd.textContent = 'Appliquer le renommage à…';
    let closed = false;
    let bound = null;
    function close() {
      if (closed) return;
      closed = true;
      bound?.unbind();
      menu.remove();
    }
    const mk = (label, scope, suffix = '') => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ag-rename-menu__row';
      b.innerHTML = `${label}${suffix ? ` <span class="ag-rename-menu__muted">${suffix}</span>` : ''}`;
      b.addEventListener('click', () => { onSelect(scope); close(); }); return b;
    };
    const rows = [];
    rows.push(mk('Ce segment uniquement', 'one'));
    if (!forEmpty && counts.contig > 1) rows.push(mk('Ce groupe continu', 'contiguous', `${counts.contig} seg.`));
    if (!forEmpty && counts.total > 1) rows.push(mk(`Toutes les occurrences de "${oldName}"`, 'all', `${counts.total} seg.`));
    if (forEmpty && counts.empty > 1) rows.push(mk('Tous les segments sans nom', 'empty', `${counts.empty} seg.`));
    if (rows.length === 1) rows.push(mk(forEmpty ? 'Tous les segments sans nom' : 'Toutes les occurrences', forEmpty ? 'empty' : 'all'));
    menu.appendChild(hd); rows.forEach(r => menu.appendChild(r));
    bound = ag_bindAnchoredPopover(menu, anchor, { onClose: close });
    try { menu.querySelector('.ag-rename-menu__row')?.focus({ preventScroll: true }); } catch { }
  }

  let _speakerRosterSession = [];

  function isSpeakerPickerEnabled() {
    try {
      if (window.AGILOTEXT_SPEAKER_PICKER === false) return false;
      const q = new URLSearchParams(location.search).get('agilo_speaker_picker');
      if (q === '0' || q === 'false' || q === 'off') return false;
    } catch { /* ignore */ }
    return true;
  }
  function getJobIdForRoster() {
    try {
      const fromDs = (byId('editorRoot')?.dataset?.jobId
        || document.querySelector('[data-job-id]')?.getAttribute('data-job-id')
        || '').trim();
      const fromQ = (new URLSearchParams(location.search).get('jobId') || '').trim();
      return fromDs || fromQ;
    } catch { return ''; }
  }
  function loadStoredRoster(jobId) {
    const key = speakerRosterStorageKey(jobId);
    if (!key) return _speakerRosterSession.slice();
    try {
      const raw = localStorage.getItem(key);
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map((s) => String(s || '').trim()).filter(Boolean) : [];
    } catch { return []; }
  }
  function pushStoredRoster(jobId, name) {
    const n = String(name || '').trim();
    if (!n) return;
    const key = speakerRosterStorageKey(jobId);
    if (!key) {
      if (_speakerRosterSession.indexOf(n) < 0) _speakerRosterSession.push(n);
      return;
    }
    const cur = loadStoredRoster(jobId);
    if (cur.indexOf(n) < 0) {
      cur.push(n);
      try { localStorage.setItem(key, JSON.stringify(cur)); } catch { /* ignore */ }
    }
  }
  function dropStoredRoster(jobId, name) {
    const n = String(name || '').trim();
    if (!n) return;
    _speakerRosterSession = _speakerRosterSession.filter((s) => s !== n);
    const key = speakerRosterStorageKey(jobId);
    if (!key) return;
    const cur = loadStoredRoster(jobId).filter((s) => s !== n);
    try { localStorage.setItem(key, JSON.stringify(cur)); } catch { /* ignore */ }
  }
  function forgetRosterNameIfUnused(name) {
    const n = String(name || '').trim();
    if (!n) return;
    if (ag_countOccurrencesByName(n) > 0) return;
    dropStoredRoster(getJobIdForRoster(), n);
  }
  function collectRosterNames() {
    const seen = Object.create(null);
    const out = [];
    function add(n) {
      const t = String(n || '').trim();
      if (!t || seen[t]) return;
      seen[t] = 1;
      out.push(t);
    }
    (window._segments || []).forEach((s) => add(s && s.speaker));
    loadStoredRoster(getJobIdForRoster()).forEach(add);
    return out;
  }
  function ag_closeSpeakerPicker() {
    document.querySelectorAll('.ag-speaker-picker, .ag-speaker-picker-backdrop').forEach((n) => n.remove());
  }
  function isPlusSpeakerShortcut(e) {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return false;
    return e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd';
  }
  function hasSpeakerLabelsLive() {
    if (Array.isArray(window._segments) && window._segments.length > 0) {
      return hasSpeakerLabels(window._segments);
    }
    const root = editors.transcript;
    if (!root) return true;
    const segs = Array.from(root.querySelectorAll(':scope > .ag-seg'));
    if (!segs.length) return true;
    return hasSpeakerLabels(segs.map((seg) => ({
      speaker: seg.dataset.speaker || seg.querySelector('.speaker')?.textContent || ''
    })));
  }
  function parseSegTime(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function offsetInBox(box, node, off) {
    if (!box || !node) return 0;
    try {
      if (!(box === node || box.contains(node))) return 0;
      const r = document.createRange();
      r.setStart(box, 0);
      r.setEnd(node, off);
      return r.toString().length;
    } catch {
      return 0;
    }
  }
  function snapshotPlusCaret() {
    const root = editors.transcript;
    if (!root) return null;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !root.contains(el)) return null;
    const seg = el.closest && el.closest('.ag-seg');
    if (!seg || !root.contains(seg)) return null;
    const box = seg.querySelector('.ag-seg__text');
    if (!box) return null;
    const full = (typeof window.visibleTextFromBox === 'function')
      ? window.visibleTextFromBox(box)
      : String(box.textContent || '');
    const off = offsetInBox(box, range.startContainer, range.startOffset);
    const parts = sliceTextAt(full, off);
    return {
      root,
      seg,
      left: parts.left,
      right: parts.right,
      start: parseSegTime(seg.dataset.start),
      end: parseSegTime(seg.dataset.end),
      oldSpeaker: String(seg.dataset.speaker || '').trim()
    };
  }
  function removePlusGhost() {
    document.querySelectorAll('[data-agilo-plus-ghost]').forEach((n) => n.remove());
  }
  function createPlusGhost(e, seg) {
    removePlusGhost();
    let rect = null;
    const plus = (e && e.target && e.target.closest) ? e.target.closest('.ag-ux-plus') : null;
    if (plus && plus.getBoundingClientRect) {
      const r = plus.getBoundingClientRect();
      if (r.width || r.height || r.left || r.top) rect = r;
    }
    if (!rect && seg) {
      const a = seg.querySelector('.rename-btn') || seg.querySelector('.speaker') || seg;
      if (a && a.getBoundingClientRect) rect = a.getBoundingClientRect();
    }
    if (!rect) rect = { left: 24, top: 120 };
    const ghost = document.createElement('div');
    ghost.setAttribute('data-agilo-plus-ghost', '1');
    ghost.style.cssText = 'position:fixed;width:1px;height:1px;pointer-events:none;z-index:0;';
    ghost.style.left = Math.round(rect.left) + 'px';
    ghost.style.top = Math.round(rect.top) + 'px';
    document.body.appendChild(ghost);
    return ghost;
  }
  function setSegTimeButton(segEl, start) {
    const btn = segEl && segEl.querySelector && segEl.querySelector('button.time');
    if (!btn) return;
    const hasStart = Number.isFinite(start);
    const tText = hasStart ? fmtHMS(start) : '00:00';
    btn.textContent = tText;
    btn.dataset.action = 'seek';
    btn.dataset.t = hasStart ? String(start) : '0';
    btn.title = hasStart ? ('Aller à ' + tText) : 'Aller au début (00:00)';
  }
  function placeCaretAtStart(box) {
    if (!box) return;
    try { box.focus({ preventScroll: true }); } catch { }
    try {
      const r = document.createRange();
      r.selectNodeContents(box);
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch { }
  }
  function agiloSplitAtCaretCreateSpeaker(snapshot) {
    if (!snapshot || !snapshot.seg || !snapshot.seg.isConnected) {
      try { toast('Le paragraphe a changé, réessayez.'); } catch { }
      return null;
    }
    const root = snapshot.root || editors.transcript;
    const seg = snapshot.seg;
    if (!root || !root.contains(seg)) {
      try { toast('Le paragraphe a changé, réessayez.'); } catch { }
      return null;
    }
    const box = seg.querySelector('.ag-seg__text');
    if (!box) return null;
    const clone = seg.cloneNode(true);
    clone.classList.remove('is-active', 'is-selected');
    clone.dataset.id = 's' + Date.now();
    const mid = computeMidStart(snapshot.start, snapshot.end);
    box.textContent = snapshot.left;
    const nb = clone.querySelector('.ag-seg__text');
    if (nb) nb.textContent = snapshot.right;
    clone.dataset.speaker = '';
    const sp = clone.querySelector('.speaker');
    if (sp) {
      sp.textContent = '';
      sp.classList.remove('is-placeholder');
      setSpeakerStyle(sp, '');
    }
    if (mid != null) {
      seg.dataset.end = String(mid);
      clone.dataset.start = String(mid);
      setSegTimeButton(clone, mid);
    }
    if (snapshot.end != null) clone.dataset.end = String(snapshot.end);
    seg.after(clone);
    try {
      if (Array.isArray(window._segments)) {
        const idx = Array.prototype.indexOf.call(root.children, seg);
        const old = window._segments[idx] || {};
        const leftObj = Object.assign({}, old, {
          end: (mid != null ? mid : old.end),
          text: snapshot.left
        });
        const rightObj = {
          id: clone.dataset.id,
          start: (mid != null ? mid : (old.start != null ? old.start : null)),
          end: old.end != null ? old.end : null,
          speaker: '',
          text: snapshot.right
        };
        window._segments.splice(idx, 1, leftObj, rightObj);
      }
    } catch { }
    try { clearSegSelection(); } catch { }
    placeCaretAtStart(nb);
    try { if (typeof window.syncDomToModel === 'function') window.syncDomToModel(); } catch { }
    applySplitTrimNearCaret();
    try {
      const leftIdx = Array.prototype.indexOf.call(root.children, seg);
      if (window.AgiloConfidence && typeof window.AgiloConfidence.markSegmentModified === 'function') {
        if (leftIdx >= 0) window.AgiloConfidence.markSegmentModified(leftIdx);
        window.AgiloConfidence.markSegmentModified(leftIdx + 1);
      }
    } catch { }
    return clone;
  }
  function agiloApplyPlusSpeakerName(clone, newName) {
    const root = editors.transcript;
    if (!root || !clone) return;
    const idx = Array.prototype.indexOf.call(root.children, clone);
    if (idx < 0) return;
    pushStoredRoster(getJobIdForRoster(), newName);
    ag_applyRenameScope({ scope: 'one', oldName: '', newName, idx });
    toast('Locuteur mis à jour');
  }
  function startPlusSpeakerFlow(e) {
    if (!isSpeakerPickerEnabled() || !hasSpeakerLabelsLive()) return;
    e.preventDefault();
    e.stopPropagation();
    if (__mode !== 'structured') {
      try { toast('Disponible en mode segmenté.'); } catch { }
      return;
    }
    const snapshot = snapshotPlusCaret();
    if (!snapshot) {
      try { toast('Disponible en mode segmenté.'); } catch { }
      return;
    }
    try { window.AgiloTranscriptFollow?.disarm(); } catch { }
    const ghost = createPlusGhost(e, snapshot.seg);
    ag_showSpeakerPicker(ghost, {
      currentName: '',
      names: collectRosterNames(),
      onPick(raw) {
        removePlusGhost();
        const newName = normalizeName(raw);
        if (!newName) return;
        const clone = agiloSplitAtCaretCreateSpeaker(snapshot);
        if (!clone) return;
        agiloApplyPlusSpeakerName(clone, newName);
      },
      onCancel() {
        removePlusGhost();
      }
    });
  }
  function ag_showSpeakerPicker(anchor, { currentName, names, onPick, onCancel } = {}) {
    ag_closeSpeakerPicker();
    document.querySelectorAll('.ag-rename-menu, .ag-rename-backdrop').forEach((n) => n.remove());
    if (!(anchor && anchor.getAttribute && anchor.getAttribute('data-agilo-plus-ghost'))) {
      removePlusGhost();
    }
    const allNames = Array.isArray(names) ? names.slice() : [];
    let query = '';
    let active = 0;

    const panel = document.createElement('div');
    panel.className = 'ag-speaker-picker';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Choisir un interlocuteur');

    const person = isPersonNameLabel(currentName) ? splitPersonName(currentName) : null;
    const spellCount = person ? ag_countOccurrencesByName(currentName) : 0;
    let applyAllBox = null;
    let nomInput = null;
    const spell = person ? document.createElement('div') : null;
    if (spell) {
      spell.className = 'ag-speaker-picker__spell';
      const title = document.createElement('div');
      title.className = 'ag-speaker-picker__spell-title';
      title.textContent = 'Corriger « ' + currentName + ' »';
      const fields = document.createElement('div');
      fields.className = 'ag-speaker-picker__spell-fields';
      const prenomInput = document.createElement('input');
      prenomInput.type = 'text';
      prenomInput.className = 'ag-speaker-picker__spell-input';
      prenomInput.value = person.prenom;
      prenomInput.setAttribute('aria-label', 'Prénom');
      prenomInput.placeholder = 'Prénom';
      nomInput = document.createElement('input');
      nomInput.type = 'text';
      nomInput.className = 'ag-speaker-picker__spell-input';
      nomInput.value = person.nom;
      nomInput.setAttribute('aria-label', 'Nom');
      nomInput.placeholder = 'Nom';
      fields.appendChild(prenomInput);
      fields.appendChild(nomInput);
      const row = document.createElement('label');
      row.className = 'ag-speaker-picker__spell-all';
      applyAllBox = document.createElement('input');
      applyAllBox.type = 'checkbox';
      applyAllBox.checked = true;
      const cap = document.createElement('span');
      cap.textContent = spellCount > 1
        ? 'Toutes les prises de parole (' + spellCount + ')'
        : 'Ce segment';
      row.appendChild(applyAllBox);
      row.appendChild(cap);
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'ag-speaker-picker__spell-go';
      go.textContent = 'Valider';
      function validateSpell(ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        const joined = joinPersonName(prenomInput.value, nomInput.value);
        if (!joined || joined === currentName) { close(true); return; }
        const scope = (applyAllBox && applyAllBox.checked && spellCount > 1) ? 'all' : 'one';
        close(false);
        if (typeof onPick === 'function') onPick(joined, scope);
      }
      go.addEventListener('click', validateSpell);
      prenomInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') validateSpell(ev); });
      nomInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') validateSpell(ev); });
      spell.appendChild(title);
      spell.appendChild(fields);
      spell.appendChild(row);
      spell.appendChild(go);
    }

    const searchWrap = document.createElement('div');
    searchWrap.className = 'ag-speaker-picker__search';
    searchWrap.innerHTML = nucleoIcon('search', 'ag-speaker-picker__ico');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ag-speaker-picker__input';
    input.setAttribute('placeholder', 'Rechercher un nom');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    searchWrap.appendChild(input);

    const list = document.createElement('div');
    list.className = 'ag-speaker-picker__list';
    list.setAttribute('role', 'listbox');

    let closed = false;
    let bound = null;
    function close(cancel) {
      if (closed) return;
      closed = true;
      bound?.unbind();
      ag_closeSpeakerPicker();
      if (cancel && typeof onCancel === 'function') onCancel();
    }
    function pick(raw) {
      const value = String(raw || '');
      close(false);
      if (typeof onPick === 'function') onPick(value);
    }
    function tryCreateFromQuery() {
      if (!shouldCreateSpeakerFromQuery(query, allNames)) return false;
      const n = normalizeName(query);
      if (!n) return false;
      pushStoredRoster(getJobIdForRoster(), n);
      pick(n);
      return true;
    }

    function correctionLabel() {
      const q = String(query || '').trim();
      if (!q) return '';
      const folded = foldSpeakerSearch(q);
      if (allNames.some((n) => foldSpeakerSearch(n) === folded)) return '';
      if (!filterSpeakerRoster(allNames, q).length) return '';
      return q;
    }
    function spellScope() {
      if (applyAllBox && applyAllBox.checked && spellCount > 1) return 'all';
      return 'one';
    }
    function applyCorrection(raw) {
      const n = normalizeName(raw);
      if (!n) return;
      close(false);
      if (typeof onPick === 'function') onPick(n, spellScope());
    }

    function visibleRows() {
      const filtered = filterSpeakerRoster(allNames, query);
      const good = filtered.filter((n) => !isJunkSpeakerLabel(n));
      const junk = filtered.filter((n) => isJunkSpeakerLabel(n));
      return good.concat(junk);
    }

    function renderList() {
      const rows = visibleRows();
      const corr = correctionLabel();
      const total = rows.length + (corr ? 1 : 0);
      if (active >= total) active = Math.max(0, total - 1);
      list.textContent = '';
      if (corr) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ag-speaker-picker__row is-correct' + (active === 0 ? ' is-active' : '');
        b.setAttribute('role', 'option');
        const lab = document.createElement('span');
        lab.className = 'ag-speaker-picker__name';
        lab.textContent = 'Corriger en « ' + corr + ' »';
        b.appendChild(lab);
        b.addEventListener('click', () => applyCorrection(corr));
        list.appendChild(b);
      }
      if (!rows.length && !corr) {
        if (shouldCreateSpeakerFromQuery(query, allNames)) {
          const label = String(query || '').trim();
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ag-speaker-picker__row is-active';
          b.setAttribute('role', 'option');
          b.setAttribute('aria-label', 'Ajouter ' + label);
          b.innerHTML = nucleoIcon('userPlus', 'ag-speaker-picker__ico');
          const lab = document.createElement('span');
          lab.className = 'ag-speaker-picker__name';
          lab.textContent = 'Ajouter « ' + label + ' »';
          b.appendChild(lab);
          b.addEventListener('click', () => { tryCreateFromQuery(); });
          list.appendChild(b);
        } else {
          const empty = document.createElement('div');
          empty.className = 'ag-speaker-picker__empty';
          empty.textContent = 'Tapez un nom, Entrée pour l\'ajouter';
          list.appendChild(empty);
        }
        if (bound) bound.place();
        return;
      }
      const good = rows.filter((n) => !isJunkSpeakerLabel(n));
      const junk = rows.filter((n) => isJunkSpeakerLabel(n));
      const off = corr ? 1 : 0;
      function section(title, items, offset) {
        if (!items.length) return;
        const hd = document.createElement('div');
        hd.className = 'ag-speaker-picker__hd';
        hd.textContent = title;
        list.appendChild(hd);
        items.forEach((name, i) => {
          const idx = offset + i;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ag-speaker-picker__row' + (idx === active ? ' is-active' : '');
          b.setAttribute('role', 'option');
          if (name === currentName) b.setAttribute('aria-selected', 'true');
          const color = getSpeakerColor(name);
          const dot = document.createElement('span');
          dot.className = 'ag-speaker-picker__dot';
          dot.style.background = color;
          const lab = document.createElement('span');
          lab.className = 'ag-speaker-picker__name';
          lab.textContent = name;
          const count = document.createElement('span');
          count.className = 'ag-speaker-picker__count';
          count.textContent = String(ag_countOccurrencesByName(name));
          b.appendChild(dot);
          b.appendChild(lab);
          if (name === currentName) {
            const mark = document.createElement('span');
            mark.className = 'ag-speaker-picker__check';
            mark.innerHTML = nucleoIcon('check');
            b.appendChild(mark);
          }
          b.appendChild(count);
          b.addEventListener('click', () => pick(name));
          list.appendChild(b);
        });
      }
      section('Interlocuteurs', good, off);
      section('À corriger', junk, off + good.length);
      if (bound) bound.place();
    }

    input.addEventListener('input', () => {
      query = input.value;
      active = 0;
      renderList();
    });
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return;
      if (e.target && e.target.classList && e.target.classList.contains('ag-speaker-picker__spell-input')) return;
      const rows = visibleRows();
      const corr = correctionLabel();
      const total = rows.length + (corr ? 1 : 0);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!total) return;
        active = Math.min(total - 1, active + 1);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!total) return;
        active = Math.max(0, active - 1);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (corr && active === 0) { applyCorrection(corr); return; }
        const nameIdx = corr ? active - 1 : active;
        if (rows[nameIdx]) pick(rows[nameIdx]);
        else tryCreateFromQuery();
      }
    });

    if (spell) panel.appendChild(spell);
    panel.appendChild(searchWrap);
    panel.appendChild(list);
    renderList();
    bound = ag_bindAnchoredPopover(panel, anchor, { onClose() { close(true); } });
    try { (nomInput || input).focus({ preventScroll: true }); } catch { }
  }

  function doRenameFor(segEl, { triggerEl = null, renameAllEmpty = false, keyState = {} } = {}) {
    const root = editors.transcript; if (!root) return;
    try { if (typeof window.syncDomToModel === 'function') window.syncDomToModel(); } catch { }
    const idx = Array.prototype.indexOf.call(root.children, segEl); if (idx < 0) return;

    const oldName = String(segEl.dataset.speaker || '').trim();
    const proposed = oldName || 'Intervenant';
    const anchor = triggerEl || segEl;

    function finishRename(scope, newName) {
      const n = ag_applyRenameScope({ scope, oldName, newName, idx });
      forgetRosterNameIfUnused(oldName);
      const spell = scope === 'all' || scope === 'one';
      if (spell && oldName) {
        toast(`« ${oldName} » → « ${newName} » (${n}). Cliquez Sauvegarder.`);
        return;
      }
      toast(
        scope === 'one' ? 'Locuteur mis à jour. Cliquez Sauvegarder.' :
          scope === 'contiguous' ? `Groupe renommé (${n} seg.). Cliquez Sauvegarder.` :
            scope === 'all' ? `Toutes les occurrences → « ${newName} » (${n}). Cliquez Sauvegarder.` :
              `Segments sans nom → « ${newName} » (${n}). Cliquez Sauvegarder.`
      );
    }

    function afterNameChosen(rawName, presetScope) {
      ag_closeSpeakerPicker();
      const newName = normalizeName(rawName);
      if (!newName || newName === oldName) return;
      pushStoredRoster(getJobIdForRoster(), newName);

      if (presetScope === 'all' || presetScope === 'one') {
        const total = oldName ? ag_countOccurrencesByName(oldName) : 0;
        const scope = (presetScope === 'all' && total > 1) ? 'all' : 'one';
        finishRename(scope, newName);
        return;
      }

      const emptyCount = window._segments.reduce((n, s) => n + (+(!String(s.speaker || '').trim())), 0);
      const counts = {
        total: oldName ? ag_countOccurrencesByName(oldName) : 0,
        contig: oldName ? ag_contiguousRangeFrom(idx, oldName).count : 0,
        empty: emptyCount
      };

      const shift = !!keyState.shift;
      const alt = !!keyState.alt;

      if (oldName) {
        if (shift) { finishRename('all', newName); return; }
        if (alt) { finishRename('contiguous', newName); return; }
      } else if (renameAllEmpty) {
        finishRename('empty', newName);
        return;
      }

      const forEmpty = !oldName;
      ag_showRenameMenu(anchor, {
        oldName, counts, forEmpty,
        onSelect(scope) { finishRename(scope, newName); }
      });
    }

    if (!isSpeakerPickerEnabled()) {
      const rawName = (prompt('Renommer le locuteur :', proposed) || '');
      afterNameChosen(rawName);
      return;
    }
    try {
      ag_showSpeakerPicker(anchor, {
        currentName: oldName,
        names: collectRosterNames(),
        onPick: afterNameChosen,
        onCancel() { }
      });
    } catch {
      const rawName = (prompt('Renommer le locuteur :', proposed) || '');
      afterNameChosen(rawName);
    }
  }




  function attachAudioSync() {
    const root = editors.transcript; if (!root) return;
    const audio = byId('agilo-audio'); if (!audio) return;
    if (root.__syncBound) return;

    bindSplitTrim();
    bindFollowPause(document.getElementById('pane-transcript'));
    bindFollowPause(root);
    removePaneFollowLeftover();
    dispatchTranscriptFollow(_transcriptFollow.armed);

    audio.addEventListener('timeupdate', () => {
      if (__mode !== 'structured' || !window._segments.length) return;
      const k = resolveActiveSegmentIndex(audio.currentTime || 0, window._segments, _activeSeg);
      if (k !== _activeSeg) {
        if (_activeSeg >= 0) root.children[_activeSeg]?.classList.remove('is-active');
        _activeSeg = k;
        const el = root.children[k];
        if (el) {
          el.classList.add('is-active');
          scrollToActivePlaybackSegment({ force: false });
        }
      }
    });

    root.__syncBound = true;
  }
  window.attachAudioSync = attachAudioSync;

  /* ====================== Fonctions Lottie pour le chargement du compte-rendu ====================== */

  /**
   * Cache simple pour getTranscriptStatus (évite les appels multiples)
   */
  const __statusCache = new Map();
  const STATUS_CACHE_TTL = 2000; // 2 secondes

  /**
   * Appeler l'API getTranscriptStatus pour obtenir le statut
   * ⚠️ AMÉLIORATION : Ajout de retry et cache
   */
  async function getTranscriptStatus(jobId, auth, retryCount = 0) {
    // Vérifier le cache
    const cacheKey = `${jobId}:${auth.username}:${auth.edition}`;
    const cached = __statusCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < STATUS_CACHE_TTL) {
      if (window.AGILO_DEBUG) console.log('[Editor] Statut depuis cache:', cached.status);
      return cached.status;
    }

    try {
      const url = `${API_BASE}/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;

      const response = await fetchWithTimeout(url, { timeout: 10000 });

      if (!response.ok) {
        // Retry pour les erreurs 5xx (erreurs serveur)
        if ((response.status >= 500 || response.status === 0) && retryCount < 2) {
          if (window.AGILO_DEBUG) console.log(`[Editor] Retry getTranscriptStatus (${retryCount + 1}/2) pour erreur ${response.status}`);
          await wait(500 * Math.pow(2, retryCount));
          return getTranscriptStatus(jobId, auth, retryCount + 1);
        }
        if (window.AGILO_DEBUG) console.error('[Editor] Erreur HTTP getTranscriptStatus:', response.status);
        return null;
      }

      const data = await response.json();
      let status = null;

      if (data.status === 'OK' && data.transcriptStatus) {
        status = data.transcriptStatus;
      } else if (data.status === 'KO') {
        if (window.AGILO_DEBUG) console.error('[Editor] Erreur API getTranscriptStatus:', data.errorMessage);
        // Vérifier si c'est l'erreur "fichier manquant"
        if (data.errorMessage && /ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(data.errorMessage)) {
          status = 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
        }
      }

      // Mettre en cache
      if (status !== null) {
        __statusCache.set(cacheKey, { status, timestamp: Date.now() });
        // Nettoyer le cache après 10 secondes pour éviter la croissance infinie
        setTimeout(() => __statusCache.delete(cacheKey), 10000);
      }

      return status;
    } catch (error) {
      // Retry pour les erreurs réseau
      if (retryCount < 2 && (error?.name === 'AbortError' || error?.message?.includes('timeout') || error?.message?.includes('network'))) {
        if (window.AGILO_DEBUG) console.log(`[Editor] Retry getTranscriptStatus (${retryCount + 1}/2) pour erreur réseau`);
        await wait(500 * Math.pow(2, retryCount));
        return getTranscriptStatus(jobId, auth, retryCount + 1);
      }
      if (window.AGILO_DEBUG) console.error('[Editor] Erreur réseau getTranscriptStatus:', error);
      return null;
    }
  }

  /**
   * Initialiser l'animation Lottie avec Webflow
   */
  function initLottieAnimation(element) {
    // Méthode 1: Utiliser Webflow IX2 si disponible
    if (window.Webflow && window.Webflow.require) {
      try {
        const ix2 = window.Webflow.require('ix2');
        if (ix2 && typeof ix2.init === 'function') {
          setTimeout(() => {
            ix2.init();
          }, 100);
        }
      } catch (e) {
        if (window.AGILO_DEBUG) console.log('[Editor] Webflow IX2 non disponible');
      }
    }

    // Méthode 2: Utiliser directement la bibliothèque Lottie si disponible
    if (window.lottie && typeof window.lottie.loadAnimation === 'function') {
      try {
        const animationData = {
          container: element,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json'
        };

        if (!element._lottie) {
          element._lottie = window.lottie.loadAnimation(animationData);
        }
      } catch (e) {
        if (window.AGILO_DEBUG) console.log('[Editor] Lottie direct non disponible:', e);
      }
    }

    // Méthode 3: Attendre que Webflow charge l'animation
    setTimeout(() => {
      if (window.Webflow && window.Webflow.require) {
        try {
          window.Webflow.require('ix2').init();
        } catch (e) { }
      }
    }, 200);
  }

  function isSummaryUiContextCurrent(context = {}) {
    if (!editorRoot) return true;
    const currentId = String(editorRoot.dataset.jobId || '').trim();
    const ctxId = String(context.jobId || '').trim();
    if (ctxId && currentId && ctxId !== currentId) return false;
    if (context.seq !== undefined && context.seq !== null && context.seq !== __loadSeq) return false;
    return true;
  }

  /**
   * Afficher un indicateur de chargement dans l'onglet Compte-rendu
   * Utilise l'animation Lottie existante
   */
  function showSummaryLoading(context = {}) {
    const ctxJobId = String(context?.jobId || '').trim();
    const ctxSeq = typeof context?.seq === 'number' ? String(context.seq) : '';
    const force = context?.force === true;

    if (!force) {
      if (ctxJobId && __lastLoadJobId && ctxJobId !== __lastLoadJobId) return;
      if (!isSummaryUiContextCurrent({ jobId: ctxJobId || __lastLoadJobId, seq: context?.seq ?? null })) return;
    }

    const summaryEditor = editors.summary || pickSummaryEl();
    if (!summaryEditor) return;

    // Créer le conteneur de chargement
    let loaderContainer = summaryEditor.querySelector('.summary-loading-indicator');

    if (!loaderContainer) {
      loaderContainer = document.createElement('div');
      loaderContainer.className = 'summary-loading-indicator';

      // Chercher l'élément Lottie existant dans le DOM (peut être ailleurs)
      let lottieElement = document.querySelector('#loading-summary');

      // Si l'élément Lottie n'existe pas, le créer
      if (!lottieElement) {
        lottieElement = document.createElement('div');
        lottieElement.id = 'loading-summary';
        lottieElement.className = 'lottie-check-statut';
        lottieElement.setAttribute('data-w-id', '3f0ed4f9-0ff3-907d-5d6d-28f23fb3783f');
        lottieElement.setAttribute('data-animation-type', 'lottie');
        lottieElement.setAttribute('data-src', 'https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355b3_Animation%20-%201705419825493.json');
        lottieElement.setAttribute('data-loop', '1');
        lottieElement.setAttribute('data-direction', '1');
        lottieElement.setAttribute('data-autoplay', '1');
        lottieElement.setAttribute('data-is-ix2-target', '0');
        lottieElement.setAttribute('data-renderer', 'svg');
        lottieElement.setAttribute('data-default-duration', '2');
        lottieElement.setAttribute('data-duration', '0');
      } else {
        // Si l'élément existe ailleurs, le cloner
        const clonedLottie = lottieElement.cloneNode(true);
        clonedLottie.id = 'loading-summary-clone';
        lottieElement = clonedLottie;
      }

      // Ajouter les textes
      const loadingText = document.createElement('p');
      loadingText.className = 'loading-text';
      loadingText.textContent = 'Génération du compte-rendu en cours...';

      const loadingSubtitle = document.createElement('p');
      loadingSubtitle.className = 'loading-subtitle';
      loadingSubtitle.textContent = 'Cela peut prendre quelques instants';

      summaryEditor.innerHTML = '';
      // Réinitialiser les attributs de lecture seule pendant le chargement
      summaryEditor.removeAttribute('contenteditable');
      summaryEditor.removeAttribute('readonly');
      summaryEditor.style.userSelect = '';
      summaryEditor.style.cursor = '';
      summaryEditor.classList.remove('ag-summary-readonly');
      summaryEditor.appendChild(loaderContainer);
      loaderContainer.appendChild(lottieElement);
      loaderContainer.appendChild(loadingText);
      loaderContainer.appendChild(loadingSubtitle);

      // Initialiser l'animation Lottie après l'ajout au DOM
      setTimeout(() => {
        initLottieAnimation(lottieElement);

        // Fallback: Si après 1 seconde l'animation ne s'affiche pas, afficher un spinner CSS
        setTimeout(() => {
          const hasLottieContent = lottieElement.querySelector('svg, canvas') || lottieElement._lottie;
          if (!hasLottieContent) {
            if (window.AGILO_DEBUG) console.log('[Editor] Lottie ne s\'est pas chargé, utilisation du fallback');
            const fallback = document.createElement('div');
            fallback.className = 'lottie-fallback';
            lottieElement.style.display = 'none';
            loaderContainer.insertBefore(fallback, lottieElement);
          }
        }, 1000);
      }, 100);

    } else {
      // Si le conteneur existe déjà, juste l'afficher
      loaderContainer.style.display = 'flex';

      // Réinitialiser l'animation Lottie
      const lottieElement = loaderContainer.querySelector('#loading-summary, #loading-summary-clone');
      if (lottieElement) {
        setTimeout(() => {
          initLottieAnimation(lottieElement);
        }, 100);
      }
    }

    // Afficher le conteneur
    loaderContainer.style.display = 'flex';
  }

  /**
   * Masquer l'indicateur de chargement
   * ⚠️ AMÉLIORATION : Cherche uniquement dans editors.summary pour éviter les conflits
   */
  function hideSummaryLoading(context = {}) {
    const ctxJobId = String(context?.jobId || '').trim();
    const ctxSeq = typeof context?.seq === 'number' ? String(context.seq) : '';
    const force = context?.force === true;

    if (!force) {
      if (ctxJobId && __lastLoadJobId && ctxJobId !== __lastLoadJobId) return;
      if (!isSummaryUiContextCurrent({ jobId: ctxJobId || __lastLoadJobId, seq: context?.seq ?? null })) return;
    }

    const summaryEditor = editors.summary || pickSummaryEl();
    if (!summaryEditor) return;

    // Chercher uniquement dans summaryEditor, pas dans tout le document
    const loader = summaryEditor.querySelector('.summary-loading-indicator');
    const lottieElement = summaryEditor.querySelector('#loading-summary, #loading-summary-clone');

    if (loader) {
      loader.style.display = 'none';
    }

    if (lottieElement) {
      lottieElement.style.display = 'none';
    }
  }

  /* ====================== Summary repoll (annulable) ====================== */
  /**
   * ⚠️ AMÉLIORATION : Fonction pure qui ne gère plus l'UI directement
   * La gestion du loader est faite dans loadJob()
   */
  async function pollSummaryUntilReady(jobId, auth, { max = 50, baseDelay = 900, signal, seq } = {}) {
    const ref = seq ?? __loadSeq;
    for (let i = 0; i < max; i++) {
      if (signal?.aborted || isStale(ref)) {
        return { ok: false, code: 'CANCELLED' };
      }
      const r = await apiGetWithRetry('summary', jobId, { ...auth }, 0, signal);
      if (r.ok) {
        const raw = r.payload || '';
        // ✅ CORRECTION : Vérifier si non-vide APRÈS sanitization (pour la logique)
        // mais retourner le HTML BRUT pour permettre la détection des styles globaux
        if (!isBlankHtml(sanitizeHtml(raw))) {
          return { ok: true, html: raw };  // ✅ Retourner le HTML BRUT
        }
      } else if (!/READY_SUMMARY_PENDING|NOT_READY|PENDING/i.test(String(r.code || ''))) {
        return r;
      }
      await wait(baseDelay * Math.pow(1.3, i));
    }
    return { ok: false, code: 'READY_SUMMARY_PENDING' };
  }

  let __lastLoadJobId = null;
  let __loadSeq = 0;
  let __activeFetchCtl = null;
  function computeSeq() { return (++__loadSeq); }
  function isStale(seq) { return (seq !== __loadSeq); }


  let __wdTimer;
  let __wdToken = 0;

  window.addEventListener('agilo:beforeload', (e) => {
    try { window.AgiloConfidence?.resetSessionState?.(); } catch { }
    // ⚠️ AMÉLIORATION : Nettoyer immédiatement tous les états précédents
    try { __activeFetchCtl?.abort?.(); } catch { }
    clearTimeout(__wdTimer);
    __wdToken++;

    editors.transcript = pickTranscriptEl();
    editors.summary = pickSummaryEl();

    const tr = editors.transcript, sm = editors.summary;

    // ⚠️ AMÉLIORATION : Toujours réinitialiser le contenu pour éviter les messages qui restent
    if (tr) {
      tr.setAttribute('aria-busy', 'true');
      tr.innerHTML = '<div class="ag-loader">Chargement du transcript…</div>';
    }
    if (sm) {
      sm.setAttribute('aria-busy', 'true');
      hideSummaryLoading({ force: true });
      sm.innerHTML = '<div class="ag-loader">Chargement du compte-rendu…</div>';
    }

    const my = __wdToken;
    __wdTimer = setTimeout(() => {
      if (my !== __wdToken) return;
      const trL = tr?.querySelector('.ag-loader');
      if (tr?.getAttribute('aria-busy') === 'true' && trL) trL.textContent = 'Chargement plus long que prévu…';
      const smL = sm?.querySelector('.ag-loader');
      if (sm?.getAttribute('aria-busy') === 'true' && smL) smL.textContent = 'Chargement plus long que prévu…';
    }, 8000);
  });


  async function loadJob(jobId) {
    // ✅ CORRECTION : Déclarer isSummaryPending au début de la fonction pour qu'elle soit accessible dans le finally
    let isSummaryPending = false;
    const id = String(jobId || '').trim();
    if (!id) return;

    // ⚠️ AMÉLIORATION : Nettoyer immédiatement le timer précédent
    clearTimeout(__wdTimer);
    __wdToken++;

    __lastLoadJobId = id;
    if (editorRoot) {
      editorRoot.dataset.jobId = id;
    }

    if (!SOFT_CANCEL) { try { __activeFetchCtl?.abort?.(); } catch { } }
    __activeFetchCtl = new AbortController();

    // ⚠️ AMÉLIORATION : S'assurer que les éditeurs sont à jour
    editors.transcript = pickTranscriptEl();
    editors.summary = pickSummaryEl();

    if (window.__agiloOrchestrator && !window.__agiloOrchestrator.__editorSubscribed) {
      window.__agiloOrchestrator.subscribe('editor', {
        cancel() {
          try { __activeFetchCtl?.abort?.(); } catch { }
          if (window.AGILO_DEBUG) console.log('[Editor] Cancelled by orchestrator (no DOM reset)');
        }
      });
      window.__agiloOrchestrator.__editorSubscribed = true;
    }

    const seq = computeSeq();
    const showSummaryLoadingScoped = () => showSummaryLoading({ jobId: id, seq });
    const hideSummaryLoadingScoped = (opts = {}) => hideSummaryLoading({ jobId: id, seq, ...opts });

    await waitFrames(1);

    editors.transcript = pickTranscriptEl();
    editors.summary = pickSummaryEl();

    try { clearAll(); } catch { }
    try { window.AgiloConfidence?.resetSessionState?.(); } catch { }

    const auth = await ensureAuth();
    if (isStale(seq)) {
      // ⚠️ AMÉLIORATION : Nettoyer aria-busy même si stale
      clearTimeout(__wdTimer);
      __wdToken++;
      editors.transcript?.removeAttribute('aria-busy');
      editors.summary?.removeAttribute('aria-busy');
      hideSummaryLoadingScoped();
      return;
    }

    if (!auth.username || !auth.token) {
      clearTimeout(__wdTimer);
      __wdToken++;
      try { window.__agiloLoadPendingToken = id; } catch { }

      toast('Authentification manquante');
      editors.transcript?.removeAttribute('aria-busy');
      editors.summary?.removeAttribute('aria-busy');
      hideSummaryLoadingScoped({ force: true });
      return;
    }
    try { window.__agiloLoadPendingToken = ''; } catch { }
    try {
      const settle = (promise) => promise.then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason })
      );
      const transcriptReq = apiGetWithRetry('transcript', id, { ...auth }, 0, __activeFetchCtl.signal);
      const summaryReq = apiGetWithRetry('summary', id, { ...auth }, 0, __activeFetchCtl.signal);

      const tRes = await settle(transcriptReq);
      if (isStale(seq)) {
        // ⚠️ AMÉLIORATION : Nettoyer aria-busy même si stale
        clearTimeout(__wdTimer);
        __wdToken++;
        editors.transcript?.removeAttribute('aria-busy');
        editors.summary?.removeAttribute('aria-busy');
        hideSummaryLoadingScoped();
        return;
      }

      if (tRes.status === 'fulfilled' && tRes.value.ok) {

        const raw = tRes.value.payload || '';
        const json = parseMaybeJson(raw, tRes.value.contentType || '');

        try {
          if (json && Array.isArray(json.segments)) {
            window._segments = mapNicoJsonToSegments(json);
          } else {
            const plain = String(raw || '').replace(/\r\n?/g, '\n').trim();
            window._segments = plain ? [{ id: 's0', start: 0, end: null, speaker: '', text: plain }] : [];
          }
        } catch (e) {
          if (window.AGILO_DEBUG) console.error('[mapJson] crash', e);
          window._segments = []
        }

        _activeSeg = -1;
        __mode = (window._segments.length && window._segments.every(s => Number.isFinite(s.start)))
          ? 'structured'
          : 'plain';

        if (!window._segments.length && editors.transcript) {
          renderSegments([]);
          const box = editors.transcript.querySelector('.ag-plain');
          if (box) box.textContent = (json ? '' : (raw || ''));
        } else {
          renderSegments(window._segments);
          attachAudioSync();
        }

        if (window.AgiloConfidence && __mode === 'structured' && editors.transcript && window._segments?.length) {
          try {
            const mainForConf = {
              segments: window._segments.map((s, i) => ({
                id: String(s.id || `s${i}`),
                text: String(s.text || '')
              }))
            };
            await window.AgiloConfidence.applyAfterTranscriptLoad({
              apiBaseUrl: API_BASE,
              credentials: {
                username: auth.username,
                token: auth.token,
                edition: auth.edition
              },
              jobId: id,
              mainJson: mainForConf,
              transcriptRoot: editors.transcript,
              signal: __activeFetchCtl.signal
            });
          } catch (confErr) {
            if (confErr?.name !== 'AbortError' && window.AGILO_DEBUG) {
              console.warn('[agilo:confidence] apply failed', confErr);
            }
          }
        }

        if (window._segments?.length) {
          const ends = window._segments.filter(s => Number.isFinite(s.end)).map(s => s.end);
          if (ends.length) window.__agiloExpectedDuration = Math.max(...ends);
        }

        if ((toolbar.srch?.value || '').trim()) highlight();
      } else {
        const val = (tRes.status === 'fulfilled' ? tRes.value : null);
        if (val?.code === 'CANCELLED') return;
        const msg = val ? humanizeError({ where: 'transcript', code: val.code, json: val.json, httpStatus: val.httpStatus })
          : "Chargement du transcript annulé (veuillez recharger la page)";
        if (editors.transcript) {
          editors.transcript.innerHTML = '';
          editors.transcript.appendChild(renderAlert(msg, technicalDetailsFromJson(val?.json, val?.raw || '') || ''));
        }
        window._segments = []
      }
      editors.transcript?.removeAttribute('aria-busy');

      const sRes = await settle(summaryReq);
      if (isStale(seq)) {
        // ⚠️ AMÉLIORATION : Nettoyer aria-busy même si stale
        clearTimeout(__wdTimer);
        __wdToken++;
        editors.transcript?.removeAttribute('aria-busy');
        editors.summary?.removeAttribute('aria-busy');
        hideSummaryLoadingScoped();
        return;
      }
      let summaryEmpty = true;

      // ⚠️ NOUVEAU : Vérifier le statut avec getTranscriptStatus pour savoir si le compte-rendu est en cours
      // ⚠️ OPTIMISATION : Ne vérifier que si on n'a pas déjà le compte-rendu
      let transcriptStatus = null;
      // ✅ CORRECTION : isSummaryPending est maintenant déclaré au début de loadJob()

      // Vérifier le statut seulement si nécessaire (pas de compte-rendu reçu ou vide)
      const needsStatusCheck = !(sRes.status === 'fulfilled' && sRes.value.ok && !isBlankHtml(sanitizeHtml(sRes.value.payload || '')));

      if (needsStatusCheck) {
        try {
          transcriptStatus = await getTranscriptStatus(id, auth);
          if (window.AGILO_DEBUG) console.log('[Editor] Statut transcript:', transcriptStatus);
          isSummaryPending = transcriptStatus === 'READY_SUMMARY_PENDING';

          // ⚠️ AMÉLIORATION : Si le statut est READY_SUMMARY_PENDING, afficher le loader Lottie
          // Remplacer le loader simple de beforeload par le loader Lottie
          if (isSummaryPending && editors.summary) {
            // Vérifier si on a encore le loader simple de beforeload
            const simpleLoader = editors.summary.querySelector('.ag-loader');
            if (simpleLoader) {
              // Remplacer par le loader Lottie
              editors.summary.innerHTML = '';
              // Réinitialiser les attributs de lecture seule (pendant le chargement)
              editors.summary.removeAttribute('contenteditable');
              editors.summary.removeAttribute('readonly');
              editors.summary.style.userSelect = '';
              editors.summary.style.cursor = '';
              editors.summary.classList.remove('ag-summary-readonly');
            }
            showSummaryLoadingScoped();
          }
        } catch (e) {
          if (window.AGILO_DEBUG) console.error('[Editor] Erreur getTranscriptStatus:', e);
        }
      }

      if (sRes.status === 'fulfilled' && sRes.value.ok) {
        // ✅ CORRECTION : Garder le HTML brut pour la détection des styles globaux
        let rawHtml = sRes.value.payload || '';
        let cleaned = sanitizeHtml(rawHtml);  // Pour vérifier si vide
        if (isBlankHtml(cleaned)) {
          // Si le statut est PENDING, garder le loader affiché pendant le polling
          if (!isSummaryPending && editors.summary) {
            showSummaryLoadingScoped(); // Afficher le loader si pas déjà affiché
          }

          const polled = await pollSummaryUntilReady(id, { ...auth }, { signal: __activeFetchCtl.signal, seq });
          if (polled.ok) {
            rawHtml = polled.html || '';  // ✅ polled.html est maintenant brut
            cleaned = sanitizeHtml(rawHtml);  // Pour vérifier si vide
            hideSummaryLoadingScoped(); // Cacher le loader une fois le compte-rendu prêt
          } else if (polled.code === 'READY_SUMMARY_PENDING' || isSummaryPending) {
            // Si toujours en cours après polling, garder le loader affiché
            if (editors.summary && !editors.summary.querySelector('.summary-loading-indicator')) {
              showSummaryLoadingScoped();
            }
          } else {
            // ⚠️ AMÉLIORATION : Cacher le loader en cas d'erreur définitive
            hideSummaryLoadingScoped();
          }
        }
        if (!isBlankHtml(cleaned)) {
          if (isStale(seq) || !isSummaryUiContextCurrent({ jobId: id, seq })) return;
          summaryEmpty = false;
          hideSummaryLoadingScoped(); // S'assurer que le loader est caché
          if (editors.summary) {
            // ✅ ISOLATION : Passer le HTML BRUT pour permettre la détection des styles globaux
            injectSummaryContent(rawHtml);

            // ✅ VÉRIFICATION CACHE : Détecter et corriger les problèmes de cache après injection
            if (!checkAndFixCacheIssue(rawHtml)) {
              // Si pas de problème de cache, continuer normalement
            }
          }
        } else if (editors.summary && !isSummaryPending) {
          // Afficher le loader seulement si pas déjà affiché (statut PENDING)
          if (!editors.summary.querySelector('.summary-loading-indicator')) {
            editors.summary.replaceChildren(
              renderAlert("Résumé en préparation…", "Le serveur n'a pas encore publié le HTML du compte-rendu.")
            );
            // Réinitialiser les attributs de lecture seule si pas de contenu
            editors.summary.removeAttribute('contenteditable');
            editors.summary.removeAttribute('readonly');
            editors.summary.style.userSelect = '';
            editors.summary.style.cursor = '';
            editors.summary.classList.remove('ag-summary-readonly');
          }
        }

      } else {
        const val = (sRes.status === 'fulfilled' ? sRes.value : null);
        if (val?.code === 'CANCELLED') return;

        const code = String(val?.code || '');
        const looksPending = /READY_SUMMARY_PENDING|NOT_READY|PENDING|ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS/i.test(code);
        const httpLooksPending = (val?.httpStatus === 404 || val?.httpStatus === 204);

        if (looksPending || httpLooksPending) {
          // Si le statut est PENDING, afficher le loader Lottie
          if (!isSummaryPending && editors.summary) {
            // Vérifier à nouveau le statut si on ne l'a pas déjà fait
            if (!transcriptStatus) {
              try {
                transcriptStatus = await getTranscriptStatus(id, auth);
                isSummaryPending = transcriptStatus === 'READY_SUMMARY_PENDING';
              } catch (e) {
                if (window.AGILO_DEBUG) console.error('[Editor] Erreur getTranscriptStatus (retry):', e);
              }
            }
            if (isSummaryPending || looksPending) {
              showSummaryLoadingScoped();
            }
          } else if (isSummaryPending && editors.summary) {
            showSummaryLoadingScoped(); // S'assurer que le loader est affiché
          }

          const polled = await pollSummaryUntilReady(id, { ...auth }, { signal: __activeFetchCtl.signal, seq });
          if (polled.ok && !isBlankHtml(sanitizeHtml(polled.html || ''))) {
            if (isStale(seq) || !isSummaryUiContextCurrent({ jobId: id, seq })) return;
            summaryEmpty = false;
            hideSummaryLoadingScoped(); // Cacher le loader une fois le compte-rendu prêt
            if (editors.summary) {
              // ✅ ISOLATION : polled.html est maintenant brut (non sanitizé)
              injectSummaryContent(polled.html);

              // ✅ VÉRIFICATION CACHE : Détecter et corriger les problèmes de cache après injection
              if (!checkAndFixCacheIssue(polled.html)) {
                // Si pas de problème de cache, continuer normalement
              }
            }
          } else if (editors.summary) {
            // Si toujours en cours, garder le loader, sinon afficher l'erreur
            if (polled.code === 'READY_SUMMARY_PENDING' || isSummaryPending) {
              if (!editors.summary.querySelector('.summary-loading-indicator')) {
                showSummaryLoadingScoped();
              }
            } else {
              // ⚠️ AMÉLIORATION : Toujours cacher le loader en cas d'erreur définitive
              hideSummaryLoadingScoped();
              const msg = humanizeError({ where: 'summary', code: val?.code, json: val?.json, httpStatus: val?.httpStatus });
              editors.summary.innerHTML = '';
              // Réinitialiser les attributs de lecture seule en cas d'erreur
              editors.summary.removeAttribute('contenteditable');
              editors.summary.removeAttribute('readonly');
              editors.summary.style.userSelect = '';
              editors.summary.style.cursor = '';
              editors.summary.classList.remove('ag-summary-readonly');
              editors.summary.appendChild(renderAlert(msg, technicalDetailsFromJson(val?.json, '') || ''));
            }
          }
        } else if (editors.summary) {
          hideSummaryLoadingScoped(); // Cacher le loader en cas d'erreur
          const msg = humanizeError({ where: 'summary', code: val?.code, json: val?.json, httpStatus: val?.httpStatus });
          editors.summary.innerHTML = '';
          editors.summary.appendChild(renderAlert(msg, technicalDetailsFromJson(val?.json, '') || ''));
        }
      }
      updateDownloadLinks(id, auth, { summaryEmpty });
      if (editorRoot) {
        editorRoot.dataset.jobId = id;
        editorRoot.dataset.summaryEmpty = summaryEmpty ? '1' : '0';
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      hideSummaryLoadingScoped({ force: true }); // S'assurer que le loader est caché en cas d'erreur
      const errBox = renderAlert("Erreur de chargement.", e?.message || '');
      if (editors.transcript) editors.transcript.replaceChildren(errBox.cloneNode(true));
      if (editors.summary) editors.summary.replaceChildren(errBox.cloneNode(true));
      if (window.AGILO_DEBUG) console.error(e);
    } finally {
      // ⚠️ AMÉLIORATION : Toujours nettoyer le timer et les états, même si stale
      clearTimeout(__wdTimer);
      __wdToken++;

      // ⚠️ AMÉLIORATION : Toujours retirer aria-busy, même si stale (évite les états bloqués)
      // Seule exception : si vraiment en cours de chargement d'un autre job
      const currentJobId = String(id || '').trim();
      const editorJobId = editorRoot?.dataset?.jobId || '';

      // Si le jobId correspond toujours, on peut retirer aria-busy
      // Sinon, c'est qu'un autre job est en cours, on laisse le beforeload gérer
      if (!currentJobId || currentJobId === editorJobId || isStale(seq)) {
        editors.transcript?.removeAttribute('aria-busy');
        editors.summary?.removeAttribute('aria-busy');
      }

      // S'assurer que le loader est toujours caché à la fin (sauf si vraiment en cours)
      if (!isSummaryPending) {
        hideSummaryLoadingScoped();
      }
    }
  }

  (function init() {
    setupInsightShortcuts();

    const urlJob = new URLSearchParams(location.search).get('jobId');
    const dataJob = editorRoot?.dataset.jobId || '';
    const seed = (urlJob || dataJob || '').trim();
    if (seed) loadJob(seed);
  })();

  window.addEventListener('agilo:load', (e) => {
    const raw = e?.detail?.jobId ?? e?.detail ?? '';
    const id = String(raw || '').trim();
    if (!id) return;

    // ⚠️ AMÉLIORATION : Nettoyer le timer précédent au cas où
    clearTimeout(__wdTimer);
    __wdToken++;

    const uiReadySameJob =
      id === __lastLoadJobId &&
      editors.transcript?.getAttribute('aria-busy') !== 'true' &&
      editorRoot?.dataset.jobId === id;

    if (uiReadySameJob) {
      // ⚠️ AMÉLIORATION : S'assurer que aria-busy est bien retiré même si on skip
      editors.transcript?.removeAttribute('aria-busy');
      editors.summary?.removeAttribute('aria-busy');
      return;
    }
    loadJob(id);
  });


  window.addEventListener('agilo:token', () => {
    const jid =
      (editorRoot?.dataset.jobId ||
        new URLSearchParams(location.search).get('jobId') ||
        '').trim();
    const pending = String(window.__agiloLoadPendingToken || '').trim();
    const targetJob = pending || jid;
    if (!targetJob) return;

    const auth = readAuthSnapshot();
    const summaryEmpty = editorRoot?.dataset.summaryEmpty === '1';
    updateDownloadLinks(jid || targetJob, auth, { summaryEmpty });

    if (auth.username && auth.token && pending) {
      try { window.__agiloLoadPendingToken = ''; } catch { }
      try {
        loadJob(pending);
      } catch (e) {
        if (window.AGILO_DEBUG) console.warn('[Editor] reload après agilo:token:', e);
      }
    }
  });

  // Ajouter les styles CSS pour le loader Lottie
  (function injectSummaryLoadingStyles() {
    if (document.querySelector('#agilo-summary-loading-styles')) return;

    const style = document.createElement('style');
    style.id = 'agilo-summary-loading-styles';
    style.textContent = `
      /* Conteneur de chargement - utilise vos variables CSS */
      .summary-loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        min-height: 300px;
        background: var(--agilo-surface, var(--color--white, #ffffff));
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
      }
      
      /* Animation Lottie centrée */
      .summary-loading-indicator #loading-summary,
      .summary-loading-indicator #loading-summary-clone {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        display: block;
      }
      
      /* Fallback si Lottie ne charge pas - spinner CSS */
      .summary-loading-indicator .lottie-fallback {
        width: 88px;
        height: 88px;
        margin: 0 auto 24px;
        border: 4px solid var(--agilo-border, rgba(0,0,0,0.12));
        border-top: 4px solid var(--agilo-primary, var(--color--blue, #174a96));
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Texte de chargement */
      .summary-loading-indicator .loading-text {
        font: 500 16px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-text, var(--color--gris_foncé, #020202));
        margin-top: 8px;
        margin-bottom: 4px;
      }
      
      .summary-loading-indicator .loading-subtitle {
        font: 400 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: var(--agilo-dim, var(--color--gris, #525252));
        margin-top: 8px;
      }
      
      /* Animation d'apparition douce */
      .summary-loading-indicator {
        animation: fadeIn 0.3s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Respecte "réduire les animations" */
      @media (prefers-reduced-motion: reduce) {
        .summary-loading-indicator {
          animation: none;
        }
        .summary-loading-indicator .lottie-fallback {
          animation: none;
        }
      }
      
      /* Iframe pour isolation des styles du compte-rendu */
      .ag-summary-iframe {
        width: 100%;
        border: none;
        min-height: max(600px, 100svh);
        background: white;
        display: block;
      }
      
      #summaryEditor.ag-summary-readonly {
        overflow: auto;
      }

      /* =====================================================================
         MENU DE PORTÉE — Renommage locuteur (version FIXED + responsive)
         ===================================================================== */
      .ag-rename-menu{
        position:fixed;
        z-index:99999;
        min-width:240px;
        max-width:min(92vw, 420px);
        max-height:min(320px, 50vh);
        overflow:auto;
        overscroll-behavior:contain;
        background:var(--agilo-surface, var(--color--white, #fff));
        color:var(--agilo-text, var(--color--gris_foncé, #020202));
        border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
        border-radius:var(--agilo-radius, var(--0-5_radius, .5rem));
        box-shadow:var(--agilo-shadow, 0 8px 24px rgba(0,0,0,.14));
      }

      .ag-rename-menu__hd{
        padding:10px 12px;
        font-weight:600;
        border-bottom:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
        background:var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
      }

      .ag-rename-menu__row{
        display:block;
        width:100%;
        text-align:left;
        padding:10px 12px;
        background:transparent;
        border:0;
        cursor:pointer;
        color:inherit;
        font:500 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto;
      }

      .ag-rename-menu__row:hover,
      .ag-rename-menu__row:focus-visible{
        background:var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
        outline:none;
        box-shadow:none;
      }

      .ag-rename-menu__muted{
        color:var(--agilo-dim, var(--color--gris, #525252));
        font-size:12px;
        margin-left:.4rem;
      }

      #pane-transcript .ag-seg__head .speaker{
        cursor:pointer;
      }
      #pane-transcript .ag-seg__head .rename-btn{
        opacity:.55;
      }
      #pane-transcript .ag-seg__head .rename-btn:hover,
      #pane-transcript .ag-seg__head .rename-btn:focus-visible{
        opacity:1;
        box-shadow:0 0 0 2px color-mix(in srgb, var(--agilo-primary, #174a96) 65%, transparent);
      }
      #pane-transcript .ag-seg__head .rename-btn svg{
        width:1em;
        height:1em;
        display:block;
      }

      .ag-speaker-picker{
        position:fixed;
        z-index:99999;
        min-width:260px;
        max-width:min(92vw, 360px);
        max-height:min(520px, 70vh);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        overscroll-behavior:contain;
        background:var(--agilo-surface, var(--color--white, #fff));
        color:var(--agilo-text, var(--color--gris_foncé, #020202));
        border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
        border-radius:var(--agilo-radius, var(--0-5_radius, .5rem));
        box-shadow:var(--agilo-shadow, 0 8px 24px rgba(0,0,0,.14));
        font:500 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto;
      }
      .ag-speaker-picker__spell{
        display:flex;
        flex-direction:column;
        gap:8px;
        padding:10px 10px 8px;
        border-bottom:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
        flex:0 0 auto;
      }
      .ag-speaker-picker__spell-title{
        font-size:13px;
        font-weight:700;
      }
      .ag-speaker-picker__spell-fields{
        display:flex;
        gap:6px;
      }
      .ag-speaker-picker__spell-input{
        flex:1;
        min-width:0;
        padding:6px 8px;
        border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
        border-radius:var(--agilo-radius, var(--0-5_radius, .5rem));
        font:inherit;
        color:inherit;
        background:var(--agilo-surface, var(--color--white, #fff));
      }
      .ag-speaker-picker__spell-all{
        display:flex;
        align-items:center;
        gap:6px;
        font-size:12px;
        font-weight:600;
      }
      .ag-speaker-picker__spell-go{
        align-self:flex-start;
        border:0;
        border-radius:var(--agilo-radius, var(--0-5_radius, .5rem));
        background:#174A96;
        color:#fff;
        font:inherit;
        font-weight:700;
        padding:6px 12px;
        cursor:pointer;
      }
      .ag-speaker-picker__row.is-correct .ag-speaker-picker__name{
        font-weight:700;
      }
      .ag-speaker-picker__search{
        display:flex;
        align-items:center;
        gap:8px;
        margin:8px 10px 0;
        padding:6px 8px;
        border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
        border-radius:var(--agilo-radius, var(--0-5_radius, .5rem));
        background:var(--agilo-surface, var(--color--white, #fff));
        flex:0 0 auto;
      }
      .ag-speaker-picker__search:focus-within{
        border-color:var(--agilo-border, var(--color--noir_25, #343a4040));
        outline:none;
        box-shadow:none;
      }
      .ag-speaker-picker__ico{
        width:18px;
        height:18px;
        flex:0 0 18px;
        color:var(--agilo-dim, var(--color--gris, #525252));
      }
      .ag-speaker-picker__input{
        flex:1;
        min-width:0;
        border:0;
        border-radius:0;
        background:transparent;
        outline:none;
        box-shadow:none;
        -webkit-appearance:none;
        appearance:none;
        font:inherit;
        color:inherit;
      }
      .ag-speaker-picker__input:focus,
      .ag-speaker-picker__input:focus-visible{
        outline:none;
        box-shadow:none;
        -webkit-appearance:none;
        appearance:none;
      }
      .ag-speaker-picker *:focus,
      .ag-speaker-picker *:focus-visible{
        outline:none;
        box-shadow:none;
      }
      .ag-speaker-picker__list{
        overflow:auto;
        flex:1;
        overscroll-behavior:contain;
      }
      .ag-speaker-picker__hd{
        padding:8px 12px 4px;
        font-size:11px;
        font-weight:600;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--agilo-dim, var(--color--gris, #525252));
      }
      .ag-speaker-picker__row{
        display:flex;
        align-items:center;
        gap:8px;
        width:100%;
        text-align:left;
        padding:8px 12px;
        background:transparent;
        border:0;
        cursor:pointer;
        color:inherit;
        font:inherit;
      }
      .ag-speaker-picker__row:hover,
      .ag-speaker-picker__row.is-active,
      .ag-speaker-picker__row:focus-visible{
        background:var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
        outline:none;
        box-shadow:none;
        border-radius:0;
      }
      .ag-speaker-picker__dot{
        width:8px;
        height:8px;
        border-radius:50%;
        flex:0 0 8px;
      }
      .ag-speaker-picker__name{
        flex:1;
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-weight:600;
        color:var(--agilo-text, var(--color--gris_foncé, #020202));
      }
      .ag-speaker-picker__count{
        color:var(--agilo-dim, var(--color--gris, #525252));
        font-size:12px;
      }
      .ag-speaker-picker__check{
        display:inline-flex;
        width:14px;
        height:14px;
        color:var(--agilo-primary, var(--color--blue, #174a96));
      }
      .ag-speaker-picker__check svg{
        width:14px;
        height:14px;
      }
      .ag-speaker-picker__empty{
        padding:16px 12px;
        color:var(--agilo-dim, var(--color--gris, #525252));
        font-size:13px;
      }
    `;
    document.head.appendChild(style);
  })();

  window.addEventListener('online', () => {
    const jid = (editorRoot?.dataset.jobId || new URLSearchParams(location.search).get('jobId') || '').trim();
    if (jid) loadJob(jid);
  });
  function serializeSmart() { return ''; }
  window.AgiloEditors = { ...(window.AgiloEditors || {}), loadJob, serializeSmart, scrollIntoView: agiloScrollIntoView };

  function openChatTab() {
    if (window.AgiloChat?.openConversation) { try { window.AgiloChat.openConversation(); } catch { } }

    const tab = document.querySelector('#tab-chat,[data-tab="chat"][role="tab"],button[aria-controls="pane-chat"]');
    const pane = byId('pane-chat');

    if (tab) {
      tab.removeAttribute('disabled');
      if (tab.getAttribute('aria-selected') !== 'true') {
        tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }
    setTimeout(() => {
      if (pane && (pane.hasAttribute('hidden') || !pane.classList.contains('is-active'))) {
        document.querySelectorAll('[role="tab"]').forEach(t => {
          const isChat = t === tab || t.getAttribute('aria-controls') === 'pane-chat' || t.dataset.tab === 'chat';
          t.setAttribute('aria-selected', isChat ? 'true' : 'false');
          t.tabIndex = isChat ? 0 : -1;
        });
        document.querySelectorAll('.edtr-pane, .ag-panel').forEach(p => {
          if (p.id === 'pane-chat') { p.classList.add('is-active'); p.removeAttribute('hidden'); }
          else { p.classList.remove('is-active'); p.setAttribute('hidden', ''); }
        });
      }
      const view = byId('chatView'); if (view) view.scrollTop = view.scrollHeight;
    }, 20);
  }
  function setupInsightShortcuts() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a');
      if (!btn) return;
      const label = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      const wantsChat =
        btn.dataset.open === 'conversation'
        || btn.dataset.action === 'open-conversation'
        || btn.dataset.action === 'open-chat'
        || /analyse[\s-]*émotionnelle|analyse[\s-]*emotion|émotion|emotion|question\s*ia/i.test(label)
        || /insight|emotion/i.test(btn.dataset.insight || '');

      if (wantsChat) openChatTab();
    }, { passive: true });
  }

  window.__agiloEditorConfidenceVersion = '1.09.13-plus-picker';
});
