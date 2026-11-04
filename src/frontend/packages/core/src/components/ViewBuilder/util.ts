import type { BaseStep, StepKind, StepKinds, StepType } from "./types";

export const kindOf = <S extends BaseStep>(kinds: StepKinds<S>, step: S) =>
  kinds[step.type as StepType<S>] as unknown as StepKind<S>;

export const problemOf = <S extends BaseStep>(kinds: StepKinds<S>, step: S) =>
  Object.values<string | undefined>(kindOf(kinds, step).validate(step)).find(
    Boolean,
  );

export const completeSteps = <S extends BaseStep>(
  kinds: StepKinds<S>,
  steps: S[],
) => steps.filter((step) => problemOf(kinds, step) === undefined);

export const viewParams = (viewId: string | null) =>
  viewId === null ? { ocel_version: "original" as const } : { view_id: viewId };

export const viewProps = (viewId: string | null) =>
  viewId === null ? { ocelVersion: "original" as const } : { viewId };
