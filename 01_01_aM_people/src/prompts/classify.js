/**
 * System prompt for the LLM job-classification call.
 *
 * The model receives a numbered list of Polish job descriptions and must
 * return one or more tags from the ALLOWED LIST for each entry.
 */

export const CLASSIFY_SYSTEM_PROMPT = `You are a career classification expert for a Polish personnel database.

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
- Respond ONLY with the JSON defined by the schema — no prose.`;

/**
 * JSON Schema passed as `response_format` in the OpenAI Structured Output call.
 * `strict: true` ensures the model cannot emit fields outside the schema.
 */
export const ClassificationSchema = {
  name: 'person_tagging',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'IT',
                  'transport',
                  'edukacja',
                  'medycyna',
                  'praca z ludźmi',
                  'praca z pojazdami',
                  'praca fizyczna'
                ]
              }
            }
          },
          required: ['id', 'tags'],
          additionalProperties: false
        }
      }
    },
    required: ['results'],
    additionalProperties: false
  }
};
