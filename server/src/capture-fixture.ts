import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scrapeEventbrite } from "./scraper.js";
import type { EventRecord } from "./types.js";

/**
 * One-off script to capture real Eventbrite data into a bundled fixture, used
 * as an offline fallback so the demo always has data. Run with `npm run capture`.
 */
const PLACES = [
  "ca--san-francisco",
  "ny--new-york",
  "il--chicago",
  "online",
];

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const byId = new Map<string, EventRecord>();
  for (const place of PLACES) {
    try {
      const events = await scrapeEventbrite({ place, pages: 2 });
      for (const e of events) byId.set(e.id, e);
      console.log(`captured ${events.length} from ${place}`);
    } catch (err) {
      console.warn(`skip ${place}: ${(err as Error).message}`);
    }
  }
  const all = [...byId.values()];
  const out = join(__dirname, "fixtures", "events.json");
  writeFileSync(out, JSON.stringify(all, null, 2));
  console.log(`wrote ${all.length} events -> ${out}`);
}

void main();
