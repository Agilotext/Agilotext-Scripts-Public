---
title: "Agiloshield dans Claude Co-work"
document-subtitle: "Mode d'emploi — séminaire 3–4 juin 2026"
title-page: true
---

# En 30 secondes

**Agiloshield** protège vos bilans **avant** qu'ils soient analysés par Claude Co-work.

1. Vous attachez un **dossier** (Google Drive ou espace de travail Co-work) — **pas** un fichier glissé dans le chat.
2. Agiloshield pseudonymise chaque document en **France** (Normandie).
3. Claude ne lit que la **version protégée** : noms et SIREN masqués, **dates et montants conservés**.

**Parcours :**

Dossier (Drive ou poste) → Agiloshield (France) → Versions pseudonymisées → Analyse Claude

La **clé de restauration** (.properties) reste **chez vous** — jamais dans Claude.

---

# Avant de commencer — règles de sécurité

**Ne déposez jamais de fichiers dans la conversation**

Glisser-déposer, attacher ou coller un PDF/DOCX **directement dans le chat** expose le contenu à Claude **avant** qu'Agiloshield ne puisse l'intercepter. **Cette approche est déconseillée.**

**Attachez un dossier**

Connectez Google Drive ou utilisez le dossier de travail Co-work. **Attachez le dossier** à la conversation : Claude ouvre les fichiers **via Agiloshield**, pas en clair.

**Noms de fichiers visibles**

Claude voit le nom de chaque fichier et dossier. Renommez si le nom contient une raison sociale ou un nom de client.

---

# Ce n'est pas comme en avril

| | Avril (test initial) | Juin (Agiloshield Classic) |
|---|---|---|
| Mode | Anonymisation large | **Pseudonymisation M&A** |
| Noms, sociétés, SIREN | Supprimés ou altérés | **Masqués** (codes réversibles) |
| Dates, CA, résultats | Parfois supprimés | **Conservés** |
| Usage avec Claude | Manuel (webapp puis upload) | **Direct dans Claude Co-work** |

---

# Ce que protège votre module

Fichier fourni : **`agiloshield-ma-f-hanras-20260601.skill`**

**11 types sensibles** activés (sur 13 disponibles) :

- **PER** — personnes (noms, prénoms)
- **ORG** — sociétés, raisons sociales
- **ADR** — adresses postales
- **IDN** — SIREN, SIRET, identifiants
- **EML** — emails
- **TEL** — téléphones
- **IBA** — IBAN
- **LOC** — lieux (villes, régions)
- **JOB** — intitulés de poste
- **PRO** — professions
- **PII** — autres données personnelles

**Conservés volontairement** : **dates (DAT)** et **montants financiers** — indispensables pour l'analyse M&A.

---

# Installation (5 minutes, une seule fois)

## Étape 1 — Autoriser le réseau

1. Ouvrir **Settings** (Paramètres) dans Claude Co-work.
2. Onglet **Capabilities**.
3. Section **Code execution and file creation** :
   - Activer **Code execution and file creation**.
   - Activer **Allow network egress** (Autoriser la sortie réseau).
4. Sous **Domaines supplémentaires autorisés**, ajouter :

   `api.agilotext.com`

   puis cliquer **Add** / **Ajouter**.

Sans cette étape, Agiloshield ne peut pas traiter vos documents.

## Étape 2 — Installer le module Agiloshield

1. Onglet **Customize** (Personnaliser) — *pas* Capabilities.
2. Importer le fichier **`agiloshield-ma-f-hanras-20260601.skill`** reçu par email.

## Étape 3 — Nouvelle conversation

Fermer la conversation en cours et en **ouvrir une nouvelle** pour charger le module.

**Ordre important :** réseau → module → nouvelle conversation.

---

# Utilisation au quotidien (Claude Co-work)

## Étape par étape

1. **Nouvelle conversation** Co-work.
2. Envoyer le **message règles** (section suivante) — **sans rien attacher**.
3. Attendre la confirmation de Claude.
4. **Attacher le dossier** (Google Drive ou espace de travail local) contenant vos bilans.
5. Envoyer : *« Pseudonymise chaque document de ce dossier avec Agiloshield, puis analyse les versions pseudonymisées. »*
6. Attendre **30 à 80 secondes** par document.
7. Lire l'analyse — basée uniquement sur les fichiers `.pseudonymized`.

