import type { GetResourceResponse } from "@ocelescope/api-base";

type RequireType<T> = T extends {
  type?: infer L;
}
  ? Omit<T, "type"> & { type: L }
  : T;

export type VisualizationsType = RequireType<
  NonNullable<GetResourceResponse["visualization"]>
>;
export type VisualizationsTypes = NonNullable<VisualizationsType["type"]>;

export type VisualizationByType<T extends VisualizationsTypes> = Extract<
  VisualizationsType,
  { type: T }
>;

export type VisualizationProps<T extends VisualizationsTypes> = {
  visualization: VisualizationByType<T>;
  isPreview?: boolean;
};
