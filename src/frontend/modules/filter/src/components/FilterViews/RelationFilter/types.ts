import type { E2OCountFilter, O2OCountFilter } from "../../../api/base";

export type RelationKind = "e2o" | "o2o";

export type RelationFilter = E2OCountFilter | O2OCountFilter;
