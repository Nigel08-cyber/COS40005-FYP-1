"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/http";

/** Runs `load` when the component mounts and again when `reload()` is called. */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [tick, setTick] = useState(0);
  // The first `load` is kept for the lifetime of the component (the views never change what they load)
  const [loader] = useState(() => load);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((data) => !cancelled && setState({ data }))
      .catch((e) => !cancelled && setState({ error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [loader, tick]);

  const reload = useCallback(() => {
    setState({});
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload };
}
