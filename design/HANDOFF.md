# Handoff: Event Analytics Dashboard — consumer-friendly redesign

## Overview
A redesign of the dashboard in `web/src/App.tsx`. Same system, same endpoints, same data — but presented for a general audience rather than a developer: plain-language headings, friendly date/time formatting, human category names, and event thumbnails in the upcoming feed.

The design assumes the current backend (`server/src/`): events are **real listings collected from Eventbrite**, normalized to `EventRecord`, aggregated by `store.analytics()` into the `Analytics` shape. Nothing in this design needs a server change.

## About the Design Files
`Event Dashboard Final.dc.html` is a **design reference created in HTML** — a working prototype of the intended look, copy, and interaction, with a hardcoded snapshot of the real fixture data. It is not production code to copy.

Recreate it in the existing `web` workspace: React 18 + Vite + TypeScript, with Recharts already installed. The prototype hand-rolls its bar chart with flex divs; in the app, use Recharts (`BarChart` for the day histogram, horizontal `BarChart` or plain divs for the breakdowns) styled to match the values below.

Also in this bundle: `Event Dashboard.dc.html`, the earlier ride-hailing-events version, kept only as history — **build from `Event Dashboard Final.dc.html`**.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and copy are final. Interactions in the prototype (collect flow with busy state, chart hover tooltip, city filter on the feed) should behave the same way.

---

## Data contract (already implemented server-side)

From `GET /api/analytics` → `Analytics`:
`totalEvents`, `upcoming`, `past`, `uniqueCities`, `uniqueCategories`, `onlineShare` (0..1), `byCategory[]`, `byCity[]`, `byFormat[]` (each `{label, count}`, top 12, largest first), `eventsOverTime[]` (`label` = `YYYY-MM-DD`, ascending), `recentEvents[]` (next 25 upcoming `EventRecord`s).

`POST /api/scrape` with `{ place, pages }` → `{ scraped, added, total, place }`. Place slugs come from the `PLACES` list already in `App.tsx` (`ca--san-francisco`, `ny--new-york`, `il--chicago`, `ca--los-angeles`, `tx--austin`, `online`).

Numbers shown in the prototype are the bundled fixture: 160 events, all upcoming, 6 cities + online, 19 categories, 25% online; Music 59 / Community & Culture 17 / Business & Professional 16 / Food & Drink 11 / Health & Wellness 11 / Charity & Causes 9 / Performing & Visual Arts 8; SF 40 / Online 40 / Chicago 38 / New York 18 / Brooklyn 18 / Queens 4; peak day 2026-08-01 with 20 events.

### Copy translation layer (important)
The UI never shows a raw provider string where a friendlier one exists. Keep this as one shared map:

| Raw (`category`) | Shown |
| --- | --- |
| Community & Culture | Community |
| Business & Professional | Business |
| Performing & Visual Arts | Arts & theatre |
| Film, Media & Entertainment | Film & media |
| Auto, Boat & Air | On the water |
| Religion & Spirituality | Faith |
| Family & Education | Family |
| Sports & Fitness | Sport |
| Other / `null` | Something else |
| (all others) | verbatim |

Formats are relabelled in the same spirit: Party or Social Gathering → **Parties & socials**, Seminar or Talk → **Talks & seminars**, Concert or Performance → **Concerts & shows**, Class/Training/Workshop → **Classes & workshops**, Festival or Fair → **Festivals & fairs**.

Dates: `startDate === today` → "Today"; +1 day → "Tomorrow"; within 7 days → weekday ("Fri"); beyond → "Sat Aug 15". Times: 24h `HH:mm` → "3 PM" / "6:30 PM" (drop `:00`).

---

## Screen: Overview (single page)

```
display: grid; grid-template-columns: 224px 1fr
min-height: 100vh; background: #0a0b0d; color: #e9eaee
font-family: 'Instrument Sans', Helvetica, sans-serif
```

