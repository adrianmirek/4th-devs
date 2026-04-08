/**
 * People — Transport Specialist Finder
 *
 * Orchestrator entrypoint.
 *
 * Usage:
 *   node app.js
 *
 * Flow:
 *   Phase A  →  Read src/people.csv & apply deterministic pre-filter.
 *   Phase B  →  Send filtered job descriptions to LLM (Structured Output).
 *   Phase C  →  Preview 'transport'-tagged candidates, await confirmation,
 *               then POST to https://hub.ag3nts.org/verify.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { readPeople }       from './src/pipeline/fetch-people.js';
import { filterCandidates } from './src/pipeline/filter.js';
import { classifyJobs }     from './src/pipeline/classify.js';
import { submitAnswer }     from './src/pipeline/submit.js';

const rl = createInterface({ input: stdin, output: stdout });

async function main() {
  // ── Phase A: Read & pre-filter ────────────────────────────────────────────
  console.log('1. Reading people.csv…');
  const records = await readPeople();
  console.log(`   Total records: ${records.length}`);

  console.log('2. Filtering candidates (M, Grudziądz, born 1986–2006)…');
  const filtered = filterCandidates(records);
  console.log(`   Matches: ${filtered.length}`);

  if (filtered.length === 0) {
    console.log('No candidates found — nothing to submit.');
    rl.close();
    return;
  }

  // ── Phase B: LLM classification ───────────────────────────────────────────
  console.log('3. Classifying jobs via LLM (Structured Output)…');
  const classified = await classifyJobs(filtered);
  console.log(`   Classification complete.`);

  // ── Phase C: Preview & submit ─────────────────────────────────────────────
  const transportOnly = classified.filter((p) => p.tags.includes('transport'));

  // Build preview payload (same shape as the hub submission answer).
  const preview = transportOnly.map((p) => ({
    name:    p.name,
    surname: p.surname,
    gender:  p.gender,
    born:    parseInt(p.birthDate.split('-')[0], 10),
    city:    p.birthPlace,
    tags:    p.tags
  }));

  console.log('\n─── ANSWER PREVIEW (' + preview.length + ' candidate(s)) ───');
  console.log(JSON.stringify(preview, null, 2));
  console.log('────────────────────────────────────────\n');

  const confirm = await rl.question('Submit to hub? (yes/y to confirm): ');
  rl.close();

  if (!['yes', 'y'].includes(confirm.trim().toLowerCase())) {
    console.log('Aborted — nothing was submitted.');
    process.exit(0);
  }

  console.log('4. Submitting to hub…');
  const result = await submitAnswer(classified);

  console.log('\n─── HUB RESPONSE ───');
  console.log(JSON.stringify(result, null, 2));

  // Highlight any flag returned by the hub.
  const raw = JSON.stringify(result);
  const flagMatch = raw.match(/\{FLG:[^}]+\}/);
  if (flagMatch) {
    console.log(`\n\x1b[32m✔  FLAG CAPTURED: ${flagMatch[0]}\x1b[0m`);
  }
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err.message ?? err);
  process.exit(1);
});
