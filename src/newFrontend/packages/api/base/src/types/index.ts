import type { EventAttributes200, ObjectAttributes200 } from "../api/base";

export type AttributeSummary = (
  | ObjectAttributes200[string]
  | EventAttributes200[string]
)[number];