### 1. Sidebar
`border-right: 1px solid rgba(255,255,255,.07)`, `padding: 22px 16px`, sticky full-height, vertical flex `gap: 26px`.
- **Brand**: 26×26 mint (`oklch(0.80 0.14 158)`) rounded square (radius 8) holding an 8×8 radius-2 `#0a0b0d` square; "Kamel Ride" 13px/600/`-0.01em`; "EVENTS" 10px `#7c828c` uppercase `letter-spacing: .06em`.
- **Nav** (gap 2px): Overview (active), All events, Cities, Categories, Collect. Row `padding: 8px 10px`, radius 8, 13.5px, 5px leading dot. Active: bg `rgba(255,255,255,.06)`, `#fff`, weight 600, mint dot. Inactive: `#8a9099`, weight 400, dot `rgba(255,255,255,.18)`, hover bg `rgba(255,255,255,.05)`.
- **Status card** (`margin-top: auto`): card surface `#101215`, `1px solid rgba(255,255,255,.07)`, radius 10, `padding: 12px`. Pulsing 6px mint dot + "UP TO DATE" (11px `#8a9099`, uppercase, `.04em`); "160 events in the list, gathered from Eventbrite." and "Last checked 4:50 PM." (11.5px `#616872`). Drive the count from `/api/health` and the time from the last successful scrape/poll.
- Below the card: "The list rebuilds itself each time you collect." 10.5px `#4d545d`.

### 2. Header
Flex, `align-items: flex-end`, space-between, wraps.
- Title **"What's on"** — 25px/600/`-0.02em`.
- Status line 12.5px `#7c828c`: animated live dot (7px mint + a duplicate running `ringOut`), "160 real events, across six places", `#3c424a` slash, "refreshed a few seconds ago".
- **Collect control** — grouped field: `1px solid rgba(255,255,255,.08)`, radius 9, bg `#101215`, `padding: 6px 8px 6px 12px`; label "Look for events in" 11.5px `#7c828c`; `<select>` bg `#191d21`, `1px solid rgba(255,255,255,.09)`, radius 7, 12.5px/500, `padding: 5px 8px`. Options are the six `PLACES` labels.
- **Collect events button** — mint fill, text `#08150f`, 12.5px/600, `padding: 9px 16px`, radius 9; hover `oklch(0.86 0.13 158)`. Busy state: label "Collecting…" plus an 11px spinner (2px border, `rgba(8,21,15,.35)` with `#08150f` top, `spin .7s linear infinite`); button ignores clicks while busy.
- **Status banner** (below header, only when a scrape has run): `1px solid rgba(127,224,176,.22)`, bg `rgba(127,224,176,.07)`, radius 10, `padding: 11px 14px`, 12.5px `oklch(0.86 0.10 158)`. Copy: "Looking for new events in San Francisco…" then "Found 12 events we didn't have yet — 172 in the list now." Use the real `{added, total}` from the scrape response; on failure show the same banner in amber (`#e0a06a`, border `rgba(224,160,106,.25)`) with "Couldn't reach Eventbrite just now — showing the events we already have."

### 3. KPI row
`grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px`. Card: `#101215`, `1px solid rgba(255,255,255,.07)`, radius 12, `padding: 16px 18px`, vertical flex `gap: 9px`, `min-width: 0`. Label 11px `#7c828c` uppercase `.05em` (ellipsis); value `clamp(20px,1.9vw,29px)`/600/`-0.03em`; hint 11.5px `#5c636c`.

| Label | Value | Hint | Source |
| --- | --- | --- | --- |
| Events | 160 | collected from Eventbrite | `totalEvents` |
| On today | 18 | starting in the next few hours | count of `startDate === today` |
| Places | 6 | cities, plus online | `uniqueCities` (+1 if any online) |
| Kinds | 19 | music through to faith | `uniqueCategories` |
| Online | 25% | join from anywhere | `round(onlineShare*100)` |

Keep labels short — long ones truncate at this column width.

### 4. Chart + categories
`grid-template-columns: 1.62fr 1fr; gap: 12px`.

**"When they're happening"** / sub "Events per day, from today onward" — card, `padding: 18px 20px 14px`, vertical flex `gap: 18px`.
- Legend 11px `#7c828c`: mint swatch "on sale", `oklch(0.86 0.13 158)` swatch "today".
- Plot 184px tall; 4 evenly spaced `1px solid rgba(255,255,255,.05)` gridlines behind; bars `flex: 1 1 0`, `gap: 4px`, radius `3px 3px 0 0`, `min-height: 2px` so empty days still register, height as % of the max day, `transition: height .35s cubic-bezier(.2,.8,.2,1)`. Fill mint; today's bar `oklch(0.86 0.13 158)`; hovered bar `#ffffff`.
- Tooltip: `#1b1f24`, `1px solid rgba(255,255,255,.12)`, radius 8, `padding: 8px 11px`, `box-shadow: 0 8px 24px rgba(0,0,0,.5)`, centred on the bar, `top: -4px`. Line 1 = friendly day label (11px `#8a9099`), line 2 = "20 events" / "1 event" / "Nothing on" (14px/600).
- Axis strip 11px `#5c636c`, space-between: Today · This weekend · Next week · Mid-August · Late August.
- Window: the next 30 days (the prototype covers 2026-07-26 → 08-24; the fixture also has 8 events further out — either extend the window or note them).

