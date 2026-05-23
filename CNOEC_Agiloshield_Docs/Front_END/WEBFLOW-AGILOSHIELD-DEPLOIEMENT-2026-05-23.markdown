# Webflow Agiloshield - Reference de deploiement

Date de reference: 23 mai 2026

## Fichiers a copier-coller dans Webflow

Page premium avec Gated Content Memberstack:

- [WEBFLOW-AGILOSHIELD-PREMIUM-2026-05-23.html](/Users/florianbauer/Documents/AGILOTEXT/Agilotext-Scripts-Public/CNOEC_Agiloshield_Docs/Front_END/WEBFLOW-AGILOSHIELD-PREMIUM-2026-05-23.html)

Pages lite/libres (`/app/free...`, `/app/premium...`, `/app/business...`):

- [WEBFLOW-AGILOSHIELD-LITE-2026-05-23.html](/Users/florianbauer/Documents/AGILOTEXT/Agilotext-Scripts-Public/CNOEC_Agiloshield_Docs/Front_END/WEBFLOW-AGILOSHIELD-LITE-2026-05-23.html)

## Ce que contient cette version

- Le texte de restauration affiche `essai 7 jours`.
- Le plan `Agiloshield Classic` est detecte via Memberstack par le prefixe `pln_agiloshield-classic`.
- Les CTA d'upsell utilisent `data-ms-price:add="prc_classic-mensuel-3u5vr0uq5"` et un clic JS direct vers le checkout Memberstack, avec fallback vers `/agiloshield/tarifs`.
- La version CDN referencee est basee sur le commit `fc384fc6c36886d3977e198b289a5303128db61c`.

## Point d'attention Memberstack

Si une URL commence par `/app/`, elle peut etre capturee par une autre regle de Gated Content plus large.

Exemple de conflit:

- regle large: `Starting with app/`
- regle specifique Agiloshield: `Starting with app/agiloshield/premium`

Dans ce cas, la regle large peut bloquer avant la regle specifique. Si l'acces premium est gate par Memberstack, preferer une URL dediee hors de `/app/` ou bien autoriser explicitement tous les plans payants dans la regle large.

## Test rapide des limites en console

Simuler quota atteint sur une page lite/business:

```js
const fakeUsage = JSON.stringify({ count: 99, resetAt: Date.now() + 86400000 });
localStorage.setItem('agilo:anon:usage:v1', fakeUsage);
Object.keys(localStorage).forEach((k) => {
  if (k.startsWith('agilo:anon:usage:v1:')) localStorage.setItem(k, fakeUsage);
});
console.log('quota force');
```

Remise a zero:

```js
localStorage.removeItem('agilo:anon:usage:v1');
Object.keys(localStorage).forEach((k) => {
  if (k.startsWith('agilo:anon:usage:v1:')) localStorage.removeItem(k);
});
console.log('quota reset');
```

## Verification attendue apres publication Webflow

1. Sur la page premium, un membre avec `Classic Mensuel` doit pouvoir ouvrir l'onglet `Restauration` sans message de mise a niveau.
2. Sur une page lite/business sans plan Agiloshield, l'upsell doit afficher le bouton `Voir les tarifs (19EUR)` et le checkout direct Memberstack doit pouvoir se lancer.
3. Si le checkout direct ne se lance pas, le fallback `/agiloshield/tarifs` doit s'ouvrir.
