# Inventaire des fichiers liés au PDF transcription stylé

Racine du dépôt : `Agilotext-Scripts-Public`.  
Préfixe API : `CNOEC_Agiloshield_Docs/AgiloTextApi-github-2.0.5/`

## Documentation

- `docs/transcript-styled-export-v2.md` — spec + commandes `mvn` / `java`

## Java — export

- `src/main/java/com/sqlephant/tools/export/TranscriptStyledPdfExporter.java`
- `src/main/java/com/sqlephant/tools/export/TranscriptStyledHtmlBuilder.java`
- `src/main/java/com/sqlephant/tools/export/TranscriptExportContext.java`

## Test manuel (génère `styled-transcript-preview.html` / `.pdf`)

- `src/test/java/com/sqlephant/tools/export/TranscriptStyledPdfExporterManual.java`

## Template HTML / CSS

- `src/main/resources/template/transcript_export_styled.html`

## Intégration servlet / services

- `src/main/java/com/sqlephant/ws/servlet/base/ApiDownloadUtil.java`
- `src/main/java/com/sqlephant/ws/servlet/service/email/EmailNotifyTranscriptOver.java`
- `src/main/java/com/sqlephant/ws/servlet/auto/webhook/WebhookUtil.java`
- `src/main/java/com/sqlephant/ws/servlet/api/ApiGetSharerUrlClick2.java`

## Utilitaires (mentionnés dans le flux)

- `com.sqlephant.util.HtmlUtilNew` — `completeOpenCloseTags`
- `com.sqlephant.tools.aspose.AsposeConverter` — `convertText`, fallbacks TXT

## Dossier `mk/` à la racine du repo

Ne contient **pas** de doc spécifique à ce PDF (plutôt embeds Webflow / auth). **Ne pas confondre** avec ce sujet.

## Patchs nommés `PATCH_*_PDF_*` (hors workspace)

Des noms du type `PATCH_1.9.229_AGILOTEXTAPI_PDF_HARDENING.patch` ont pu exister sur une machine ; ils ne sont **pas** présents dans l’arbre actuel de ce clone. À chercher dans l’historique **git du repo AgiloTextApi** ou sauvegardes locales.
