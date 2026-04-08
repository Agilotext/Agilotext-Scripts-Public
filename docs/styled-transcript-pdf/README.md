# PDF transcription « styled » (`styled-transcript-preview.pdf`)

Synthèse pour répondre à Nicolas (« comment c’est généré ? ») et retrouver les sources dans ce dépôt.

## Ce qu’est le fichier `styled-transcript-preview.pdf`

C’est le **nom de sortie par défaut** du **test manuel** Java qui reproduit **le même pipeline** que l’API pour les exports transcription **PDF / DOCX / DOC / RTF** « stylés » (HTML + charte + Aspose Words).

- **Classe** : `com.sqlephant.tools.export.TranscriptStyledPdfExporterManual` (module `agilotext-api`, scope **test**).
- **Sorties** (répertoire `target/` du module Maven) :
  - `styled-transcript-preview.html` — toujours écrit ;
  - `styled-transcript-preview.pdf` — si la licence **Aspose.Words** est présente et si la conversion + logos CDN passent.

Donc : le PDF dans **Téléchargements** est très probablement une **copie** de `target/styled-transcript-preview.pdf` après un run local (ou équivalent), **pas** un format magique séparé du backend.

## Chaîne technique (résumé)

1. **Entrée** : fichier `.txt` au format transcription Agilotext (locuteur, ligne temps `HH:MM:SS --> …`, lignes de texte).
2. **HTML** : `TranscriptStyledHtmlBuilder.buildFullHtml` charge le template  
   `src/main/resources/template/transcript_export_styled.html`, injecte titre, date, client, URLs logo, et le corps avec **couleurs stables par intervenant** (épinglage de noms + palette).
3. **Balises** : `HtmlUtilNew.completeOpenCloseTags(html)` avant conversion.
4. **Fichier binaire** : `AsposeConverter.convertText(html, outFile, SaveFormat.PDF)` (idem DOCX/DOC/RTF).
5. **Repli** : si une étape échoue, `exportTranscriptTxtToAsposeFormatWithFallback` repasse sur l’ancien flux **TXT brut → Aspose** (PDF « plat »).

## Où c’est branché en prod (même code)

Dans le snapshot `AgiloTextApi-github-2.0.5` :

- `ApiDownloadUtil` — téléchargements `format=pdf|docx|doc|rtf`
- `EmailNotifyTranscriptOver` — pièces jointes transcription
- `WebhookUtil` — automation PDF
- `ApiGetSharerUrlClick2` — ZIP / partage

Tous appellent `TranscriptStyledPdfExporter.exportTranscriptTxtToAsposeFormatWithFallback` (ou variante PDF).

## Prérequis pour régénérer le PDF en local

- Module **AgiloTextApi** (`agilotext-api`), Java + Maven.
- Fichier **`Aspose.Words.lic`** à l’emplacement attendu par `AsposeConverter` (souvent **répertoire de travail courant** au lancement, comme indiqué dans la doc v2).
- **Réseau** : le template référence des logos en **HTTPS** (Webflow CDN) ; sans accès, la conversion peut échouer ou dégrader le rendu.

## Documentation détaillée dans ce dépôt

| Fichier | Rôle |
|--------|------|
| `CNOEC_Agiloshield_Docs/AgiloTextApi-github-2.0.5/docs/transcript-styled-export-v2.md` | Spec flux v2, commandes de test, intégration API |
| `…/TranscriptStyledPdfExporter.java` | Orchestration HTML → Aspose + fallback |
| `…/TranscriptStyledHtmlBuilder.java` | Parse `.txt` + couleurs + remplissage template |
| `…/TranscriptExportContext.java` | Métadonnées, URLs logo par défaut |
| `…/template/transcript_export_styled.html` | CSS print, `@page`, pied de page, charte |
| `…/src/test/.../TranscriptStyledPdfExporterManual.java` | **Génère** `styled-transcript-preview.*` |

**Note** : `AgiloTextApi-github-2.0.5` est un **export / snapshot** dans ce repo ; le dépôt canonique est en général **AgiloTextApi** chez Kawansoft / équipe.

## E-mails (florian.bauer@agilotext.com → Nicolas)

Les **messages Gmail ne sont pas versionnés** dans ce dépôt. Pour retrouver le fil exact : recherche boîte Agilotext du type  
`styled-transcript` / `TranscriptStyled` / `Aspose` / `PDF transcription` / destinataire Nicolas.

## Fichiers connexes ailleurs dans le repo

- `CNOEC_Agiloshield_Docs/.../doc/DEPLOIEMENT_8.0.18_NICOLAS.md` — concerne surtout **anonymisation contextual** (PDF/tables côté anon), **pas** le rendu visuel « styled » transcription.

Voir aussi **`INVENTAIRE_FICHIERS.md`** dans ce dossier pour la liste des chemins.
