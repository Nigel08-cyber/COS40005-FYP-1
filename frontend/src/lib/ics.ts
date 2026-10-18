import type { Opportunity } from "./types";

/** "2026-10-17T09:00" (Malaysia time, UTC+8) -> "20261017T010000Z" */
function toIcsUtc(local: string) {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh - 8, mm));
  return utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Downloads an .ics file so the volunteer can add the activity to their calendar. */
export function downloadIcs(o: Opportunity) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VolunteerHub//EN",
    "BEGIN:VEVENT",
    `UID:${o.id}@volunteerhub`,
    `DTSTAMP:${toIcsUtc(o.start)}`,
    `DTSTART:${toIcsUtc(o.start)}`,
    `DTEND:${toIcsUtc(o.end)}`,
    `SUMMARY:${o.title}`,
    `LOCATION:${o.address}`,
    `DESCRIPTION:${o.organisation} — ${o.summary}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${o.title.replace(/\s+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
