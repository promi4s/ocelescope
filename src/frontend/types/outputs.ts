import { GetOutputResponse } from "@/api/fastapi-schemas";

export type VisulizationsType = NonNullable<GetOutputResponse["visualization"]>;
export type VisulizationsTypes = NonNullable<VisulizationsType["type"]>;

export type VisualizationByType<T extends VisulizationsTypes> = Extract<
  VisulizationsType,
  { type: T }
>;
