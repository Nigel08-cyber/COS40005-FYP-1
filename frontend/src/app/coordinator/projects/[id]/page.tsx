import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/volunteer/DataView";
import { CoordinatorProjectView } from "@/components/coordinator/views";

export const metadata: Metadata = { title: "Project · VolunteerHub" };

// Content is loaded client-side (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page({ params }: PageProps<"/coordinator/projects/[id]">) {
  // The id comes from the URL, so it is read inside Suspense: navigation shows the skeleton instantly.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/coordinator/projects/[id]">["params"] }) {
  const { id } = await params;
  return <CoordinatorProjectView id={id} />;
}
