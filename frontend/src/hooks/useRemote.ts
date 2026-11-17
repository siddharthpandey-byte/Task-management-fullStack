import { useCallback, useEffect, useState } from "react";
import { type HttpError, isRequestCanceled, toHttpError } from "../api/api.helper";

interface Settled<T> {
  key: string;
  data?: T;
  error?: HttpError;
}

// Fetch-with-abort. `deps` re-run the request; `reload()` forces a refetch; `enabled: false`
// skips the request (e.g. nothing selected yet).
// Loading is derived (no setState in the effect body): a result belongs to the request it came from.
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  enabled = true
) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify([...deps, attempt]);
  const [settled, setSettled] = useState<Settled<T>>({ key: "" });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setSettled({ key: requestKey, data }))
      .catch((error: unknown) => {
        if (isRequestCanceled(error)) return;
        // keep previous data so the page doesn't blank out on a failed refetch
        setSettled((prev) => ({ key: requestKey, data: prev.data, error: toHttpError(error) }));
      });
    return () => controller.abort();
    // requestKey captures every input of `load`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((data: T) => setSettled((prev) => ({ key: prev.key, data })), []);

  const loading = enabled && settled.key !== requestKey;
  return {
    loading,
    data: enabled ? settled.data : undefined,
    error: loading || !enabled ? undefined : settled.error,
    reload,
    setData,
  };
}
