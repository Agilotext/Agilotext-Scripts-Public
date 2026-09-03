/**
 * Agilotext Free — transcript joli (port de l’embed Pro/Business __AgiloUIv2).
 * CSS + parseRawTranscript + mountPretty. Ne pas charger sur Pro/Business.
 */
(function (root) {
  "use strict";

  function fmtHMS(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    var HH = String(h).padStart(2, "0");
    var MM = String(m).padStart(2, "0");
    var SS = String(sec).padStart(2, "0");
    return h ? HH + ":" + MM + ":" + SS : MM + ":" + SS;
  }

  function parseRawTranscript(raw){
    const lines = String(raw||'').replace(/\r\n?/g, '\n').split('\n');
  
    // "00:00 --> 00:07", "00:00:00 --> 00:00:28", "00:00 -> 00:07", etc.
    const timeRe = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-->|[-–—]+\>|→|->)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
  
    const parseHMSLocal = (str)=>{
      const a = String(str).trim().split(':').map(n=>parseInt(n,10));
      if (a.length===2) return a[0]*60 + a[1];
      if (a.length===3) return a[0]*3600 + a[1]*60 + a[2];
      return 0;
    };
  
    let i=0; const segs=[];
    while (i<lines.length){
      // skip blancs
      while (i<lines.length && !lines[i].trim()) i++;
      if (i>=lines.length) break;
  
      let speaker = '', start=null, end=null, text=[];
      const L1 = lines[i]?.trim() || '';
      const L2 = lines[i+1]?.trim() || '';
  
      // cas A : la 1re ligne est un timecode
      if (timeRe.test(L1)) {
        const m = L1.match(timeRe); start = parseHMSLocal(m[1]); end = parseHMSLocal(m[2]); i++;
  
      // cas B : "Speaker" seul sur une ligne, puis timecode (TON CAS)
      } else if (L1 && !L1.includes(':') && timeRe.test(L2)) {
        speaker = L1;
        const m = L2.match(timeRe); start = parseHMSLocal(m[1]); end = parseHMSLocal(m[2]); i += 2;
  
      // cas C : "Speaker: texte" (aucun timecode)
      } else if (/^.{1,80}:\s+/.test(L1)) {
        const m = L1.match(/^(.{1,80}?)\s*:\s*(.+)$/);
        if (m) { speaker = m[1].trim(); text = [m[2].trim()]; i++; }
        // empile lignes suivantes tant qu'on n'a pas un nouveau timecode/blanc
        while (i<lines.length && lines[i].trim() && !timeRe.test(lines[i].trim())) {
          text.push(lines[i].trim()); i++;
        }
        segs.push({ start:null, end:null, speaker, text:text.join(' ').replace(/\s{2,}/g,' ').trim() });
        continue;
  
      // cas D : ligne brute → on la pousse comme texte sans time/speaker
      } else {
        segs.push({ start:null, end:null, speaker:'', text:L1 });
        i++; continue;
      }
  
      // collecter le texte du bloc timecodé
      while (i<lines.length) {
        const L = lines[i];
        if (!L.trim()) { i++; break; }
        if (timeRe.test(L.trim())) break; // prochain bloc
        const next = lines[i+1]?.trim() || '';
        // heuristique : si la prochaine ligne est un timecode et que celle-ci ressemble à un speaker seul
        if (!timeRe.test(L.trim()) && timeRe.test(next) && L.length<60 && !/[.!?]$/.test(L)) {
          // on s'arrête : c'est sûrement un "Speaker" du prochain bloc
          break;
        }
        text.push(L);
        i++;
      }
      const joined = text.join(' ').replace(/\s{2,}/g,' ').trim();
      segs.push({ start, end, speaker: speaker.trim(), text: joined });
    }
  
    // nettoyage : fusionne "speaker orphelin" + bloc suivant si jamais il en reste
    for (let k=0; k<segs.length-1; k++){
      const a = segs[k], b = segs[k+1];
      if (!a.start && !a.end && a.text && !a.text.includes(':') && b.start && !b.speaker){
        b.speaker = a.text.trim(); segs.splice(k,1); k--;
      }
    }
    return segs.filter(s => s.text && (s.start===null || (Number.isFinite(s.start) && Number.isFinite(s.end))));
  }

  var api = {
    parseRawTranscript: parseRawTranscript,
    fmtHMS: fmtHMS
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.AgiloPrettyTranscript = api;

  if (typeof document === "undefined") return;
  if (root.__AgiloUIv2) return;
  root.__AgiloUIv2 = true;

  function injectPrettyCss() {
    if (document.getElementById("agilo-pretty-transcript-css")) return;
    var style = document.createElement("style");
    style.id = "agilo-pretty-transcript-css";
    style.textContent = "/* Empêche tout \"blocage\" visuel du transcript */\n#transcriptTextContainer, #tabs-container, #ag-pretty-transcript{\n  overflow: visible;\n}\n\n/* Header de segment aligné, crayon inline */\n.ag-seg__head{ \n  display: inline-flex !important; \n  align-items: baseline !important; \n  gap: .35rem !important; \n}\n\n.ag-seg__head .speaker{ \n  display: inline-flex !important; \n  align-items: center !important; \n  gap: .25rem !important; \n  font-weight: 700 !important;\n  opacity: .95 !important;\n}\n\n/* Neutralise le position:absolute du bouton crayon */\n.ag-seg__head .rename-btn.absolute,\n.ag-seg__head .rename-btn{ \n  position: static !important; \n  inset: auto !important; \n  background: none !important; \n  border: 0 !important; \n  padding: 0 !important; \n  line-height: 1 !important; \n  vertical-align: middle !important; \n  opacity: .55 !important; \n  cursor: pointer !important;\n  margin: 0 !important;\n}\n\n.ag-seg__head .rename-btn:hover,\n.ag-seg__head .rename-btn:focus-visible{ \n  opacity: 1 !important; \n}\n\n.ag-seg__head .rename-btn svg{ \n  width: 1em !important; \n  height: 1em !important; \n  display: block !important; \n}\n\n/* Le bouton time doit aussi être bien aligné */\n.ag-seg__head .time{\n  font-family: ui-monospace, Menlo, monospace !important;\n  font-variant-numeric: tabular-nums !important;\n  color: var(--agilo-dim, #525252) !important;\n  background: none !important;\n  border: 0 !important;\n  padding: 0 !important;\n  cursor: pointer !important;\n  line-height: 1 !important;\n}\n\n/* Compteur de résultats compact + rendu des hits */\n.srch-count-chip{\n  display: inline-flex; \n  align-items: center; \n  justify-content: center;\n  min-width: 28px; \n  height: 24px; \n  padding: 0 6px; \n  margin-left: 6px;\n  border-radius: 999px; \n  font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial;\n  background: var(--agilo-surface-2, #f8f9fa); \n  border: 1px solid var(--agilo-border, #343a4040);\n  color: var(--agilo-primary, #174a96);\n}\n\n.search-hit{ \n  background: color-mix(in srgb, var(--color--orange, #fd7e14) 35%, var(--agilo-surface, #fff) 65%); \n  border-radius: .2rem; \n  padding: 0 .15rem; \n}\n\n.search-hit.is-current{ \n  background: color-mix(in srgb, var(--color--orange, #fd7e14) 55%, var(--agilo-surface, #fff) 45%); \n  outline: 2px solid color-mix(in srgb, var(--color--orange, #fd7e14) 70%, transparent); \n}\n\n/* Sécurité mobile */\n@media (max-width: 40rem){\n  #ag-pretty-transcript .time{ display: none; }\n}";
    style.textContent += "#ag-pretty-transcript .ag-seg{margin:0 0 1.1rem;}#ag-pretty-transcript .ag-seg__text{margin-top:.35rem;line-height:1.55;}";
    document.head.appendChild(style);
  }
  injectPrettyCss();

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = id => document.getElementById(id);

  /* ---------- Build UI ---------- */
  function buildRenameBtn(){
    const b=document.createElement('button');
    b.type='button';
    b.className='rename-btn absolute';
    b.setAttribute('aria-label','Renommer');
    b.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon-1x1-small-5"><path d="M0 0h24v24H0z" fill="none"></path><path d="M18.41 5.8L17.2 4.59c-.78-.78-2.05-.78-2.83 0l-2.68 2.68L3 15.96V20h4.04l8.74-8.74 2.63-2.63c.79-.78.79-2.05 0-2.83zM6.21 18H5v-1.21l8.66-8.66 1.21 1.21L6.21 18zM11 20l4-4h6v4H11z" fill="currentColor"></path></svg>';
    return b;
  }

  function mountPretty(raw){
    const host = byId('transcriptTextContainer') || byId('tabs-container');
    const ta = byId('transcriptText');
    if (!host || !ta) return;

    let pretty = byId('ag-pretty-transcript');
    if (!pretty){
      pretty = document.createElement('div');
      pretty.id = 'ag-pretty-transcript';
      pretty.className = 'agilo-transcript';
      host.insertAdjacentElement('afterbegin', pretty);
      ta.style.display='none'; // on garde pour export
    }

    const segs = parseRawTranscript(raw);
    const frag = document.createDocumentFragment();

    segs.forEach(s=>{
      const art = document.createElement('article'); art.className='ag-seg';
      if (Number.isFinite(s.start)) art.dataset.start = s.start;
      if (Number.isFinite(s.end))   art.dataset.end   = s.end;
      art.dataset.speaker = s.speaker || '';

      const head = document.createElement('header'); head.className='ag-seg__head';

      // N'afficher le bouton time que si on a un timestamp valide
      if (Number.isFinite(s.start)) {
        const bt = document.createElement('button'); bt.type='button'; bt.className='time';
        bt.textContent = fmtHMS(s.start);
        bt.dataset.t = String(s.start);
        head.appendChild(bt);
      }

      const sp = document.createElement('span'); sp.className='speaker'; sp.textContent = s.speaker || '';
      head.appendChild(sp);

      head.appendChild(buildRenameBtn());

      const body = document.createElement('div'); body.className='ag-seg__text';
      body.contentEditable='true'; body.spellcheck=false; body.textContent = s.text || '';

      art.appendChild(head); art.appendChild(body); frag.appendChild(art);
    });

    pretty.replaceChildren(frag);

    // Bind une seule fois
    if (!pretty.__bound){
      // Seek (si un lecteur #agilo-audio existe)
      pretty.addEventListener('click', (e)=>{
        const b=e.target.closest('.time'); if (!b) return;
        const t=parseFloat(b.dataset.t||''); const audio = byId('agilo-audio');
        if (audio && !Number.isNaN(t)){ try{ audio.currentTime=t; if (audio.paused) audio.play().catch(()=>{});}catch{} }
      });

      // Rename (propagation + dataset + textarea)
      pretty.addEventListener('click', (e)=>{
        const btn=e.target.closest('.rename-btn'); if(!btn) return;
        const seg = btn.closest('.ag-seg');
        const old = (seg?.dataset?.speaker || seg?.querySelector('.speaker')?.textContent || '').trim();
        const next = prompt('Renommer le locuteur :', old || 'Speaker');
        if (!next || next===old) return;

        $$('.ag-seg', pretty).forEach(el=>{
          const sp = el.querySelector('.speaker');
          if ((el.dataset.speaker||'').trim() === old){ el.dataset.speaker = next; if (sp) sp.textContent = next; }
        });

        // sync textarea (pour export / copier)
        syncTextareaFromPretty();
      });

      // Sync à chaque édition de texte
      pretty.addEventListener('input', ()=> syncTextareaFromPretty());

      pretty.__bound = true;
    }

    // première sync
    syncTextareaFromPretty();
  }

  function serializePretty(){
    const root = byId('ag-pretty-transcript'); if (!root) return byId('transcriptText')?.value || '';
    const rows=[];
    $$('.ag-seg', root).forEach(seg=>{
      const time = $('.time', seg)?.textContent?.trim() || '';
      const sp   = $('.speaker', seg)?.textContent?.trim() || '';
      const tx   = $('.ag-seg__text', seg)?.textContent?.trim() || '';
      if (!tx) return;
      const tprefix = time ? `[${time}] ` : '';
      rows.push(sp ? `${tprefix}${sp}: ${tx}` : `${tprefix}${tx}`);
    });
    return rows.join('\n');
  }
  function syncTextareaFromPretty(){
    const ta = byId('transcriptText'); if (ta) ta.value = serializePretty();
  }

  /* ---------- Recherche (pane actif) ---------- */
  const toolbar = {
    srch: byId('srchQuery') || byId('ag-search'),
    prev: byId('srchPrev')  || document.querySelector('[data-action="search-prev"]'),
    next: byId('srchNext')  || document.querySelector('[data-action="search-next"]'),
    repl: byId('ag-replace'),
    btnRepl: document.querySelector('[data-action="replace-one"]'),
    btnReplAll: document.querySelector('[data-action="replace-all"]')
  };

  // petit chip compteur
  (function ensureChip(){
    if (!toolbar.srch) return;
    if (!byId('srchCountChip')){
      const chip=document.createElement('span');
      chip.id='srchCountChip';
      chip.className='srch-count-chip';
      chip.textContent='0';
      toolbar.srch.insertAdjacentElement('afterend', chip);
    }
  })();
  const chip = byId('srchCountChip');

  let HITS=[], CUR=-1;
  const updChip=()=>{ if (chip) chip.textContent = HITS.length ? `${CUR+1}/${HITS.length}` : '0'; };

  function activePaneEl(){
    const pane = document.querySelector('.w-tab-pane.w--tab-active') || document.querySelector('.edtr-pane.is-active') || document.body;
    if (pane && pane.contains(byId('summaryText'))) return byId('summaryText');
    return byId('ag-pretty-transcript') || byId('transcriptTextContainer') || pane;
  }
  function clearScope(scope){
    scope.querySelectorAll('.search-hit').forEach(n=>n.replaceWith(document.createTextNode(n.textContent||'')));
    scope.normalize?.();
  }
  function clearAll(){
    const scope=activePaneEl(); if (scope) clearScope(scope);
    HITS=[]; CUR=-1; updChip();
  }
  function buildRx(q){ if(!q) return null; const esc=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return new RegExp(esc,'gi'); }

  function highlight(){
    const q=(toolbar.srch?.value||'').trim(); const rx=buildRx(q);
    clearAll(); if (!rx) return;
    const scope = activePaneEl(); if (!scope) return;

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(n){
        const txt=n.nodeValue||''; if(!txt.trim()) return NodeFilter.FILTER_REJECT;
        if(n.parentNode?.closest('script,style,iframe,.search-hit')) return NodeFilter.FILTER_REJECT;
        return rx.test(txt)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
      }
    });
    const nodes=[]; let node; while(node=walker.nextNode()) nodes.push(node);
    nodes.forEach(n=>{
      const t=n.nodeValue; let last=0, m; rx.lastIndex=0;
      const frag=document.createDocumentFragment();
      while(m=rx.exec(t)){
        const i=m.index,j=i+m[0].length;
        if(i>last) frag.appendChild(document.createTextNode(t.slice(last,i)));
        const span=document.createElement('span'); span.className='search-hit'; span.textContent=t.slice(i,j);
        frag.appendChild(span); HITS.push(span); last=j; if(!m[0].length) break;
      }
      if(last<t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      n.replaceWith(frag);
    });

    if(HITS.length){
      CUR=0; HITS[0].classList.add('is-current');
      HITS[0].scrollIntoView({behavior:'smooth', block:'nearest'});
      updChip();
    }
  }

  function goto(step){
    if(!HITS.length) return;
    HITS.forEach(h=>h.classList.remove('is-current'));
    CUR=(CUR+step+HITS.length)%HITS.length;
    const el=HITS[CUR]; el.classList.add('is-current');
    el.scrollIntoView({behavior:'smooth',block:'center'});
    updChip();
    // focus doux sur l'input (sans casser le scroll)
    const pos = toolbar.srch?.value.length||0;
    toolbar.srch?.focus({preventScroll:true});
    try{ toolbar.srch?.setSelectionRange(pos,pos);}catch{}
  }

  const debounce=(fn, d=120)=>{ let t; return ()=>{ clearTimeout(t); t=setTimeout(fn,d); } };
  toolbar.srch && toolbar.srch.addEventListener('input', debounce(highlight, 140));
  toolbar.next && toolbar.next.addEventListener('click', ()=>goto(+1));
  toolbar.prev && toolbar.prev.addEventListener('click', ()=>goto(-1));
  toolbar.srch && toolbar.srch.addEventListener('keydown', (e)=>{
    if (e.key==='Enter'){ e.preventDefault(); e.shiftKey?goto(-1):goto(+1); }
  });

  // Replace (optionnel)
  function doReplaceOne(){
    if (CUR<0||!HITS[CUR]) return;
    const repl = toolbar.repl?.value ?? '';
    const el = HITS[CUR]; el.textContent = repl; el.parentNode?.normalize?.();
    const keep=CUR; highlight(); if (HITS.length){ CUR=Math.min(keep,HITS.length-1); HITS[CUR]?.classList.add('is-current'); updChip(); }
    syncTextareaFromPretty();
  }
  function doReplaceAll(){
    const q=(toolbar.srch?.value||'').trim(); if(!q) return;
    const rx=buildRx(q); if(!rx) return;
    const repl = toolbar.repl?.value ?? '';
    const scopes = [ activePaneEl() ];
    scopes.forEach(scope=>{
      const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(n){
          if (!n?.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode?.closest('script,style,iframe')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let n, nodes=[]; while(n=w.nextNode()) nodes.push(n);
      nodes.forEach(node=>{ node.textContent = node.textContent.replace(rx,repl); });
      scope.normalize();
    });
    highlight(); syncTextareaFromPretty();
  }
  toolbar.btnRepl && toolbar.btnRepl.addEventListener('click', doReplaceOne);
  toolbar.btnReplAll && toolbar.btnReplAll.addEventListener('click', doReplaceAll);

  // Cmd/Ctrl+F → focus sur le champ Recherche (sans bloquer le scroll)
  window.addEventListener('keydown',(e)=>{
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(e.key==='f'||e.code==='KeyF')){
      const input = toolbar.srch;
      if (input){ e.preventDefault(); input.focus({preventScroll:true}); try{ input.select(); }catch{} }
    }
  }, true);

  // Re-highlight quand on change d'onglet (Webflow)
  $$('.w-tab-menu .w-tab-link').forEach(a=>a.addEventListener('click', debounce(highlight, 80)));
  window.addEventListener('agilo:rehighlight', debounce(highlight, 80));

  /* ---------- Entrées : textarea déjà rempli OU event "transcript-ready" ---------- */
  function tryAutoMount(){
    const ta = byId('transcriptText'); const v = ta?.value || '';
    if (v.trim()) { mountPretty(v); highlight(); return true; }
    return false;
  }
  // au cas où ton code remplit le textarea sans déclencher d'event
  setTimeout(()=>{ if (!tryAutoMount()){ /* fallback: recheck plus tard */ setTimeout(tryAutoMount, 1000); } }, 0);

  // chemin normal (cf. patch Main logic)
  window.addEventListener('agilo:transcript-ready', (e)=>{
    const text = e?.detail?.text || byId('transcriptText')?.value || '';
    if (text) { mountPretty(text); highlight(); }
  });

  // expose un mini-API si besoin
  window.AgiloUI = {
    setTranscript(txt){ const ta=byId('transcriptText'); if (ta) ta.value=txt; mountPretty(txt); highlight(); },
    mountPrettyFromTextarea(){ tryAutoMount(); }
  };

})(typeof window !== "undefined" ? window : globalThis);
