import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAnalytics, fetchEvents, scrape } from "./api";
import type { Analytics, EventRecord } from "./types";
import {
  MINT,
  MINT_HI,
  CITY_COLORS,
  catColor,
  clock,
  dayLabel,
  friendlyCat,
  friendlyFormat,
  initial,
  longDate,
  relativeTime,
  tint,
} from "./theme";

// Scrape targets — labels shown in the dropdown, slugs sent to /api/scrape.
const PLACES: Array<{ slug: string; label: string }> = [
  { slug: "ca--san-francisco", label: "San Francisco" },
  { slug: "ny--new-york", label: "New York" },
  { slug: "il--chicago", label: "Chicago" },
  { slug: "ca--los-angeles", label: "Los Angeles" },
  { slug: "tx--austin", label: "Austin" },
  { slug: "online", label: "Online" },
];

// Static feed filter pills (match the cities present in the data).
const CITY_FILTERS = ["San Francisco", "New York", "Brooklyn", "Chicago", "Online"];

type TabId = "overview" | "events" | "cities" | "categories" | "collect";
const TABS: Array<{ id: TabId; label: string; title: string; sub: string }> = [
  { id: "overview", label: "Overview", title: "What's on", sub: "" },
  { id: "events", label: "All events", title: "All events", sub: "Everything we've collected, soonest first" },
  { id: "cities", label: "Cities", title: "Cities", sub: "Where events are happening" },
  { id: "categories", label: "Categories", title: "Kinds of events", sub: "What people are putting on" },
  { id: "collect", label: "Collect", title: "Collect events", sub: "Pull the latest listings from Eventbrite" },
];

const REFRESH_MS = 5000;
const CHART_DAYS = 30;
const FEED_LIMIT = 9;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Continuous CHART_DAYS-day series from today, zero-filled for empty days. */
function buildDaySeries(analytics: Analytics, today: string) {
  const counts = new Map(analytics.eventsOverTime.map((d) => [d.label, d.count]));
  const start = new Date(today);
  const days: Array<{ iso: string; count: number }> = [];
  for (let i = 0; i < CHART_DAYS; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    days.push({ iso, count: counts.get(iso) ?? 0 });
  }
  return days;
}

