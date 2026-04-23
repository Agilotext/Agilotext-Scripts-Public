# Plan d'évolution API LLM — Chat Agilotext  
**Pour Nicolas — Avril 2026**  
Document de référence : contexte conversation + pièces jointes (PDF, Word, images)

---

## 1. Situation actuelle : ce que fait le backend aujourd'hui

### Architecture actuelle (`FutureTranscriptReprompt.java`)

```
Front JS (buildPrompt)                   AgiloTextApi Java
─────────────────────                    ───────────────────────────────────────
promptContent = system                → GptBaseNewChunkOneExecutor(
  + turns (N derniers échanges texte)      motorSession,
  + question courante                      promptContent,   ← le gros blob
                                           text             ← transcript disque
                                         )
                                           → génère 1 réponse
                                           → écrit {jobId}_reprompt.txt
                                         ← poll → receiveRepromptText
```

**Ce qui fonctionne bien :**
- Simple, robuste, stateless (pas de dépendance à un état serveur tiers)
- Un seul fichier résultat par job, toujours overwritable
- Pas de coût de state management côté fournisseur

**Ce qui manque :**
- L'historique est tronqué (8 tours max, `MAX_HISTORY_TURNS`) et renvoyé en **texte brut** — si la conversation est longue ou avec des documents, on perd du contexte
- Aucun support fichier natif : les pièces jointes sont juste mentionnées par nom dans le prompt
- Si on évolue vers des modèles de raisonnement récents (GPT-5.x, o-series), on perd les fonctionnalités avancées

---

## 2. Ce qui a changé chez les fournisseurs (état avril 2026)

### 2.1 OpenAI

| API | Statut | Ce qu'elle fait |
|-----|--------|-----------------|
| **Chat Completions** (`/v1/chat/completions`) | ✅ GA, supportée | Stateless — tu envoies tous les messages à chaque appel |
| **Responses API** (`/v1/responses`) | ✅ GA — **recommandée pour les nouveaux projets** | Stateful via `previous_response_id` ou `Conversations API` |
| **Assistants API + Threads** | ⚠️ **Deprecated** | À éviter — OpenAI converge vers Responses API |

#### ❌ Ce que Nico ne doit PAS faire
Les Threads (`POST /threads`, `POST /threads/runs`) sont **officiellement dépréciés depuis début 2025**.  
Implémenter cette API aujourd'hui serait du travail pour une API en fin de vie.

#### ✅ Ce que Nico peut faire aujourd'hui

**Option A — Rester sur Chat Completions (évolution minimale)**  
Continuer à envoyer l'historique manuellement mais **au format natif** (tableau `messages[]`) au lieu d'un blob texte. Le backend Java envoie l'historique sérialisé + transcript + système.  
→ Coût : faible (refacto du builder de prompt côté Java)  
→ Gain : meilleur format, less token waste, possible compression

**Option B — Migrer vers Responses API (recommandée pour le long terme)**  
Stocker le `previous_response_id` retourné par OpenAI. Au tour suivant, envoyer **uniquement le nouveau message utilisateur** + l'ID. OpenAI gère le contexte côté serveur (30 jours de rétention par défaut).

```java
// Appel Java vers OpenAI Responses API — pseudo-code
POST https://api.openai.com/v1/responses
{
  "model": "gpt-4o",
  "input": "Nouvelle question de l'utilisateur",
  "previous_response_id": "resp_abc123",   // ← retourné à l'appel précédent
  "instructions": "Rôle système...",
  "store": true
}
// Réponse → extraire response.id → sauvegarder en BDD pour le prochain tour
```

```sql
-- Nouvelle colonne à ajouter en BDD
ALTER TABLE job_reprompt ADD COLUMN openai_response_id VARCHAR(80);
```

**Option C — Compaction de contexte (pour les très longues conversations)**  
OpenAI Responses API propose un endpoint `/v1/responses/compact` : quand le contexte est trop long, il compresse les tours anciens en gardant l'essentiel. Utile pour les transcripts très longs.

---

### 2.2 Mistral

| Capacité | Endpoint | Disponibilité |
|----------|----------|---------------|
| Chat standard (messages[]) | `POST /v1/chat/completions` | ✅ GA |
| Upload de fichier | `POST /v1/files` (purpose: `ocr`) | ✅ GA |
| OCR PDF/DOCX/PPTX | `POST /v1/ocr` model `mistral-ocr-latest` | ✅ GA |
| Document QnA (PDF natif dans message) | `content.type: "document_url"` | ✅ GA |
| Images dans message | `content.type: "image_url"` | ✅ GA (Pixtral) |

Mistral **n'a pas de Responses API équivalente** : chaque appel est stateless, l'historique est géré manuellement (comme Chat Completions OpenAI).

---

## 3. Plan pour les pièces jointes (PDF, Word, images)

### 3.1 Comparaison des approches

