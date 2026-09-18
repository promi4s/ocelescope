import { AsyncBoundary, EmptyState } from "@r4pm/components";
import { useOcelQuery } from "../../hooks/useOcelQuery";
import type { OcelChartProps } from ".";
import { SqlChart } from "./SqlChart";

/**
 * A chart of the current OCEL: give it SQL, get a chart.
 *
 * Loading, failure and emptiness are handled here, so the charts never have to
 * think about them; the failure shows the query's own error text, because that
 * is the part someone writing SQL can act on.
 */
export const OcelChart = ({
  sql,
  parameters,
  ocelVersion = "filtered",
  enabled = true,
  height = 320,
  ...chart
}: OcelChartProps) => {
  const query = useOcelQuery({ sql, parameters, ocelVersion, enabled });

  return (
    <div style={{ height, width: "100%" }}>
      {query.ocelId ? (
        <AsyncBoundary
          status={query}
          loadingLabel="Querying the OCEL…"
          errorTitle="The query failed"
          onRetry={() => void query.refetch()}
        >
          {(data) => <SqlChart {...chart} data={data} />}
        </AsyncBoundary>
      ) : (
        <EmptyState
          title="No OCEL selected"
          description="Import or select an OCEL to run this chart's query."
        />
      )}
    </div>
  );
};
