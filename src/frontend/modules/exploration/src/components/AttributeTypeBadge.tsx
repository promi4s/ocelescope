import { Badge } from "@mantine/core";
import type { AttributeSchemaItem } from "../api/querying";

type AnalyticalType = AttributeSchemaItem["analytical_type"];
type PhysicalType = AttributeSchemaItem["physical_type"];

const typePresentation: Record<PhysicalType, { color: string; label: string }> =
  {
    number: { color: "blue", label: "Number" },
    string: { color: "grape", label: "Text" },
    boolean: { color: "teal", label: "Boolean" },
    datetime: { color: "orange", label: "Date & time" },
    unknown: { color: "gray", label: "Unknown" },
  };

const analyticalTypePresentation: Record<
  AnalyticalType,
  { color: string; label: string }
> = {
  categorical: { color: "violet", label: "Categorical" },
  discrete: { color: "cyan", label: "Numerical · Discrete" },
  continuous: { color: "blue", label: "Numerical · Continuous" },
  temporal: { color: "orange", label: "Temporal" },
  unknown: { color: "gray", label: "Unknown scale" },
};

export function AttributeTypeBadge({ dataType }: { dataType: PhysicalType }) {
  const presentation = typePresentation[dataType];

  return (
    <Badge color={presentation.color} size="sm" variant="light">
      {presentation.label}
    </Badge>
  );
}

export function AnalyticalTypeBadge({
  analyticalType,
}: {
  analyticalType: AnalyticalType;
}) {
  const presentation = analyticalTypePresentation[analyticalType];

  return (
    <Badge color={presentation.color} size="sm" variant="dot">
      {presentation.label}
    </Badge>
  );
}
