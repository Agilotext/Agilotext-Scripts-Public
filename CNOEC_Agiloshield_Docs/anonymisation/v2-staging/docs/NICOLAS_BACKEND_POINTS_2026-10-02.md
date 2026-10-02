# AgiloShield V2 — points backend à vérifier avec Nicolas

Date : 2026-10-02

## 1. Pseudonymisation : le front n'est pas censé la désactiver si Java 12.0.6 est réellement servi

Le front active le mode Pseudonymiser seulement si `GET /preferences` annonce simultanément :

```json
{
  "processingModes": ["ANONYMIZE", "PSEUDONYMIZE"],
  "pseudonymKeyDownload": true
}
```

Le code source Java examiné sur `kawansoft/AgiloTextApi`, branche `12.0.6`, commit :

```text
0e0439932e84910c28da057c984e6b1a6b31bd83
```

annonce bien ces deux capacités dans `AnonEditorService.capabilities()`.

Le même service :
- accepte `PSEUDONYMIZE` dans `MODES` ;
- applique `holder.setDoPseudoAnon("PSEUDONYMIZE".equals(mode))` ;
- `FullPython2Bridge` sérialise ensuite `processingMode` dans le fichier `.options` ;
- expose le téléchargement de clé de pseudonymisation.

### Vérification recette demandée

Avec un vrai compte connecté :

1. relever la réponse exacte de `GET /api/agiloshield-v2/preferences` ;
2. confirmer `processingModes` et `pseudonymKeyDownload` ;
3. créer un petit job avec `processingMode=PSEUDONYMIZE` ;
4. confirmer que la réponse de création renvoie `processingMode=PSEUDONYMIZE` ;
5. vérifier le `.options` correspondant côté worker ;
6. une fois le résultat produit, tester la route de clé.

Si l'étape 1 n'annonce pas les capacités ci-dessus, la recette ne sert pas le code Java 12.0.6 attendu (ou pas la classe/route attendue). Le front ne doit pas contourner ce problème en forçant le mode.

## 2. « Valider » : le blocage actuel vient volontairement du moteur

Dans `WEB-INF/python_2/agiloshield/semantic_review.py`, la validation humaine est refusée notamment en présence de :

```text
artifact_inconsistent
not_result
status_not_approvable
known_leak_or_missing_transform
unresolved_mask
remaining_review
no_artifact
failed_artifact
```

Le Java vérifie ensuite `canApproveHumanVerification` et renvoie `HUMAN_VERIFICATION_NOT_ALLOWED` si le moteur refuse.

C'est donc incorrect pour le front de prétendre qu'un document est validé lorsque ces garde-fous refusent l'attestation.

### Amélioration produit sûre

Le front du 02/10 :
- supprime le message incompréhensible « Actualisez la revue » ;
- recharge silencieusement l'état avant validation ;
- dirige vers les décisions restantes ou zones à placer ;
- n'affiche plus les codes QA/support à l'utilisateur.

Si l'objectif produit est un parcours plus court, ne pas supprimer globalement les blockers.

Option recommandée à discuter :
- ajouter une opération batch explicite permettant à l'utilisateur de choisir **« Masquer tous les passages encore à confirmer »** ;
- l'utilisateur confirme explicitement cette décision ;
- le worker crée une nouvelle révision et repasse la QA ;
- l'attestation humaine n'est proposée qu'ensuite.

Ne jamais transformer silencieusement `REVIEW` en `MASK`.
