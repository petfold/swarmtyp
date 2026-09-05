// Build swarm-collaborative-docs from a pinned upstream commit into vendor/ (ignored by git). Two local patches until the
// upstream issues land: yjs external (#8) and pnpm allowBuilds for the bee-js git dependency (#14). No fork (D-02):
// this script is the whole delta. Usage: node tools/collab/build-lib.mjs [--force]
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const REPO = 'https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs';
const COMMIT = 'adcb7d57138d51aef7a519934501100bfb92bf2a'; // master, 2026-06-24, version 0.0.1
const dir = new URL('../../vendor/swarm-collaborative-docs/', import.meta.url).pathname;
const dist = dir + 'dist/SwarmCollaborativeDocs.js';
const force = process.argv.includes('--force');
if (existsSync(dist) && !force) { console.log('vendor/swarm-collaborative-docs already built; --force to rebuild'); process.exit(0); }
if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
const sh = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: dir });
execSync(`git clone -q ${REPO} "${dir}"`, { stdio: 'inherit' });
sh(`git checkout -q ${COMMIT}`);
// Patch 1: yjs must be a single instance shared with the editor binding (upstream #8).
const vite = dir + 'vite.config.mts'; let v = readFileSync(vite, 'utf8');
v = v.replace("external: ['@ethersphere/bee-js', 'react', 'react-dom', 'y-webrtc']", "external: ['@ethersphere/bee-js', 'react', 'react-dom', 'y-webrtc', 'yjs']");
if (!v.includes("'yjs']")) throw new Error('patch 1 did not apply: upstream vite.config.mts changed');
writeFileSync(vite, v);
// Patch 2: pnpm 11 needs the exact URL key to run the bee-js fork's build script (upstream #14).
const ws = dir + 'pnpm-workspace.yaml'; let w = readFileSync(ws, 'utf8');
w = w.replace("allowBuilds:\n  '@ethersphere/bee-js': true\n", "allowBuilds:\n  '@ethersphere/bee-js': true\n  '@ethersphere/bee-js@https://codeload.github.com/Apiary-Suite/bee-js/tar.gz/f1c50409bfa960738ad228f492f88dbd21794ee2': true\n");
if (!w.includes('codeload.github.com')) throw new Error('patch 2 did not apply: upstream pnpm-workspace.yaml changed');
writeFileSync(ws, w);
sh('pnpm install --frozen-lockfile');
sh('pnpm build:lib');
if (!existsSync(dist)) throw new Error('build produced no dist/SwarmCollaborativeDocs.js');
console.log(`built ${dist} (${(readFileSync(dist).length / 1048576).toFixed(2)} MB)`);
