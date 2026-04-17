import { readFile } from "fs/promises";
import { processQuery } from "./src/executor.js";
import { api } from "./src/config.js";
import { tools, handlers } from "./src/tools/index.js";

const suspects = JSON.parse(await readFile(new URL("./input/suspects.json", import.meta.url)));

const config = {
  model: api.model,
  tools,
  handlers,
  instructions: api.buildInstructions(suspects)
};

await processQuery(
  "Find the suspect who was near a nuclear power plant and submit the answer.",
  config
);
