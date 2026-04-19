// Agilotext — styles barre latérale dossiers (nav sous Transcriptions)
// ⚠️ Ce fichier est chargé depuis GitHub — charger AVANT Code-sidebar-folders.js

(function () {
  if (document.getElementById('agilo-sidebar-folders-css')) return;

  const css = `
/* =============================================================================
   NAV DOSSIERS — minimal, sans encadré ; toggle native <details>
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
  padding:0;
  margin:0;
  font:inherit;
  color:inherit;
}
.agilo-nav-folders-details > summary::-webkit-details-marker{
  display:none;
}
.agilo-nav-folders__summary-text{
  font-size:.7rem;
  font-weight:600;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:var(--color--gris, var(--agilo-dim, #525252));
}
.agilo-nav-folders__chev{
  flex:0 0 auto;
  width:.5rem;
  height:.5rem;
  border-right:2px solid currentColor;
  border-bottom:2px solid currentColor;
  opacity:.55;
  transform:rotate(-45deg);
  transition:transform .18s ease, opacity .18s ease;
  margin-right:.15rem;
}
.agilo-nav-folders-details[open] > summary .agilo-nav-folders__chev{
  transform:rotate(45deg);
  margin-top:-.1rem;
}
.agilo-nav-folders{
  margin:0;
  padding:.25rem 0 .15rem;
  border:none;
  background:transparent;
  font-size:inherit;
}
.agilo-nav-folders__list{
  display:flex;
  flex-direction:column;
  gap:0;
  padding:.15rem 0 0 .15rem;
  margin:0;
  border-left:1px solid color-mix(in srgb, var(--agilo-text, #020202) 10%, transparent);
}
.agilo-nav-folders__list--match-nav{
  padding-left:0;
  padding-top:.1rem;
  border-left:none;
}
.agilo-nav-folders__row{
  display:flex;
  align-items:center;
  gap:.4rem;
  padding:.28rem .15rem .28rem 0;
  border-radius:var(--agilo-radius, .35rem);
  text-decoration:none;
  color:inherit;
  line-height:1.3;
  transition:background .12s ease, opacity .12s ease;
  border:none;
  box-sizing:border-box;
  width:100%;
}
.agilo-nav-folders__row--match-nav{
  gap:var(--agilo-gap, .5rem);
  padding-left:0;
  padding-right:0;
}
.agilo-nav-folders__row:hover{
  background:color-mix(in srgb, var(--color--blue, var(--agilo-primary, #174a96)) 7%, transparent);
}
.agilo-nav-folders__row.is-active{
  background:color-mix(in srgb, var(--color--blue, var(--agilo-primary, #174a96)) 11%, transparent);
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
}
.agilo-nav-folders__count{
  flex:0 0 auto;
  font-size:.72rem;
  font-weight:600;
  color:var(--color--gris, var(--agilo-dim, #525252));
  min-width:1.15rem;
  text-align:right;
  opacity:.9;
}
.agilo-nav-folders__row--match-nav .agilo-nav-folders__count.readycount{
  font-size:inherit;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__count{
  color:var(--agilo-text, #020202);
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
