import type { AttributeDistribution } from "@ocelescope/api-base";
import type {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "../../../api/base";
import dayjs from "../../../util/dayjs";

export type AttributeFilter = EventAttributeFilter | ObjectAttributeFilter;

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
  viewId: string | null;
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