| Approche | Complexité Java | Coût API | Qualité | Recommandation |
|----------|----------------|----------|---------|----------------|
| **Extraction texte côté serveur** (pdfplumber/PDFBox) puis injection dans prompt | Faible | Pas de surcoût | Bonne pour les textes | ✅ **Recommandée à court terme** |
| **Mistral OCR** : upload → `/v1/ocr` → texte markdown → injection | Moyenne | ~0.001€/page | Excellente (tableaux, structure) | ✅ **Recommandée pour PDFs structurés** |
| **OpenAI Responses API + file_search** | Élevée | Surcoût vector store | Très bonne (RAG intégré) | 🔜 À planifier si volume |
| **Mistral Document QnA natif** : passer `document_url` dans le message | Faible | Inclus dans token count | Très bonne | ✅ **Recommandée si Mistral principal** |

### 3.2 Workflow recommandé (à implémenter, par ordre de priorité)

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1 — PDF/DOCX : Extraction + injection texte (rapide, sans IA) │
└─────────────────────────────────────────────────────────────────────┘

Fichier uploadé par l'utilisateur
   │
   ▼ (côté serveur Java — dépendance Apache PDFBox ou iText déjà présent ?)
extractText(file) → String textContent
   │
   ▼
Injecter dans promptContent :
  "[Document joint : fichier.pdf]\n{textContent}\n\n[Fin du document]\n\nQuestion : ..."
   │
   ▼
rePromptTranscript (appel existant, aucun changement d'API)

Limites : pas de tableaux, pas d'images dans les PDFs scannés


┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 2 — OCR Mistral : pour PDFs scannés ou structurés (tableaux)   │
└──────────────────────────────────────────────────────────────────────┘

PDF uploadé
   │
   ▼ POST https://api.mistral.ai/v1/files (purpose: "ocr")
file_id = response.id
   │
   ▼ POST https://api.mistral.ai/v1/ocr
    { model: "mistral-ocr-latest", document: { file_id: file_id }, table_format: "html" }
textMarkdown = response.pages[].markdown
   │
   ▼
Injection dans promptContent (idem Phase 1 mais avec markdown structuré)


┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 3 — Natif Mistral Document QnA (si Mistral est le moteur chat) │
└──────────────────────────────────────────────────────────────────────┘

POST https://api.mistral.ai/v1/chat/completions
{
  "model": "mistral-large-latest",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Analyse ce document et réponds à : ..." },
        { "type": "document_url", "document_url": "https://..." }  // URL signée du fichier
      ]
    }
  ]
}

→ Mistral fait lui-même l'OCR + la réponse en un seul appel.
Condition : URL publique ou URL signée Mistral (via /v1/files/{id}/url).
```

### 3.3 Ce qu'il faut côté Java

**Phase 1 (recommandée immédiatement) :**

```java
// Dans FutureTranscriptReprompt.executeReprompt()
// Ajouter avant la construction du prompt :

String attachmentText = "";
if (attachmentFile != null && attachmentFile.exists()) {
    if (attachmentFile.getName().endsWith(".pdf")) {
        attachmentText = PdfTextExtractor.extract(attachmentFile); // Apache PDFBox
    } else if (attachmentFile.getName().endsWith(".docx")) {
        attachmentText = DocxTextExtractor.extract(attachmentFile); // Apache POI
    }
}
String enrichedPrompt = attachmentText.isEmpty()
    ? promptContent
    : "[Document joint]\n" + attachmentText + "\n[Fin]\n\n" + promptContent;

GptBaseNewExecutor executor = new GptBaseNewChunkOneExecutor(
    motorSession, enrichedPrompt, text
);
```

**Dépendances Maven à ajouter :**
```xml
<!-- Apache PDFBox (PDF → texte) -->
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.3</version>
</dependency>

<!-- Apache POI (DOCX → texte) -->
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.3.0</version>
</dependency>
```

**Phase 2 — Appel Mistral OCR (Java HttpClient simple) :**

```java
// 1) Upload le fichier
MultipartBody uploadBody = MultipartBody.Builder()
    .addFormDataPart("purpose", "ocr")
    .addFormDataPart("file", file.getName(), RequestBody.create(file, MEDIA_PDF))
    .build();
Request uploadReq = new Request.Builder()
    .url("https://api.mistral.ai/v1/files")
    .header("Authorization", "Bearer " + mistralApiKey)
    .post(uploadBody).build();
String fileId = parseJsonField(client.newCall(uploadReq).execute(), "id");

// 2) OCR
String ocrBody = """
    {"model":"mistral-ocr-latest","document":{"file_id":"%s"},"table_format":"html"}
    """.formatted(fileId);
Request ocrReq = new Request.Builder()
    .url("https://api.mistral.ai/v1/ocr")
    .header("Authorization", "Bearer " + mistralApiKey)
    .header("Content-Type", "application/json")
    .post(RequestBody.create(ocrBody, JSON)).build();
String markdownText = extractOcrMarkdown(client.newCall(ocrReq).execute());