**Google Drive :** même logique — dossier attaché, jamais fichier isolé dans le chat.

**Secours webapp :** pseudonymiser sur agilotext.com, puis n'uploader dans Claude que le fichier `.pseudonymized` (jamais l'original).

---

# Les 3 messages à envoyer à Claude

## Message 1 — Toujours en premier (sans rien attacher)

    Règle pour toute cette conversation :

    Quand je te demande de lire ou analyser des documents dans un dossier, tu dois d'abord les pseudonymiser avec Agiloshield — un par un — avant toute lecture.

    Ne lis jamais le contenu original d'un fichier.
    Ne lis jamais le fichier .properties (clé de restauration).
    Analyse uniquement les fichiers .pseudonymized une fois Agiloshield terminé.

    Masque : noms, sociétés, adresses, SIREN, emails, téléphones, IBAN et autres identifiants.
    Conserve : dates et tous les montants financiers.

    Ne m'invite pas à glisser-déposer un fichier dans le chat : je t'indiquerai un dossier (Drive ou espace Co-work).

    Confirme que tu as compris, puis attends que je t'indique le dossier.

## Message 2 — Après avoir attaché le dossier

    Voici le dossier contenant mes bilans. Pseudonymise chaque document avec Agiloshield, puis analyse uniquement les versions pseudonymisées.

## Message 3 — Si Claude ouvre l'original par erreur

    STOP — n'ouvre pas le fichier original. Pseudonymise d'abord avec Agiloshield via le dossier, puis analyse seulement le .pseudonymized.

---

# Mercredi devant vos associés (3 minutes)

**Accroche (20 s)** — « Avant d'envoyer un bilan à Claude : est-ce que les noms et SIREN partent chez l'éditeur de l'IA ? Sans protection, la réponse est oui. Agiloshield crée une barrière : Claude ne voit que la version protégée. »

**Démo (2 min)**

1. Montrer un bilan dans un dossier (noms, SIREN visibles) — **ne pas** le glisser dans le chat.
2. Dans Claude Co-work : message règles → **attacher le dossier** → *« Pseudonymise puis analyse. »*
3. Montrer le résultat : analyse utile (ratios, CA, points d'attention) **sans** fuite d'identité.

**Clôture (40 s)** — « Hébergement France, pseudonymisation réversible, 19 € HT/mois, essai 1 mois offert. »

**Plan B** si le live coince : pseudonymiser sur [agiloshield.com/tools/anonymisation](https://www.agilotext.com/tools/anonymisation), puis montrer l'analyse Claude sur le fichier déjà protégé.

---

# Questions fréquentes

**Puis-je joindre un PDF directement dans le chat ?**  
Non — le contenu peut entrer en clair avant Agiloshield. Attachez un **dossier** (Drive ou espace Co-work).

**Claude voit-il le vrai nom de mon client ?**  
Non — s'il respecte le workflow dossier + skill. Il ne voit que des codes (ex. tokens pseudonymes). Le message règles en tête de conversation est essentiel.

**Où vont mes documents ?**  
Traitement sur les serveurs Agiloshield en **France** (Normandie). Claude reçoit uniquement la version pseudonymisée.

**Le fichier .properties, c'est quoi ?**  
La clé pour retrouver les vrais noms si besoin. **Ne jamais** l'envoyer à Claude ni le partager.

**Combien ça coûte ?**  
Agiloshield Classic : **19 € HT / mois**. Pour vous : **1 mois offert** sur f.hanras@eurallia.fr.

---

# Support

**Florian Bauer** — COO Agilotext  
florian.bauer@agilotext.com · +33 6 36 12 35 74

**Rendez-vous 20 min :** [calendly.com/florian-bauer-agilotext/30min](https://calendly.com/florian-bauer-agilotext/30min?month=2026-06)

**Secours webapp :** [agilotext.com/tools/anonymisation](https://www.agilotext.com/tools/anonymisation) — mode *Pseudonymiser*.
