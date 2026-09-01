// Agilotext — Confidence transcript V2.4/V3 (guided review + word issues)
(function () {
  if (document.getElementById('agilo-confidence-css')) return;
  const s = document.createElement('style');
  s.id = 'agilo-confidence-css';
  s.textContent = `
.ag-confidence-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 8px 0 12px;
  padding: 0.5rem 0.7rem;
  font-size: 13px;
  color: #525252;
  background: rgba(248, 249, 250, 0.96);
  border: 1px solid rgba(52, 58, 64, 0.15);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  position: sticky;
  top: 8px;
  z-index: 20;
  backdrop-filter: blur(8px);
  box-sizing: border-box;
  transition: box-shadow .16s ease, padding .16s ease, border-color .16s ease, transform .16s ease;
}

/* Flotte sous la chrome éditeur (onglets/toolbar). Ne jamais monter au-dessus
   des onglets Transcription / Compte rendu / Assistant (bug top:10px / z:9999). */
.ag-confidence-panel.is-floating {
  position: fixed;
  top: var(--ag-confidence-floating-top, 8px);
  left: var(--ag-confidence-floating-left, 16px);
  width: var(--ag-confidence-floating-width, min(760px, calc(100vw - 32px)));
  max-width: calc(100vw - 32px);
  margin: 0;
  padding: 0.32rem 0.46rem;
  gap: 6px 8px;
  z-index: 25;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.16);
  border-color: rgba(23, 74, 150, 0.20);
  transform: translateZ(0);
}

#pane-transcript .ag-seg,
.edtr-pane .ag-seg {
  scroll-margin-block: 96px;
}

.ag-confidence-panel.is-floating .ag-confidence-panel__stat:not(.ag-confidence-panel__stat--primary),
.ag-confidence-panel.is-floating .ag-confidence-panel__score,
.ag-confidence-panel.is-floating .ag-confidence-helper {
  display: none;
}

.ag-confidence-panel.is-disabled {
  border-color: rgba(52, 58, 64, 0.12);
  background: rgba(248, 249, 250, 0.92);
}

.ag-confidence-panel-sentinel {
  display: block;
  height: 1px;
  margin: 0;
  padding: 0;
  pointer-events: none;
}

.ag-confidence-panel__score strong {
  font-weight: 600;
  color: #174a96;
}

.ag-confidence-panel__main {
  font-size: 13px;
  font-weight: 700;
  color: #262626;
  white-space: nowrap;
}

.ag-confidence-panel__score {
  font-size: 12px;
  color: #626262;
  white-space: nowrap;
}

.ag-confidence-panel__stat {
  font-size: 12px;
  white-space: nowrap;
}

.ag-confidence-panel__btn {
  padding: 0.28rem 0.58rem;
  border: 1px solid rgba(23, 74, 150, 0.35);
  border-radius: 6px;
  background: #ffffff;
  color: #174a96;
  font-size: 12px;
  cursor: pointer;
  line-height: 1.3;
}

.ag-confidence-panel__btn:hover {
  background: rgba(23, 74, 150, 0.06);
}

.ag-confidence-panel__btn--primary {
  background: #174a96;
  border-color: #174a96;
  color: #ffffff;
  font-weight: 700;
}

.ag-confidence-panel__btn--primary:hover {
  background: #123d7c;
}

.ag-confidence-panel__btn:focus-visible,
.ag-confidence-review__btn:focus-visible,
.ag-confidence-toggle:focus-visible,
.ag-confidence-helper__link:focus-visible {
  outline: 2px solid rgba(23, 74, 150, 0.55);
  outline-offset: 2px;
}

.ag-confidence-panel__btn--ghost {
  background: transparent;
}

.ag-confidence-panel__nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ag-confidence-panel__nav-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #525252;
  min-width: 6.5em;
  text-align: center;
}

.ag-confidence-panel__btn--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 28px;
  padding: 0.22rem 0.4rem;
}

.ag-confidence-panel__btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.ag-confidence-panel__btn-icon svg {
  display: block;
}

.ag-confidence-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 26px;
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(23, 74, 150, 0.20);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
  color: #174a96;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.ag-confidence-toggle:hover {
  background: rgba(23, 74, 150, 0.06);
}

.ag-confidence-toggle__track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: #cbd5e1;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.10);
  transition: background .16s ease;
}

.ag-confidence-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.22);
  transition: transform .16s ease;
}

.ag-confidence-toggle[aria-checked="true"] .ag-confidence-toggle__track {
  background: #174a96;
}

.ag-confidence-toggle[aria-checked="true"] .ag-confidence-toggle__thumb {
  transform: translateX(12px);
}

.ag-confidence-helper {
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  padding: 0.48rem 0.58rem;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 0 0 1px rgba(23, 74, 150, 0.12);
  color: #404040;
}

.ag-confidence-helper__copy {
  flex: 1 1 auto;
  min-width: 220px;
  line-height: 1.35;
}

.ag-confidence-helper__copy strong {
  color: #174a96;
  font-weight: 700;
}

.ag-confidence-helper__hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 12px;
  color: #626262;
}

.ag-confidence-helper__link {
  border: 0;
  background: transparent;
  color: #174a96;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ag-confidence-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.ag-confidence-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 0.35rem;
  vertical-align: baseline;
  flex-wrap: wrap;
}

.ag-confidence-normal .ag-confidence-badge {
  background: #eef2f7;
  color: #475569;
}

.ag-confidence-verify .ag-confidence-badge {
  background: #fff7ed;
  color: #b45309;
  box-shadow: inset 0 0 0 1px #fed7aa;
}

.ag-confidence-low .ag-confidence-badge {
  background: #ffedd5;
  color: #9a3412;
  box-shadow: inset 0 0 0 1px #fdba74;
}

.ag-confidence-modified {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: #e0f2fe;
  color: #075985;
  white-space: nowrap;
}

.ag-confidence-review {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 0 0 1px rgba(52, 58, 64, 0.08);
}

.ag-confidence-review__btn {
  height: 22px;
  padding: 0 7px;
  border: 1px solid rgba(23, 74, 150, 0.18);
  border-radius: 5px;
  background: #ffffff;
  color: #174a96;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}

.ag-confidence-review__btn:hover {
  background: rgba(23, 74, 150, 0.06);
}

.ag-confidence-review__btn--ghost {
  color: #525252;
  border-color: transparent;
  background: transparent;
}

.ag-confidence-verify .ag-seg__text {
  display: block;
  clear: both;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  background: linear-gradient(90deg, rgba(255, 247, 237, 0.98), rgba(255, 251, 235, 0.58));
  border-radius: 7px;
  margin-top: 0.18rem;
  padding: 2px 7px;
  box-shadow: inset 0 0 0 1px rgba(253, 186, 116, 0.22);
}

.ag-confidence-low .ag-seg__text {
  display: block;
  clear: both;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  background: linear-gradient(90deg, rgba(255, 237, 213, 0.98), rgba(255, 247, 237, 0.64));
  border-radius: 7px;
  margin-top: 0.18rem;
  padding: 2px 7px;
  box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.28);
}

.ag-confidence-reviewed .ag-seg__text,
.ag-confidence-ignored .ag-seg__text {
  background: transparent;
  box-shadow: none;
}

.ag-confidence-reviewed .ag-confidence-badge {
  background: #dcfce7;
  color: #166534;
  box-shadow: inset 0 0 0 1px #bbf7d0;
}

.ag-confidence-ignored .ag-confidence-badge {
  background: #f1f5f9;
  color: #475569;
  box-shadow: inset 0 0 0 1px #cbd5e1;
}

.ag-confidence-word {
  border-radius: 3px;
  padding: 0 2px;
  color: inherit;
  font: inherit;
}

.ag-confidence-word--verify {
  background: rgba(250, 204, 21, 0.28);
  box-shadow: inset 0 -1px 0 rgba(202, 138, 4, 0.45);
}

.ag-confidence-word--low {
  background: rgba(251, 146, 60, 0.38);
  box-shadow: inset 0 -1px 0 rgba(194, 65, 12, 0.5);
}

.ag-seg.is-confidence-nav-active {
  outline: 2px solid rgba(23, 74, 150, 0.85);
  outline-offset: 4px;
  border-radius: 8px;
}

#pane-transcript .ag-seg__head {
  gap: 0.42rem;
  flex-wrap: wrap;
  align-items: center;
}

#pane-transcript .ag-seg__head .speaker {
  margin-right: 0.2rem;
}

#pane-transcript .ag-seg__head .rename-btn {
  margin-right: 0.1rem;
}

@media (max-width: 640px) {
  .ag-confidence-panel {
    top: 6px;
    gap: 6px;
    padding: 0.42rem 0.5rem;
  }

  .ag-confidence-panel__stat {
    font-size: 11px;
  }

  .ag-confidence-panel__nav .ag-confidence-panel__btn-icon {
    display: inline-flex;
  }

  .ag-confidence-panel__nav-count {
    min-width: 4.5em;
  }

  .ag-confidence-controls {
    display: flex;
    width: 100%;
    margin-left: 0;
    margin-top: 2px;
  }

  .ag-confidence-review {
    flex-basis: 100%;
    width: fit-content;
  }

  .ag-confidence-helper {
    align-items: flex-start;
    flex-direction: column;
  }

  .ag-confidence-helper__copy {
    min-width: 0;
  }

  .ag-confidence-toggle {
    max-width: 100%;
  }
}
`;
  document.head.appendChild(s);
})();
