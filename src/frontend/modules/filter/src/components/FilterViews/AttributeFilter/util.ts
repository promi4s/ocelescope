import type { AttributeDistribution } from "@ocelescope/api-base";
import type { FilterOf, NativeFilter } from "../../../types/filter";
import dayjs from "../../../util/dayjs";

export type AttributeFilter = FilterOf<"event_attribute" | "object_attribute">;

export type FieldProps = {
  filter: AttributeFilter;
  onChange: (filter: AttributeFilter) => void;
};

export type DistributionViewProps = FieldProps & {
  data: AttributeDistribution;
};

export type PreviewProps = {
  ocelId: string;
  entityType: "events" | "objects";
  before: NativeFilter[];
};

const DATE_FORMAT = "YYYY-MM-DD HH:mm";

export const formatValue = (
  value: string | number,
  type: AttributeDistribution["type"],
) => {
  if (type === "date") {
    return dayjs(value).format(DATE_FORMAT);
  }
  if (type === "float" && typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return `${value}`;
};
