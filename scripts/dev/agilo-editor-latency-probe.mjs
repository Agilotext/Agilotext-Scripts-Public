#!/usr/bin/env node
/**
 * Probe locale (pas d’auth Memberstack).
 * Dans l’éditeur Bauer, coller le snippet console pour mesurer horloge C.
 *
 * Marks attendus :
 *   performance.mark('agilo:beforeload')
 *   performance.mark('agilo:transcript-visible')
 *   performance.mark('agilo:summary-visible')
 *   performance.mark('agilo:confidence-applied')
 */
const snippet = `
(function () {
  const marks = [];
  function stamp(name) {
    performance.mark(name);
    marks.push({ name, t: performance.now() });
    console.info('[agilo:latency]', name, Math.round(performance.now()), 'ms');
  }
  window.addEventListener('agilo:beforeload', () => stamp('agilo:beforeload'), { once: true });
  window.addEventListener('agilo:transcript-loaded', () => stamp('agilo:transcript-visible'));
  window.addEventListener('agilo:summary-ready', () => stamp('agilo:summary-visible'));
  window.__agiloLatencyMarks = () => marks.slice();
  console.info('[agilo:latency] probe armé. Ouvre un job puis window.__agiloLatencyMarks()');
})();
`;

console.log(snippet.trim());
console.error('Coller le snippet ci-dessus dans la console Bauer (session connectée). L’agent ne peut pas mesurer access-denied.');
