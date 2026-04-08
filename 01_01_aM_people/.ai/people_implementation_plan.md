# Implementation Plan: People — Transport Specialist Finder

## Overview

Identify individuals from the survivors list who are male, aged 20–40 in 2026, born in Grudziądz, and work in the transport sector. Tag all filtered candidates using an LLM with Structured Output, then submit the transport-tagged subset to `https://hub.ag3nts.org/verify`.

---

## 1. Project Structure

Mirrors the `01_01_grounding` layout:

```
01_01_aM_people/
├── app.js                  # Main entry point — orchestrator
├── package.json
├── .env                    # Not committed; holds API_KEY, OPENAI_API_KEY
├── .ai/
│   └── people_implementation_plan.md
└── src/
    ├── config.js           # Paths, model names, API config (mirrors grounding)
    ├── api.js              # Reusable fetch wrapper with retry (mirrors grounding)
    ├── pipeline/
    │   ├── fetch-people.js     # Phase A: download & parse CSV
    │   ├── filter.js           # Phase A: deterministic pre-filter
    │   ├── classify.js         # Phase B: LLM structured-output tagging
    │   └── submit.js           # Phase C: format payload & POST to /verify
    └── prompts/
        └── classify.js         # System-prompt text for the tagging LLM call
```

---

## 2. Environment Variables

Pull from the workspace root `.env` via the shared `config.js`:

| Variable | Purpose |
|---|---|
| `API_KEY` | Hub key — used in the CSV download URL and the verify payload |
| `OPENAI_API_KEY` | OpenAI key for the Structured Output call |
| `AI_PROVIDER` | `openai` (default) |

---

## 3. Data Source

The CSV is read from the local file already present in the project:

```
01_01_aM_people/src/people.csv
```

No network fetch is required for the data; the file is read with `node:fs/promises` `readFile`.

### CSV columns (confirmed from local snapshot)

| Column | Example |
|---|---|
| `name` | `Jan` |
| `surname` | `Kowalski` |
| `gender` | `M` |
| `birthDate` | `1995-04-23` |
| `birthPlace` | `Grudziądz` |
| `birthCountry` | `Polska` |
| `job` | long Polish description |

---

## 4. Execution Flow

### Phase A — Read & Pre-filter (`fetch-people.js`, `filter.js`)

1. `readFile(path.join(PROJECT_DIR, 'src', 'people.csv'), 'utf8')` — read the local CSV file.
2. Parse with `csv-parse/sync` (`{ columns: true, relax_column_count: true }`).
3. Apply **deterministic** filter — keep only records where **ALL** are true:
   - `gender === 'M'`
   - `birthPlace === 'Grudziądz'`
   - `year >= 1986 && year <= 2006` (birth year extracted from `birthDate`)

> **Age bounds:** `2026 − 40 = 1986` and `2026 − 20 = 2006` (inclusive on both ends).

### Phase B — LLM Job Classification (`classify.js`, `prompts/classify.js`)

**Batch strategy:** Send all filtered job descriptions in a single LLM call, numbered `0…N-1`.

#### System prompt (`prompts/classify.js`)

```
You are a career classification expert for a Polish personnel database.

Your task: for each numbered job description below, assign one or more tags from the ALLOWED LIST.

ALLOWED TAGS (use exact strings):
- IT              → software, programming, data, algorithms, systems
- transport       → moving goods/people, logistics, driving, fleet, supply chain
- edukacja        → teaching, training, coaching, education
- medycyna        → medicine, healthcare, diagnosis, treatment, biology
- praca z ludźmi  → direct human interaction, social work, customer service
- praca z pojazdami → operating or maintaining any vehicle or machine
- praca fizyczna  → manual labour, physical work, crafts, installation

Rules:
- A job may have MULTIPLE tags.
- If a description involves transporting goods OR logistics between locations, it MUST include the "transport" tag.
- Respond ONLY with the JSON defined by the schema — no prose.
```

#### JSON Schema (Structured Output)

