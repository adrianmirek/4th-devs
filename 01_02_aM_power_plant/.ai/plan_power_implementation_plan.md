# Implementation Plan: Power Plant Suspect Tracker

## Overview

Build an agentic Node.js app inside `01_02_aM_power_plant/` that uses **Function Calling** (same pattern as `01_02_tool_use`) to autonomously:

1. Fetch the power plant registry
2. Query each suspect's tracked locations
3. Identify which suspect was near a power plant (Haversine distance)
4. Fetch that suspect's access level
5. Submit the final answer to `/verify`

---

## Project Structure

```
01_02_aM_power_plant/
  app.js                  ← entry point (agent bootstrap)
  package.json            ← "type": "module", no extra deps needed
  input/
    suspects.json         ✅ already exists
  src/
    api.js                ← copy/adapt from 01_02_tool_use/src/api.js
    config.js             ← model, system prompt, API key config
    executor.js           ← agent loop (copy from 01_02_tool_use/src/executor.js)
    tools/
      definitions.js      ← JSON Schema tool definitions
      handlers.js         ← actual HTTP/geo logic for each tool
      index.js            ← re-export { tools, handlers }
    utils/
      geo.js              ← Haversine formula helper
```

---

## Tool Definitions (`src/tools/definitions.js`)

Five tools exposed to the LLM via Function Calling:

### 1. `get_power_plants`
- **Description:** Download the list of power plants and their codes + coordinates from the hub.
- **Parameters:** none
- **Returns:** Array of `{ code: string, name: string, lat: number, lon: number }`

### 2. `get_suspect_locations`
- **Description:** Fetch all tracked GPS coordinates for a given suspect.
- **Parameters:**
  - `name` (string, required)
  - `surname` (string, required)
- **Returns:** Array of `{ lat: number, lon: number }` (or raw coord objects from the API)

### 3. `find_nearest_power_plant`
- **Description:** Given a list of suspect coordinates and a list of power plants, return the nearest power plant and the minimum distance in km.
- **Parameters:**
  - `suspectLocations` (array of `{ lat, lon }`)
  - `powerPlants` (array of `{ code, name, lat, lon }`)
- **Returns:** `{ powerPlantCode: string, powerPlantName: string, distanceKm: number, closestSuspectLocation: { lat, lon } }`

### 4. `get_access_level`
- **Description:** Fetch the access level for a suspect from the hub API.
- **Parameters:**
  - `name` (string, required)
  - `surname` (string, required)
  - `birthYear` (integer, required — extract from `suspects.json` `born` field)
- **Returns:** `{ accessLevel: number }`

### 5. `confirm_answer`
- **Description:** Print the collected answer to the console and ask the user for confirmation before submitting. Blocks until the user responds.
- **Parameters:**
  - `name` (string)
  - `surname` (string)
  - `accessLevel` (number)
  - `powerPlant` (string — code in format `PWR0000PL`)
- **Returns:** `{ confirmed: true }` if the user typed `y`/`yes`, `{ confirmed: false }` otherwise

### 6. `submit_answer`
- **Description:** Submit the final answer to `/verify`. Only call this after `confirm_answer` returns `{ confirmed: true }`.
- **Parameters:**
  - `name` (string)
  - `surname` (string)
  - `accessLevel` (number)
  - `powerPlant` (string — code in format `PWR0000PL`)
- **Returns:** API response (success/failure message)

---

## Tool Handlers (`src/tools/handlers.js`)

### `get_power_plants`
```
GET https://hub.ag3nts.org/data/{AGENT_API_KEY}/findhim_locations.json
```
Parse and return the array. Normalize coordinate field names if needed.

### `get_suspect_locations`
```
POST https://hub.ag3nts.org/api/location
Body: { apikey, name, surname }
```
Return the locations array from the response.

### `find_nearest_power_plant`
- Iterate all pairs of `(suspectLocation, powerPlant)`
- Apply `haversineDistance(lat1, lon1, lat2, lon2)` from `src/utils/geo.js`
- Return the entry with minimum distance

### `get_access_level`
```
POST https://hub.ag3nts.org/api/accesslevel
Body: { apikey, name, surname, birthYear }   ← birthYear as integer
```
Return `{ accessLevel }` from the response.

### `confirm_answer`
Using Node's `readline` module, print a formatted summary of the pending answer to `stdout` and prompt the user:
```
┌─────────────────────────────────────────┐
│  Pending Answer                         │
│  Name:        <name> <surname>          │
│  Access Level: <accessLevel>            │
│  Power Plant:  <powerPlant>             │
└─────────────────────────────────────────┘
Submit this answer? [y/N]
```
Read one line from `stdin`. Return `{ confirmed: true }` if input is `y` or `yes` (case-insensitive), otherwise `{ confirmed: false }` and log `"Submission cancelled."`.

### `submit_answer`
```
POST https://hub.ag3nts.org/verify
Body: { apikey, task: "findhim", answer: { name, surname, accessLevel, powerPlant } }
```
Return the full API response for the agent to confirm success.

