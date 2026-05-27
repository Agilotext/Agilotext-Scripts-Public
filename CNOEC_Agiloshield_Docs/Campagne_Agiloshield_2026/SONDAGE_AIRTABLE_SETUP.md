# Sondage Agiloshield 2026 — Configuration Airtable + Make

Table : **[Sondage_Agiloshield_2026](https://airtable.com/appXRsk0Ra4iVVgu2/tblKcJaAmy9RZPMU3/viw3wsneqDTiDuxH6?blocks=hide)**  
Base : `[CMS_Agilotext]` (`appXRsk0Ra4iVVgu2`)  
ID table : `tblKcJaAmy9RZPMU3`

---

## 1. Schéma des champs (à configurer dans l’UI Airtable)

L’API ne permet pas de créer des colonnes automatiquement. Vérifie que ta table contient **exactement** ces champs :

| Champ | Type Airtable | Obligatoire | Description |
|-------|---------------|-------------|-------------|
| `Fonctionnalites` | **Multiple select** | Oui | Les choix cochés par l’utilisateur (voir options ci-dessous) |
| `Email` | Email | Non | Email facultatif du répondant |
| `Date_reponse` | Date | Non | Date de soumission (format ISO `YYYY-MM-DD` depuis Make) |
| `Source` | URL (ou Texte sur une ligne) | Non | URL de la page Webflow |
| `Autre_precision` | Texte long | Non | Précision si « Autre » est coché |
| `Notes` | Texte long | Non | Usage interne (optionnel, laisser vide) |

**Supprimer** le champ `Assignee` s’il est encore présent (héritage template).

### Options du Multiple select `Fonctionnalites`

Copier-coller ces libellés **à l’identique** (le formulaire envoie ces chaînes exactes) :

1. `Logiciel installé sur mon ordinateur`
2. `Intégration Claude / ChatGPT`
3. `Traitement en lot de dossiers entiers`
4. `Plugin Word / Excel`
5. `Rapport de conformité RGPD`
6. `API / automatisation`
7. `Autre`

**Transformation depuis l’existant :** si `Fonctionnalites` est encore en « Texte sur une ligne », modifier le type en « Sélection multiple » et ajouter les 7 options ci-dessus.

---

## 2. Vue analytics (recommandée)

Dans Airtable, dupliquer la grille et :

- **Grouper par** : `Fonctionnalites`
- **Trier par** : `Date_reponse` (décroissant)
- **Masquer** : `Notes`, `Assignee` (si conservé)

Pour un décompte rapide : extension « Chart » ou export CSV + tableau croisé.

---

## 3. Scénario Make.com (~10 min)

```mermaid
flowchart LR
  WH[Webhook Custom]
  AT[Airtable Create Record]
  WH --> AT
```

### Module 1 — Webhooks → Custom webhook

- Créer le webhook, copier l’URL (ex. `https://hook.eu2.make.com/xxxxx`)
- Coller cette URL dans `WEBHOOK_URL` du fichier [`sondage-fonctionnalites-embed.html`](sondage-fonctionnalites-embed.html)

### Module 2 — Airtable → Create a record

| Paramètre | Valeur |
|-----------|--------|
| Connection | Compte Airtable Agilotext |
| Base | `[CMS_Agilotext]` |
| Table | `Sondage_Agiloshield_2026` |

### Mapping des champs

| Champ Airtable | Valeur Make (depuis le webhook) |
|----------------|----------------------------------|
| `Fonctionnalites` | `{{choices}}` — tableau / liste (multiple select) |
| `Email` | `{{email}}` |
| `Date_reponse` | `{{date}}` |
| `Source` | `{{source}}` |
| `Autre_precision` | `{{autre}}` |

**Important :** le corps du webhook est du JSON. Dans Make, active « JSON » comme type de données entrantes si proposé.

### Payload envoyé par le formulaire

```json
{
  "choices": [
    "Logiciel installé sur mon ordinateur",
    "Intégration Claude / ChatGPT"
  ],
  "email": "client@exemple.fr",
  "date": "2026-05-27",
  "source": "https://www.agilotext.com/agiloshield/sondage",
  "autre": ""
}
```

Si « Autre » est coché avec du texte, `autre` contient la précision ; `choices` inclut aussi la valeur `Autre`.

---

## 4. Test de bout en bout

1. Compléter le schéma Airtable (section 1).
2. Activer le scénario Make et coller l’URL dans l’embed Webflow.
3. Publier la page Webflow.
4. Soumettre un vote test (2–3 cases + email).
5. Vérifier une nouvelle ligne dans [la grille](https://airtable.com/appXRsk0Ra4iVVgu2/tblKcJaAmy9RZPMU3/viw3wsneqDTiDuxH6?blocks=hide).

### Test manuel API (optionnel)

Une fois les champs `Email`, `Date_reponse`, etc. créés, enregistrement de test :

```json
{
  "Fonctionnalites": ["Logiciel installé sur mon ordinateur", "API / automatisation"],
  "Email": "test@agilotext.com",
  "Date_reponse": "2026-05-27",
  "Source": "https://www.agilotext.com/test",
  "Autre_precision": ""
}
```

---

## 5. Intégration Webflow

1. Page dédiée (ex. `/agiloshield/sondage`) avec header/footer Webflow habituels.
2. Section → Container → **Custom Code** : coller tout le contenu de `sondage-fonctionnalites-embed.html`.
3. SEO suggéré :
   - **Title :** `Sondage Agiloshield – Priorisez nos prochaines fonctionnalités | Agilotext`
   - **Description :** `En 30 secondes, indiquez ce qui vous manque le plus : logiciel local, intégration IA, lots, Office, API…`

---

## 6. Lien campagne email

Dans les templates `SEGMENT_A`, `SEGMENT_B`, `SEGMENT_C`, ajouter un CTA vers la page sondage une fois publiée.
