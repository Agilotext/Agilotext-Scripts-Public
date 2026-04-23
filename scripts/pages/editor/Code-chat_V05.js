// Agilotext - Chat IA (V06)
// V06: scroll bulles user/assistant, postProcessEmail markdown, file d'attente messages, édition bulle user,
//      PJ phase 1 (stub noms) + phase 2 (upload optionnel), dictée Web Speech API.
// V05: message LinkedIn, email block, contexte Memberstack, etc.
// ⚠️ Ce fichier est chargé depuis GitHub — Correspond à: code-chat dans Webflow
window.__agiloChatVersion = 'V06-queue-pj-dictation';

document.addEventListener('DOMContentLoaded', () => {
  /* ================== DEBUG ================== */
  const FORCE_DEBUG = false; // ← laisse à false en prod
  const DEBUG = FORCE_DEBUG || new URLSearchParams(location.search).get('debugChat') === '1';
  const log = (...a) => DEBUG && console.log('[agilo-chat]', ...a);
  const warn = (...a) => DEBUG && console.warn('[agilo-chat]', ...a);
  const err = (...a) => console.error('[agilo-chat]', ...a);

  /* ================== CONFIG ================== */
  const API_BASE =
    document.querySelector('#pane-chat')?.dataset.apiBase
    || 'https://api.agilotext.com/api/v1';

  const MAX_HISTORY_TURNS = 8;
  const POLL_INTERVAL_MS = 1100;
  const POLL_TIMEOUT_MS = 240000;
  const RECEIVE_RETRIES = 5;
  const RECEIVE_RETRY_DELAY = 900;
  const AGILO_EMAIL_COMMENT_SPLIT = /\n\s*---\s*\n|\n+\s*Commentaire interne\s*(?:\(non envoyé\))?\s*:/i;
  const LINKEDIN_THINKING_MSG = 'Je travaille sur la rédaction du post LinkedIn. Je vous le dépose dans un instant dans l\'onglet Conversation.';
  const ATTACHMENTS_ENABLED = window.__agiloAttachmentsEnabled === true;
  const MAX_ATTACH_FILES = 3;
  const MAX_ATTACH_MB = 10;
  const CHAT_MAX_CHARS = Number(
    document.getElementById('pane-chat')?.dataset.chatMaxChars
    || document.getElementById('pane-chat')?.dataset.maxChars
    || document.getElementById('agilo-chat-submission')?.dataset.chatMaxChars
    || 0
  ) || 0;
  const EMPTY_STATE_PROMPTS = [
    'Résumer les points clés du transcript',
    'Proposer un plan de compte-rendu structuré',
    'Extraire les décisions et actions'
  ];
  const EMPTY_STATE_WELCOME = 'Comment puis-je vous aider avec ce transcript ?';
  const PENDING_FILES = [];
  const MSG_QUEUE = new Map();
  let __dictationActive = false;
  let __speechRecognition = null;
  let chatSendBtn = null; // bouton d'envoi créé par ensureChatChrome (remplace div#btnAsk Webflow)

  /* ================== DOM ================== */
  const $ = (s, r = document) => r.querySelector(s);
  const byId = (id) => document.getElementById(id);
  /** #chatPrompt du conteneur embed (évite un doublon d'id Webflow ailleurs sur la page) */
  function activeChatPrompt() {
    return byId('agilo-chat-submission')?.querySelector('#chatPrompt') || byId('chatPrompt');
  }
  const chatView = byId('chatView');
  const form = byId('wf-form-chat');
  const btnAsk = byId('btnAsk');
  chatView?.setAttribute('contenteditable', 'false');

  /* ================== LANG Fallback ================== */
  const detectLang = window.detectLang || function (s = '') {
    // heuristique simple + <html lang=…>
    const hint = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2).toLowerCase();
    const text = String(s || '');
    const isEN = /(?:\bthe\b|\band\b|\bfor\b|\bto\b|\bwith\b)/i.test(text);
    const isFR = /(?:\ble\b|\bet\b|\bpour\b|\bau\b|\bavec\b)/i.test(text);
    if (isEN && !isFR) return 'en';
    if (isFR && !isEN) return 'fr';
    return hint === 'en' ? 'en' : 'fr';
  };

  /* ================== MARKDOWN → HTML (robuste) ================== */
  function mdToHtml(md) {
    // Normalisation
    md = String(md || '').replace(/\r\n/g, '\n').trim();

    // Si tout le contenu est dans un fence "texte" → on unwrap
    {
      const m = md.match(/^```(?:\s*(\w+))?\s*\n([\s\S]*?)\n```$/i);
      const lang = (m?.[1] || '').toLowerCase();
      if (m && (!lang || /^(md|markdown|txt|text)$/.test(lang))) md = m[2];
    }

    // Utils
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Protéger les blocs de code (```lang …``` ou ~~~lang …~~~)
    const CODE = [];
    md = md.replace(/(```|~~~)\s*([\w+-]*)\s*\n([\s\S]*?)\n\1/g, (_, fence, lang = '', code = '') => {
      const L = String(lang).toLowerCase();
      if (!L || /^(md|markdown|txt|text)$/.test(L)) return code; // unwrap si "texte"
      const i = CODE.push(`<pre><code class="${esc(L)}">${esc(code)}</code></pre>`) - 1;
      return `\uE000CODE${i}\uE001`;
    });

    // Échapper le HTML brut (hors inline code) pour éviter l'injection
    md = md
      .split(/(`[^`]*`)/g)
      .map((seg, i) => (i % 2 ? seg : seg.replace(/</g, '&lt;').replace(/>/g, '&gt;')))
      .join('');

    // Inlines
    const inline = s => String(s)
      .replace(/\*\*\*([^\*]+?)\*\*\*/g, '<strong><em>$1</em></strong>')  // ***bold+ital***
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')                 // **bold**
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')                             // *ital*
      .replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`)           // `code`
      .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>') // [txt](url)
      .replace(/(^|[\s(])((https?:\/\/|www\.)[^\s<)]+)(?=$|[\s).,;:!?])/gi, (_, p, url) => {                    // autolink
        const href = url.startsWith('http') ? url : 'https://' + url;
        return `${p}<a href="${href}" target="_blank" rel="noopener">${url}</a>`;
      });

    // Titres ATX (# …)
    let html = md
      .replace(/^######\s+(.+)$/gm, (_, t) => `<h6>${inline(t)}</h6>\n\n`)
      .replace(/^#####\s+(.+)$/gm, (_, t) => `<h5>${inline(t)}</h5>\n\n`)
      .replace(/^####\s+(.+)$/gm, (_, t) => `<h4>${inline(t)}</h4>\n\n`)
      .replace(/^###\s+(.+)$/gm, (_, t) => `<h3>${inline(t)}</h3>\n\n`)
      .replace(/^##\s+(.+)$/gm, (_, t) => `<h2>${inline(t)}</h2>\n\n`)
      .replace(/^#\s+(.+)$/gm, (_, t) => `<h1>${inline(t)}</h1>\n\n`);

    // Règles horizontales
    html = html.replace(/(^|\n)\s*(?:-{3,}|\*{3,}|_{3,})\s*(?=\n|$)/g, '$1<hr>\n\n');

    // Titres setext
    html = html
      .replace(/^([^\n]*\S[^\n]*)\n=+\s*$/gm, (_, t) => `<h1>${inline(t.trim())}</h1>\n\n`)
      .replace(/^([^\n]*\S[^\n]*)\n-+\s*$/gm, (_, t) => `<h2>${inline(t.trim())}</h2>\n\n`);

    // Normaliser `&gt;` copiés depuis HTML
    html = html.replace(/(^|\n)\s*&gt;\s/g, '$1> ');

    // ===== Tableaux (GFM) =====
    const isSep = line => {
      const t = line.trim();
      if (!/\|/.test(t)) return false;
      const core = t.replace(/^\||\|$/g, '');
      return core.split('|').every(c => /^\s*:?-{3,}:?\s*$/.test(c));
    };
    const splitRow = line => line
      .trim().replace(/^\||\|$/g, '')
      .split('|').map(c => c.trim());

    (function parseTables() {
      const lines = html.split('\n');
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const head = lines[i];
        const sep = lines[i + 1];
        if (/\|/.test(head || '') && isSep(sep || '')) {
          const headers = splitRow(head);
          const aligns = splitRow(sep).map(c =>
            /^\s*:-{3,}:\s*$/.test(c) ? 'center' :
              /^\s*-{3,}:\s*$/.test(c) ? 'right' : 'left'
          );
          const rows = [];
          let j = i + 2;
          while (j < lines.length && /\|/.test(lines[j]) && !/^</.test(lines[j].trim())) {
            rows.push(splitRow(lines[j])); j++;
          }
          const ths = headers.map((h, k) => `<th style="text-align:${aligns[k] || 'left'}">${inline(h)}</th>`).join('');
          const trs = rows.map(r => '<tr>' + r.map((c, k) => `<td style="text-align:${aligns[k] || 'left'}">${inline(c)}</td>`).join('') + '</tr>').join('');
          out.push(`<table class="md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
          i = j - 1;
        } else {
          out.push(head);
        }
      }
      html = out.join('\n');
    })();

    // ===== Listes imbriquées + citations dans items =====
    function parseLists(text) {
      const lines = text.split('\n');
      const BUL = /^(\s*)([-*+•])\s+(?:\[( |x|X)\]\s+)?(.*)$/;
      const ORD = /^(\s*)(\d+)\.\s+(.*)$/;
      const toSpaces = s => s.replace(/\t/g, '  ');
      const getDepth = s => Math.floor(toSpaces(s).length / 2); // 2 espaces => 1 niveau

      function renderContinuation(contLines) {
        if (!contLines.length) return '';
        const raw = contLines.map(l => l.replace(/^\s+/, ''));
        const parts = [];
        let q = [];
        const flushQ = () => { if (q.length) { parts.push('<blockquote>' + q.map(t => `<p>${inline(t)}</p>`).join('') + '</blockquote>'); q = []; } };
        for (const ln of raw) {
          if (/^>\s?/.test(ln)) q.push(ln.replace(/^>\s?/, ''));
          else { flushQ(); parts.push(`<p>${inline(ln)}</p>`); }
        }
        flushQ();
        return parts.join('');
      }

      function parseListAt(i, baseDepth, expectedType) {
        const items = [];
        let listType = expectedType; // 'ul' | 'ol'
        while (i < lines.length) {
          const line = lines[i];
          const mBul = line.match(BUL);
          const mOrd = line.match(ORD);
          if (!mBul && !mOrd) break;

          const indent = getDepth((mBul ? mBul[1] : mOrd[1]) || '');
          if (indent < baseDepth) break;
          if (indent > baseDepth) {
            const sub = parseListAt(i, indent, null);
            if (items.length) items[items.length - 1].children += sub.html;
            i = sub.i;
            continue;
          }

          const type = mBul ? 'ul' : 'ol';
          if (!listType) listType = type;
          if (listType !== type) break;

          let textLine = mBul ? (mBul[4] || '') : (mOrd[3] || '');
          const chk = mBul && mBul[3] != null ? String(mBul[3]).trim().toLowerCase() === 'x' : false;

          // Lignes de continuation (indent ≥ baseDepth+1)
          let k = i + 1;
          const cont = [];
          while (k < lines.length && !BUL.test(lines[k]) && !ORD.test(lines[k])) {
            if (lines[k].trim() === '') { cont.push(''); k++; continue; }
            const d = getDepth(lines[k].match(/^(\s*)/)[1]);
            if (d < baseDepth + 1) break;
            cont.push(lines[k]);
            k++;
          }

          items.push({
            html: (chk ? `<input type="checkbox" disabled ${chk ? 'checked' : ''}> ` : '') + inline(textLine.trim()),
            contHtml: renderContinuation(cont),
            children: ''
          });

          i = k;
        }

        if (!items.length) return { html: '', i };

        const open = `<${listType}>`, close = `</${listType}>`;
        const inner = items.map(it => `<li>${it.html}${it.contHtml}${it.children}</li>`).join('');
        return { html: open + inner + close, i };
      }

      const out = [];
      for (let i = 0; i < lines.length;) {
        if (BUL.test(lines[i]) || ORD.test(lines[i])) {
          const { html: listHtml, i: next } = parseListAt(i, Math.floor(lines[i].match(/^(\s*)/)[1].length / 2), null);
          out.push(listHtml);
          i = next;
        } else {
          out.push(lines[i]);
          i++;
        }
      }
      return out.join('\n');
    }
    html = parseLists(html);

    // ===== Blockquotes racine =====
    (function parseBlockquotes() {
      const lines = html.split('\n');
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*>\s?/.test(lines[i])) {
          const block = [];
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
            block.push(lines[i].replace(/^\s*>\s?/, ''));
            i++;
          }
          i--;
          const inner = block.join('\n').split(/\n{2,}/).map(b => {
            const t = b.trim();
            return t ? `<p>${inline(t)}</p>` : '';
          }).join('');
          out.push(`<blockquote>${inner}</blockquote>`);
        } else {
          out.push(lines[i]);
        }
      }
      html = out.join('\n');
    })();

    // ===== Paragraphes =====
    html = html
      .split(/\n{2,}/)
      .map(block => {
        const t = block.trim();
        if (!t) return '';
        if (/^<(h[1-6]|ul|ol|li|hr|pre|blockquote|table|thead|tbody|tr|th|td)/i.test(t)) return t;
        if (/^<\/(ul|ol|table|blockquote)>/i.test(t)) return t;
        return `<p>${inline(t)}</p>`;
      })
      .join('\n');

    // Restaurer les blocs de code
    html = html.replace(/\uE000CODE(\d+)\uE001/g, (_, i) => CODE[Number(i)] || '');

    return html;
  }

  /* ================== EXPORT LOCAL PDF (beau rendu) ================== */
  function buildPrintHtml(md, title = 'Export') {
    const html = mdToHtml(md || '');
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${String(title).replace(/</g, '&lt;')}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { size: A4; margin: 16mm; }
    html,body { background:#fff; }
    body{ font: 14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#111; }
    .container{ max-width: 760px; margin:0 auto; }
    h1,h2,h3{ font-weight:700; line-height:1.25; margin:1.1em 0 .5em; }
    h1{ font-size:1.55rem; } h2{ font-size:1.25rem; } h3{ font-size:1.05rem; }
    p{ margin:.5em 0; }
    ul,ol{ margin:.4em 0 .9em 1.3em; padding:0; }
    li{ margin:.2em 0; }
    hr{ border:0; border-top:1px solid #e6e6e6; margin:1em 0; }
    a{ color:#174a96; text-decoration: underline; }
    blockquote{ margin:.9em 0; padding:.6em .8em; border-left:3px solid #174a96; background:#f3f6fb; border-radius:.25rem; }
    code{ font-family: ui-monospace,Menlo,Consolas,monospace; font-size:.95em; }
    pre{ background:#0b1222; color:#fff; padding:.8em 1em; border-radius:.5rem; overflow:auto; box-shadow:0 1px 2px rgba(0,0,0,.08), 0 4px 10px rgba(0,0,0,.06); }
    .doc-header{ margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #e6e6e6; }
    .doc-meta{ font:600 12px/1.2 system-ui; color:#6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="doc-header"><div class="doc-meta">${new Date().toLocaleString('fr-FR')}</div></div>
    ${html}
  </div>
  <script>window.print(); setTimeout(()=>window.close(), 300);<\/script>
</body>
</html>`;
  }
  function exportLocalPDF(md, filename = 'export.pdf', title = 'Export') {
    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up bloquée : autorise l\'ouverture pour exporter en PDF.');
    w.document.open(); w.document.write(buildPrintHtml(md, title)); w.document.close();
  }

  /* ================== COPY ================== */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-999999px';
        document.body.appendChild(ta); ta.focus(); ta.select();
        try { document.execCommand('copy'); ta.remove(); return true; }
        catch (e) { ta.remove(); throw e; }
      }
    } catch (e) { err('Copy failed:', e); return false; }
  }

  /* ================== UI helpers ================== */
  const nowHHMM = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const mask = t => !t ? '' : String(t).slice(0, 6) + '…' + String(t).slice(-4);

  function toast(msg, type = 'info') {
    let root = byId('toaster');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toaster';
      root.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
      document.body.appendChild(root);
    }
    const d = document.createElement('div');
    d.textContent = msg;
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#174a96';
    d.style.cssText = `background:${bgColor};color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font:600 13px/1.3 system-ui;pointer-events:auto;transform:translateX(400px);transition:transform .3s cubic-bezier(0.34, 1.56, 0.64, 1)`;
    root.appendChild(d);
    setTimeout(() => d.style.transform = 'translateX(0)', 10);
    setTimeout(() => { d.style.transform = 'translateX(400px)'; setTimeout(() => d.remove(), 300); }, 2500);
  }

  /* ================== CONTEXTE / AUTH (aligné <head>) ================== */
  function normalizeEdition(v) {
    v = String(v || '').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }
  function tokenKey(email, edition) {
    return `agilo:token:${normalizeEdition(edition)}:${String(email || '').toLowerCase()}`;
  }
  function getEdition() {
    return normalizeEdition(
      localStorage.getItem('agilo:edition')
      || $('#pane-chat')?.dataset.edition
      || byId('editorRoot')?.dataset?.edition
      || byId('agilo-audio-wrap')?.dataset?.edition
      || new URLSearchParams(location.search).get('edition')
      || 'ent'
    );
  }
  /** Aligné sur pickJobId() des autres scripts éditeur — évite le toast "Job ID manquant"
   *  quand le DOM se construit après le chargement du script. */
  function getJobId() {
    const sp = new URLSearchParams(location.search);
    const rail = document.querySelector('.rail-item.is-active');
    return String(
      sp.get('jobId')
        || $('#pane-chat')?.dataset?.jobId
        || $('#pane-chat')?.dataset?.jobid
        || byId('editorRoot')?.dataset?.jobId
        || byId('editorRoot')?.dataset?.jobid
        || byId('agilo-audio-wrap')?.dataset?.jobId
        || byId('agilo-audio-wrap')?.dataset?.jobid
        || rail?.dataset?.jobId
        || rail?.dataset?.jobid
        || (typeof window.__agiloOrchestrator !== 'undefined' && window.__agiloOrchestrator?.currentJobId)
        || (() => { try { return localStorage.getItem('currentJobId') || ''; } catch { return ''; } })()
        || $('[name="jobId"]')?.value
        || ''
    ).trim();
  }

  /** Rafraîchit ACTIVE_JOB depuis le DOM — à appeler juste avant d'utiliser le jobId. */
  function refreshActiveJobId() {
    const id = getJobId();
    if (id) ACTIVE_JOB = id;
    return id || ACTIVE_JOB || '';
  }
  async function ensureEmail() {
    const attrVal = document.querySelector('[name="memberEmail"]')?.getAttribute('value') || '';
    const txtVal = document.querySelector('[data-ms-member="email"]')?.textContent || '';
    const now = (byId('memberEmail')?.value || attrVal || txtVal || window.memberEmail || '').trim();
    if (now) return now;
    if (window.$memberstackDom?.getMember) {
      try { const r = await window.$memberstackDom.getMember(); return (r?.data?.email || '').trim(); } catch { }
    }
    return '';
  }
  function waitForTokenEvent({ email, edition, timeoutMs = 8000 }) {
    return new Promise(resolve => {
      const t0 = performance.now();
      let done = false;
      const finish = (x) => { if (!done) { done = true; resolve(x || ''); } };
      const onEvt = (e) => {
        const d = e?.detail || {};
        const ok =
          d?.token &&
          (!email || String(d.email || '').toLowerCase() === String(email).toLowerCase()) &&
          (!edition || normalizeEdition(d.edition) === normalizeEdition(edition));
        if (ok) { window.removeEventListener('agilo:token', onEvt); finish(d.token); }
      };
      window.addEventListener('agilo:token', onEvt, { passive: true });
      (function loop() {
        if (done) return;
        const snapTok = window.globalToken || '';
        if (snapTok) { window.removeEventListener('agilo:token', onEvt); return finish(snapTok); }
        if (performance.now() - t0 > timeoutMs) { window.removeEventListener('agilo:token', onEvt); return finish(''); }
        requestAnimationFrame(loop);
      })();
    });
  }
  async function ensureToken(username, edition = getEdition()) {
    if (!username) return '';
    // 1) cache local (email+edition)
    const cached = localStorage.getItem(tokenKey(username, edition));
    if (cached) { window.globalToken = cached; return cached; }

    // 2) suggérer un fetch au script <head> + attendre un éventuel event
    if (typeof window.getToken === 'function') {
      try { window.getToken(username, edition); } catch { }
    }
    const fromEvt = await waitForTokenEvent({ email: username, edition, timeoutMs: 1500 });
    if (fromEvt) {
      try { localStorage.setItem(tokenKey(username, edition), fromEvt); } catch { }
      window.globalToken = fromEvt;
      return fromEvt;
    }

    // 3) fallback API direct
    try {
      const r = await fetch(`${API_BASE}/getToken?username=${encodeURIComponent(username)}&edition=${encodeURIComponent(edition)}`, { cache: 'no-store', credentials: 'omit' });
      const raw = await r.text(); let j = null; try { j = JSON.parse(raw); } catch { }
      const tok = j?.token || (raw.trim().split('.').length === 3 ? raw.trim() : '');
      if (tok) {
        try {
          localStorage.setItem(tokenKey(username, edition), tok);
          localStorage.setItem('agilo:edition', normalizeEdition(edition));
        } catch { }
        window.globalToken = tok;
        return tok;
      }
    } catch { }
    return '';
  }
  async function resolveAuth() {
    const edition = getEdition();
    let username = $('#pane-chat')?.dataset.username
      || byId('editorRoot')?.dataset?.username
      || byId('memberEmail')?.value
      || document.querySelector('[name="memberEmail"]')?.value
      || localStorage.getItem('agilo:username')
      || window.memberEmail
      || '';
    if (!username) username = await ensureEmail();
    username = (username || '').trim();

    let token = $('#pane-chat')?.dataset.token
      || byId('editorRoot')?.dataset?.token
      || localStorage.getItem(tokenKey(username, edition))
      || window.globalToken
      || '';
    if (!token && username) token = await ensureToken(username, edition);

    if (username) { try { localStorage.setItem('agilo:username', username); } catch { } }
    if (edition) { try { localStorage.setItem('agilo:edition', normalizeEdition(edition)); } catch { } }

    const creds = { username, token: (token || '').trim(), edition: normalizeEdition(edition) };
    log('creds=', { ...creds, token: mask(creds.token) });
    return creds;
  }

  /* ================== STATE ================== */
  let ACTIVE_JOB = getJobId();
  const LSKEY = () => `agilo:chat:${ACTIVE_JOB || 'nojob'}`;
  let MESSAGES = [];
  let ACTIVE_USER_EDIT_IDX = -1;
  const WELCOME_MESSAGE = 'Bienvenue dans l\'assistant IA. Posez vos questions sur le transcript.';

  function isLegacyWelcomeMessage(msg) {
    if (!msg || msg.role !== 'system') return false;
    return String(msg.text || '').trim() === WELCOME_MESSAGE;
  }
  function shouldRenderEmptyState(msgs) {
    if (!Array.isArray(msgs) || msgs.length === 0) return true;
    return msgs.every(isLegacyWelcomeMessage);
  }

  function dayKey(isoOrDate) {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function formatDateSeparatorLabel(isoOrDate) {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const today = dayKey(now);
    const target = dayKey(d);
    if (target === today) return 'Aujourd\'hui';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (target === dayKey(yesterday)) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function autosizeChatPrompt(inputEl) {
    const ta = inputEl || activeChatPrompt();
    if (!ta) return;
    ta.style.height = 'auto';
    const h = Math.min(ta.scrollHeight || 0, 180);
    ta.style.height = `${Math.max(h, 36)}px`;
    ta.style.overflowY = (ta.scrollHeight > 180) ? 'auto' : 'hidden';
  }

  function updatePromptCounter(inputEl) {
    const ta = inputEl || activeChatPrompt();
    const counter = byId('chat-char-counter');
    if (!counter || !ta) return;
    if (!CHAT_MAX_CHARS || CHAT_MAX_CHARS <= 0) {
      counter.hidden = true;
      return;
    }
    const len = (ta.value || '').length;
    counter.hidden = false;
    counter.textContent = `${len}/${CHAT_MAX_CHARS}`;
    counter.classList.toggle('is-near-limit', len >= Math.floor(CHAT_MAX_CHARS * 0.9));
  }

  function refreshSendReadyState() {
    const { prompt, bar } = getChatFormScope();
    const hasText = !!String(prompt?.value || '').trim();
    bar?.classList.toggle('is-ready-to-send', hasText);
    chatSendBtn?.classList.toggle('is-ready-to-send', hasText);
  }

  function setPromptText(text, focus = true) {
    const cp = activeChatPrompt();
    if (!cp) return;
    const next = String(text || '');
    cp.value = (CHAT_MAX_CHARS > 0) ? next.slice(0, CHAT_MAX_CHARS) : next;
    if (focus) {
      try { cp.focus({ preventScroll: true }); } catch { }
      try { cp.setSelectionRange(cp.value.length, cp.value.length); } catch { }
    }
    autosizeChatPrompt(cp);
    updatePromptCounter(cp);
    refreshSendReadyState();
  }

  function buildDateSeparatorNode(label) {
    const wrap = document.createElement('div');
    wrap.className = 'msg-date-sep';
    const pill = document.createElement('span');
    pill.className = 'msg-date-sep-label';
    pill.textContent = label;
    wrap.appendChild(pill);
    return wrap;
  }

  function buildEmptyStateNode() {
    const box = document.createElement('div');
    box.className = 'msg-empty-state';
    const title = document.createElement('p');
    title.className = 'msg-empty-title';
    title.textContent = EMPTY_STATE_WELCOME;
    box.appendChild(title);

    const promptList = document.createElement('div');
    promptList.className = 'msg-empty-prompts';
    EMPTY_STATE_PROMPTS.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'msg-empty-prompt';
      btn.textContent = p;
      btn.addEventListener('click', () => setPromptText(p, true));
      promptList.appendChild(btn);
    });
    box.appendChild(promptList);
    return box;
  }

  function ensurePromptAccessibilityHint(barEl, promptEl) {
    if (!barEl || !promptEl) return;
    let hint = barEl.parentElement?.querySelector('#chat-compose-hint') || byId('chat-compose-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'chat-compose-hint';
      hint.className = 'chat-compose-hint';
      barEl.insertAdjacentElement('afterend', hint);
    }
    let text = hint.querySelector('.chat-compose-hint-text');
    if (!text) {
      text = document.createElement('span');
      text.className = 'chat-compose-hint-text';
      hint.appendChild(text);
    }
    text.textContent = 'Entrée pour envoyer, Maj+Entrée pour nouvelle ligne';
    let counter = hint.querySelector('#chat-char-counter');
    if (!counter) {
      counter = document.createElement('span');
      counter.id = 'chat-char-counter';
      counter.className = 'chat-char-counter';
      hint.appendChild(counter);
    }
    if (CHAT_MAX_CHARS <= 0) counter.hidden = true;
    promptEl.setAttribute('aria-describedby', 'chat-compose-hint');
  }

  function bindPromptUiEvents() {
    const { prompt, bar } = getChatFormScope();
    if (!prompt) return;
    ensurePromptAccessibilityHint(bar, prompt);
    if (prompt.dataset.agiloPromptBound === '1') {
      autosizeChatPrompt(prompt);
      updatePromptCounter(prompt);
      refreshSendReadyState();
      return;
    }
    prompt.dataset.agiloPromptBound = '1';
    prompt.addEventListener('input', () => {
      if (CHAT_MAX_CHARS > 0 && prompt.value.length > CHAT_MAX_CHARS) {
        prompt.value = prompt.value.slice(0, CHAT_MAX_CHARS);
      }
      autosizeChatPrompt(prompt);
      updatePromptCounter(prompt);
      refreshSendReadyState();
    });
    prompt.addEventListener('focus', refreshSendReadyState);
    prompt.addEventListener('blur', refreshSendReadyState);
    autosizeChatPrompt(prompt);
    updatePromptCounter(prompt);
    refreshSendReadyState();
  }

  function loadHistory() {
    try { MESSAGES = JSON.parse(localStorage.getItem(LSKEY()) || '[]') || []; } catch { MESSAGES = []; }
    if (shouldRenderEmptyState(MESSAGES)) MESSAGES = [];
  }
  function saveHistory() { try { localStorage.setItem(LSKEY(), JSON.stringify(MESSAGES)); } catch { } }

  const isNearBottom = (el, threshold = 80) => {
    if (!el) return true;
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < threshold;
  };
  const lastAssistantIndexOf = (msgs) => {
    for (let i = (msgs?.length || 0) - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'assistant') return i;
    }
    return -1;
  };

  function buildAssistantActionsNode(idx, lastAssistantIndex, copyText) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-actions';
    actionsDiv.style.cssText = 'display:flex;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.08);flex-wrap:wrap';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn msg-action-copy';
    copyBtn.setAttribute('title', 'Copier');
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0"><path fill="none" d="M0 0h24v24H0z"/><path d="M18,2H9C7.9,2,7,2.9,7,4v12c0,1.1,0.9,2,2,2h9c1.1,0,2-0.9,2-2V4C20,2.9,19.1,2,18,2z M18,16H9V4h9V16z M3,15v-2h2v2H3z M3,9.5h2v2H3V9.5z M10,20h2v2h-2V20z M3,18.5v-2h2v2H3z M5,22c-1.1,0-2-0.9-2-2h2V22z M8.5,22h-2v-2h2V22z M13.5,22L13.5,22l0-2h2v0C15.5,21.1,14.6,22,13.5,22z M5,6L5,6l0,2H3v0C3,6.9,3.9,6,5,6z"/></svg> Copier';
    const copyBtnDefaultHtml = copyBtn.innerHTML;
    const copyBtnCheckedHtml = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0"><path fill="none" d="M0 0h24v24H0z"/><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copié';
    copyBtn.onclick = async () => {
      const success = await copyToClipboard(copyText);
      if (success) {
        copyBtn.classList.add('msg-action-copy-copied');
        copyBtn.innerHTML = copyBtnCheckedHtml;
        setTimeout(() => {
          copyBtn.classList.remove('msg-action-copy-copied');
          copyBtn.innerHTML = copyBtnDefaultHtml;
        }, 2000);
        toast('Copié dans le presse-papier', 'success');
      } else {
        toast('Échec de la copie', 'error');
      }
    };
    actionsDiv.appendChild(copyBtn);

    const allowExport = idx === lastAssistantIndex;
    if (allowExport) {
      const sep = document.createElement('div');
      sep.style.cssText = 'width:1px;background:rgba(0,0,0,0.1);margin:0 2px';
      actionsDiv.appendChild(sep);

      ['txt', 'docx', 'pdf', 'rtf'].forEach(fmt => {
        const btn = document.createElement('button');
        btn.textContent = fmt.toUpperCase();
        btn.className = 'msg-action-btn';
        btn.onclick = async () => {
          const originalText = btn.textContent;
          btn.disabled = true; btn.textContent = '...'; btn.style.opacity = '0.5';
          try { await exportMessage(idx, fmt); toast(`Téléchargé en ${fmt.toUpperCase()}`, 'success'); }
          catch (e) { toast(`Échec export ${fmt}`, 'error'); err('export failed', e); }
          finally { btn.disabled = false; btn.textContent = originalText; btn.style.opacity = '1'; }
        };
        actionsDiv.appendChild(btn);
      });
    }
    return actionsDiv;
  }

  function buildMessageNode(m, idx, lastAssistantIndex) {
    const msgDiv = document.createElement('div');
    msgDiv.className = m.role === 'user' ? 'msg msg--user' : (m.role === 'assistant' ? 'msg msg--ai' : 'msg msg--sys');
    msgDiv.lang = 'fr';
    if (m.id) msgDiv.dataset.msgId = m.id;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'msg-meta';
    const roleName = m.role === 'user' ? 'Vous' : (m.role === 'assistant' ? 'Assistant' : 'Info');
    metaDiv.textContent = `${roleName} • ${nowHHMM()}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'msg-bubble';

    if (m.role === 'assistant') {
      const isThinking = m.text.includes('thinking-indicator') || m.text.includes('Assistant réfléchit');
      const raw = String(m.text || '').replace(/\uFEFF/g, '').replace(/\r\n/g, '\n').trim();
      /* Détection e-mail élargie :
         1. "Objet :" ou "Sujet :" dans les 3000 premiers caractères (au lieu de 600)
         2. Ou context d'intent e-mail établi dans la session (relances "modifie", "plus court", etc.)
         3. Ou "Commentaire interne" sans "Objet" (blocs partiels de suivi) */
      const rawStripped = raw.replace(/\*\*/g, '').replace(/^#{1,6}\s+/gm, '');
      const head3k = rawStripped.slice(0, 3000);
      const hasObjet = /\b(?:Objet|Sujet)\s*:\s*\S/i.test(head3k);
      const hasCommentaire = /Commentaire interne\s*(?:\(non envoyé\))?\s*:/i.test(raw);
      const hasGreeting = /(^|\n)\s*(bonjour|bonsoir|hello|hi)\b/i.test(rawStripped);
      const hasSignature = /(^|\n)\s*(cordialement|bien\s+à\s+vous|sinc[eè]res?\s+salutations|best\s+regards)\b/i.test(rawStripped);
      const emailByIntent = (m.render === 'plain') || (getLastIntent() === 'email' && !isThinking);
      const looksLikeEmail = hasObjet || (hasCommentaire && (hasObjet || emailByIntent)) || (emailByIntent && (hasGreeting || hasSignature));
      const displayText = looksLikeEmail ? postProcessEmail(m.text) : m.text;
      const renderMode = m.render || (isThinking ? 'html' : (isPlainLike(displayText) ? 'plain' : 'md'));

      if (looksLikeEmail && !isThinking && displayText.length > 10) {
        log('buildMessageNode email branch', idx, m.id || '');
        const parsed = parseEmailForCompose(displayText);
        const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(parsed.subject) + '&body=' + encodeURIComponent(parsed.body);
        const outlookUrl = 'https://outlook.office.com/mail/deeplink/compose?subject=' + encodeURIComponent(parsed.subject) + '&body=' + encodeURIComponent(parsed.body);
        const mailtoUrl = 'mailto:?subject=' + encodeURIComponent(parsed.subject) + '&body=' + encodeURIComponent(parsed.body);

        const block = document.createElement('div');
        block.className = 'agilo-email-block';

        const header = document.createElement('div');
        header.className = 'agilo-email-block-header';
        const label = document.createElement('span');
        label.className = 'agilo-email-block-label';
        label.textContent = 'Email';
        header.appendChild(label);

        const tools = document.createElement('div');
        tools.className = 'agilo-email-block-tools';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'agilo-email-btn agilo-email-btn-copy';
        copyBtn.setAttribute('aria-label', 'Copier le mail');
        copyBtn.setAttribute('title', 'Copier le mail');
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="agilo-email-icon copy-icon"><path fill="none" d="M0 0h24v24H0z"></path><rect fill="none" height="24" width="24"></rect><path fill="currentColor" d="M18,2H9C7.9,2,7,2.9,7,4v12c0,1.1,0.9,2,2,2h9c1.1,0,2-0.9,2-2V4C20,2.9,19.1,2,18,2z M18,16H9V4h9V16z M3,15v-2h2v2H3z M3,9.5h2v2H3V9.5z M10,20h2v2h-2V20z M3,18.5v-2h2v2H3z M5,22c-1.1,0-2-0.9-2-2h2V22z M8.5,22h-2v-2h2V22z M13.5,22L13.5,22l0-2h2v0C15.5,21.1,14.6,22,13.5,22z M5,6L5,6l0,2H3v0C3,6.9,3.9,6,5,6z"></path></svg>';
        const copyIconDefault = copyBtn.innerHTML;
        const copyIconChecked = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="agilo-email-icon copy-icon paste"><path fill="none" d="M0 0h24v24H0z"></path><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>';
        copyBtn.onclick = async () => {
          const toCopy = formatEmailCopyPayload(displayText);
          const success = await copyToClipboard(toCopy);
          if (success) {
            copyBtn.classList.add('agilo-email-btn-copied');
            copyBtn.innerHTML = copyIconChecked;
            toast('Corps du mail copié', 'success');
            setTimeout(() => { copyBtn.classList.remove('agilo-email-btn-copied'); copyBtn.innerHTML = copyIconDefault; }, 2000);
          } else toast('Échec de la copie', 'error');
        };
        tools.appendChild(copyBtn);

        const openWrap = document.createElement('div');
        openWrap.className = 'agilo-email-open-wrap';
        const openTrigger = document.createElement('button');
        openTrigger.type = 'button';
        openTrigger.className = 'agilo-email-btn agilo-email-btn-open';
        openTrigger.setAttribute('aria-label', 'Ouvrir dans Gmail, Outlook ou l’app mail');
        openTrigger.setAttribute('title', 'Ouvrir dans Gmail, Outlook ou l’app mail');
        openTrigger.setAttribute('aria-haspopup', 'menu');
        openTrigger.setAttribute('aria-expanded', 'false');
        openTrigger.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="agilo-email-icon agilo-email-send-icon"><path d="M10.3009 13.6949L20.102 3.89742M10.5795 14.1355L12.8019 18.5804C13.339 19.6545 13.6075 20.1916 13.9458 20.3356C14.2394 20.4606 14.575 20.4379 14.8492 20.2747C15.1651 20.0866 15.3591 19.5183 15.7472 18.3818L19.9463 6.08434C20.2845 5.09409 20.4535 4.59896 20.3378 4.27142C20.2371 3.98648 20.013 3.76234 19.7281 3.66167C19.4005 3.54595 18.9054 3.71502 17.9151 4.05315L5.61763 8.2523C4.48114 8.64037 3.91289 8.83441 3.72478 9.15032C3.56153 9.42447 3.53891 9.76007 3.66389 10.0536C3.80791 10.3919 4.34498 10.6605 5.41912 11.1975L9.86397 13.42C10.041 13.5085 10.1295 13.5527 10.2061 13.6118C10.2742 13.6643 10.3352 13.7253 10.3876 13.7933C10.4468 13.87 10.491 13.9585 10.5795 14.1355Z"/></svg>';
        const dropdown = document.createElement('div');
        dropdown.className = 'agilo-email-dropdown';
        dropdown.hidden = true;
        dropdown.setAttribute('role', 'menu');
        const gmailSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="52 42 88 66" width="20" height="20" class="agilo-email-logo-gmail"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/><path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>';
        const outlookSvg = '<img src="https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6995e36911a4849150741ca6_Microsoft_Office_Outlook_(2018%E2%80%932024).svg" width="20" height="20" alt="" class="agilo-email-logo-outlook">';
        const defaultMailSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" class="agilo-email-logo-default"><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M3.75 5.25L3 6V18L3.75 18.75H20.25L21 18V6L20.25 5.25H3.75ZM4.5 7.6955V17.25H19.5V7.69525L11.9999 14.5136L4.5 7.6955ZM18.3099 6.75H5.68986L11.9999 12.4864L18.3099 6.75Z"/></svg>';
        const menuItems = [
          { id: 'gmail', label: 'Gmail', url: gmailUrl, icon: gmailSvg },
          { id: 'outlook', label: 'Outlook', url: outlookUrl, icon: outlookSvg },
          { id: 'default', label: 'App mail par défaut', url: mailtoUrl, icon: defaultMailSvg }
        ];
        menuItems.forEach(function (item) {
          const a = document.createElement('a');
          a.href = item.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'agilo-email-dropdown-item';
          a.setAttribute('role', 'menuitem');
          a.innerHTML = '<span class="agilo-email-dropdown-icon">' + item.icon + '</span><span>' + item.label + '</span>';
          a.onclick = function () { dropdown.hidden = true; openTrigger.setAttribute('aria-expanded', 'false'); };
          dropdown.appendChild(a);
        });
        const closeDropdown = function () {
          dropdown.hidden = true;
          openTrigger.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', closeDropdown);
        };
        openTrigger.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          const open = dropdown.hidden;
          dropdown.hidden = !open;
          openTrigger.setAttribute('aria-expanded', String(!open));
          if (!open) setTimeout(function () { document.addEventListener('click', closeDropdown); }, 0);
          else document.removeEventListener('click', closeDropdown);
        };
        dropdown.addEventListener('click', function (e) { e.stopPropagation(); });
        openWrap.appendChild(openTrigger);
        openWrap.appendChild(dropdown);
        tools.appendChild(openWrap);

        header.appendChild(tools);
        block.appendChild(header);

        if (parsed.subject) {
          const subjLine = document.createElement('div');
          subjLine.className = 'agilo-email-block-subject';
          subjLine.innerHTML = '<span class="agilo-email-block-subject-label">Objet</span> ' + String(parsed.subject).replace(/</g, '&lt;');
          block.appendChild(subjLine);
        }

        // Séparer corps email et commentaire (accepter "---" ou "Commentaire interne :" / "Commentaire interne (non envoyé) :")
        const rawBody = String(displayText).trim();
        const bodyParts = rawBody.split(AGILO_EMAIL_COMMENT_SPLIT);
        let emailBodyText = (bodyParts[0] || rawBody).trim().replace(/\n\s*---\s*$/m, '').trim();
        let commentBodyText = (bodyParts[1] || '').trim().replace(/^Commentaire interne\s*(\(non envoyé\))?\s*:\s*/i, '').trim();

        // Retirer la ligne "Objet : ..." du corps (déjà affichée en tête)
        emailBodyText = emailBodyText.replace(/^\s*Objet\s*:\s*[^\n]+(\n|$)/i, '$1').trim();

        // Forcer de vrais sauts de paragraphe : double \n avant formules et sections (même si le modèle n'en met qu'un)
        emailBodyText = emailBodyText
          .replace(/\n(Bonjour[^,\n]*,)/gi, '\n\n$1')
          .replace(/\n(Prochaines étapes\s*:)/gi, '\n\n$1')
          .replace(/\n(Cordialement,)/gi, '\n\n$1')
          .replace(/\n(Décisions\s*\/\s*points clés\s*:)/gi, '\n\n$1')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        const bodyWrap = document.createElement('div');
        bodyWrap.className = 'agilo-email-block-body';
        const paragraphs = String(emailBodyText)
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .filter((p) => {
            if (/^`{3,}[^\n]*$/.test(p)) return false;
            if (/^\*{1,3}$/.test(p)) return false;
            return true;
          });
        /* nettoyage final du paragraphe : résidus **gras** ou ###titre après postProcessEmail */
        const cleanParagraph = (p) =>
          p.replace(/\*\*(.+?)\*\*/g, '$1')
           .replace(/\*(.+?)\*/g, '$1')
           .replace(/^#{1,6}\s+/gm, '')
           .replace(/^[-*•▪]\s+/gm, '');
        if (paragraphs.length > 0) {
          bodyWrap.innerHTML = paragraphs.map(function (p, i) {
            const cleaned = cleanParagraph(p);
            const escaped = String(cleaned).replace(/</g, '&lt;').replace(/\n/g, '<br>');
            const cls = i === 0 && /^Objet\s*:/i.test(p.trim()) ? 'agilo-email-p agilo-email-p-first' : 'agilo-email-p';
            return '<p class="' + cls + '">' + escaped + '</p>';
          }).join('');
        } else {
          bodyWrap.textContent = cleanParagraph(emailBodyText);
        }
        block.appendChild(bodyWrap);

        // Toujours afficher l'encadré Ci-dessous (texte par défaut si le modèle n'a pas inclus le commentaire)
        const defaultCommentText = 'Si vous souhaitez un email qui suive la trame de vos échanges précédents, partagez-moi vos derniers emails : j\'adapterai le ton, la logique et éviterai les répétitions. Comment faire : copiez-collez le texte de vos emails ou documents dans le chat (onglet Conversation), puis redemandez un email de suivi.';
        const textToShow = commentBodyText || defaultCommentText;
        const commentWrap = document.createElement('div');
        commentWrap.className = 'agilo-email-internal-comment';
        commentWrap.innerHTML = '<div class="agilo-email-ci-dessous"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg><span>Ci-dessous</span></div><div class="agilo-email-internal-comment-text">' + String(textToShow).replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>';
        block.appendChild(commentWrap);

        bubbleDiv.classList.add('msg-bubble--email');
        bubbleDiv.appendChild(block);
        bubbleDiv.appendChild(buildAssistantActionsNode(idx, lastAssistantIndex, formatEmailCopyPayload(displayText)));
      } else {
        if (renderMode === 'plain') {
          bubbleDiv.textContent = displayText;
          bubbleDiv.style.whiteSpace = 'pre-wrap';
          bubbleDiv.style.lineHeight = '1.6';
        } else if (renderMode === 'html') {
          bubbleDiv.innerHTML = displayText;
        } else {
          bubbleDiv.innerHTML = mdToHtml(displayText);
          bubbleDiv.style.cssText = 'white-space:normal;line-height:1.6';
        }

        if (!isThinking && !displayText.includes('réfléchit') && !displayText.includes('⚠️') && displayText.length > 10) {
          bubbleDiv.appendChild(buildAssistantActionsNode(idx, lastAssistantIndex, displayText));
        }
      }
    } else {
      bubbleDiv.textContent = m.text;
      bubbleDiv.style.whiteSpace = 'pre-wrap';
      if (m.role === 'user') {
        /* ─── Barre d'actions bas-droite (copy + éditer) ─── */
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'msg-user-actions';

        const SVG_COPY_U = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path fill="none" d="M0 0h24v24H0z"/><rect fill="none" height="24" width="24"/><path d="M18,2H9C7.9,2,7,2.9,7,4v12c0,1.1,0.9,2,2,2h9c1.1,0,2-0.9,2-2V4C20,2.9,19.1,2,18,2z M18,16H9V4h9V16z M3,15v-2h2v2H3z M3,9.5h2v2H3V9.5z M10,20h2v2h-2V20z M3,18.5v-2h2v2H3z M5,22c-1.1,0-2-0.9-2-2h2V22z M8.5,22h-2v-2h2V22z M13.5,22L13.5,22l0-2h2v0C15.5,21.1,14.6,22,13.5,22z M5,6L5,6l0,2H3v0C3,6.9,3.9,6,5,6z"/></svg>`;
        const SVG_COPY_CHECK_U = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path fill="none" d="M0 0h24v24H0z"/><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        const SVG_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

        const copyUBtn = document.createElement('button');
        copyUBtn.type = 'button';
        copyUBtn.className = 'msg-user-action-btn';
        copyUBtn.setAttribute('aria-label', 'Copier ce message');
        copyUBtn.title = 'Copier';
        copyUBtn.innerHTML = SVG_COPY_U;
        copyUBtn.onclick = async () => {
          const ok = await copyToClipboard(stripUserDisplaySuffix(m.text));
          if (ok) {
            copyUBtn.innerHTML = SVG_COPY_CHECK_U;
            toast('Copié', 'success');
            setTimeout(() => { copyUBtn.innerHTML = SVG_COPY_U; }, 1800);
          } else toast('Échec de la copie', 'error');
        };

        const editUBtn = document.createElement('button');
        editUBtn.type = 'button';
        editUBtn.className = 'msg-user-action-btn';
        editUBtn.setAttribute('aria-label', 'Modifier ce message');
        editUBtn.title = 'Modifier';
        editUBtn.innerHTML = SVG_EDIT;
        editUBtn.onclick = () => startEditUserMessage(idx);

        actionsDiv.appendChild(copyUBtn);
        actionsDiv.appendChild(editUBtn);

        msgDiv.appendChild(metaDiv);
        msgDiv.appendChild(bubbleDiv);
        msgDiv.appendChild(actionsDiv);
        return msgDiv;
      }
    }

    msgDiv.appendChild(metaDiv);
    msgDiv.appendChild(bubbleDiv);
    return msgDiv;
  }

  function userBubbleIndexInDom(msgs, targetIdx) {
    let n = 0;
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i]?.role !== 'user') continue;
      if (i === targetIdx) return n;
      n++;
    }
    return -1;
  }

  function stripUserDisplaySuffix(text) {
    return String(text || '').replace(/\n\n\(📎[\s\S]*\)\s*$/m, '').trim();
  }

  /**
   * Édition : un seul <textarea> dans la bulle (pas de 2e boîte à côté, pas
   * de contentEditable qui se duplique visuellement sur certains thèmes).
   */
  function startEditUserMessage(idx) {
    if (ACTIVE_USER_EDIT_IDX === idx) return;
    if (chatView?.querySelector('textarea.msg-bubble-edit-ta')) {
      /* Réinitialise proprement un éditeur fantôme éventuel avant d'ouvrir un nouvel edit. */
      render();
    }
    const jobId = ACTIVE_JOB;
    const msgs = getMsgs(jobId);
    const m = msgs[idx];
    if (!m || m.role !== 'user') return;

    const initial = stripUserDisplaySuffix(m.text);

    const domIdx = userBubbleIndexInDom(msgs, idx);
    const msgRow = domIdx >= 0 ? chatView?.querySelectorAll('.msg--user')?.[domIdx] : null;
    if (!msgRow) return;
    const bubble = msgRow.querySelector('.msg-bubble');
    if (!bubble) return;
    if (bubble.querySelector('textarea.msg-bubble-edit-ta')) return;

    const actionsDiv = msgRow.querySelector('.msg-user-actions');
    if (actionsDiv) actionsDiv.hidden = true;

    if (msgs.length - idx - 1 > 0) {
      toast("Modifier ce message supprimera les réponses suivantes à l'envoi.", 'info');
    }

    const savedHtml = bubble.innerHTML;
    const savedText = initial;
    ACTIVE_USER_EDIT_IDX = idx;
    bubble.textContent = '';
    bubble.classList.add('msg-bubble--editing');
    const ta = document.createElement('textarea');
    ta.className = 'msg-bubble-edit-ta';
    ta.value = savedText;
    ta.rows = Math.min(12, Math.max(2, (savedText.match(/\n/g) || []).length + 1));
    ta.setAttribute('aria-label', 'Modifier le message');
    bubble.appendChild(ta);
    try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { }

    const editBar = document.createElement('div');
    editBar.className = 'agilo-user-edit-bar';

    const finishRestoreBubble = (textPlain) => {
      ta.remove();
      bubble.classList.remove('msg-bubble--editing');
      ACTIVE_USER_EDIT_IDX = -1;
      if (textPlain != null) {
        bubble.textContent = textPlain;
        bubble.style.whiteSpace = 'pre-wrap';
      } else {
        bubble.innerHTML = savedHtml;
        bubble.style.whiteSpace = 'pre-wrap';
      }
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'agilo-user-edit-cancel';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = () => {
      finishRestoreBubble(null);
      editBar.remove();
      if (actionsDiv) actionsDiv.hidden = false;
    };

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'agilo-user-edit-send';
    saveBtn.innerHTML = String.fromCharCode(0x2713) + ' Enregistrer et renvoyer';
    saveBtn.onclick = () => {
      const next = String(ta.value || '').replace(/\n+$/, '').trim();
      if (!next) { toast('Message vide', 'error'); return; }
      finishRestoreBubble(next);
      editBar.remove();
      if (actionsDiv) actionsDiv.hidden = false;

      const live = getMsgs(jobId);
      const cut = (m.id != null) ? live.findIndex((x) => x.id === m.id && x.role === 'user') : idx;
      const cutIdx = cut >= 0 ? cut : idx;
      live.splice(cutIdx);
      saveMsgs(jobId, live);
      if (jobId === ACTIVE_JOB) { MESSAGES = live; render(); }

      if (SENDING.has(jobId)) {
        enqueueAsk(jobId, next, null);
        toast('Message en file d\u2019attente', 'success');
        updateQueueBadge(jobId);
        return;
      }
      void handleAskExecute(jobId, next, null).catch(() => {});
    };

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    });

    editBar.appendChild(cancelBtn);
    editBar.appendChild(saveBtn);
    msgRow.appendChild(editBar);
  }

  function render() {
    if (!chatView) return;
    ACTIVE_USER_EDIT_IDX = -1;
    const stickToBottom = isNearBottom(chatView);
    const prevScrollTop = chatView.scrollTop;
    const lastAssistantIndex = lastAssistantIndexOf(MESSAGES);
    chatView.innerHTML = '';
    if (shouldRenderEmptyState(MESSAGES)) {
      chatView.appendChild(buildEmptyStateNode());
      chatView.setAttribute('data-agilo-chat', 'V07-embed');
      chatView.scrollTop = 0;
      return;
    }
    let previousDay = '';
    MESSAGES.forEach((m, idx) => {
      if (m.role !== 'system') {
        const currentDay = dayKey(m.t);
        if (currentDay && currentDay !== previousDay) {
          const label = formatDateSeparatorLabel(m.t);
          if (label) chatView.appendChild(buildDateSeparatorNode(label));
          previousDay = currentDay;
        }
      }
      chatView.appendChild(buildMessageNode(m, idx, lastAssistantIndex));
    });
    chatView.setAttribute('data-agilo-chat', 'V07-embed');
    /* Si l'utilisateur était en bas OU si le dernier message est une réponse assistante
       fraîche (et non un thinking), on recolle en bas. */
    const lastMsg = MESSAGES[MESSAGES.length - 1];
    const lastIsAssistant = lastMsg?.role === 'assistant';
    const lastIsThinking = lastIsAssistant && /thinking-indicator|Assistant réfléchit|Je travaille sur la rédaction/i.test(lastMsg?.text || '');
    if (stickToBottom || (lastIsAssistant && !lastIsThinking)) {
      chatView.scrollTop = chatView.scrollHeight;
    } else {
      chatView.scrollTop = prevScrollTop;
    }
  }
  function addMessage(role, text) {
    MESSAGES.push({ role, text: String(text || '').trim(), t: new Date().toISOString() });
    saveHistory(); render();
  }
  function updateLastMessage(text) {
    if (MESSAGES.length > 0) {
      MESSAGES[MESSAGES.length - 1].text = String(text || '').trim();
      saveHistory(); render();
    }
  }
  function setBusy(on) {
    btnAsk?.classList.toggle('is-busy', !!on);
    chatSendBtn?.classList.toggle('is-busy', !!on);
    const ta = activeChatPrompt();
    if (ta) ta.disabled = !!on;
    refreshSendReadyState();
  }

  // === clés & stockage par job ===
  const LSKEYJOB = (jobId) => `agilo:chat:${jobId || 'nojob'}`;
  function getMsgs(jobId) {
    try { return JSON.parse(localStorage.getItem(LSKEYJOB(jobId)) || '[]') || []; }
    catch { return []; }
  }
  function saveMsgs(jobId, msgs) {
    try { localStorage.setItem(LSKEYJOB(jobId), JSON.stringify(msgs)); } catch { }
  }
  function renderIfCurrent(jobId) {
    if (jobId === ACTIVE_JOB) {
      MESSAGES = getMsgs(jobId);
      render();
    }
  }

  // === messages utilitaires ===
  function pushMsg(jobId, msg) {
    const msgs = getMsgs(jobId);
    msgs.push(msg);
    saveMsgs(jobId, msgs);
    renderIfCurrent(jobId);
    return msg;
  }
  function replaceMsgById(jobId, id, newText, patch = null) {
    const msgs = getMsgs(jobId);
    const i = msgs.findIndex(m => m.id === id);
    if (i !== -1) {
      msgs[i].text = newText;
      if (patch && typeof patch === 'object') Object.assign(msgs[i], patch);
      saveMsgs(jobId, msgs);
      if (jobId === ACTIVE_JOB && chatView) {
        const existing = chatView.querySelector(`[data-msg-id="${id}"]`);
        if (existing) {
          const lastAssistantIndex = lastAssistantIndexOf(msgs);
          const freshNode = buildMessageNode(msgs[i], i, lastAssistantIndex);
          existing.replaceWith(freshNode);
          const thinking = typeof newText === 'string' && (newText.includes('thinking-indicator') || /Assistant réfléchit|Je travaille sur la rédaction du post LinkedIn/i.test(newText));
          if (freshNode.classList.contains('msg--ai') && !thinking) {
            /* Réponse finale : scroller en bas pour que l'utilisateur la voie sans action */
            scrollChatToBottom();
          }
          return;
        }
      }
      renderIfCurrent(jobId);
    }
  }

  // === runId & "busy" par job ===
  const mkRunId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const SENDING = new Set();                         // set de jobIds en cours d'envoi
  const isSending = (jobId) => SENDING.has(jobId);
  function setBusyFor(jobId, on) {
    if (on) SENDING.add(jobId); else SENDING.delete(jobId);
    if (jobId === ACTIVE_JOB) setBusy(on);          // ne grise l'UI que du job affiché
  }
  function releaseSend(jobId) {
    SENDING.delete(jobId);
    if (jobId === ACTIVE_JOB) setBusy(false);
  }

  /**
   * Fait défiler chatView pour rendre le nœud visible.
   * Pour les bulles assistantes (longues), on préfère aligner en bas
   * plutôt qu'en haut : l'utilisateur voit la fin du message, pas le début.
   * Si le nœud est très court (< 120px), on aligne en 'start' (comportement classique).
   */
  function scrollChatNodeIntoView(node) {
    if (!node || !chatView) return;
    requestAnimationFrame(() => {
      try {
        const isAI = node.classList.contains('msg--ai');
        const nodeH = node.offsetHeight || 0;
        if (isAI && nodeH > 120) {
          /* Réponse longue : scroller le conteneur tout en bas */
          chatView.scrollTop = chatView.scrollHeight;
        } else {
          node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } catch { }
    });
  }

  /** Force chatView en bas — appelée après ajout / remplacement d'un message assistant. */
  function scrollChatToBottom(behavior = 'smooth') {
    if (!chatView) return;
    requestAnimationFrame(() => {
      try { chatView.scrollTo({ top: chatView.scrollHeight, behavior }); } catch { chatView.scrollTop = chatView.scrollHeight; }
    });
  }

  function updateQueueBadge(jobId) {
    const el = byId('chat-queue-badge');
    if (!el || jobId !== ACTIVE_JOB) return;
    const n = (MSG_QUEUE.get(jobId) || []).length;
    el.textContent = n ? String(n) : '';
    el.hidden = !n;
    el.setAttribute('aria-label', n ? `${n} message(s) en file d’attente` : '');
  }

  function enqueueAsk(jobId, q, intentHint) {
    if (!MSG_QUEUE.has(jobId)) MSG_QUEUE.set(jobId, []);
    MSG_QUEUE.get(jobId).push({ q, intentHint: intentHint || null });
    updateQueueBadge(jobId);
  }

  function drainAskQueue(jobId) {
    const qList = MSG_QUEUE.get(jobId);
    if (!qList || !qList.length || SENDING.has(jobId)) return;
    const next = qList.shift();
    MSG_QUEUE.set(jobId, qList);
    updateQueueBadge(jobId);
    void handleAskExecute(jobId, next.q, next.intentHint).catch((e) => err('drainAskQueue', e));
  }

  function renderAttachmentsList() {
    const host = byId('agilo-chat-submission')?.querySelector('#chat-attachments-list') || byId('chat-attachments-list');
    if (!host) return;
    host.innerHTML = '';
    PENDING_FILES.forEach((f, i) => {
      const row = document.createElement('span');
      row.className = 'agilo-chat-attach-chip';
      row.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin:4px 6px 0 0;padding:2px 8px;border-radius:6px;background:#eef2ff;font-size:12px;color:#1e3a5f';
      row.textContent = f.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Retirer ' + f.name);
      rm.textContent = '×';
      rm.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;padding:0 2px';
      rm.onclick = () => { PENDING_FILES.splice(i, 1); renderAttachmentsList(); };
      row.appendChild(rm);
      host.appendChild(row);
    });
  }

  /* SVG icons partagés — inline, pas de dépendance externe */
  const SVG_PAPERCLIP = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
  const SVG_MIC       = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const SVG_MIC_STOP  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  const SVG_SEND      = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  /**
   * Même `id` dupliqué (ex. deux `#chat-compose-bar` imbriqués) = une barre
   * « en sandwich » : deux bandeaux, deux trombones, mic décalé.
   * On garde seulement la barre qui contient réellement #chatPrompt.
   */
  /**
   * Aplatit les #chat-compose-bar imbriqués en gardant celui qui contient #chatPrompt.
   * Situation typique : Webflow a un div#chat-compose-bar parent qui entoure l'embed.
   */
  function fixChatComposeNesting() {
    const sub = byId('agilo-chat-submission');
    if (!sub) return;
    const prompt = byId('chatPrompt');
    if (!prompt || !sub.contains(prompt)) return;
    const bars = Array.from(sub.querySelectorAll('[id="chat-compose-bar"]'));
    if (bars.length <= 1) return;
    const keeper = prompt.closest('#chat-compose-bar');
    if (!keeper || !sub.contains(keeper)) return;
    for (const el of bars) {
      if (el === keeper) continue;
      const parent = el.parentNode;
      if (!parent) continue;
      if (el.contains(keeper) || keeper.contains(el)) {
        /* Wrapper parasite : hisser ses enfants et supprimer */
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
      }
    }
  }

  /**
   * Supprime les footers dupliqués (#chat-compose-footer).
   * Garde le footer qui contient #chat-send-btn (embed V1.08).
   * Si aucun n'a le send btn, garde le premier.
   */
  function fixDuplicateChatFooters() {
    const root = byId('agilo-chat-submission') || document;
    const all = Array.from(root.querySelectorAll('[id="chat-compose-footer"]'));
    if (all.length <= 1) return;
    const withSend = all.find(f => f.querySelector('#chat-send-btn'));
    const good = withSend || all[0];
    all.forEach(f => { if (f !== good) f.remove(); });
  }

  /**
   * Supprime les #chat-attach-btn en double dans #agilo-chat-submission
   * (même #id peut se retrouver dans l'embed + un résidu Webflow).
   * On garde celui qui appartient à la vraie barre du #chatPrompt.
   */
  function fixDuplicateAttachBtns() {
    const sub = byId('agilo-chat-submission');
    if (!sub) {
      const b = byId('chat-attach-btn');
      if (b) { b.removeAttribute('disabled'); b.removeAttribute('aria-disabled'); }
      return;
    }
    const p = sub.querySelector('#chatPrompt');
    const goodBar = p?.closest('#chat-compose-bar');
    const all = Array.from(sub.querySelectorAll('[id="chat-attach-btn"]'));
    if (!all.length) return;
    const good = (goodBar && all.find(b => goodBar.contains(b)))
      || all.find(b => !b.disabled)
      || all[0];
    good.removeAttribute('disabled');
    good.removeAttribute('aria-disabled');
    all.forEach(b => { if (b !== good) b.remove(); });
  }

  /**
   * Supprime tout contrôle (attach/mic/envoyer) présent ailleurs que dans
   * la barre de saisie correcte, ou toute copie d'id orpheline.
   * Corrige le cas « 2 icônes trombone » dû à 2 nœuds #chat-attach-btn dans l'arbre.
   */
  function removeOrphanChatButtons() {
    const sub = byId('agilo-chat-submission');
    if (!sub) return;
    const p = sub.querySelector('#chatPrompt');
    const goodBar = p?.closest('#chat-compose-bar');
    if (!goodBar) return;
    const ids = ['chat-attach-btn', 'chat-dictate-btn', 'chat-send-btn'];
    ids.forEach((id) => {
      const allInDoc = sub.querySelectorAll(`[id="${id}"]`);
      allInDoc.forEach((el) => { if (!goodBar.contains(el)) el.remove(); });
      const inBar = goodBar.querySelectorAll(`[id="${id}"]`);
      for (let i = 1; i < inBar.length; i++) inBar[i].remove();
    });
  }

  /** Formulaire de chat + nœuds, scopés au bon #chatPrompt. */
  function getChatFormScope() {
    const p = activeChatPrompt();
    const f = p?.closest('form#wf-form-chat') || form;
    const bar = p?.closest('#chat-compose-bar');
    return {
      prompt: p,
      formEl: f,
      bar,
      /* footer optionnel : absent dans le layout inline V1.08 */
      footer: bar?.querySelector('[id="chat-compose-footer"]') || f?.querySelector('[id="chat-compose-footer"]') || null,
      sendBtn: bar?.querySelector('#chat-send-btn') || f?.querySelector('#chat-send-btn') || byId('chat-send-btn')
    };
  }

  /**
   * ensureChatChrome — V07 (embed autonome)
   *
   * Stratégie : si l'Embed Webflow a été copié-collé, les nœuds
   *   #chat-compose-bar, #chat-compose-footer, #chatPrompt, #chat-send-btn
   *   existent DÉJÀ dans le DOM statique.
   *   → Le script n'attache que les listeners et adapte le badge de file.
   *
   * Si la page utilise encore l'ancien form Webflow (mode de compatibilité),
   *   la construction JS complète reste disponible via data-agilo-compose="auto"
   *   sur #pane-chat.
   */
  function ensureChatChrome() {
    fixChatComposeNesting();
    fixDuplicateChatFooters();
    fixDuplicateAttachBtns();
    {
      const bBar = activeChatPrompt()?.closest('#chat-compose-bar');
      const bTag = byId('chat-queue-badge');
      if (bBar && bTag && !bBar.contains(bTag)) {
        const sub = bBar.closest('#agilo-chat-submission') || bBar.parentElement;
        if (sub && !sub.contains(bTag)) sub.insertBefore(bTag, sub.firstChild);
      }
    }
    const { prompt, formEl, bar, footer, sendBtn: scopedSend } = getChatFormScope();

    /* ---- A. Résolution du bouton d'envoi (embed OU JS-build) ---- */
    const existingSendBtn = scopedSend;
    if (existingSendBtn) {
      /* L'Embed fournit #chat-send-btn (contrat DOM stable) */
      chatSendBtn = existingSendBtn;
      /* S'assurer que l'ancien div Webflow #btnAsk est bien caché */
      if (btnAsk) btnAsk.hidden = true;
    } else if (footer) {
      /* Barre injectée par ancienne version JS, sans #chat-send-btn */
      const sendBtn = document.createElement('button');
      sendBtn.type = 'button';
      sendBtn.id = 'chat-send-btn';
      sendBtn.className = 'agilo-chat-send';
      sendBtn.setAttribute('aria-label', 'Envoyer');
      sendBtn.title = 'Envoyer';
      sendBtn.innerHTML = SVG_SEND;
      footer.appendChild(sendBtn);
      chatSendBtn = sendBtn;
      if (btnAsk) btnAsk.hidden = true;
    }

    /* ---- B. Badge file d'attente (ajouter si absent) — **dans** #chat-compose-bar, coin haut-droit (CSS), pas un bandeau jaune au-dessus */
    if (!byId('chat-queue-badge')) {
      const badge = document.createElement('span');
      badge.id = 'chat-queue-badge';
      badge.hidden = true;
      badge.setAttribute('aria-live', 'polite');
      const barEl = activeChatPrompt()?.closest('#chat-compose-bar') || bar;
      if (barEl) {
        barEl.insertBefore(badge, barEl.firstChild);
      } else if (bar && bar.parentElement) {
        bar.parentElement.insertBefore(badge, bar);
      }
    }

    /* ---- C. Input file masqué pour phase 2 PJ (si absent) — scopé à la bar ---- */
    const _bar = prompt?.closest('#chat-compose-bar') || bar;
    if (_bar && !_bar.querySelector('#chat-file-input') && activeChatPrompt()) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'chat-file-input';
      fileInput.multiple = true;
      fileInput.accept = '.pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', () => {
        const arr = Array.from(fileInput.files || []);
        for (const f of arr) {
          if (PENDING_FILES.length >= MAX_ATTACH_FILES) { toast(`Maximum ${MAX_ATTACH_FILES} fichiers`, 'error'); break; }
          if (f.size > MAX_ATTACH_MB * 1024 * 1024) { toast(`${f.name} : max ${MAX_ATTACH_MB} Mo`, 'error'); continue; }
          PENDING_FILES.push(f);
        }
        fileInput.value = '';
        renderAttachmentsList();
      });
      _bar.appendChild(fileInput);
    }

    /* ---- D. Conteneur liste PJ (si absent) ---- */
    {
      const subList = byId('agilo-chat-submission');
      if (subList && !subList.querySelector('#chat-attachments-list')) {
        const listHost = document.createElement('div');
        listHost.id = 'chat-attachments-list';
        subList.appendChild(listHost);
      } else if (!subList && !byId('chat-attachments-list')) {
        const listHost = document.createElement('div');
        listHost.id = 'chat-attachments-list';
        const ftr = footer || byId('chat-compose-footer');
        if (ftr && ftr.parentElement) ftr.parentElement.insertBefore(listHost, ftr);
        else if (formEl) formEl.appendChild(listHost);
      }
    }

    /* ---- E. Mic (Web Speech API) : uniquement s'il manque DANS la barre du vrai #chatPrompt ---- */
    if ((window.SpeechRecognition || window.webkitSpeechRecognition) && _bar) {
      if (!_bar.querySelector('#chat-dictate-btn') && activeChatPrompt()) {
        const lang = ($('#pane-chat')?.dataset?.agiloChatLang) || 'fr-FR';
        const micBtn = document.createElement('button');
        micBtn.type = 'button';
        micBtn.id = 'chat-dictate-btn';
        micBtn.setAttribute('aria-pressed', 'false');
        micBtn.setAttribute('aria-label', 'Dicter');
        micBtn.title = 'Dicter (navigateur)';
        micBtn.innerHTML = SVG_MIC;
        micBtn.addEventListener('click', () => {
          if (__dictationActive) { try { __speechRecognition?.stop(); } catch { } return; }
          const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!Rec) { toast('Dictée non supportée sur ce navigateur', 'error'); return; }
          const rec = new Rec();
          rec.lang = lang; rec.interimResults = true; rec.continuous = true;
          rec.onresult = (ev) => {
            let chunk = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) { if (ev.results[i].isFinal) chunk += ev.results[i][0].transcript; }
            if (chunk) {
              const inp = activeChatPrompt();
              if (!inp) return;
              const cur = (inp.value || '').trimEnd();
              inp.value = cur + (cur ? ' ' : '') + chunk.trim() + ' ';
              autosizeChatPrompt(inp);
              updatePromptCounter(inp);
              refreshSendReadyState();
            }
          };
          rec.onerror = (e) => { err('speech', e); toast('Dictée : ' + (e.error || 'erreur'), 'error'); };
          rec.onend = () => {
            __dictationActive = false; __speechRecognition = null;
            micBtn.setAttribute('aria-pressed', 'false');
            micBtn.classList.remove('is-recording');
            micBtn.innerHTML = SVG_MIC;
            if (chatSendBtn) chatSendBtn.disabled = false;
          };
          try {
            rec.start(); __dictationActive = true; __speechRecognition = rec;
            micBtn.setAttribute('aria-pressed', 'true');
            micBtn.classList.add('is-recording');
            micBtn.innerHTML = SVG_MIC_STOP;
            if (chatSendBtn) chatSendBtn.disabled = true;
          } catch { toast('Impossible de démarrer la dictée', 'error'); }
        });
        const sendRef = _bar.querySelector('#chat-send-btn') || chatSendBtn;
        if (sendRef) _bar.insertBefore(micBtn, sendRef);
        else _bar.appendChild(micBtn);
      }
    }

    /* ---- F. Mode JS-build complet (data-agilo-compose="auto") — pas si embed déjà en place */
    const paneChat = byId('pane-chat');
    const _inpAuto = activeChatPrompt();
    if (!byId('agilo-chat-submission') && paneChat?.dataset?.agiloCompose === 'auto' && !byId('chat-compose-bar') && _inpAuto) {
      const bar = document.createElement('div'); bar.id = 'chat-compose-bar';
      const footer = document.createElement('div'); footer.id = 'chat-compose-footer';
      if (_inpAuto.parentElement) {
        _inpAuto.parentElement.insertBefore(bar, _inpAuto);
        bar.appendChild(_inpAuto);
        bar.appendChild(footer);
      }
      /* PJ stub */
      const attachBtn = document.createElement('button');
      attachBtn.type = 'button'; attachBtn.id = 'chat-attach-btn';
      attachBtn.setAttribute('aria-label', 'Pièce jointe (bientôt disponible)');
      attachBtn.title = 'Pièces jointes — bientôt disponibles';
      attachBtn.innerHTML = SVG_PAPERCLIP;
      footer.appendChild(attachBtn);
      /* Bouton envoi */
      if (!byId('chat-send-btn')) {
        const sendBtn = document.createElement('button');
        sendBtn.type = 'button'; sendBtn.id = 'chat-send-btn'; sendBtn.className = 'agilo-chat-send';
        sendBtn.setAttribute('aria-label', 'Envoyer'); sendBtn.title = 'Envoyer';
        sendBtn.innerHTML = SVG_SEND;
        footer.appendChild(sendBtn);
        chatSendBtn = sendBtn;
      }
      if (btnAsk) btnAsk.hidden = true;
    }

    removeOrphanChatButtons();
    bindPromptUiEvents();
  }

  async function uploadPendingAttachments(auth, jobId) {
    if (!ATTACHMENTS_ENABLED || !PENDING_FILES.length) return { attachmentIds: '', ok: true };
    const fd = new FormData();
    fd.append('username', auth.username);
    fd.append('token', auth.token);
    fd.append('edition', auth.edition);
    fd.append('jobId', String(jobId));
    PENDING_FILES.forEach((f) => fd.append('files', f, f.name));
    try {
      const r = await fetch(`${API_BASE}/uploadChatAttachment`, { method: 'POST', body: fd, mode: 'cors', credentials: 'omit' });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch { }
      if (!r.ok || (j && j.status === 'KO')) {
        warn('uploadChatAttachment fallback noms', r.status, text?.slice(0, 200));
        return { attachmentIds: '', ok: false };
      }
      const ids = (j && (j.attachmentIds || j.ids)) ? String(j.attachmentIds || j.ids) : '';
      return { attachmentIds: ids, ok: true };
    } catch (e) {
      warn('uploadChatAttachment network', e);
      return { attachmentIds: '', ok: false };
    }
  }

  // ✅ PAR CETTE VERSION AMÉLIORÉE (DYNAMIC THINKING V2)
  // ✅ PAR CETTE VERSION STANDARD (Safe)
  // messageHint: optional string (e.g. for LinkedIn: "Je travaille sur la rédaction du post LinkedIn...")
  function updateThinking(jobId, runId, cycle, messageHint) {
    const label = messageHint && messageHint.trim() ? messageHint.trim() : 'Assistant réfléchit';
    const thinkingHtml = `
    <div class="thinking-indicator">
      <span>${String(label).replace(/</g, '&lt;')}</span>
      <div class="thinking-dots">
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
      </div>
    </div>
  `;
    replaceMsgById(jobId, runId, thinkingHtml, { render: 'html' });
  }


  /* ================== EXPORT (PDF local + formats serveur) ================== */
  async function exportMessage(msgIndex, format) {
    const f = String(format || '').toLowerCase();

    if (f === 'pdf') { // rendu propre local : toujours partir du stockage à jour, fallback DOM si thinking
      const msgs = getMsgs(ACTIVE_JOB);
      const msg = msgs[msgIndex];
      let md = (msg?.text || '').trim();
      const isThinkingPlaceholder = !md || md === LINKEDIN_THINKING_MSG || md === 'Assistant réfléchit...' || /thinking-indicator|Assistant réfléchit/i.test(md);
      if (isThinkingPlaceholder && chatView) {
        const dataId = msg?.id;
        const node = dataId ? chatView.querySelector(`[data-msg-id="${dataId}"]`) : null;
        let bubble = node ? node.querySelector('.msg-bubble') : null;
        if (!bubble) {
          const aiList = chatView.querySelectorAll('.msg--ai');
          const lastAi = aiList[aiList.length - 1];
          bubble = lastAi ? lastAi.querySelector('.msg-bubble') : null;
        }
        if (bubble) {
          const fromDom = (bubble.innerText || bubble.textContent || '').trim();
          if (fromDom && fromDom.length > 10) md = fromDom;
        }
      }
      const title = `Transcript ${ACTIVE_JOB || getJobId() || ''}`;
      const fname = `transcript_${ACTIVE_JOB || 'unknown'}_${Date.now()}.pdf`;
      exportLocalPDF(md, fname, title);
      return;
    }

    // autres formats via serveur
    const auth = await resolveAuth();
    if (!auth.username || !auth.token) { toast('Authentification manquante', 'error'); return; }

    const url = `${API_BASE}/receiveRepromptText`;
    const params = new URLSearchParams({
      username: auth.username,
      token: auth.token,
      jobId: ACTIVE_JOB || getJobId(),
      edition: auth.edition,
      format: f
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params, cache: 'no-store', mode: 'cors', credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `transcript_${ACTIVE_JOB || 'unknown'}_${Date.now()}.${f}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }

  /* ================== STYLE / PERSONA ================== */
  const GET_MEMBER_TIMEOUT_MS = 1500;
  function getPersona() { return (document.querySelector('#ms-persona')?.textContent || '').trim(); }
  function getUseCase() { return (document.querySelector('#ms-use_case')?.textContent || '').trim(); }
  function sanitizeForPrompt(s, maxLen = 200) {
    return String(s || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  }
  async function getUserContextForPrompt() {
    const firstName = sanitizeForPrompt(document.querySelector('#ms-first-name')?.textContent, 80) || 'Professionnel';
    let lastName = sanitizeForPrompt(document.querySelector('#ms-last-name')?.textContent || document.querySelector('[data-ms-member="last-name"]')?.textContent, 80);
    let linkedinUrl = sanitizeForPrompt(document.querySelector('#ms-linkedin-url')?.textContent || document.querySelector('[data-ms-member="linkedin_url"]')?.textContent || document.querySelector('[data-ms-member="linkedin-url"]')?.textContent, 500);
    if ((!lastName || !linkedinUrl) && window.$memberstackDom?.getMember) {
      try {
        const r = await Promise.race([
          window.$memberstackDom.getMember(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('getMember timeout')), GET_MEMBER_TIMEOUT_MS))
        ]);
        const d = r?.data || {};
        if (!lastName) lastName = sanitizeForPrompt(d.lastName || d['last-name'], 80);
        if (!linkedinUrl) linkedinUrl = sanitizeForPrompt(d.linkedin_url || d.linkedinUrl || d['linkedin-url'], 500);
      } catch (_) { /* défensif : garde valeurs DOM ou vides */ }
    }
    const fullName = lastName ? `${firstName} ${lastName}`.trim() : firstName;
    const userJob = sanitizeForPrompt(document.querySelector('#ms-persona')?.textContent, 80) || 'Expert';
    const userUseCase = sanitizeForPrompt(document.querySelector('#ms-use_case')?.textContent, 80) || 'Général';
    return { firstName, lastName, fullName, userJob, userUseCase, linkedinUrl };
  }
  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^\w]+/g, ' ').trim();
  }

  const STYLE_PRESETS = {
    defaults: {
      tone: 'neutre-executif',
      sectionsFR: ['Résumé', 'Points clés', 'Actions', 'Références temporelles'],
      sectionsEN: ['Summary', 'Key Points', 'Actions', 'Timecodes'],
      density: 'concise'
    },
    personas: {
      'dirigeant fondateur': {
        tone: 'executif',
        sectionsFR: ['Décisions à prendre', 'Risques', 'Opportunités', 'Actions', 'Timecodes'],
        sectionsEN: ['Decisions', 'Risks', 'Opportunities', 'Actions', 'Timecodes']
      },
      'manager responsable d equipe': {
        tone: 'operatif',
        sectionsFR: ['Contexte', 'Points de blocage', 'Prochaines étapes', 'Timecodes'],
        sectionsEN: ['Context', 'Blockers', 'Next Steps', 'Timecodes']
      },
      'profession liberale independant': { tone: 'pragmatique' },
      'salarie employe': { tone: 'clair-pedago' },
      'etudiant': {
        tone: 'pedagogique',
        density: 'medium',
        sectionsFR: ['Explications', 'Exemples', 'Points clés', 'Timecodes'],
        sectionsEN: ['Explanations', 'Examples', 'Key Points', 'Timecodes']
      }
    },
    usecases: {
      'rendez vous clients': {
        sectionsFR: ['Résumé', 'Besoins client', 'Objections', 'Prochaines étapes', 'Timecodes'],
        sectionsEN: ['Summary', 'Client Needs', 'Objections', 'Next Steps', 'Timecodes']
      },
      'appels de vente': {
        tone: 'sales',
        sectionsFR: ['Accroche', 'Arguments', 'Objections', 'Call to Action', 'Timecodes'],
        sectionsEN: ['Hook', 'Arguments', 'Objections', 'Call to Action', 'Timecodes']
      },
      'reunions d equipe projets': {
        sectionsFR: ['Décisions', 'Tâches', 'Responsables', 'Échéances', 'Timecodes'],
        sectionsEN: ['Decisions', 'Tasks', 'Owners', 'Deadlines', 'Timecodes']
      },
      'entretiens recrutement presse podcast': {
        sectionsFR: ['Thèmes', 'Citations', 'Moments forts', 'Timecodes'],
        sectionsEN: ['Themes', 'Quotes', 'Highlights', 'Timecodes']
      },
      'support service client': {
        sectionsFR: ['Problème', 'Diagnostic', 'Résolution', 'Prévention', 'Timecodes'],
        sectionsEN: ['Issue', 'Diagnosis', 'Resolution', 'Prevention', 'Timecodes']
      },
      'rendez vous juridiques': {
        tone: 'formel',
        sectionsFR: ['Points juridiques', 'Risques', 'Recommandations', 'Timecodes'],
        sectionsEN: ['Legal Points', 'Risks', 'Recommendations', 'Timecodes']
      }
    }
  };

  function computeStyle(persona, useCase, lang) {
    const base = { ...STYLE_PRESETS.defaults };
    const p = STYLE_PRESETS.personas[norm(persona)] || {};
    const u = STYLE_PRESETS.usecases[norm(useCase)] || {}; // fixed syntax error
    const merged = { ...base, ...p, ...u };
    const sections = (lang === 'en' ? merged.sectionsEN : merged.sectionsFR) || (lang === 'en' ? base.sectionsEN : base.sectionsFR);
    return { ...merged, sections };
  }

  /* ================== LINKEDIN POST-PROCESS ================== */
  const BOLD_RE = /[\u{1D400}-\u{1D7FF}]/u;
  function toUnicodeBold(s) {
    const out = [];
    for (const ch of String(s || '')) {
      const code = ch.codePointAt(0);
      if (code >= 0x41 && code <= 0x5A) out.push(String.fromCodePoint(0x1D400 + (code - 0x41)));
      else if (code >= 0x61 && code <= 0x7A) out.push(String.fromCodePoint(0x1D41A + (code - 0x61)));
      else if (code >= 0x30 && code <= 0x39) out.push(String.fromCodePoint(0x1D7CE + (code - 0x30)));
      else out.push(ch);
    }
    return out.join('');
  }
  function isLinkedInRequest(s) {
    const q = String(s || '').toLowerCase();
    return /\blinkedin\b/.test(q) || /post\s+linkedin|linkedin\s+post/.test(q);
  }
  function isEmailRequest(s) {
    const q = String(s || '').toLowerCase();
    return /\bemail\b/.test(q) || /\bmail\b/.test(q) || /\bcourriel\b/.test(q);
  }
  function isExplicitLinkedIn(s) {
    const q = String(s || '').trim().toLowerCase();
    return /^(post\s+linkedin|linkedin\s+post|linkedin)\b/.test(q) || /\b(r[eé]dige|g[eé]n[eé]re|cr[eé]e)\b.*\bpost\s+linkedin\b/.test(q);
  }
  function isExplicitEmail(s) {
    const q = String(s || '').trim().toLowerCase();
    return /^(email|mail|courriel)\b/.test(q) || /\b(r[eé]dige|g[eé]n[eé]re|cr[eé]e)\b.*\b(email|mail|courriel)\b/.test(q);
  }
  function looksLikeEmailThread(s) {
    const q = String(s || '');
    const hasHeaders = /(^|\n)\s*(de|from|à|to|objet|subject|envoy[eé]|sent)\s*:/i.test(q);
    const hasGreeting = /(^|\n)\s*(bonjour|bonsoir|hello|hi)\b/i.test(q);
    const hasSignature = /(^|\n)\s*(cordialement|bien\s+à\s+vous|sinc[eè]res?\s+salutations|best\s+regards)\b/i.test(q);
    return (q.length > 200 && (hasHeaders || hasGreeting || hasSignature));
  }
  const LAST_INTENT_KEY = 'agilo:last_intent';
  function getLastIntent() {
    return (window.__agiloLastIntent || sessionStorage.getItem(LAST_INTENT_KEY) || '').trim();
  }
  function setLastIntent(v) {
    window.__agiloLastIntent = v || '';
    try { sessionStorage.setItem(LAST_INTENT_KEY, v || ''); } catch { }
  }
  function resolveIntent(question, hint) {
    if (hint === 'linkedin' || hint === 'email') return hint;
    if (isExplicitEmail(question)) return 'email';
    if (isExplicitLinkedIn(question)) return 'linkedin';
    return null;
  }
  function postProcessLinkedIn(text) {
    if (!text) return text;
    let t = String(text).replace(/\r\n/g, '\n');
    // Remove markdown bold/italics
    t = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
    // Remove obvious preamble / labels
    t = t.replace(/^(?:\s*(voici|voilà|post\s+linkedin|linkedin\s+post|titre|accroche|hook)[^\n]*\n)+/i, '');

    // Extract "Pourquoi ce post" to re-append at the end
    let why = '';
    t = t.replace(/\n*Pourquoi ce post\s*:\s*([^\n]*)([\s\S]*)/i, (m, p1, rest) => {
      why = `Pourquoi ce post : ${String(p1 || '').trim()}`;
      return rest || '';
    });

    // Normalize bullets to arrows
    t = t.replace(/^\s*[-*•▪]\s+/gm, '→ ');
    // Ensure arrows are on their own lines
    t = t.replace(/\s*→\s*/g, '\n→ ');
    // Add blank line before each arrow line
    t = t.replace(/\n(→[^\n]+)/g, '\n\n$1');
    // Collapse more than 2 newlines
    t = t.replace(/\n{3,}/g, '\n\n');

    // Ensure first non-empty line is Unicode bold
    const lines = t.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) {
        if (!BOLD_RE.test(lines[i])) lines[i] = toUnicodeBold(lines[i]);
        // Add a blank line after hook
        if (lines[i + 1] && lines[i + 1].trim()) lines.splice(i + 1, 0, '');
        break;
      }
    }
    t = lines.join('\n').trim();

    // Ensure "Pourquoi ce post" is last and separated
    if (why) {
      t = t.replace(/\n{2,}$/g, '');
      t = `${t}\n\n${why}`;
    }
    return t.trim();
  }

  function sanitizeEmailModelArtifacts(text) {
    let t = String(text || '').replace(/\r\n/g, '\n');
    t = t.replace(/^\s*`{3,}[^\n]*$/gm, '');
    for (let i = 0; i < 4; i++) {
      let u = t.trim();
      if (!u) break;
      const before = u;
      if (/^`{3,}/.test(u)) {
        const nl = u.indexOf('\n');
        u = (nl === -1 ? '' : u.slice(nl + 1)).trim();
      }
      if (/`{3,}\s*$/.test(u)) {
        const li = u.lastIndexOf('\n');
        u = (li === -1 ? '' : u.slice(0, li)).trim();
      }
      t = u.replace(/\r\n/g, '\n');
      if (u === before) break;
    }
    t = t.replace(/^\s*`{3,}[^\n]*$/gm, '');
    t = t.replace(/^\s*\*{1,3}\s*$/gm, '');
    t = t.split('\n').map((line) => {
      const tr = line.trim();
      if (/^\*+(?:PS|P\.\s*S\.)\s*[:：]/i.test(tr) && /\*+\s*$/.test(tr)) {
        return line.replace(/^\s*\*+/, '').replace(/\*+\s*$/, '').trimEnd();
      }
      return line;
    }).join('\n');
    t = t.replace(/\*\*(\d{1,2}\.)\*\*/g, '$1');
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }

  function postProcessEmail(text) {
    if (!text) return text;
    let t = sanitizeEmailModelArtifacts(text);
    t = t.replace(/^#{1,6}\s+(.*)$/gm, '$1');
    t = t.replace(/^[-=*]{3,}\s*$/gm, '');
    const dblStarCount = (t.match(/\*\*/g) || []).length;
    if (dblStarCount % 2 !== 0) t = t.replace(/\*\*/g, '');
    let singleStarCount = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== '*') continue;
      if (t[i + 1] === '*') { i++; continue; }
      if (i > 0 && t[i - 1] === '*') continue;
      singleStarCount++;
    }
    if (singleStarCount % 2 !== 0) {
      t = t.split('').filter((c, i, arr) => {
        if (c !== '*') return true;
        if (arr[i + 1] === '*') return true;
        if (i > 0 && arr[i - 1] === '*') return true;
        return false;
      }).join('');
    }
    t = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
    // Ensure "Objet:" is on its own line and separated from "Bonjour"
    t = t.replace(/^(Objet\s*:[^\n]*)(\s+Bonjour)/i, '$1\n\nBonjour');
    // If "Objet:" appears later in the text, pull it to the top
    const objInline = t.match(/Objet\s*:[^\n]*/i);
    if (objInline && !/^\s*Objet\s*:/i.test(t)) {
      t = t.replace(objInline[0], '').trim();
      t = `${objInline[0]}\n\n${t}`;
    }
    // Remove bullets/arrows entirely (emails should read like natural sentences)
    t = t.replace(/^\s*[-*•▪]\s+/gm, '');
    // Remove common arrow bullets (→ ➜ ➔ ➤ ➡ ▶ ► ▸ ▹ »)
    t = t.replace(/\s*[→➜➔➤➡▶►▸▹»]\s*/g, '\n');
    // Force blank lines between key sections
    t = t.replace(/\b(Bonjour[^,\n]*,)/i, '$1\n');
    // Ensure sections are separated
    t = t.replace(/\b(Décisions\s*\/\s*points clés\s*:)/i, '\n\n$1');
    t = t.replace(/\b(Prochaines étapes\s*:)/i, '\n\n$1');
    t = t.replace(/\b(Cordialement,)/i, '\n\n$1');
    t = t.replace(/\n{3,}/g, '\n\n');

    // Add breathing room inside key sections (one item per paragraph)
    const spaceSection = (label) => {
      const re = new RegExp(`(${label}\\s*:)\\s*([\\s\\S]*?)(\\n\\n|\\n---\\n|\\nCordialement,|$)`, 'i');
      t = t.replace(re, (m, head, body, tail) => {
        const lines = String(body || '')
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean);
        if (!lines.length) return m;
        const spaced = lines.join('\n\n');
        return `${head}\n\n${spaced}${tail || ''}`;
      });
    };
    spaceSection('Décisions\\s*\\/\\s*points clés');
    spaceSection('Prochaines étapes');
    // Ensure "Objet :" is first line
    const lines = t.split('\n').filter(l => l.trim() !== '');
    const objIdx = lines.findIndex(l => /^objet\s*:/i.test(l.trim()));
    if (objIdx > 0) {
      const obj = lines.splice(objIdx, 1)[0];
      lines.unshift(obj, '');
    }
    t = lines.join('\n').trim();
    // Ensure a blank line after the subject
    t = t.replace(/^(Objet\s*:[^\n]*)(\n(?!\n))/i, '$1\n\n');

    // Ensure "Commentaire interne (non envoyé)" block exists and is separated
    const commentLabel = 'Commentaire interne :';
    const defaultComment = commentLabel + ' Si vous souhaitez un email qui suive la trame de vos échanges précédents, partagez-moi vos derniers emails : j’adapterai le ton, la logique et éviterai les répétitions. Comment faire : copiez-collez le texte de vos emails ou documents dans le chat (onglet Conversation), puis redemandez un email de suivi.';
    if (!/Commentaire interne\s*:\s*/i.test(t)) {
      t = t + '\n\n' + defaultComment;
    } else {
      t = t.replace(/\n\s*---\s*\n/g, '\n\n').replace(/\n*\s*Commentaire interne\s*\(non envoyé\)\s*:/gi, '\n\nCommentaire interne :').replace(/\n{3,}/g, '\n\n');
    }

    return t.trim();
  }

  function isPlainLike(text) {
    const t = String(text || '');
    const first = (t.trim().split('\n')[0] || '').trim();
    return /^Objet\s*:/i.test(t) || /Pourquoi ce post\s*:/i.test(t) || (BOLD_RE.test(first) && !/[#*_]{1,}/.test(first));
  }

  /** Extrait sujet + corps (sans commentaire interne) pour mailto / Gmail. */
  function parseEmailForCompose(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').trim();
    const split = raw.split(AGILO_EMAIL_COMMENT_SPLIT);
    const emailPart = (split[0] || raw).trim();
    const lines = emailPart.split('\n');
    let subject = '';
    const bodyLines = [];
    const objRegex = /^\s*#*\s*Objet\s*:\s*/i;
    for (const line of lines) {
      const trimmed = line.trim();
      if (objRegex.test(trimmed)) {
        subject = trimmed.replace(objRegex, '').trim();
      } else {
        bodyLines.push(line);
      }
    }
    const body = bodyLines.join('\n').trim();
    return { subject, body };
  }

  function formatEmailCopyPayload(text) {
    const parsed = parseEmailForCompose(text);
    const subject = String(parsed.subject || '').trim();
    const body = String(parsed.body || '').trim();
    if (subject && body) return `Objet : ${subject}\n\n${body}`;
    return body || String(text || '').trim();
  }

  function styleToBullets(style, lang) {
    const L = (fr, en) => lang === 'en' ? en : fr;
    const toneLabel = {
      'neutre-executif': L('ton neutre et exécutif', 'neutral, executive tone'),
      'executif': L('ton exécutif orienté décision', 'executive, decision-focused tone'),
      'operatif': L('ton opérationnel', 'operational tone'),
      'pragmatique': L('ton pragmatique', 'pragmatic tone'),
      'clair-pedago': L('ton clair et pédagogique', 'clear, instructional tone'),
      'pedagogique': L('ton pédagogique', 'educational tone'),
      'sales': L('ton commercial léger', 'light sales tone'),
      'formel': L('ton formel', 'formal tone')
    }[style.tone] || L('ton neutre et professionnel', 'neutral, professional tone');

    return [
      L('Préférences de style :', 'Style preferences:'),
      `- ${toneLabel}`,
      `- ${L('Densité', 'Density')}: ${style.density}`,
      `- ${L('Sections attendues', 'Expected sections')}: ${style.sections.join(' • ')}`
    ].join('\n');
  }

  /* ================== PROMPT (question libre) ================== */
  async function buildPrompt(question, intentHint = null) {
    const lang = detectLang(question);
    const turns = [];
    for (let i = MESSAGES.length - 1; i >= 0 && turns.length < MAX_HISTORY_TURNS * 2; i--) {
      const m = MESSAGES[i];
      if (m.role === 'system') continue;
      turns.push(`${m.role === 'user' ? (lang === 'en' ? 'User' : 'Utilisateur') : 'Assistant'}: ${m.text}`);
    }
    turns.reverse();

    const persona = getPersona();
    const useCase = getUseCase();
    const jobId = ACTIVE_JOB || getJobId();
    const style = computeStyle(persona, useCase, lang);


    // --- SPECIALIZED PROMPT: LINKEDIN STRATEGY ---
    const intent = resolveIntent(question, intentHint);
    if (intent === 'linkedin') {
      const ctx = await getUserContextForPrompt();

      const contextLines = [
        `- Nom : ${ctx.fullName}`,
        `- Persona : ${ctx.userJob}`,
        `- Cas d'usage : ${ctx.userUseCase}`
      ];
      if (ctx.linkedinUrl) contextLines.push(`- Profil LinkedIn : ${ctx.linkedinUrl} (utilise pour le ton et le positionnement, ne pas copier dans le post)`);

      const linkedInSys = [
        `Vous êtes un stratège de contenu LinkedIn expert.`,
        `Votre mission : Rédiger un post LinkedIn court et prêt à publier pour ${ctx.fullName} (${ctx.userJob}).`,
        `Langue : utilisez la langue du transcript ; si elle est indéterminable, utilisez la langue de la demande.`,
        ``,
        `### RÈGLE PUBLIABLE (OBLIGATOIRE) :`,
        `Le post doit être publiable sur LinkedIn. Ne jamais dévoiler d'informations internes, confidentielles ou réservées à un cadre privé (réunions internes, noms de partenaires non publics, stratégies non divulguées, etc.). Utiliser uniquement ce qui peut être partagé publiquement.`,
        ``,
        `### VALORISATION :`,
        `À partir des échanges (transcript), dégagez les idées, projets ou points forts que l'utilisateur peut partager publiquement, et rédigez un post qui le met en valeur (expertise, vision, actions, résultats) sans révéler d'éléments internes.`,
        ``,
        `### RÈGLES DE FORMATAGE (CRITIQUES) :`,
        `1. **RÉPONSE DIRECTE UNIQUEMENT** : Commencez directement par l'accroche. Aucun texte d'introduction.`,
        `2. **HOOK EN GRAS UNICODE UNIQUEMENT** : La 1ère ligne doit être en gras Unicode (ex: "𝐄̂𝐭𝐫𝐞 𝐩𝐞𝐫𝐟𝐨𝐫𝐦𝐚𝐧𝐭"). Interdiction de markdown. Aucun autre gras ailleurs.`,
        `3. **AUCUN MARKDOWN** : Pas de titres (#), pas d'italique, pas de listes, pas de puces, pas de numérotation.`,
        `4. **POINTS CLÉS AVEC FLÈCHES** : Un point = UNE LIGNE qui commence par "→ ". Jamais d'icône. Toujours une ligne vide entre chaque flèche.`,
        `5. **FORMAT "EN ESCALIER"** : 3 à 5 paragraphes très courts, une idée par ligne. Toujours une ligne vide entre paragraphes.`,
        `6. **LONGUEUR COURTE** : Max ~900 caractères.`,
        `7. **EMOJIS** : Aucun emoji.`,
        `8. **TON** : Conversationnel, authentique, pro.`,
        `9. **SORTIE** : Donnez uniquement le post final, puis une seule ligne courte : "Pourquoi ce post : ..."`,
        ``,
        `### CONTEXTE UTILISATEUR (Memberstack) :`,
        ...contextLines,
        ``,
        `Identifiez l'angle le plus pertinent à partir du transcript.`,
        `N'inventez aucun nom de marque/entreprise/personne ; n'utilisez que ce qui est dans le transcript.`,
        `N'évoquez jamais Agilotext, BauerWebPro, ou tout autre produit/marque si ce n'est pas explicitement cité dans le transcript.`,
        `Adaptez le ton à la persona "${ctx.userJob}" et au cas d'usage "${ctx.userUseCase}".`
      ];

      return [
        linkedInSys.join('\n'),
        turns.length ? `### CONTEXTE (conversation) :\n${turns.map(t => t.replace(/^(User|Assistant|Utilisateur):/, '')).join('\n')}` : '',
        `### DEMANDE UTILISATEUR :\n${question}`
      ].join('\n\n');
    }

    // --- SPECIALIZED PROMPT: EXECUTIVE EMAIL AGENT ---
    if (intent === 'email') {
      const ctx = await getUserContextForPrompt();

      const emailSys = [
        `Vous êtes un expert en relation client et vente consultative. Vous rédigez des emails de suivi factuels, sans erreur d'identité.`,
        ``,
        `### RÔLES (NE PAS INVERSER) :`,
        `- **Expéditeur de l'email** : toujours **${ctx.fullName}** (compte Agilotext). C'est la personne qui envoie ; sa signature en fin d'email est **exactement** : ${ctx.fullName}.`,
        `- **Destinataire(s) de l'email** : la ou les **autre(s) partie(s)** de la conversation dans le transcript (client, prospect, partenaire, candidat, collègues en réunion interne, etc.). Ce n'est **pas** ${ctx.firstName} dans le cas d'un suivi classique après appel ou réunion avec un tiers.`,
        `- La ligne « Bonjour …, » s'adresse au **destinataire**, pas à l'expéditeur. **Interdiction** d'utiliser le prénom profil « ${ctx.firstName} » dans « Bonjour » sauf si le transcript montre clairement un **email interne** ou un message que ${ctx.fullName} s'adresse à lui-même / à sa propre équipe dans un contexte où il serait le lecteur principal (cas rare ; par défaut : non).`,
        ``,
        `### COMMENT CHOISIR LE DESTINATAIRE DU « BONJOUR » :`,
        `1. Si une personne **se présente** dans le transcript (« je suis X », prénom donné en direct), ce prénom/nom est **prioritaire** sur toute étiquette de locuteur (Speaker A, etc.) qui contredirait cette présentation.`,
        `2. Si le transcript mélange **étiquette automatique** et **contenu incohérent** (ex. une personne dit son identité réelle mais l'étiquette affiche un autre nom), **ignorez l'étiquette** ; ne reprenez **jamais** un nom de personne qui contredit ce qui est dit dans le dialogue.`,
        `3. Réunion **uniquement interne** (équipe / société) : le destinataire est le **groupe** (« Bonjour à toutes et à tous, ») ou une **personne nommée explicitement** dans le transcript ; mêmes règles : pas de prénom inventé, pas d'étiquette Speaker comme formule d'appel.`,
        `4. En réunion **commerciale / prestation** avec un tiers : le destinataire du suivi est souvent celui qui **exprime le besoin, pose des questions d'achat, valide des jalons** ; l'expéditeur est souvent celui qui **présente l'offre, propose des dates, confirme une livraison**. Si doute raisonnable, préférez une formule **neutre** : « Bonjour, » ou « Bonjour Madame, Bonjour Monsieur, » plutôt qu'un prénom inventé ou tiré d'une étiquette douteuse.`,
        `5. **Plusieurs** interlocuteurs côté client : « Bonjour à toutes et à tous, » ou « Bonjour [prénom de la personne la plus centrale dans l'échange], » uniquement si ce prénom est **clair** dans le transcript.`,
        `6. **Aucun** prénom fiable : « Bonjour, » uniquement — **ne pas inventer** de prénom.`,
        `7. N'utilisez jamais « Speaker 1 », « Locuteur A », ni jargon technique comme formule d'appel.`,
        ``,
        `### CONTEXTE MEMBERSTACK (référence expéditeur — ne pas confondre avec le destinataire) :`,
        `- Signature : ${ctx.fullName}`,
        `- Persona : ${ctx.userJob} ; cas d'usage : ${ctx.userUseCase} (adapter le ton, pas les identités).`,
        ``,
        `### FIABILITÉ (ZÉRO INVENTION) :`,
        `- N'inventez **aucun** prénom, nom de personne, entreprise, chiffre, date ou engagement qui ne figure pas explicitement dans le transcript (ou le fil de conversation ci-dessous s'il apporte des faits).`,
        `- Si une information manque pour un sujet sensible, formulez prudemment (« comme évoqué », « pour le point dont nous avons parlé ») sans combler par hypothèse.`,
        `- N'évoquez pas Agilotext, BauerWebPro, ni outil d'enregistrement / transcription, sauf si c'est **dit mot pour mot** dans le transcript.`,
        ``,
        `### STYLE ET FORMAT :`,
        `- Langue : celle du transcript ; si flou, celle de la demande.`,
        `- Commencez la sortie **directement** par la ligne « Objet : … » (rien avant).`,
        `- Pas de « J'espère que vous allez bien » ni équivalents creux.`,
        `- Zéro emoji. Aucun markdown dans la sortie (pas de croisillon titre, pas de gras en astérisques, pas de liste à puces avec tiret en début de ligne, pas de lignes \`\`\`). Phrases et retours à la ligne simples.`,
        `- Post-scriptum : « PS : … » ou « P.S. : … » en texte brut, sans astérisques autour de la ligne.`,
        `- Une **ligne vide** entre paragraphes et entre sections (après Bonjour, avant Prochaines étapes, avant Cordialement).`,
        `- Email **court**, **crédible**, **actionnable**, ancré dans le transcript (pas de modèle générique vide).`,
        ``,
        `### STRUCTURE OBLIGATOIRE DE LA SORTIE :`,
        `Objet : [sujet précis, aligné sur le transcript]`,
        ``,
        `Bonjour [prénom du destinataire OU formule neutre selon règles ci-dessus],`,
        ``,
        `[1–2 lignes de rappel factuel de l'échange]`,
        ``,
        `Décisions / points clés :`,
        `[ligne courte]`,
        `[ligne courte]`,
        ``,
        `Prochaines étapes :`,
        `[action 1]`,
        `[action 2]`,
        ``,
        `Cordialement,`,
        `${ctx.fullName}`,
        ``,
        `Commentaire interne : Si vous souhaitez un email qui suive la trame de vos échanges précédents, partagez-moi vos derniers emails : j’adapterai le ton, la logique et éviterai les répétitions. Comment faire : copiez-collez le texte de vos emails ou documents dans le chat (onglet Conversation), puis redemandez un email de suivi.`
      ];

      return [
        emailSys.join('\n'),
        turns.length ? `### CONTEXTE (conversation) :\n${turns.map(t => t.replace(/^(User|Assistant|Utilisateur):/, '')).join('\n')}` : '',
        `### DEMANDE UTILISATEUR :\n${question}`
      ].join('\n\n');
    }

    // --- STANDARD PROMPT ---
    const sys = (lang === 'en') ? [
      `Role: transcript assistant.`,
      `Context: jobId=${jobId || 'unknown'}; persona=${persona || 'n/a'}; use_case=${useCase || 'n/a'}.`,
      `Rules:`,
      `- Answer in the user's language (${lang}).`,
      `- Think internally first, then output only the final answer.`,
      `- Base answers strictly on the current transcript. No unsupported claims.`,
      `- When helpful, include short quotes with timecodes [HH:MM:SS].`,
      `- If info is missing from the transcript, say so and suggest a clarification.`,
      `- If the question is ambiguous, ask 1 clarifying question.`,
      `- Use light markdown (headings, lists).`,
      styleToBullets(style, 'en')
    ] : [
      `Rôle : assistant spécialisé transcript.`,
      `Contexte : jobId=${jobId || 'inconnu'} ; persona=${persona || 'n/a'} ; use_case=${useCase || 'n/a'}.`,
      `Règles :`,
      `- Réponds dans la langue de la question (${lang}).`,
      `- Analyse d'abord en interne, puis donne uniquement la réponse finale.`,
      `- Appuie-toi strictement sur le transcript courant (pas d'affirmations non sourcées).`,
      `- Quand c'est utile, cite de courts extraits avec timecodes [HH:MM:SS].`,
      `- Si l'information manque, dis-le et propose une précision.`,
      `- Si la question est ambiguë, pose 1 question de clarification.`,
      `- Utilise un markdown léger (titres, listes).`,
      styleToBullets(style, 'fr')
    ];

    return [
      sys.join('\n'),
      turns.length ? ((lang === 'en') ? 'Context' : 'Contexte') + ':\n' + turns.join('\n') : '',
      ((lang === 'en') ? 'Question' : 'Question') + ':\n' + question
    ].filter(Boolean).join('\n\n');
  }

  /* ================== API helpers ================== */
  const enc = (o) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) p.set(k, v == null ? '' : String(v)); return p; };

  async function rePromptSubmit(args) {
    const url = `${API_BASE}/rePromptTranscript`;
    const { prompt, attachmentIds, ...rest } = args;
    const payload = { ...rest, promptContent: prompt };
    if (attachmentIds) payload.attachmentIds = String(attachmentIds);
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: enc(payload) });

    const text = await resp.text(); let j = null; try { j = JSON.parse(text); } catch { }
    if (resp.status === 405 && !API_BASE.includes('api.agilotext.com')) {
      warn('405 sur', url, '→ retry sur api.agilotext.com');
      const alt = 'https://api.agilotext.com/api/v1';
      const payload2 = { ...rest, promptContent: prompt };
      if (attachmentIds) payload2.attachmentIds = String(attachmentIds);
      const r2 = await fetch(`${alt}/rePromptTranscript`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: enc(payload2)
      });
      const t2 = await r2.text(); let j2 = null; try { j2 = JSON.parse(t2); } catch { }
      if (!r2.ok || j2?.status !== 'OK') throw new Error(j2?.errorMessage || `rePromptTranscript HTTP ${r2.status}`);
      return;
    }
    if (!resp.ok || j?.status !== 'OK') {
      const msg = (j?.errorMessage || text || '').toString();
      if (/duplicate key|job_reprompt_pkey|already exists/i.test(msg)) { warn('reprompt déjà en cours → poll'); return; }
      throw new Error(j?.errorMessage || `rePromptTranscript HTTP ${resp.status}`);
    }
  }



  async function rePromptPoll({ username, token, edition, jobId, onTick }) {
    const t0 = Date.now(); let cycle = 0;
    while (Date.now() - t0 < POLL_TIMEOUT_MS) {
      cycle++;
      const r = await fetch(`${API_BASE}/getRePromptStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: enc({ username, token, jobId, edition }),
        cache: 'no-store', mode: 'cors', credentials: 'omit'
      });
      const j = await r.json().catch(() => ({}));
      const statusField = j.rePromptStatus ?? j.repromptStatus ?? j.repromptstatus;
      log(`getRePromptStatus #${cycle}`, r.status, '-> status =', statusField);
      if (cycle % 3 === 0 && typeof onTick === 'function') onTick(cycle);
      if (j.status === 'OK') {
        if (statusField === 'READY') return 'READY';
        if (statusField === 'ON_ERROR') throw new Error(j.javaException || j.userErrorMessage || 'RePrompt ON_ERROR');
        if (statusField === 'UNKNOWN') throw new Error('Job ID inconnu (UNKNOWN)');
      }
      await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
    }
    throw new Error('Délai dépassé (timeout).');
  }

  async function rePromptReceive({ username, token, edition, jobId }) {
    for (let i = 0; i < RECEIVE_RETRIES; i++) {
      const r = await fetch(`${API_BASE}/receiveRepromptText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: enc({ username, token, jobId, edition, format: 'txt' }),
        cache: 'no-store', mode: 'cors', credentials: 'omit'
      });
      const text = await r.text();
      log('receiveRepromptText try', i + 1, 'http=', r.status, 'len=', text?.length);
      try {
        const j = JSON.parse(text);
        if (j?.status === 'KO') {
          if (/not_ready|file_not_exists/i.test(j.errorMessage || '')) {
            await new Promise(res => setTimeout(res, RECEIVE_RETRY_DELAY));
            continue;
          }
          throw new Error(j.errorMessage || 'KO');
        }
      } catch { return text; }
    }
    throw new Error('Résultat encore indisponible (réessaie).');
  }

  // === Détection "invalid token" + run avec réauth 1 fois ===
  function isInvalidTokenMessage(s = '') {
    return /invalid[_-]?token/i.test(String(s)) || /error[_-]?invalid[_-]?token/i.test(String(s));
  }
  async function runChatFlowOnce(auth, jobId, prompt, onTick, attachmentIds = '') {
    await rePromptSubmit({ ...auth, jobId, prompt, attachmentIds });
    await rePromptPoll({ ...auth, jobId, onTick });
    const answer = await rePromptReceive({ ...auth, jobId });
    return (answer || '').trim();
  }
  async function runChatFlowWithReauth(jobId, prompt, onTick, attachmentIds = '') {
    let auth = await resolveAuth();
    try {
      return await runChatFlowOnce(auth, jobId, prompt, onTick, attachmentIds);
    } catch (e) {
      if (isInvalidTokenMessage(e?.message)) {
        const fresh = await ensureToken(auth.username, auth.edition);
        if (fresh && fresh !== auth.token) {
          auth.token = fresh;
          try { localStorage.setItem(tokenKey(auth.username, auth.edition), fresh); } catch { }
          return await runChatFlowOnce(auth, jobId, prompt, onTick, attachmentIds);
        }
      }
      throw e;
    }
  }

  function resolveIntentHintForQuestion(q, intentHintPassed) {
    if (intentHintPassed === 'linkedin' || intentHintPassed === 'email') return intentHintPassed;
    const lastIntent = getLastIntent();
    let intentHint = null;
    if (lastIntent === 'email' && !isExplicitLinkedIn(q)) {
      /* Relances courtes dans un contexte e-mail : "oui", "raccourcis", "plus formel", etc. */
      const isShortFollowUp = q.length < 120;
      const isEmailRelance = /^(oui|ok|non|voici|ci[-\s]?dessous|voilà|super|parfait|modifi|raccourci|plus\s+(court|long|formel|simple|direct)|enlève|ajoute|change|remplace|refais|reformule|send|envoie)/i.test(q.trim());
      if (isShortFollowUp && isEmailRelance) intentHint = 'email';
      if (looksLikeEmailThread(q)) intentHint = 'email';
    }
    if (isExplicitLinkedIn(q)) intentHint = 'linkedin';
    if (isExplicitEmail(q)) intentHint = 'email';
    return intentHint;
  }

  /* ================== ENVOI (question libre) ================== */
  async function handleAsk() {
    const jobId = refreshActiveJobId();
    const cp = activeChatPrompt();
    const q = (cp?.value || '').trim();
    if (!q) { cp?.focus(); return; }
    if (__dictationActive) { toast('Arrêtez la dictée avant d’envoyer', 'info'); return; }

    const intentHint = resolveIntentHintForQuestion(q, null);

    if (SENDING.has(jobId)) {
      enqueueAsk(jobId, q, intentHint);
      toast('Message en file d’attente', 'success');
      if (cp) {
        cp.value = '';
        autosizeChatPrompt(cp);
        updatePromptCounter(cp);
      }
      refreshSendReadyState();
      updateQueueBadge(jobId);
      return;
    }
    await handleAskExecute(jobId, q, intentHint);
  }

  async function handleAskExecute(jobId, qRaw, intentHint) {
    const q = String(qRaw || '').replace(/\n\n\(📎[\s\S]*\)\s*$/m, '').trim();
    const intentResolved = resolveIntentHintForQuestion(q, intentHint);

    SENDING.add(jobId);
    if (jobId === ACTIVE_JOB) setBusy(true);

    const mode = (Array.isArray(MESSAGES) && MESSAGES.some(m => m.role === 'assistant')) ? 'conversation' : 'quick';
    const gate = window.AgiloQuota?.canSendChat({ mode }) || { ok: true };
    if (!gate.ok) {
      toast(gate.reason || 'Quota atteint', 'error');
      if (/plan|Pro|Business/i.test(gate.reason || '')) window.AgiloGate?.showUpgrade('pro');
      releaseSend(jobId);
      drainAskQueue(jobId);
      return;
    }

    const auth = await resolveAuth();
    if (!auth.username || !auth.token) { toast('Authentification manquante', 'error'); releaseSend(jobId); drainAskQueue(jobId); return; }
    if (!jobId) { toast('Aucun enregistrement ouvert. Ouvrez un job puis réessayez.', 'error'); releaseSend(jobId); drainAskQueue(jobId); return; }

    const attachNames = PENDING_FILES.map(f => f.name);
    const uploadRes = await uploadPendingAttachments(auth, jobId);
    const attachmentIds = (uploadRes.ok && uploadRes.attachmentIds) ? String(uploadRes.attachmentIds) : '';
    let qForPrompt = q;
    if (attachNames.length && !attachmentIds) {
      qForPrompt = `[Contexte — pièces jointes (noms) : ${attachNames.join(', ')}]\n\n${q}`;
    } else if (attachmentIds) {
      qForPrompt = `[Contexte — pièces jointes référencées côté serveur : ${attachmentIds}]\n\n${q}`;
    }
    PENDING_FILES.length = 0;
    renderAttachmentsList();

    const userDisplay = q + (attachNames.length ? `\n\n(📎 ${attachNames.join(', ')})` : '');
    pushMsg(jobId, { role: 'user', text: userDisplay, t: new Date().toISOString(), id: mkRunId() });
    const runId = mkRunId();
    const initialPlaceholder = intentResolved === 'linkedin' ? LINKEDIN_THINKING_MSG : 'Assistant réfléchit...';
    pushMsg(jobId, { role: 'assistant', id: runId, text: initialPlaceholder, t: new Date().toISOString() });
    {
      const _cp = activeChatPrompt();
      if (_cp) {
        _cp.value = '';
        autosizeChatPrompt(_cp);
        updatePromptCounter(_cp);
      }
      refreshSendReadyState();
    }
    /* Scroller immédiatement en bas : l'utilisateur voit sa bulle + le thinking */
    scrollChatToBottom('instant');

    try {
      const prompt = await buildPrompt(qForPrompt, intentResolved);
      const thinkingMsg = intentResolved === 'linkedin' ? LINKEDIN_THINKING_MSG : null;
      let txt = await runChatFlowWithReauth(jobId, prompt, (cycle) => updateThinking(jobId, runId, Math.floor(cycle / 3), thinkingMsg), attachmentIds);
      const intentUsed = resolveIntent(q, intentResolved);
      if (intentUsed === 'linkedin') txt = postProcessLinkedIn(txt);
      else if (intentUsed === 'email') txt = postProcessEmail(txt);
      const renderMode = (intentUsed === 'linkedin' || intentUsed === 'email') ? 'plain' : 'md';
      if (intentUsed) setLastIntent(intentUsed);
      replaceMsgById(jobId, runId, txt || '(réponse vide)', { render: renderMode });
      window.AgiloQuota?.afterChatSuccess?.();
    } catch (e) {
      err('flow failed', e);
      replaceMsgById(jobId, runId, `Échec de la requête.\n\nErreur: ${e.message}`);
      toast('Erreur: ' + (e.message || 'échec'), 'error');
    } finally {
      setBusyFor(jobId, false);
      drainAskQueue(jobId);
    }
  }


  /* ================== ENVOI (PROMPT CACHÉ POUR INSIGHTS) ================== */
  async function handleHiddenAsk(label, hiddenPrompt) {
    // Ouvre l'onglet Conversation automatiquement
    try { openConversation(); } catch { }
    const jobId = refreshActiveJobId();
    if (SENDING.has(jobId)) {
      toast('Une requête est déjà en cours — réessayez dans un instant', 'info');
      return;
    }
    SENDING.add(jobId);
    if (jobId === ACTIVE_JOB) setBusy(true);

    const auth = await resolveAuth();
    if (!auth.username || !auth.token) { toast('Authentification manquante', 'error'); releaseSend(jobId); return; }
    if (!jobId) { toast('Aucun enregistrement ouvert. Ouvrez un job puis réessayez.', 'error'); releaseSend(jobId); return; }

    const shortLabel = (label || 'Demande envoyée').trim();

    // 1) bulle utilisateur (sans afficher le gros prompt)
    pushMsg(jobId, { role: 'user', text: shortLabel + ' …', t: new Date().toISOString() });

    // 2) placeholder assistant
    const runId = mkRunId();
    const lbl = String(label || '').toLowerCase();
    const isLi = lbl.includes('linkedin');
    const isMail = (lbl.includes('email') || lbl.includes('mail') || lbl.includes('courriel'));
    const initialPlaceholder = isLi ? LINKEDIN_THINKING_MSG : 'Assistant réfléchit...';
    pushMsg(jobId, { role: 'assistant', id: runId, text: initialPlaceholder, t: new Date().toISOString() });

    try {
      let prompt = String(hiddenPrompt || '').trim();
      if (isLi) { prompt = await buildPrompt('Post LinkedIn', 'linkedin'); setLastIntent('linkedin'); }
      else if (isMail) { prompt = await buildPrompt('Email suivi', 'email'); setLastIntent('email'); }
      if (!prompt) throw new Error('prompt vide');

      const thinkingMessage = isLi ? LINKEDIN_THINKING_MSG : null;
      let txt = await runChatFlowWithReauth(jobId, prompt, (cycle) => updateThinking(jobId, runId, Math.floor(cycle / 3), thinkingMessage));
      if (isLi) txt = postProcessLinkedIn(txt);
      else if (isMail) txt = postProcessEmail(txt);
      const renderMode = (isLi || isMail) ? 'plain' : 'md';
      replaceMsgById(jobId, runId, txt || '(réponse vide)', { render: renderMode });
      toast('Insight prêt', 'success');
    } catch (e) {
      err('hiddenAsk failed', e);
      replaceMsgById(jobId, runId, `Échec de la requête.\n\nErreur: ${e.message}`);
      toast('Erreur: ' + (e.message || 'échec'), 'error');
    } finally {
      setBusyFor(jobId, false);
      drainAskQueue(jobId);
    }
  }

  /* ================== NAV CHAT (ouvrir panneau) ================== */
  function openConversation() {
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
      try { byId('chatPrompt')?.focus({ preventScroll: true }); } catch { }
    }, 0);
  }



  /* ================== WIRING ================== */
  loadHistory();
  render();
  ensureChatChrome();

  /** D’autres scripts (auth, rail, orchestre) peuvent ne poser le jobId (URL, dataset, currentJobId) qu’après DOMContentLoaded. Sans ce rattrapage, l’historique se lit sous `agilo:chat:nojob` et paraît vide. */
  function resyncActiveJobIfChanged() {
    const was = ACTIVE_JOB;
    const id = refreshActiveJobId();
    if (id && id !== was) {
      loadHistory();
      render();
      ensureChatChrome();
      updateQueueBadge(id);
    }
  }
  [0, 100, 400, 1200].forEach((ms) => { setTimeout(resyncActiveJobIfChanged, ms); });

  /* Si un autre script modifie #chatView après nous (ex. opentech), on reprend la main */
  setTimeout(() => {
    if (!chatView) return;
    const hasEmailBlock = chatView.querySelector('.agilo-email-block');
    const hasClassicBubbleWithObjet = chatView.querySelector('.msg-bubble:not(.msg-bubble--email)') && /Objet\s*:/i.test(chatView.textContent || '');
    if (!hasEmailBlock && hasClassicBubbleWithObjet && MESSAGES.some(m => m.role === 'assistant' && /Objet\s*:\s*\S/i.test(String(m.text || '').slice(0, 600)))) {
      render();
    }
  }, 200);

  btnAsk?.addEventListener('click', (e) => { e.preventDefault(); handleAsk(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#chat-send-btn')) { e.preventDefault(); handleAsk(); }
    /* Bouton PJ — cliquable mais fonctionnellement bloqué : toast informatif */
    if (e.target.closest('#chat-attach-btn')) {
      e.preventDefault();
      toast('Pièces jointes — bientôt disponibles. Vous pourrez attacher des PDF, images et autres documents.', 'info');
    }
  });
  form?.addEventListener('submit', (e) => { e.preventDefault(); handleAsk(); });
  form?.addEventListener('keydown', (e) => {
    if (e.target?.id !== 'chatPrompt') return;
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (__dictationActive) { e.preventDefault(); return; }
    e.preventDefault();
    handleAsk();
  });

  window.addEventListener('agilo:load', (ev) => {
    const newId = (ev.detail?.jobId ?? ev.detail ?? '').toString().trim();
    if (!newId || newId === ACTIVE_JOB) return;
    ACTIVE_JOB = newId;
    loadHistory(); render();
    ensureChatChrome();
    updateQueueBadge(newId);
  });

  window.addEventListener('popstate', () => {
    const j = getJobId();
    if (j !== ACTIVE_JOB) {
      ACTIVE_JOB = j;
      loadHistory(); render();
      ensureChatChrome();
      updateQueueBadge(j);
    }
  });

  /* ================== API PUBLIQUE ================== */
  window.AgiloChat = {
    ask: () => handleAsk(),
    hiddenAsk: (label, prompt) => handleHiddenAsk(label, prompt), // ← pour Insights
    openConversation,

    creds: () => resolveAuth(),
    getJobId: () => (ACTIVE_JOB || getJobId()),
    export: (msgIdx, fmt) => exportMessage(msgIdx, fmt),
    copy: async (msgIdx) => {
      if (MESSAGES[msgIdx]) {
        const success = await copyToClipboard(MESSAGES[msgIdx].text);
        toast(success ? 'Copié' : 'Échec copie', success ? 'success' : 'error');
      }
    },
    clear: () => {
      if (confirm('Effacer tout l\'historique du chat ? ')) {
        localStorage.removeItem(LSKEY()); MESSAGES = []; render();
        toast('Historique effacé', 'success');
      }
    },
    toast,
    // petit utilitaire de debug
    debugAuth: async () => {
      const a = await resolveAuth();
      console.log('[auth]', {
        edition: a.edition,
        username: a.username,
        token: a.token ? a.token.slice(0, 6) + '…' + a.token.slice(-4) : '(none)'
      });
    }
  };

  log('ready. API_BASE=', API_BASE, 'jobId=', ACTIVE_JOB);
});