---

## Geo Utility (`src/utils/geo.js`)

Implement the **Haversine formula**:

$$d = 2R \arcsin\!\left(\sqrt{\sin^2\!\frac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\!\frac{\Delta\lambda}{2}}\right)$$

where $R = 6371$ km.

```js
// signature
export function haversineDistance(lat1, lon1, lat2, lon2): number  // returns km
```

---

## Config (`src/config.js`)

- Import `AI_API_KEY`, `AGENT_API_KEY`, `resolveModelForProvider` from `../../config.js`
- Model: `gpt-4o` (or `gpt-4.1` via `resolveModelForProvider`)
- System prompt:

```
You are an investigative agent. Your task is to identify which suspect 
was located near a nuclear power plant, determine their access level, 
and submit the findings.

Suspect list (with birth years):
<inject JSON of suspects.json at runtime>

Follow this strategy:
1. Call get_power_plants to fetch the registry.
2. For each suspect, call get_suspect_locations.
3. Call find_nearest_power_plant for each suspect to find the closest plant.
4. Identify the suspect with the smallest distance to any power plant.
5. Call get_access_level for that suspect (use the born field as birthYear).
6. Call confirm_answer to display the result and wait for human approval.
7. Only if confirmed, call submit_answer with all collected data. If not confirmed, stop and report the cancellation.
```

---

## Entry Point (`app.js`)

```js
import { readFile } from "fs/promises"
import { processQuery } from "./src/executor.js"
import { api } from "./src/config.js"
import { tools, handlers } from "./src/tools/index.js"

const suspects = JSON.parse(await readFile("./input/suspects.json", "utf-8"))

const config = {
  model: api.model,
  tools,
  handlers,
  instructions: api.buildInstructions(suspects)   // inject suspects into system prompt
}

await processQuery("Find the suspect near a nuclear power plant and submit the answer.", config)
```

---

## Executor (`src/executor.js`)

**Copy directly** from `01_02_tool_use/src/executor.js` — no changes needed.

- `MAX_TOOL_ROUNDS = 15` (slightly higher due to 5 suspects × potential multi-step reasoning)
- Conversation is maintained within the single query until the agent calls `submit_answer` and reports done

---

## API Layer (`src/api.js`)

**Copy directly** from `01_02_tool_use/src/api.js`.

Uses the shared `RESPONSES_API_ENDPOINT`, `AI_API_KEY`, and `EXTRA_API_HEADERS` from `../../config.js`.

---

## `package.json`

```json
{
  "name": "power-plant-finder",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch app.js",
    "start": "node app.js"
  }
}
```

No additional npm dependencies — uses native `fetch` (Node 24+).

---

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` or `OPENROUTER_API_KEY` | LLM access |
| `PERSONAL_API_KEY` / `AGENT_API_KEY` | Hub authentication (`apikey` in POST bodies) |

These are already configured in the root `.env` and exposed via `../../config.js`.

---

## Execution Flow (Agent Loop Trace)

```
User prompt → "Find the suspect near a nuclear power plant and submit the answer."
  └─ LLM calls: get_power_plants()
       → returns: [{ code, lat, lon }, ...]
  └─ LLM calls: get_suspect_locations(Cezary, Żurek)
  └─ LLM calls: find_nearest_power_plant(locations, plants)  → distance X km
  └─ LLM calls: get_suspect_locations(Jacek, Nowak)
  └─ LLM calls: find_nearest_power_plant(...)                → distance Y km
  ... (repeat for all 5 suspects)
  └─ LLM identifies suspect with minimum distance
  └─ LLM calls: get_access_level(name, surname, birthYear)
       → returns: { accessLevel: N }
  └─ LLM calls: confirm_answer(name, surname, accessLevel, powerPlantCode)
       → prints summary to console, waits for stdin
       → user types "y" → returns: { confirmed: true }
          (or user types "n" → returns: { confirmed: false } → agent stops)
  └─ LLM calls: submit_answer(name, surname, accessLevel, powerPlantCode)
       → returns: { success: true, ... }
  └─ LLM reports: "Done. Submitted answer for [name] [surname] ..."
```

---

## Key Implementation Notes

1. **`birthYear` must be an integer** — read it from `suspects.json` `born` field directly (no parsing needed, it's already a number).
2. **Distance threshold** — no hard threshold; always pick the suspect with the **minimum** distance across all (suspect, plant) pairs.
3. **Agent loop guard** — `MAX_TOOL_ROUNDS = 15` prevents runaway loops.
4. **Suspects are injected into the system prompt** so the agent knows `birthYear` without an extra API call.
5. **Power plant coordinates** come from the downloaded JSON — no hard-coded lat/lon values.
6. **Human-in-the-loop confirmation** — the `confirm_answer` tool uses `readline` to block on stdin. The agent must call this before `submit_answer`; if the user declines, the agent must not submit and should report the cancellation instead.
