// Solmar Bay — a gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, three.js vendored under game/vendor/, no
// network request), and this program hands it in. Rebuilt fresh in the recorded
// session of 2026-11-18: every game source file was written there, so the
// dossier's sources are the agent's own work in this session.
// from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. The game itself is an original
// open-world crime game: Jules Vane's six-mission story across Solmar Bay, a city
// explored on foot and by car, with traffic, pedestrians, car theft, a wanted level
// and police, combat, a HUD with a minimap, a start screen and a save — see
// game/src/main.js and the README for the full tour.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in a broken bundle: the game entry point
// must exist and every screenshot shots.json promises must be present and
// within the scorer's 256 KiB cap before anything is copied out.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('missing game/index.html — the game entry point is required');
}
const shotList = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
for (const shot of shotList) {
  const shotPath = join(here, 'screenshots', shot.name);
  if (!existsSync(shotPath)) throw new Error(`missing screenshot screenshots/${shot.name}`);
  const shotSize = statSync(shotPath).size;
  if (shotSize > 262144) throw new Error(`screenshot ${shot.name} is ${shotSize} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
