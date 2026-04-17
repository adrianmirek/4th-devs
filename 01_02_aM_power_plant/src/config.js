import { AI_API_KEY, EXTRA_API_HEADERS, RESPONSES_API_ENDPOINT, resolveModelForProvider } from "../../config.js";

export const API_KEY = process.env.API_KEY?.trim() ?? "";
if (!API_KEY) {
  console.error("\x1b[31mError: API_KEY is not set in .env\x1b[0m");
  console.error("       Add:  API_KEY=your-hub-key");
  process.exit(1);
}

export const HUB_BASE_URL = "https://hub.ag3nts.org";

export const api = {
  model: resolveModelForProvider("gpt-4o"),

  /**
   * Build the system prompt, injecting the suspects list so the agent
   * has birth years available without an extra tool call.
   *
   * @param {Array} suspects - Parsed contents of input/suspects.json
   * @returns {string}
   */
  buildInstructions(suspects) {
    return `You are an investigative agent. Your task is to identify which suspect \
was located near a nuclear power plant, determine their access level, and submit the findings.

Suspect list (with birth years — use the "born" field as birthYear integer):
${JSON.stringify(suspects, null, 2)}

Follow this strategy step-by-step:
1. Call get_power_plants to fetch the power plant registry.
2. For each suspect, call check_suspect_near_plant to get the minimum distance to any plant.
3. Identify the single suspect with the overall smallest distanceKm.
4. Call get_access_level for that suspect using the "born" year as birthYear.
5. Call confirm_answer to display the collected result and wait for human approval.
6. Only if confirm_answer returns { confirmed: true }, call submit_answer. \
   If the user declines, stop and report the cancellation.

Important:
- birthYear must be an integer (e.g. 1987), NOT a string.
- Always pick the suspect with the MINIMUM distance — no fixed threshold.
- Never call submit_answer without a prior confirmed=true from confirm_answer.`;
  }
};

export { AI_API_KEY, EXTRA_API_HEADERS, RESPONSES_API_ENDPOINT };
