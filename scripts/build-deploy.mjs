// Assembles a deployable static bundle for one of the project's frontends.
// Usage: node scripts/build-deploy.mjs <nerv|loq>
import { cp, mkdir, rm, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const targets = {
  nerv: { outDir: 'dist/nerv-deck' },
  loq: { outDir: 'dist/loq-link' },
};

// Shared static files used by both frontends.
const files = [
  'index.html',
  'audio.html',
  'clock.html',
  'connect.html',
  'loq.html',
  'race.html',
  'visualiser.html',
  'app.js',
  'styles.css',
  'race-calendars.json',
];

// Optional directories copied when present.
const optionalDirs = ['assets'];

const exists = (p) => access(p).then(() => true, () => false);

const name = process.argv[2];
const target = targets[name];
if (!target) {
  console.error(`Unknown target "${name ?? ''}". Expected one of: ${Object.keys(targets).join(', ')}`);
  process.exit(1);
}

const outDir = join(root, target.outDir);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const missing = [];
for (const file of files) {
  const src = join(root, file);
  if (!(await exists(src))) {
    missing.push(file);
    continue;
  }
  await cp(src, join(outDir, file));
}

if (missing.length) {
  console.error(`Missing required files: ${missing.join(', ')}`);
  process.exit(1);
}

for (const dir of optionalDirs) {
  const src = join(root, dir);
  if (await exists(src)) {
    await cp(src, join(outDir, dir), { recursive: true });
  } else {
    console.warn(`Optional directory "${dir}" not found; skipping.`);
  }
}

console.log(`Built "${name}" into ${target.outDir}`);
