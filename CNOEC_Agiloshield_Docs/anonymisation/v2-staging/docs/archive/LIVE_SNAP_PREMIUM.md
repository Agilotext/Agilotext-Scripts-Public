# Snapshot page Premium V2 avant tranche 0 (02/10/2026)

Page : `/tools/agiloshield/premium/dashboard` (`6990456b35957c5425c25a71`), site `6815bee5a9c0b57da18354fb`.

Instances de composants sur la page :

| Instance (element id) | Composant | Rôle |
|-----|-----|-----|
| `c7ad8cb0-05b9-3f36-c7c7-d6ffcc7e7703` | `Anon_NEW_2026_GATED` (`cd349748-…d49`) | Embed V2 (pin `f0a1ccc0`) |
| `353738c5-af16-cd04-4a86-7c3ba576ebb4` | `Footer-anon` | Pied de page |
| `45617e30-0439-27bc-f689-7989f786ac1e` | `Code-Anon_Limited` (`dbc54daa-a1e5-9668-5a0c-60064b77a10a`) | Chargeur anon2, **retiré de cette page** |
| `695ed9e5-0a17-41b4-3977-21015a65c513` | `Code-Anon-Skill` | Cowork, ne pas toucher |

Code du composant `Code-Anon_Limited` (inchangé, toujours utilisé ailleurs) :

```html
<!-- Script unifié Lite/Classic. Upsell 19 € seulement sans plan Classic actif. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@420f5be2bbd3e3890a717c86bf392cd0ab283469/CNOEC_Agiloshield_Docs/anonymisation/agiloshield-embed-anonymisation-anon2-beta.js?v=2.4.19" defer></script>
```

Pourquoi le retirer : sur la page V2, ce script s'initialisait entièrement (détection d'édition, `api.agilotext.com/api/v1/getToken` en production, options, reprise de jobs) sans aucune utilité pour V2.

Même retrait sur la page Free `/app/free/dashboard/anonymiser` (`6815bee5a9c0b57da183557b`) : instance `dbc54daa-a1e5-9668-5a0c-60064b77a109`. La page Business n'avait pas d'instance.

Rollback : dans le Designer, glisser une instance `Code-Anon_Limited` en bas du body de la page, puis publier staging.
