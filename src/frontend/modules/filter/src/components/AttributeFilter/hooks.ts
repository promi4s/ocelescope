import { keepPreviousData } from "@tanstack/react-query";
import {
  useGetEventAttributeBins,
  useGetEventAttributeSummary,
  useGetEventAttributeValues,
  useGetObjectAttributeBins,
  useGetObjectAttributeSummary,
  useGetObjectAttributeValues,
} from "../../api/base";
import type { AttributeScope, ObjectValue } from "./types";
import { scopeParams } from "./util";

const BINS = 40;

const objectValueParams = (value: ObjectValue | undefined) => ({
  object_value: value?.kind ?? "first",
  object_value_at: value?.kind === "at" ? value.timestamp : undefined,
});

export const useAttributeSummary = (
  { ocelId, ...scope }: AttributeScope,
  objectValue: ObjectValue | undefined,
) => {
  const isObjects = scope.entityType === "objects";
  const params = scopeParams(scope);
  const events = useGetEventAttributeSummary(ocelId, params, {
    query: { enabled: !isObjects, placeholderData: keepPreviousData },
  });
  const objects = useGetObjectAttributeSummary(
    ocelId,
    { ...params, ...objectValueParams(objectValue) },
    { query: { enabled: isObjects, placeholderData: keepPreviousData } },
  );
  return isObjects ? objects : events;
};

export const useAttributeBins = (
  { ocelId, ...scope }: AttributeScope,
  objectValue: ObjectValue | undefined,
) => {
  const isObjects = scope.entityType === "objects";
  const params = { ...scopeParams(scope), bins: BINS };
  const events = useGetEventAttributeBins(ocelId, params, {
    query: { enabled: !isObjects, placeholderData: keepPreviousData },
  });
  const objects = useGetObjectAttributeBins(
    ocelId,
    { ...params, ...objectValueParams(objectValue) },
    { query: { enabled: isObjects, placeholderData: keepPreviousData } },
  );
  return isObjects ? objects : events;
};

export const useAttributeValues = (
  { ocelId, ...scope }: AttributeScope,
  objectValue: ObjectValue | undefined,
  filter: { regex?: string; search?: string; values?: string[] } = {},
  enabled = true,
) => {
  const isObjects = scope.entityType === "objects";
  const params = { ...scopeParams(scope), ...filter };
  const query = { placeholderData: keepPreviousData, retry: false };
  const events = useGetEventAttributeValues(ocelId, params, {
    query: { ...query, enabled: enabled && !isObjects },
  });
  const objects = useGetObjectAttributeValues(
    ocelId,
    { ...params, ...objectValueParams(objectValue) },
    { query: { ...query, enabled: enabled && isObjects } },
  );
  return isObjects ? objects : events;
};
