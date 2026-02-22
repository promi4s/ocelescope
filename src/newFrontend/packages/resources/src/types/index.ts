import type { GetResourceResponse } from "@ocelescope/api-base";

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

export type VisualizationProps<T extends VisulizationsTypes> = {
  visualization: VisualizationByType<T>;
  isPreview?: boolean;
};
