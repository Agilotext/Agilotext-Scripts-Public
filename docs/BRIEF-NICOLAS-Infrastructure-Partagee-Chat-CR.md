# Brief Nicolas — Infrastructure partagée Chat + CR
**Avril 2026 — Document de synthèse**  
*Une pierre, deux coups : ce que Nico construit une seule fois sert à la fois au Chat et aux Comptes-rendus*

---

## Le constat clé

En analysant le Plan Maestro V6 et les besoins du Chat V06, **5 briques sont identiques**.  
Nico ne doit les coder **qu'une seule fois** — elles servent aux deux.

```
                  ┌─────────────────────────────────────┐
                  │    INFRASTRUCTURE PARTAGÉE           │
                  │                                       │
                  │  1. DocumentTextExtractor             │
                  │  2. Upload + stockage fichier/job     │
                  │  3. preAnalyzeContextDocument         │
                  │  4. getJobContext / setJobContext      │
                  │  5. Mistral OCR (phase 2)             │
                  └──────────────┬──────────────────────┘
                                 │
              ┌──────────────────┴──────────────────────┐
              │                                         │
   ┌──────────▼──────────┐               ┌─────────────▼──────────────┐
   │    CHAT (reprompt)  │               │  COMPTE-RENDU (summary)    │
   │                     │               │                             │
   │  PJ dans le chat    │               │  Document ODJ, convocation  │
   │  → PDF d'un contrat │               │  → Bloc 3 contexte factuel  │
   │  → Brief envoyé     │               │  → Word Boost éphémère      │
   │  → Fichier Word     │               │  → Participants détectés    │
   │                     │               │                             │
   │  + llm_context_id   │               │  + TokenBudgetRouter        │
   │  (chat uniquement)  │               │  (CR uniquement)            │
   └─────────────────────┘               └─────────────────────────────┘
```

---

## Ce que Nico construit UNE SEULE FOIS

### Brique 1 — `DocumentTextExtractor` (service Java)

**Ce que c'est :** un service qui prend un fichier (PDF, DOCX, TXT, RTF) et retourne du texte.

**Utilisé par :**
- `GptNewSummaryMaker` → injection en Bloc 3 du prompt CR
- `FutureTranscriptReprompt` → injection dans le promptContent du chat reprompt

**Implémentation :**
```java
// DocumentTextExtractor.java — service partagé
public class DocumentTextExtractor {

    public static String extract(File file) throws IOException {
        String name = file.getName().toLowerCase();
        if (name.endsWith(".pdf"))  return extractPdf(file);
        if (name.endsWith(".docx")) return extractDocx(file);
        if (name.endsWith(".doc"))  return extractDoc(file);
        if (name.endsWith(".txt") || name.endsWith(".rtf")) return FileUtils.readFileToString(file, "UTF-8");
        throw new UnsupportedOperationException("Format non supporté : " + name);
    }

    private static String extractPdf(File f) throws IOException {
        try (PDDocument doc = PDDocument.load(f)) {
            return new PDFTextStripper().getText(doc); // Apache PDFBox
        }
    }

    private static String extractDocx(File f) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new FileInputStream(f))) {
            return new XWPFWordExtractor(doc).getText(); // Apache POI
        }
    }
}
```

**Dépendances Maven (une seule fois dans le POM) :**
```xml
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.3</version>
</dependency>
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.3.0</version>
</dependency>
```

---

### Brique 2 — Upload + stockage fichier par job

**Ce que c'est :** un fichier est uploadé et stocké sur le serveur avec une référence `jobId` (ou un `contextId` temporaire).

