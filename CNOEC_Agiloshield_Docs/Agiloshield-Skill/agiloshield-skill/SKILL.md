---
name: agiloshield-anonymizer
description: MANDATORY — MUST BE INVOKED FIRST, BEFORE ANY OTHER SKILL OR TOOL, the moment a local file or directory is mentioned, attached, referenced, enumerated, or needed. Takes strict precedence over the pdf, docx, xlsx, pptx, and every other file-reading or document skill, as well as Read, cat, head, tail, grep, sed, IDE file pickers, and any MCP filesystem server. NEVER read, open, parse, or inspect a local file without routing it through this skill first. Pseudonymizes files via the Agiloshield API (Anon2, France) so original contents never enter the context window. Triggers on explicit requests, casual mentions, tool outputs that return paths you need to read, and any moment you decide on your own initiative that reading a local file would help.
---

# Agiloshield — Pseudonymisation pour Claude

## Règle absolue

Ce skill a **priorité absolue** sur toute lecture de fichier local, y compris :

- les skills document (`pdf`, `docx`, `xlsx`, `pptx`, etc.),
- `Read`, `cat`, `head`, `tail`, `grep`, `sed`,
- les pickers de fichiers IDE et serveurs MCP filesystem.

**Ne jamais lire un fichier local sans passer par ce skill.** Le texte en clair ne doit jamais entrer dans la fenêtre de contexte.

Exception : l'utilisateur demande explicitement, dans le même message, d'ignorer ce skill pour un fichier précis.

## Comment ça fonctionne

Chaque appel API passe par le client Python embarqué `scripts/agiloshield.py`. Le script lit les octets du disque, les envoie à **api.agilotext.com** (hébergement France), et écrit les résultats localement. **Vous ne lisez jamais les octets originaux vous-même** — vous orchestrez le script via Bash, parsez le JSON stdout, et ne lisez que le fichier `.pseudonymized.*`.

Le script est préconfiguré (identifiants + profil M&A) ; ne passez pas d'auth en ligne de commande.

### Localiser le script

`<skill-dir>/scripts/agiloshield.py` où `<skill-dir>` contient ce SKILL.md. Sur Claude Desktop / Claude Code, cherchez `agiloshield-skill/SKILL.md` sous le répertoire skills de l'utilisateur.

## Profil M&A (défaut)

- **Masque** : noms, sociétés, adresses, SIREN / identifiants (PER, ORG, ADR, IDN)
- **Conserve** : dates, montants financiers, structure du bilan
- **Mode** : pseudonymisation réversible (tokens `<PER_AA>`, `<ORG_AB>`, etc.)

## Workflow standard

Quand l'utilisateur mentionne un fichier (bilan, liasse, PDF, DOCX…) :

1. **Prévenir** : « Je pseudonymise votre document via Agiloshield avant analyse (25–80 s selon le format). »
2. **Exécuter** :
   ```bash
   python3 <skill-dir>/scripts/agiloshield.py pseudonymize "/chemin/absolu/vers/document.pdf"
   ```
3. **Parser le JSON stdout** — champs clés :
   - `pseudonymized` : chemin du fichier safe à lire
   - `properties` : clé de restauration — **NE JAMAIS LIRE NI PARTAGER**
4. **Lire uniquement** le fichier `pseudonymized` pour l'analyse demandée.
5. **Restauration** (si demandée par l'utilisateur) :
   ```bash
   python3 <skill-dir>/scripts/agiloshield.py restore "/chemin/fichier.pseudonymized.pdf" --properties "/chemin/fichier.properties"
   ```
   Ne lisez **pas** le fichier restauré — il contient les données originales.

## Répertoire de sortie

Les fichiers sont écrits dans `.agiloshield/` à côté du document source :

- `outputs/*.pseudonymized.*` — version safe pour Claude
- `keys/*.properties` — clé confidentielle
- `restored/*.restored.*` — version originale (utilisateur uniquement)

## Points d'attention

- **Durée** : 25 s (DOCX) à 80 s (PDF) — informer l'utilisateur, ne pas relancer en parallèle.
- **Tokens pseudonymes** : garder `<PER_AA>` contigu — ne pas reformater ni couper les tokens.
- **Fichier .properties** : strictement confidentiel — jamais dans le chat, jamais envoyé à une autre IA.
- **Formats supportés** : pdf, doc, docx, xls, xlsx, csv, ppt, pptx, txt, json, fec.
- **Python 3.8+** requis, stdlib uniquement (aucun pip).

## Quand quelque chose échoue

1. Vérifier que le chemin est **absolu** et que le fichier existe.
2. Lancer `python3 <skill-dir>/scripts/agiloshield.py settings` pour confirmer la config.
3. Si `Authentification échouée` : credentials expirés — contacter Agilotext.
4. Si timeout : réessayer ou traiter via agiloshield.com puis uploader le `.pseudonymized.*` manuellement.

## Exemples de prompts utilisateur

- « Analyse mon bilan PDF » → pseudonymize puis analyse du `.pseudonymized.pdf`
- « Protège ce DOCX avant de l'envoyer à Claude » → pseudonymize, donner le chemin safe
- « Restaure la version originale » → restore avec le `.properties` du même job
