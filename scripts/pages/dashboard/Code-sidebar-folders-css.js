// Agilotext — styles barre latérale dossiers (nav sous Transcriptions)
// ⚠️ Ce fichier est chargé depuis GitHub — charger AVANT Code-sidebar-folders.js

(function () {
  if (document.getElementById('agilo-sidebar-folders-css')) return;

  const css = `
/* =============================================================================
   NAV DOSSIERS (sidebar, sous « Transcriptions »)
   ============================================================================= */
.agilo-nav-folders{
  margin:.35rem 0 .75rem;
  padding:.5rem .35rem .55rem;
  border-radius:var(--agilo-radius, .5rem);
  border:1px solid color-mix(in srgb, var(--agilo-text, #020202) 8%, transparent);
  background:color-mix(in srgb, var(--agilo-surface-2, #f8f9fa) 85%, transparent);
  font-size:.8125rem;
}
.agilo-nav-folders__label{
  font-weight:600;
  font-size:.68rem;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:var(--agilo-dim, #525252);
  margin:0 0 .4rem .25rem;
}
.agilo-nav-folders__list{
  display:flex;
  flex-direction:column;
  gap:.2rem;
}
.agilo-nav-folders__row{
  display:flex;
  align-items:center;
  gap:.45rem;
  padding:.38rem .45rem;
  border-radius:.4rem;
  text-decoration:none;
  color:inherit;
  line-height:1.25;
  transition:background .15s ease, color .15s ease;
  border:1px solid transparent;
}
.agilo-nav-folders__row:hover{
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 8%, #fff);
  border-color:color-mix(in srgb, var(--agilo-primary, #174a96) 18%, transparent);
}
.agilo-nav-folders__row.is-active{
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 12%, #fff);
  border-color:color-mix(in srgb, var(--agilo-primary, #174a96) 28%, transparent);
  font-weight:600;
}
.agilo-nav-folders__icon{
  flex:0 0 auto;
  width:1.15rem;
  height:1.15rem;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--agilo-folder-accent, var(--agilo-primary, #174a96));
}
.agilo-nav-folders__icon svg{
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
}
.agilo-nav-folders__count{
  flex:0 0 auto;
  font-size:.72rem;
  font-weight:600;
  color:var(--agilo-dim, #525252);
  min-width:1.25rem;
  text-align:right;
}
.agilo-nav-folders__row.is-active .agilo-nav-folders__count{
  color:var(--agilo-text, #020202);
}
.agilo-nav-folders--loading .agilo-nav-folders__placeholder{
  padding:.35rem .45rem;
  font-size:.75rem;
  color:var(--agilo-muted, #6b7280);
}
.agilo-nav-folders__empty{
  padding:.35rem .45rem;
  font-size:.75rem;
  color:var(--agilo-muted, #6b7280);
}
@media (prefers-reduced-motion: reduce){
  .agilo-nav-folders__row{ transition:none; }
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-sidebar-folders-css';
  style.textContent = css;
  document.head.appendChild(style);
})();
