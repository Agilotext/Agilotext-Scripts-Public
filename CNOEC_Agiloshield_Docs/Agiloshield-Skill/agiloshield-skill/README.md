# agiloshield-anonymizer skill

Claude Agent Skill qui pseudonymise les fichiers locaux via **Agiloshield** (API Anon2 Agilotext) avant que Claude ne lise leur contenu.

## Contenu du bundle

| Fichier | Rôle |
|---------|------|
| `SKILL.md` | Instructions Claude — priorité absolue sur lecture fichier |
| `scripts/agiloshield.py` | Client Python stdlib-only |
| `scripts/config.py` | Credentials + profil M&A embarqués |

Aucune dépendance pip — Python 3.8+ suffit.

## Installation

1. Claude Desktop ou Claude Code → **Settings → Capabilities → Skills**
2. **Upload** le fichier `.skill` (ZIP)
3. Redémarrer Claude si nécessaire

## Usage manuel (test)

```bash
python3 ./scripts/agiloshield.py settings
python3 ./scripts/agiloshield.py pseudonymize "/chemin/vers/bilan.pdf"
python3 ./scripts/agiloshield.py restore "./.agiloshield/outputs/bilan.pseudonymized.pdf" --properties "./.agiloshield/keys/bilan.properties"
```

## Profils disponibles (build.py)

| Profil | Types | Usage |
|--------|-------|-------|
| `ma` | PER, ORG, ADR, IDN | Bilans M&A — défaut Fabienne |
| `legal` | + EML, TEL | Contrats |
| `hr` | + IBA, JOB | RH |
| `health` | + PII, DAT | Santé |

## Génération

Voir `../build.py` et `../NOTES_DISTRIBUTION.md`.
