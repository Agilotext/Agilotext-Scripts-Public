# Speechmatics — Domaine Médical : Activation pour les Pharmaciens Agilotext
**Pour Nicolas — Avril 2026**  
*Analyse de faisabilité + spécification d'implémentation*

---

## Résumé exécutif

Speechmatics dispose d'un modèle de transcription spécialisé santé activable en **2 paramètres JSON**.  
Pour nos clients pharmaciens utilisant les templates AMELI, l'activation améliore significativement la reconnaissance des noms de médicaments (DCI), dosages, pathologies et termes réglementaires.  
**Effort d'implémentation estimé : 1 à 2 jours** selon la granularité choisie (globale ou par template).

---

## 1. Ce que Speechmatics propose

### Le paramètre `domain: "medical"`

Speechmatics a lancé un modèle de transcription spécifique au domaine médical, disponible depuis 2025.  
Il est mis à jour en continu à partir de **sources médicales officielles** (terminologie, médicaments, procédures).

**Langues supportées (Realtime + Batch) :**

| Langue | Realtime | Batch |
|--------|:--------:|:-----:|
| **Français** | Oui | Oui |
| Anglais | Oui | Oui |
| Allemand | Oui | Oui |
| Espagnol | Oui | Oui |
| Néerlandais | Oui | Oui |
| Danois, Finnois, Norvégien, Suédois | Oui | Oui |

**Le français est pleinement supporté — Realtime et Batch.**

### Ce que ça améliore concrètement

Le modèle médical apporte des améliorations mesurables sur :

- **Noms de médicaments** (DCI — Dénomination Commune Internationale) : paracétamol, amoxicilline, métformine, oméprazole, lercanidipine...
- **Dosages et posologies** : "500 mg 3 fois par jour", "0,5 UI/kg", "2 comprimés à libération prolongée"
- **Pathologies et diagnostics** : insuffisance rénale chronique, diabète de type 2, hypertension artérielle, BPCO...
- **Terminologie AMELI / Assurance Maladie** : ALD (Affection Longue Durée), CMU, tiers payant, médecin traitant, ordonnance bizone
- **Abréviations médicales** : AMM, ATU, HAS, ANSM, CNAMTS, ROSP
- **Examens et actes** : NFS, ionogramme, glycémie à jeun, ECG, échographie abdominale

### Performances annoncées (données Speechmatics)

| Métrique | Valeur |
|----------|--------|
| WER global (Word Error Rate) français | **9,0 %** |
| Rappel sur les termes médicaux critiques | **96 %** |
| Réduction d'erreurs vs concurrent le plus proche | **−50 %** sur les termes critiques |
| Résistance aux hallucinations | Conçu "hallucination-free" |
| Accents | Indépendant de l'accent (régions françaises incluses) |

---

## 2. Pertinence pour nos clients pharmaciens / templates AMELI

### Le contexte AMELI

Les pharmaciens utilisent les templates AMELI pour :
- Entretiens pharmaceutiques (asthme, anticoagulants, diabète de type 2, insuffisance cardiaque)
- Bilans de médication partagés (BMP)
- Accompagnements Sévices Pharmaceutiques
- Compte-rendus de consultations officinales

Ces séances contiennent une **densité très élevée** de terminologie médicale et médicamenteuse — exactement le domaine cible du modèle.

### Exemples de transcriptions améliorées

| Phrase prononcée | Transcription standard | Transcription médicale |
|-----------------|----------------------|----------------------|
| "Il prend de la métformine 850" | "Il prend de la metformin huit cent cinquante" | "Il prend de la **metformine 850**" |
| "Ordonnance pour ALD 30" | "ordonnance pour al de trente" | "Ordonnance pour **ALD 30**" |
| "Tiers payant contre l'AMO" | "tiers paient contre l'amo" | "**Tiers payant** contre l'**AMO**" |
| "Renouvellement ROSP" | "renouvellement ros p" | "Renouvellement **ROSP**" |
| "Interaction avec les AVK" | "interaction avec les a v k" | "Interaction avec les **AVK**" |
| "Insuffisance rénale stade 3" | "insuffisance rénale stad 3" | "Insuffisance rénale **stade 3**" |

### Combinaison avec le Word Boost existant

Le domaine médical et le Word Boost compte sont **complémentaires et cumulables** :

