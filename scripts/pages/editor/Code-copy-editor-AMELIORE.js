// Agilotext – Copie améliorée avec formatage Markdown/HTML
(() => {
  if (window.__agiloEditBar) return;
  window.__agiloEditBar = true;

  /* ===== Helpers ===== */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

  const btnUndo = $('#ag-undo');
  const btnRedo = $('#ag-redo');
  const btnCopy = document.getElementById('copyTextBtneditor')
             || document.getElementById('copyTextBtnTranscription')
             || document.querySelector('button.copy-text.editor');

  // ====== CSS pour bulle "Copié" ======
  (function injectCopyCSS(){
    if (!btnCopy) return;
    if (document.getElementById('agilo-copy-css')) return;
    const css = `
      .agilo-copy-anchor{ position:relative; }
      .agilo-copy-anchor.is-copied::after{
        content: attr(data-copied-label);
        position:absolute; right:10px; top:-6px; transform:translateY(-100%);
        background:rgba(0,0,0,.88); color:#fff; font-size:12px; line-height:1;
        white-space:nowrap; padding:6px 8px; border-radius:6px; box-shadow:0 4px 14px rgba(0,0,0,.18);
        opacity:1; pointer-events:none;
      }`;
    const st = document.createElement('style');
    st.id='agilo-copy-css';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  if (btnCopy) {
    btnCopy.classList.add('agilo-copy-anchor');
    if(!btnCopy.dataset.copiedLabel) btnCopy.dataset.copiedLabel='Copié';
  }

  /* ===== Zone / cible d'édition ===== */
  const isEditable = (el)=> !!el && (
    el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && /^(text|search|url|email|tel)$/i.test(el.type||''))
  );

  function activePane(){
    return $('.edtr-pane.is-active') ||
           (function(){ const id = $('.ed-tab.is-active')?.dataset?.tab; return id ? document.getElementById('pane-'+id) : null; })() ||
           null;
  }

  function getActiveEditable(){
    const a = document.activeElement;
    if (isEditable(a)) return a;
    const pane = activePane();
    if (pane?.id === 'pane-transcript') {
      const segFocused = pane.querySelector('.ag-seg__text:focus');
      if (segFocused) return segFocused;
      const seg = pane.querySelector('.ag-seg__text[contenteditable="true"]');
      if (seg) return seg;
    }
    if (pane?.id === 'pane-chat') {
      const ta = document.getElementById('chatPrompt');
      if (ta) return ta;
    }
    return $('.ag-seg__text[contenteditable="true"]') || $('#chatPrompt') || null;
  }

  function withFocusOnEditable(doStuff){
    const target = getActiveEditable();
    if (!target) return false;
    target.focus({ preventScroll:true });
    try { doStuff(target); return true; } catch { return false; }
  }

  /* ===== Undo / Redo ===== */
  function execUndo(){
    return withFocusOnEditable(() => {
      document.execCommand && document.execCommand('undo');
    });
  }

  function execRedo(){
    return withFocusOnEditable((el) => {
      document.execCommand && document.execCommand('redo');
    });
  }

  function setBtnState(){
    const hasTarget = !!getActiveEditable();
    if (btnUndo){ btnUndo.toggleAttribute('aria-disabled', !hasTarget); btnUndo.disabled = !hasTarget; }
    if (btnRedo){ btnRedo.toggleAttribute('aria-disabled', !hasTarget); btnRedo.disabled = !hasTarget; }
  }

  on(btnUndo, 'click', (e)=>{ e.preventDefault(); execUndo(); setBtnState(); });
  on(btnRedo, 'click', (e)=>{ e.preventDefault(); execRedo(); setBtnState(); });

  ['click','focusin','agilo:load','keydown'].forEach(evt => on(window, evt, setBtnState));
  setBtnState();

  on(window, 'keydown', (e) => {
    const k = (e.key||'').toLowerCase();
    const insideEditable = isEditable(document.activeElement);
    const isUndo = (k === 'z') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
    const isRedo = ((k === 'z') && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey)
                || ((k === 'y') && e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey);
    if (isUndo && !insideEditable) { e.preventDefault(); execUndo(); }
    if (isRedo && !insideEditable) { e.preventDefault(); execRedo(); }
  });

  /* ===== Copier AMÉLIORÉ avec formatage Markdown/HTML ===== */
  function getSelectionText(){
    const sel = window.getSelection?.();
    return sel ? String(sel).trim() : '';
  }

  /**
   * Convertit un élément HTML en Markdown (VERSION AMÉLIORÉE)
   * Gère les titres, listes, gras, italique, liens, tableaux, etc.
   */
  function htmlToMarkdown(element) {
    if (!element) return '';
    
    // Cloner l'élément pour ne pas modifier l'original
    const clone = element.cloneNode(true);
    
    // Supprimer les attributs inutiles
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') || 
            attr.name === 'contenteditable' || 
            attr.name === 'spellcheck' ||
            attr.name === 'style' ||
            attr.name === 'class' && !attr.value.includes('important')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    // ✅ AMÉLIORATION 1 : Convertir récursivement en parcourant le DOM (plus robuste)
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
      
      // Gras et Italique (gérer les imbriqués)
      if (tag === 'strong' || tag === 'b') return `**${text}**`;
      if (tag === 'em' || tag === 'i') return `*${text}*`;
      
      // ✅ AMÉLIORATION 2 : Liens
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        const linkText = text || href;
        return href ? `[${linkText}](${href})` : linkText;
      }
      
      // ✅ AMÉLIORATION 3 : Citations/Blockquotes
      if (tag === 'blockquote') return `> ${text.split('\n').join('\n> ')}\n\n`;
      
      // ✅ AMÉLIORATION 4 : Code
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
      
      // ✅ AMÉLIORATION 5 : Tableaux (format Markdown propre)
      if (tag === 'table') {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        
        const tableRows = rows.map((row, idx) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map(cell => {
            const cellText = Array.from(cell.childNodes).map(convertNode).join('').trim();
            return cellText.replace(/\|/g, '\\|'); // Échapper les pipes
          });
          return `| ${cells.join(' | ')} |`;
        });
        
        // Ajouter la ligne de séparation après l'en-tête
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
      
      // Saut de ligne
      if (tag === 'br') return '\n';
      
      // Div (conteneur générique)
      if (tag === 'div') {
        // Si c'est un conteneur de tableau, ne rien ajouter
        if (node.querySelector('table')) return text;
        return text ? `${text}\n` : '';
      }
      
      // Autres balises : retourner le contenu
      return text;
    }
    
    let markdown = convertNode(clone);
    
    // Nettoyer les espaces multiples et sauts de ligne
    markdown = markdown.replace(/\n{4,}/g, '\n\n\n'); // Max 3 sauts de ligne
    markdown = markdown.replace(/[ \t]{2,}/g, ' '); // Max 1 espace
    markdown = markdown.replace(/\n[ \t]+/g, '\n'); // Supprimer espaces en début de ligne
    markdown = markdown.trim();
    
    return markdown;
  }

  /**
   * Récupère le HTML propre du compte-rendu (sans attributs inutiles)
   * ✅ AMÉLIORATION : HTML mieux formaté pour les emails
   */
  function getSummaryHTML() {
    const summaryEl = document.getElementById('summaryEditor');
    if (!summaryEl) return null;
    
    // Cloner pour ne pas modifier l'original
    const clone = summaryEl.cloneNode(true);
    
    // ✅ AMÉLIORATION : Supprimer aussi les styles inline qui pourraient poser problème
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
      
      // ✅ AMÉLIORATION : Préserver les styles essentiels pour les emails
      if (el.tagName === 'TABLE') {
        el.setAttribute('border', '1');
        el.setAttribute('cellpadding', '10');
        el.setAttribute('cellspacing', '0');
        el.setAttribute('style', 'border-collapse: collapse; font-family: Arial, sans-serif;');
      }
    });
    
    // ✅ AMÉLIORATION : Ajouter un wrapper pour les emails si nécessaire
    const html = clone.innerHTML;
    
    // Si le HTML contient un tableau, s'assurer qu'il est bien formaté
    if (html.includes('<table')) {
      return html; // Le tableau est déjà bien formaté
    }
    
    return html;
  }

  /**
   * Récupère le texte du transcript avec horodateurs et speakers
   */
  function getTranscriptTextWithTimestamps(){
    const ed = document.getElementById('transcriptEditor'); 
    if (!ed) return '';
    const segs = $$('.ag-seg', ed);
    if (segs.length === 0) return ed.innerText.trim();
    
    const parts = segs.map(seg => {
      const timeEl = seg.querySelector('.time, [data-t]');
      const time = timeEl ? timeEl.textContent.trim() : '00:00';
      const speakerEl = seg.querySelector('.speaker, [data-speaker]');
      const speaker = speakerEl ? speakerEl.textContent.trim() : '';
      const textEl = seg.querySelector('.ag-seg__text');
      const text = textEl ? textEl.innerText.trim() : '';
      
      if (speaker && text) {
        return `[${time}] ${speaker}: ${text}`;
      } else if (text) {
        return `[${time}] ${text}`;
      }
      return '';
    }).filter(Boolean);
    
    return parts.join('\n\n').trim();
  }

  /**
   * Récupère le compte-rendu en Markdown (formatage préservé)
   * ✅ AMÉLIORATION : Meilleure gestion de la sélection partielle
   */
  function getSummaryTextWithFormatting(){
    const summaryEl = document.getElementById('summaryEditor');
    if (!summaryEl) return '';
    
    // ✅ AMÉLIORATION : Vérifier si l'utilisateur a sélectionné du texte
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      
      // Vérifier si la sélection est dans le summaryEditor
      if (summaryEl.contains(commonAncestor) || summaryEl === commonAncestor) {
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
    
    // Sinon, convertir tout le contenu en Markdown
    // ✅ AMÉLIORATION : Extraire uniquement le contenu du tableau si présent
    const table = summaryEl.querySelector('table');
    if (table) {
      return htmlToMarkdown(table);
    }
    
    return htmlToMarkdown(summaryEl);
  }

  /**
   * Récupère le dernier message du chat
   */
  function getLastChatMessageWithFormatting(){
    const log = document.getElementById('chatView'); 
    if (!log) return '';
    const bubbles = $$('.msg .msg-bubble', log);
    if (bubbles.length === 0) return '';
    const last = bubbles[bubbles.length - 1];
    if (!last) return '';
    const text = last.innerText.trim();
    if (!text) return '';
    return `=== DERNIER MESSAGE CHAT ===\n${text}`;
  }

  /**
   * Fonction principale : détermine ce qui doit être copié
   */
  function computeTextToCopy(){
    const sel = getSelectionText(); 
    if (sel) return sel;
    
    const pane = activePane(); 
    const pid = pane?.id || '';
    
    // Si on est sur le compte-rendu, utiliser le formatage Markdown
    if (pid === 'pane-summary' && $('#summaryEditor')) {
      return getSummaryTextWithFormatting();
    }
    
    // Si on est sur le transcript, utiliser les horodateurs
    if (pid === 'pane-transcript' && $('#transcriptEditor')) {
      return getTranscriptTextWithTimestamps();
    }
    
    // Si on est sur le chat
    if (pid === 'pane-chat' && $('#chatView')) {
      return getLastChatMessageWithFormatting();
    }
    
    // Fallback : essayer de tout récupérer
    const transcript = getTranscriptTextWithTimestamps();
    const summary = getSummaryTextWithFormatting();
    const chat = getLastChatMessageWithFormatting();
    
    const parts = [transcript, summary, chat].filter(Boolean);
    return parts.join('\n\n' + '='.repeat(50) + '\n\n');
  }

  /**
   * Copie dans le presse-papier avec support HTML (pour les emails)
   * ✅ AMÉLIORATION : Meilleure gestion des erreurs et support HTML amélioré
   */
  async function copyToClipboard(text, html = null){
    try {
      // ✅ AMÉLIORATION : Si on a du HTML ET que l'API moderne est disponible, copier en format riche
      if (html && navigator.clipboard?.write) {
        try {
          // Créer un HTML propre avec charset UTF-8 pour les emails
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
          // Si l'API ClipboardItem échoue, essayer avec writeText
          console.warn('[agilo:copy] ClipboardItem failed, fallback to text:', e);
        }
      }
      
      // Sinon, copier en texte brut
      if (navigator.clipboard?.writeText) { 
        await navigator.clipboard.writeText(text); 
        return true; 
      }
    } catch(e) {
      console.warn('[agilo:copy] Clipboard API failed:', e);
    }
    
    // ✅ AMÉLIORATION : Fallback avec meilleure gestion d'erreur
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
      console.error('[agilo:copy] Fallback copy failed:', e);
      return false;
    }
  }

  function flashCopied(btn, ok, msgOk='Copié', msgKo='Rien à copier'){
    const labDone = btn.querySelector('.copy-text');
    if (labDone){
      const prev = labDone.textContent;
      labDone.textContent = ok ? msgOk : msgKo;
      labDone.style.display = '';
      setTimeout(()=>{ labDone.textContent = prev; }, 1500);
    } else {
      btn.dataset.copiedLabel = ok ? msgOk : msgKo;
      btn.classList.add('is-copied');
      setTimeout(()=>btn.classList.remove('is-copied'), 1500);
    }
    btn.title = ok ? msgOk : msgKo;
    btn.setAttribute('aria-live','polite');
    btn.setAttribute('aria-label', ok ? msgOk : msgKo);
  }

  // ✅ GESTIONNAIRE DE COPIE AMÉLIORÉ
  on(btnCopy, 'click', async (e)=>{
    e.preventDefault();
    
    const pane = activePane();
    const pid = pane?.id || '';
    
    // Si on est sur le compte-rendu, copier en Markdown ET HTML
    if (pid === 'pane-summary' && $('#summaryEditor')) {
      const markdown = getSummaryTextWithFormatting();
      const html = getSummaryHTML();
      
      if (!markdown) {
        return flashCopied(btnCopy, false, 'Copié', 'Rien à copier');
      }
      
      // Copier en Markdown (texte) et HTML (pour les emails)
      const ok = await copyToClipboard(markdown, html);
      flashCopied(btnCopy, ok, 'Compte-rendu copié (formatage préservé)', 'Échec de la copie');
      
      if (window.agiloCopyDebug) {
        console.log('📋 Compte-rendu copié (Markdown):', markdown);
        console.log('📋 Compte-rendu copié (HTML):', html);
      }
      return;
    }
    
    // Pour les autres onglets, copier en texte brut
    const text = computeTextToCopy();
    if (!text) return flashCopied(btnCopy, false, 'Copié', 'Rien à copier');
    
    const ok = await copyToClipboard(text);
    flashCopied(btnCopy, ok, 'Texte copié', 'Échec de la copie');
    
    if (window.agiloCopyDebug) {
      console.log('📋 Texte copié:', text);
      console.log('📋 Longueur:', text.length);
    }
  });

  // ✅ EXPOSER LES FONCTIONS POUR DEBUG
  window.agiloCopyDebug = {
    getTranscriptTextWithTimestamps,
    getSummaryTextWithFormatting,
    getLastChatMessageWithFormatting,
    computeTextToCopy,
    htmlToMarkdown,
    getSummaryHTML
  };
})();

