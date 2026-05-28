# Agiloshield Claude Agent Skill

Skill téléchargeable pour **Claude Desktop / Claude Code** — pseudonymisation automatique des fichiers locaux via l'API Anon2 Agilotext (même backend que agiloshield.com).

## Structure

```
Agiloshield-Skill/
├── agiloshield-skill/          # Source du skill (ZIP)
│   ├── SKILL.md
│   ├── README.md
│   └── scripts/
│       ├── agiloshield.py
│       └── config.py           # template — rempli par build.py
├── build.py                    # Génère le .skill par utilisateur
├── docs/GUIDE_FABIENNE_SKILL.html
└── NOTES_DISTRIBUTION.md
```

## Générer un skill utilisateur

```bash
python3 build.py \
  --user fabienne.hanras@eurallia.fr \
  --password "mot_de_passe" \
  --profile ma \
  --output dist/agiloshield-ma-fabienne.skill
```

## Test local

```bash
python3 agiloshield-skill/scripts/agiloshield.py settings
python3 agiloshield-skill/scripts/agiloshield.py pseudonymize "/chemin/vers/bilan.pdf"
```

## Différence avec le MCP

| | Skill Claude | MCP local |
|---|-------------|-----------|
| Installation | Upload ZIP dans Claude | Node.js + config JSON |
| Cible | Fabienne, utilisateurs Claude | Cursor, devs |
| Backend | api.agilotext.com | api.agilotext.com |

Voir [NOTES_DISTRIBUTION.md](NOTES_DISTRIBUTION.md) et [docs/GUIDE_FABIENNE_SKILL.html](docs/GUIDE_FABIENNE_SKILL.html).
