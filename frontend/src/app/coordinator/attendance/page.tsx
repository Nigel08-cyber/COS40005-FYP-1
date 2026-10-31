import type { Metadata } from "next";
import { AttendanceBoard } from "@/components/coordinator/AttendanceBoard";
import { getAttendanceEvent, getAttendanceRoster } from "@/lib/api/coordinator";

export const metadata: Metadata = { title: "Attendance · VolunteerHub" };

export default async function AttendancePage() {
  const [event, roster] = await Promise.all([getAttendanceEvent(), getAttendanceRoster()]);
  // The rotating QR token is requested in the browser (it changes every minute).
  return <AttendanceBoard event={event} initialRoster={roster} />;
}
