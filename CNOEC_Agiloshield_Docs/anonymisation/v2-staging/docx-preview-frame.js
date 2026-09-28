/* Opaque-origin iframe: the DOCX bytes stay in the browser and cannot read the host page. */
(function () {
  'use strict';
  const status = document.getElementById('status');
  const container = document.getElementById('docx');
  let activeNonce = null;
  document.addEventListener('click', event => {
    if (event.target.closest('a')) event.preventDefault();
  }, true);
  window.addEventListener('message', async event => {
    if (event.source !== parent || event.data?.type !== 'AGILOSHIELD_DOCX_RENDER' ||
        typeof event.data.nonce !== 'string' || !(event.data.bytes instanceof ArrayBuffer)) return;
    activeNonce = event.data.nonce;
    const nonce = activeNonce;
    try {
      status.textContent = 'Rendu du document Word…';
      container.replaceChildren();
      await window.docx.renderAsync(event.data.bytes, container, container, {
        className: 'agiloshield-docx', breakPages: true, renderHeaders: true,
        renderFooters: true, renderFootnotes: true, renderEndnotes: true,
        renderComments: false, renderAltChunks: false, useBase64URL: true,
      });
      if (nonce !== activeNonce) return;
      status.hidden = true;
      parent.postMessage({type:'AGILOSHIELD_DOCX_DONE',nonce}, '*');
    } catch (error) {
      status.hidden = false;
      status.textContent = 'Aperçu Word indisponible. Le statut et la QA du fichier restent consultables.';
      parent.postMessage({type:'AGILOSHIELD_DOCX_ERROR',nonce,error:String(error?.message || error)}, '*');
    }
  });
  parent.postMessage({type:'AGILOSHIELD_DOCX_READY'}, '*');
})();
