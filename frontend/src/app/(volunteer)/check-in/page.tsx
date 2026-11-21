import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/volunteer/DataView";
import { CheckIn } from "@/components/volunteer/CheckIn";

export const metadata: Metadata = { title: "Check in · Tandem" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CheckIn />
    </Suspense>
  );
}
