import {
  type AttributeBinsQueryResult,
  type AttributeSummaryQueryResult,
  type AttributeValuesQueryResult,
  useAttributeBins as useBins,
  useAttributeSummary as useSummary,
  useAttributeValues as useValues,
} from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import type { AttributeScope, ObjectValue } from "./types";
import { scopeParams } from "./util";

const BINS = 40;

const params = (
  scope: Omit<AttributeScope, "ocelId">,
  value: ObjectValue | undefined,
) => ({
  ...scopeParams(scope),
  entity_type: scope.entityType,
  object_value: value?.kind ?? "first",
  object_value_at: value?.kind === "at" ? value.timestamp : undefined,
});

export const useAttributeSummary = (
  { ocelId, ...scope }: AttributeScope,
  objectValue: ObjectValue | undefined,
) =>
  useSummary<AttributeSummaryQueryResult, unknown>(
    ocelId,
    params(scope, objectValue),
    {
      query: { placeholderData: keepPreviousData },
    },
  );

export const useAttributeBins = (
  { ocelId, ...scope }: AttributeScope,
  objectValue: ObjectValue | undefined,
) =>
  useBins<AttributeBinsQueryResult, unknown>(
    ocelId,
    { ...params(scope, objectValue), bins: BINS },
    { query: { placeholderData: keepPreviousData } },
  );

export const useAttributeValues = (
  { ocelId, ...scope }: AttributeScope,
  objectValue: ObjectValue | undefined,
  filter: { regex?: string; search?: string; values?: string[] } = {},
  enabled = true,
) =>
  useValues<AttributeValuesQueryResult, unknown>(
    ocelId,
    { ...params(scope, objectValue), ...filter },
    { query: { placeholderData: keepPreviousData, retry: false, enabled } },
  );
