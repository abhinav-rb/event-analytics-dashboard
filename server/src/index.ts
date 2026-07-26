import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import cors from "cors";
import express from "express";
import type { EventRecord } from "./types.js";
import { store } from "./store.js";
import { scrapeEventbrite } from "./scraper.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

/** Load the bundled sample events (real data captured from Eventbrite). */
function loadFixture(): EventRecord[] {
  try {
    const path = join(__dirname, "fixtures", "events.json");
    return JSON.parse(readFileSync(path, "utf8")) as EventRecord[];
  } catch {
    return [];
  }
}

// --- Health check -----------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", events: store.count() });
});

// --- Collect events: scrape Eventbrite --------------------------------------
// body: { place?: string, pages?: number }  (place defaults to San Francisco)
app.post("/api/scrape", async (req, res) => {
  const place = typeof req.body?.place === "string" ? req.body.place : "ca--san-francisco";
  const pages = Number(req.body?.pages ?? 1);
  try {
    const events = await scrapeEventbrite({ place, pages });
    const added = store.upsertMany(events);
    res.json({ scraped: events.length, added, total: store.count(), place });
  } catch (err) {
    res.status(502).json({ error: `Scrape failed: ${(err as Error).message}` });
  }
});

// --- Raw event feed (inspection / debugging) --------------------------------
app.get("/api/events", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 1000);
  res.json({ total: store.count(), events: store.all().slice(0, limit) });
});

// --- Aggregated analytics ----------------------------------------------------
app.get("/api/analytics", (_req, res) => {
  res.json(store.analytics());
});

// Populate the store on startup so the dashboard is never empty. Try a live
// scrape first; fall back to the bundled sample if the network/site is
// unavailable (keeps the demo reliable offline).
async function bootstrap(): Promise<void> {
  try {
    const events = await scrapeEventbrite({ place: "ca--san-francisco", pages: 2 });
    const added = store.upsertMany(events);
    console.log(`[server] bootstrapped ${added} events via live scrape`);
  } catch (err) {
    const fixture = loadFixture();
    store.upsertMany(fixture);
    console.log(
      `[server] live scrape unavailable (${(err as Error).message}); ` +
        `loaded ${fixture.length} events from sample fixture`,
    );
  }
}

app.listen(PORT, async () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  await bootstrap();
  console.log(`[server] ready with ${store.count()} events`);
});
