import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAnalytics, scrape } from "./api";
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

const NAV = ["Overview", "All events", "Cities", "Categories", "Collect"];

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
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  const [place, setPlace] = useState(PLACES[0].slug);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "warn">("ok");

  const [cityFilter, setCityFilter] = useState<string>("all");
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const a = await fetchAnalytics();
      setAnalytics(a);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Initial load + poll analytics in place; tick a clock for "refreshed …".
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

  // ---- Derived view data -----------------------------------------------------
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

    // Busiest day, from the peak eventsOverTime bucket.
    const peak = analytics.eventsOverTime.reduce(
      (best, d) => (d.count > best.count ? d : best),
      { label: today, count: 0 },
    );

    const feedAll: EventRecord[] = analytics.recentEvents.filter(
      (e) => cityFilter === "all" || e.city === cityFilter,
    );
    const feed = feedAll.slice(0, FEED_LIMIT);

    return { total, days, maxDay, onToday, places, cats, cities, formats, peak, feed };
  }, [analytics, cityFilter, today]);

  const collectLabel = busy ? "Collecting…" : "Collect events";
  const refreshedText = relativeTime(lastUpdatedAt, now);
  const lastChecked = clock(
    `${new Date(lastUpdatedAt).getHours()}:${String(new Date(lastUpdatedAt).getMinutes()).padStart(2, "0")}`,
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
          {NAV.map((label, i) => (
            <div key={label} className={`nav-item${i === 0 ? " active" : ""}`}>
              <span className="nav-dot" />
              <span>{label}</span>
            </div>
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
            <h1 className="title">What's on</h1>
            <div className="subtitle">
              <span className="live-dot">
                <span className="live-ring" />
                <span className="live-core" />
              </span>
              <span>
                {(view?.total ?? 0).toLocaleString("en-US")} real events, across six places
              </span>
              <span className="slash">/</span>
              <span>refreshed {refreshedText}</span>
            </div>
          </div>

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
        </header>

        {status && <div className={`banner ${statusTone}`}>{status}</div>}

        {error && !analytics && (
          <div className="banner warn">
            Could not reach the API ({error}). Is the server running on port 4000?
          </div>
        )}

        {view && (
          <>
            {/* ---- KPI row ---- */}
            <section className="kpis">
              <Kpi label="Events" value={view.total.toLocaleString("en-US")} hint="collected from Eventbrite" />
              <Kpi label="On today" value={String(view.onToday)} hint="starting in the next few hours" />
              <Kpi label="Places" value={String(view.places)} hint="cities, plus online" />
              <Kpi label="Kinds" value={String(analytics!.uniqueCategories)} hint="music through to faith" />
              <Kpi
                label="Online"
                value={`${Math.round(analytics!.onlineShare * 100)}%`}
                hint="join from anywhere"
              />
            </section>

            {/* ---- Chart + categories ---- */}
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

                <div
                  className="plot"
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <div className="gridlines">
                    <div /><div /><div /><div />
                  </div>
                  {view.days.map((d, i) => (
                    <div
                      key={d.iso}
                      className="bar-col"
                      onMouseEnter={() => setHoveredDay(i)}
                    >
                      <div
                        className="bar"
                        style={{
                          height: `${((d.count / view.maxDay) * 100).toFixed(1)}%`,
                          background:
                            hoveredDay === i ? "#ffffff" : d.iso === today ? MINT_HI : MINT,
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
                  {view.cats.map((c) => (
                    <div key={c.label} className="bar-row">
                      <div className="bar-row-head">
                        <span className="bar-row-label">{c.label}</span>
                        <span className="bar-row-meta">
                          {c.count} <span className="mid">·</span> {c.pct}
                        </span>
                      </div>
                      <div className="track">
                        <div className="fill" style={{ width: c.w, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ---- Feed + right column ---- */}
            <section className="row row-1-62 align-start">
              <div className="card feed-card">
                <div className="card-head feed-head">
                  <div className="head-text">
                    <h2>Coming up next</h2>
                    <span className="head-sub">Soonest first · tap any event for tickets</span>
                  </div>
                  <div className="pills">
                    <Pill label="Everywhere" id="all" active={cityFilter === "all"} onClick={setCityFilter} />
                    {CITY_FILTERS.map((c) => (
                      <Pill key={c} label={c} id={c} active={cityFilter === c} onClick={setCityFilter} />
                    ))}
                  </div>
                </div>

                <div className="feed">
                  {view.feed.map((e) => (
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
                    {view.cities.map((c) => (
                      <div key={c.label} className="bar-row">
                        <div className="bar-row-head">
                          <span className="bar-row-label">{c.label}</span>
                          <span className="bar-row-meta">{c.count}</span>
                        </div>
                        <div className="track">
                          <div className="fill" style={{ width: c.w, background: c.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="head-text">
                    <h2>How people gather</h2>
                    <span className="head-sub">Parties, talks and shows lead</span>
                  </div>
                  <div className="format-list">
                    {view.formats.map((f) => (
                      <div key={f.label} className="format-row">
                        <span className="bar-row-label">{f.label}</span>
                        <span className="format-count">{f.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="callout">
                    <span className="callout-title">Busiest night</span>
                    <span className="callout-body">
                      {longDate(view.peak.label)} — {view.peak.count} events, the busiest day on the
                      calendar.
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {!view && !error && <p className="loading">Loading analytics…</p>}
      </main>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-hint">{hint}</span>
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
  const place = event.isOnline || event.city === "Online" ? "Online" : `${event.venue ?? ""}, ${event.city ?? ""}`;
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
