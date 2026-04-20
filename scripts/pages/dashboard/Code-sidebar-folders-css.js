// Agilotext — styles barre latérale dossiers (nav sous Transcriptions)
// ⚠️ Ce fichier est chargé depuis GitHub — charger AVANT Code-sidebar-folders.js
// Compatible : évite color-mix (aperçu Webflow / navigateurs anciens).

(function () {
  if (document.getElementById('agilo-sidebar-folders-css')) return;

  const css = `
/* =============================================================================
   NAV DOSSIERS — style compact, aligné gauche, sans encadré
   ============================================================================= */
#agilo-nav-folders-root{
  display:block;
  width:100%;
}
.agilo-nav-folders-details{
  margin:0;
  padding:0;
  border:none;
  background:transparent;
  width:100%;
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
  display:grid !important;
  grid-template-columns:minmax(0, 1fr) auto !important;
  align-items:center !important;
  text-align:left !important;
  background:transparent !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  width:100% !important;
  column-gap:.32rem !important;
}
.agilo-nav-folders__summary-main{
  display:inline-flex;
  align-items:center;
  gap:.38rem;
  justify-content:flex-start;
  min-width:0;
  flex:1 1 0%;
  padding-left:0;
}
.agilo-nav-folders__summary-icon{
  flex:0 0 auto;
  width:1.06rem;
  height:1.06rem;
  min-width:1.06rem;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--color--gris, var(--agilo-dim, #525252));
}
.agilo-nav-folders__summary-icon svg{
  width:100%;
  height:100%;
  display:block;
}
.agilo-nav-folders__summary-actions{
  display:inline-flex;
  align-items:center;
  justify-content:flex-end !important;
  justify-self:end;
  flex:0 0 auto;
  margin-left:auto;
}
.agilo-nav-folders__summary-text{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:.82rem;
  font-weight:600;
  letter-spacing:.005em;
  text-transform:none;
  line-height:1.1;
  color:var(--color--gris, var(--agilo-dim, #525252));
}
.agilo-nav-folders__chev{
  flex:0 0 auto;
  width:.34rem;
  height:.34rem;
  border-right:1.6px solid currentColor;
  border-bottom:1.6px solid currentColor;
  opacity:.72;
  transform:rotate(-45deg);
  transition:transform .18s ease, opacity .18s ease, color .18s ease;
  margin-left:.08rem;
}
.agilo-nav-folders-details[open] > summary .agilo-nav-folders__chev{
  transform:rotate(45deg);
  margin-top:-.05rem;
}
.agilo-nav-folders__create-btn{
  width:1.34rem;
  height:1.34rem;
  min-width:1.34rem;
  border-radius:999px;
  border:none;
  background:transparent;
  color:var(--color--gris, var(--agilo-dim, #525252));
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:0;
  line-height:1;
  transition:color .15s ease, opacity .15s ease, box-shadow .15s ease;
}
.agilo-nav-folders__create-btn svg{
  width:.86rem;
  height:.86rem;
  display:block;
}
.agilo-nav-folders__create-btn:hover{
  color:var(--color--blue, var(--agilo-primary, #174a96));
  opacity:1;
  background:rgba(255, 255, 255, 0.92);
  box-shadow:0 0 0 1px rgba(82, 82, 82, 0.1);
}
.agilo-nav-folders__create-btn:focus-visible{
  outline:none;
  box-shadow:0 0 0 2px rgba(23,74,150,.22), 0 0 0 1px rgba(82, 82, 82, 0.08);
}
.agilo-nav-folders{
  margin:0;
  padding:.08rem 0 .04rem;
  border:none;
  background:transparent;
  font-size:inherit;
}
.agilo-nav-folders__list{
  display:flex;
  flex-direction:column;
  gap:.1rem;
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
/* Webflow : liens dashboard souvent min-width:auto → casse l’ellipse sur noms longs */
a.agilo-nav-folders__row.dashboard-link,
a.agilo-nav-folders__row.w-inline-block{
  min-width:0 !important;
  max-width:100% !important;
}
.agilo-nav-folders__row{
  gap:.4rem;
  padding:.22rem 0 .22rem .04rem;
  border-radius:0;
  text-decoration:none;
  color:var(--agilo-text, #020202);
  line-height:1.25;
  transition:color .12s ease, opacity .12s ease;
  border:0;
  background:transparent;
  box-sizing:border-box;
  width:100%;
  max-width:100%;
  min-width:0;
  overflow:hidden;
}
.agilo-nav-folders__row--match-nav{
  gap:var(--agilo-gap, .48rem);
  padding-left:.04rem;
  padding-right:0;
}
.agilo-nav-folders__row:hover{
  background:transparent;
  color:var(--agilo-text, #020202);
  opacity:.88;
}
.agilo-nav-folders__row.is-active{
  background:rgba(255, 255, 255, 0.96) !important;
  border-radius:.38rem;
  box-shadow:0 0 0 1px rgba(0, 0, 0, 0.06);
  font-weight:600;
}
.agilo-nav-folders__icon{
  flex:0 0 auto;
  width:1rem;
  height:1rem;
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
  width:1.06rem;
  height:1.06rem;
  min-width:1.06rem;
  margin-left:0;
  color:var(--agilo-folder-accent, var(--color--blue, var(--agilo-primary, #174a96)));
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__icon-wrap svg{
  width:100%;
  height:100%;
  display:block;
}
.agilo-nav-folders__name{
  flex:1 1 0%;
  min-width:0;
  max-width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:.8rem;
  text-align:left !important;
}
.agilo-nav-folders__name-block{
  flex:1 1 0%;
  min-width:0;
  max-width:100%;
  display:inline-flex;
  align-items:center;
  gap:.12rem;
  overflow:hidden;
}
.agilo-nav-folders__name-block .agilo-nav-folders__name{
  flex:1 1 0%;
  min-width:0;
  max-width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.agilo-nav-folders__row--match-nav > .agilo-nav-folders__name{
  flex:1 1 0% !important;
  min-width:0;
  max-width:100%;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__name{
  color:var(--agilo-text, #020202);
}
.agilo-nav-folders__rename-btn{
  width:1rem;
  height:1rem;
  min-width:1rem;
  margin-left:.1rem;
  border:none;
  background:transparent;
  color:var(--color--gris, var(--agilo-dim, #525252));
  padding:0;
  flex:0 0 auto;
  opacity:0;
  pointer-events:none;
  transition:opacity .12s ease, color .12s ease;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.agilo-nav-folders__rename-btn svg{
  width:.86rem;
  height:.86rem;
  display:block;
}
.agilo-nav-folders__row--folder:hover .agilo-nav-folders__rename-btn,
.agilo-nav-folders__row--folder:focus-within .agilo-nav-folders__rename-btn{
  opacity:.85;
  pointer-events:auto;
}
.agilo-nav-folders__rename-btn:hover{
  color:var(--color--blue, var(--agilo-primary, #174a96));
}
.agilo-nav-folders__rename-btn:focus-visible{
  opacity:1;
  pointer-events:auto;
  outline:none;
  box-shadow:0 0 0 2px rgba(23,74,150,.22);
  border-radius:4px;
}
/* Pastilles : neutres (surcharge .readycount Webflow) */
.agilo-nav-folders__list .agilo-nav-folders__row .agilo-nav-folders__count{
  flex:0 0 auto;
  display:inline-flex !important;
  align-items:center;
  justify-content:center;
  margin-left:auto;
  min-width:1.28rem;
  min-height:1.28rem;
  padding:0 .32rem;
  box-sizing:border-box;
  border-radius:999px;
  font-size:.66rem;
  font-weight:600;
  line-height:1;
  text-align:center;
  color:var(--color--gris, var(--agilo-dim, #525252)) !important;
  background:transparent !important;
  border:1px solid rgba(82, 82, 82, 0.18) !important;
  box-shadow:none !important;
  opacity:1;
  flex-shrink:0;
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__count.readycount{
  font-size:.66rem;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__count{
  color:var(--agilo-text, #020202) !important;
  background:transparent !important;
  border-color:rgba(23, 74, 150, 0.24) !important;
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
.agilo-nav-folders__row--inline-create{
  display:flex !important;
  align-items:center;
}
.agilo-nav-folders__input{
  flex:1 1 auto;
  min-width:0;
  border:none;
  border-bottom:1px solid rgba(82, 82, 82, 0.28);
  background:transparent;
  color:var(--agilo-text, #020202);
  font-size:.8rem;
  line-height:1.2;
  padding:.08rem 0;
  outline:none;
}
.agilo-nav-folders__input::placeholder{
  color:rgba(82, 82, 82, 0.65);
}
.agilo-nav-folders__input:focus{
  border-bottom-color:var(--color--blue, var(--agilo-primary, #174a96));
}
.agilo-nav-folders__inline-actions{
  display:inline-flex;
  align-items:center;
  gap:.12rem;
  margin-left:.2rem;
}
.agilo-nav-folders__inline-btn{
  width:1rem;
  height:1rem;
  min-width:1rem;
  border:none;
  background:transparent;
  color:var(--color--gris, var(--agilo-dim, #525252));
  padding:0;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.agilo-nav-folders__inline-btn svg{
  width:.82rem;
  height:.82rem;
  display:block;
}
.agilo-nav-folders__inline-btn--ok:hover{
  color:#1f8f3a;
}
.agilo-nav-folders__inline-btn--cancel:hover{
  color:#b4232f;
}
.agilo-nav-folders__inline-btn:focus-visible{
  outline:none;
  box-shadow:0 0 0 2px rgba(23,74,150,.22);
  border-radius:4px;
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
