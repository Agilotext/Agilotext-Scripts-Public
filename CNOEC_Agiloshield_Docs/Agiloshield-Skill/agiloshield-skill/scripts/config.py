"""Configuration Agiloshield — remplie par build.py pour chaque utilisateur."""

API_BASE = "https://api.agilotext.com/api/v1"

# Identifiants — priorité : AUTOMATION_TOKEN > USE_GET_TOKEN > TOKEN > PASSWORD
USERNAME = "votre.email@exemple.com"
USE_GET_TOKEN = False  # True si le compte est autorisé en headless sur GET /getToken
AUTOMATION_TOKEN = ""  # auto_xxx (Mon compte → Intégrations → Générer ma clé)
TOKEN = ""
PASSWORD = ""
EDITION = "ent"  # free | pro | ent (getToken n'accepte pas agiloshield)

# Profil métier
PROFILE = "ma"  # ma | legal | hr | health | developer | custom
ENTITY_TYPES = ["PER", "ORG", "ADR", "IDN"]
MODE = "pseudonymize"  # pseudonymize | anonymize

# Répertoire de sortie (vide = .agiloshield/ à côté du fichier source)
OUTPUT_DIR = ""

# Timeout polling (secondes)
POLL_TIMEOUT_SECONDS = 300
