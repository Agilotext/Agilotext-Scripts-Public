/**
 * Agilotext — injection compte-rendu HTML (dashboard Webflow)
 * Même heuristique d’isolation que l’éditeur (Code-main-editor-IFRAME) : iframe si styles globaux.
 * Chargé automatiquement par free.js / pro.js / ent.js (et variantes) via XHR synchrone si absent.
 * Surcharge possible : window.AGILO_DASHBOARD_SUMMARY_EMBED_URL
 * @version 1.07
 */
(function () {
  'use strict';

  function summaryHtmlNeedsIframe(html) {
    if (!html || typeof html !== 'string') return false;
    return (
      html.includes('<head') ||
      html.includes('<body') ||
      /\*\s*\{/.test(html) ||
      /body\s*\{/.test(html)
    );
  }

  function fitDashboardSummaryIframe(iframe) {
    try {
      const idoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!idoc) return;
      const body = idoc.body;
      const root = idoc.documentElement;
      const measured = Math.max(
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        root ? root.scrollHeight : 0,
        root ? root.offsetHeight : 0
      );
      const floor = typeof window.innerHeight === 'number' && window.innerHeight > 200
        ? window.innerHeight
        : 600;
      const nextH = Math.max(measured + 24, floor);
      iframe.style.height = nextH + 'px';
      iframe.style.minHeight = Math.max(400, Math.min(floor, 900)) + 'px';
    } catch (e) { /* ignore */ }
  }

  /**
   * @param {HTMLElement} hostEl — ex. #summaryText
   * @param {string} html — HTML déjà passé par adjustHtmlContent côté appelant
   */
  function injectSummaryHtml(hostEl, html) {
    if (!hostEl || !html) return;

    hostEl.setAttribute('data-raw-html', html);

    if (summaryHtmlNeedsIframe(html)) {
      hostEl.setAttribute('data-is-iframe', 'true');
      hostEl.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.className = 'agilo-dashboard-summary-iframe';
      iframe.setAttribute('title', 'Compte-rendu');
      iframe.style.cssText = 'width:100%;border:none;min-height:400px;background:#fff;';
      hostEl.appendChild(iframe);

      var written = false;
      var runWrite = function () {
        if (written) return;
        written = true;
        try {
          const idoc = iframe.contentDocument || iframe.contentWindow.document;
          idoc.open();
          idoc.write(html);
          idoc.close();
        } catch (e) {
          try {
            iframe.srcdoc = html;
          } catch (e2) {
            hostEl.setAttribute('data-is-iframe', 'false');
            hostEl.innerHTML = html;
            return;
          }
        }
        fitDashboardSummaryIframe(iframe);
        [0, 120, 450, 1400].forEach(function (ms) {
          setTimeout(function () { fitDashboardSummaryIframe(iframe); }, ms);
        });
      };

      iframe.onload = runWrite;
      if (iframe.contentDocument) {
        runWrite();
      }
    } else {
      hostEl.setAttribute('data-is-iframe', 'false');
      hostEl.innerHTML = html;
    }
  }

  window.AgilotextDashboardSummary = {
    needsIframe: summaryHtmlNeedsIframe,
    inject: injectSummaryHtml
  };
})();
