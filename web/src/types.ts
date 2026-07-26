// Mirror of the server's response shapes (kept small and local to avoid a
// shared-package build step for the demo).

export interface EventRecord {
  id: string;
  source: string;
  name: string;
  url: string;
  startDate: string;
  startTime: string;
  isOnline: boolean;
  city: string | null;
  region: string | null;
  country: string | null;
  venue: string | null;
  category: string | null;
  format: string | null;
  summary: string | null;
  image: string | null;
  scrapedAt: string;
}

export interface Bucket {
  label: string;
  count: number;
}

export interface Analytics {
  totalEvents: number;
  uniqueCities: number;
  uniqueCategories: number;
  onlineShare: number;
  upcoming: number;
  past: number;
  byCategory: Bucket[];
  byCity: Bucket[];
  byFormat: Bucket[];
  eventsOverTime: Bucket[];
  recentEvents: EventRecord[];
}
