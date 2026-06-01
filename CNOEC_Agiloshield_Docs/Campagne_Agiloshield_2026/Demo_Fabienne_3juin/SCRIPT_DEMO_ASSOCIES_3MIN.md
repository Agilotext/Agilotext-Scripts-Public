# Script démo associés — Fabienne HANRAS (3–4 juin 2026)

**Durée :** 3 à 5 minutes · **Public :** associés Eurallia Finance  
**Message clé :** *Protéger les données avant l'IA — sans perdre l'analyse financière.*

---

## 0. Accroche (20 s)

« Avant d'envoyer un bilan ou une liasse à ChatGPT ou Claude, une question simple : **est-ce que les noms, SIREN et coordonnées partent chez l'éditeur de l'IA ?** La réponse, sans outil adapté, c'est oui. Agiloshield crée une **barrière opaque** : l'IA ne voit que la version protégée. »

---

## 1. Montrer le document sensible (30 s)

- Ouvrir le **bilan original** (fictif ou anonymisé en amont pour la démo).
- Souligner : noms de dirigeants, raison sociale, SIREN, adresses.
- **Ne pas** l'uploader dans Claude tel quel.

> « Voici un document type M&A. On ne veut pas que ces identifiants quittent notre périmètre de confiance. »

---

## 2. Pseudonymiser avec Agiloshield (60–90 s)

**Live (Plan A)** ou **fichier déjà prêt (Plan B)** :

1. Aller sur https://www.agilotext.com/tools/anonymisation (connecté Memberstack).
2. Choisir **Pseudonymiser** (pas Anonymiser).
3. Cocher : **PER, ORG, ADR, IDN** (personnes, sociétés, adresses, identifiants).
4. Déposer le DOCX/PDF → traitement ~30–80 s.
5. Télécharger :
   - le fichier **pseudonymisé** ;
   - le fichier **.properties** (clé de restauration — **ne jamais** envoyer à Claude).

> « En 30 secondes, les identités sont remplacées par des codes réversibles. Les **dates, CA, EBE et montants restent intacts** — indispensable pour l'analyse M&A. »

**Si question avril :** « En avril j'avais testé l'anonymisation complète. Aujourd'hui c'est la **pseudonymisation M&A** : autre mode, autres réglages. »

---

## 3. Analyser avec Claude — version safe uniquement (90 s)

1. Ouvrir **Claude** (claude.ai ou Desktop).
2. Uploader **uniquement** le fichier pseudonymisé.
3. Coller un prompt (voir `PROMPTS_CLAUDE_DEMO.md`), par exemple :

> « Analyse ce bilan pseudonymisé : structure financière, points d'attention due diligence, cohérence des marges. Les noms sont masqués — base-toi sur les chiffres et dates. »

4. Montrer la réponse : analyse utile **sans** fuite de données identifiantes.

> « Claude travaille sur un document **conforme** — nos clients et nos cibles ne sont pas exposés chez Anthropic. »

---

## 4. Restauration et souveraineté (30 s)

- Montrer le fichier `.properties` sans l'ouvrir : « Clé de correspondance — chez nous uniquement. »
- Une phrase : **hébergement France (Normandie)**, traitement HDS, pas de stockage persistant des documents.

---

## 5. Clôture — réseau Eurallia (20 s)

« Pour nos 16 cabinets, l'enjeu est le même : accélérer l'IA sur les dossiers M&A **sans risque RGPD ni secret professionnel**. Agiloshield Classic : 19 € HT/mois, essai 7 jours. Je propose qu'on teste sur un vrai dossier cette semaine. »

---

## Plan B — si le live web plante

1. Passer directement au fichier `02_pseudonymise_…docx` (kit préparé).
2. Dire : « Voici le résultat du traitement — je vous montre l'étape Claude. »
3. Enchaîner section 3 sans s'excuser longuement.

---

## À ne pas faire

- Promettre le « skill Claude en un clic » comme disponible aujourd'hui (roadmap Q3).
- Montrer MCP / Node.js / terminal.
- Uploader l'original dans Claude « pour comparer ».
