import type { AttributeSummary } from "@ocelescope/api-base";

export type AttributeValueCondition =
  | { kind: "values"; values: (string | number)[] }
  | { kind: "pattern"; regex: string }
  | { kind: "range"; range: [number | null, number | null] }
  | { kind: "time_range"; range: [string | null, string | null] };

export type MissingValues = "exclude" | "include";

export type ObjectValue =
  | { kind: "first" }
  | { kind: "initial" }
  | { kind: "last" }
  | { kind: "at"; timestamp: string };

export type AttributeFilterValue = {
  condition?: AttributeValueCondition | null;
  negate?: boolean;
  null?: MissingValues;
  value?: ObjectValue;
};

export type AttributeScope = {
  ocelId: string;
  viewId: string | null;
  entityType: "events" | "objects";
  attribute: string;
  entityNames?: string[];
};

export type AttributeFilterProps = AttributeScope & {
  value: AttributeFilterValue;
  onChange: (value: AttributeFilterValue) => void;
};

export type ViewProps = AttributeScope & {
  objectValue?: ObjectValue;
  summary: AttributeSummary;
  value: AttributeValueCondition | null;
  onChange: (value: AttributeValueCondition) => void;
  inverted: boolean;
};
