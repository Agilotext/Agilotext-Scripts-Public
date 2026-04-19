// Agilotext — styles barre latérale dossiers (nav sous Transcriptions)
// ⚠️ Ce fichier est chargé depuis GitHub — charger AVANT Code-sidebar-folders.js

(function () {
  if (document.getElementById('agilo-sidebar-folders-css')) return;

  const css = `
/* =============================================================================
   NAV DOSSIERS — lisible, pastilles charte, ligne active type « carte »
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
  gap:.5rem;
  width:100%;
  box-sizing:border-box;
  padding:.2rem 0 .35rem;
  margin:0;
  font:inherit;
  color:inherit;
}
.agilo-nav-folders-details > summary::-webkit-details-marker{
  display:none;
}
.agilo-nav-folders__summary-text{
  font-size:.68rem;
  font-weight:600;
  letter-spacing:.07em;
  text-transform:uppercase;
  color:color-mix(in srgb, var(--color--gris, var(--agilo-dim, #525252)) 88%, var(--agilo-text, #020202) 12%);
}
.agilo-nav-folders__chev{
  flex:0 0 auto;
  width:.5rem;
  height:.5rem;
  border-right:2px solid currentColor;
  border-bottom:2px solid currentColor;
  opacity:.45;
  transform:rotate(-45deg);
  transition:transform .18s ease, opacity .18s ease;
  margin-right:.15rem;
}
.agilo-nav-folders-details[open] > summary .agilo-nav-folders__chev{
  transform:rotate(45deg);
  margin-top:-.1rem;
  opacity:.55;
}
.agilo-nav-folders{
  margin:0;
  padding:.2rem 0 .2rem;
  border:none;
  background:transparent;
  font-size:inherit;
}
.agilo-nav-folders__list{
  display:flex;
  flex-direction:column;
  gap:.2rem;
  padding:.2rem 0 0 .2rem;
  margin:0;
  border-left:1px solid color-mix(in srgb, var(--agilo-text, #020202) 8%, transparent);
}
.agilo-nav-folders__list--match-nav{
  padding-left:0;
  padding-top:.15rem;
  border-left:none;
  gap:.25rem;
}
.agilo-nav-folders__row{
  display:flex;
  align-items:center;
  gap:.45rem;
  padding:.38rem .45rem .38rem .35rem;
  border-radius:.5rem;
  text-decoration:none;
  color:var(--agilo-text, #020202);
  line-height:1.3;
  transition:background .14s ease, box-shadow .14s ease, color .12s ease;
  border:1px solid transparent;
  box-sizing:border-box;
  width:100%;
}
.agilo-nav-folders__row--match-nav{
  gap:var(--agilo-gap, .5rem);
  padding-left:.35rem;
  padding-right:.35rem;
}
.agilo-nav-folders__row:hover{
  background:color-mix(in srgb, var(--color--blue, var(--agilo-primary, #174a96)) 6%, var(--agilo-surface, var(--color--white, #ffffff)) 94%);
  border-color:color-mix(in srgb, var(--color--gris, #525252) 12%, transparent);
}
.agilo-nav-folders__row.is-active{
  background:var(--agilo-surface, var(--color--white, #ffffff));
  border-color:color-mix(in srgb, var(--color--blue, var(--agilo-primary, #174a96)) 22%, transparent);
  box-shadow:0 1px 2px color-mix(in srgb, var(--agilo-text, #020202) 6%, transparent),
    0 0 0 1px color-mix(in srgb, var(--color--blue, var(--agilo-primary, #174a96)) 10%, transparent);
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
/* Icônes dossier : contour uniquement (évite le rendu « plein » hérité du site) */
.agilo-nav-folders__row--folder .agilo-nav-folders__icon svg,
.agilo-nav-folders__row--folder .agilo-nav-folders__icon-wrap svg{
  fill:none !important;
  stroke:currentColor !important;
  stroke-width:1.5;
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__icon-wrap{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:center;
  width:1.25rem;
  height:1.25rem;
  min-width:1.25rem;
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
  color:color-mix(in srgb, var(--agilo-text, #020202) 92%, var(--color--gris, #525252) 8%);
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__name{
  color:var(--agilo-text, #020202);
}
/* Pastilles compteur : neutre charte (surcharge styles Webflow .readycount) */
.agilo-nav-folders__list .agilo-nav-folders__row .agilo-nav-folders__count{
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:1.4rem;
  min-height:1.4rem;
  padding:0 .38rem;
  box-sizing:border-box;
  border-radius:999px;
  font-size:.6875rem;
  font-weight:600;
  line-height:1;
  text-align:center;
  color:var(--color--gris, var(--agilo-dim, #525252)) !important;
  background:color-mix(in srgb, var(--agilo-surface, var(--color--white, #ffffff)) 88%, var(--color--gris, #525252) 12%) !important;
  border:1px solid color-mix(in srgb, var(--color--gris, #525252) 20%, transparent) !important;
  box-shadow:none !important;
  opacity:1;
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__count.readycount{
  font-size:.6875rem;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__count{
  color:var(--agilo-text, #020202) !important;
  background:var(--agilo-surface, var(--color--white, #ffffff)) !important;
  border-color:color-mix(in srgb, var(--color--blue, var(--agilo-primary, #174a96)) 28%, transparent) !important;
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
