import { GetResourceResponse } from "@/api/fastapi-schemas";

export type VisulizationsType = NonNullable<
  GetResourceResponse["visualization"]
>;
export type VisulizationsTypes = NonNullable<VisulizationsType["type"]>;

export type VisualizationByType<T extends VisulizationsTypes> = Extract<
  VisulizationsType,
  { type: T }
>;
