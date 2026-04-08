/**
 * Phase A — Deterministic pre-filter.
 *
 * Keeps only records where ALL of the following are true:
 *   - gender === 'M'
 *   - birthPlace === 'Grudziądz'
 *   - birth year is in [1986, 2006] (i.e. aged 20–40 when reference year is 2026)
 *
 * Age bounds:  REFERENCE_YEAR − 40 = 1986  (oldest)
 *              REFERENCE_YEAR − 20 = 2006  (youngest)
 */

import { REFERENCE_YEAR } from '../config.js';

const MIN_YEAR = REFERENCE_YEAR - 40; // 1986
const MAX_YEAR = REFERENCE_YEAR - 20; // 2006

/**
 * @param {Array<Record<string, string>>} records
 * @returns {Array<Record<string, string>>}
 */
export function filterCandidates(records) {
  return records.filter((person) => {
    if (person.gender !== 'M') return false;
    if (person.birthPlace !== 'Grudziądz') return false;

    const year = parseInt(person.birthDate?.split('-')[0], 10);
    if (isNaN(year)) return false;

    return year >= MIN_YEAR && year <= MAX_YEAR;
  });
}
