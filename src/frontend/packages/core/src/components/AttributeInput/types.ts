import type { AttributeSummary } from "@ocelescope/api-base";

export type AttributeValueCondition =
  | { kind: "values"; values: (string | number)[] }
  | { kind: "pattern"; regex: string }
  | { kind: "range"; range: [number | null, number | null] }
  | { kind: "time_range"; range: [string | null, string | null] };

export type ObjectValue =
  | { kind: "first" }
  | { kind: "initial" }
  | { kind: "last" }
  | { kind: "at"; timestamp: string };

export type AttributeInputValue = {
  condition?: AttributeValueCondition | null;
  negate?: boolean;
  includeNull?: boolean;
  objectValue?: ObjectValue;
};

export type AttributeScope = {
  ocelId: string;
  viewId: string | null;
  entityType: "events" | "objects";
  attribute: string;
  entityNames?: string[];
};

export type AttributeInputProps = AttributeScope & {
  value: AttributeInputValue;
  onChange: (value: AttributeInputValue) => void;
};

export type ViewProps = AttributeScope & {
  objectValue?: ObjectValue;
  summary: AttributeSummary;
  value: AttributeValueCondition | null;
  onChange: (value: AttributeValueCondition) => void;
  inverted: boolean;
  includeNull: boolean;
};
