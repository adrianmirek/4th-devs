/**
 * Phase A — Data loader.
 *
 * Reads the local CSV file and returns all rows as plain objects.
 * Uses csv-parse/sync so the caller gets a synchronous, simple array.
 */

import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { CSV_PATH } from '../config.js';

/**
 * Reads and parses `src/people.csv`.
 *
 * @returns {Promise<Array<{name: string, surname: string, gender: string, birthDate: string, birthPlace: string, birthCountry: string, job: string}>>}
 */
export async function readPeople() {
  const raw = await readFile(CSV_PATH, 'utf8');

  return parse(raw, {
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  });
}
