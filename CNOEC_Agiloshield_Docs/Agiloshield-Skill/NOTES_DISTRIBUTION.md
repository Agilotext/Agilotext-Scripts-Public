# Notes distribution — Agiloshield Claude Skill

## Décision API (alignée MCP v1.3)

| Point | Décision | Détail |
|-------|----------|--------|
| `setAnon2UserDefaults` | **Oui, avant chaque upload** | Même logique que `withAnon2DefaultsLock` dans le MCP : sauvegarde des defaults serveur, application du profil skill, restauration en `finally`. |
| Authentification | **AUTOMATION_TOKEN > TOKEN > PASSWORD** | Clé `auto_*` (pattern Make/Zapier) recommandée — longue durée, générée depuis Mon compte → Intégrations. Nécessite extension backend Anon2 (Nicolas). |
| Types par profil | **Profil `ma` par défaut** | PER, ORG, ADR, IDN — masque identité, conserve dates et montants. |
| Endpoint API | `https://api.agilotext.com/api/v1` | Hébergement France, même backend que agiloshield.com. |

## Différence webapp vs skill

- **agiloshield.com** : interface manuelle drag & drop (Fabienne l'a testée en avril en mode anonymisation).
- **Ce skill** : intégration **Claude Desktop / Claude Code** — pseudonymisation automatique avant que Claude lise un fichier local.

## Génération d'un skill utilisateur

**Recommandé** — clé automation (longue durée, pattern Make/Zapier) :

```bash
cd Agiloshield-Skill
python3 build.py \
  --user fabienne.hanras@eurallia.fr \
  --automation-token "auto_xxxxxxxx" \
  --profile ma \
  --output dist/agiloshield-ma-fabienne.skill
```

La clé `auto_*` se génère depuis **Mon compte → Automatisations → Générer ma clé** (même flux que Make/Zapier).

Alternatives (dev / fallback) :

```bash
# Mot de passe application (POST /getAuthToken)
python3 build.py \
  --user fabienne.hanras@eurallia.fr \
  --password "xxx" \
  --profile ma

# Token session web (courte durée — déconseillé pour distribution)
python3 build.py \
  --user fabienne.hanras@eurallia.fr \
  --token "v2.xxxxx" \
  --profile ma
```

## Installation côté utilisateur

1. Claude Desktop → Settings → Capabilities → Skills → Upload
2. Sélectionner le fichier `.skill` (ZIP)
3. Redémarrer Claude si demandé
4. Mentionner un bilan : Claude pseudonymise avant analyse

## Sécurité

- Le fichier `.properties` (clé de restauration) ne doit **jamais** être lu par Claude.
- Le skill embarque les credentials dans `config.py` — distribuer uniquement par canal sécurisé (email chiffré, lien privé).
- Phase 2 : page web Agiloshield « Télécharger mon skill » avec génération côté serveur après login Memberstack (Nicolas).

## Dépendance backend (Nicolas)

Les endpoints Anon2 doivent accepter `automationToken` en alternative à `token` — voir `Agilotext-MCP/docs/GUIDE_NICOLAS_MCP.md` §10.
