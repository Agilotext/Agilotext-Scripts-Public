/**
 * Diagnostic console — « Passages à relire » vs onglets éditeur
 *
 * Usage (page éditeur live) :
 *   1. Coller ce script dans la console AVANT de cliquer le toggle
 *   2. Cliquer « Passages à relire »
 *   3. Lire le rapport [AGILO:DIAG:CONF]
 *
 * Interprétation :
 *   - overlapTabs=true + floating=true → recouvrement panneau flottant (corrigé 1.09.2)
 *   - activePanes=0 → perte de .is-active (filet CSS masque tout)
 *   - iframePresent / iframeFailed → piste compte rendu isolé (hors toggle)
 */
(function agiloDiagConfidencePanels() {
  if (window.__agiloDiagConfidenceStop) {
    window.__agiloDiagConfidenceStop();
    console.info('[AGILO:DIAG:CONF] Observateur arrêté.');
    return;
  }

  const paneIds = ['pane-transcript', 'pane-summary', 'pane-chat'];
  const tabIds = ['tab-transcript', 'tab-summary', 'tab-chat'];
  let beforeLoadCount = 0;

  const snapshot = (label) => {
    const tabsBar = document.querySelector('nav.ed-tabs, [data-tour="ed-tabs"]');
    const panel = document.getElementById('ag-confidence-panel');
    const tabsRect = tabsBar?.getBoundingClientRect?.();
    const panelRect = panel?.getBoundingClientRect?.();
    const cs = panel ? getComputedStyle(panel) : null;

    const overlapTabs = !!(tabsRect && panelRect
      && panelRect.bottom > tabsRect.top
      && panelRect.top < tabsRect.bottom
      && panelRect.right > tabsRect.left
      && panelRect.left < tabsRect.right
      && cs?.position === 'fixed');

    const panes = paneIds.map((id) => {
      const el = document.getElementById(id);
      return {
        id,
        isActive: !!el?.classList.contains('is-active'),
        hidden: !!el?.hasAttribute('hidden'),
        display: el ? getComputedStyle(el).display : null
      };
    });

    const tabs = tabIds.map((id) => {
      const el = document.getElementById(id);
      return {
        id,
        isActive: !!el?.classList.contains('is-active'),
        ariaSelected: el?.getAttribute('aria-selected'),
        rect: el ? el.getBoundingClientRect() : null
      };
    });

    const report = {
      label,
      version: window.__agiloEditorConfidenceVersion || null,
      confidenceVisible: panel?.querySelector('#ag-confidence-toggle')?.getAttribute('aria-checked'),
      floating: !!panel?.classList.contains('is-floating'),
      panelPos: cs?.position || null,
      panelZ: cs?.zIndex || null,
      panelTop: panel?.style?.getPropertyValue('--ag-confidence-floating-top') || null,
      overlapTabs,
      activePanes: panes.filter((p) => p.isActive && p.display !== 'none').length,
      panes,
      tabs,
      iframePresent: !!document.querySelector('iframe.ag-summary-iframe'),
      iframeFailed: !!document.querySelector('#summaryEditor[data-iframe-failed="true"]'),
      beforeLoadCount,
      lastTab: (() => { try { return localStorage.getItem('agilo:lastTab'); } catch { return null; } })(),
      confidencePref: (() => { try { return localStorage.getItem('agilo:confidence-visible:v1'); } catch { return null; } })()
    };

    console.group(`[AGILO:DIAG:CONF] ${label}`);
    console.table(panes);
    console.log(report);
    console.groupEnd();
    return report;
  };

  const onBeforeLoad = () => {
    beforeLoadCount += 1;
    snapshot('agilo:beforeload');
  };
  window.addEventListener('agilo:beforeload', onBeforeLoad);

  const observers = [];
  const observe = (node, label) => {
    if (!node) return;
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes') {
          console.log('[AGILO:DIAG:CONF] mutation', label, m.attributeName, {
            className: node.className,
            hidden: node.hasAttribute('hidden'),
            style: node.getAttribute('style')
          });
        }
      }
      snapshot(`mutation:${label}`);
    });
    obs.observe(node, {
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-selected', 'aria-checked']
    });
    observers.push(obs);
  };

  paneIds.forEach((id) => observe(document.getElementById(id), id));
  tabIds.forEach((id) => observe(document.getElementById(id), id));
  observe(document.getElementById('ag-confidence-panel'), 'ag-confidence-panel');

  const toggle = document.getElementById('ag-confidence-toggle');
  const onToggleClick = () => {
    snapshot('before-toggle-tick');
    setTimeout(() => snapshot('after-toggle'), 0);
    setTimeout(() => snapshot('after-toggle-50ms'), 50);
  };
  toggle?.addEventListener('click', onToggleClick, true);

  window.__agiloDiagConfidenceStop = () => {
    observers.forEach((o) => o.disconnect());
    window.removeEventListener('agilo:beforeload', onBeforeLoad);
    toggle?.removeEventListener('click', onToggleClick, true);
    delete window.__agiloDiagConfidenceStop;
  };

  snapshot('baseline');
  console.info('[AGILO:DIAG:CONF] Actif. Cliquez « Passages à relire », puis relancez pour arrêter.');
})();
