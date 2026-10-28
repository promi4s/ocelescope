import {
  useE2o,
  useE2oCountDistribution,
  useO2o,
  useO2oCountDistribution,
} from "@ocelescope/api-base";
import type { FilterOf, NativeFilter } from "../../../types/filter";

export type RelationKey = "e2o_count" | "o2o_count";

export type RelationKind = "e2o" | "o2o";

export type RelationHooks = {
  useRelations: typeof useE2o;
  useDistribution: typeof useE2oCountDistribution;
};

export const RELATION_HOOKS: Record<RelationKind, RelationHooks> = {
  e2o: { useRelations: useE2o, useDistribution: useE2oCountDistribution },
  o2o: { useRelations: useO2o, useDistribution: useO2oCountDistribution },
};

export type RelationFilter = FilterOf<RelationKey>;

export type RelationViewProps = {
  ocelId: string;
  kind: RelationKind;
  hooks: RelationHooks;
  filter: RelationFilter;
  onChange: (filter: RelationFilter) => void;
  before: NativeFilter[];
};
