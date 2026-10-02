// Every user-facing AgiloShield V2 string that depends on a server state or code.
// Raw server codes are never shown; unknown codes fall back to a generic sentence.

export const plural = (count, one, many) => count + ' ' + (count > 1 ? many : one);

export const COPY = Object.freeze({
  brand: 'AgiloShield', testBadge: 'Version en test',
  heading: 'Protégez vos documents avant de les utiliser avec l’IA',
  intro: 'Choisissez les données à masquer, déposez vos fichiers et vérifiez chaque résultat.',
  historySession: 'Documents de cette session', historyDurable: 'Mes documents',
  historyOld: 'Documents de l’ancienne version',
  historySessionOnly: 'Cette liste couvre votre session en cours. Téléchargez vos résultats avant de fermer la page.',
  historyServer: 'Retrouvez les documents accessibles à votre compte.',
  status: {
    LOCAL: 'À envoyer', UPLOADING: 'Envoi', PENDING: 'En attente',
    PROCESSING: 'En cours', READY: 'Prêt', REVIEW_REQUIRED: 'À vérifier',
    FAILED: 'Erreur', AUTH_REQUIRED: 'Connexion requise', TIMED_OUT: 'Suivi interrompu',
    UNCERTAIN: 'À confirmer', ERROR: 'Erreur',
  },
  reviewAction: { KEEP: 'Laisser visible', MASK: 'Masquer' },
  issueReason: {
    FIRST_ROW_PER_REVIEW: 'La première ligne demande une vérification.',
    LIST_EXCLUSION_REVIEW: 'Une de vos listes demande de laisser visible un passage à masquer.',
    LIST_INCLUSION_UNLOCATED: 'Un passage de votre liste n’a pas été retrouvé avec certitude.',
  },
  review: {
    toPlace: n => plural(n, 'passage à placer sur le document', 'passages à placer sur le document'),
    toCheck: n => plural(n, 'passage à vérifier', 'passages à vérifier'),
    toCheckOnPage: (n, page) => plural(n, 'passage à vérifier', 'passages à vérifier') + ' sur la page ' + page,
    found: n => plural(n, 'passage repéré', 'passages repérés'),
    decisions: n => plural(n, 'décision à prendre', 'décisions à prendre'),
    listConflicts: n => plural(n, 'conflit de listes', 'conflits de listes'),
    moreGroups: n => plural(n, 'groupe restant', 'groupes restants'),
    targetInstruction: 'Tracez un rectangle autour du passage sélectionné.',
    zoneInstruction: 'Tracez un rectangle sur le document pour masquer cette zone.',
    regionUnknown: 'L’emplacement exact de ce passage n’est pas connu sur cet aperçu.',
    progress: (done, total) => done + ' sur ' + total + ' vérifié' + (total > 1 ? 's' : ''),
    validate: 'Valider ce document',
    othersMasked: 'Autres données masquées',
    safetyLine: 'Vous validez le document après avoir vérifié chaque passage.',
    shortcuts: 'J suivant · K précédent · M masquer · V laisser visible · ⌘Z annuler · Échap fermer',
    readyToValidate: 'Document prêt à valider',
  },
  errors: {
    generic: 'Un problème est survenu.',
    failed: 'Le document n’a pas pu être traité. Retirez-le puis réessayez.',
    reviewStale: 'Le document a changé, relancez la vérification.',
    previewStale: 'L’aperçu n’est plus à jour. Rouvrez le document.',
    approvalStale: 'Le document a changé depuis votre validation. Vérifiez-le à nouveau.',
    wordTimeout: 'L’aperçu Word met trop de temps à s’afficher. Téléchargez le fichier pour le consulter.',
  },
});

const SERVER_ERRORS = Object.freeze({
  PSEUDO_KEY_INVALID: 'La pseudonymisation de ce fichier a échoué. Réessayez ou choisissez Anonymiser.',
  PSEUDONYM_KEY_INVALID: 'La pseudonymisation de ce fichier a échoué. Réessayez ou choisissez Anonymiser.',
  AUTH_REQUIRED: 'Votre session a expiré. Reconnectez-vous, puis reprenez.',
  TOKEN_EXPIRED: 'Votre session a expiré. Reconnectez-vous, puis reprenez.',
  QUOTA_EXCEEDED: 'Vous avez atteint la limite de documents de votre offre.',
  QUOTA_REACHED: 'Vous avez atteint la limite de documents de votre offre.',
  FILE_TOO_LARGE: 'Ce fichier dépasse la taille autorisée.',
  UNSUPPORTED_FORMAT: 'Ce format n’est pas pris en charge. Utilisez PDF, Word, Excel, PowerPoint, TXT ou CSV.',
  UNSUPPORTED: 'Ce format n’est pas pris en charge. Utilisez PDF, Word, Excel, PowerPoint, TXT ou CSV.',
  ENCRYPTED_FILE: 'Ce fichier est protégé par un mot de passe. Retirez la protection puis réessayez.',
  PASSWORD_PROTECTED: 'Ce fichier est protégé par un mot de passe. Retirez la protection puis réessayez.',
  EMPTY_FILE: 'Ce fichier est vide.',
  CORRUPTED_FILE: 'Ce fichier semble endommagé. Ouvrez-le puis enregistrez-le à nouveau.',
  OCR_REQUIRED: 'Ce PDF est une image scannée sans texte. Il ne peut pas encore être protégé.',
  COMMAND_INVALID: 'Le masquage n’a pas pu être appliqué. Le document n’a pas changé. Réessayez.',
  JOB_FORBIDDEN: 'Vous n’avez pas accès à ce document.',
  ENGINE_FAILED: 'Le document n’a pas pu être traité. Retirez-le puis réessayez.',
  ENGINE_TIMEOUT: 'Le traitement a pris trop de temps. Réessayez avec un fichier plus petit.',
});

const errorCodeOf = job => {
  if (!job) return null;
  const candidates = [job.errorCode, job.error?.code, job.code, job.error, job.errorMessage, job.message, job.reason];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const code = value.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/)?.[0];
    if (code) return code;
  }
  return null;
};

export function jobErrorMessage(job) {
  const code = errorCodeOf(job);
  return (code && SERVER_ERRORS[code]) || COPY.errors.failed;
}

export const LOCAL_MESSAGES = new Set(Object.values(COPY.errors));
