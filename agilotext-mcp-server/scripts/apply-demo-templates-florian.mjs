/**
 * Renomme et met à jour les 3 prompts utilisateur du compte florian.bauer@agilotext.com (ent).
 * Définit « Réunion » comme modèle par défaut.
 * Complément : `setup-demo-wordboost-florian.mjs` (Word Boost « Démo vidéo »).
 *
 * API : updatePromptModelUser attend promptName + promptContent (url-encoded).
 * renamePromptModel attend promptName (pas newName).
 *
 * Usage : depuis agilotext-mcp-server/
 *   node scripts/apply-demo-templates-florian.mjs
 */
import dotenv from "dotenv";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const baseURL = (process.env.AGILOTEXT_API_URL || "https://api.agilotext.com/api/v1").replace(/\/$/, "");
const username = "florian.bauer@agilotext.com";
const edition = "ent";

function pickPassword() {
  const p = process.env.AGILOTEXT_PASSWORD;
  const a = process.env.AGILOTEXT_APP_PASSWORD;
  const ad = process.env.AGILOTEXT_ADMIN_PASSWORD;
  if (p && String(p).length > 0) return String(p);
  if (a && String(a).length > 0) return String(a);
  if (ad && String(ad).length > 0) return String(ad);
  return undefined;
}

/** Bloc commun imposant le livrable HTML (éditeur / export Agilotext). */
const FORMAT_HTML_OBLIGATOIRE = `
### Format de sortie (obligatoire — non négociable)

Le **compte rendu livré au lecteur** doit être **100 % en HTML** : aucune sortie Markdown (pas de \`#\`, \`**\`, listes \`-\`, ni blocs de code \`\`\`), aucun document « texte brut » sans balises pour la structure.

Exigences :
- Structure avec balises sémantiques : au minimum \`<article>\`, sections avec \`<h2>\` pour les titres principaux et \`<h3>\` si besoin, paragraphes \`<p>\`, listes \`<ul>\` / \`<ol>\` avec \`<li>\`.
- Tableaux \`<table>\` avec \`<thead>\` / \`<tbody>\` lorsque tu présentes des actions, jalons ou comparatifs.
- Mise en avant ponctuelle : \`<strong>\` / \`<em>\` (pas de Markdown).
- Ne précède pas le HTML par du Markdown ni ne termine par une phrase du type « voici le HTML » ; commence directement par la première balise HTML utile (ex. \`<article>\`).
`;

const CONTENT_REUNION = `\`\`\`
Tu es un assistant qui rédige des comptes-rendus de réunion pour des équipes professionnelles.

À partir de la transcription fournie, rédige le contenu en français dans une structure logique avec au minimum les rubriques suivantes (titres en \`<h2>\`) :

1. Contexte — objectif de la réunion (quelques paragraphes ou liste courte).
2. Points discutés — thèmes structurés (listes à puces ou sous-sections \`<h3>\`).
3. Décisions — ce qui a été tranché ; préciser si quelque chose reste ambigu dans le transcript.
4. Actions et suivis — préférer un tableau HTML (\`<table>\`) avec colonnes Action / Responsable / Échéance lorsque l’information est disponible.
5. Risques ou vigilance — uniquement si évoqués dans l’audio.
6. Prochaine étape — si déductible du transcript.

${FORMAT_HTML_OBLIGATOIRE}

Règles de fond : style concis et fidèle ; **n’invente aucun fait** absent du transcript ; orthographe des noms comme dans la transcription.
\`\`\`
`;

const CONTENT_CAP = `\`\`\`
Tu es un commercial expérimenté qui synthétise des échanges clients au format **CAP** (Caractéristiques, Avantages, Preuves).

À partir de la transcription, produis un document unique avec titres \`<h2>\` couvrant :

1. Synthèse du besoin exprimé par le client.
2. Propositions / offres — pour chaque proposition pertinente, sous-structure CAP avec sous-titres \`<h3>\` ou définitions listées : Caractéristiques, Avantages, Preuves (uniquement à partir de ce qui est dit dans l’audio).
3. Objections ou freins et réponses données.
4. Décisions et suites — attentes par partie, prochains rendez-vous ou délais cités.

${FORMAT_HTML_OBLIGATOIRE}

Ne rajoute pas de chiffres ou d’engagements qui ne figurent pas dans la transcription.
\`\`\`
`;

const CONTENT_RH = `\`\`\`
Tu es un responsable RH ou consultant RH qui rédige des comptes rendus d’entretiens individuels à partir de transcriptions audio.

À partir de la transcription fournie, produis un compte rendu structuré en français avec des titres \`<h2>\` couvrant au minimum :

1. Contexte et objectif de l’entretien (type d’entretien si identifiable).
2. Synthèse du parcours ou du profil tel que présenté pendant l’échange.
3. Points forts et axes de développement (tableau HTML ou listes à puces selon ce qui est pertinent).
4. Motivations, attentes, besoins exprimés.
5. Décisions ou suites prévues (embauche, formation, suivi, etc.) uniquement si citées.
6. Risques ou points de vigilance RH si évoqués.

${FORMAT_HTML_OBLIGATOIRE}

Règles : fidélité au transcript ; aucune invention ; vocabulaire professionnel neutre et respectueux.
\`\`\`
`;

async function getToken() {
  const password = pickPassword();
  if (!password) throw new Error("Mot de passe manquant (.env)");
  const body = new URLSearchParams({ username, password, edition });
  const { data } = await axios.post(`${baseURL}/getAuthToken`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!data || data.status !== "OK" || !data.token) throw new Error(data?.errorMessage || "getAuthToken KO");
  return data.token;
}

async function postForm(endpoint, fields) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });
  const { data } = await axios.post(`${baseURL}${endpoint}`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
  });
  return data;
}

async function main() {
  const token = await getToken();
  console.error("Token OK (longueur:", String(token).length + ")");

  const up390 = await postForm("/updatePromptModelUser", {
    username,
    token,
    edition,
    promptId: "390",
    promptName: "Réunion",
    promptContent: CONTENT_REUNION,
  });
  if (up390.status !== "OK") {
    console.error("update 390 KO:", JSON.stringify(up390));
    process.exit(1);
  }
  console.error("→ 390 Réunion : OK");

  const up393 = await postForm("/updatePromptModelUser", {
    username,
    token,
    edition,
    promptId: "393",
    promptName: "Commercial CAP",
    promptContent: CONTENT_CAP,
  });
  if (up393.status !== "OK") {
    console.error("update 393 KO:", JSON.stringify(up393));
    process.exit(1);
  }
  console.error("→ 393 Commercial CAP : OK");

  const up394 = await postForm("/updatePromptModelUser", {
    username,
    token,
    edition,
    promptId: "394",
    promptName: "RH — Entretien",
    promptContent: CONTENT_RH,
  });
  if (up394.status !== "OK") {
    console.error("update 394 KO:", JSON.stringify(up394));
    process.exit(1);
  }
  console.error("→ 394 RH — Entretien : OK (HTML obligatoire)");

  const rDef = await postForm("/setPromptModelUserDefault", {
    username,
    token,
    edition,
    promptId: "390",
  });
  if (rDef.status !== "OK") {
    console.error("setDefault KO:", JSON.stringify(rDef));
    process.exit(1);
  }
  console.error("\nDéfaut utilisateur → Réunion (390)");

  const qs = new URLSearchParams({ username, token, edition }).toString();
  const { data: finalList } = await axios.get(`${baseURL}/getPromptModelsUserInfo?${qs}`);
  console.log(JSON.stringify(finalList, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
