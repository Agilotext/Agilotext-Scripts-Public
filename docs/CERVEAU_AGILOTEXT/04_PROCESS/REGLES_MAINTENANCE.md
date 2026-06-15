# Règles de maintenance — Cerveau Agilotext

1. **Nouveau script** → ligne dans `01_SCRIPTS/INDEX_*.md` + `FEATURES_TRACKING.md` si éditeur
2. **Fix bug** → fiche `03_BUGS_ET_FIXES/YYYY-MM-slug.md` (symptôme, cause, fichiers, statut)
3. **Demande backend Nicolas** → section `02_BACKEND/` + mail référencé
4. **Déploiement prod** → hash commit + pages Webflow dans `04_PROCESS/WEBFLOW_DEPLOIEMENT.md`
5. **Ne pas** laisser la connaissance uniquement dans `Clients/` — ce dossier est la source de vérité technique
6. **Ne pas modifier** le fichier plan Cursor — mettre à jour le cerveau à la place

## Workflow commit

```bash
cd Agilotext-Scripts-Public
# 1. Modifier scripts + cerveau
# 2. git add scripts/ docs/CERVEAU_AGILOTEXT/
# 3. git commit -m "..."
# 4. git push origin 1.09
# 5. Vérifier jsDelivr 200 sur URLs
# 6. Mettre à jour embeds Webflow
```
