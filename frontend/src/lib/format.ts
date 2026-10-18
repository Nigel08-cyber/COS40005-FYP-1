/*
  Date helpers. Times are stored as local Malaysia time strings ("YYYY-MM-DDTHH:mm")
  and formatted by hand so server and browser render exactly the same text
  (Intl output differs between Node and browsers and would break hydration).
*/

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(value: string) {
  const [date, time = "00:00"] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, hh, mm, weekday };
}

export function formatTime(value: string) {
  const { hh, mm } = parts(value);
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/** "Sat, 17 Oct" */
export function formatShortDate(value: string) {
  const { d, m, weekday } = parts(value);
  return `${DAYS[weekday]}, ${d} ${MONTHS[m - 1]}`;
}

/** "Sat, 17 October 2026" */
export function formatLongDate(value: string) {
  const { y, d, m, weekday } = parts(value);
  return `${DAYS[weekday]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** "9:00 AM–1:00 PM" */
export function formatTimeRange(start: string, end: string) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** For the date block on activity rows: { month: "OCT", day: "17", weekday: "Sat" } */
export function dateBlock(value: string) {
  const { d, m, weekday } = parts(value);
  return { month: MONTHS[m - 1].toUpperCase(), day: String(d).padStart(2, "0"), weekday: DAYS[weekday] };
}

export function weekdayIndex(value: string) {
  return parts(value).weekday;
}

export function startHour(value: string) {
  return parts(value).hh;
}

/** Days between two "YYYY-MM-DD..." values, ignoring time. */
export function daysBetween(from: string, to: string) {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