```javascript
const ClassificationSchema = {
  name: "person_tagging",
  strict: true,
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id:   { type: "integer" },
            tags: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "IT",
                  "transport",
                  "edukacja",
                  "medycyna",
                  "praca z ludźmi",
                  "praca z pojazdami",
                  "praca fizyczna"
                ]
              }
            }
          },
          required: ["id", "tags"],
          additionalProperties: false
        }
      }
    },
    required: ["results"],
    additionalProperties: false
  }
};
```

**Model:** `gpt-4o-2024-08-06` (supports strict structured output).

**API call style:** `openai.chat.completions.create(...)` with `response_format: { type: "json_schema", json_schema: ClassificationSchema }`.

### Phase C — Build Payload & Submit (`submit.js`)

1. Merge LLM tags back onto filtered records (by array index `i`).
2. Keep only records where `tags.includes('transport')`.
3. Map each record to the required shape:

```json
{
  "name": "Jan",
  "surname": "Kowalski",
  "gender": "M",
  "born": 1995,
  "city": "Grudziądz",
  "tags": ["transport", "praca z pojazdami"]
}
```

4. **Print the full `answer` array** to the console and **wait for user confirmation** before submitting.
5. POST to `https://hub.ag3nts.org/verify`:

```json
{
  "apikey": "<API_KEY>",
  "task": "people",
  "answer": [ /* array from step 3 */ ]
}
```

6. Log the response. If a `{FLG:…}` flag is returned, print it prominently.

---

## 5. `app.js` Orchestrator (outline)

```javascript
import { createInterface } from 'node:readline/promises';
import { readPeople }         from './src/pipeline/fetch-people.js';
import { filterCandidates }   from './src/pipeline/filter.js';
import { classifyJobs }       from './src/pipeline/classify.js';
import { submitAnswer }       from './src/pipeline/submit.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  // Phase A
  console.log('1. Reading people.csv…');
  const records = await readPeople();        // reads src/people.csv
  console.log(`   Total records: ${records.length}`);

  console.log('2. Filtering candidates…');
  const filtered = filterCandidates(records);
  console.log(`   Matches: ${filtered.length}`);

  // Phase B
  console.log('3. Classifying jobs via LLM…');
  const classified = await classifyJobs(filtered);
  console.log(`   Done.`);

  // Phase C — preview
  const transportOnly = classified.filter(p => p.tags.includes('transport'));
  console.log('\n--- ANSWER PREVIEW ---');
  console.log(JSON.stringify(transportOnly, null, 2));
  console.log('----------------------\n');

  const confirm = await rl.question('Submit to hub? (yes/y): ');
  rl.close();
  if (!['yes', 'y'].includes(confirm.trim().toLowerCase())) {
    console.log('Aborted.'); process.exit(0);
  }

  console.log('4. Submitting…');
  const result = await submitAnswer(transportOnly);
  console.log('Hub response:', result);
}

main().catch(err => { console.error(err); process.exit(1); });
```

---

## 6. `package.json`

```json
{
  "name": "01_01_am_people",
  "version": "1.0.0",
  "type": "module",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "ai-devs-examples": "file:..",
    "csv-parse": "^5.x",
    "openai": "^4.x"
  }
}
```

> `ai-devs-examples` exposes the shared `config.js` (API keys, provider resolution) used across all workspace projects.

---

## 7. Key Reminders

| Concern | Detail |
|---|---|
| CSV source | Local file `src/people.csv` — no network fetch needed for data |
| `born` field type | Integer (year only), e.g. `1995` — not a full date string |
| Tag strings | Must match the Polish enum exactly — Structured Output enforces this |
| Age bounds | 1986–2006 (born year), inclusive; current year = 2026 |
| Batch tagging | One LLM call for all filtered jobs → cheaper & faster |
| Confirmation gate | Print answer to console, wait for `yes/y` before POSTing |
| Flag capture | Look for `{FLG:…}` in the hub response and display it clearly |

---

## 8. Execution

```bash
cd 01_01_aM_people
npm install
node app.js
```

The script will:
1. Read the local `src/people.csv` and filter data automatically.
2. Call the LLM once.
3. Print the proposed answer and wait for confirmation.
4. Submit and display the hub response / flag.
