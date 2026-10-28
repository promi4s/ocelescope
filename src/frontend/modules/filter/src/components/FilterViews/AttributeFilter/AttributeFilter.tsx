import {
  useAggregatedAttributes,
  useEventAttributes,
  useObjectAttributes,
} from "@ocelescope/api-base";
import { AttributesTable } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAttributeFilter } from "../../../hooks/useAttributeFilterColumns";
import { useView } from "../../../hooks/useView";
import type { FilterKind, FilterOf, FilterPanel } from "../../../types/filter";
import dayjs from "../../../util/dayjs";
import Previewed from "../../Previewed";
import AttributeDetail from "./AttributeDetail";

const ALL = 100_000;

type AttributeKey = "event_attribute" | "object_attribute";

const AttributePanel: (
  entityType: "objects" | "events",
) => FilterPanel<AttributeKey> = (entityType) => {
  const useTypedAttributes =
    entityType === "events" ? useEventAttributes : useObjectAttributes;
  return ({ ocelId, filter, onChange, before }) => {
    const { filterColumns } = useAttributeFilter({ filter, onChange });
    const view = useView(ocelId, before);
    const options = {
      query: { enabled: view !== undefined, placeholderData: keepPreviousData },
    };
    const aggregated = useAggregatedAttributes(
      ocelId,
      { ...view, entity_type: entityType, page_size: ALL },
      options,
    );
    const typed = useTypedAttributes(ocelId, view, options);
    const both = {
      data:
        aggregated.data && typed.data
          ? { attributes: aggregated.data.response, typed: typed.data }
          : undefined,
      isPending: aggregated.isPending || typed.isPending,
      error: aggregated.error ?? typed.error,
    };
    const scopes = useMemo(
      () =>
        (typed.data ?? [])
          .filter(({ name }) => name === filter.attribute)
          .map(({ entity_type }) => entity_type),
      [typed.data, filter.attribute],
    );

    if (filter.attribute) {
      return (
        <AttributeDetail
          ocelId={ocelId}
          entityType={entityType}
          filter={filter}
          onChange={onChange}
          before={before}
          scopes={scopes}
          onClear={() => onChange({ type: filter.type, attribute: "" })}
        />
      );
    }

    return (
      <Previewed query={both}>
        {(data) => (
          <AttributesTable
            ocelId={ocelId}
            entityType={entityType}
            data={data}
            extraColumns={filterColumns}
            subTableExtraColumns={filterColumns}
            hideRange
            hideValues
          />
        )}
      </Previewed>
    );
  };
};

const condition = (filter: FilterOf<AttributeKey>) => {
  if (filter.regex) {
    return `matches /${filter.regex}/`;
  }
  if (filter.number_range) {
    const [low, high] = filter.number_range;
    return `${low ?? "-∞"} – ${high ?? "∞"}`;
  }
  if (filter.time_range) {
    const [start, end] = filter.time_range;
    const format = (value: string | null, open: string) =>
      value ? dayjs(value).format("YYYY-MM-DD") : open;
    return `${format(start, "start")} – ${format(end, "end")}`;
  }
  if (filter.values) {
    const shown = filter.values.slice(0, 3).join(", ");
    const more = filter.values.length - 3;
    return `in ${shown}${more > 0 ? ` +${more} more` : ""}`;
  }
  return "any value";
};

const summary = (filter: FilterOf<AttributeKey>) => {
  if (!filter.attribute) {
    return "No attribute selected";
  }
  const scope = filter.target_type ? ` (${filter.target_type})` : "";
  const negation = filter.mode === "exclude" ? "not " : "";
  return `${filter.attribute}${scope}: ${negation}${condition(filter)}`;
};

export const EventAttributeFilter: FilterKind<"event_attribute"> = {
  title: "Event Attribute",
  description:
    "Keeps the events whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition on its value distribution: a range for numbers and dates, chosen values or a pattern otherwise. With Exclude, the matching events are removed instead. Activities without the attribute are left untouched.",
  Panel: AttributePanel("events") as FilterPanel<"event_attribute">,
  create: () => ({ type: "event_attribute", attribute: "" }),
  summary,
  isComplete: (filter) => filter.attribute !== "",
};

export const ObjectAttributeFilter: FilterKind<"object_attribute"> = {
  title: "Object Attribute",
  description:
    "Keeps the objects whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition on its value distribution: a range for numbers and dates, chosen values or a pattern otherwise. With Exclude, the matching objects are removed instead. Object types without the attribute are left untouched.",
  Panel: AttributePanel("objects") as FilterPanel<"object_attribute">,
  create: () => ({ type: "object_attribute", attribute: "" }),
  summary,
  isComplete: (filter) => filter.attribute !== "",
};
