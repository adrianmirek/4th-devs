import { chat, extractToolCalls, extractText } from "./api.js";

const MAX_TOOL_ROUNDS = 15;

const logQuery = (query) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Query: ${query}`);
  console.log("=".repeat(60));
};

const logResult = (text) => console.log(`\nA: ${text}`);

const executeToolCalls = async (toolCalls, handlers) => {
  console.log(`\nTool calls: ${toolCalls.length}`);

  // Tool calls must run sequentially when any of them is interactive (e.g. confirm_answer reads stdin).
  const results = [];
  for (const call of toolCalls) {
    const args = JSON.parse(call.arguments);
    console.log(`  → ${call.name}(${JSON.stringify(args)})`);

    try {
      const handler = handlers[call.name];
      if (!handler) throw new Error(`Unknown tool: ${call.name}`);

      const result = await handler(args);
      console.log(`    ✓ Success`);
      results.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
      results.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ error: error.message }) });
    }
  }

  return results;
};

export const processQuery = async (query, { model, tools, handlers, instructions }) => {
  const chatConfig = { model, tools, instructions };
  logQuery(query);

  let conversation = [{ role: "user", content: query }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chat({ ...chatConfig, input: conversation });
    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      const text = extractText(response) ?? "No response";
      logResult(text);
      return text;
    }

    const toolResults = await executeToolCalls(toolCalls, handlers);

    conversation = [
      ...conversation,
      ...toolCalls,
      ...toolResults
    ];
  }

  logResult("Max tool rounds reached");
  return "Max tool rounds reached";
};
