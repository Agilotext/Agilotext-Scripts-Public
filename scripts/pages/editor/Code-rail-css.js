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

/* Barre dossiers (éditeur) — discret : pas de 2e carte (évite double contour avec la colonne Webflow) */
.agilo-folder-bar{
  display:flex;
  flex-wrap:wrap;
  align-items:stretch;
  gap:.4rem .5rem;
  margin-bottom:.55rem;
  padding:.25rem 0 .5rem 0;
  border:none;
  border-bottom:1px solid color-mix(in srgb, var(--agilo-text, #020202) 7%, transparent);
  border-radius:0;
  background:transparent;
  box-shadow:none;
  font-size:.8125rem;
  row-gap:.4rem;
}
.agilo-folder-bar .agilo-folder-label{
  flex:0 0 100%;
  font-weight:600;
  font-size:.68rem;
  letter-spacing:.04em;
  text-transform:uppercase;
  color:var(--agilo-dim, #6b7280);
  margin:0 0 .06rem 0;
  opacity:.92;
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
  gap:.3rem;
  flex:1 1 12rem;
  min-width:0;
  max-width:100%;
  padding:.08rem 0;
}
.agilo-folder-bar button.agilo-folder-chip{
  border:1px solid color-mix(in srgb, var(--agilo-text, #020202) 9%, transparent);
  background:color-mix(in srgb, var(--agilo-surface, #fff) 88%, var(--agilo-surface-2, #f3f4f6) 12%);
  border-radius:999px;
  padding:.3rem .62rem;
  min-height:1.85rem;
  max-width:min(100%, 12.5rem);
  cursor:pointer;
  line-height:1.2;
  font-size:.78rem;
  font-weight:500;
  color:var(--agilo-text, #020202);
  box-shadow:none;
  transition:background .15s ease, border-color .15s ease;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.agilo-folder-bar button.agilo-folder-chip:hover{
  border-color:color-mix(in srgb, var(--agilo-primary, #174a96) 35%, transparent);
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 5%, var(--agilo-surface, #fff));
}
.agilo-folder-bar button.agilo-folder-chip:focus-visible{
  outline:2px solid var(--agilo-primary, #174a96);
  outline-offset:2px;
}
.agilo-folder-bar button.agilo-folder-chip.is-active{
  border-color:color-mix(in srgb, var(--agilo-primary, #174a96) 55%, transparent);
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 10%, var(--agilo-surface, #fff));
  font-weight:600;
  box-shadow:none;
}
.agilo-folder-bar button.agilo-folder-chip--new{
  border-style:dashed;
  font-weight:500;
  color:var(--agilo-dim, #525252);
}
.agilo-folder-bar button.agilo-folder-chip--new:hover{
  color:var(--agilo-primary, #174a96);
}
.agilo-folder-bar .agilo-folder-move-details{
  flex:1 1 100%;
  margin:0;
  padding-top:.35rem;
  border-top:1px solid color-mix(in srgb, var(--agilo-text, #020202) 6%, transparent);
}
@media (min-width:720px){
  .agilo-folder-bar .agilo-folder-move-details{
    flex:0 1 auto;
    margin-left:auto;
    padding-top:0;
    border-top:none;
    max-width:min(100%, 24rem);
  }
}
.agilo-folder-bar .agilo-folder-move-details > summary{
  cursor:pointer;
  list-style-position:outside;
  font-size:.78rem;
  font-weight:500;
  color:var(--agilo-dim, #6b7280);
  padding:.1rem 0;
}
.agilo-folder-bar .agilo-folder-move-details > summary::-webkit-details-marker{
  color:var(--agilo-dim, #525252);
}
.agilo-folder-bar .agilo-folder-move-inner{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:.4rem;
  margin-top:.35rem;
}
.agilo-folder-bar .agilo-folder-move-help{
  flex:1 1 100%;
  margin:0 0 .15rem 0;
  font-size:.72rem;
  line-height:1.35;
  color:var(--agilo-dim, #525252);
}
.agilo-folder-bar .agilo-folder-move-inner select{
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
.agilo-folder-bar .agilo-folder-move-inner button[type="button"]{
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
.agilo-folder-bar .agilo-folder-move-inner button[type="button"]:hover{
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
.rail-empty-hint{
  padding:0 .75rem .75rem;
  font-size:.72rem;
  line-height:1.35;
  color:var(--agilo-dim, #525252);
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-rail-css';
  style.textContent = css;
  document.head.appendChild(style);
})();

