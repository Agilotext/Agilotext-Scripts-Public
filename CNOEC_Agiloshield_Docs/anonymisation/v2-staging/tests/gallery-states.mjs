// États de la galerie : chaque entrée ouvre tests/staging-equivalent.html (transport synthétique, aucun appel Java ou Python).
// click : libellé ou aria-label du bouton à actionner après chargement.
export const STATES = [
  { id: 'empty', label: 'Accueil vide', query: '' },
  { id: 'tour', label: 'Guide première visite', query: '', tour: true },
  { id: 'lists', label: 'Listes activées', query: 'lists' },
  { id: 'pseudo', label: 'Pseudonymisation disponible', query: 'pseudo&lists' },
  { id: 'history', label: 'Historique mixte', query: 'history&compareFixtures&failedFixture&lists&pseudo&pseudoFixture' },
  { id: 'failed', label: 'Erreur de traitement', query: 'history&failedFixture' },
  { id: 'review-dense', label: 'Revue texte 370 passages', query: 'history&denseReview', open: true },
  { id: 'review-pdf', label: 'Revue PDF, passages à placer', query: 'history&manualFixture', open: true },
  { id: 'ready-open', label: 'Document prêt ouvert', query: 'history&compareFixtures', open: true },
  { id: 'no-account', label: 'Session absente', query: 'noAccount' },
  { id: 'modal-types', label: 'Fenêtre Données à masquer', query: '', click: /Données à masquer/ },
  { id: 'modal-lists', label: 'Fenêtre Listes', query: 'lists', click: /^Listes/ },
  { id: 'tab-text', label: 'Onglet texte', query: '', click: /Traitement de texte|^Texte/ },
];

// Reproduit le contexte Webflow : police Poppins et variables Base du site.
export const WEBFLOW_SHIM = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
:root{--color--blue:#174a96;--color--orange:#fd7e14;--color--gris:#525252;--color--gris_foncé:#020202;
--color--blanc_gris:#f8f9fa;--color--white:white;--color--vert:#1c661a;--color--rouge:#a82633;--0-5_radius:.5rem}
body{font-family:Poppins,sans-serif;background:#f8f9fa!important}`;
