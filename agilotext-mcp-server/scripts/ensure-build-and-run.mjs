#!/usr/bin/env node
/**
 * Point d’entrée MCP recommandé pour Cursor : compile si dist/ est absent, puis lance le serveur.
 * Évite MODULE_NOT_FOUND sur dist/index.js après clone ou sans npm run build.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(root, 'dist', 'index.js');

function runBuild() {
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

if (!fs.existsSync(distIndex)) {
  console.error('[agilotext-mcp] dist/index.js introuvable — exécution de npm run build…');
  runBuild();
}

if (!fs.existsSync(distIndex)) {
  console.error('[agilotext-mcp] Échec : dist/index.js toujours absent après build.');
  process.exit(1);
}

const child = spawnSync(process.execPath, [distIndex, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(child.status ?? 1);