- **`domain: "medical"`** → améliore la reconnaissance des termes médicaux **génériques** (DCI, pathologies, actes)
- **Word Boost** → améliore les termes **spécifiques au client** (nom du pharmacien, de l'officine, logiciels métier, noms de patients récurrents)

Les deux se cumulent dans le même appel Speechmatics. Il n'y a **pas de conflit**.

---

## 3. Comment l'activer — Changement minimal côté Java

### Le changement technique

Le modèle médical s'active en ajoutant **2 paramètres** dans la configuration JSON envoyée à Speechmatics :

```json
// AVANT — configuration actuelle (supposée)
{
  "type": "transcription",
  "transcription_config": {
    "language": "fr",
    "operating_point": "standard"
  }
}

// APRÈS — avec modèle médical
{
  "type": "transcription",
  "transcription_config": {
    "language": "fr",
    "operating_point": "enhanced",
    "domain": "medical"
  }
}
```

**Contrainte Speechmatics :** `domain: "medical"` est **obligatoirement couplé** à `operating_point: "enhanced"`.  
Si Agilotext utilise déjà `enhanced` → le changement est un seul paramètre à ajouter.  
Si Agilotext utilise `standard` → les deux paramètres changent.

### Localisation dans le code Java

Le changement se fait dans **`SpeechmaticsAiTranscriptor.java`** (ou la classe qui construit la configuration JSON avant l'appel Speechmatics), dans la méthode qui génère le `transcription_config`.

```java
// Exemple de modification (pseudo-code selon la structure actuelle)
JSONObject transcriptionConfig = new JSONObject();
transcriptionConfig.put("language", "fr");
transcriptionConfig.put("operating_point", "enhanced");  // ← changer si "standard" aujourd'hui

// AJOUT conditionnel selon le profil/template :
if (isMedicalDomain(edition, promptModelId)) {
    transcriptionConfig.put("domain", "medical");
}
```

---

## 4. Stratégies d'activation — 3 options

### Option A — Activation globale (la plus simple, 1h de travail)

Activer `domain: "medical"` pour **tous les jobs français** de l'application.

**Avantages :**
- Zéro logique conditionnelle
- Bénéfice immédiat pour tous les utilisateurs francophones
- Aucun changement de BDD, aucun endpoint modifié

**Inconvénients :**
- `enhanced` peut être légèrement plus lent que `standard` (bien que la différence soit négligeable pour du batch)
- Si Agilotext est aujourd'hui sur `standard`, le coût de transcription augmente (voir §5)

**Recommandation :** acceptable si le budget le permet. Bonne option de départ pour valider l'amélioration.

---

### Option B — Activation par offre / édition (recommandée)

Activer `domain: "medical"` uniquement pour les clients **Business** ou sur activation explicite.

```java
// Dans SpeechmaticsAiTranscriptor
boolean isMedicalEnabled = edition.isBusinessOrAbove()
    || userPreferences.isMedicalDomainEnabled();

if (isMedicalEnabled) {
    transcriptionConfig.put("domain", "medical");
    transcriptionConfig.put("operating_point", "enhanced");
}
```

**Avantages :**
- Maîtrise des coûts
- Peut être présenté comme fonctionnalité "premium"
- Aucun impact sur les Free/Pro si non activé

**Changements nécessaires :**
- 1 flag en BDD : `user_medical_domain_enabled BOOLEAN DEFAULT FALSE` (table `user_preferences` ou équivalent)
- 1 endpoint pour activer/désactiver (ou activation admin manuelle en BDD)
- ~1 journée de travail

---

### Option C — Activation par template de CR (la plus fine)

Activer `domain: "medical"` quand le job utilise un **template identifié comme médical/pharmacien** (ex. templates AMELI).

```java
// Le promptModelId du template AMELI est connu (ex: 42, 57...)
boolean isMedicalTemplate = MEDICAL_TEMPLATE_IDS.contains(promptModelId);
if (isMedicalTemplate) {
    transcriptionConfig.put("domain", "medical");
    transcriptionConfig.put("operating_point", "enhanced");
}
```

**Avantages :**
- Ultra-ciblé : seulement les séances qui en ont besoin
- Aucune décision utilisateur requise — automatique

**Inconvénients :**
- Nécessite de connaître les `promptModelId` des templates pharmaciens
- Si un client crée son propre template AMELI personnalisé, il n'est pas auto-détecté

**Solution :** ajouter un flag `is_medical_domain BOOLEAN` sur la table `prompt_models` ou `prompt_model_user`, settable par admin.

---

### Recommandation finale

> **Option B** (par offre) à court terme pour valider l'impact + **Option C** (par template) en complément sur la durée — pour associer automatiquement les templates pharmaciens au domaine médical.

---

## 5. Impact sur le coût de transcription

### Pricing Speechmatics (avril 2026)

| Modèle | Coût | Vitesse |
|--------|------|---------|
| `standard` | ~$0.18–0.20/h (estimation, moins cher) | Plus rapide |
| `enhanced` | **$0.24/h** (tarif officiel Pro) | Très bon |
| `enhanced + domain:medical` | **Même prix que `enhanced`** — aucun surcoût identifié | Identique |

**Bonne nouvelle : `domain: "medical"` ne génère pas de coût supplémentaire par rapport à `enhanced` seul.**

Le seul surcoût potentiel est le passage de `standard` → `enhanced` si Agilotext utilise actuellement `standard`.  
Dans ce cas : `$0.24/h` vs `~$0.18/h` ≈ **+33%** sur le coût de transcription.

### Calcul indicatif

Pour un pharmacien qui enregistre 5 entretiens par semaine × 30 minutes = 2,5h/semaine = 10h/mois :
- Surcoût mensuel si passage `standard` → `enhanced + medical` : **~$0,60/mois/client pharmacien**

Coût totalement absorbable dans l'offre Business, et valorisable comme fonctionnalité premium.

---

## 6. Ce qu'il faut vérifier avant de déployer

### Test de validation recommandé

1. **Créer un job de test** avec un audio de consultation pharmacien (DCI, posologie, AMELI)
2. **Comparer 2 transcriptions** : même audio avec `standard` vs `enhanced + domain:medical`
3. **Mesurer** : nombre de DCI correctement transcrites, abréviations AMELI, dosages

Ce test peut se faire directement via le portail Speechmatics ou via l'API en modifiant temporairement la config.

### Statut "preview" du modèle français

> **Point de vigilance :** au moment de la rédaction (avril 2026), Speechmatics a annoncé que le modèle médical français est en cours de déploiement depuis "preview". Il convient de **vérifier le statut production actuel** via le portail Speechmatics ou en contactant leur support (hello@speechmatics.com).

Pour vérifier programmatiquement si le domaine médical est disponible :

```bash
# Via l'API Feature Discovery Speechmatics
GET https://mp.speechmatics.com/v1/api_keys/languages

# Ou tester directement — si le job retourne une erreur "domain not supported",
# le modèle n'est pas encore en production pour ce plan
```

---

## 7. Résumé des actions pour Nico

| # | Action | Complexité | Durée |
|---|--------|-----------|-------|
| 1 | Verifier que le modele francais `domain:medical` est bien en production (pas preview) via portail Speechmatics | Zero code | 15 min |
| 2 | Localiser dans `SpeechmaticsAiTranscriptor.java` l'endroit exact ou le `transcription_config` est construit | Zero code | 15 min |
| 3 | **Option A - Global** : ajouter `"domain":"medical"` + `"operating_point":"enhanced"` pour tous les jobs FR | Tres faible | 1h |
| 4 | **Option B - Par offre** : flag BDD + logique conditionnelle + activation admin | Faible | 1 journee |
| 5 | Test de validation audio pharmacien | Zero code | 30 min |
| 6 | **Option C - Par template** : flag sur la table `prompt_models` + auto-activation | Faible | 1 journee |

---

## 8. Références

- **Documentation officielle** : [Speechmatics — Languages & Medical Domain](https://docs.speechmatics.com/speech-to-text/languages#healthcare-transcription)
- **Annonce modèle français** : [Speechmatics Medical Model launches in Spanish + French](https://www.speechmatics.com/company/articles-and-news/speechmatics-medical-model-launches-in-spanish)
- **Pricing** : [Speechmatics Pricing](https://www.speechmatics.com/our-technology/pricing)
- **API Batch Input** : [Speechmatics Batch Input](https://docs.speechmatics.com/speech-to-text/batch/input)

---

*Document rédigé le 23 avril 2026 — à valider avec Nicolas lors d'un prochain échange.*
