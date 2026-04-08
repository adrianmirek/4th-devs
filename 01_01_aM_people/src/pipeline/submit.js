/**
 * Phase C — Payload builder and hub submission.
 *
 * 1. Filters records to those tagged 'transport'.
 * 2. Maps each to the required submission shape.
 * 3. POSTs to https://hub.ag3nts.org/verify.
 * 4. Returns the parsed hub response (and highlights any flag).
 */

import { API_KEY, VERIFY_URL } from '../config.js';

/**
 * Maps a raw person record (with tags) to the hub submission shape.
 *
 * @param {Record<string, string> & { tags: string[] }} person
 * @returns {{ name: string; surname: string; gender: string; born: number; city: string; tags: string[] }}
 */
function toPayloadItem(person) {
  return {
    name:    person.name,
    surname: person.surname,
    gender:  person.gender,
    born:    parseInt(person.birthDate.split('-')[0], 10),
    city:    person.birthPlace,
    tags:    person.tags
  };
}

/**
 * Filters classified records to transport candidates and submits to hub.
 *
 * @param {Array<Record<string, string> & { tags: string[] }>} classified
 * @returns {Promise<object>} Hub response JSON
 */
export async function submitAnswer(classified) {
  const transportOnly = classified.filter((p) => p.tags.includes('transport'));
  const answer = transportOnly.map(toPayloadItem);

  const payload = {
    apikey: API_KEY,
    task:   'people',
    answer
  };

  console.log('\nPOSTing to:', VERIFY_URL);

  const res = await fetch(VERIFY_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hub returned HTTP ${res.status}: ${text}`);
  }

  return res.json();
}
