/* ===== Dashboard Copy Auto-Save : Version AMÉLIORÉE avec formatage Markdown/HTML ===== */
(function(){
  'use strict';

  // Éviter les doublons
  if (window.__agiloDashboardCopyAutoSave) return;
  window.__agiloDashboardCopyAutoSave = true;

  const VERSION = 'dashboard-copy-auto-save-5.0.0';
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const ENDPOINT = API_BASE + '/updateTranscriptFile';
  const TOKEN_GET = API_BASE + '/getToken';

  // Configuration
  const FETCH_TIMEOUT_MS = 10000;
  const RETRIES = 2;

  // Utilitaires
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Logging
  function log(...args) {
    if (window.agiloDashboardDebug) {
      console.log('[agilo:copy-auto-save]', ...args);
    }
  }

  // Fetch avec timeout et retry
  async function fetchWithRetry(url, opts = {}, { retries = RETRIES, backoff = 400 } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), FETCH_TIMEOUT_MS);
    
    let lastError = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, {
          ...opts,
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store'
        });
        
        if (!res.ok && res.status >= 500 && i < retries) {
          await sleep(backoff * (i + 1));
          continue;
        }
        
        clearTimeout(timeout);
        return res;
      } catch (e) {
        lastError = e;
        if (i < retries) await sleep(backoff * (i + 1));
      }
    }
    
    clearTimeout(timeout);
    throw lastError || new Error('network');
  }

  // ✅ Récupération des credentials
  async function getCredentials() {
    const email = $('[name="memberEmail"]')?.value || 
                  window.memberEmail || 
                  localStorage.getItem('agilo:username') || '';
    
    const jobId = (() => {
      const url = new URL(location.href);
      const fromUrl = url.searchParams.get('jobId');
      if (fromUrl) return fromUrl;
      
      try {
        const editorLink = $('#openEditorCta');
        if (editorLink) {
          const href = editorLink.getAttribute('href');
          if (href) {
            const editorUrl = new URL(href, location.origin);
            const fromLink = editorUrl.searchParams.get('jobId');
            if (fromLink) return fromLink;
          }
        }
      } catch {}
      
      const jobIdSelectors = [
        '[data-job-id]',
        '[data-jobid]',
        '[data-job]',
        '[data-id]',
        '.rail-item.is-active',
        '#editorRoot'
      ];
      
      for (const selector of jobIdSelectors) {
        const element = $(selector);
        if (element) {
          const id = element.dataset.jobId || element.dataset.jobid || element.dataset.job || element.dataset.id || '';
          if (id) return id;
        }
      }
      
      return '';
    })();
    
    let token = window.globalToken || '';
    
    if (!token && email) {
      try {
        const url = `${TOKEN_GET}?username=${encodeURIComponent(email)}&edition=ent`;
        const response = await fetchWithRetry(url, { method: 'GET' });
        const data = await response.json();
        
        if (response.ok && data.status === 'OK' && data.token) {
          token = data.token;
          window.globalToken = token;
        }
      } catch (error) {
        log('⚠️ Erreur récupération token:', error);
      }
    }
    
    const credentials = { 
      email: email.trim(), 
      token: token.trim(), 
      edition: 'ent', 
      jobId: jobId.trim() 
    };
    
    log('🔑 Credentials:', { 
      email: credentials.email ? '✅' : '❌',
      token: credentials.token ? '✅' : '❌',
      edition: credentials.edition,
      jobId: credentials.jobId ? '✅' : '❌'
    });
    
    return credentials;
  }

  // ✅ Récupération du contenu DIRECTEMENT depuis les segments HTML
  function getTranscriptContent() {
    const prettyElement = $('#ag-pretty-transcript');
    if (prettyElement) {
      log('📝 Récupération depuis #ag-pretty-transcript');
      
      const segments = $$('.ag-seg', prettyElement);
      if (segments.length > 0) {
        log(`📋 ${segments.length} segments trouvés`);
        
        const segmentsData = segments.map((seg, index) => {
          const start = parseInt(seg.dataset.start || '0');
          const end = parseInt(seg.dataset.end || '0');
          const speaker = seg.dataset.speaker || '';
          
          const textElement = seg.querySelector('.ag-seg__text');
          const text = textElement ? textElement.textContent.trim() : '';
          
          log(`📝 Segment ${index}:`, {
            start: start,
            end: end,
            speaker: speaker,
            text: text.substring(0, 50) + '...'
          });
          
          return {
            start: start,
            end: end,
            speaker: speaker,
            text: text
          };
        }).filter(seg => seg.text.trim());
        
        log('📦 Segments data:', segmentsData);
        return segmentsData;
      }
    }
    
    log('⚠️ Aucun contenu transcript trouvé');
    return [];
  }

  // ✅ NOUVEAU : Conversion HTML en Markdown (même logique que l'éditeur)
  function htmlToMarkdown(element) {
    if (!element) return '';
    
    const clone = element.cloneNode(true);
    
    // Supprimer les attributs inutiles
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') || 
            attr.name === 'contenteditable' || 
            attr.name === 'spellcheck' ||
            attr.name === 'style' ||
            (attr.name === 'class' && !attr.value.includes('important'))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    function convertNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      
      const tag = node.tagName?.toLowerCase();
      const children = Array.from(node.childNodes).map(convertNode).join('');
      const text = children.trim();
      
      // Titres
      if (tag === 'h1') return `# ${text}\n\n`;
      if (tag === 'h2') return `## ${text}\n\n`;
      if (tag === 'h3') return `### ${text}\n\n`;
      if (tag === 'h4') return `#### ${text}\n\n`;
      if (tag === 'h5') return `##### ${text}\n\n`;
      if (tag === 'h6') return `###### ${text}\n\n`;
      
      // Gras et Italique
      if (tag === 'strong' || tag === 'b') return `**${text}**`;
      if (tag === 'em' || tag === 'i') return `*${text}*`;
      
      // Liens
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        const linkText = text || href;
        return href ? `[${linkText}](${href})` : linkText;
      }
      
      // Citations
      if (tag === 'blockquote') return `> ${text.split('\n').join('\n> ')}\n\n`;
      
      // Code
      if (tag === 'code') {
        const parent = node.parentElement?.tagName?.toLowerCase();
        return parent === 'pre' ? text : `\`${text}\``;
      }
      if (tag === 'pre') return `\`\`\`\n${text}\n\`\`\`\n\n`;
      
      // Listes
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li')).map(li => {
          const liText = Array.from(li.childNodes)
            .map(convertNode)
            .join('')
            .trim()
            .split('\n')
            .map((line, idx) => idx === 0 ? `- ${line}` : `  ${line}`)
            .join('\n');
          return liText;
        }).join('\n');
        return `\n${items}\n\n`;
      }
      
      // Tableaux
      if (tag === 'table') {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        
        const tableRows = rows.map((row) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map(cell => {
            const cellText = Array.from(cell.childNodes).map(convertNode).join('').trim();
            return cellText.replace(/\|/g, '\\|');
          });
          return `| ${cells.join(' | ')} |`;
        });
        
        if (tableRows.length > 0) {
          const firstRow = tableRows[0];
          const colCount = (firstRow.match(/\|/g) || []).length - 1;
          const separator = `| ${'---|'.repeat(colCount)}`;
          tableRows.splice(1, 0, separator);
        }
        
        return `\n${tableRows.join('\n')}\n\n`;
      }
      
      // Paragraphes
      if (tag === 'p') return text ? `${text}\n\n` : '\n';
      if (tag === 'br') return '\n';
      
      // Div
      if (tag === 'div') {
        if (node.querySelector('table')) return text;
        return text ? `${text}\n` : '';
      }
      
      return text;
    }
    
    let markdown = convertNode(clone);
    markdown = markdown.replace(/\n{4,}/g, '\n\n\n');
    markdown = markdown.replace(/[ \t]{2,}/g, ' ');
    markdown = markdown.replace(/\n[ \t]+/g, '\n');
    markdown = markdown.trim();
    
    return markdown;
  }

  // ✅ NOUVEAU : Récupérer le compte-rendu en Markdown
  function getSummaryContentWithFormatting() {
    // Chercher le compte-rendu dans le dashboard
    const summaryElement = $('#ag-pretty-summary') || 
                           $('[data-content="summary"]') ||
                           $('.summary-content') ||
                           $('.compte-rendu-content');
    
    if (!summaryElement) return null;
    
    // Si l'utilisateur a sélectionné du texte, utiliser la sélection
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      
      if (summaryElement.contains(commonAncestor) || summaryElement === commonAncestor) {
        try {
          const selectedContent = range.cloneContents();
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(selectedContent);
          const markdown = htmlToMarkdown(tempDiv);
          if (markdown && markdown.trim().length > 0) {
            return markdown;
          }
        } catch (e) {
          // Si erreur, continuer avec tout le contenu
        }
      }
    }
    
    // Sinon, convertir tout le contenu
    return htmlToMarkdown(summaryElement);
  }

  // ✅ NOUVEAU : Récupérer le HTML propre du compte-rendu
  function getSummaryHTML() {
    const summaryElement = $('#ag-pretty-summary') || 
                           $('[data-content="summary"]') ||
                           $('.summary-content') ||
                           $('.compte-rendu-content');
    
    if (!summaryElement) return null;
    
    const clone = summaryElement.cloneNode(true);
    
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') || 
            attr.name === 'contenteditable' || 
            attr.name === 'spellcheck' ||
            attr.name === 'data-opentech-ux-zone-id' ||
            (attr.name === 'style' && !attr.value.includes('important'))) {
          el.removeAttribute(attr.name);
        }
      });
      
      if (el.tagName === 'TABLE') {
        el.setAttribute('border', '1');
        el.setAttribute('cellpadding', '10');
        el.setAttribute('cellspacing', '0');
        el.setAttribute('style', 'border-collapse: collapse; font-family: Arial, sans-serif;');
      }
    });
    
    return clone.innerHTML;
  }

  // ✅ NOUVEAU : Copie améliorée avec formatage
  async function copyToClipboardImproved(text, html = null) {
    try {
      // Si on a du HTML ET que l'API moderne est disponible, copier en format riche
      if (html && navigator.clipboard?.write) {
        try {
          const cleanHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${html}
</body>
</html>`;
          
          const clipboardItem = new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([cleanHtml], { type: 'text/html' })
          });
          await navigator.clipboard.write([clipboardItem]);
          return true;
        } catch (e) {
          log('⚠️ ClipboardItem failed, fallback to text:', e);
        }
      }
      
      // Sinon, copier en texte brut
      if (navigator.clipboard?.writeText) { 
        await navigator.clipboard.writeText(text); 
        return true; 
      }
    } catch(e) {
      log('⚠️ Clipboard API failed:', e);
    }
    
    // Fallback : méthode ancienne
    try {
      const ta = document.createElement('textarea');
      ta.value = text; 
      ta.setAttribute('readonly',''); 
      ta.style.position='fixed'; 
      ta.style.left='-9999px';
      ta.style.opacity='0';
      document.body.appendChild(ta); 
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch(e) {
      log('❌ Fallback copy failed:', e);
      return false;
    }
  }

  // ✅ Construction du JSON DIRECTEMENT (sans parser)
  function buildTranscriptJSON(segmentsData, creds) {
    log('🔍 Construction du JSON directement depuis les segments...');
    
    if (!Array.isArray(segmentsData) || segmentsData.length === 0) {
      log('⚠️ Aucun segment à traiter');
      return {
        job_meta: {
          jobId: 0,
          milli_duration: 0,
          speakerLabels: false
        },
        segments: []
      };
    }
    
    const segMs = segmentsData.map((s, i) => ({
      id: `s${i}`,
      milli_start: Math.max(0, (s.start || 0) * 1000),
      milli_end: Math.max(0, (s.end || 0) * 1000),
      speaker: String(s.speaker || ''),
      text: String(s.text || '')
    }));
    
    const milli_duration = segMs.reduce((max, s) => {
      const end = s.milli_end || s.milli_start || 0;
      return Math.max(max, end);
    }, 0);
    
    const speakerLabels = segMs.some(s => {
      const speaker = String(s.speaker || '').trim();
      return speaker.length > 0 && speaker !== 'Speaker_A';
    });
    
    const rawJobId = String(creds.jobId || '').trim();
    const jobIdNum = /^\d+$/.test(rawJobId) ? parseInt(rawJobId, 10) : 0;
    
    const transcriptStatusJson = {
      job_meta: {
        jobId: jobIdNum,
        milli_duration: Math.max(0, milli_duration),
        speakerLabels: Boolean(speakerLabels)
      },
      segments: segMs.map(s => ({
        id: String(s.id || ''),
        milli_start: Math.max(0, s.milli_start || 0),
        milli_end: Math.max(0, s.milli_end || 0),
        speaker: String(s.speaker || ''),
        text: String(s.text || '')
      }))
    };
    
    log('📦 JSON construit (direct):', transcriptStatusJson);
    return transcriptStatusJson;
  }

  // ✅ Sauvegarde avec format JSON exact
  async function autoSaveTranscript(creds, segmentsData) {
    try {
      log('🚀 Début auto-sauvegarde (format direct)...', { 
        email: creds.email, 
        jobId: creds.jobId, 
        edition: creds.edition,
        segmentsCount: segmentsData.length 
      });
      
      if (!creds.email || !creds.token || !creds.jobId) {
        throw new Error(`Credentials incomplets: email=${!!creds.email}, token=${!!creds.token}, jobId=${!!creds.jobId}`);
      }
      
      if (!Array.isArray(segmentsData) || segmentsData.length === 0) {
        throw new Error('Aucun segment transcript trouvé');
      }
      
      const transcriptStatusJson = buildTranscriptJSON(segmentsData, creds);
      
      const body = new URLSearchParams();
      body.append('username', creds.email);
      body.append('token', creds.token);
      body.append('jobId', creds.jobId);
      body.append('edition', creds.edition);
      body.append('transcriptContent', JSON.stringify(transcriptStatusJson));
      
      const url = `${ENDPOINT}?username=${encodeURIComponent(creds.email)}&token=${encodeURIComponent(creds.token)}&jobId=${encodeURIComponent(creds.jobId)}&edition=${encodeURIComponent(creds.edition)}`;
      
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: body.toString()
      });
      
      const result = await response.json();
      
      if (response.ok && result.status === 'OK') {
        log('✅ Auto-sauvegarde réussie (format direct)');
        return { success: true, result };
      } else {
        throw new Error(result.errorMessage || `Erreur API: ${response.status}`);
      }
      
    } catch (error) {
      log('❌ Erreur auto-sauvegarde:', error);
      return { success: false, error: error.message };
    }
  }

  // ✅ Interception des clics sur "Copier le texte" (AMÉLIORÉE)
  function interceptCopyButtons() {
    const copyButtons = $$('#copyTextBtnTranscription, #copyTextBtnSummary');
    
    copyButtons.forEach(button => {
      if (button.dataset.autoSaveAttached) return;
      button.dataset.autoSaveAttached = 'true';
      
      log('🎯 Bouton copie intercepté:', button);
      
      button.addEventListener('click', async (e) => {
        // ✅ NOUVEAU : Détecter si c'est le transcript ou le compte-rendu
        const isSummary = button.id === 'copyTextBtnSummary' || 
                         button.closest('[data-content="summary"]') ||
                         button.closest('.summary-content') ||
                         button.closest('.compte-rendu-content');
        
        // ✅ NOUVEAU : Si c'est le compte-rendu, copier en Markdown/HTML
        if (isSummary) {
          const markdown = getSummaryContentWithFormatting();
          const html = getSummaryHTML();
          
          if (markdown) {
            e.preventDefault();
            e.stopPropagation();
            
            const ok = await copyToClipboardImproved(markdown, html);
            
            if (ok) {
              // Feedback visuel
              const originalText = button.textContent || button.innerHTML;
              button.textContent = '✅ Copié (formatage préservé)';
              setTimeout(() => {
                button.textContent = originalText;
              }, 2000);
              
              log('✅ Compte-rendu copié en Markdown/HTML');
            } else {
              log('❌ Échec copie compte-rendu');
            }
            
            // Ne pas faire l'auto-sauvegarde pour le compte-rendu (pas de transcript à sauvegarder)
            return;
          }
        }
        
        // ✅ Pour le transcript : copie normale + auto-sauvegarde
        log('🔄 Clic sur copier transcript détecté - sauvegarde en arrière-plan');
        
        setTimeout(async () => {
          try {
            const creds = await getCredentials();
            const segmentsData = getTranscriptContent();
            
            if (!Array.isArray(segmentsData) || segmentsData.length === 0) {
              log('⚠️ Aucun segment transcript trouvé');
              return;
            }
            
            const saveResult = await autoSaveTranscript(creds, segmentsData);
            
            if (saveResult.success) {
              log('✅ Sauvegarde réussie en arrière-plan (format direct)');
            } else {
              log('⚠️ Sauvegarde échouée:', saveResult.error);
            }
            
          } catch (error) {
            log('❌ Erreur lors de la sauvegarde:', error);
          }
        }, 100);
      }, true);
    });
    
    log(`🎯 ${copyButtons.length} bouton(s) copie intercepté(s)`);
  }

  // ✅ Initialisation
  function init() {
    log('🚀 Initialisation Dashboard Copy Auto-Save AMÉLIORÉE', VERSION);
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    setTimeout(() => {
      interceptCopyButtons();
      log('✅ Dashboard Copy Auto-Save initialisé (avec formatage Markdown/HTML)');
    }, 1000);
  }

  init();

  // Exposer des fonctions pour le debug
  window.agiloDashboardCopyAutoSave = {
    version: VERSION,
    getCredentials,
    getTranscriptContent,
    autoSaveTranscript,
    buildTranscriptJSON,
    getSummaryContentWithFormatting,
    getSummaryHTML,
    htmlToMarkdown,
    copyToClipboardImproved,
    test: async () => {
      const creds = await getCredentials();
      const segmentsData = getTranscriptContent();
      log('🧪 Test (format direct):', { creds, segmentsData });
      return await autoSaveTranscript(creds, segmentsData);
    },
    testSummary: () => {
      const markdown = getSummaryContentWithFormatting();
      const html = getSummaryHTML();
      log('🧪 Test compte-rendu:', { markdown, html });
      return { markdown, html };
    }
  };

})();

