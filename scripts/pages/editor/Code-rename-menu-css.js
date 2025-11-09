// Agilotext - Rename Menu CSS
// ⚠️ Ce fichier est chargé depuis GitHub
// Correspond à: code-rename-menu-css dans Webflow

(function () {
  if (document.getElementById('agilo-rename-menu-css')) return;

  const css = `
/* =====================================================================
   MENU DE PORTÉE — Renommage locuteur (version FIXED + responsive)
   ===================================================================== */
.ag-rename-backdrop{
  position:fixed;
  inset:0;
  z-index:99998;
  background:transparent;
}

.ag-rename-menu{
  position:fixed;
  z-index:99999;
  min-width:240px;
  max-width:min(92vw, 420px);
  max-height:calc(100vh - 16px);
  overflow:auto;
  background:var(--agilo-surface, #fff);
  color:var(--agilo-text, #111);
  border:1px solid var(--agilo-border, rgba(0,0,0,.12));
  border-radius:var(--agilo-radius, .5rem);
  box-shadow:var(--agilo-shadow, 0 8px 24px rgba(0,0,0,.14));
}

.ag-rename-menu__hd{
  padding:10px 12px;
  font-weight:600;
  border-bottom:1px solid var(--agilo-border, rgba(0,0,0,.12));
  background:var(--agilo-surface-2, #f8f9fa);
}

.ag-rename-menu__row{
  display:block;
  width:100%;
  text-align:left;
  padding:10px 12px;
  background:transparent;
  border:0;
  cursor:pointer;
  color:inherit;
  font:500 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto;
}

.ag-rename-menu__row:hover,
.ag-rename-menu__row:focus-visible{
  background: color-mix(in srgb,
              var(--agilo-surface-2, #f8f9fa) 86%,
              var(--agilo-primary, #174a96) 14%);
  outline:none;
}

.ag-rename-menu__muted{
  color:var(--agilo-dim, #525252);
  font-size:12px;
  margin-left:.4rem;
}
`;

  const style = document.createElement('style');
  style.id = 'agilo-rename-menu-css';
  style.textContent = css;
  document.head.appendChild(style);
})();

