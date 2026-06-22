// Agilotext — Confidence transcript V2.1/V3 (styles segment-level + word issues)
(function () {
  if (document.getElementById('agilo-confidence-css')) return;
  const s = document.createElement('style');
  s.id = 'agilo-confidence-css';
  s.textContent = `
.ag-confidence-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 8px 0 12px;
  padding: 0.45rem 0.65rem;
  font-size: 13px;
  color: #525252;
  background: #f8f9fa;
  border: 1px solid rgba(52, 58, 64, 0.15);
  border-radius: 0.35rem;
}

.ag-confidence-panel.is-hidden {
  display: none;
}

.ag-confidence-panel__score strong {
  font-weight: 600;
  color: #174a96;
}

.ag-confidence-panel__stat {
  font-size: 12px;
  white-space: nowrap;
}

.ag-confidence-panel__btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid rgba(23, 74, 150, 0.35);
  border-radius: 0.25rem;
  background: #ffffff;
  color: #174a96;
  font-size: 12px;
  cursor: pointer;
  line-height: 1.3;
}

.ag-confidence-panel__btn:hover {
  background: rgba(23, 74, 150, 0.06);
}

.ag-confidence-panel__btn:focus-visible,
.ag-confidence-review__btn:focus-visible {
  outline: 2px solid rgba(23, 74, 150, 0.55);
  outline-offset: 2px;
}

.ag-confidence-panel__btn--ghost {
  background: transparent;
}

.ag-confidence-panel__nav-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #525252;
}

.ag-confidence-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  margin-left: 8px;
  white-space: nowrap;
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
  margin-left: 6px;
  background: #e0f2fe;
  color: #075985;
  white-space: nowrap;
}

.ag-confidence-review {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
}

.ag-confidence-review__btn {
  height: 22px;
  padding: 0 7px;
  border: 1px solid rgba(23, 74, 150, 0.22);
  border-radius: 4px;
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
  border-color: rgba(52, 58, 64, 0.18);
}

.ag-confidence-verify .ag-seg__text {
  background: linear-gradient(90deg, rgba(255, 247, 237, 0.95), rgba(255, 247, 237, 0.45));
  border-left: 3px solid #fed7aa;
  border-radius: 4px;
  padding-left: 8px;
}

.ag-confidence-low .ag-seg__text {
  background: linear-gradient(90deg, rgba(255, 237, 213, 0.98), rgba(255, 247, 237, 0.62));
  border-left: 3px solid #fb923c;
  border-radius: 4px;
  padding-left: 8px;
}

.ag-confidence-reviewed .ag-seg__text,
.ag-confidence-ignored .ag-seg__text {
  background: transparent;
  border-left-color: transparent;
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
  outline: 2px solid #174a96;
  outline-offset: 2px;
  border-radius: 4px;
}
`;
  document.head.appendChild(s);
})();
