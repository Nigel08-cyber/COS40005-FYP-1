"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAsync } from "@/lib/useAsync";

/** Loads data in the browser (the access token only exists there) and shows a skeleton / error meanwhile. */
export function DataView<T>({ load, children }: { load: () => Promise<T>; children: (data: T) => React.ReactNode }) {
  const { data, error, reload } = useAsync(load);

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-ink-soft">{error}</p>
        <Button className="mt-4" onClick={reload}>
          Try again
        </Button>
      </Card>
    );
  }
  if (data === undefined) return <PageSkeleton />;
  return <>{children(data)}</>;
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-64 max-w-full rounded bg-line" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-line" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="h-72 rounded-xl bg-line" />
        <div className="h-72 rounded-xl bg-line" />
      </div>
    </div>
  );
}
