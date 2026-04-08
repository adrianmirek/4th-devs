/**
 * Project-level configuration for 01_01_aM_people.
 *
 * - Imports shared AI credentials from the workspace root `ai-devs-examples` package.
 * - Reads the hub API key from the environment (loaded by the root config.js).
 * - Exports paths, model name, and all required keys.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Trigger root .env loading and pull shared AI config.
import { AI_API_KEY, CHAT_API_BASE_URL, OPENAI_API_KEY, resolveModelForProvider } from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_DIR = path.resolve(__dirname, '..');

/** Absolute path to the local CSV file. */
export const CSV_PATH = path.join(PROJECT_DIR, 'src', 'people.csv');

/**
 * Hub API key — required for the /verify submission payload.
 * Must be set as API_KEY in the root .env file.
 */
export const API_KEY = process.env.API_KEY?.trim() ?? '';
if (!API_KEY) {
  console.error('\x1b[31mError: API_KEY is not set in .env\x1b[0m');
  console.error('       Add:  API_KEY=your-hub-key');
  process.exit(1);
}

/** Structured-Output model — supports strict JSON Schema response format. */
export const CLASSIFICATION_MODEL = resolveModelForProvider('gpt-4o-2024-08-06');

/**
 * OpenAI API key used directly by the `openai` SDK.
 * The `openai` package automatically picks up OPENAI_API_KEY from the
 * environment, but we re-export it here for clarity.
 */
export { OPENAI_API_KEY, AI_API_KEY, CHAT_API_BASE_URL };

/** Current reference year for age calculation. */
export const REFERENCE_YEAR = 2026;

/** Hub endpoint for answer submission. */
export const VERIFY_URL = 'https://hub.ag3nts.org/verify';
