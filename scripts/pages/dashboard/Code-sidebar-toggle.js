/**
 * Agilotext — toggle barre latérale dashboard (.dashboard-left)
 * Webflow : coller le CSS (Code-sidebar-toggle.css) + ce script
 *           dans Project Settings → Custom Code → Before </body>
 *
 * Le bouton Webflow porte data-sidebar-toggle + class button-sidebar.
 * v1.9 — flyouts collapsed, hover/actif, libellés propres.
 *         v1.8 — fix wrapper .dashboard-link.folder > .embed-code-dossier.
 *         v1.9.1 — logo nav_logo-link re-cliquable (retrait pointer-events:none global).
 */
(function () {
  'use strict';

  if (!/\/app\//i.test(location.pathname)) return;
  if (window.__agiloSidebarToggleBound) return;
  window.__agiloSidebarToggleBound = true;

  var STORAGE_KEY = 'agilo_sidebar_collapsed_v1';
  var HIDE_CLASS = 'hide';
  var TOGGLE_SEL = '.button-sidebar, [data-sidebar-toggle]';
  var FLYOUT_ID = 'agilo-sidebar-flyout';
  var FLYOUT_SHOW_MS = 80;
  var FLYOUT_HIDE_MS = 120;
  var FLYOUT_TARGET_SEL =
    'a.dashboard-link:not(.folder), .dashboard-link.folder, summary.agilo-nav-folders__summary, .button-sidebar, [data-sidebar-toggle]';

  var TOUR_LABELS = {
    'nav-dashboard': 'Accueil',
    'nav-transcripts': 'Mes fichiers',
    'nav-account': 'Mon compte',
    'nav-billing': 'Factures',
    'nav-anonymize': 'Anonymiser (RGPD)',
    'nav-support': 'Support'
  };

  var flyoutState = {
    el: null,
    showTimer: null,
    hideTimer: null,
    currentTarget: null
  };

  function readCollapsedPref() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_e) {
      return false;
    }
  }

  function writeCollapsedPref(collapsed) {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (_e) {
      /* Brave / mode privé strict : ignorer */
    }
  }

  function getPair(fromToggle) {
    var sidebar = document.querySelector('.dashboard-left');
    var toggle = fromToggle || document.querySelector(TOGGLE_SEL);
    if (!sidebar || !toggle) return null;
    return { sidebar: sidebar, toggle: toggle };
  }

  function cleanLabel(text) {
    return String(text || '')
      .replace(/([a-zàâäéèêëïîôùûü])([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isFolderTarget(el) {
    if (!el || !el.matches) return false;
    return el.matches('.dashboard-link.folder, .agilo-nav-folders__summary') ||
      !!(el.closest && el.closest('.dashboard-link.folder'));
  }

  function isToggleTarget(el) {
    return !!(el && el.matches && el.matches(TOGGLE_SEL));
  }

  function resolveNavLabel(el) {
    if (!el) return 'Navigation';

    if (isToggleTarget(el)) {
      var pair = getPair();
      return pair && pair.sidebar.classList.contains('is-collapsed')
        ? 'Ouvrir le menu'
        : 'Réduire le menu';
    }

    if (isFolderTarget(el)) return 'Dossiers';

    var stored = el.getAttribute('data-sidebar-label');
    if (stored) return stored;

    var wrapperText = el.querySelector('.wrapper-link > div:first-child');
    if (wrapperText) {
      var wt = cleanLabel(wrapperText.textContent);
      if (wt) return wt;
    }

    var tour = el.getAttribute('data-tour');
    if (tour && TOUR_LABELS[tour]) return TOUR_LABELS[tour];

    var storedTitle = el.getAttribute('data-sidebar-title-stored') || el.getAttribute('title');
    if (storedTitle) return cleanLabel(storedTitle);

    var directDivs = el.querySelectorAll(':scope > div');
    for (var i = 0; i < directDivs.length; i++) {
      var node = directDivs[i];
      if (node.classList.contains('wrapper-link')) continue;
      if (node.classList.contains('icon-small') || node.classList.contains('w-embed')) continue;
      if (node.classList.contains('wrapper-new-button')) continue;
      var dt = cleanLabel(node.textContent);
      if (dt && dt.length < 48) return dt;
    }

    return 'Navigation';
  }

  function resolveNavHint(el) {
    if (!el || isToggleTarget(el)) return '';

    if (isFolderTarget(el)) return 'Cliquer pour ouvrir le menu';

    var tour = el.getAttribute('data-tour');
    if (tour === 'nav-transcripts') {
      var rc = document.getElementById('readyCount');
      var n = rc ? parseInt(String(rc.textContent).trim(), 10) : 0;
      if (n > 0) {
        return n + ' fichier' + (n > 1 ? 's' : '') + ' prêt' + (n > 1 ? 's' : '');
      }
    }

    if (tour === 'nav-billing' && el.getAttribute('target') === '_blank') {
      return 'Nouvel onglet';
    }

    return '';
  }

  function getFlyoutTarget(fromEl) {
    if (!fromEl || !fromEl.closest) return null;
    if (fromEl.matches && fromEl.matches(FLYOUT_TARGET_SEL)) return fromEl;
    return fromEl.closest(FLYOUT_TARGET_SEL);
  }

  function ensureFlyout() {
    if (flyoutState.el) return flyoutState.el;
    var el = document.createElement('div');
    el.id = FLYOUT_ID;
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    el.innerHTML =
      '<span class="agilo-sidebar-flyout__label"></span>' +
      '<span class="agilo-sidebar-flyout__hint"></span>';
    document.body.appendChild(el);
    flyoutState.el = el;
    return el;
  }

  function hideFlyout(immediate) {
    clearTimeout(flyoutState.showTimer);
    clearTimeout(flyoutState.hideTimer);

    function doHide() {
      if (flyoutState.currentTarget) {
        flyoutState.currentTarget.removeAttribute('aria-describedby');
        flyoutState.currentTarget = null;
      }
      if (!flyoutState.el) return;
      flyoutState.el.classList.remove('is-visible', 'is-flip-left');
      flyoutState.el.hidden = true;
    }

    if (immediate) doHide();
    else flyoutState.hideTimer = setTimeout(doHide, FLYOUT_HIDE_MS);
  }

  function positionFlyout(flyout, target) {
    var rect = target.getBoundingClientRect();
    flyout.classList.remove('is-flip-left');
    flyout.hidden = false;
    flyout.classList.add('is-visible');

    var fh = flyout.offsetHeight || 0;
    var fw = flyout.offsetWidth || 0;
    var top = rect.top + rect.height / 2 - fh / 2;
    var left = rect.right + 10;

    if (left + fw > window.innerWidth - 8) {
      left = rect.left - fw - 10;
      flyout.classList.add('is-flip-left');
    }

    if (top < 8) top = 8;
    if (top + fh > window.innerHeight - 8) top = Math.max(8, window.innerHeight - fh - 8);

    flyout.style.left = Math.round(left) + 'px';
    flyout.style.top = Math.round(top) + 'px';
    flyout.style.marginTop = '0';
  }

  function showFlyout(target) {
    var pair = getPair();
    if (!pair || !target) return;

    var collapsed = pair.sidebar.classList.contains('is-collapsed');
    if (!isToggleTarget(target) && !collapsed) return;

    clearTimeout(flyoutState.hideTimer);
    clearTimeout(flyoutState.showTimer);

    flyoutState.showTimer = setTimeout(function () {
      if (!document.body.contains(target)) return;

      var flyout = ensureFlyout();
      if (flyoutState.currentTarget && flyoutState.currentTarget !== target) {
        flyoutState.currentTarget.removeAttribute('aria-describedby');
      }

      flyoutState.currentTarget = target;
      var labelEl = flyout.querySelector('.agilo-sidebar-flyout__label');
      var hintEl = flyout.querySelector('.agilo-sidebar-flyout__hint');
      var label = resolveNavLabel(target);
      var hint = resolveNavHint(target);

      labelEl.textContent = label;
      if (hint) {
        hintEl.textContent = hint;
        hintEl.style.display = 'block';
      } else {
        hintEl.textContent = '';
        hintEl.style.display = 'none';
      }

      positionFlyout(flyout, target);
      target.setAttribute('aria-describedby', FLYOUT_ID);
    }, FLYOUT_SHOW_MS);
  }

  function shouldShowFlyout(target, sidebar) {
    if (!target || !sidebar.contains(target)) return false;
    if (isToggleTarget(target)) return true;
    return sidebar.classList.contains('is-collapsed');
  }

  function onFlyoutMouseOver(event) {
    var pair = getPair();
    if (!pair) return;
    var target = getFlyoutTarget(event.target);
    if (!shouldShowFlyout(target, pair.sidebar)) return;
    showFlyout(target);
  }

  function onFlyoutMouseOut(event) {
    var target = getFlyoutTarget(event.target);
    if (!target) return;
    var related = event.relatedTarget;
    if (related && target.contains(related)) return;
    hideFlyout(false);
  }

  function onFlyoutFocusIn(event) {
    onFlyoutMouseOver(event);
  }

  function onFlyoutFocusOut(event) {
    var target = getFlyoutTarget(event.target);
    if (!target) return;
    var related = event.relatedTarget;
    if (related && target.contains(related)) return;
    hideFlyout(false);
  }

  function initNavLabels(sidebar) {
    sidebar.querySelectorAll('a.dashboard-link').forEach(function (link) {
      if (link.getAttribute('title') && !link.getAttribute('data-sidebar-title-stored')) {
        link.setAttribute('data-sidebar-title-stored', link.getAttribute('title'));
      }
      var label = resolveNavLabel(link);
      if (label && label !== 'Navigation') {
        link.setAttribute('data-sidebar-label', label);
      }
    });

    var folderWrap = sidebar.querySelector('.dashboard-link.folder');
    if (folderWrap) {
      folderWrap.setAttribute('data-sidebar-label', 'Dossiers');
    }

    sidebar.querySelectorAll('.agilo-nav-folders__summary').forEach(function (sum) {
      sum.setAttribute('data-sidebar-label', 'Dossiers');
    });
  }

  function syncTitleAttributes(sidebar, collapsed) {
    sidebar.querySelectorAll('a.dashboard-link, .dashboard-link.folder, .agilo-nav-folders__summary').forEach(function (el) {
      var label = el.getAttribute('data-sidebar-label') || resolveNavLabel(el);
      if (collapsed) {
        el.removeAttribute('title');
        if (label) el.setAttribute('aria-label', label);
      } else if (label) {
        el.setAttribute('title', label);
      }
    });
  }

  function updateFolderActiveState(sidebar) {
    var folder = sidebar.querySelector('.dashboard-link.folder');
    if (!folder) return;
    var active = folder.querySelector('.agilo-nav-folders__row.is-active');
    folder.classList.toggle('is-nav-active', !!active);
  }

  function bindFlyout(sidebar) {
    if (sidebar.__agiloFlyoutBound) return;
    sidebar.__agiloFlyoutBound = true;

    sidebar.addEventListener('mouseover', onFlyoutMouseOver, true);
    sidebar.addEventListener('mouseout', onFlyoutMouseOut, true);
    sidebar.addEventListener('focusin', onFlyoutFocusIn, true);
    sidebar.addEventListener('focusout', onFlyoutFocusOut, true);

    window.addEventListener('scroll', function () { hideFlyout(true); }, true);
    window.addEventListener('resize', function () { hideFlyout(true); });

    var root = document.getElementById('agilo-nav-folders-root');
    if (root) {
      new MutationObserver(function () {
        updateFolderActiveState(sidebar);
      }).observe(root, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  function setIconVisibility(toggle, collapsed) {
    var iconCollapse =
      toggle.querySelector('[data-icon="collapse"]') || toggle.querySelectorAll('svg')[0];
    var iconExpand =
      toggle.querySelector('[data-icon="expand"]') || toggle.querySelectorAll('svg')[1];
    if (iconCollapse) iconCollapse.classList.toggle(HIDE_CLASS, collapsed);
    if (iconExpand) iconExpand.classList.toggle(HIDE_CLASS, !collapsed);
  }

  function purgeInlineStyles(sidebar) {
    var PROPS = ['display', 'visibility', 'opacity'];

    ['.wrapper-menu', '.full-width', '.dashboard-menu'].forEach(function (sel) {
      var el = sidebar.querySelector(sel);
      if (!el) return;
      PROPS.forEach(function (p) { el.style.removeProperty(p); });
    });

    sidebar.querySelectorAll('.dashboard-link .icon-small, .dashboard-link .icon-1x1-small').forEach(function (el) {
      PROPS.forEach(function (p) { el.style.removeProperty(p); });
    });

    sidebar.querySelectorAll(
      '.dashboard-link.folder > .embed-code-dossier, ' +
      '#agilo-nav-folders-root, ' +
      '.agilo-nav-folders__summary-main, .agilo-nav-folders__summary-icon-root'
    ).forEach(function (el) {
      PROPS.forEach(function (p) { el.style.removeProperty(p); });
    });
  }

  function setCollapsed(sidebar, toggle, collapsed, persist) {
    sidebar.classList.toggle('is-collapsed', collapsed);
    purgeInlineStyles(sidebar);
    void sidebar.offsetHeight;

    toggle.setAttribute('aria-expanded', String(!collapsed));
    var label = collapsed ? 'Ouvrir la barre latérale' : 'Réduire la barre latérale';
    toggle.setAttribute('aria-label', label);
    if (collapsed) {
      toggle.removeAttribute('title');
    } else {
      toggle.setAttribute('title', label);
    }

    setIconVisibility(toggle, collapsed);
    syncTitleAttributes(sidebar, collapsed);
    updateFolderActiveState(sidebar);
    hideFlyout(true);

    if (persist) writeCollapsedPref(collapsed);
  }

  function initSidebar(sidebar, toggle) {
    if (!sidebar.id) sidebar.id = 'agiloSidebar';
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.removeAttribute('data-sidebar-init');

    initNavLabels(sidebar);
    bindFlyout(sidebar);
    updateFolderActiveState(sidebar);

    setCollapsed(sidebar, toggle, readCollapsedPref(), false);

    try {
      toggle.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (_e) {}
  }

  function boot() {
    var pair = getPair();
    if (!pair) return;
    initSidebar(pair.sidebar, pair.toggle);
  }

  function isClickInsideToggle(event, toggle) {
    if (!toggle) return false;

    var target = event.target;
    if (target && (toggle === target || toggle.contains(target))) return true;
    if (target && target.closest && target.closest(TOGGLE_SEL)) return true;
    if (event.clientX == null || event.clientY == null) return false;

    var rect = toggle.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function onToggleClick(event) {
    var pair = getPair();
    if (!pair) return;

    if (pair.sidebar.classList.contains('is-collapsed')) {
      var target = event.target;
      var foldersHit = target && target.closest
        ? target.closest('.agilo-nav-folders__summary, .dashboard-link.folder')
        : null;
      if (foldersHit && pair.sidebar.contains(foldersHit)) {
        event.preventDefault();
        event.stopPropagation();
        setCollapsed(pair.sidebar, pair.toggle, false, true);
        return;
      }
    }

    if (!isClickInsideToggle(event, pair.toggle)) return;

    event.preventDefault();
    event.stopPropagation();
    setCollapsed(
      pair.sidebar,
      pair.toggle,
      !pair.sidebar.classList.contains('is-collapsed'),
      true
    );
  }

  document.addEventListener('click', onToggleClick, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
