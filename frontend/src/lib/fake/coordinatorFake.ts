// FAKE DATA — remove when the backend is connected (see ./README.md)
// Project Coordinator pages: attendance / QR check-in (15a).
import type { AttendanceEvent, AttendanceRecord, StaffUser } from "@/lib/staffTypes";

export const coordinatorFake: StaffUser = {
  fullName: "Daniel Lim",
  initials: "DL",
  email: "daniel.fake@example.com",
  roleLabel: "Project Coordinator",
  organisation: "Harapan Community Kitchen",
};

export const attendanceEventFake: AttendanceEvent = {
  id: "event-fake-1",
  title: "Community Food Distribution",
  start: "2026-10-17T08:00",
  end: "2026-10-17T13:00",
  area: "Subang Jaya",
  expectedVolunteers: 16,
  qrRefreshSeconds: 60,
};

export const attendanceRosterFake: AttendanceRecord[] = [
  { id: "att-fake-01", volunteer: "Aisha Rahman", role: "Logistics", checkIn: "08:03", status: "checked_in" },
  { id: "att-fake-02", volunteer: "Ben Tan", role: "Packing", checkIn: "07:58", status: "checked_in" },
  { id: "att-fake-03", volunteer: "Chitra Devi", role: "Greeter", checkIn: "08:10", status: "checked_in" },
  { id: "att-fake-04", volunteer: "Faizal Ahmad", role: "Driver", status: "not_arrived" },
  { id: "att-fake-05", volunteer: "Grace Ong", role: "Packing", status: "not_arrived" },
  { id: "att-fake-06", volunteer: "Hafiz Rahim", role: "Logistics", checkIn: "07:55", status: "checked_in" },
  { id: "att-fake-07", volunteer: "Irene Wong", role: "Packing", checkIn: "08:01", status: "checked_in" },
  { id: "att-fake-08", volunteer: "Jason Lee", role: "Driver", checkIn: "07:50", status: "checked_in" },
  { id: "att-fake-09", volunteer: "Kavitha Raj", role: "Greeter", checkIn: "08:05", status: "checked_in" },
  { id: "att-fake-10", volunteer: "Lim Wei Jie", role: "Packing", checkIn: "08:07", status: "checked_in" },
  { id: "att-fake-11", volunteer: "Muthu Kumar", role: "Logistics", checkIn: "08:12", status: "checked_in" },
  { id: "att-fake-12", volunteer: "Nurul Huda", role: "Packing", checkIn: "08:00", status: "checked_in" },
  { id: "att-fake-13", volunteer: "Ong Mei Xin", role: "Greeter", checkIn: "08:15", status: "checked_in" },
  { id: "att-fake-14", volunteer: "Prakash Nair", role: "Logistics", checkIn: "07:57", status: "checked_in" },
  { id: "att-fake-15", volunteer: "Rachel Goh", role: "Packing", checkIn: "08:09", status: "checked_in" },
  { id: "att-fake-16", volunteer: "Syafiq Aziz", role: "Driver", checkIn: "08:02", status: "checked_in" },
];

/** A new random QR token. The real one must come from the backend, signed and with an expiry. */
export function nextQrTokenFake(mode: "check_in" | "check_out") {
  return `${mode}-fake-${Math.random().toString(36).slice(2, 10)}`;
}
