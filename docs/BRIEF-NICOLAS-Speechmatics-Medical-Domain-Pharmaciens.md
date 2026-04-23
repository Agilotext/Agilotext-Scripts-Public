# Agilotext, Pharmaciens et domaine medical Speechmatics
**Document strategique et technique pour Nicolas (backend / produit)**  
**Mise a jour : avril 2026** — Version elargie (roadmap, marketing, BDD, evolutions)

*La version PDF contient une table des matieres automatique en tete de document.*

---

## 1. Resume executif

**Fait** : Speechmatics permet d'activer un mode de transcription `domain: "medical"` couple a `operating_point: "enhanced"`, y compris pour le **francais** (batch et temps reel), avec un vocabulaire alimente par des referentiels medicaux. C'est **la couche la plus efficace** pour ameliorer le brut ASR en officine, avant meme le LLM.

**Recommandation produit** (alignee avec "simple au debut") :

- **Phase 1 (court terme)** : activer le domaine medical **uniquement pour une cohorte controlee** (liste blanche comptes, flag BDD, ou abonnement deja "Business / Pharma pilote"). Peu de logique, fort impact, mesure des gains.
- **Phase 2 (moyen terme)** : empaqueter l'**offre pack Medical / Officine** : acces a la feature ASR + **templates pharmaciens (AMELI, entretiens, BMP)** + eventuellement Word Boost pre-rempli, dans un **tarif** ou un **add-on** explicite.
- **Long terme** : **bibliotheque de prompts** (ou modeles de CR) par vertical, **tags** (`medical`, `officine`, `assurance-maladie`, etc.), et **lien automatique** entre tag `medical` / template categorise et **activation** du domaine Speechmatics medical : l'utilisateur n'a plus a penser au reglage technique.

**Charge estimative pour Nico (ordre de grandeur)** :

