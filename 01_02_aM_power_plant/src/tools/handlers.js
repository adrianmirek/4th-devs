import { createInterface } from "readline";
import { API_KEY, HUB_BASE_URL } from "../config.js";
import { haversineDistance } from "../utils/geo.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const hubPost = async (path, body) => {
  const response = await fetch(`${HUB_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: API_KEY, ...body })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Hub API error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
};

// ---------------------------------------------------------------------------
// Module-level plant cache — populated by get_power_plants, consumed by
// check_suspect_near_plant. Avoids sending large arrays through the LLM.
// ---------------------------------------------------------------------------

let cachedPlants = null;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Use Nominatim (OpenStreetMap) to resolve a city name to lat/lon. */
const geocodeCity = async (cityName) => {
  const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&country=Poland&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { "User-Agent": "power-plant-finder/1.0" }
  });

  if (!response.ok) throw new Error(`Nominatim error ${response.status} for "${cityName}"`);

  const results = await response.json();
  if (!results.length) throw new Error(`No geocoding result for "${cityName}"`);

  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
};

export const handlers = {
  /** Fetch the power plant registry and geocode city names to coordinates. */
  async get_power_plants() {
    const response = await fetch(
      `${HUB_BASE_URL}/data/${API_KEY}/findhim_locations.json`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch power plants: HTTP ${response.status}`);
    }

    const data = await response.json();

    // Response shape: { power_plants: { "CityName": { code, is_active, power }, ... } }
    const raw = data.power_plants ?? data;
    const entries = Object.entries(raw);

    const plants = [];
    for (const [cityName, info] of entries) {
      // Respect Nominatim usage policy: max 1 request/second
      if (plants.length > 0) await new Promise((r) => setTimeout(r, 1100));

      try {
        const { lat, lon } = await geocodeCity(cityName);
        plants.push({ code: info.code, name: cityName, lat, lon });
        console.log(`    Geocoded "${cityName}" → ${lat}, ${lon}`);
      } catch (err) {
        console.warn(`    Warning: could not geocode "${cityName}": ${err.message}`);
      }
    }

    console.log(`    Loaded ${plants.length} power plants`);
    cachedPlants = plants;
    return plants;
  },

  /**
   * Fetch a suspect's locations and compute the nearest power plant.
   * Uses the module-level plant cache — call get_power_plants first.
   */
  async check_suspect_near_plant({ name, surname }) {
    if (!cachedPlants || cachedPlants.length === 0) {
      throw new Error("No power plants cached. Call get_power_plants first.");
    }

    const data = await hubPost("/api/location", { name, surname });

    const raw = Array.isArray(data) ? data : data.locations ?? data.coords ?? data.data ?? [];
    const locations = raw.map((loc) => ({
      lat: loc.lat ?? loc.latitude ?? loc.coords?.lat,
      lon: loc.lon ?? loc.lng ?? loc.longitude ?? loc.coords?.lon ?? loc.coords?.lng
    }));

    console.log(`    ${name} ${surname}: ${locations.length} location(s)`);

    let best = null;
    for (const loc of locations) {
      for (const plant of cachedPlants) {
        const dist = haversineDistance(loc.lat, loc.lon, plant.lat, plant.lon);
        if (best === null || dist < best.distanceKm) {
          best = {
            powerPlantCode: plant.code,
            powerPlantName: plant.name,
            distanceKm: Number(dist.toFixed(3))
          };
        }
      }
    }

    return best ?? { powerPlantCode: null, powerPlantName: null, distanceKm: null };
  },

  /** Fetch the access level for a suspect. */
  async get_access_level({ name, surname, birthYear }) {
    const data = await hubPost("/api/accesslevel", {
      name,
      surname,
      birthYear: Number(birthYear)
    });

    const accessLevel = data.accessLevel ?? data.access_level ?? data.level ?? data.data?.accessLevel;
    return { accessLevel };
  },

  /** Print a summary and ask for human confirmation before submitting. */
  async confirm_answer({ name, surname, accessLevel, powerPlant }) {
    const border = "─".repeat(43);
    console.log(`\n┌${border}┐`);
    console.log(`│  Pending Answer                           │`);
    console.log(`│  Name:         ${String(`${name} ${surname}`).padEnd(27)}│`);
    console.log(`│  Access Level: ${String(accessLevel).padEnd(27)}│`);
    console.log(`│  Power Plant:  ${String(powerPlant).padEnd(27)}│`);
    console.log(`└${border}┘`);

    const answer = await new Promise((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question("Submit this answer? [y/N] ", (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      });
    });

    const confirmed = answer === "y" || answer === "yes";

    if (!confirmed) {
      console.log("Submission cancelled.");
    }

    return { confirmed };
  },

  /** Submit the final answer to /verify. */
  async submit_answer({ name, surname, accessLevel, powerPlant }) {
    const response = await fetch(`${HUB_BASE_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: API_KEY,
        task: "findhim",
        answer: { name, surname, accessLevel, powerPlant }
      })
    });

    const result = await response.json();
    console.log(`    Verify response: ${JSON.stringify(result)}`);
    return result;
  }
};
