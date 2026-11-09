import type {
  AttributeCondition,
  EventAttributeFilter,
  ObjectAttributeCondition,
  ObjectAttributeFilter,
  SharedAttribute,
} from "../../../api/base";
import dayjs from "../../../util/dayjs";

export type AttributeFilter = EventAttributeFilter | ObjectAttributeFilter;

export type FilterCondition = AttributeCondition | ObjectAttributeCondition;

export const initialCondition = ({
  type,
}: Pick<SharedAttribute, "type">): AttributeCondition => {
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

const describe = ({ condition }: FilterCondition) => {
  switch (condition?.kind) {
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
      return "any value";
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

const matched = (condition: FilterCondition) => {
  if (condition.null === "only") {
    return "missing";
  }
  const negation = condition.negate ? "not " : "";
  const missing = condition.null === "include" ? " or missing" : "";
  return `${negation}${describe(condition)}${missing}`;
};

export const conditionText = (condition: FilterCondition) =>
  `${matched(condition)}${selected(condition)}`;

export const conditionSummary = (
  attribute: string,
  condition: FilterCondition,
) => `${attribute}${selected(condition)}: ${matched(condition)}`;

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
