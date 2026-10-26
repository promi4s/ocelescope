import type { FilterOf, NativeFilter } from "../../../types/filter";

export type RelationKey = "e2o_count" | "o2o_count";

export type RelationKind = "e2o" | "o2o";

export type RelationFilter = FilterOf<RelationKey>;

export type RelationViewProps = {
  ocelId: string;
  kind: RelationKind;
  filter: RelationFilter;
  onChange: (filter: RelationFilter) => void;
  before: NativeFilter[];
};
