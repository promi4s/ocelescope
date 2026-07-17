import type {
  DistributionBucket,
  QueryCounts,
} from "./querying";
import { customFetch } from "../lib/fetcher";

export type TimeUnit = "seconds" | "minutes" | "hours" | "days";

export interface TimeBetweenActivitiesQuery {
  source_activity: string;
  target_activity: string;
  object_type: string;
  unit: TimeUnit;
  bin_count: number;
}

export interface TimeBetweenActivitiesResponse {
  buckets: DistributionBucket[];
  counts: QueryCounts;
  truncated: boolean;
  unit: TimeUnit;
  pair_count: number;
  contributing_object_count: number;
}

export function queryTimeBetweenActivities(
  ocelId: string,
  query: TimeBetweenActivitiesQuery,
  params?: { ocel_version?: "filtered" | "original" },
) {
  return customFetch<TimeBetweenActivitiesResponse>({
    url: `/api/external/modules/querying/v1/ocels/${ocelId}/queries/time-between-activities`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: query,
    params,
  });
}
