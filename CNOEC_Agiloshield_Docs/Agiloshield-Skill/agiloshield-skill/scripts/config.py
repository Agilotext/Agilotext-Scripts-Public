"""Configuration Agiloshield — remplie par build.py pour chaque utilisateur."""

API_BASE = "https://api.agilotext.com/api/v1"

# Identifiants — priorité : SKILL_TOKEN > AUTOMATION_TOKEN > USE_GET_TOKEN > TOKEN > PASSWORD
USERNAME = "votre.email@exemple.com"
SKILL_TOKEN = ""  # skill_xxx (généré automatiquement au téléchargement)
USE_GET_TOKEN = False  # True si le compte est autorisé en headless sur GET /getToken
AUTOMATION_TOKEN = ""  # auto_xxx (Mon compte → Intégrations → Générer ma clé)
TOKEN = ""
PASSWORD = ""
EDITION = "agiloshield"  # édition API Agiloshield (distincte de free/pro/ent)

# Profil métier
PROFILE = "ma"  # ma | legal | hr | health | developer | custom
ENTITY_TYPES = ["PER", "ORG", "ADR", "IDN"]
MODE = "pseudonymize"  # pseudonymize | anonymize

# Répertoire de sortie (vide = .agiloshield/ à côté du fichier source)
OUTPUT_DIR = ""

# Timeout polling (secondes)
POLL_TIMEOUT_SECONDS = 300
