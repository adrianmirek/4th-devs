<task>
<description>
    The Mission
    You must track down which of the suspect individuals from the previous task was located near one of the nuclear power plants. You also need to determine their access level and identify which specific power plant they were seen near. Send the collected data to /verify.
    The Suspects @suspects.json   
</description>
<todo>
 Data Sources
    1. List of Power Plants + Codes
    Download the JSON containing the list of power plants and their identification codes from:
    https://hub.ag3nts.org/data/YOUR-KEY-HERE/findhim_locations.json
    2. Tracking Locations (Where suspects were seen) @suspects.json
    Endpoint: https://hub.ag3nts.org/api/location
    Method: POST
    Body: raw JSON (not form-data!)
    Required Fields: apikey, name, surname
    Response: A list of coordinates where the person was seen.
    3. Access Level Verification
    Endpoint: https://hub.ag3nts.org/api/accesslevel
    Method: POST
    Body: raw JSON
    Required Fields: apikey, name, surname, birthYear (Retrieve the birth year from the data in the previous task, e.g., the CSV file).
    <step-by-step>
    Step-by-Step Instructions
    For each suspect:
    Fetch their list of locations from /api/location.
    Compare the received coordinates with the coordinates of the power plants from findhim_locations.json.
    If a location is very close to one of the power plants—you have found your candidate.
    For this specific person, fetch their accessLevel from /api/accesslevel.
    Identify the power plant code (format: PWR0000PL) and prepare the report.
    How to Submit the Answer
    Send a POST request to https://hub.ag3nts.org/verify.
    Task Name: findhim
    Answer Field: A single object containing the following:
    name: Suspect's first name
    surname: Suspect's last name
    accessLevel: The level retrieved from the API
    powerPlant: The power plant code (e.g., PWR1234PL)
    {
    "apikey": "YOUR-KEY-HERE",
    "task": "findhim",
    "answer": {
        "name": "Jan",
        "surname": "Kowalski",
        "accessLevel": 3,
        "powerPlant": "PWR1234PL"
    }
    }
    </step-by-step>
</todo>
<hints>
Input data from the previous task
The suspect list comes json @Suspects.json

Calculating geographic distance
The API returns coordinates (latitude/longitude). To check if a location is "very close" to a power plant, use a formula for distance on a sphere (e.g., the Haversine formula). An LLM can help you write such a function. You are looking for the person who was closest to one of the power plants.

Utilize Function Calling
This is a technique where the LLM, instead of responding with text, calls functions (tools) defined by you. You describe the tools in JSON Schema format (name, description, parameters), and the model decides which one to call and with what arguments. You handle the execution and return the results back to the model. Function Calling works particularly well for this task: an agent can autonomously iterate through the suspect list, query successive endpoints, and send the final answer—without hard-coding the sequence of steps in your code.

birthYear Format
The /api/accesslevel endpoint expects the birth year as an integer (e.g., 1987). If your data contains a full date (e.g., "1987-08-07"), remember to extract only the year before sending the request.

Agent loop safeguards
If you are using an agentic approach with Function Calling, set a maximum number of iterations (e.g., 10–15) to prevent infinite loops in case of a model error.

Model Selection
If your agent makes mistakes or runs in circles without providing the correct answer, try using a more powerful model or refining your system prompt. For example, the gpt-4o-mini model or its more powerful version gpt-4o performs well in this task.

How to find power plant locations?
Since the task data does not explicitly provide power plant locations as coordinates, you can approach this in a few ways:

Try to transform the locations into approximate coordinates (most top-tier LLMs can handle this).

Try to reverse-geocode the suspects' coordinates into place names (as mentioned above—the locations chosen are quite well-known).
</hints>
<example>
the example of using Function Calling here {{}}
</example>
<final-output>
prepare a final implementation plan in a markdown format call it plan_power_implementation_plan.md and add to the .ai folder. Don't do any implementation so far. The implementation step will be as a next step according to the final documente
</final-output>
</task>