**"What kind of events"** / sub "Music is running away with it" — card, `padding: 18px 20px`, `gap: 15px`; top 7 of `byCategory`. Each row: friendly label 12.5px `#c6cbd2` (ellipsis) + right side "59 · 37%" (11px `#7c828c`, tabular nums, `flex: none`, middle dot `#4d545d`); track 5px radius 3 bg `rgba(255,255,255,.05)`, fill width **relative to the largest category**, `transition: width .4s cubic-bezier(.2,.8,.2,1)`.

Category colors (all chroma .14, lightness ~.78): Music `oklch(0.80 0.14 158)`, Community `oklch(0.78 0.14 235)`, Business `oklch(0.82 0.14 92)`, Food & Drink `oklch(0.76 0.14 305)`, Health & Wellness `oklch(0.78 0.14 200)`, Charity `oklch(0.78 0.14 25)`, Arts & theatre `oklch(0.76 0.14 265)`, fallback `oklch(0.68 0.02 250)`.

### 5. Feed + right column
`grid-template-columns: 1.62fr 1fr; gap: 12px; align-items: start`.

**"Coming up next"** / sub "Soonest first · tap any event for tickets"
- Header `padding: 18px 20px 14px`; filter pills on the right, wrapping: **Everywhere / San Francisco / New York / Brooklyn / Chicago / Online**. Pill: radius 20, `padding: 4px 11px`, 11.5px. Selected: bg `rgba(127,224,176,.12)`, border `rgba(127,224,176,.35)`, mint text. Unselected: transparent, border `rgba(255,255,255,.09)`, `#7c828c`.
- Rows are `<a href={event.url} target="_blank" rel="noreferrer">`: flex, `gap: 13px`, `padding: 12px 20px`, `border-bottom: 1px solid rgba(255,255,255,.04)`, hover bg `rgba(255,255,255,.03)`, inherited color, no underline.
  - **Thumbnail** 46×46, radius 9, `flex: none`, `overflow: hidden`, `position: relative`, centered content. Background is a category tint: `color-mix(in oklab, <category color> 16%, #1b1f24)`, with the event's first alphanumeric character at 17px/600 in the category color. The `EventRecord.image` URL is layered over it absolutely (`inset: 0`, `object-fit: cover`, `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`) and **hidden on `onError`**, so a missing or expired image degrades to the tinted initial instead of an empty tile. Eventbrite image URLs are signed and can expire — keep this fallback.
  - **Middle** (`min-width: 0`, `flex: 1`): name 13.5px/500 `#eef0f3`, ellipsis; meta line = 6px category dot + friendly category 11.5px `#8a9099`, `#3c424a` middle dot, then `venue, city` (or "Online") 11.5px `#6b727b`, ellipsis.
  - **Right** (`flex: none`, right-aligned): day 12px/500 — `oklch(0.86 0.13 158)` when today, else `#c6cbd2`; time 11.5px `#616872`.
- Footer `padding: 12px 20px`, 11.5px `#5c636c`: "Showing the next 9 of 160 events"; when a filter empties the list: "Nothing here yet — try collecting events for this place."
- The prototype shows 9 rows; the API returns 25 — paginate or scroll, your call.

**"Where they are"** / sub "One in four happens online" — same bar-row pattern as categories (count only, no percentage), top 6 of `byCity`, colors mint / blue / amber / violet / teal / grey.

**"How people gather"** / sub "Parties, talks and shows lead" — top 5 of `byFormat` as simple rows: `padding: 8px 0`, `border-bottom: 1px solid rgba(255,255,255,.04)`, label 12.5px `#c6cbd2`, count 12px `#8a9099` tabular.
- Callout below: bg `rgba(127,224,176,.07)`, `1px solid rgba(127,224,176,.18)`, radius 10, `padding: 12px 14px`. Title "Busiest night" 12.5px/600 `oklch(0.86 0.10 158)`; body 11.5px `#8a9099`: "Saturday August 1st — 20 events, mostly parties in Chicago and Brooklyn." Compute from the peak `eventsOverTime` bucket.

---