// 3) Injecter dans promptContent puis appel LLM habituel
```

---

## 4. Plan pour le suivi de contexte conversation

### 4.1 Ce qu'il faut faire maintenant (sans changer d'API)

Le vrai problème n'est pas l'API — c'est que le front tronque à 8 tours et les sérialise en texte brut. Il suffit de :

1. **Augmenter la fenêtre** si le transcript est court (le transcript prend déjà beaucoup de tokens)
2. **Passer le format natif `messages[]`** à `GptBaseNewChunkOneExecutor` plutôt qu'un blob texte — vérifier si la lib ChatMotor supporte cela

### 4.2 Si on migre vers OpenAI Responses API (moyen terme)

**Ce qui change en Java :**

```java
// Actuellement : un seul executor "stateless"
GptBaseNewChunkOneExecutor(motorSession, promptContent, text)

// Avec Responses API : stocker et passer previous_response_id
public class FutureTranscriptRepromptV2 {
    
    public String executeWithContext(String previousResponseId) {
        // Construction de la requête vers /v1/responses
        String requestBody = buildResponsesRequest(
            promptContent,
            previousResponseId, // null si premier tour
            systemInstructions,
            transcriptText
        );
        // POST /v1/responses → extraire response.output_text + response.id
        String[] result = callOpenAIResponses(requestBody);
        String answer = result[0];
        String newResponseId = result[1];
        
        // Sauvegarder newResponseId dans job_reprompt pour le prochain tour
        saveResponseId(jobId, newResponseId);
        return answer;
    }
}
```

**Schéma BDD à ajouter :**
```sql
-- Table job_reprompt : ajouter la colonne
ALTER TABLE job_reprompt ADD COLUMN llm_context_id VARCHAR(128);
-- llm_context_id = previous_response_id (OpenAI) ou null (Mistral stateless)
-- Permet de chaîner les tours sans renvoyer tout l'historique
```

**Endpoint Java à modifier :**
- `ApiRePromptTranscript.java` : recevoir `contextId` en paramètre optionnel
- `ApiGetRePromptStatus.java` : renvoyer `contextId` dans la réponse pour que le front puisse le stocker

**Côté JS (Code-chat_V05.js) :**
```js
// Stocker le contextId retourné par l'API
// Dans rePromptSubmit : envoyer contextId si disponible
// Dans rePromptReceive : récupérer et sauvegarder le nouveau contextId
```

---

## 5. Récapitulatif — Ce qu'il faut faire, dans quel ordre

| # | Action | Complexité | Priorité | Qui |
|---|--------|-----------|----------|-----|
| 1 | **Phase 1 PJ** : Extraction PDFBox/POI côté Java + injection dans prompt | Faible | 🔴 Court terme | Nico |
| 2 | **Phase 2 PJ** : Intégration Mistral OCR pour PDFs scannés/structurés | Moyenne | 🟡 Moyen terme | Nico |
| 3 | **Format messages[]** : Refacto `buildPrompt` pour envoyer `messages[]` natif au lieu de blob texte | Faible | 🟡 Moyen terme | Nico (Java) + Florian (JS) |
| 4 | **Responses API OpenAI** : Migration + stockage `previous_response_id` en BDD | Élevée | 🟢 Long terme | Nico |
| 5 | **Mistral Document QnA natif** : si Mistral devient moteur principal | Faible (si OCR déjà fait) | 🟢 Long terme | Nico |

### Ce qu'il NE faut PAS faire
- ❌ **Implémenter les Threads OpenAI** → dépréciés, à éviter absolument
- ❌ **Implémenter un Assistants API Vector Store** → coût élevé + deprecated
- ❌ **Extraire le texte de PDF côté front (JS)** → trop lourd, sécurité, limites mémoire navigateur

---

## 6. Référence rapide — Endpoints utiles avril 2026

### OpenAI
```
Chat Completions (actuel) :
  POST https://api.openai.com/v1/chat/completions
  Authorization: Bearer $OPENAI_API_KEY
  { model, messages[], max_tokens, ... }

Responses API (nouveau, recommandé) :
  POST https://api.openai.com/v1/responses
  { model, input, instructions, previous_response_id, store: true }

Compaction (contexte long) :
  POST https://api.openai.com/v1/responses/compact
  { model, input: [...items...] }
```

### Mistral
```
Chat (stateless, actuel) :
  POST https://api.mistral.ai/v1/chat/completions
  { model, messages[], ... }

Upload fichier :
  POST https://api.mistral.ai/v1/files
  Content-Type: multipart/form-data
  Body: file=@document.pdf, purpose=ocr

OCR :
  POST https://api.mistral.ai/v1/ocr
  { model: "mistral-ocr-latest", document: { file_id: "..." }, table_format: "html" }

Document QnA (tout-en-un) :
  POST https://api.mistral.ai/v1/chat/completions
  messages[0].content = [
    { type: "text", text: "Question..." },
    { type: "document_url", document_url: "https://..." }
  ]
```

---

*Document généré le 23 avril 2026 — à mettre à jour à chaque évolution majeure des fournisseurs.*
