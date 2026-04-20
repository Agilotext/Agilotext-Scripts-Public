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

/* Barre dossiers (éditeur) — refonte collapsible */
.agilo-folder-bar{
  margin-bottom:.65rem;
  padding:0;
  border-bottom:1px solid rgba(82, 82, 82, 0.08);
  background:transparent;
}
.agilo-folder-details{
  width:100%;
}
.agilo-folder-summary{
  list-style:none;
  cursor:pointer;
  padding:.35rem 0;
  outline:none;
}
.agilo-folder-summary::-webkit-details-marker{
  display:none;
}
.agilo-folder-summary-main{
  display:flex;
  align-items:center;
  gap:.42rem;
  min-width:0;
}
.agilo-folder-summary-icon{
  flex:0 0 auto;
  width:1.25rem;
  height:1.25rem;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--agilo-dim, #525252);
}
.agilo-folder-summary-icon svg{
  width:100%;
  height:auto;
  max-height:100%;
}
.agilo-folder-summary-text{
  flex:1 1 auto;
  font-weight:600;
  font-size:.72rem;
  letter-spacing:.035em;
  text-transform:uppercase;
  color:var(--agilo-dim, #6b7280);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  opacity:.92;
}
.agilo-folder-summary-chev{
  flex:0 0 auto;
  width:.34rem;
  height:.34rem;
  border-right:1.7px solid var(--agilo-dim, #6b7280);
  border-bottom:1.7px solid var(--agilo-dim, #6b7280);
  opacity:.6;
  transform:rotate(-45deg);
  transition:transform .18s ease;
  margin-right:.15rem;
  margin-top:-.05rem;
}
.agilo-folder-details[open] .agilo-folder-summary-chev{
  transform:rotate(45deg);
}
.agilo-folder-inner{
  padding:.15rem 0 .65rem;
}
.agilo-folder-chips{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:.35rem;
  min-width:0;
  max-width:100%;
}
.agilo-folder-bar button.agilo-folder-chip{
  border:1px solid rgba(82, 82, 82, 0.12);
  background:rgba(255, 255, 255, 0.7);
  border-radius:999px;
  padding:.28rem .58rem;
  min-height:1.65rem;
  max-width:min(100%, 11rem);
  cursor:pointer;
  line-height:1.15;
  font-size:.75rem;
  font-weight:500;
  color:var(--agilo-text, #020202);
  transition:all .15s ease;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.agilo-folder-bar button.agilo-folder-chip:hover{
  border-color:var(--agilo-primary, #174a96);
  background:rgba(255, 255, 255, 1);
}
.agilo-folder-bar button.agilo-folder-chip.is-active{
  border-color:var(--agilo-primary, #174a96);
  background:rgba(23, 74, 150, 0.08);
  font-weight:600;
}
.agilo-folder-bar button.agilo-folder-chip--new{
  border-style:dashed;
  display:flex;
  align-items:center;
  gap:.2rem;
  color:var(--agilo-dim, #6b7280);
}
.agilo-folder-bar button.agilo-folder-chip--new svg{
  width:.75rem;
  height:.75rem;
}
.agilo-folder-bar .agilo-folder-move-details{
  margin-top:.45rem;
  padding-top:.45rem;
  border-top:1px dashed rgba(82, 82, 82, 0.1);
}
@media (min-width:720px){
  .agilo-folder-bar .agilo-folder-move-details{
    max-width:100%;
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

