// Agilotext - Editor CSS - STAGING
// ⚠️ VERSION STAGING POUR TESTS - Ne pas utiliser en production
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-css dans Webflow

(function () {
  if (document.getElementById('agilo-editor-css')) return;

  const css = `
/* =====================================================================
   THEME AGILO — mappé sur tes tokens Webflow (NEW_Light_2025)
   ===================================================================== */
:root{
  --agilo-primary: var(--color--blue, #174a96);
  --agilo-primary-soft: color-mix(in srgb, var(--color--blue, #174a96) 18%, transparent);
  --agilo-text: var(--color--gris_foncé, #020202);
  --agilo-dim: var(--color--gris, #525252);
  --agilo-surface: var(--color--white, #ffffff);
  --agilo-surface-2: var(--color--blanc_gris, #f8f9fa);
  --agilo-border: var(--color--noir_25, #343a4040);
  --agilo-divider: color-mix(in srgb, var(--agilo-text) 14%, transparent);
  --agilo-shadow:
    0 1px 2px color-mix(in srgb, var(--agilo-text) 8%, transparent),
    0 4px 10px color-mix(in srgb, var(--agilo-text) 6%, transparent);

  --agilo-radius: var(--0-5_radius, .5rem);
  --agilo-gap: .625rem;
  --agilo-focus: 2px solid color-mix(in srgb, var(--agilo-primary) 70%, transparent);
}

/* =====================================================================
   LECTEUR AUDIO — compact & clean
   ===================================================================== */
.agilo-player{
  display:grid;
  gap:var(--agilo-gap);
  padding:.9rem;
  margin-bottom:1rem;
  background:var(--agilo-surface);
  color:var(--agilo-text);
  border:1px solid var(--agilo-border);
  border-radius:var(--agilo-radius);
  box-shadow:var(--agilo-shadow);
  font:500 .95rem/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;
}
.agilo-bar{
  display:flex;
  align-items:center;
  gap:.5rem;
  flex-wrap:wrap;
}
.agilo-spacer{
  flex:1;
  min-width:.5rem;
}

.agilo-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  height:2.4rem;
  min-width:2.4rem;
  padding:0 .9rem;
  border-radius:.625rem;
  border:1px solid var(--agilo-border);
  background:var(--agilo-surface-2);
  color:inherit;
  cursor:pointer;
  user-select:none;
  transition:background .15s ease, transform .06s ease, box-shadow .15s ease;
}
.agilo-btn:hover{
  background: color-mix(in srgb, var(--agilo-surface-2) 86%, var(--agilo-primary) 14%);
}
.agilo-btn:active{
  transform:translateY(.0625rem);
}
.agilo-btn:focus-visible{
  outline: var(--agilo-focus);
  outline-offset: 2px;
}
.agilo-btn.is-primary{
  background:var(--agilo-primary);
  color:var(--color--white,#fff);
  border-color:transparent;
}
.agilo-btn[disabled]{
  opacity:.6;
  cursor:not-allowed;
}
.agilo-speed{
  min-width:3.25rem;
}

/* ====== Timeline sous la barre (style Netflix) ====== */
.agilo-timeline{
  display:flex;
  flex-direction:column;
  gap:6px;
}

.agilo-times{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:0 2px;
  font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
  color: var(--agilo-dim);
}

.ag-time{
  position:static;
  transform:none;
  font-variant-numeric: tabular-nums;
  background: transparent;
  padding: 0;
  border: 0;
  user-select:none;
}

.ag-time--left{
  color: var(--agilo-dim);
}
.ag-time--right{
  color: var(--color--gris, #525252);
  background: var(--color--blanc_gris, #f8f9fa);
  border: 1px solid var(--agilo-border);
  padding: 3px 8px;
  border-radius: 12px;
}
.agilo-vol{
  display:inline-flex;
  align-items:center;
  gap:.375rem;
}
.agilo-vol input[type="range"]{
  -webkit-appearance:none;
  appearance:none;
  width:6.5rem;
  height:.44rem;
  border-radius:999px;
  outline:none;
  cursor:pointer;
  background: color-mix(in srgb, var(--agilo-text) 10%, var(--agilo-surface-2) 90%);
}
.agilo-vol input[type="range"]::-webkit-slider-thumb{
  -webkit-appearance:none;
  width:14px;
  height:14px;
  border-radius:50%;
  background: var(--agilo-primary);
  border:2px solid var(--agilo-surface);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--agilo-text) 25%, transparent);
}
.agilo-vol input[type="range"]::-moz-range-thumb{
  width:14px;
  height:14px;
  border-radius:50%;
  background: var(--agilo-primary);
  border:2px solid var(--agilo-surface);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--agilo-text) 25%, transparent);
}

/* Timeline */
.agilo-track{
  position:relative;
  height:.56rem;
  border-radius:999px;
  overflow:hidden;
  background: color-mix(in srgb, var(--agilo-text) 10%, var(--agilo-surface-2) 90%);
  transition:opacity .15s ease;
}
.agilo-buffered,
.agilo-progress{
  position:absolute;
  inset:0 auto 0 0;
  height:100%;
  border-radius:inherit;
  pointer-events:none;
}
.agilo-buffered{
  background: color-mix(in srgb, var(--agilo-text) 18%, var(--agilo-surface-2) 82%);
  width:0%;
}
.agilo-progress{
  background: var(--agilo-primary-soft);
  width:0%;
}

.agilo-thumb{
  position:absolute;
  top:50%;
  left:0%;
  transform:translate(-50%,-50%);
  width:14px;
  height:14px;
  border-radius:50%;
  background: var(--agilo-primary);
  border:2px solid var(--agilo-surface);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--agilo-text) 25%, transparent);
  pointer-events:none;
  z-index:1;
}
.agilo-track.is-dragging .agilo-thumb{
  transform:translate(-50%,-50%) scale(1.06);
}

.agilo-hover{
  position:absolute;
  top:-26px;
  left:0;
  transform:translateX(-50%);
  z-index:2;
  padding:2px 6px;
  border-radius:6px;
  background: var(--agilo-surface);
  border:1px solid var(--agilo-border);
  color: var(--agilo-text);
  box-shadow: var(--agilo-shadow);
  font: 600 11px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
  display:none;
  white-space:nowrap;
}
.agilo-track.show-hover .agilo-hover{
  display:block;
}

#agilo-audio-wrap.is-locked .agilo-track{
  opacity:.55;
  cursor:not-allowed;
}
#agilo-audio-wrap.is-locked .agilo-btn{
  opacity:.7;
  cursor:not-allowed;
}
#agilo-audio-wrap.is-locked input[type="range"]{
  pointer-events:none;
  opacity:.7;
}

@media (max-width: 560px){
  .agilo-player{
    padding: .75rem .75rem calc(.75rem + env(safe-area-inset-bottom, 0));
    gap: .75rem;
  }
  .agilo-bar{
    flex-wrap: wrap;
    gap: .5rem .5rem;
  }
  .agilo-spacer{ display:none; }
  .agilo-btn{
    height: 2.75rem;
    min-width: 2.75rem;
  }
  .agilo-btn.is-primary{
    flex: 1 1 10.5rem;
    min-width: 9rem;
  }
  .agilo-speed{ min-width: 3rem; }
  .agilo-vol input[type="range"]{ width: 5.25rem; }
  .agilo-timeline{ gap: 8px; }
  .agilo-track{ height: .68rem; }
  .agilo-thumb{ width: 16px; height: 16px; }
  .agilo-times{ font-size: 11px; padding: 0 1px; }
  .ag-time--right{ padding: 3px 7px; }
}

@media (max-width: 360px){
  .agilo-btn.is-primary{ flex-basis: 100%; }
  .agilo-vol{
    width: 100%;
    justify-content: space-between;
  }
  .agilo-vol input[type="range"]{
    width: 100%;
    max-width: none;
  }
  .agilo-speed{ order: 2; }
}

/* =====================================================================
   TRANSCRIPT (léger, non intrusif)
   ===================================================================== */
.agilo-transcript,
#ag-transcript,
#transcriptEditor{
  display:block;
  line-height:1.6;
  margin-top:.5rem;
}

.ag-seg__head .speaker.is-placeholder{
  opacity:.65;
  font-style:italic;
}

.agilo-seg,
.ag-seg{
  position:relative;
  margin:.25rem 0;
  padding:.35rem 0 .45rem;
  background:transparent !important;
  border:0 !important;
  box-shadow:none !important;
  outline:0 !important;
  border-bottom:1px solid var(--agilo-divider);
  cursor:default;
  transition:border-color .12s ease, background .12s ease;
}
.agilo-seg:last-child,
.ag-seg:last-child{
  border-bottom-color:transparent;
}
.agilo-seg:hover,
.ag-seg:hover{
  border-bottom-color: color-mix(in srgb, var(--agilo-primary) 25%, transparent);
}

.agilo-seg.is-active,
.ag-seg.is-active{
  opacity:1 !important;
  color:var(--agilo-text) !important;
  background:linear-gradient(
    90deg,
    color-mix(in srgb, var(--agilo-primary) 6%, transparent),
    color-mix(in srgb, var(--agilo-primary) 2%, transparent)
  ) !important;
  border-left:3px solid var(--agilo-primary);
  padding-left:.5rem;
}

.agilo-seg .ag-time,
.agilo-seg .time,
.ag-seg .ag-time,
.ag-seg .time{
  font-family:ui-monospace,Menlo,monospace;
  font-variant-numeric:tabular-nums;
  color:var(--agilo-dim);
  margin-right:.5rem;
  background:none;
  border:0;
  padding:0;
  cursor:pointer;
}
.agilo-seg .ag-time:focus-visible,
.ag-seg .time:focus-visible{
  outline:var(--agilo-focus);
  outline-offset:2px;
}
.agilo-seg .ag-spk,
.ag-seg .speaker{
  font-weight:700;
  opacity:.95;
  margin-right:.35rem;
}

.ag-seg__text{
  white-space:pre-wrap;
  outline:none;
  color:inherit;
}

#pane-transcript .ag-seg__head{
  display:inline-flex;
  align-items:baseline;
  gap:.35rem;
}
#pane-transcript .ag-seg__head .speaker{
  display:inline-flex;
  align-items:center;
  gap:.25rem;
}
#pane-transcript .ag-seg__head .rename-btn.absolute{
  position:static !important;
  inset:auto !important;
}
#pane-transcript .ag-seg__head .rename-btn{
  background:none;
  border:0;
  padding:0;
  line-height:1;
  vertical-align:middle;
  opacity:.55;
  cursor:pointer;
}
#pane-transcript .ag-seg__head .rename-btn:hover,
#pane-transcript .ag-seg__head .rename-btn:focus-visible{
  opacity:1;
  outline:var(--agilo-focus);
  outline-offset:2px;
}
#pane-transcript .ag-seg__head .rename-btn svg{
  width:1em;
  height:1em;
  display:block;
}

.search-hit{
  background: color-mix(in srgb, var(--color--orange,#fd7e14) 35%, var(--agilo-surface) 65%);
  border-radius:.2rem;
  padding:0 .15rem;
}
.search-hit.is-current{
  background: color-mix(in srgb, var(--color--orange,#fd7e14) 55%, var(--agilo-surface) 45%);
  outline:2px solid color-mix(in srgb, var(--color--orange,#fd7e14) 70%, transparent);
}

.ag-alert{
  background: color-mix(in srgb, var(--agilo-surface-2) 80%, var(--agilo-primary) 20%);
  border: 1px solid var(--agilo-border);
  color: var(--agilo-text);
  border-radius: var(--agilo-radius);
  padding: 12px 14px;
  margin: 8px 0;
}
.ag-alert--warn{
  background: color-mix(in srgb, var(--color--orange,#fd7e14) 10%, var(--agilo-surface) 90%);
  border-color: color-mix(in srgb, var(--color--orange,#fd7e14) 35%, var(--agilo-border) 65%);
}
.ag-alert__title{
  font-weight:600;
  margin-bottom:4px;
}
.ag-alert__details summary{
  cursor:pointer;
  color: var(--agilo-dim);
  margin-top:6px;
}
.ag-alert__details pre{
  white-space:pre-wrap;
  background:var(--agilo-surface);
  border:1px dashed var(--agilo-border);
  padding:8px;
  border-radius: var(--agilo-radius);
  max-height:240px;
  overflow:auto;
}

.button.save[disabled]{
  opacity:.75;
  pointer-events:none;
}
.button.save.is-loading{
  position:relative;
}
.button.save.is-loading::after{
  content:'';
  position:absolute;
  left:12px;
  top:50%;
  transform:translateY(-50%);
  width:14px;
  height:14px;
  border-radius:50%;
  border:2px solid currentColor;
  border-right-color:transparent;
  animation: agspin .7s linear infinite;
}
.button.save.is-saved{
  box-shadow:0 0 0 2px color-mix(in srgb, var(--agilo-primary) 35%, transparent) inset;
}
@keyframes agspin{
  to{ transform:translateY(-50%) rotate(360deg) }
}

#agilo-audio-wrap{
  position:relative;
}

.agilo-preload{
  position:absolute;
  inset:0;
  display:none;
  z-index:5;
  align-items:center;
  justify-content:center;
  background: color-mix(in srgb, var(--agilo-text) 7%, transparent);
  backdrop-filter: blur(1px) saturate(.95);
}
.agilo-preload.is-visible{
  display:flex;
}

.agilo-preload__card{
  min-width:240px;
  max-width:min(90%,420px);
  background:var(--agilo-surface);
  color:var(--agilo-text);
  border:1px solid var(--agilo-border);
  border-radius:var(--agilo-radius);
  box-shadow:var(--agilo-shadow);
  padding:12px 14px;
  text-align:center;
  font:500 .95rem/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;
}
.agilo-preload__title{
  font-weight:700;
  margin:2px 0 8px;
}
.agilo-preload__bar{
  height:8px;
  border-radius:999px;
  overflow:hidden;
  background: color-mix(in srgb, var(--agilo-text) 10%, var(--agilo-surface-2) 90%);
}
.agilo-preload__bar-fill{
  height:100%;
  width:0%;
  border-radius:inherit;
  background: var(--agilo-primary-soft);
  transition: width .25s ease;
}
.agilo-preload.is-indeterminate .agilo-preload__bar-fill{
  width:100%;
  --stripes: repeating-linear-gradient(
    45deg,
    color-mix(in srgb, var(--agilo-primary) 40%, transparent) 0 10px,
    color-mix(in srgb, var(--agilo-primary) 25%, transparent) 10px 20px
  );
  background-image: var(--stripes);
  animation: agilo-preload-stripes 1.1s linear infinite;
}
@keyframes agilo-preload-stripes{
  from{ background-position:0 0; }
  to{ background-position:40px 0; }
}
.agilo-preload__txt{
  margin-top:8px;
  font-size:12px;
  color:var(--agilo-dim);
}

@media (max-width:40rem){
  .agilo-player{ padding:.75rem; }
  .agilo-vol{ display:none; }
  .agilo-track{ height:.48rem; }
  .agilo-times{ font-size:11px; }
}

@media (prefers-reduced-motion: reduce){
  *{
    animation-duration:.001ms !important;
    animation-iteration-count:1 !important;
    transition:none !important;
  }
}

.visually-hidden{
  position:absolute !important;
  width:1px;
  height:1px;
  padding:0;
  margin:-1px;
  overflow:hidden;
  clip:rect(0 0 0 0);
  white-space:nowrap;
  border:0;
}

/* =====================================================================
   COMPTE-RENDU (SUMMARY) - Gestion du débordement
   ===================================================================== */
#summaryEditor,
#ag-summary,
[data-editor="summary"],
.edtr-pane#pane-summary{
  overflow-x: auto;
  overflow-y: visible;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  box-sizing: border-box;
}

/* ⚠️ RÉSUMÉ EN LECTURE SEULE (demandé par Nicolas) */
#summaryEditor.ag-summary-readonly,
#ag-summary.ag-summary-readonly,
[data-editor="summary"].ag-summary-readonly{
  contenteditable: false !important;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
  cursor: default;
  pointer-events: auto; /* Permettre la sélection et le clic pour copier */
}

/* Empêcher l'édition même si contenteditable est activé ailleurs */
#summaryEditor.ag-summary-readonly *,
#ag-summary.ag-summary-readonly *,
[data-editor="summary"].ag-summary-readonly *{
  contenteditable: false !important;
  pointer-events: auto; /* Permettre la sélection du texte */
}

/* Tableaux dans le compte-rendu */
#summaryEditor table,
#ag-summary table,
[data-editor="summary"] table{
  width: 100% !important;
  max-width: 100% !important;
  table-layout: auto;
  border-collapse: collapse;
  margin: 1rem 0;
  box-sizing: border-box;
}

/* Cellules de tableau */
#summaryEditor table td,
#summaryEditor table th,
#ag-summary table td,
#ag-summary table th,
[data-editor="summary"] table td,
[data-editor="summary"] table th{
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  word-wrap: break-word;
  overflow-wrap: break-word;
  box-sizing: border-box;
}

/* Blocs de code et pre */
#summaryEditor pre,
#summaryEditor code,
#ag-summary pre,
#ag-summary code,
[data-editor="summary"] pre,
[data-editor="summary"] code{
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  box-sizing: border-box;
}

/* Divs et conteneurs génériques */
#summaryEditor > div,
#summaryEditor > *,
#ag-summary > div,
#ag-summary > *,
[data-editor="summary"] > div,
[data-editor="summary"] > *{
  max-width: 100%;
  box-sizing: border-box;
}

/* Images dans le compte-rendu */
#summaryEditor img,
#ag-summary img,
[data-editor="summary"] img{
  max-width: 100%;
  height: auto;
  box-sizing: border-box;
}

/* Éléments avec largeur fixe ou pourcentage */
#summaryEditor [width],
#summaryEditor [style*="width"],
#ag-summary [width],
#ag-summary [style*="width"],
[data-editor="summary"] [width],
[data-editor="summary"] [style*="width"]{
  max-width: 100% !important;
  box-sizing: border-box;
}

/* Assurer que les tableaux avec width="85%" respectent le conteneur */
#summaryEditor table[width],
#ag-summary table[width],
[data-editor="summary"] table[width]{
  width: 100% !important;
  max-width: 100% !important;
}

/* Conteneurs avec align="center" */
#summaryEditor [align="center"],
#ag-summary [align="center"],
[data-editor="summary"] [align="center"]{
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-editor-css';
  style.textContent = css;
  document.head.appendChild(style);
})();

