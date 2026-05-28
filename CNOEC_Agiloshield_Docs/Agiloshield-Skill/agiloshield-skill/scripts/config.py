"""Configuration Agiloshield — remplie par build.py pour chaque utilisateur."""

API_BASE = "https://api.agilotext.com/api/v1"

# Identifiants — priorité : AUTOMATION_TOKEN > TOKEN > PASSWORD
USERNAME = "votre.email@exemple.com"
AUTOMATION_TOKEN = ""  # auto_xxx (Mon compte → Intégrations → Générer ma clé)
TOKEN = ""
PASSWORD = ""
EDITION = "ent"  # free | pro | ent

# Profil métier
PROFILE = "ma"  # ma | legal | hr | health | developer | custom
ENTITY_TYPES = ["PER", "ORG", "ADR", "IDN"]
MODE = "pseudonymize"  # pseudonymize | anonymize

# Répertoire de sortie (vide = .agiloshield/ à côté du fichier source)
OUTPUT_DIR = ""

# Timeout polling (secondes)
POLL_TIMEOUT_SECONDS = 300
