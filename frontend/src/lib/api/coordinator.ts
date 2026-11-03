/*
  Data access for the Project Coordinator pages (wireframe 15a).
  Right now these return FAKE data from src/lib/fake/coordinatorFake.ts;
  when the backend is ready, replace each body with a real request.
*/
import {
  attendanceEventFake,
  attendanceRosterFake,
  coordinatorFake,
  nextQrTokenFake,
} from "@/lib/fake/coordinatorFake";

export async function getCurrentCoordinator() {
  return coordinatorFake;
}

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
