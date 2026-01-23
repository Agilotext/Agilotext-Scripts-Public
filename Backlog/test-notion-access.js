/**
 * Script de test pour vérifier l'accès à la base Notion
 */
require('dotenv').config();
const { Client } = require('@notionhq/client');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '2b0d2ac8f1dd801380f3f552a4c5f5c1';

if (!NOTION_TOKEN) {
  console.error('❌ Erreur: NOTION_TOKEN manquant');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function testAccess() {
  console.log('🔍 Test d\'accès à la base Notion...\n');
  console.log(`Token: ${NOTION_TOKEN.substring(0, 20)}...`);
  console.log(`Database ID: ${DATABASE_ID}\n`);

  try {
    // Test 1: Récupérer les infos de la base
    console.log('📋 Test 1: Récupération des infos de la base...');
    const database = await notion.databases.retrieve({ database_id: DATABASE_ID });
    console.log('✅ Accès à la base réussi !');
    console.log(`   Titre: ${database.title[0]?.plain_text || 'N/A'}\n`);

    // Test 2: Lister les pages existantes
    console.log('📋 Test 2: Liste des pages existantes...');
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 5,
    });
    console.log(`✅ ${response.results.length} page(s) trouvée(s)\n`);

    console.log('✅ Tous les tests sont passés ! L\'intégration a bien accès à la base.\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 'object_not_found') {
      console.error('\n💡 Solution:');
      console.error('   1. Ouvrez votre base Notion');
      console.error('   2. Cliquez sur "..." en haut à droite');
      console.error('   3. Allez dans "Connexions" ou "Add connections"');
      console.error('   4. Ajoutez votre intégration "Cursor"');
      console.error('\n   URL de la base:', `https://www.notion.so/${DATABASE_ID}`);
    }
    return false;
  }
}

testAccess();




