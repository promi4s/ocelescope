import type { OCELFilterBody } from "../api/base";

export type Filter = OCELFilterBody["pipeline"][number];

export type FilterType = Filter["type"];
