/*
  Data access for the Project Coordinator pages (wireframe 15a).
  The backend has no attendance / QR check-in endpoints yet, so these still return FAKE data from
  src/lib/fake/coordinatorFake.ts; replace each body with a real request once they exist.
*/
import { attendanceEventFake, attendanceRosterFake, nextQrTokenFake } from "@/lib/fake/coordinatorFake";

/** The event the coordinator is running attendance for. */
export async function getAttendanceEvent() {
  return attendanceEventFake;
}

export async function getAttendanceRoster() {
  return attendanceRosterFake;
}

/** A fresh rotating QR token (FAKE: random string, no signature or expiry check). */
export async function getQrToken(mode: "check_in" | "check_out") {
  return nextQrTokenFake(mode);
}
