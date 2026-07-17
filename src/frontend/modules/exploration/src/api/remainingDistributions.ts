import { customFetch } from "../lib/fetcher";

export interface ObjectActivityExecutionDistributionQuery {
  object_type: string;
}

export interface ObjectActivityExecutionDistributionResponse {
  rows: Array<{
    activity: string;
    execution_count: number;
    object_count: number;
  }>;
  contributing_object_count: number;
  activity_count: number;
}

export interface TotalObjectInvolvementResponse {
  rows: Array<{
    activity: string;
    object_count: number;
    event_count: number;
  }>;
  event_count: number;
}

export function queryObjectActivityExecutionDistribution(
  ocelId: string,
  query: ObjectActivityExecutionDistributionQuery,
  params?: { ocel_version?: "filtered" | "original" },
) {
  return customFetch<ObjectActivityExecutionDistributionResponse>({
    url: `/api/external/modules/querying/v1/ocels/${ocelId}/queries/object-activity-execution-distribution`,
    method: "POST",
    data: query,
    params,
  });
}

export function queryTotalObjectInvolvement(
  ocelId: string,
  params?: { ocel_version?: "filtered" | "original" },
) {
  return customFetch<TotalObjectInvolvementResponse>({
    url: `/api/external/modules/querying/v1/ocels/${ocelId}/queries/total-object-involvement`,
    method: "POST",
    params,
  });
}
