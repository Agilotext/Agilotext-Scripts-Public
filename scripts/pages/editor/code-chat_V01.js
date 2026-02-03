// Agilotext - Chat IA
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-chat dans Webflow

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

  /* ================== DOM ================== */
  const $ = (s, r = document) => r.querySelector(s);
  const byId = (id) => document.getElementById(id);
  const chatView = byId('chatView');
  const form = byId('wf-form-chat');
  const input = byId('chatPrompt');
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
  function getJobId() {
    return $('#pane-chat')?.dataset.jobid
      || new URLSearchParams(location.search).get('jobId')
      || byId('editorRoot')?.dataset?.jobId
      || byId('agilo-audio-wrap')?.dataset?.jobId
      || $('[name="jobId"]')?.value
      || '';
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

  function loadHistory() {
    try { MESSAGES = JSON.parse(localStorage.getItem(LSKEY()) || '[]') || []; } catch { MESSAGES = []; }
    if (!MESSAGES.length) {
      MESSAGES.push({
        role: 'system', text: 'Bienvenue dans l\'assistant IA. Posez vos questions sur le transcript.', t: new Date().toISOString()
      });
    }
  }
  function saveHistory() { try { localStorage.setItem(LSKEY(), JSON.stringify(MESSAGES)); } catch { } }

  function render() {
    if (!chatView) return;
    chatView.innerHTML = '';
    MESSAGES.forEach((m, idx) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = m.role === 'user' ? 'msg msg--user' : (m.role === 'assistant' ? 'msg msg--ai' : 'msg msg--sys');
      msgDiv.lang = 'fr';

      const metaDiv = document.createElement('div');
      metaDiv.className = 'msg-meta';
      const roleName = m.role === 'user' ? 'Vous' : (m.role === 'assistant' ? 'Assistant' : 'Info');
      metaDiv.textContent = `${roleName} • ${nowHHMM()}`;

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'msg-bubble';

      if (m.role === 'assistant') {
        bubbleDiv.innerHTML = mdToHtml(m.text);
        bubbleDiv.style.cssText = 'white-space:normal;line-height:1.6';
        if (m.text.includes('thinking-indicator') || m.text.includes('Assistant réfléchit')) {
          // C'est un message "thinking" - ne pas ajouter les boutons d'action
          bubbleDiv.innerHTML = m.text; // Garder le HTML tel quel
        } else if (!m.text.includes('réfléchit') && !m.text.includes('⚠️') && m.text.length > 10) {
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'msg-actions';
          actionsDiv.style.cssText = 'display:flex;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.08);flex-wrap:wrap';

          const copyBtn = document.createElement('button');
          copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/></svg> Copier';
          copyBtn.className = 'msg-action-btn msg-action-copy';
          copyBtn.onclick = async () => {
            const success = await copyToClipboard(m.text);
            if (success) {
              copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg> Copié !';
              copyBtn.style.background = '#10b981';
              copyBtn.style.color = '#fff';
              copyBtn.style.borderColor = '#10b981';
              setTimeout(() => {
                copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/></svg> Copier';
                copyBtn.style.background = '#fff';
                copyBtn.style.color = '#525252';
                copyBtn.style.borderColor = 'rgba(0,0,0,0.15)';
              }, 2000);
              toast('Copié dans le presse-papier', 'success');
            } else {
              toast('Échec de la copie', 'error');
            }
          };
          actionsDiv.appendChild(copyBtn);

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

          bubbleDiv.appendChild(actionsDiv);

          // === WOW FEATURE: SMART CHIPS (Last message only) ===
          if (idx === MESSAGES.length - 1) {
            const chipsDiv = document.createElement('div');
            chipsDiv.className = 'msg-chips';
            chipsDiv.style.cssText = 'display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;';

            const prevQuestion = (MESSAGES[idx - 1]?.role === 'user' ? MESSAGES[idx - 1].text : '').toLowerCase();
            const suggestions = [];

            // 1. Logique "Chain of Thought" (Lien entre agents)
            if (prevQuestion.includes('linkedin') || prevQuestion.includes('post')) {
              suggestions.push({ label: '📧 Convertir en Email', prompt: 'Transforme ce post en un email de suivi court et pro pour mes équipes.' });
            } else if (prevQuestion.includes('email') || prevQuestion.includes('mail')) {
              suggestions.push({ label: '📝 Extraire les tâches', prompt: 'Liste uniquement les tâches, les responsables et les deadlines sous forme de tableau.' });
            }

            // 2. Toujours proposer Traduction et Résumé si pertinent
            if (!prevQuestion.includes('translate') && !prevQuestion.includes('anglais')) {
              suggestions.push({ label: '🇬🇧 Translate to EN', prompt: 'Translate this response to English (Business tone).' });
            }
            if (m.text.length > 500 && !prevQuestion.includes('résumé')) {
              suggestions.push({ label: '✂️ Résumer', prompt: 'Fais-moi un résumé ultra-court (3 bullet points) de ça.' });
            }

            suggestions.forEach(s => {
              const chip = document.createElement('button');
              chip.textContent = s.label;
              // Style "Chip" moderne et cliquable
              chip.style.cssText = 'font-size:11px;font-weight:500;padding:4px 12px;border-radius:16px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:4px;box-shadow:0 1px 2px rgba(0,0,0,0.02)';

              chip.onmouseenter = () => { chip.style.background = '#eff6ff'; chip.style.color = '#2563eb'; chip.style.borderColor = '#dbeafe'; };
              chip.onmouseleave = () => { chip.style.background = '#f8fafc'; chip.style.color = '#475569'; chip.style.borderColor = '#e2e8f0'; };

              chip.onclick = () => {
                // Feedback visuel immédiat
                chip.style.transform = 'scale(0.95)';
                setTimeout(() => chip.style.transform = 'scale(1)', 100);
                // Appel de l'IA via hiddenAsk (titre chip, prompt chip)
                window.AgiloChat.hiddenAsk(s.label, s.prompt);
              };
              chipsDiv.appendChild(chip);
            });

            if (suggestions.length > 0) bubbleDiv.appendChild(chipsDiv);
          }
        }
      } else {
        bubbleDiv.textContent = m.text;
        bubbleDiv.style.whiteSpace = 'pre-wrap';
      }

      msgDiv.appendChild(metaDiv);
      msgDiv.appendChild(bubbleDiv);
      chatView.appendChild(msgDiv);
    });
    chatView.scrollTop = chatView.scrollHeight;
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
    if (input) input.disabled = !!on;
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
  function replaceMsgById(jobId, id, newText) {
    const msgs = getMsgs(jobId);
    const i = msgs.findIndex(m => m.id === id);
    if (i !== -1) {
      msgs[i].text = newText;
      saveMsgs(jobId, msgs);
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

  // ✅ PAR CETTE VERSION AMÉLIORÉE (DYNAMIC THINKING V2)
  function updateThinking(jobId, runId, cycle) {
    let status = 'Assistant réfléchit';
    const steps = ['🔍 Analyse du transcript...', '🧠 Structuration des idées...', '✍️ Rédaction en cours...'];
    // Change toutes les 3 sec (cycle ~ 1s/call ?) - ajuster selon fréquence d'appel
    if (cycle < 6) status = steps[0];
    else if (cycle < 15) status = steps[1];
    else status = steps[2];

    const thinkingHtml = `
    <div class="thinking-indicator">
      <span>${status}</span>
      <div class="thinking-dots">
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
      </div>
    </div>
  `;
    replaceMsgById(jobId, runId, thinkingHtml);
  }


  /* ================== EXPORT (PDF local + formats serveur) ================== */
  async function exportMessage(msgIndex, format) {
    const f = String(format || '').toLowerCase();

    if (f === 'pdf') { // rendu propre local
      const md = (MESSAGES[msgIndex]?.text || '').trim();
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
  function getPersona() { return (document.querySelector('#ms-persona')?.textContent || '').trim(); }
  function getUseCase() { return (document.querySelector('#ms-use_case')?.textContent || '').trim(); }
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
    theU = STYLE_PRESETS.usecases[norm(useCase)] || {}; // avoid shadow name
    const u = theU;
    const merged = { ...base, ...p, ...u };
    const sections = (lang === 'en' ? merged.sectionsEN : merged.sectionsFR) || (lang === 'en' ? base.sectionsEN : base.sectionsFR);
    return { ...merged, sections };
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
  function buildPrompt(question) {
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
    if (/linkedin|post/i.test(question) && (question.toLowerCase().includes('post') || question.toLowerCase().includes('linkedin'))) {
      const userName = (document.querySelector('#ms-first-name')?.textContent || 'Professionnel').trim();
      const userJob = (document.querySelector('#ms-persona')?.textContent || 'Expert').trim();
      const userUseCase = (document.querySelector('#ms-use_case')?.textContent || 'Général').trim();

      const linkedInSys = [
        `Vous êtes un stratège de contenu numérique expert.`,
        `Votre mission : Rédiger un post LinkedIn court et prêt à publier pour ${userName} (${userJob}).`,
        ``,
        `### RÈGLES DE FORMATAGE (CRITIQUES) :`,
        `1. **RÉPONSE DIRECTE UNIQUEMENT** : Commencez directement par l'accroche. Aucun texte d'introduction.`,
        `2. **AUCUN GRAS** : Interdiction totale de **markdown** et de gras Unicode. Pas de caractères spéciaux en gras.`,
        `3. **AUCUN MARKDOWN** : Pas de titres (#), pas d'italique, pas de listes, pas de puces, pas de numérotation.`,
        `4. **POINTS CLÉS AVEC FLÈCHES** : Si vous listez des points, utilisez uniquement le préfixe "→ " (flèche), jamais d'icône.`,
        `5. **FORMAT "EN ESCALIER"** : 3 à 5 paragraphes très courts, une idée par ligne.`,
        `6. **LONGUEUR COURTE** : Max ~900 caractères.`,
        `7. **EMOJIS** : Aucun emoji.`,
        `8. **TON** : Conversationnel, authentique, pro.`,
        `9. **SORTIE** : Donnez uniquement le post final, puis une seule ligne courte : "Pourquoi ce post : ..."`,
        ``,
        `### CONTEXTE UTILISATEUR :`,
        `- Nom : ${userName}`,
        `- Rôle : ${userJob}`,
        `- Cas d'usage : ${userUseCase}`,
        ``,
        `Identifiez l'angle le plus pertinent à partir du transcript.`
      ];

      return [
        linkedInSys.join('\n'),
        `### TRANSCRIPT SOURCE :\n${turns.map(t => t.replace(/^(User|Assistant|Utilisateur):/, '')).join('\n')}`,
        `### DEMANDE UTILISATEUR :\n${question}`
      ].join('\n\n');
    }

    // --- SPECIALIZED PROMPT: EXECUTIVE EMAIL AGENT ---
    if (/email|mail|courriel/i.test(question)) {
      const userName = (document.querySelector('#ms-first-name')?.textContent || 'Professionnel').trim();
      const userJob = (document.querySelector('#ms-persona')?.textContent || '').trim();

      const emailSys = [
        `Vous êtes un Assistant Exécutif de haut niveau.`,
        `Votre mission : Rédiger un email de compte-rendu pour ${userName}.`,
        ``,
        `### RÈGLES DE RÉDACTION (STRICTES) :`,
        `- **RÉPONSE DIRECTE UNIQUEMENT** : Commencez directement par "Objet :".`,
        `- **TON** : Strictement professionnel, courtois, direct.`,
        `- **INTERDIT** : Zéro emoji. Pas de markdown gras inutile.`,
        `- **STRUCTURE** :`,
        `  Objet : [Clair et actionnable]`,
        ``,
        `  [Salutation pro],`,
        ``,
        `  [Contexte rapide et factuel de la réunion]`,
        ``,
        `  Points clés :`,
        `  - [Décision / Info 1]`,
        `  - [Décision / Info 2]`,
        ``,
        `  Prochaines étapes :`,
        `  - [Action 1]`,
        `  - [Action 2]`,
        ``,
        `  [Formule de politesse],`,
        ``,
        `  ${userName}`
      ];

      return [
        emailSys.join('\n'),
        `### TRANSCRIPT SOURCE :\n${turns.map(t => t.replace(/^(User|Assistant|Utilisateur):/, '')).join('\n')}`,
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
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: enc({ ...args, promptContent: args.prompt }) });

    const text = await resp.text(); let j = null; try { j = JSON.parse(text); } catch { }
    if (resp.status === 405 && !API_BASE.includes('api.agilotext.com')) {
      warn('405 sur', url, '→ retry sur api.agilotext.com');
      const alt = 'https://api.agilotext.com/api/v1';
      const r2 = await fetch(`${alt}/rePromptTranscript`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: enc({ ...args, promptContent: args.prompt })
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
  async function runChatFlowOnce(auth, jobId, prompt, onTick) {
    await rePromptSubmit({ ...auth, jobId, prompt });
    await rePromptPoll({ ...auth, jobId, onTick });
    const answer = await rePromptReceive({ ...auth, jobId });
    return (answer || '').trim();
  }
  async function runChatFlowWithReauth(jobId, prompt, onTick) {
    let auth = await resolveAuth();
    try {
      return await runChatFlowOnce(auth, jobId, prompt, onTick);
    } catch (e) {
      if (isInvalidTokenMessage(e?.message)) {
        const fresh = await ensureToken(auth.username, auth.edition);
        if (fresh && fresh !== auth.token) {
          auth.token = fresh;
          try { localStorage.setItem(tokenKey(auth.username, auth.edition), fresh); } catch { }
          return await runChatFlowOnce(auth, jobId, prompt, onTick);
        }
      }
      throw e;
    }
  }

  /* ================== ENVOI (question libre) ================== */
  async function handleAsk() {
    const jobId = ACTIVE_JOB;
    if (SENDING.has(jobId)) return;       // garde rapide anti double-clic
    SENDING.add(jobId);                    // lock immédiat
    if (jobId === ACTIVE_JOB) setBusy(true);

    // 1) Gate quotas
    const mode = (Array.isArray(MESSAGES) && MESSAGES.some(m => m.role === 'assistant')) ? 'conversation' : 'quick';
    const gate = window.AgiloQuota?.canSendChat({ mode }) || { ok: true };
    if (!gate.ok) {
      toast(gate.reason || 'Quota atteint', 'error');
      if (/plan|Pro|Business/i.test(gate.reason || '')) window.AgiloGate?.showUpgrade('pro');
      releaseSend(jobId);                 // ← libère le lock avant de sortir
      return;
    }

    // 2) Auth & job
    const auth = await resolveAuth();
    if (!auth.username || !auth.token) { toast('Authentification manquante', 'error'); releaseSend(jobId); return; }
    if (!jobId) { toast('Job ID manquant', 'error'); releaseSend(jobId); return; }

    const q = (input?.value || '').trim();
    if (!q) { input?.focus(); releaseSend(jobId); return; }

    // 3) UI + envoi
    pushMsg(jobId, { role: 'user', text: q, t: new Date().toISOString() });
    const runId = mkRunId();
    pushMsg(jobId, { role: 'assistant', id: runId, text: 'Assistant réfléchit...', t: new Date().toISOString() });
    input.value = '';

    try {
      const prompt = buildPrompt(q);
      const txt = await runChatFlowWithReauth(jobId, prompt, (cycle) => updateThinking(jobId, runId, Math.floor(cycle / 3)));
      replaceMsgById(jobId, runId, txt || '(réponse vide)');
      window.AgiloQuota?.afterChatSuccess?.();
    } catch (e) {
      err('flow failed', e);
      replaceMsgById(jobId, runId, `Échec de la requête.\n\nErreur: ${e.message}`);
      toast('Erreur: ' + (e.message || 'échec'), 'error');
    } finally {
      setBusyFor(jobId, false);           // ← remet l'UI et enlève le jobId de SENDING
    }
  }


  /* ================== ENVOI (PROMPT CACHÉ POUR INSIGHTS) ================== */
  async function handleHiddenAsk(label, hiddenPrompt) {
    // Ouvre l'onglet Conversation automatiquement
    try { openConversation(); } catch { }
    const jobId = ACTIVE_JOB;
    if (SENDING.has(jobId)) return;       // anti double déclenchement
    SENDING.add(jobId);
    if (jobId === ACTIVE_JOB) setBusy(true);

    const auth = await resolveAuth();
    if (!auth.username || !auth.token) { toast('Authentification manquante', 'error'); releaseSend(jobId); return; }
    if (!jobId) { toast('Job ID manquant', 'error'); releaseSend(jobId); return; }

    const shortLabel = (label || 'Demande envoyée').trim();

    // 1) bulle utilisateur (sans afficher le gros prompt)
    pushMsg(jobId, { role: 'user', text: shortLabel + ' …', t: new Date().toISOString() });

    // 2) placeholder assistant
    const runId = mkRunId();
    pushMsg(jobId, { role: 'assistant', id: runId, text: 'Assistant réfléchit...', t: new Date().toISOString() });

    try {
      let prompt = String(hiddenPrompt || '').trim();
      if (/linkedin/i.test(String(label || ''))) {
        prompt = buildPrompt('Post LinkedIn');
      }
      if (!prompt) throw new Error('prompt vide');

      const txt = await runChatFlowWithReauth(jobId, prompt, (cycle) => updateThinking(jobId, runId, Math.floor(cycle / 3)));
      replaceMsgById(jobId, runId, txt || '(réponse vide)');
      toast('Insight prêt', 'success');
    } catch (e) {
      err('hiddenAsk failed', e);
      replaceMsgById(jobId, runId, `Échec de la requête.\n\nErreur: ${e.message}`);
      toast('Erreur: ' + (e.message || 'échec'), 'error');
    } finally {
      setBusyFor(jobId, false);           // ← remet l'UI et enlève le jobId de SENDING
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

  btnAsk?.addEventListener('click', (e) => { e.preventDefault(); handleAsk(); });
  form?.addEventListener('submit', (e) => { e.preventDefault(); handleAsk(); });
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } });

  window.addEventListener('agilo:load', (ev) => {
    const newId = (ev.detail?.jobId ?? ev.detail ?? '').toString().trim();
    if (!newId || newId === ACTIVE_JOB) return;
    ACTIVE_JOB = newId;
    loadHistory(); render();
  });

  window.addEventListener('popstate', () => {
    const j = getJobId();
    if (j !== ACTIVE_JOB) {
      ACTIVE_JOB = j;
      loadHistory(); render();
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

