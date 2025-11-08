// Agilotext - Chat CSS
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-css-chat dans Webflow

(function () {
  if (document.getElementById('agilo-chat-css')) return;

  const css = `
/* ===========================================================
   CHAT / MESSAGES — Harmonisé avec tes variables globales
   =========================================================== */

#chatView{
  display:flex;
  flex-direction:column;
  gap: .9rem;
  padding: .25rem 0;
  overflow:auto;
}

#btnAsk.is-busy{ opacity:.65; pointer-events:none; }

.msg{
  display:flex;
  flex-direction:column;
  max-width:72ch;
  animation: chat-slide-in .28s ease-out;
}
.msg--user{ align-self:flex-end; }
.msg--ai{   align-self:flex-start; }
.msg--sys{  align-self:center; opacity:.85; }

.msg-meta{
  font:600 .72rem/1.2 system-ui,-apple-system,Segoe UI,Roboto;
  color: var(--agilo-dim, var(--color--gris, #525252));
  margin: 0 0 .35rem;
}

.msg-bubble{
  padding: .85rem 1rem;
  border-radius: var(--0-5_radius, .5rem);
  background: var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
  color: var(--agilo-text, var(--color--gris_foncé, #020202));
  border: 1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
  box-shadow: var(--agilo-shadow, 0 1px 2px rgba(0,0,0,.08), 0 4px 10px rgba(0,0,0,.06));
  white-space: normal;
  line-height: 1.6;
}

.msg--user .msg-bubble{
  background: var(--agilo-primary, var(--color--blue, #174a96));
  color: var(--color--white, #fff);
  border-color: transparent;
}

.msg-bubble h1,.msg-bubble h2,.msg-bubble h3{
  margin:.8em 0 .4em; font-weight:700; line-height:1.3;
}
.msg-bubble h1{ font-size:1.5em; }
.msg-bubble h2{ font-size:1.25em; }
.msg-bubble h3{ font-size:1.05em; }
.msg-bubble p{ margin:.45em 0; }
.msg-bubble ul,.msg-bubble ol{ margin:.35em 0 .6em 1.25em; padding:0; }
.msg-bubble li{ margin:.15em 0; }
.msg-bubble hr{
  border:0; margin:.6em 0;
  border-top:1px solid var(--agilo-divider, color-mix(in srgb, var(--agilo-text, #0b1222) 14%, transparent));
}
.msg-bubble a{
  color: var(--agilo-primary, var(--color--blue, #174a96));
  text-decoration: underline;
}
.msg-bubble blockquote{
  margin:.6em 0; padding:.45em .8em; border-radius:.35rem;
  border-left:3px solid var(--agilo-primary, var(--color--blue, #174a96));
  background: color-mix(in srgb,
              var(--agilo-primary, var(--color--blue, #174a96)) 6%,
              var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa)));
}
.msg-bubble code{
  font-family: ui-monospace, Menlo, monospace;
  background: color-mix(in srgb,
              var(--agilo-text, var(--color--gris_foncé, #020202)) 8%,
              var(--agilo-surface, var(--color--white, #fff)));
  padding:.05em .35em; border-radius:.3em;
}
.msg-bubble pre{
  background: color-mix(in srgb,
              var(--agilo-text, var(--color--gris_foncé, #020202)) 92%,
              var(--agilo-surface, var(--color--white, #fff)));
  color: var(--color--white, #fff);
  padding:.7em .85em; border-radius: var(--0-5_radius, .5rem);
  overflow:auto;
}
.msg-bubble pre code{ background:transparent; padding:0; }

.msg-actions,
.msg-tools{
  display:flex;
  flex-wrap:wrap;
  gap:.4rem;
  margin:.45rem 0 0;
  padding-top:.55rem;
  border-top:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
}
.msg-action-btn{
  appearance:none;
  cursor:pointer;
  user-select:none;
  border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
  background: var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
  color: var(--agilo-text, var(--color--gris_foncé, #020202));
  padding:.36rem .6rem;
  border-radius:.45rem;
  font:600 .78rem/1 system-ui,-apple-system,Segoe UI,Roboto;
  transition: background .15s, transform .06s, color .15s, border-color .15s;
}
.msg-action-btn:hover{
  background: color-mix(in srgb,
              var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa)) 70%,
              var(--agilo-primary, var(--color--blue, #174a96)) 30%);
  color: var(--color--white, #fff);
  border-color: transparent;
}
.msg-action-btn:active{ transform: translateY(.0625rem); }
.msg-action-btn:focus-visible{
  outline: var(--agilo-focus, 2px solid color-mix(in srgb, var(--agilo-primary) 70%, transparent));
  outline-offset: 2px;
}
.msg-action-btn[disabled]{ opacity:.6; cursor:not-allowed; }

.msg-bubble h4,.msg-bubble h5,.msg-bubble h6{
  margin:.65em 0 .35em; font-weight:700; line-height:1.3;
}
.msg-bubble h4{ font-size:1.0em; }
.msg-bubble h5{ font-size:.95em; }
.msg-bubble h6{ font-size:.9em; }

.msg-bubble table.md-table{
  width:100%; border-collapse:collapse;
  margin:.55em 0 .85em; font-size:.95em;
  border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
}
.msg-bubble .md-table th,
.msg-bubble .md-table td{
  padding:.45em .6em; vertical-align:top;
  border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
}
.msg-bubble .md-table thead th{
  background: color-mix(in srgb,
              var(--agilo-primary, var(--color--blue, #174a96)) 6%,
              var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa)));
  font-weight:700;
}
.msg-bubble .md-table tbody tr:nth-child(odd){
  background: color-mix(in srgb,
              var(--agilo-text, var(--color--gris_foncé, #020202)) 3%,
              var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa)));
}

.msg-bubble ul ul,
.msg-bubble ol ol{ margin:.25em 0 .5em 1.25em; }

.msg-bubble li input[type="checkbox"]{
  margin-right:.35em; transform:translateY(2px);
}

.msg-bubble .agilo-tc{
  display:inline-flex; align-items:center; gap:.25rem;
  border:1px solid var(--agilo-border, var(--color--noir_25, #343a4040));
  background: var(--agilo-surface-2, var(--color--blanc_gris, #f8f9fa));
  color: var(--agilo-text, var(--color--gris_foncé, #020202));
  padding:.08rem .35rem; border-radius:.35rem;
  font:600 .78rem/1 system-ui,-apple-system,Segoe UI,Roboto; cursor:pointer;
}
.msg-bubble .agilo-tc:hover{
  background: color-mix(in srgb,
              var(--agilo-surface-2, #f8f9fa) 70%,
              var(--agilo-primary, #174a96) 30%);
  color:#fff; border-color:transparent;
}
.msg-bubble li + ul,
.msg-bubble li + ol{
  margin-top:.25em;
  margin-bottom:.5em;
  margin-left:1.25em;
}

.msg-bubble blockquote p{ margin:.25em 0; }

.thinking-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color--gris, #6b7280);
  font-weight: 500;
  font-size: 14px;
}

.thinking-dots {
  display: inline-flex;
  gap: 4px;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color--gris, #6b7280);
  animation: thinking-pulse 1.4s ease-in-out infinite;
}

.thinking-dot:nth-child(1) { animation-delay: 0s; }
.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-pulse {
  0%, 60%, 100% { 
    opacity: 0.3; 
    transform: scale(0.8); 
  }
  30% { 
    opacity: 1; 
    transform: scale(1); 
  }
}

.thinking-indicator {
  animation: thinking-fade-in 0.3s ease-out;
}

@keyframes thinking-fade-in {
  from { 
    opacity: 0; 
    transform: translateY(10px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

@keyframes chat-slide-in{
  from{ opacity:0; transform:translateY(10px); }
  to{   opacity:1; transform:translateY(0); }
}

@media (max-width: 40rem){
  #chatView{ gap: .7rem; }
  .msg-bubble{ padding:.75rem .85rem; }
  .msg-actions .msg-action-btn{ font-size:.74rem; }
}

@media (prefers-reduced-motion: reduce){
  *{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition:none !important; }
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-chat-css';
  style.textContent = css;
  document.head.appendChild(style);
})();

