import { Stack, Text } from "@mantine/core";

import { useQueryObjectInvolvementDistribution } from "../api/exploration";
import type { ObjectInvolvementDistributionSpec } from "../model/dashboard";
import { DistributionChartCard } from "./DistributionChartCard";
import type { AnalysisCardProps } from "./types";

interface ObjectInvolvementDistributionContentProps extends AnalysisCardProps {
  spec: ObjectInvolvementDistributionSpec;
}

function ObjectInvolvementDistributionContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: ObjectInvolvementDistributionContentProps) {
  const result = useQueryObjectInvolvementDistribution(ocelId, spec.query, {
    ocel_version: "filtered",
  });
  const title = spec.title || "Object involvement distribution";

  const info = (
    <Stack gap="xs">
      <Text size="sm">
        Shows how many distinct {spec.query.object_type} objects are involved in
        each “{spec.query.activity}” event.
      </Text>
      <Text size="sm">
        Every event is counted once. Duplicate event–object relations are
        removed, and zero is included when an event has no object of the
        selected type.
      </Text>
      <Text size="sm">
        {spec.visualization === "histogram"
          ? `Counts are grouped into ${spec.query.grouping.kind === "bins" ? (spec.query.grouping.count ?? "automatically determined") : ""} numerical intervals.`
          : "Each bar represents one exact involvement count."}{" "}
        Height is the number of events. The active filtered OCEL is used.
      </Text>
    </Stack>
  );

  return (
    <DistributionChartCard
      visualization={spec.visualization}
      data={result.data}
      loading={result.isPending}
      error={result.error}
      title={title}
      subtitle={`${spec.query.activity} · ${spec.query.object_type}`}
      info={info}
      filenameFallback="object-involvement-distribution"
      seriesName="Events"
      populationLabel="events"
      emptyMessage="No matching events are available in the active OCEL."
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
    />
  );
}

export function ObjectInvolvementDistributionCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "object-involvement-distribution") {
    return null;
  }
  return (
    <ObjectInvolvementDistributionContent {...props} spec={props.card.spec} />
  );
}