## Interactions & Behavior
- **Collect** — `POST /api/scrape` with the selected place slug and `pages: 2`; button shows spinner + "Collecting…", banner shows progress then the result, then re-fetch analytics. Disable the select while busy.
- **Chart hover** — full-height column is the hit area; sets hovered index (bar white + tooltip), clears on leave.
- **City filter** — filters `recentEvents` client-side by `city`; footer count follows; "Everywhere" resets.
- **Auto-refresh** — poll `/api/analytics` every 5s, re-render in place, no spinner; update the "refreshed …" text from the last success.
- **Event row** — opens `EventRecord.url` in a new tab.
- **Animations** — `pulseDot` 2s ease-in-out infinite (sidebar dot); `ringOut` 2s ease-out infinite, scale .6→2.4 / opacity .7→0 (header live dot); `spin` .7s linear infinite (button spinner).
- **States to add in production** — skeletons for the 5 KPI cards, chart, and first 5 feed rows on cold load; the amber error banner above; empty state when the store is empty ("No events yet — pick a city and collect some.").
- **Responsive** — under ~1100px both two-column rows stack and the KPI grid becomes `repeat(auto-fit, minmax(145px,1fr))`; under ~840px the sidebar becomes a top bar.

## State Management
- `analytics: Analytics | null`, `error: string | null`, `lastUpdatedAt`.
- `place: string` (scrape target slug) — default `ca--san-francisco`.
- `busy: boolean`, `status: string | null` (collect flow).
- `cityFilter: string` — `'all'` default.
- `hoveredDay: number | null`.
- Derived: day series + max, KPI figures, bar widths (relative to each breakdown's own max), filtered feed, friendly labels/dates.

## Design Tokens
**Color** — page `#0a0b0d`; card `#101215`; raised `#1b1f24`; control `#191d21`; hover washes `rgba(255,255,255,.03)`–`.06`. Borders: card `rgba(255,255,255,.07)`, control `rgba(255,255,255,.08)`/`.09`, divider `rgba(255,255,255,.04)`, gridline `rgba(255,255,255,.05)`. Text: `#e9eaee` primary, `#eef0f3`/`#fff` strong, `#c6cbd2` secondary, `#8a9099` muted, `#7c828c` dim, `#6b727b`/`#616872` faint, `#5c636c`/`#4d545d` faintest, `#3c424a` separators. Accents: mint `oklch(0.80 0.14 158)`, mint hi `oklch(0.86 0.13 158)`, mint text `oklch(0.86 0.10 158)`, mint tints `rgba(127,224,176,.07/.12/.18/.22/.35)`, on-mint text `#08150f`; categorical blue `oklch(0.78 0.14 235)`, amber `oklch(0.82 0.14 92)`, violet `oklch(0.76 0.14 305)`, teal `oklch(0.78 0.14 200)`, red `oklch(0.78 0.14 25)`, indigo `oklch(0.76 0.14 265)`, grey `oklch(0.68 0.02 250)`; warning `#e0a06a`.

**Typography** — Instrument Sans 400/500/600 (Google Fonts). Sizes 25 / 17 / 14.5 / 13.5 / 13 / 12.5 / 12 / 11.5 / 11 / 10.5 / 10px. Tracking −0.02em title, −0.03em KPI values, −0.01em card headings, +.04–.06em uppercase labels. Tabular numerals on all counts.

**Spacing** — 2 / 3 / 4 / 5 / 6 / 7 / 9 / 10 / 12 / 13 / 14 / 15 / 16 / 18 / 20 / 22 / 26 / 32px. Card padding `18px 20px`; page `26px 32px 40px`; grid gap 12px.

**Radius** — 2 / 3 (bars) / 7 / 8 / 9 (thumbs, buttons) / 10 / 12 (cards) / 20 (pills) / 50%.

**Shadow** — tooltip only: `0 8px 24px rgba(0,0,0,.5)`.

**Motion** — `.35s cubic-bezier(.2,.8,.2,1)` bar height, `.4s` same curve bar width, `.15s` color, 2s ambient loops, `.7s` spinner.

## Assets
No local assets. Thumbnails come from `EventRecord.image` (Eventbrite CDN, signed URLs) — always paired with the tinted-initial fallback described above. Every other mark is a CSS shape; no icon set. If you add icons, use whatever the codebase already has.

## Files
- `Event Dashboard Final.dc.html` — **build from this.** Full prototype, opens directly in a browser.
- `Event Dashboard.dc.html` — earlier ride-hailing-events version, history only.
- `source-project-README.md` — project README (note: it still describes the pre-Eventbrite seed/tracker design; the code in `server/src` is the source of truth).
