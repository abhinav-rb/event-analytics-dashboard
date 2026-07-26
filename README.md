# Event Analytics Dashboard

A simple, **end-to-end TypeScript** system that collects real-world events and displays analytics about them in a dashboard.

Built as a take-home assignment for the **Product Engineer** role at **Kamel Ride**.

## The Assignment

> Use TypeScript to build a simple system that collects events and displays analytics in a dashboard.

## What it does

1. **Collects events** by scraping public event listings from **Eventbrite** — no API key required. It reads the structured `schema.org/Event` data that Eventbrite already ships to the browser, so it's robust and doesn't depend on brittle HTML selectors.
2. **Stores** the normalized events in a lightweight in-memory store (no database, zero setup — data resets on restart, which is fine for the demo).
3. **Displays analytics** in a live React dashboard: totals, upcoming events, unique cities, category and city breakdowns, an events-over-time chart, and a feed of upcoming events linking back to Eventbrite.

Everything — the scraper, the API, and the dashboard — is written in **TypeScript**.

## How events are collected

Eventbrite's discovery pages (e.g. `eventbrite.com/d/ca--san-francisco/all-events/`) embed a
`window.__SERVER_DATA__` JSON blob containing the full search results. The scraper:

1. Fetches the discovery page HTML for a place (city slug) and page number.
2. Extracts the embedded JSON via a brace-matched parse (`server/src/scraper.ts`).
3. Normalizes each result into a provider-agnostic `EventRecord` — name, date, city, venue, category, format, online/in-person.
4. De-duplicates by event id and stores the results.

Events are collected two ways:

| Trigger | Endpoint | Notes |
| --- | --- | --- |
| **On demand** | `POST /api/scrape` | Pick a city in the dashboard and click **Collect events**. |
| **On startup** | (automatic) | The server scrapes San Francisco on boot so the dashboard is never empty. If the network/site is unavailable, it falls back to a bundled sample of **160 real events** (`server/src/fixtures/events.json`) so the demo always works. |

> **Note on scraping:** this reads publicly available, structured event data at low request volume for a demonstration. For production use you'd swap in Eventbrite's official API (or add a scheduler, caching, and rate limiting).

## Tech Stack

- **Language:** TypeScript (throughout — scraper, API, and dashboard)
- **Backend:** Node.js + Express
- **Frontend:** React + Vite + [Recharts](https://recharts.org/)
- **Storage:** In-memory (a `Map` keyed by event id — trivially swappable for SQLite/Postgres behind the same interface)
- **Tooling:** npm workspaces monorepo, `tsx` for dev

## Project structure

```
event-analytics-dashboard/
├── server/                   # Express API + scraper + store (TypeScript)
│   └── src/
│       ├── index.ts          # HTTP API: /scrape, /analytics, /events
│       ├── scraper.ts        # Eventbrite scraper + normalizer
│       ├── store.ts          # In-memory store + analytics aggregation
│       ├── capture-fixture.ts# Script to refresh the sample data
│       ├── fixtures/         # Bundled real-event sample (offline fallback)
│       └── types.ts          # Domain types
├── web/                      # React dashboard (TypeScript)
│   └── src/
│       ├── App.tsx           # Dashboard UI + charts
│       ├── api.ts            # API client
│       └── types.ts          # Shared response types
└── package.json              # npm workspaces root
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/scrape` | Collect events. Body: `{ "place": "ca--san-francisco", "pages": 2 }`. |
| `GET` | `/api/analytics` | Aggregated analytics (totals + breakdowns + time series). |
| `GET` | `/api/events?limit=100` | Raw normalized events (inspection/debugging). |
| `GET` | `/api/health` | Health check + current event count. |

## Getting Started

**Prerequisites:** Node.js 18+.

```bash
# 1. Install dependencies (installs both workspaces)
npm install

# 2. Start the API server (http://localhost:4000) — scrapes SF on boot
npm run dev:server

# 3. In a second terminal, start the dashboard (http://localhost:5173)
npm run dev:web
```

Open **http://localhost:5173** and use the city dropdown + **Collect events** to scrape more.

Collect events from the command line:

```bash
curl -X POST http://localhost:4000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"place":"ny--new-york","pages":2}'
```

Refresh the bundled sample data from live Eventbrite:

```bash
npm run capture
```

## Submission Details

- **Role:** Product Engineer @ Kamel Ride
- **Submit to:** ted@kamelride.com
- **Deliverable:** GitHub repository link + submission
- **Deadline:** Within 48 hours of receiving the assignment

---

_Questions about scope or requirements can be directed to the hiring contact (Ted)._
