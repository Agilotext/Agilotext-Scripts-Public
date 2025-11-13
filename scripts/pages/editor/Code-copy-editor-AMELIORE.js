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
   * Convertit un élément HTML en Markdown
   * Gère les titres, listes, gras, italique, etc.
   */
  function htmlToMarkdown(element) {
    if (!element) return '';
    
    // Cloner l'élément pour ne pas modifier l'original
    const clone = element.cloneNode(true);
    
    // Supprimer les attributs data-opentech-ux-zone-id et autres attributs inutiles
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') || attr.name === 'contenteditable' || attr.name === 'spellcheck') {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    // Convertir les balises HTML en Markdown
    let markdown = clone.innerHTML;
    
    // Titres
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
    
    // Gras et Italique
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    
    // Listes
    markdown = markdown.replace(/<ul[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/ul>/gi, '\n');
    markdown = markdown.replace(/<ol[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/ol>/gi, '\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    
    // Paragraphes
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');
    
    // Tableaux (simplifié)
    markdown = markdown.replace(/<table[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/table>/gi, '\n');
    markdown = markdown.replace(/<tbody[^>]*>/gi, '');
    markdown = markdown.replace(/<\/tbody>/gi, '');
    markdown = markdown.replace(/<tr[^>]*>/gi, '');
    markdown = markdown.replace(/<\/tr>/gi, '\n');
    markdown = markdown.replace(/<td[^>]*>(.*?)<\/td>/gi, '$1 | ');
    markdown = markdown.replace(/<th[^>]*>(.*?)<\/th>/gi, '**$1** | ');
    
    // Saut de ligne
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    
    // Nettoyer les balises restantes
    markdown = markdown.replace(/<[^>]+>/g, '');
    
    // Décoder les entités HTML
    const textarea = document.createElement('textarea');
    textarea.innerHTML = markdown;
    markdown = textarea.value;
    
    // Nettoyer les espaces multiples et sauts de ligne
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.replace(/[ \t]+/g, ' ');
    markdown = markdown.trim();
    
    return markdown;
  }

  /**
   * Récupère le HTML propre du compte-rendu (sans attributs inutiles)
   */
  function getSummaryHTML() {
    const summaryEl = document.getElementById('summaryEditor');
    if (!summaryEl) return null;
    
    // Cloner pour ne pas modifier l'original
    const clone = summaryEl.cloneNode(true);
    
    // Supprimer les attributs inutiles
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') || 
            attr.name === 'contenteditable' || 
            attr.name === 'spellcheck' ||
            attr.name === 'data-opentech-ux-zone-id') {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return clone.innerHTML;
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
   */
  function getSummaryTextWithFormatting(){
    const summaryEl = document.getElementById('summaryEditor');
    if (!summaryEl) return '';
    
    // Si l'utilisateur a sélectionné du texte, utiliser la sélection
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (summaryEl.contains(range.commonAncestorContainer)) {
        const selectedContent = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(selectedContent);
        return htmlToMarkdown(tempDiv);
      }
    }
    
    // Sinon, convertir tout le contenu en Markdown
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
   */
  async function copyToClipboard(text, html = null){
    try {
      // Si on a du HTML ET que l'API moderne est disponible, copier en format riche
      if (html && navigator.clipboard?.write) {
        const clipboardItem = new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        });
        await navigator.clipboard.write([clipboardItem]);
        return true;
      }
      
      // Sinon, copier en texte brut
      if (navigator.clipboard?.writeText) { 
        await navigator.clipboard.writeText(text); 
        return true; 
      }
    } catch(_) {}
    
    // Fallback : méthode ancienne
    const ta = document.createElement('textarea');
    ta.value = text; 
    ta.setAttribute('readonly',''); 
    ta.style.position='fixed'; 
    ta.style.opacity='0';
    document.body.appendChild(ta); 
    ta.select();
    let ok=false; 
    try{ 
      ok=document.execCommand('copy'); 
    }catch(_){ 
      ok=false; 
    }
    ta.remove(); 
    return ok;
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

