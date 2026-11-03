import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/volunteer/DataView";
import { OpportunityDetailView } from "@/components/volunteer/views/OpportunityDetailView";

export const metadata: Metadata = { title: "Opportunity · VolunteerHub" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function OpportunityDetailPage({ params }: PageProps<"/opportunities/[id]">) {
  // The id comes from the URL, so it is read inside Suspense: navigation shows the skeleton instantly.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/opportunities/[id]">["params"] }) {
  const { id } = await params;
  return <OpportunityDetailView id={id} />;
}
