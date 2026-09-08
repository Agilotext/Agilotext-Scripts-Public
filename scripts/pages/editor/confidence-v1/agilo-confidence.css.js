// Agilotext — Confidence transcript V2.4/V3 (guided review + word issues)
(function () {
  if (document.getElementById('agilo-confidence-css')) return;
  const s = document.createElement('style');
  s.id = 'agilo-confidence-css';
  s.textContent = `
.ag-confidence-chip-host {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  position: relative;
  margin: 0 8px 0 0;
  min-width: 0;
  z-index: 2;
}

.ag-confidence-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 28px;
  padding: 0 4px 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(23, 74, 150, 0.22);
  background: #ffffff;
  color: #174a96;
  font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  white-space: nowrap;
  box-sizing: border-box;
}

.ag-confidence-chip.is-ghost {
  height: 28px;
  padding: 0 10px;
  border-style: dashed;
  background: transparent;
  cursor: pointer;
}

.ag-confidence-chip.is-ghost:hover {
  background: rgba(23, 74, 150, 0.06);
}

.ag-confidence-chip__main,
.ag-confidence-chip__close,
.ag-confidence-chip__nav-btn {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  padding: 0 4px;
}

.ag-confidence-chip__main {
  font-weight: 700;
}

.ag-confidence-chip__close {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 500;
  color: #525252;
}

.ag-confidence-chip__close:hover,
.ag-confidence-chip__nav-btn:hover,
.ag-confidence-chip__main:hover {
  background: rgba(23, 74, 150, 0.08);
  border-radius: 999px;
}

.ag-confidence-chip__nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.ag-confidence-chip__nav-btn {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  font-size: 16px;
}

.ag-confidence-chip__count {
  min-width: 2.2em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 11px;
  color: #525252;
}

.ag-confidence-chip__main:focus-visible,
.ag-confidence-chip__close:focus-visible,
.ag-confidence-chip__nav-btn:focus-visible,
.ag-confidence-chip.is-ghost:focus-visible,
.ag-confidence-review__btn:focus-visible,
.ag-confidence-helper__link:focus-visible,
.ag-confidence-helper__dismiss:focus-visible {
  outline: 2px solid rgba(23, 74, 150, 0.55);
  outline-offset: 2px;
}

#pane-transcript .ag-seg,
.edtr-pane .ag-seg {
  scroll-margin-block: calc(12px + var(--ag-editor-audio-dock-height, 0px));
}

.ag-confidence-helper {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: min(320px, 70vw);
  padding: 0.58rem 0.7rem;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  border: 1px solid rgba(23, 74, 150, 0.16);
  color: #404040;
  white-space: normal;
}

.ag-confidence-helper__copy {
  line-height: 1.35;
  font-weight: 400;
  font-size: 12px;
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

.ag-confidence-helper__link,
.ag-confidence-helper__dismiss {
  border: 0;
  background: transparent;
  color: #174a96;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ag-confidence-helper__dismiss {
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(23, 74, 150, 0.28);
  border-radius: 6px;
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
  .ag-confidence-chip-host {
    margin-right: 6px;
  }

  .ag-confidence-chip {
    height: 26px;
    padding: 0 2px 0 6px;
    font-size: 11px;
  }

  .ag-confidence-chip.is-ghost {
    padding: 0 8px;
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
    width: min(280px, calc(100vw - 24px));
  }

  .ag-confidence-helper__copy {
    min-width: 0;
  }
}
`;
  document.head.appendChild(s);
})();
