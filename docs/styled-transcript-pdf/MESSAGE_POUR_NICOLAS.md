# Texte type — réponse à « comment tu as généré styled-transcript-preview.pdf ? »

Tu peux copier-coller et adapter.

---

Bonjour Nicolas,

Le fichier **`styled-transcript-preview.pdf`** vient du **run local** de la classe de test **`TranscriptStyledPdfExporterManual`** (module `agilotext-api`, sous `src/test/java/...`). Elle écrit par défaut dans **`target/styled-transcript-preview.html`** et **`target/styled-transcript-preview.pdf`**.

C’est **le même pipeline** que les exports API transcription en PDF/DOCX/DOC/RTF « v2 » :

1. lecture du **`.txt`** transcription ;
2. **`TranscriptStyledHtmlBuilder`** + template **`transcript_export_styled.html`** (charte, marges `@page`, logos CDN, couleurs par locuteur) ;
3. **`HtmlUtilNew.completeOpenCloseTags`** ;
4. **`AsposeConverter.convertText(..., PDF)`** ;
5. en cas d’échec : **fallback** sur l’ancien flux TXT brut → Aspose (`exportTranscriptTxtToAsposeFormatWithFallback`).

La doc dans le repo est **`docs/transcript-styled-export-v2.md`**. Les points d’entrée prod sont notamment **`ApiDownloadUtil`**, **`EmailNotifyTranscriptOver`**, **`WebhookUtil`**, **`ApiGetSharerUrlClick2`**.

Prérequis du PDF : **`Aspose.Words.lic`** au bon endroit + accès réseau pour les logos dans le HTML.

Si tu veux, on synchronise sur le **commit / branche** exacte du snapshot que Florian a utilisé pour l’export.

Cordialement,  
Florian

---

## Version ultra courte

> C’est la sortie du test **`TranscriptStyledPdfExporterManual`** → même chaîne que l’API : HTML (`TranscriptStyledHtmlBuilder` + `transcript_export_styled.html`) puis **Aspose Words** en PDF. Fichiers : `target/styled-transcript-preview.pdf` ; doc `docs/transcript-styled-export-v2.md`.
