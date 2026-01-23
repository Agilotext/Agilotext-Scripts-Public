/**
 * Script pour ajouter les 2 nouvelles tâches dans Notion
 * Utilise l'API REST Notion directement (plus fiable que MCP)
 * 
 * Usage:
 * 1. Récupérer votre token d'intégration Notion: https://www.notion.so/my-integrations
 * 2. Créer un fichier .env avec: NOTION_TOKEN=votre_token
 * 3. Installer les dépendances: npm install @notionhq/client dotenv
 * 4. Exécuter: node add-tasks-notion.js
 */

require('dotenv').config();
const { Client } = require('@notionhq/client');

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '2b0d2ac8f1dd801380f3f552a4c5f5c1'; // ID de la base de données (sans tirets)

if (!NOTION_TOKEN) {
  console.error('❌ Erreur: NOTION_TOKEN manquant dans .env');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

// Mapping des options de sélection
const PRIORITY_OPTIONS = {
  '🔥🔥🔥': '🔥🔥🔥',
  '🟡 IMPORTANT': '🟡 IMPORTANT',
  '🔥🔥': '🔥🔥',
  '🔥': '🔥',
  '⚡': '⚡'
};

const STATUS_OPTIONS = {
  'À faire': 'À faire',
  'En cours': 'En cours',
  'Fait': 'Fait'
};

const TYPE_OPTIONS = {
  'Feature': 'Feature',
  'Bug': 'Bug',
  'Documentation': 'Documentation',
  'Marketing': 'Marketing',
  'Design': 'Design',
  'Organisation': 'Organisation',
  'Sécurité': 'Sécurité',
  'Stratégie': 'Stratégie',
  'Recherche': 'Recherche',
  'Support': 'Support',
  'Légal': 'Légal'
};

const PROJET_OPTIONS = {
  'Agilotext': 'Agilotext'
};

// Fonction pour créer une page dans Notion
async function createTask(task) {
  try {
    // Essayer avec database_id d'abord, puis avec page parent si échec
    const response = await notion.pages.create({
      parent: {
        database_id: DATABASE_ID,
      },
      properties: {
        'Feature': {
          title: [
            {
              text: {
                content: task.feature,
              },
            },
          ],
        },
        'Type': {
          select: {
            name: TYPE_OPTIONS[task.type] || 'Feature',
          },
        },
        'Statut': {
          select: {
            name: STATUS_OPTIONS[task.statut] || 'À faire',
          },
        },
        'Priorité': {
          select: {
            name: PRIORITY_OPTIONS[task.priorite] || '🔥',
          },
        },
        'Projet': {
          select: {
            name: PROJET_OPTIONS[task.projet] || 'Agilotext',
          },
        },
        'Description détaillée': {
          rich_text: [
            {
              text: {
                content: task.description || '',
              },
            },
          ],
        },
        'Notes techniques': {
          rich_text: [
            {
              text: {
                content: task.notes || '',
              },
            },
          ],
        },
      },
    });

    console.log(`✅ Tâche créée: ${task.feature}`);
    console.log(`   URL: ${response.url}\n`);
    return response;
  } catch (error) {
    console.error(`❌ Erreur lors de la création de "${task.feature}":`, error.message);
    if (error.body) {
      console.error('   Détails:', JSON.stringify(error.body, null, 2));
    }
    throw error;
  }
}

// Les 2 nouvelles tâches à ajouter
const nouvellesTaches = [
  {
    feature: 'Bouton Anonymiser compte-rendu dans éditeur',
    type: 'Feature',
    statut: 'À faire',
    priorite: '🔥🔥🔥',
    projet: 'Agilotext',
    description: "Bouton simple 'Anonymiser mon compte-rendu' dans l'onglet compte-rendu de l'éditeur. Le bouton doit apparaître uniquement quand l'onglet compte-rendu est ouvert. Fonctionnalité: anonymiser le compte-rendu en remplaçant les noms et entités sensibles par des placeholders ([NOM], [ENTITÉ], etc.). Respecter la documentation existante sur l'anonymisation. Interface: bouton visible et accessible dans la barre d'outils de l'onglet compte-rendu. UX: simple et clair, avec confirmation avant anonymisation si nécessaire.",
    notes: "Frontend: ajouter bouton dans onglet compte-rendu (onglet #tab-summary). Backend: API pour anonymiser compte-rendu (détection noms/entités + remplacement). Documentation: respecter notes existantes sur anonymisation (voir tâches 'Rajouter Option Anonymiser' et 'Anonymisation automatique des documents PDF'). Interface: bouton visible uniquement sur onglet compte-rendu. Test: anonymisation correcte des noms et entités dans CR.",
  },
  {
    feature: 'Import rapide mots-clés WordBoost (copier-coller)',
    type: 'Feature',
    statut: 'À faire',
    priorite: '🔥🔥🔥',
    projet: 'Agilotext',
    description: "Améliorer l'import de mots-clés WordBoost dans la page 'Mon compte'. Permettre de copier-coller une ligne entière avec mots séparés par virgule (ex: 'mot1, mot2, mot3, mot4'). Parser automatiquement la ligne pour extraire chaque mot et l'ajouter au WordBoost. Gain de temps: au lieu de remplir un par un à la main, l'utilisateur peut copier-coller une liste complète. Interface: champ texte dans page Mon compte avec placeholder 'Collez vos mots séparés par des virgules'. Validation: parser la ligne, nettoyer les espaces, ajouter chaque mot au WordBoost.",
    notes: "Frontend: ajouter champ texte dans page Mon compte (WordBoost section). Parser: split par virgule, trim espaces, filtrer vides. Backend: API pour ajouter plusieurs mots en une fois au WordBoost. Format: 'mot1, mot2, mot3' → ['mot1', 'mot2', 'mot3']. Validation: vérifier format, éviter doublons. Test: copier-coller ligne avec 10+ mots séparés par virgule.",
  },
];

// Fonction principale
async function main() {
  console.log('🚀 Début de l\'ajout des tâches dans Notion...\n');

  for (const task of nouvellesTaches) {
    await createTask(task);
    // Petite pause entre les créations pour éviter les rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('✅ Toutes les tâches ont été ajoutées avec succès !');
}

// Exécution
main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

