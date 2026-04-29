# Démos iframe homepage Agilotext — Capture + Résultat

Pages HTML **autonomes** (CSS inline, JS vanilla) pour embeds Webflow en **deux expériences** :

| Fichier | Rôle | Contenu |
|---------|------|---------|
| **[`capture.html`](capture.html)** | INPUT | Fenêtre Mac + carte blanche type **tableau de bord** (Enregistrer, Fichier / YouTube / Dictée en direct, options). **Simuler une transcription** (loading factice). Statique. |
| **[`result.html`](result.html)** | OUTPUT | Lecteur audio + **3 segments** synchronisés, onglets Transcription / Compte rendu / Agent IA, CR structuré, 2 suggestions IA. |
| **[`index.html`](index.html)** | Hub | Liens, snippets iframe, migration, checklist QA (prévisualisation / doc interne). |

**Palette** : fond beige `#E7E0DA`, accent produit **bleu `#174a96`** (plus de violet). Orange réservé au marketing hors ces embeds si besoin.

**Audio** : [`demo.mp3`](demo.mp3) — **durée 30 s** (ton pur généré par ffmpeg), utilisé uniquement pour la démo.

### Régénérer `demo.mp3` (ffmpeg)

À exécuter depuis ce dossier :

```bash
ffmpeg -y -f lavfi -i "sine=frequency=330:duration=30" -c:a libmp3lame -q:a 5 demo.mp3
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 demo.mp3
```

La durée doit rester **30 s** pour que les `data-start` / `data-end` dans `result.html` restent valides.

---

## URLs — GitHub Pages

```
https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/capture.html
https://agilotext.github.io/Agilotext-Scripts-Public/webflow-embeds/homepage-mini-demo/result.html
```

Hub : `…/homepage-mini-demo/` ou `…/homepage-mini-demo/index.html`

### jsDelivr

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/docs/webflow-embeds/homepage-mini-demo/capture.html
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/docs/webflow-embeds/homepage-mini-demo/result.html
```

(Remplacer `@1.06` par la branche ou le tag souhaité.)

---

## Migration

L’ancienne démo **monolithique** dans un seul `index.html` (capture + résultat mélangés) est **remplacée** par ce découpage. Les embeds qui pointaient uniquement vers le dossier sans fichier précis doivent être mis à jour vers **`capture.html`** et **`result.html`** selon le bloc de la page.

---

## Sécurité (embed statique)

- Pas d’appel à `api.agilotext.com`, pas de jetons, pas de `jobId`, pas de données clients réelles.
- `demo.mp3` servi en chemin relatif uniquement.

---

## Modifier ou étendre

1. Éditer `capture.html` et/ou `result.html`.
2. Si la durée audio change : régénérer `demo.mp3`, ajuster segments et libellés de temps dans `result.html`.
3. Commit + push sur la branche déployée (ex. **`1.06`**).
