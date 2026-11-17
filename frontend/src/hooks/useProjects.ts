import { useCallback, useEffect, useState } from "react";
import { type HttpError, isRequestCanceled, toHttpError } from "../api/api.helper";
import { projectService } from "../api/services/project.service";
import type { ProjectDetail, ProjectListQuery, ProjectListResult } from "../types/project.types";

interface Settled<T> {
  key: string;
  data?: T;
  error?: HttpError;
}

// Fetch-with-abort. `deps` re-run the request; `reload()` forces a refetch.
// Loading is derived (no setState in the effect body): a result belongs to the request it came from.
function useRemote<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify([...deps, attempt]);
  const [settled, setSettled] = useState<Settled<T>>({ key: "" });

  useEffect(() => {
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
  }, [requestKey]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((data: T) => setSettled((prev) => ({ key: prev.key, data })), []);

  const loading = settled.key !== requestKey;
  return {
    loading,
    data: settled.data,
    error: loading ? undefined : settled.error,
    reload,
    setData,
  };
}

export function useProjects(query: ProjectListQuery) {
  const { page, limit, search, status, sort, order } = query;
  return useRemote<ProjectListResult>(
    (signal) => projectService.list({ page, limit, search, status, sort, order }, signal),
    [page, limit, search, status, sort, order]
  );
}

export function useProject(key: string) {
  return useRemote<ProjectDetail>((signal) => projectService.get(key, signal), [key]);
}
