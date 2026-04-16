import {
  useEventCounts,
  useEventIds,
  useObjectCounts,
  useObjectIds,
} from "@ocelescope/api-base";
import { useMemo } from "react";
import type { AnnotationElementType } from "./types";

export type AnnotationElementOption = {
  value: string;
  label: string;
};

export const useAnnotationElementOptions = (
  ocelId: string,
  elementType?: AnnotationElementType,
) => {
  const { data: eventIds, isLoading: isEventIdsLoading } = useEventIds(ocelId);
  const { data: objectIds, isLoading: isObjectIdsLoading } =
    useObjectIds(ocelId);
  const { data: eventCounts, isLoading: isEventCountsLoading } =
    useEventCounts(ocelId);
  const { data: objectCounts, isLoading: isObjectCountsLoading } =
    useObjectCounts(ocelId);

  const options = useMemo<AnnotationElementOption[]>(() => {
    switch (elementType) {
      case "event":
        return (eventIds ?? []).map((id) => ({ value: id, label: id }));
      case "object":
        return (objectIds ?? []).map((id) => ({ value: id, label: id }));
      case "activity":
        return Object.keys(eventCounts ?? {}).map((name) => ({
          value: name,
          label: name,
        }));
      case "object_type":
        return Object.keys(objectCounts ?? {}).map((name) => ({
          value: name,
          label: name,
        }));
      case "item_type":
        return [];
      default:
        return [];
    }
  }, [elementType, eventIds, objectIds, eventCounts, objectCounts]);

  const isLoading =
    isEventIdsLoading ||
    isObjectIdsLoading ||
    isEventCountsLoading ||
    isObjectCountsLoading;

  return { options, isLoading };
};
