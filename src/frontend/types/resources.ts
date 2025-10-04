import { GetResourceResponse } from "@/api/fastapi-schemas";
type RequireType<T> = T extends {
  type?: infer L;
}
  ? Omit<T, "type"> & { type: L }
  : T;

export type VisulizationsType = RequireType<
  NonNullable<GetResourceResponse["visualization"]>
>;
export type VisulizationsTypes = NonNullable<VisulizationsType["type"]>;

export type VisualizationByType<T extends VisulizationsTypes> = Extract<
  VisulizationsType,
  { type: T }
>;
