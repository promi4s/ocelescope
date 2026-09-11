import { useQuery } from "@tanstack/react-query";
import { customFetch } from "../lib/fetcher";

const BASE = "/api/external/modules/exploration/v1";

/**
 * One hook for every analysis. Each endpoint is
 * `POST /ocels/{id}/queries/{analysis}` with the spec's query as the body, so
 * the analysis id is the only thing that varies — there is no reason for ten
 * generated hooks and ten card components that each call one of them.
 *
 * Results always come from the *filtered* OCEL; the editor's choices come from
 * the original one.
 */
export function useAnalysisQuery<T>(
  ocelId: string,
  analysis: string,
  query: unknown,
) {
  return useQuery({
    queryKey: ["exploration", analysis, ocelId, query],
    queryFn: ({ signal }) =>
      customFetch<T>({
        url: `${BASE}/ocels/${ocelId}/queries/${analysis}`,
        method: "POST",
        params: { ocel_version: "filtered" },
        ...(query === undefined
          ? {}
          : {
              data: query,
              headers: { "Content-Type": "application/json" },
            }),
        signal,
      }),
  });
}
