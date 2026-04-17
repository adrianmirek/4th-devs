export const tools = [
  {
    type: "function",
    name: "get_power_plants",
    description: "Download the list of nuclear power plants with their codes and GPS coordinates from the hub registry.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "check_suspect_near_plant",
    description: "Fetch a suspect's tracked GPS locations, then compute the nearest nuclear power plant using cached plant data (requires get_power_plants to have been called first). Returns the nearest plant code, name, and distance in km.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Suspect's first name"
        },
        surname: {
          type: "string",
          description: "Suspect's surname"
        }
      },
      required: ["name", "surname"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "get_access_level",
    description: "Fetch the access level for a suspect from the hub API.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Suspect's first name"
        },
        surname: {
          type: "string",
          description: "Suspect's surname"
        },
        birthYear: {
          type: "integer",
          description: "Suspect's birth year as an integer (e.g. 1987)"
        }
      },
      required: ["name", "surname", "birthYear"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "confirm_answer",
    description: "Print the collected answer to the console and ask the human operator for confirmation before submitting. Blocks until the user responds. Only proceed to submit_answer if this returns { confirmed: true }.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Suspect's first name" },
        surname: { type: "string", description: "Suspect's surname" },
        accessLevel: { type: "number", description: "Access level retrieved from the API" },
        powerPlant: { type: "string", description: "Power plant code, e.g. PWR1234PL" }
      },
      required: ["name", "surname", "accessLevel", "powerPlant"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "submit_answer",
    description: "Submit the final answer to /verify. Only call this after confirm_answer returns { confirmed: true }.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Suspect's first name" },
        surname: { type: "string", description: "Suspect's surname" },
        accessLevel: { type: "number", description: "Access level retrieved from the API" },
        powerPlant: { type: "string", description: "Power plant code, e.g. PWR1234PL" }
      },
      required: ["name", "surname", "accessLevel", "powerPlant"],
      additionalProperties: false
    },
    strict: true
  }
];
