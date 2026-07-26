// Shared domain types for the event analytics system.

/**
 * A normalized event record, as collected from a source (currently Eventbrite)
 * and stored for analytics. Source-specific fields are flattened into a stable
 * shape so the store and dashboard don't depend on any provider's schema.
 */
export interface EventRecord {
  /** Provider event id (stable, used for de-duplication). */
  id: string;
  /** Where this event was collected from. */
  source: "eventbrite";
  name: string;
  url: string;
  /** Event start date, YYYY-MM-DD. */
  startDate: string;
  /** Local start time, HH:mm (may be empty if not published). */
  startTime: string;
  /** Whether the event is held online vs in person. */
  isOnline: boolean;
  city: string | null;
  region: string | null;
  country: string | null;
  venue: string | null;
  /** High-level category, e.g. "Music", "Business", "Food & Drink". */
  category: string | null;
  /** Event format, e.g. "Concert or Performance", "Networking". */
  format: string | null;
  summary: string | null;
  image: string | null;
  /** When we collected this record (ISO timestamp). */
  scrapedAt: string;
}

/** A `{ label, count }` pair used for every breakdown in the analytics view. */
export interface Bucket {
  label: string;
  count: number;
}

/** Aggregated analytics returned by `GET /api/analytics`. */
export interface Analytics {
  totalEvents: number;
  uniqueCities: number;
  uniqueCategories: number;
  onlineShare: number; // 0..1 fraction of events that are online
  upcoming: number;
  past: number;
  byCategory: Bucket[];
  byCity: Bucket[];
  byFormat: Bucket[];
  eventsOverTime: Bucket[]; // label = YYYY-MM-DD
  recentEvents: EventRecord[];
}
