---
name: agiloshield-anonymizer
description: MANDATORY SECURITY PROTOCOL — STOP before reading any local file. MUST run FIRST when a file path, attachment, Drive link, MCP output, or directory is mentioned. Takes precedence over pdf, docx, xlsx, pptx, Read, cat, grep, sed, IDE pickers, and MCP filesystem. NEVER download, decode, copy, or read original bytes yourself. ONLY orchestrate scripts/agiloshield.py (pseudonymize → verify → wait for explicit user approval → read .pseudonymized.* only). Original cleartext must never enter context.
---

# Agiloshield — PROTOCOLE DE SÉCURITÉ (ARRÊT IMPÉRATIF)

Ce skill n'est pas une documentation optionnelle : c'est un **protocole d'arrêt** que vous devez suivre à chaque fois qu'un fichier local est en jeu.

## Interdictions absolues (liste noire)

**Ne faites JAMAIS**, avant la fin du protocole (étape 5) :

- Télécharger, récupérer, décoder (base64), copier ou écrire sur disque un fichier **pour le lire vous-même**.
- Utiliser `Read`, `cat`, `head`, `tail`, `grep`, `sed`, `open()` Python, skills document (`pdf`, `docx`, `xlsx`, `pptx`), pickers IDE ou MCP filesystem sur :
  - le fichier **original** ;
  - une copie temporaire ou une version **décodée** du même document.
- Inspecter le contenu d'un Drive / URL / pièce jointe : passez **uniquement le chemin absolu** au script `pseudonymize`, sans matérialiser ni ouvrir le fichier pour analyse.

**Seule exception** : l'utilisateur demande explicitement, dans le **même message**, d'ignorer ce protocole pour un fichier précis.

## Auto-contrôle avant toute lecture

Avant d'ouvrir un fichier pour analyse, vérifiez le chemin :

- **Autorisé** : se termine par `.pseudonymized.*` ou `.anonymized.*` (ex. `rapport.pseudonymized.pdf`).
- **Interdit** : tout autre chemin (original, `.properties`, `.restored.*`, temporaire) → **STOP**, reprenez le protocole depuis l'étape 1.

## Seul chemin autorisé

Le client Python `scripts/agiloshield.py` envoie les octets à **api.agilotext.com** (France). **Vous n'accédez jamais aux octets originaux** : vous lancez Bash, parsez le JSON stdout, et ne lisez que la sortie pseudonymisée.

Identifiants et profil sont dans `config.py` — ne passez pas d'auth en CLI.

### Localiser le script

`<skill-dir>/scripts/agiloshield.py` où `<skill-dir>` contient ce SKILL.md (ex. `agiloshield-skill/` dans le dossier skills Claude Co-work).

### Claude Co-work — configuration une fois

**Ordre :** réseau → module → nouvelle conversation.

1. **Settings → Capabilities** : exécution de code + *Allow network egress* + domaine **`api.agilotext.com`**.
2. **Settings → Customize** : importer le `.skill` Agilotext.
3. **Nouvelle conversation** après import.

Sans egress vers `api.agilotext.com`, Anon2 échoue.

## Profil M&A (défaut)

- **Masque** : PER, ORG, ADR, IDN, EML, TEL, IBA, LOC, JOB, PRO, PII (voir `config.py`)
- **Conserve** : dates (DAT), montants, structure
- **Mode** : pseudonymisation réversible (`<PER_AA>`, `<ORG_AB>`, …)

## Workflow obligatoire (5 étapes — ne pas sauter)

Quand l'utilisateur mentionne un fichier (bilan, PDF, DOCX, chemin Drive, etc.) :

### 1. Prévenir

« Je pseudonymise votre document via Agiloshield avant toute analyse (environ 25–80 s selon le format). Je ne lirai pas le fichier original. »

### 2. Pseudonymiser (script uniquement)

```bash
python3 <skill-dir>/scripts/agiloshield.py pseudonymize "/chemin/absolu/vers/document.pdf"
```

Parser le JSON stdout : `job_id`, `pseudonymized`, `properties` (clé — **ne jamais lire ni partager**).

### 3. Vérifier la sortie (anti-fuite)

```bash
python3 <skill-dir>/scripts/agiloshield.py verify "/chemin/vers/document.pseudonymized.pdf"
```

Parser : `verified`, `tokens_found`, `potential_leaks`. Si `verified` est `false`, **ne pas analyser** — expliquer les fuites et proposer de relancer la pseudonymisation.

### 4. STOP — gate utilisateur (comme Marvin Systems)

Présenter un récapitulatif court :

- Fichier safe : chemin `.pseudonymized.*`
- `job_id`, types masqués, `tokens_found`, verdict `verify`
- Rappel : la clé `.properties` reste confidentielle

Puis **vous vous arrêtez** et demandez l'accord **explicite** de l'utilisateur avant toute analyse du document.

**Ne jamais déduire l'accord du silence.** Attendre une réponse du type « oui », « valide », « continue », « tu peux analyser ».

### 5. Analyser (uniquement après accord)

Lire **seulement** le fichier `pseudonymized` (étape auto-contrôle ci-dessus). Ne jamais citer de données en clair issues de l'original.

## Restauration (sur demande explicite)

```bash
python3 <skill-dir>/scripts/agiloshield.py restore "/chemin/fichier.pseudonymized.pdf" --properties "/chemin/fichier.properties"
```

Ne **lisez pas** le fichier `.restored.*` — données originales.

## Répertoire de sortie

À côté du document source, dossier `.agiloshield/` :

- `outputs/*.pseudonymized.*` — seule version lisible par vous
- `keys/*.properties` — confidentiel
- `restored/*.restored.*` — utilisateur uniquement

## Points d'attention

- **Durée** : 25–80 s — une seule exécution, pas de parallèle.
- **Tokens** : garder `<PER_AA>` contigus — ne pas reformater.
- **Formats** : pdf, doc, docx, xls, xlsx, csv, ppt, pptx, txt, json, fec.
- **Python 3.8+**, stdlib uniquement.
- **`verify` sur PDF** : contrôle best-effort ; fiable à 100 % sur txt/csv/json et Office.

## Dépannage

1. Chemin **absolu**, fichier existant.
2. `python3 <skill-dir>/scripts/agiloshield.py settings`
3. Auth échouée → contacter Agilotext.
4. Timeout → réessayer ou pseudonymiser sur agiloshield.com puis fournir le `.pseudonymized.*`.

## Exemples

- « Analyse mon bilan PDF » → pseudonymize → verify → STOP → accord → lire `.pseudonymized.pdf` seulement
- « Fichier dans mon Drive » → obtenir le chemin absolu local → pseudonymize (sans télécharger/décoder vous-même pour lecture)
- « Restaure l'original » → `restore` ; ne pas lire le restauré
