// Agilotext — Confidence transcript V2 (styles segment-level)
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
  background: #f59e0b;
  color: #111827;
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

.ag-seg.is-confidence-nav-active {
  outline: 2px solid #174a96;
  outline-offset: 2px;
  border-radius: 4px;
}
`;
  document.head.appendChild(s);
})();
