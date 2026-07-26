// Design tokens + copy-translation layer for the dashboard.
// Mirrors the handoff in design/HANDOFF.md: the UI never shows a raw provider
// string where a friendlier one exists, and every category has a stable color.

export const MINT = "oklch(0.80 0.14 158)";
export const MINT_HI = "oklch(0.86 0.13 158)";
export const MINT_TEXT = "oklch(0.86 0.10 158)";
const GREY = "oklch(0.68 0.02 250)";

// Palette hues (all chroma ~.14, lightness ~.78) from the handoff.
const BLUE = "oklch(0.78 0.14 235)";
const AMBER = "oklch(0.82 0.14 92)";
const VIOLET = "oklch(0.76 0.14 305)";
const TEAL = "oklch(0.78 0.14 200)";
const RED = "oklch(0.78 0.14 25)";
const INDIGO = "oklch(0.76 0.14 265)";

/** Stable color per raw Eventbrite category. Covers the full fixture set. */
export const CAT_COLORS: Record<string, string> = {
  Music: MINT,
  "Community & Culture": BLUE,
  "Business & Professional": AMBER,
  "Food & Drink": VIOLET,
  "Health & Wellness": TEAL,
  "Charity & Causes": RED,
  "Performing & Visual Arts": INDIGO,
  "Auto, Boat & Air": TEAL,
  "Film, Media & Entertainment": INDIGO,
  "Family & Education": AMBER,
  "Religion & Spirituality": VIOLET,
  "Sports & Fitness": RED,
  "Travel & Outdoor": MINT,
  "Science & Technology": BLUE,
  "Fashion & Beauty": VIOLET,
  "Hobbies & Special Interest": AMBER,
  "Home & Lifestyle": TEAL,
  Other: GREY,
};

/** Colors for the "Where they are" city breakdown, in order. */
export const CITY_COLORS = [MINT, BLUE, AMBER, VIOLET, TEAL, GREY];

/** Friendlier labels for raw category strings (verbatim if not listed). */
const FRIENDLY_CAT: Record<string, string> = {
  "Community & Culture": "Community",
  "Business & Professional": "Business",
  "Performing & Visual Arts": "Arts & theatre",
  "Film, Media & Entertainment": "Film & media",
  "Auto, Boat & Air": "On the water",
  "Religion & Spirituality": "Faith",
  "Family & Education": "Family",
  "Sports & Fitness": "Sport",
  Other: "Something else",
};

export function friendlyCat(raw: string | null): string {
  if (!raw) return "Something else";
  return FRIENDLY_CAT[raw] ?? raw;
}

export function catColor(raw: string | null): string {
  if (!raw) return GREY;
  return CAT_COLORS[raw] ?? GREY;
}

/** Friendlier labels for raw event-format strings, matched by keyword. */
export function friendlyFormat(raw: string | null): string {
  if (!raw) return "Other";
  const s = raw.toLowerCase();
  if (s.includes("party") || s.includes("social")) return "Parties & socials";
  if (s.includes("seminar") || s.includes("talk")) return "Talks & seminars";
  if (s.includes("concert") || s.includes("performance")) return "Concerts & shows";
  if (s.includes("class") || s.includes("training") || s.includes("workshop"))
    return "Classes & workshops";
  if (s.includes("festival") || s.includes("fair")) return "Festivals & fairs";
  if (s.includes("network")) return "Networking";
  return raw;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Today" / "Tomorrow" / weekday / "Sat Aug 15" relative to todayIso. */
export function dayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today";
  const diff = Math.round((parseISO(iso).getTime() - parseISO(todayIso).getTime()) / 86400000);
  const x = parseISO(iso);
  if (diff === 1) return "Tomorrow";
  if (diff > 0 && diff < 7) return WD[x.getDay()];
  return `${WD[x.getDay()]} ${MO[x.getMonth()]} ${x.getDate()}`;
}

/** Full friendly date, e.g. "Saturday August 1st". */
const WD_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export function longDate(iso: string): string {
  const x = parseISO(iso);
  const d = x.getDate();
  const ord =
    d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${WD_FULL[x.getDay()]} ${MO_FULL[x.getMonth()]} ${d}${ord}`;
}

/** 24h "HH:mm" → "3 PM" / "6:30 PM" (drops :00). */
export function clock(hm: string): string {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ampm;
}

/** First alphanumeric character of a name, uppercased. */
export function initial(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "·";
}

/** Category-tinted thumbnail background. */
export function tint(color: string): string {
  return `color-mix(in oklab, ${color} 16%, #1b1f24)`;
}

/** Short relative time, e.g. "just now", "a few seconds ago", "2 min ago". */
export function relativeTime(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 5) return "just now";
  if (s < 45) return "a few seconds ago";
  if (s < 90) return "a minute ago";
  const m = Math.round(s / 60);
  return `${m} min ago`;
}
