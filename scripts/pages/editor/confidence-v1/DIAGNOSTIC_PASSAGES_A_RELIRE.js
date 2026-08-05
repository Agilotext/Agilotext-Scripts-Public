/**
 * Diagnostic console — « Passages à relire » vs onglets éditeur
 *
 * Usage (page éditeur live) :
 *   1. Coller ce script dans la console AVANT de cliquer « Passage suivant »
 *   2. window.__agiloProbe() → baseline (scrollTop des ancêtres)
 *   3. Cliquer « Passage suivant »
 *   4. window.__agiloProbe() → comparer
 *   5. Lire le rapport [AGILO:DIAG:CONF]
 *
 * Interprétation :
 *   - edBodyScrollTop > 0 + overflowY hidden → scrollIntoView non borné (corrigé 1.09.3)
 *   - overlapTabs=true + floating=true → recouvrement panneau flottant (piste secondaire)
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

  window.__agiloProbe = () => [
    ...document.querySelectorAll('.ed-body, .ed-main, .edtr-pane'),
    document.scrollingElement
  ].map((e) => ({
    el: e === document.scrollingElement ? 'document' : (e.id || e.className),
    scrollTop: e.scrollTop,
    overflowY: getComputedStyle(e).overflowY,
    scrollable: e.scrollHeight > e.clientHeight + 2
  }));

  const scrollChain = () => {
    const nodes = [
      document.querySelector('.ed-body'),
      document.querySelector('.ed-main'),
      document.querySelector('.edtr-pane.is-active'),
      document.scrollingElement
    ].filter(Boolean);
    return nodes.map((el) => ({
      el: el === document.scrollingElement ? 'document' : (el.id || el.className),
      scrollTop: el.scrollTop,
      overflowY: getComputedStyle(el).overflowY
    }));
  };

  const snapshot = (label) => {
    const tabsBar = document.querySelector('nav.ed-tabs, [data-tour="ed-tabs"]');
    const panel = document.getElementById('ag-confidence-panel');
    const tabsRect = tabsBar?.getBoundingClientRect?.();
    const panelRect = panel?.getBoundingClientRect?.();
    const cs = panel ? getComputedStyle(panel) : null;
    const edBody = document.querySelector('.ed-body');

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
        display: el ? getComputedStyle(el).display : null,
        scrollTop: el?.scrollTop ?? null,
        overflowY: el ? getComputedStyle(el).overflowY : null
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
      edBodyScrollTop: edBody?.scrollTop ?? null,
      edBodyOverflowY: edBody ? getComputedStyle(edBody).overflowY : null,
      scrollChain: scrollChain(),
      activePanes: panes.filter((p) => p.isActive && p.display !== 'none').length,
      panes,
      tabs,
      iframePresent: !!document.querySelector('iframe.ag-summary-iframe'),
      iframeFailed: !!document.querySelector('#summaryEditor[data-iframe-failed="true"]'),
      beforeLoadCount,
      lastTab: (() => { try { return localStorage.getItem('agilo:lastTab'); } catch { return null; } })(),
      confidencePref: (() => { try { return localStorage.getItem('agilo:confidence-visible:v1'); } catch { return null; } })()
    };

    if (edBody && edBody.scrollTop > 0) {
      console.warn('[AGILO:DIAG:CONF] ed-body scrollTop > 0 — barre d onglets probablement decoupee (bug scrollIntoView non borne)');
    }

    console.group(`[AGILO:DIAG:CONF] ${label}`);
    console.table(panes);
    console.table(report.scrollChain);
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

  const edBody = document.querySelector('.ed-body');
  if (edBody) {
    const scrollWatch = () => {
      if (edBody.scrollTop > 0) {
        console.warn('[AGILO:DIAG:CONF] watchdog: .ed-body scrollTop =', edBody.scrollTop);
      }
    };
    window.addEventListener('scroll', scrollWatch, true);
    observers.push({ disconnect: () => window.removeEventListener('scroll', scrollWatch, true) });
  }

  const toggle = document.getElementById('ag-confidence-toggle');
  const onToggleClick = () => {
    snapshot('before-toggle-tick');
    setTimeout(() => snapshot('after-toggle'), 0);
    setTimeout(() => snapshot('after-toggle-50ms'), 50);
  };
  toggle?.addEventListener('click', onToggleClick, true);

  const nextBtn = document.getElementById('ag-confidence-next');
  const onNextClick = () => {
    snapshot('before-passage-suivant');
    setTimeout(() => {
      snapshot('after-passage-suivant');
      console.table(window.__agiloProbe());
    }, 350);
  };
  nextBtn?.addEventListener('click', onNextClick, true);

  window.__agiloDiagConfidenceStop = () => {
    observers.forEach((o) => o.disconnect());
    window.removeEventListener('agilo:beforeload', onBeforeLoad);
    toggle?.removeEventListener('click', onToggleClick, true);
    nextBtn?.removeEventListener('click', onNextClick, true);
    delete window.__agiloDiagConfidenceStop;
    delete window.__agiloProbe;
  };

  snapshot('baseline');
  console.info('[AGILO:DIAG:CONF] Actif. Cliquez « Passage suivant », puis relancez pour arrêter.');
})();
