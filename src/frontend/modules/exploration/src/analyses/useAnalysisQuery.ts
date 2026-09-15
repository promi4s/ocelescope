import { useQuery } from "@tanstack/react-query";
import { customFetch } from "../lib/fetcher";

const BASE = "/api/external/modules/exploration/v1";

/**
 * One endpoint serves every analysis: `POST /ocels/{id}/queries` with a body
 * whose `analysis` field selects which one runs. The dashboard stores the query
 * without that tag, so it is added here.
 *
 * Results always come from the *filtered* OCEL; validity and the editor's
 * choices come from the original one.
 */
export function useAnalysisQuery<T>(
  ocelId: string,
  analysis: string,
  query: object | undefined,
) {
  return useQuery({
    queryKey: ["exploration", analysis, ocelId, query],
    queryFn: ({ signal }) =>
      customFetch<T>({
        url: `${BASE}/ocels/${ocelId}/queries`,
        method: "POST",
        params: { ocel_version: "filtered" },
        headers: { "Content-Type": "application/json" },
        data: { ...query, analysis },
        signal,
      }),
  });
}
