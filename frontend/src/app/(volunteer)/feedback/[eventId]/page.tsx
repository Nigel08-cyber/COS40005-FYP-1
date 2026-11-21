import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/volunteer/DataView";
import { FeedbackView } from "@/components/volunteer/FeedbackForm";

export const metadata: Metadata = { title: "Activity feedback · VolunteerHub" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page({ params }: PageProps<"/feedback/[eventId]">) {
  // The id comes from the URL, so it is read inside Suspense: navigation shows the skeleton instantly.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Feedback params={params} />
    </Suspense>
  );
}

async function Feedback({ params }: { params: PageProps<"/feedback/[eventId]">["params"] }) {
  const { eventId } = await params;
  return <FeedbackView id={eventId} />;
}
