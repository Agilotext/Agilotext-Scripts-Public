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

/* Barre dossiers (éditeur) */
.agilo-folder-bar{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:.35rem .5rem;
  margin-bottom:.65rem;
  padding:.4rem .5rem;
  border:1px solid var(--agilo-border, rgba(0,0,0,.12));
  border-radius:var(--agilo-radius, .5rem);
  background:var(--agilo-surface-2, #f8f9fa);
  font-size:.8125rem;
}
.agilo-folder-bar .agilo-folder-label{
  font-weight:600;
  opacity:.85;
  margin-right:.25rem;
}
.agilo-folder-bar button.agilo-folder-chip{
  border:1px solid rgba(0,0,0,.14);
  background:#fff;
  border-radius:999px;
  padding:.2rem .55rem;
  cursor:pointer;
  line-height:1.2;
}
.agilo-folder-bar button.agilo-folder-chip.is-active{
  border-color:var(--agilo-primary, #174a96);
  background:color-mix(in srgb, var(--agilo-primary, #174a96) 12%, #fff);
  font-weight:600;
}
.agilo-folder-bar .agilo-folder-move{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:.35rem;
  margin-left:auto;
}
.agilo-folder-bar select{
  max-width:12rem;
  font-size:.8125rem;
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

