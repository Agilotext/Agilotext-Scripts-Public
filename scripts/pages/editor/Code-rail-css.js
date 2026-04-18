// Agilotext - Rail CSS
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-rail-css dans Webflow

(function () {
  if (document.getElementById('agilo-rail-css')) return;

  const css = `
/* =====================================================================
   RAIL — Liste des jobs (styles de base)
   ===================================================================== */
.ed-rail,
#rail-list,
.rail-list{
  display:flex;
  flex-direction:column;
  gap:.5rem;
}

.rail-item{
  padding:.75rem;
  border:1px solid var(--agilo-border, rgba(0,0,0,.12));
  border-radius:var(--agilo-radius, .5rem);
  background:var(--agilo-surface, #fff);
  cursor:pointer;
  transition:background .15s ease, border-color .15s ease;
}

.rail-item:hover{
  background:var(--agilo-surface-2, #f8f9fa);
  border-color:var(--agilo-primary, #174a96);
}

.rail-item.is-active{
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 8%, transparent);
  border-color:var(--agilo-primary, #174a96);
}

@media (prefers-reduced-motion: reduce){
  .rail-item{
    transition:none;
  }
}

/* Barre dossiers (éditeur) — toolbar lisible, chips scrollables si beaucoup de dossiers */
.agilo-folder-bar{
  display:flex;
  flex-wrap:wrap;
  align-items:stretch;
  gap:.5rem .65rem;
  margin-bottom:.75rem;
  padding:.6rem .65rem;
  border:1px solid color-mix(in srgb, var(--agilo-text, #020202) 10%, transparent);
  border-radius:var(--agilo-radius, .5rem);
  background:linear-gradient(180deg, var(--agilo-surface, #fff) 0%, var(--agilo-surface-2, #f8f9fa) 100%);
  box-shadow:0 1px 2px color-mix(in srgb, var(--agilo-text, #020202) 6%, transparent);
  font-size:.8125rem;
  row-gap:.55rem;
}
.agilo-folder-bar .agilo-folder-label{
  flex:0 0 100%;
  font-weight:600;
  font-size:.7rem;
  letter-spacing:.02em;
  text-transform:uppercase;
  color:var(--agilo-dim, #525252);
  margin:0 0 .1rem 0;
}
@media (min-width:520px){
  .agilo-folder-bar .agilo-folder-label{
    flex:0 0 auto;
    align-self:center;
    margin:0 .35rem 0 0;
  }
}
.agilo-folder-bar .agilo-folder-chips{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:.35rem;
  flex:1 1 12rem;
  min-width:0;
  max-width:100%;
  padding:.15rem 0;
}
.agilo-folder-bar button.agilo-folder-chip{
  border:1px solid color-mix(in srgb, var(--agilo-text, #020202) 14%, transparent);
  background:var(--agilo-surface, #fff);
  border-radius:999px;
  padding:.35rem .7rem;
  min-height:2rem;
  cursor:pointer;
  line-height:1.2;
  font-size:.8125rem;
  font-weight:500;
  color:var(--agilo-text, #020202);
  box-shadow:0 1px 1px color-mix(in srgb, var(--agilo-text, #020202) 5%, transparent);
  transition:background .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.agilo-folder-bar button.agilo-folder-chip:hover{
  border-color:color-mix(in srgb, var(--agilo-primary, #174a96) 45%, transparent);
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 6%, #fff);
}
.agilo-folder-bar button.agilo-folder-chip:focus-visible{
  outline:2px solid var(--agilo-primary, #174a96);
  outline-offset:2px;
}
.agilo-folder-bar button.agilo-folder-chip.is-active{
  border-color:var(--agilo-primary, #174a96);
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 14%, #fff);
  font-weight:600;
  box-shadow:0 1px 3px color-mix(in srgb, var(--agilo-primary, #174a96) 25%, transparent);
}
.agilo-folder-bar button.agilo-folder-chip--new{
  border-style:dashed;
  font-weight:500;
  color:var(--agilo-dim, #525252);
}
.agilo-folder-bar button.agilo-folder-chip--new:hover{
  color:var(--agilo-primary, #174a96);
}
.agilo-folder-bar .agilo-folder-move{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:.4rem;
  flex:1 1 100%;
  margin:0;
  padding-top:.45rem;
  border-top:1px solid color-mix(in srgb, var(--agilo-text, #020202) 8%, transparent);
}
@media (min-width:720px){
  .agilo-folder-bar .agilo-folder-move{
    flex:0 1 auto;
    margin-left:auto;
    padding-top:0;
    border-top:none;
    max-width:min(100%, 22rem);
  }
}
.agilo-folder-bar .agilo-folder-move select{
  flex:1 1 8rem;
  min-width:0;
  max-width:14rem;
  padding:.4rem .5rem;
  border-radius:var(--agilo-radius, .5rem);
  border:1px solid color-mix(in srgb, var(--agilo-text, #020202) 16%, transparent);
  background:var(--agilo-surface, #fff);
  font-size:.8125rem;
  color:var(--agilo-text, #020202);
}
.agilo-folder-bar .agilo-folder-move button[type="button"],
.agilo-folder-bar .agilo-folder-move button:not(.agilo-folder-chip){
  padding:.4rem .75rem;
  border-radius:var(--agilo-radius, .5rem);
  border:1px solid color-mix(in srgb, var(--agilo-primary, #174a96) 35%, transparent);
  background:var(--agilo-primary, #174a96);
  color:#fff;
  font-size:.8125rem;
  font-weight:600;
  cursor:pointer;
  white-space:nowrap;
}
.agilo-folder-bar .agilo-folder-move button[type="button"]:hover,
.agilo-folder-bar .agilo-folder-move button:not(.agilo-folder-chip):hover{
  filter:brightness(1.06);
}
.ri-folder-hint{
  display:block;
  font-size:.7rem;
  opacity:.72;
  margin-top:.15rem;
}

.rail-loading{
  padding:.75rem;
  font-size:.8125rem;
  color:var(--agilo-muted, #6b7280);
}
.rail-empty{
  padding:.75rem;
  font-size:.8125rem;
  color:var(--agilo-muted, #6b7280);
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-rail-css';
  style.textContent = css;
  document.head.appendChild(style);
})();

