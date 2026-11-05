import type {
  AggregatedAttribute,
  AttributeDistribution,
} from "@ocelescope/api-base";
import { viewParams } from "@ocelescope/core";
import type {
  AttributeCondition,
  EventAttributeFilter,
  ObjectAttributeCondition,
  ObjectAttributeFilter,
} from "../../../api/base";
import dayjs from "../../../util/dayjs";

export type AttributeFilter = EventAttributeFilter | ObjectAttributeFilter;

export type FilterCondition = AttributeCondition | ObjectAttributeCondition;

export type ConditionProps = {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
};

export type DistributionViewProps = ConditionProps & {
  data: AttributeDistribution;
};

export type PreviewProps = {
  ocelId: string;
  entityType: "events" | "objects";
  viewId: string | null;
  attribute: string;
  types?: string[];
};

export const scopeParams = ({
  viewId,
  attribute,
  entityType,
  types,
}: Omit<PreviewProps, "ocelId">) => ({
  ...viewParams(viewId),
  attribute,
  entity_type: entityType,
  entity_names: types && types.length > 0 ? types : undefined,
});

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

export const initialCondition = ({
  type,
}: Pick<AggregatedAttribute, "type">): AttributeCondition => {
  switch (type) {
    case "int":
    case "float":
      return { condition: { kind: "range", range: [null, null] } };
    case "date":
      return { condition: { kind: "time_range", range: [null, null] } };
    default:
      return { condition: { kind: "values", values: [] } };
  }
};

const formatDate = (value: string | null, open: string) =>
  value ? dayjs(value).format("YYYY-MM-DD") : open;

const describe = ({ condition }: AttributeCondition) => {
  switch (condition.kind) {
    case "pattern":
      return `matches /${condition.regex}/`;
    case "range": {
      const [low, high] = condition.range;
      return `${low ?? "-∞"} – ${high ?? "∞"}`;
    }
    case "time_range": {
      const [start, end] = condition.range;
      return `${formatDate(start, "start")} – ${formatDate(end, "end")}`;
    }
    case "values": {
      const shown = condition.values.slice(0, 3).join(", ");
      const more = condition.values.length - 3;
      return `in ${shown}${more > 0 ? ` +${more} more` : ""}`;
    }
    default:
      return "missing";
  }
};

const selected = (condition: FilterCondition) => {
  if (!("value" in condition) || !condition.value) {
    return "";
  }
  switch (condition.value.kind) {
    case "initial":
      return " (initial)";
    case "last":
      return " (last)";
    case "at":
      return ` (at ${formatDate(condition.value.timestamp, "")})`;
    default:
      return "";
  }
};

export const conditionSummary = (
  attribute: string,
  condition: FilterCondition,
) => {
  const negation = condition.negate ? "not " : "";
  const missing =
    condition.null && condition.condition.kind !== "null" ? " or missing" : "";
  return `${attribute}${selected(condition)}: ${negation}${describe(condition)}${missing}`;
};

export const withCondition = (
  filter: AttributeFilter,
  attribute: string,
  condition: FilterCondition,
): AttributeFilter => ({
  ...filter,
  conditions: { ...filter.conditions, [attribute]: condition },
});

export const withoutCondition = (
  filter: AttributeFilter,
  attribute: string,
): AttributeFilter => {
  const { [attribute]: _, ...conditions } = filter.conditions;
  return { ...filter, conditions };
};