**Utilisé par :**
- Maestro V6 : `addJobContextAttachment` (ODJ avant ou pendant l'enregistrement)
- Chat V06 : `uploadChatAttachment` (PJ dans la conversation)

**C'est la même table, les mêmes règles de stockage.** Seul le flux d'appel diffère (pré-upload vs per-message).

**Structure BDD commune :**
```sql
CREATE TABLE job_context_attachment (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(120) NOT NULL,
    job_id          BIGINT,              -- null si pré-analyse (contextId seul)
    context_id      VARCHAR(80),         -- clé temporaire pré-analyse (TTL 2h)
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT,
    attachment_type VARCHAR(40),         -- 'context_doc' | 'chat_pj'
    extracted_text  TEXT,               -- résultat DocumentTextExtractor
    analysis_json   TEXT,               -- résultat preAnalyze (si fait)
    dt_upload       TIMESTAMP DEFAULT NOW(),
    dt_expires      TIMESTAMP           -- null = permanent, sinon TTL
);
```

---

### Brique 3 — `preAnalyzeContextDocument` (endpoint Java)

**Ce que c'est :** un endpoint qui prend un fichier, extrait le texte (Brique 1), fait un appel LLM léger pour identifier participants/dates/termes, retourne un JSON structuré + un `contextId`.

**Utilisé par :**
- Maestro V6 : avant l'enregistrement live → Word Boost éphémère prêt, aucune latence ajoutée
- Chat V06 : avant ou pendant la conversation → le chat peut mentionner "j'ai analysé votre document, j'ai détecté X participants"

**Endpoint unique :**
```
POST /api/v1/preAnalyzeContextDocument
  username, token, edition (requis)
  contextFile (file, requis)
  jobId (string, optionnel — à renseigner si on associe directement)

Réponse :
{
  "status": "OK",
  "contextId": "ctx_abc123",      ← clé TTL 2h, à passer dans le prochain appel
  "jobId": "456789",              ← si fourni, association directe
  "analysis": {
    "date_reunion": "2026-04-12",
    "participants": [{"prenom": "Jean", "nom": "Dupont", "role": "DG", "confiance": 0.95}],
    "sujets": ["Bilan Q1", "Recrutement"],
    "acronymes": {"CODIR": "Comité de Direction"},
    "termes_techniques": ["EBITDA", "NPS"],
    "wordBoostPreview": ["Jean Dupont", "CODIR", "EBITDA"]
  }
}
```

> **Note Florian :** côté Webflow, on peut afficher le résultat `analysis` dans une preview avant envoi ("5 participants détectés, voulez-vous les confirmer ?"). Ça marche pour le dashboard upload ET pour le chat.

---

### Brique 4 — `setJobContext` / `getJobContext` (endpoints Java)

**Ce que c'est :** stocker et lire le contexte factuel associé à un job (résultat de l'analyse + éventuels ajustements utilisateur).

**Utilisé par :**
- Maestro V6 : `GptNewSummaryMaker` lit ce contexte pour construire le Bloc 3 du prompt CR
- Chat V06 : `FutureTranscriptReprompt` peut enrichir le prompt du chat avec le même contexte

**Même jobId, même table, deux consommateurs différents.** Nico écrit les endpoints une seule fois.

```
GET  /api/v1/getJobContext?jobId=XXX&username=YYY&token=ZZZ
POST /api/v1/setJobContext
     { jobId, contextId, meetingDate, validatedHintsJson, wordBoostOverrideJson }
```

---

### Brique 5 — Mistral OCR (phase 2, optionnel)

**Ce que c'est :** un service `MistralOcrClient.java` qui fait upload → OCR → texte markdown.

**Utilisé par :**
- CR : extraction de haute qualité pour les ODJ scannés (tableaux, colonnes)
- Chat : réponse à "que dit ce document ?" avec rendu fidèle (tableaux inclus)

