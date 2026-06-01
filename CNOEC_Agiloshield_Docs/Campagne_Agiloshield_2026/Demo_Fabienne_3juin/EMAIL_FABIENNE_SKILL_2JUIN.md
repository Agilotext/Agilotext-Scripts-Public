# Email Fabienne — accès + Claude Co-work (2 juin 2026)

**À :** f.hanras@eurallia.fr  
**Objet :** Re : Agiloshield — votre accès + mode d'emploi Claude Co-work (séminaire mercredi)

**Pièces jointes :**
- `GUIDE_FABIENNE_CLAUDE_COWORK.pdf`
- `agiloshield-ma-f-hanras-20260601.skill`

---

Bonsoir Fabienne,

Merci pour votre patience — voici le **retour complet** promis pour votre séminaire de **mercredi**.

**Votre accès**

Votre essai **Agiloshield Classic (1 mois offert)** est actif sur **f.hanras@eurallia.fr**.  
Tarif ensuite : **19 € HT / mois** — vous restez libre de continuer ou non après l'essai.

**En une phrase**

Dans **Claude Co-work**, vous travaillez depuis un **dossier** (Google Drive ou espace de travail Co-work) : Agiloshield **pseudonymise chaque bilan avant** que Claude ne le lise. Claude n'analyse que la **version protégée** — noms et SIREN masqués, **dates et montants conservés** pour votre analyse M&A.

**Ce n'est pas comme en avril**

En avril, vous aviez testé l'*anonymisation complète* (certaines dates ou chiffres disparaissaient).  
Aujourd'hui, c'est la **pseudonymisation M&A** : les identités sont masquées, **le contenu financier reste intact**.

**Ce que protège votre module (`agiloshield-ma-f-hanras-20260601.skill`)**

**11 types sensibles** configurés sur 13 — l'essentiel d'un bilan M&A :

- Personnes, sociétés, adresses, SIREN / identifiants  
- Emails, téléphones, IBAN  
- Lieux, fonctions, professions, autres données personnelles  

**Conservés volontairement** : **dates** et **montants** (CA, résultat, bilans, ratios).

---

**Avant de commencer — 3 règles importantes (comme pour tout outil sérieux dans Co-work)**

**1. Ne glissez jamais un fichier dans la conversation**

Si vous **glissez-déposez**, **attachez** ou **collez** un PDF/DOCX directement dans le chat, son contenu peut entrer dans Claude **avant** qu'Agiloshield ne l'intercepte. **C'est à éviter.**

**2. Attachez un dossier, pas un fichier isolé**

Pour déclencher Agiloshield correctement :

- connectez votre **Google Drive**, ou  
- utilisez le **dossier de travail** Co-work sur votre poste,

puis **attachez le dossier** (ou indiquez son chemin) à la conversation. Claude **ouvre lui-même** les fichiers du dossier en les faisant passer par Agiloshield **avant** lecture.

**3. Les noms de dossiers et de fichiers restent visibles**

Par conception, Claude voit le **nom** du fichier et du dossier pour le traiter. Si un nom contient une info confidentielle (ex. « Bilan_Société_Dupont_2024.pdf »), **renommez-le** avant de partager le dossier (ex. « Bilan_cible_A_2024.pdf »).

---

**Installation (5 minutes — détail dans le PDF joint)**

1. **Settings → Capabilities** : *Code execution* + *Allow network egress* ON → ajouter **`api.agilotext.com`**
2. **Settings → Customize** : importer **`agiloshield-ma-f-hanras-20260601.skill`**
3. **Nouvelle conversation** Co-work

---

**Comment utiliser Co-work (dans l'ordre)**

**Étape 1** — Nouvelle conversation. Copier-coller **sans rien attacher** :

```
Règle pour toute cette conversation :

Quand je te demande de lire ou analyser des documents dans un dossier, tu dois d'abord les pseudonymiser avec Agiloshield — un par un — avant toute lecture.

Ne lis jamais le contenu original d'un fichier.
Ne lis jamais le fichier .properties (clé de restauration).
Analyse uniquement les fichiers .pseudonymized une fois Agiloshield terminé.

Masque : noms, sociétés, adresses, SIREN, emails, téléphones, IBAN et autres identifiants.
Conserve : dates et tous les montants financiers.

Ne m'invite pas à glisser-déposer un fichier dans le chat : je t'indiquerai un dossier (Drive ou espace Co-work).

Confirme que tu as compris, puis attends que je t'indique le dossier.
```

**Étape 2** — Attacher le **dossier** (Drive ou espace de travail), puis :

```
Voici le dossier contenant mes bilans. Pseudonymise chaque document avec Agiloshield, puis analyse uniquement les versions pseudonymisées.
```

**Étape 3** — Attendre **30 à 80 secondes** par document, puis lire l'analyse.

**Si Claude ouvre un original ou vous propose d'attacher un fichier dans le chat :**

```
STOP — n'ouvre pas le fichier original. Pseudonymise d'abord avec Agiloshield via le dossier, puis analyse seulement le .pseudonymized.
```

---

**Test demain**

Préparez un dossier avec **un bilan test** (PDF ou DOCX), suivez les 3 étapes ci-dessus. Le PDF joint reprend tout en détail, y compris le script pour **mercredi** devant vos associés.

**Besoin d'un coup de main ?**

Je reste disponible pour 20 minutes :

https://calendly.com/florian-bauer-agilotext/30min?month=2026-06

**Secours** (hors Co-work) : [agiloshield.com/tools/anonymisation](https://www.agilotext.com/tools/anonymisation) — mode *Pseudonymiser*, puis uploader **uniquement** le fichier `.pseudonymized` dans Claude (jamais l'original).

Belle soirée,  
Florian Bauer  
COO · Agilotext  
florian.bauer@agilotext.com · +33 6 36 12 35 74
