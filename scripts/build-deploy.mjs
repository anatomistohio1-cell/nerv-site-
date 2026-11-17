#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const target = (process.argv[2] || 'nerv').toLowerCase();

function copyRecursive(src, dest) {
  if (!existsSync(src)) return false;
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(join(src, entry), join(dest, entry));
    }
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  return true;
}

function buildNervDeck() {
  const outDir = join(rootDir, 'dist', 'nerv-deck');
  console.log(`[build:nerv] Building NERV Deck to ${outDir}...`);

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const filesToCopy = [
    'index.html',
    'clock.html',
    'race.html',
    'audio.html',
    'connect.html',
    'visualiser.html',
    'loq.html',
    '404.html',
    'styles.css',
    'app.js',
    'race-calendars.json',
    '_redirects',
  ];

  let copiedCount = 0;
  for (const file of filesToCopy) {
    const srcPath = join(rootDir, file);
    const destPath = join(outDir, file);
    if (existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      copiedCount++;
    }
  }

  // Copy any additional .html files that might exist
  for (const entry of readdirSync(rootDir)) {
    if (entry.endsWith('.html') && !filesToCopy.includes(entry)) {
      copyRecursive(join(rootDir, entry), join(outDir, entry));
      copiedCount++;
    }
  }

  // Copy assets folder if present
  const assetsDir = join(rootDir, 'assets');
  if (existsSync(assetsDir)) {
    copyRecursive(assetsDir, join(outDir, 'assets'));
    console.log('[build:nerv] Copied assets directory.');
  }

  console.log(`[build:nerv] Completed: ${copiedCount} files copied to dist/nerv-deck.`);
}

function buildLoqLink() {
  const outDir = join(rootDir, 'dist', 'loq-link');
  console.log(`[build:loq] Building LOQ Link to ${outDir}...`);

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  // In LOQ Link, loq.html serves as the primary entry point (index.html)
  const loqHtmlPath = join(rootDir, 'loq.html');
  if (existsSync(loqHtmlPath)) {
    copyRecursive(loqHtmlPath, join(outDir, 'index.html'));
    copyRecursive(loqHtmlPath, join(outDir, 'loq.html'));
  }

  const filesToCopy = [
    'connect.html',
    'audio.html',
    '404.html',
    'styles.css',
    'app.js',
    '_redirects',
  ];

  let copiedCount = 2; // index.html and loq.html
  for (const file of filesToCopy) {
    const srcPath = join(rootDir, file);
    const destPath = join(outDir, file);
    if (existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      copiedCount++;
    }
  }

  const assetsDir = join(rootDir, 'assets');
  if (existsSync(assetsDir)) {
    copyRecursive(assetsDir, join(outDir, 'assets'));
    console.log('[build:loq] Copied assets directory.');
  }

  console.log(`[build:loq] Completed: ${copiedCount} files copied to dist/loq-link.`);
}

switch (target) {
  case 'nerv':
    buildNervDeck();
    break;
  case 'loq':
    buildLoqLink();
    break;
  case 'all':
    buildNervDeck();
    buildLoqLink();
    break;
  default:
    console.warn(`[build] Unknown target "${target}". Defaulting to "nerv".`);
    buildNervDeck();
    break;
}