Peut remplacer PDFBox pour les PDFs non-textuels, ou compléter (PDFBox d'abord, si pas de texte → fallback Mistral OCR).

---

## Ce qui est SPÉCIFIQUE au Chat (côté Java, léger)

### `uploadChatAttachment` (endpoint)

Très similaire à `addJobContextAttachment`, mais déclenché dans le flux chat (pendant une conversation, pas avant un enregistrement). Peut réutiliser la même table `job_context_attachment` avec `attachment_type = 'chat_pj'`.

```
POST /api/v1/uploadChatAttachment
  username, token, edition, jobId (requis)
  files[] (multipart, max 3 fichiers, 10 Mo chacun)

Réponse :
{
  "status": "OK",
  "attachmentIds": "ctx_def456,ctx_ghi789"
}
```

Côté chat reprompt (`FutureTranscriptReprompt`), si `attachmentIds` est fourni :
1. Charger les fichiers depuis la table
2. Appeler `DocumentTextExtractor` (Brique 1) si le texte n'est pas déjà en cache
3. Injecter dans le `promptContent` avant l'appel LLM

**Coût : 1 endpoint + 10 lignes dans `FutureTranscriptReprompt`.**

---

### `llm_context_id` (colonne BDD, long terme)

Pour le suivi de contexte conversation sans renvoyer tout l'historique (OpenAI Responses API).  
**C'est une seule colonne dans `job_reprompt`**, pas un refactor complet.

```sql
ALTER TABLE job_reprompt ADD COLUMN llm_context_id VARCHAR(128);
-- Stocke le previous_response_id OpenAI entre deux tours de chat
-- null = mode actuel (stateless), non null = mode Responses API
```

À faire après les Briques 1-4 — ce n'est pas urgent.

---

## Ce qui est SPÉCIFIQUE au CR (côté Java)

### `TokenBudgetRouter`

Le routeur qui décide du chemin A (court) / B (chunked) / C (agentic) selon la taille du transcript.  
**N'a rien à voir avec le chat** — le chat est toujours court (questions libres), les CRs peuvent faire 3h.

### Word Boost éphémère depuis document

La fusion du boost permanent + termes du document + déduplication + plafond par offre.  
Alimenté par l'analyse de `preAnalyzeContextDocument` (Brique 3), mais la logique de merge et d'envoi à Speechmatics est spécifique aux CRs.

---

## Tableau récapitulatif — Ce que Nico fait et ce que ça débloque

| Brique | Complexité | Sert le Chat | Sert le CR | Quand |
|--------|-----------|:---:|:---:|-------|
| **DocumentTextExtractor** (PDFBox + POI) | 🟢 Faible | ✅ PJ dans reprompt | ✅ Bloc 3 contexte | **Maintenant** |
| **`uploadChatAttachment`** endpoint | 🟢 Faible | ✅ Upload PJ chat | — | **Maintenant** |
| **`preAnalyzeContextDocument`** endpoint | 🟡 Moyenne | ✅ Preview analyse | ✅ Word Boost éphémère | Sprint 1 |
| **`setJobContext` / `getJobContext`** | 🟢 Faible | ✅ Contexte dans reprompt | ✅ Bloc 3 dans CR | Sprint 1 |
| **`addJobContextAttachment`** endpoint | 🟢 Faible | ✅ (même table) | ✅ Upload ODJ | Sprint 1 |
| **Mistral OCR** (`MistralOcrClient`) | 🟡 Moyenne | ✅ PDFs scannés | ✅ ODJ scannés | Sprint 2 |
| **`TokenBudgetRouter`** (chemin A/B/C) | 🔴 Élevée | — | ✅ Transcripts longs | Sprint 2 |
| **`llm_context_id`** (Responses API) | 🟡 Moyenne | ✅ Chaîner les tours | — | Sprint 3 |

**Résumé** : les 5 premières briques (sprint 1) sont **simples et débloquent les deux produits en même temps**. Le reste suit naturellement.

---

## Ce que ça donne côté Webflow / JS (pour Florian)

Une fois les briques Java posées, côté front on ajoute :

**Dashboard (upload CR) :**
- Bouton "Joindre un ordre du jour" → `preAnalyzeContextDocument` → affiche preview
- Si preview ok → `contextId` envoyé avec `sendMultipleAudio`

**Éditeur / Chat :**
- Bouton trombone (déjà fait en V06 JS) → `uploadChatAttachment` → `attachmentIds` dans reprompt
- Optionnel : afficher la preview de l'analyse (noms détectés) dans le chat

**Les deux partagent :**
- Le même composant de preview "X participants détectés"
- La même logique de chips de fichiers (déjà fait en V06)

---

## Ordre des sprints suggéré

### Sprint 1 (2-3 jours Nico) — Débloque Chat + CR immédiatement
1. `DocumentTextExtractor` + tests (PDFBox + POI)
2. Table `job_context_attachment` (SQL)
3. `uploadChatAttachment` endpoint (reprompt chat)
4. `setJobContext` / `getJobContext` endpoints
5. Injection dans `FutureTranscriptReprompt` (chat) et `GptNewSummaryMaker` (CR)

→ **Résultat** : le chat peut recevoir des PDFs, les CRs ont un Bloc 3 factuel

### Sprint 2 (3-4 jours Nico) — Qualité + cas avancés
1. `preAnalyzeContextDocument` endpoint (LLM léger, JSON structuré)
2. `addJobContextAttachment` (pour le dashboard upload)
3. `TokenBudgetRouter` chemin A/B (transcripts longs)
4. Word Boost éphémère depuis document

→ **Résultat** : fin de l'incident CH Dax, Word Boost enrichi automatiquement

### Sprint 3 (1-2 jours Nico) — Contexte chat long terme
1. `MistralOcrClient` (Phase 2 OCR)
2. `llm_context_id` + Responses API OpenAI

→ **Résultat** : chat avec mémoire serveur, PDFs scannés supportés

---

## Ce qu'il NE faut PAS faire
- ❌ **Threads OpenAI** → dépréciés depuis 2025
- ❌ **Architecture séparée** pour chat et CR → même infrastructure, deux consommateurs
- ❌ **Extraction PDF côté JS** → trop lourd, sécurité, limites navigateur
- ❌ **Tout faire en même temps** → les briques sont indépendantes, commencer par Sprint 1

---

*Document généré le 23 avril 2026 — synthèse Plan Maestro V6 + Plan LLM API Chat + analyse code existant*
