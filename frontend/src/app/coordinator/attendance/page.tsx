import type { Metadata } from "next";
import { AttendanceBoard } from "@/components/coordinator/AttendanceBoard";
import { getAttendanceEvent, getAttendanceRoster } from "@/lib/api/coordinator";

export const metadata: Metadata = { title: "Attendance · VolunteerHub" };

// The staff layout only shows the page once the login is confirmed in the browser, so there is nothing to validate for instant navigation.
export const instant = false;

export default async function AttendancePage() {
  const [event, roster] = await Promise.all([getAttendanceEvent(), getAttendanceRoster()]);
  // The rotating QR token is requested in the browser (it changes every minute).
  return <AttendanceBoard event={event} initialRoster={roster} />;
}
