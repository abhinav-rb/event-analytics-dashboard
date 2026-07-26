import type { Analytics } from "./types";

export async function fetchAnalytics(): Promise<Analytics> {
  const res = await fetch("/api/analytics");
  if (!res.ok) throw new Error(`Analytics request failed: ${res.status}`);
  return res.json();
}

export interface ScrapeResult {
  scraped: number;
  added: number;
  total: number;
  place: string;
}

/** Trigger a live scrape of an Eventbrite place (city slug). */
export async function scrape(place: string, pages = 2): Promise<ScrapeResult> {
  const res = await fetch("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place, pages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Scrape failed: ${res.status}`);
  }
  return res.json();
}
