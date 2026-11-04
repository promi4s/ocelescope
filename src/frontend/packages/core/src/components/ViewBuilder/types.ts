import type { ComponentType, ReactNode } from "react";

export type BaseStep = { type?: string };

export type StepType<S extends BaseStep> = NonNullable<S["type"]>;

export type StepOf<S extends BaseStep, T extends StepType<S>> = Extract<
  S,
  { type?: T }
>;

export type PipelineForm<S> = { steps: S[] };

export type StepErrors<T> = Partial<Record<keyof T, string>>;

export type StepPanel<T extends BaseStep> = ComponentType<{
  ocelId: string;
  viewId: string | null;
  step: T;
  onChange: (step: T) => void;
}>;

export type StepKind<T extends BaseStep> = {
  title: string;
  description: string;
  Panel: StepPanel<T>;
  create: () => T;
  summary: (step: T) => ReactNode;
  validate: (step: T) => StepErrors<T>;
};

export type StepKinds<S extends BaseStep> = {
  [K in StepType<S>]: StepKind<StepOf<S, K>>;
};

export type UseView<S extends BaseStep> = (
  ocelId: string,
  steps: S[],
) => string | null | undefined;

export type ViewBuilderLabels = {
  title: ReactNode;
  note?: ReactNode;
  add: string;
  search: string;
  noMatch: string;
  emptyList: string;
  emptyEditor: string;
  selectHint: string;
};

export type ViewBuilderState<S extends BaseStep> = {
  steps: S[];
  completeSteps: S[];
  isDirty: boolean;
  reset: () => void;
};
