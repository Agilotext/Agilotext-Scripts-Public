// Agilotext — styles barre latérale dossiers (nav sous Transcriptions)
// ⚠️ Ce fichier est chargé depuis GitHub — charger AVANT Code-sidebar-folders.js
// Compatible : évite color-mix (aperçu Webflow / navigateurs anciens).

(function () {
  if (document.getElementById('agilo-sidebar-folders-css')) return;

  const css = `
/* =============================================================================
   NAV DOSSIERS — charte lisible, pastilles neutres, ligne active
   ============================================================================= */
.agilo-nav-folders-details{
  margin:0;
  padding:0;
  border:none;
  background:transparent;
}
.agilo-nav-folders-details > summary{
  list-style:none;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.6rem;
  width:100%;
  box-sizing:border-box;
  padding:.14rem 0 .28rem;
  margin:0;
  font:inherit;
  color:inherit;
}
.agilo-nav-folders-details > summary::-webkit-details-marker{
  display:none;
}
.agilo-nav-folders__summary{
  display:flex !important;
  align-items:center !important;
  justify-content:space-between !important;
  text-align:left !important;
  background:transparent !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  width:100% !important;
}
.agilo-nav-folders__summary-main{
  display:inline-flex;
  align-items:center;
  gap:.34rem;
  min-width:0;
}
.agilo-nav-folders__summary-actions{
  display:inline-flex;
  align-items:center;
  justify-content:flex-end;
  flex:0 0 auto;
}
.agilo-nav-folders__summary-text{
  font-size:.78rem;
  font-weight:600;
  letter-spacing:.01em;
  text-transform:none;
  line-height:1.1;
  color:var(--color--gris, var(--agilo-dim, #525252));
}
.agilo-nav-folders__chev{
  flex:0 0 auto;
  width:.44rem;
  height:.44rem;
  border-right:1.8px solid currentColor;
  border-bottom:1.8px solid currentColor;
  opacity:.72;
  transform:rotate(-45deg);
  transition:transform .18s ease, opacity .18s ease, color .18s ease;
  margin-right:.02rem;
}
.agilo-nav-folders-details[open] > summary .agilo-nav-folders__chev{
  transform:rotate(45deg);
  margin-top:-.08rem;
}
.agilo-nav-folders__create-btn{
  width:1.2rem;
  height:1.2rem;
  min-width:1.2rem;
  border-radius:999px;
  border:1px solid rgba(82, 82, 82, 0.24);
  background:var(--agilo-surface, #fff);
  color:var(--color--gris, var(--agilo-dim, #525252));
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:0;
  line-height:1;
  transition:background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
}
.agilo-nav-folders__create-btn svg{
  width:.76rem;
  height:.76rem;
  display:block;
}
.agilo-nav-folders__create-btn:hover{
  border-color:rgba(23,74,150,.28);
  color:var(--color--blue, var(--agilo-primary, #174a96));
  background:rgba(23,74,150,.05);
}
.agilo-nav-folders__create-btn:focus-visible{
  outline:none;
  box-shadow:0 0 0 2px rgba(23,74,150,.18);
}
.agilo-nav-folders{
  margin:0;
  padding:.08rem 0 .05rem;
  border:none;
  background:transparent;
  font-size:inherit;
}
.agilo-nav-folders__list{
  display:flex;
  flex-direction:column;
  gap:.14rem;
  padding:.02rem 0 0;
  margin:0;
  border-left:none;
  background:transparent;
}
.agilo-nav-folders__list--match-nav{
  padding-left:0;
  padding-top:0;
  border-left:none;
}
/* Webflow impose souvent inline-block sur les liens : forcer flex pour le layout */
.agilo-nav-folders__list > .agilo-nav-folders__row{
  display:flex !important;
  align-items:center;
  flex-direction:row;
  justify-content:flex-start !important;
  text-align:left !important;
}
.agilo-nav-folders__row{
  gap:.45rem;
  padding:.25rem 0 .25rem .1rem;
  border-radius:0;
  text-decoration:none;
  color:var(--agilo-text, #020202);
  line-height:1.3;
  transition:color .12s ease, opacity .12s ease;
  border:0;
  background:transparent;
  box-sizing:border-box;
  width:100%;
  max-width:100%;
}
.agilo-nav-folders__row--match-nav{
  gap:var(--agilo-gap, .5rem);
  padding-left:.1rem;
  padding-right:0;
}
.agilo-nav-folders__row:hover{
  background:transparent;
  color:var(--agilo-text, #020202);
  opacity:.88;
}
.agilo-nav-folders__row.is-active{
  background:transparent;
  border-color:transparent;
  box-shadow:none;
  font-weight:600;
}
.agilo-nav-folders__icon{
  flex:0 0 auto;
  width:1.05rem;
  height:1.05rem;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--agilo-folder-accent, var(--color--blue, var(--agilo-primary, #174a96)));
}
.agilo-nav-folders__icon svg{
  width:100%;
  height:100%;
  display:block;
}
/* Dossiers : contour (uniquement ces lignes) */
.agilo-nav-folders__row--folder .agilo-nav-folders__icon svg,
.agilo-nav-folders__row--folder .agilo-nav-folders__icon-wrap svg{
  fill:none !important;
  stroke:currentColor !important;
  stroke-width:1.6 !important;
}
.agilo-nav-folders__row--folder .agilo-nav-folders__icon svg *,
.agilo-nav-folders__row--folder .agilo-nav-folders__icon-wrap svg *{
  fill:none !important;
  stroke:currentColor !important;
  stroke-width:1.6 !important;
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__icon-wrap{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:center;
  width:1.25rem;
  height:1.25rem;
  min-width:1.25rem;
  margin-left:0;
  color:var(--agilo-folder-accent, var(--color--blue, var(--agilo-primary, #174a96)));
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__icon-wrap svg{
  width:100%;
  height:100%;
  display:block;
}
.agilo-nav-folders__name{
  flex:1 1 auto;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:.8125rem;
  text-align:left !important;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__name{
  color:var(--agilo-text, #020202);
}
/* Pastilles : neutres (surcharge .readycount Webflow) */
.agilo-nav-folders__list .agilo-nav-folders__row .agilo-nav-folders__count{
  flex:0 0 auto;
  display:inline-flex !important;
  align-items:center;
  justify-content:center;
  margin-left:auto;
  min-width:1.35rem;
  min-height:1.35rem;
  padding:0 .35rem;
  box-sizing:border-box;
  border-radius:999px;
  font-size:.6875rem;
  font-weight:600;
  line-height:1;
  text-align:center;
  color:var(--color--gris, var(--agilo-dim, #525252)) !important;
  background:var(--agilo-surface, var(--color--white, #ffffff)) !important;
  border:1px solid rgba(82, 82, 82, 0.2) !important;
  box-shadow:none !important;
  opacity:1;
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__count.readycount{
  font-size:.6875rem;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__count{
  color:var(--agilo-text, #020202) !important;
  background:var(--agilo-surface, var(--color--white, #ffffff)) !important;
  border-color:rgba(23, 74, 150, 0.28) !important;
}
.agilo-nav-folders--loading .agilo-nav-folders__placeholder{
  padding:.2rem 0 .1rem;
  font-size:.75rem;
  color:var(--agilo-muted, #6b7280);
}
.agilo-nav-folders__empty{
  padding:.2rem 0;
  font-size:.75rem;
  color:var(--agilo-muted, #6b7280);
}
@media (prefers-reduced-motion: reduce){
  .agilo-nav-folders__chev{ transition:none; }
  .agilo-nav-folders__row{ transition:none; }
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-sidebar-folders-css';
  style.textContent = css;
  document.head.appendChild(style);
})();
