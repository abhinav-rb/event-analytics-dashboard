import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAnalytics, scrape } from "./api";
import type { Analytics } from "./types";

// Eventbrite place slugs offered in the collect dropdown.
const PLACES: Array<{ slug: string; label: string }> = [
  { slug: "ca--san-francisco", label: "San Francisco" },
  { slug: "ny--new-york", label: "New York" },
  { slug: "il--chicago", label: "Chicago" },
  { slug: "ca--los-angeles", label: "Los Angeles" },
  { slug: "tx--austin", label: "Austin" },
  { slug: "online", label: "Online" },
];

const tooltipStyle = {
  background: "#1b2340",
  border: "1px solid #263155",
  borderRadius: 8,
  color: "#e8ecf6",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export function App() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState(PLACES[0].slug);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchAnalytics());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const collect = async () => {
    setBusy(true);
    setStatus(`Scraping ${place}…`);
    try {
      const result = await scrape(place, 2);
      setStatus(`Added ${result.added} new events (${result.total} total).`);
      await load();
    } catch (err) {
      setStatus(`Failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const catData = data?.byCategory ?? [];
  const cityData = data?.byCity ?? [];
  const timeData =
    data?.eventsOverTime.map((d) => ({ date: d.label.slice(5), count: d.count })) ?? [];

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Event Analytics Dashboard</h1>
          <p>Collects real events from Eventbrite and visualizes them · Kamel Ride take-home</p>
        </div>
        <div className="toolbar">
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
          <button onClick={collect} disabled={busy}>
            {busy ? "Collecting…" : "Collect events"}
          </button>
        </div>
      </header>

      {status && <p className="status">{status}</p>}

      {error && (
        <div className="panel" style={{ borderColor: "#a33", marginBottom: 16 }}>
          Could not reach the API ({error}). Is the server running on port 4000?
        </div>
      )}

      {data && (
        <>
          <section className="cards">
            <StatCard label="Total events" value={data.totalEvents.toLocaleString()} />
            <StatCard label="Upcoming" value={data.upcoming.toLocaleString()} />
            <StatCard label="Cities" value={data.uniqueCities} />
            <StatCard label="Categories" value={data.uniqueCategories} />
            <StatCard label="Online" value={`${Math.round(data.onlineShare * 100)}%`} />
          </section>

          <section className="grid" style={{ marginBottom: 16 }}>
            <div className="panel">
              <h2>Events by category</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={catData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="#263155" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#93a0c0" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" stroke="#93a0c0" fontSize={11} width={140} />
                  <Tooltip cursor={{ fill: "#1b2340" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#38d39f" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2>Top cities</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cityData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="#263155" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#93a0c0" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" stroke="#93a0c0" fontSize={11} width={100} />
                  <Tooltip cursor={{ fill: "#1b2340" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#5b8cff" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Events over time (by start date)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timeData}>
                <CartesianGrid stroke="#263155" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#93a0c0" fontSize={11} />
                <YAxis stroke="#93a0c0" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#5b8cff" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="panel">
            <h2>Upcoming events</h2>
            <ul className="feed">
              {data.recentEvents.map((e) => (
                <li key={e.id}>
                  <a className="type" href={e.url} target="_blank" rel="noreferrer">
                    {e.name}
                  </a>
                  <span className="meta">
                    {e.category ?? "—"} · {e.city ?? "—"} · {e.startDate}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {!data && !error && <p className="status">Loading analytics…</p>}
    </div>
  );
}
