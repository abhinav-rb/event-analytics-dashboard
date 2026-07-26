import type { Analytics, Bucket, EventRecord } from "./types.js";

/**
 * In-memory event store.
 *
 * Deliberately simple for the demo: events live in a Map keyed by id (so
 * re-scraping the same source de-duplicates naturally) and are lost on restart.
 * No database, no setup. Swapping this for a persistent backend would not
 * require changing the API or scraper layers.
 */
class EventStore {
  private events = new Map<string, EventRecord>();

  /** Insert or update events, de-duplicating by id. Returns count added. */
  upsertMany(records: EventRecord[]): number {
    let added = 0;
    for (const r of records) {
      if (!this.events.has(r.id)) added++;
      this.events.set(r.id, r);
    }
    return added;
  }

  all(): EventRecord[] {
    return [...this.events.values()];
  }

  count(): number {
    return this.events.size;
  }

  clear(): void {
    this.events.clear();
  }

  /** Aggregate the top-N buckets from a label->count map, largest first. */
  private topBuckets(map: Map<string, number>, limit = 12): Bucket[] {
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** Compute aggregate analytics over all stored events. */
  analytics(today = new Date().toISOString().slice(0, 10)): Analytics {
    const events = this.all();

    const byCategory = new Map<string, number>();
    const byCity = new Map<string, number>();
    const byFormat = new Map<string, number>();
    const byDate = new Map<string, number>();
    const cities = new Set<string>();
    let online = 0;
    let upcoming = 0;
    let past = 0;

    for (const e of events) {
      const cat = e.category ?? "Uncategorized";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);

      const city = e.city ?? "Unknown";
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
      if (e.city && e.city !== "Online") cities.add(e.city);

      const fmt = e.format ?? "Other";
      byFormat.set(fmt, (byFormat.get(fmt) ?? 0) + 1);

      if (e.startDate) byDate.set(e.startDate, (byDate.get(e.startDate) ?? 0) + 1);
      if (e.isOnline) online++;
      if (e.startDate && e.startDate >= today) upcoming++;
      else if (e.startDate) past++;
    }

    const eventsOverTime = [...byDate.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const recentEvents = [...events]
      .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
      .filter((e) => e.startDate >= today)
      .slice(0, 25);

    return {
      totalEvents: events.length,
      uniqueCities: cities.size,
      uniqueCategories: byCategory.size,
      onlineShare: events.length ? online / events.length : 0,
      upcoming,
      past,
      byCategory: this.topBuckets(byCategory),
      byCity: this.topBuckets(byCity),
      byFormat: this.topBuckets(byFormat),
      eventsOverTime,
      recentEvents,
    };
  }
}

/** Singleton store shared across the process. */
export const store = new EventStore();
