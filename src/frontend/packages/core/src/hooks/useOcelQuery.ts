import { useRunSqlQuery } from "@ocelescope/api-base";
import { useMemo } from "react";
import { useCurrentOcel } from "./useCurrentOCEL";

export interface OcelQueryOptions {
  /** DuckDB SQL over the OCEL's stored tables: `events`, `objects`, `e2o`,
   * `o2o`, `object_changes`. One `SELECT`; the backend refuses anything else. */
  sql: string;
  /** Values bound to the query's `?` placeholders. Bind them here rather than
   * building the SQL by hand. */
  parameters?: unknown[];
  /** Defaults to the filtered log, which is what the rest of the app shows. */
  ocelVersion?: "filtered" | "original";
  /** Hold the query back, e.g. until the user has picked an activity. */
  enabled?: boolean;
}

/**
 * Run SQL against the current OCEL.
 *
 * `OcelChart` draws with this; use it directly when a module wants the rows
 * themselves - a list of activities to choose from, a count to show in a
 * heading.
 */
export const useOcelQuery = ({
  sql,
  parameters,
  ocelVersion = "filtered",
  enabled = true,
}: OcelQueryOptions) => {
  const { id: ocelId } = useCurrentOcel();
  // The request is part of the query key, so it has to be stable.
  const request = useMemo(
    () => ({ sql, parameters: parameters ?? [] }),
    [sql, parameters],
  );
  const query = useRunSqlQuery(
    ocelId,
    request,
    { ocel_version: ocelVersion },
    { query: { enabled: enabled && ocelId != null } },
  );
  return { ...query, ocelId, error: sqlError(query.error) };
};

/**
 * DuckDB's complaint, not Axios': "Referenced column not found" is the part
 * someone writing SQL can act on.
 */
export const sqlError = (error: unknown) => {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return detail ? new Error(detail) : error;
};
