import type { EventRecord } from "./types.js";

/**
 * Eventbrite scraper.
 *
 * Eventbrite's public discovery pages embed a `window.__SERVER_DATA__` JSON
 * blob containing the search results (plus schema.org/Event JSON-LD as a
 * fallback). We fetch the page HTML, extract that blob with a brace-matched
 * parse, and normalize each result into our provider-agnostic `EventRecord`.
 *
 * No API key required; this reads the same structured data the page ships to
 * the browser. We send a browser User-Agent and keep request volume low.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const SERVER_DATA_MARKER = "__SERVER_DATA__ = ";

export interface ScrapeOptions {
  /** Eventbrite place slug, e.g. "ca--san-francisco", "ny--new-york", "online". */
  place: string;
  /** Number of result pages to fetch (20 events per page). */
  pages?: number;
}

/** Build the discovery URL for a place + page number. */
function discoveryUrl(place: string, page: number): string {
  return `https://www.eventbrite.com/d/${place}/all-events/?page=${page}`;
}

/**
 * Extract the `__SERVER_DATA__` object from page HTML via brace matching.
 * Returns null if the marker isn't present.
 */
export function extractServerData(html: string): any | null {
  const at = html.indexOf(SERVER_DATA_MARKER);
  if (at === -1) return null;
  const start = at + SERVER_DATA_MARKER.length;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let i = start;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }

  try {
    return JSON.parse(html.slice(start, i));
  } catch {
    return null;
  }
}

/** Map one raw Eventbrite search result into our normalized shape. */
function normalize(raw: any, scrapedAt: string): EventRecord | null {
  if (!raw || !raw.id || !raw.name) return null;

  const tags: any[] = Array.isArray(raw.tags) ? raw.tags : [];
  const category = tags.find((t) => t?.prefix === "EventbriteCategory")?.display_name ?? null;
  const format = tags.find((t) => t?.prefix === "EventbriteFormat")?.display_name ?? null;
  const address = raw.primary_venue?.address ?? {};

  return {
    id: String(raw.id),
    source: "eventbrite",
    name: String(raw.name),
    url: raw.url ?? "",
    startDate: raw.start_date ?? "",
    startTime: raw.start_time ?? "",
    isOnline: Boolean(raw.is_online_event),
    city: raw.is_online_event ? "Online" : address.city ?? null,
    region: address.region ?? null,
    country: address.country ?? null,
    venue: raw.primary_venue?.name ?? null,
    category,
    format,
    summary: raw.summary ?? null,
    image: raw.image?.url ?? raw.image ?? null,
    scrapedAt,
  };
}

/** Parse all normalized events out of a single discovery page's HTML. */
export function parseEventsFromHtml(html: string, scrapedAt: string): EventRecord[] {
  const data = extractServerData(html);
  const results: any[] = data?.search_data?.events?.results ?? [];
  return results
    .map((r) => normalize(r, scrapedAt))
    .filter((e): e is EventRecord => e !== null);
}

/**
 * Scrape one or more discovery pages for a place.
 * Returns normalized, de-duplicated events. Throws if the network fails or the
 * page structure can't be parsed on the first page (callers may fall back).
 */
export async function scrapeEventbrite(opts: ScrapeOptions): Promise<EventRecord[]> {
  const pages = Math.max(1, Math.min(opts.pages ?? 1, 10));
  const scrapedAt = new Date().toISOString();
  const byId = new Map<string, EventRecord>();

  for (let page = 1; page <= pages; page++) {
    const res = await fetch(discoveryUrl(opts.place, page), {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) {
      // Stop paging on a hard failure; surface if it happened on page 1.
      if (page === 1) throw new Error(`Eventbrite returned HTTP ${res.status}`);
      break;
    }
    const html = await res.text();
    const events = parseEventsFromHtml(html, scrapedAt);
    if (events.length === 0 && page === 1) {
      throw new Error("No events found in page (structure may have changed)");
    }
    for (const e of events) byId.set(e.id, e);
    if (events.length === 0) break; // reached the end
  }

  return [...byId.values()];
}
