import type { resourceVisualization } from "@ocelescope/api-base";

type RequireType<T> = T extends {
  type?: infer L;
}
  ? Omit<T, "type"> & { type: L }
  : T;

export type VisualizationsType = RequireType<
  NonNullable<Awaited<ReturnType<typeof resourceVisualization>>>
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