export function App() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  const [tab, setTab] = useState<TabId>("overview");
  const [place, setPlace] = useState(PLACES[0].slug);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "warn">("ok");

  const [cityFilter, setCityFilter] = useState<string>("all");
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [a, ev] = await Promise.all([fetchAnalytics(), fetchEvents()]);
      setAnalytics(a);
      setAllEvents(ev.events);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Initial load + poll in place; tick a clock for "refreshed …".
  useEffect(() => {
    void load();
    const poll = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const collect = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const label = PLACES.find((p) => p.slug === place)?.label ?? "there";
    setStatusTone("ok");
    setStatus(`Looking for new events in ${label}…`);
    try {
      const result = await scrape(place, 2);
      setStatusTone("ok");
      setStatus(
        `Found ${result.added} event${result.added === 1 ? "" : "s"} we didn't have yet — ` +
          `${result.total.toLocaleString("en-US")} in the list now.`,
      );
      await load();
    } catch {
      setStatusTone("warn");
      setStatus("Couldn't reach Eventbrite just now — showing the events we already have.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const today = todayISO();

  // ---- Derived data for the Overview tab -------------------------------------
  const view = useMemo(() => {
    if (!analytics) return null;

    const total = analytics.totalEvents;
    const days = buildDaySeries(analytics, today);
    const maxDay = Math.max(1, ...days.map((d) => d.count));

    const onToday = analytics.eventsOverTime.find((d) => d.label === today)?.count ?? 0;
    const places = analytics.uniqueCities + (analytics.onlineShare > 0 ? 1 : 0);

    const catMax = analytics.byCategory[0]?.count ?? 1;
    const cats = analytics.byCategory.slice(0, 7).map((c) => ({
      label: friendlyCat(c.label),
      count: c.count,
      pct: `${Math.round((c.count / (total || 1)) * 100)}%`,
      w: `${((c.count / catMax) * 100).toFixed(0)}%`,
      color: catColor(c.label),
    }));

    const cityMax = analytics.byCity[0]?.count ?? 1;
    const cities = analytics.byCity.slice(0, 6).map((c, i) => ({
      label: c.label,
      count: c.count,
      w: `${((c.count / cityMax) * 100).toFixed(0)}%`,
      color: CITY_COLORS[i % CITY_COLORS.length],
    }));

    const formats = analytics.byFormat.slice(0, 5).map((f) => ({
      label: friendlyFormat(f.label),
      count: f.count,
    }));

    const peak = analytics.eventsOverTime.reduce(
      (best, d) => (d.count > best.count ? d : best),
      { label: today, count: 0 },
    );

    const feed = analytics.recentEvents
      .filter((e) => cityFilter === "all" || e.city === cityFilter)
      .slice(0, FEED_LIMIT);

    return { total, days, maxDay, onToday, places, cats, cities, formats, peak, feed };
  }, [analytics, cityFilter, today]);

  const meta = TABS.find((t) => t.id === tab)!;
  const collectLabel = busy ? "Collecting…" : "Collect events";
  const refreshedText = relativeTime(lastUpdatedAt, now);
  const lastChecked = clock(
    `${new Date(lastUpdatedAt).getHours()}:${String(new Date(lastUpdatedAt).getMinutes()).padStart(2, "0")}`,
  );

  const collectControl = (
    <div className="collect">
      <div className="collect-field">
        <span className="collect-label">Look for events in</span>
        <select
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          disabled={busy}
          aria-label="City to collect events from"
        >
          {PLACES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button className="collect-btn" onClick={collect} disabled={busy}>
        {busy && <span className="spinner" />}
        <span>{collectLabel}</span>
      </button>
    </div>
  );

  return (
    <div className="layout">
      {/* ---- Sidebar ---- */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <div />
          </div>
          <div className="brand-text">
            <span className="brand-name">Kamel Ride</span>
            <span className="brand-sub">Events</span>
          </div>
        </div>

        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-item${t.id === tab ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-dot" />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="status-card">
            <div className="status-head">
              <span className="pulse-dot" />
              <span className="status-title">Up to date</span>
            </div>
            <div className="status-line">
              {(view?.total ?? 0).toLocaleString("en-US")} events in the list, gathered from Eventbrite.
            </div>
            <div className="status-line">Last checked {lastChecked}.</div>
          </div>
          <div className="sidebar-note">The list rebuilds itself each time you collect.</div>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <main className="main">
        <header className="topbar">
          <div className="title-block">
            <h1 className="title">{meta.title}</h1>
            <div className="subtitle">
              <span className="live-dot">
                <span className="live-ring" />
                <span className="live-core" />
              </span>
              <span>
                {tab === "overview"
                  ? `${(view?.total ?? 0).toLocaleString("en-US")} real events, across six places`
                  : meta.sub}
              </span>
              <span className="slash">/</span>
              <span>refreshed {refreshedText}</span>
            </div>
          </div>

          {tab !== "collect" && collectControl}
        </header>

        {status && <div className={`banner ${statusTone}`}>{status}</div>}

        {error && !analytics && (
          <div className="banner warn">
            Could not reach the API ({error}). Is the server running on port 4000?
          </div>
        )}

        {!analytics && !error && <p className="loading">Loading analytics…</p>}

        {analytics && view && tab === "overview" && (
          <Overview
            view={view}
            analytics={analytics}
            today={today}
            hoveredDay={hoveredDay}
            setHoveredDay={setHoveredDay}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
          />
        )}

        {analytics && tab === "events" && (
          <AllEvents
            events={allEvents}
            today={today}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
          />
        )}

        {analytics && tab === "cities" && <Cities analytics={analytics} />}

        {analytics && tab === "categories" && <Categories analytics={analytics} />}

        {tab === "collect" && (
          <Collect
            control={collectControl}
            places={PLACES}
            total={view?.total ?? 0}
            lastChecked={lastChecked}
          />
        )}
      </main>
    </div>
  );
}

// ---- Overview tab (the full dashboard) ---------------------------------------

function Overview({
  view,
  analytics,
  today,
  hoveredDay,
  setHoveredDay,
  cityFilter,
  setCityFilter,
}: {
  view: any;
  analytics: Analytics;
  today: string;
  hoveredDay: number | null;
  setHoveredDay: (i: number | null) => void;
  cityFilter: string;
  setCityFilter: (id: string) => void;
}) {
  return (
    <>
      <section className="kpis">
        <Kpi label="Events" value={view.total.toLocaleString("en-US")} hint="collected from Eventbrite" />
        <Kpi label="On today" value={String(view.onToday)} hint="starting in the next few hours" />
        <Kpi label="Places" value={String(view.places)} hint="cities, plus online" />
        <Kpi label="Kinds" value={String(analytics.uniqueCategories)} hint="music through to faith" />
        <Kpi label="Online" value={`${Math.round(analytics.onlineShare * 100)}%`} hint="join from anywhere" />
      </section>

      <section className="row row-1-62">
        <div className="card chart-card">
          <div className="card-head">
            <div className="head-text">
              <h2>When they're happening</h2>
              <span className="head-sub">Events per day, from today onward</span>
            </div>
            <div className="legend">
              <span className="legend-item">
                <span className="sw" style={{ background: MINT }} />
                on sale
              </span>
              <span className="legend-item">
                <span className="sw" style={{ background: MINT_HI }} />
                today
              </span>
            </div>
          </div>

          <div className="plot" onMouseLeave={() => setHoveredDay(null)}>
            <div className="gridlines">
              <div /><div /><div /><div />
            </div>
            {view.days.map((d: { iso: string; count: number }, i: number) => (
              <div key={d.iso} className="bar-col" onMouseEnter={() => setHoveredDay(i)}>
                <div
                  className="bar"
                  style={{
                    height: `${((d.count / view.maxDay) * 100).toFixed(1)}%`,
                    background: hoveredDay === i ? "#ffffff" : d.iso === today ? MINT_HI : MINT,
                  }}
                />
              </div>
            ))}
            {hoveredDay != null && (
              <div
                className="tip"
                style={{ left: `${(((hoveredDay + 0.5) / CHART_DAYS) * 100).toFixed(2)}%` }}
              >
                <div className="tip-day">{dayLabel(view.days[hoveredDay].iso, today)}</div>
                <div className="tip-val">
                  {view.days[hoveredDay].count === 0
                    ? "Nothing on"
                    : view.days[hoveredDay].count === 1
                      ? "1 event"
                      : `${view.days[hoveredDay].count} events`}
                </div>
              </div>
            )}
          </div>

          <div className="axis">
            <span>Today</span>
            <span>This weekend</span>
            <span>Next week</span>
            <span>Mid-August</span>
            <span>Late August</span>
          </div>
        </div>

        <div className="card">
          <div className="head-text">
            <h2>What kind of events</h2>
            <span className="head-sub">Music is running away with it</span>
          </div>
          <div className="bars-list">
            {view.cats.map((c: any) => (
              <BarRow key={c.label} label={c.label} color={c.color} width={c.w} meta={`${c.count} · ${c.pct}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="row row-1-62 align-start">
        <div className="card feed-card">
          <div className="card-head feed-head">
            <div className="head-text">
              <h2>Coming up next</h2>
              <span className="head-sub">Soonest first · tap any event for tickets</span>
            </div>
            <CityPills value={cityFilter} onChange={setCityFilter} />
          </div>

          <div className="feed">
            {view.feed.map((e: EventRecord) => (
              <FeedRow key={e.id} event={e} today={today} />
            ))}
          </div>
          <div className="feed-foot">
            {view.feed.length
              ? `Showing the next ${view.feed.length} of ${view.total.toLocaleString("en-US")} events`
              : "Nothing here yet — try collecting events for this place."}
          </div>
        </div>

        <div className="right-col">
          <div className="card">
            <div className="head-text">
              <h2>Where they are</h2>
              <span className="head-sub">One in four happens online</span>
            </div>
            <div className="bars-list">
              {view.cities.map((c: any) => (
                <BarRow key={c.label} label={c.label} color={c.color} width={c.w} meta={String(c.count)} />
              ))}
            </div>
          </div>

          <div className="card">
            <div className="head-text">
              <h2>How people gather</h2>
              <span className="head-sub">Parties, talks and shows lead</span>
            </div>
            <div className="format-list">
              {view.formats.map((f: any) => (
                <div key={f.label} className="format-row">
                  <span className="bar-row-label">{f.label}</span>
                  <span className="format-count">{f.count}</span>
                </div>
              ))}
            </div>
            <div className="callout">
              <span className="callout-title">Busiest night</span>
              <span className="callout-body">
                {longDate(view.peak.label)} — {view.peak.count} events, the busiest day on the calendar.
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---- All events tab ----------------------------------------------------------

function AllEvents({
  events,
  today,
  cityFilter,
  setCityFilter,
}: {
  events: EventRecord[];
  today: string;
  cityFilter: string;
  setCityFilter: (id: string) => void;
}) {
  const rows = useMemo(() => {
    return events
      .filter((e) => cityFilter === "all" || e.city === cityFilter)
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.startTime.localeCompare(b.startTime)
          : a.startDate.localeCompare(b.startDate),
      );
  }, [events, cityFilter]);

  return (
    <div className="card feed-card">
      <div className="card-head feed-head">
        <div className="head-text">
          <h2>All events</h2>
          <span className="head-sub">
            {rows.length.toLocaleString("en-US")} of {events.length.toLocaleString("en-US")} events
          </span>
        </div>
        <CityPills value={cityFilter} onChange={setCityFilter} />
      </div>
      <div className="feed feed-scroll">
        {rows.map((e) => (
          <FeedRow key={e.id} event={e} today={today} />
        ))}
      </div>
      <div className="feed-foot">
        {rows.length ? `${rows.length} events` : "Nothing here yet — try collecting events for this place."}
      </div>
    </div>
  );
}

// ---- Cities tab --------------------------------------------------------------

function Cities({ analytics }: { analytics: Analytics }) {
  const max = analytics.byCity[0]?.count ?? 1;
  return (
    <div className="card panel-narrow">
      <div className="head-text">
        <h2>Cities</h2>
        <span className="head-sub">Where events are happening, most first</span>
      </div>
      <div className="bars-list">
        {analytics.byCity.map((c, i) => (
          <BarRow
            key={c.label}
            label={c.label}
            color={CITY_COLORS[i % CITY_COLORS.length]}
            width={`${((c.count / max) * 100).toFixed(0)}%`}
            meta={String(c.count)}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Categories tab ----------------------------------------------------------

function Categories({ analytics }: { analytics: Analytics }) {
  const max = analytics.byCategory[0]?.count ?? 1;
  const total = analytics.totalEvents || 1;
  return (
    <div className="card panel-narrow">
      <div className="head-text">
        <h2>Kinds of events</h2>
        <span className="head-sub">Every category we've seen, most first</span>
      </div>
      <div className="bars-list">
        {analytics.byCategory.map((c) => (
          <BarRow
            key={c.label}
            label={friendlyCat(c.label)}
            color={catColor(c.label)}
            width={`${((c.count / max) * 100).toFixed(0)}%`}
            meta={`${c.count} · ${Math.round((c.count / total) * 100)}%`}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Collect tab -------------------------------------------------------------

function Collect({
  control,
  places,
  total,
  lastChecked,
}: {
  control: React.ReactNode;
  places: Array<{ slug: string; label: string }>;
  total: number;
  lastChecked: string;
}) {
  return (
    <div className="card panel-narrow collect-panel">
      <div className="head-text">
        <h2>Collect events</h2>
        <span className="head-sub">Pull the latest listings straight from Eventbrite</span>
      </div>
      <p className="prose">
        Pick a place and we'll scrape its public Eventbrite listings, normalize each one, and fold any
        new events into the list. Nothing is duplicated — collecting the same place twice only adds
        what's new.
      </p>
      {control}
      <div className="collect-meta">
        <div className="collect-places">
          {places.map((p) => (
            <span key={p.slug} className="place-chip">
              {p.label}
            </span>
          ))}
        </div>
        <div className="status-line">
          {total.toLocaleString("en-US")} events in the list · last checked {lastChecked}.
        </div>
      </div>
    </div>
  );
}

// ---- Shared building blocks --------------------------------------------------

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-hint">{hint}</span>
    </div>
  );
}

function BarRow({ label, color, width, meta }: { label: string; color: string; width: string; meta: string }) {
  return (
    <div className="bar-row">
      <div className="bar-row-head">
        <span className="bar-row-label">{label}</span>
        <span className="bar-row-meta">{meta}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width, background: color }} />
      </div>
    </div>
  );
}

function CityPills({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="pills">
      <Pill label="Everywhere" id="all" active={value === "all"} onClick={onChange} />
      {CITY_FILTERS.map((c) => (
        <Pill key={c} label={c} id={c} active={value === c} onClick={onChange} />
      ))}
    </div>
  );
}

function Pill({
  label,
  id,
  active,
  onClick,
}: {
  label: string;
  id: string;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button className={`pill${active ? " active" : ""}`} onClick={() => onClick(id)}>
      {label}
    </button>
  );
}

function FeedRow({ event, today }: { event: EventRecord; today: string }) {
  const [imgOk, setImgOk] = useState(true);
  const color = catColor(event.category);
  const place =
    event.isOnline || event.city === "Online" ? "Online" : `${event.venue ?? ""}, ${event.city ?? ""}`;
  const isToday = event.startDate === today;

  return (
    <a className="feed-row" href={event.url} target="_blank" rel="noreferrer">
      <div className="thumb" style={{ background: tint(color) }}>
        <span className="thumb-initial" style={{ color }}>
          {initial(event.name)}
        </span>
        {imgOk && event.image && (
          <img
            src={event.image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
          />
        )}
      </div>
      <div className="feed-mid">
        <span className="feed-name">{event.name}</span>
        <div className="feed-meta">
          <span className="feed-cat">
            <span className="cat-dot" style={{ background: color }} />
            <span>{friendlyCat(event.category)}</span>
          </span>
          <span className="mid">·</span>
          <span className="feed-place">{place}</span>
        </div>
      </div>
      <div className="feed-right">
        <span className="feed-day" style={{ color: isToday ? MINT_HI : "#c6cbd2" }}>
          {dayLabel(event.startDate, today)}
        </span>
        <span className="feed-time">{clock(event.startTime)}</span>
      </div>
    </a>
  );
}
