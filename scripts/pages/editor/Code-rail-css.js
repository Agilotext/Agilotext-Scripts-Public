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
`;

  const style = document.createElement('style');
  style.id = 'agilo-rail-css';
  style.textContent = css;
  document.head.appendChild(style);
})();