- Phase 1 (flag + branchement ASR) : **0,5 a 2 jours** selon existant (`SpeechmaticsAiTranscriptor`, un seul point d'entree ?).
- Phase 2 (produit + facturation + catalogue templates) : **plusieurs sprints** selon le scope exact (e-commerce, Stripe, contenu).
- Phase 3 (tags, regles, eventuellement heuristique/LLM leger) : **1 a 2 sprints** apres que le modele de donnees (templates + tags) soit stable.

---

## 2. Contexte Agilotext et objectifs long terme

### 2.1 Positionnement

Agilotext transforme l'**audio** en **compte-rendu structure** grace a l'ASR, au Word Boost, et au chainage LLM (resume, sections, email, etc.). La **qualite du transcript** est le plafond de toute la chaine : si le moteur confond "ALD" et "al de", le reste du pipeline reprend l'erreur.

Les **pharmaciens** (entretiens AMELI, suivi therapeutique, documentation reglementaire) produisent des audios a **haute densite** de noms de medicaments, abreviations, chiffres (posologies) et acronymes assurance-maladie. C'est le cas d'usage **ideal** pour le modele medical Speechmatics, plus encore que pour un Medecin generaliste qui parle surtout en langage courant.

### 2.2 Objectifs long terme (alignes Maestro + Chat)

- **Infra partagee** (cf. `BRIEF-NICOLAS-Infrastructure-Partagee-Chat-CR.md`) : extraire le texte des PJ, le contexte job, le chat — **une seule fois**. Le domaine medical **ASR** est **independant** de ces briques : il s'applique des la transcription du fichier audio, **en amont** du resume.
- **Verticalisation** : reconnaitre qu'Agilotext sert des **verticaux** (sante, juridique, education, etc.) avec des **templates** et des **vocabulaires** differents. Le **pack Medical / Pharmacie** est le premier candidat a une **ligne produit** claire cote client et cote revenu.

### 2.3 Pourquoi ne pas activer "medical" pour tout le monde tout de suite ?

Raisons **produit et economiques** (meme si le surcout Speechmatics du seul `domain:medical` sur `enhanced` est nul) :

- Passage possible de `standard` a `enhanced` si aujourd'hui vous etes en `standard` (impact facture STT : ~+33% sur l'heure audio selon le bareme Pro — a verifier sur votre contrat).
- **Ciblage** : les consultants ou avocats n'ont pas le meme benefice qu'une officine ; activer "medical" partout "pour rien" dilue l'argument marketing ("nous soignons la reconnaissance DCI/AMELI") et peut legerement biaiser l'acoustique sur du jargon non medical (faible, mais l'offre ciblee est plus propre).
- **Monetisation** : reserver l'option pour un **pack** permet de financer le contenu (templates, tutoriels) et le support.

---

## 3. Ce que Speechmatics apporte (domain medical)

### 3.1 Parametres API (rappel)

```json
{
  "type": "transcription",
  "transcription_config": {
    "language": "fr",
    "operating_point": "enhanced",
    "domain": "medical"
  }
}
```

**Contrainte documentee** : `domain: "medical"` **exige** `operating_point: "enhanced"`.

**Couverture** (selon la doc publique) : le francais est liste pour le mode medical en **realtime** et **batch** — a **reverifier** sur le portail compte (sortie "preview" eventuelle) avant bascule production.

### 3.2 Gains attendus cote contenu (pharmacie / AMELI)

- DCI, dosages, unites, formulations (comprime, sachet, gouttes).
- Vocabulaire "secu" : ALD, ordonnance, tiers payant, ROSP, medecin traitant, justificatifs, etc. (dans la mesure du modele, pas d'engagement legal sur chaque acronyme).
- Pathologies fréquentes en entretien (asthme, diabete, anticoagulation, insuffisance cardiaque, etc.).

### 3.3 Synerge avec le Word Boost (deja en place cote Agilotext)

Le plan Maestro / code existant decrit deja le pipeline **Word Boost** vers `additional_vocab` Speechmatics. **Domain medical** = priorite lexicale *globale* du modele. **Word Boost** = noms propres, marques, logiciel, enseigne. **Les combiner** est recommande pour l'officine (DCI reconnus par le modele + "Pharma X" + "Theriaque" + nom du medecin partenaire).

---

## 4. Alignement avec l'existant (Word Boost, infrastructure partagee)

| Brique | Role | Lien avec domain medical |
|--------|------|-------------------------|
| `SpeechmaticsAiTranscriptor` (envoi ASR) | Construit le `transcription_config` | C'est ici qu'il faut conditionner `domain: medical`. |
| Word Boost (tables `word_boost_2`, etc.) | Favorise des termes client-specifiques | Cumulable, ne remplace pas le domain. |
| Templates / `promptModelId` | Choisit le prompt de generation CR | Peut servir a **decider** du domain (phase 2-3) ou a afficher l'offre "pack". |
| Chat reprompt, PJ, JobContext (futur) | Contexte textuel au LLM | **Apres** transcription ; n'affecte pas l'ASR directement, sauf si re-transcription. |

**Principe** : *une seule decision par job* — "faut-il envoyer l'audio en `medical` ?" — prise **au moment du job d'enregistrement** (ou du streaming finalise), pas au moment du "Resume".

---

## 5. Strategie en phases : simple d'abord, monétisation, puis intelligence metier

### Phase 1 — Pilote controle (recommande pour "tout de suite")

**Objectif** : prouver la valeur sans exploser le scope.

**Cote produit** :

- Choisir **5 a 20 comptes** (officines partenaires, early adopters, comptes internes Agilotext).
- **Activer** le domaine medical par **flag** sur le compte (ou l'edition), gere manuellement en BDD au debut ou par mini-ecran admin.

**Cote Nico** :

- Champs BDD (voir section 6) : par ex. `user_profile.medical_asr_enabled` ou `org.medical_asr_enabled`.
- Dans `SpeechmaticsAiTranscriptor` : si `fr` (ou langue supportee) **et** flag actif, ajouter `domain: medical` + forcer `enhanced`.

**Criteres de succes** : baisse des corrections manuelles en relecture, temoignages clients, **pas** de hausse d'echecs de job (erreurs API).

**Duree typique** : 2 a 4 semaines de pilote, puis decision Go pour phase 2.

---

### Phase 2 — Pack Medical / Officine (produit + revenu)

**Objectif** : transformer une feature technique en **offre claire** vendable.

**Inclus possible dans le pack** (a arbitrer commercialement) :

- Activation **ASR medical** (flag automatique a l'achat du pack ou a l'upgrade).
- **Pack de modeles** : templates pre-rediges pour entretiens types AMELI, BMP, trames d'emails, structures de sections demandees par l'assurance.
- **Onboarding** : page d'aide "Comment enregistrer : micro, bruit, duree".
- (Option) **Word Boost** de demarrage avec liste de DCI / termes assurance a charger une fois (sans promettre d'exhaustivite).

**Cote Nico** :

- Lier le flag ASR a **l'entitlement** (table produit, Stripe, `subscription_tier`, etc. — selon votre stack actuelle).
- **Ne pas** dupliquer la logique Speechmatics : un seul `if` "medical actif" qui lit l'entitlement.

**Cote marketing** : textes alignes sur la section 7.

---

### Phase 3 — Bibliotheque, tags automatiques, activation liee

**Objectif** : reduire la charge cognitive utilisateur et aligner "metier" et "moteur".

**Vision** :

1. **Catalogue** de modeles (prompts) par categorie : `medical`, `pharmacie`, `juridique`, etc.  
2. **Tagging** : chaque modele a un ou plusieurs **tags** en BDD (ex. `medical`, `officine`, `ameli`).  
3. **Regle d'orchestration** (ordre de priorite propose plus bas) :  
   - si le job utilise un modele **tag** `medical` **ou** `officine` => ASR `domain: medical` **sauf** si l'utilisateur a desactive l'option (opt-out rare).  
   - sinon : ASR par defaut (comportement actuel).  
4. (Phase 3 bis) **Detection legerre** : si l'utilisateur **dicte** un titre ou choisit un template "generique" mais le **texte** du premier segment contient des marqueurs forts ("mg", "comprime", "ALD", "Serment pharmaceutique"), on peut **suggere** "Passer en mode medical ASR ?" (UI) — plutot qu'automatique pur pour eviter les faux positifs.  
5. (Phase 3 avance) **Petit classifieur** (regex + liste de mots, ou appel LLM leger en debbut de job) : reserve au moment ou le volume de jobs justifie l'effort.

**Interet** : Nico n'a plus a maintenir des listes d'ID de templates en dur (`MEDICAL_TEMPLATE_IDS`); la **verite** est dans la **BDD** des modeles.

---

## 6. Specification technique detaillee pour Nicolas

### 6.1 Principe : une fonction centrale

Centraliser la decision dans une methode reutilisable, par ex. :

```text
boolean shouldUseSpeechmaticsMedicalDomain(JobContext ctx)
```

Entrees possibles (toutes optionnelles selon l'avancement) :

- `username` / `orgId`  
- `user.medicalAsrOverride` (enum : DEFAULT | FORCE_ON | FORCE_OFF)  
- `entitlements.medicalPack` (boolean)  
- `promptModel.tags` (liste)  
- `language` (code ISO)

Sortie : **true** si l'on doit poser `domain: medical` + `operating_point: enhanced`.

---

### 6.2 Schema BDD (proposition minimale, evolutif)

**Option simple (phase 1)** — sur la table compte / utilisateur (adapter au schema reel) :

```sql
-- Exemple (noms a adapter a votre BDD reelle)
ALTER TABLE app_user ADD COLUMN medical_asr_enabled BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN app_user.medical_asr_enabled IS
  'Si true, jobs FR en ASR avec domain=medical (Speechmatics enhanced).';
```

**Option organisation** (si les licences sont a l'officine, pas a l'individu) :

```sql
ALTER TABLE organization ADD COLUMN medical_asr_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

**Option phase 2 — entitlement** :

```sql
-- Exemple
CREATE TABLE user_entitlement (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(120) NOT NULL,
  key           VARCHAR(64)  NOT NULL,  -- e.g. 'medical_pack'
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from    TIMESTAMP,
  valid_until   TIMESTAMP,
  source        VARCHAR(64),          -- 'stripe', 'admin', 'pilot'
  UNIQUE (username, key)
);
```

**Option phase 3 — tags sur modeles** :

```sql
-- Soit table de jointure, soit JSONB si PostgreSQL
CREATE TABLE prompt_model_tag (
  prompt_model_id BIGINT NOT NULL REFERENCES prompt_model(id) ON DELETE CASCADE,
  tag             VARCHAR(64) NOT NULL,  -- 'medical', 'officine', 'legal', ...
  PRIMARY KEY (prompt_model_id, tag)
);
CREATE INDEX idx_prompt_model_tag_tag ON prompt_model_tag (tag);
```

**Opt-out** (utilisateur expert qui ne veut pas le mode medical — rare) :

```sql
ALTER TABLE app_user ADD COLUMN medical_asr_user_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
```

### 6.3 Ordre de priorite (regle d'orchestration recommandee)

De la **plus forte** a la **plus faible** (convention explicite pour eviter les conflits) :

1. **FORCE_OFF** utilisateur (opt-out) => jamais medical, meme si pack achete.  
2. **FORCE_ON** admin / support (debug) => toujours medical (flag temporaire).  
3. **Entitlement** `medical_pack` actif => medical.  
4. **Flag pilote** `medical_asr_enabled` => medical.  
5. **Tag(s)** du `promptModel` : si contient `medical` ou `officine` (liste a figer) => medical.  
6. **Defaut** : comportement actuel (pas de `domain` medical).

Documenter ce tableau dans le wiki interne : **une seule source de verite`.

### 6.4 Points d'integration code (rappel)

- **Fichier cle** (reference Maestro) : `SpeechmaticsAiTranscriptor.java` — methode qui construit le JSON envoye a l'API batch / le flux file d'attente.  
- **Streaming** (agilo-live) : si le live envoie aussi vers Speechmatics, **meme regle** (sinon incoherence transcript live vs final).

### 6.5 Observabilite

- **Log** (niveau INFO) par job : `medicalAsr=true|false`, `reason=entitlement|pilot|tag|default`.  
- **Metrique** (si vous avez deja des stats) : taux d'echec API, duree moyenne de job, comparaison pilote / non-pilote.

### 6.6 Feature flag / deploiement

- Tout le bloc peut etre derriere **une seule** variable d'environnement : `MEDICAL_ASR_ROLLOUT_ENABLED`. Si false, ignorer toute logique (rollback immediat sans redployer la logique metier, si le flag ne fait que court-circuiter).

---

## 7. Marketing, landing page, argumentaire client pharmacien

Cette section sert a **aligner** Nico, le contenu et le commercial. Ce ne sont pas des promesses de conformite (voir section 9).

### 7.1 Promesse de valeur (une phrase)

**"Une transcription qui comprend le langage de l'officine : noms de medicaments, consignes de posologie et termes de la securite sociale, pour des comptes-rendus plus fiables avant meme l'IA."**

### 7.2 Arguments "benefices" (puces pour landing ou page secteur pharmacie)

- Moins d'erreurs sur les **DCI** et les **dosages** au stade de la retranscription.  
- Meilleure reconnaissance des **abreviations** usuelles (dans la limite du moteur).  
- Comptes-rendus plus **fideles** aux entretiens reglementes (entretien pharmaceutique, trames proches des attentes CAISSE / AMELI selon les modeles).  
- **Cumul** avec le **Word Boost** Agilotext pour les noms d'enseigne, de logiciel, de prescripteur.  
- Option pack : **modeles** pre-penses pour **gagner du temps** sur la forme, pas seulement sur le fond.

### 7.3 Elements de confiance (sans sur-vendre)

- Partenariat moteur **Speechmatics** (acteur connu, documentation publique).  
- Processus de validation **pilot** avant bascule large.  
- Rappel : Agilotext **assist** la redaction ; la **validation** reste l'**officine** (responsable professionnelle, conformite a la reglementation locale).

### 7.4 Appels a l'action (CTA) possibles

- "Demander l'acces **pilote** Medical" (B2B, formulaire, sales).  
- "Decouvrir le **pack Officine**" (phase 2, avec tarif).  
- "Voir un **exemple** de compte-rendu type AMELI" (maquette de sortie, sans donnees reelles de patients).

### 7.5 SEO / mots-cles (indicatifs, pas une strategie complete)

- "compte-rendu pharmacien", "entretien pharmaceutique", "retranscription medicamenteuse", "AMELI", "assistant redaction", "transcription DCI" (a valider cote reglementation des annonces sante en France).

---

## 8. Metriques, tests AB, criteres de reussite

| Metrique | Comment | Cible indicatif (pilote) |
|----------|---------|-------------------------|
| Taux d'erreur mots cles (DCI / chiffres) | Echantillon de N audios re-écoutes par un pro interne ou partenaire | Baisse >= 20% vs témoin |
| Temps de correction | Mesure relecture (si outil de feedback) | Baisse |
| Echecs job ASR | Logs API | Pas d'augmentation vs base |
| NPS / satisfaction | Questionnaire fin de pilote | Amelioration tendancielle |
| Revenu (phase 2) | Taux de conversion pack | A definir par la direction |

**Test A/B** (deux groupes) : un groupe "standard/enhanced sans medical", un groupe "enhanced+medical", meme template — **en aveugle** si possible cote relecture.

---

## 9. Conformite, formulation, limites

- Agilotext est un outil d'**aide a la** documentation / redaction, pas un dispositif medical. Les formulations publiques doivent l'**eviter** ("diagnostic", "traitement medical" au sens dispositif). Preferer : *documentation professionnelle*, *compte-rendu d'entretien*, *assistance a la saisie*.  
- **Donnees de sante** : si vous hebergez des comptes-rendu ou transcripts identifies, respecter le cadre applicable (HDS, RGPD, DPA clients). L'ajout d'un mode ASR ne change pas fondamentalement la nature des donnees, mais c'est l'occasion de **rappeler** la politique de confidentialite.  
- **Exhaustivite** : ne jamais promettre 100% de recognition sur toutes les specialites (ni Speechmatics ni Agilotext ne peuvent l'garantir).  
- **Validation humaine** : rester explicite pour les publics sante (pharmacie).

---

## 10. References externes

- Documentation Speechmatics — Langues et **Healthcare transcription** :  
  https://docs.speechmatics.com/speech-to-text/languages#healthcare-transcription  
- Tarification Speechmatics (Standard vs Enhanced) :  
  https://www.speechmatics.com/our-technology/pricing  
- Brief interne — **Infrastructure partagee Chat + CR** :  
  `docs/BRIEF-NICOLAS-Infrastructure-Partagee-Chat-CR.md`

---

## 11. Annexe : regle d'orchestration (pseudo-code)

```text
function shouldUseSpeechmaticsMedical(ctx):
  if not ctx.language in ('fr', 'fr-FR', ...):
    return false
  if ctx.featureFlag('MEDICAL_ASR_ROLLOUT_ENABLED') is false:
    return false
  if ctx.user.medicalAsrUserOptOut:
    return false
  if ctx.user.adminForceMedicalOn:  // temporaire support
    return true
  if ctx.entitlement.active('medical_pack'):
    return true
  if ctx.user.medicalAsrEnabled:     // pilote
    return true
  if ctx.promptModel.hasAnyTag('medical', 'officine', 'pharmacie'):
    return true
  return false

// Lors de la construction transcription_config:
if shouldUseSpeechmaticsMedical(ctx):
  config.operating_point = 'enhanced'
  config.domain = 'medical'
else:
  // comportement actuel (standard ou enhanced seul, selon defaut actuel)
```

---

## 12. Synthese "demandes a Nico" (checklist)

**Court terme (phase 1)**  
- [ ] Verifier compte Speechmatics : `domain: medical` + `fr` disponibles en production.  
- [ ] Point d'integration unique : `SpeechmaticsAiTranscriptor` (et live si applicable).  
- [ ] Champs BDD + migration + lecture dans le service ASR.  
- [ ] Logs + raison d'activation.  
- [ ] (Option) Flag env `MEDICAL_ASR_ROLLOUT_ENABLED`.  
- [ ] Test sur 3 a 5 fichiers audios reels (anonymises).

**Moyen terme (phase 2)**  
- [ ] Lier l'entitlement "pack" au flag (Stripe ou equ.).  
- [ ] Contenu : pas du ressort de Nico seul, mais empaquetage technique des templates si livraison par API.

**Long terme (phase 3)**  
- [ ] Table de tags (ou JSONB) sur `prompt_model`.  
- [ ] Remplacement progressif des listes d'ID en dur par tags.  
- [ ] (Option) UI admin pour tagger les modeles.

---

*Document de travail elargi, avril 2026. A valider en reunion produit (Florian, Nicolas, eventuellement commercial). Prochaine revision apres fin de pilote : chiffres reels et ajustement des priorites pack / tags.*
