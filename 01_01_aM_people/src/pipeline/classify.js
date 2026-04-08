/**
 * Phase B — LLM job classification via OpenAI Structured Output.
 *
 * Sends all filtered job descriptions in a SINGLE batched request,
 * numbered 0…N-1, and returns the input records enriched with a
 * `tags` array on each object.
 */

import OpenAI from 'openai';
import { CLASSIFICATION_MODEL, AI_API_KEY, CHAT_API_BASE_URL } from '../config.js';
import { CLASSIFY_SYSTEM_PROMPT, ClassificationSchema } from '../prompts/classify.js';

const openai = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: CHAT_API_BASE_URL
});

/**
 * @param {Array<Record<string, string>>} filtered - Pre-filtered person records
 * @returns {Promise<Array<Record<string, string> & { tags: string[] }>>}
 */
export async function classifyJobs(filtered) {
  if (filtered.length === 0) {
    console.log('   No candidates to classify.');
    return [];
  }

  // Build numbered job list for the LLM user message.
  const userMessage = filtered
    .map((person, i) => `ID ${i}: ${person.job}`)
    .join('\n');

  console.log(`   Sending ${filtered.length} job descriptions to ${CLASSIFICATION_MODEL}…`);

  const response = await openai.chat.completions.create({
    model: CLASSIFICATION_MODEL,
    messages: [
      { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
      { role: 'user',   content: userMessage }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: ClassificationSchema
    }
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('LLM returned an empty response.');
  }

  /** @type {{ results: Array<{ id: number; tags: string[] }> }} */
  const parsed = JSON.parse(rawContent);

  // Build a lookup map: id → tags
  const tagMap = new Map(parsed.results.map((r) => [r.id, r.tags]));

  // Merge tags back onto the original records.
  return filtered.map((person, i) => ({
    ...person,
    tags: tagMap.get(i) ?? []
  }));
}
