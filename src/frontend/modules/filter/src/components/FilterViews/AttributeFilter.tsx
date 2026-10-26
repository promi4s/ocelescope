import { AttributesTable } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import {
  usePreviewAggregatedAttributes,
  usePreviewTypedAttributes,
} from "../../api/base";
import { useAttributeFilter } from "../../hooks/useAttributeFilterColumns";
import type { FilterKind, FilterOf, FilterPanel } from "../../types/filter";
import dayjs from "../../util/dayjs";
import Previewed from "./Previewed";

// every attribute in one page: the table pages them itself
const ALL = 100_000;

type AttributeKey = "event_attribute" | "object_attribute";

const AttributePanel: (
  entityType: "objects" | "events",
) => FilterPanel<AttributeKey> =
  (entityType) =>
  ({ ocelId, filter, onChange, before }) => {
    const { filterColumns, visibleAttributes } = useAttributeFilter({
      filter,
      onChange,
    });
    const options = { query: { placeholderData: keepPreviousData } };
    const aggregated = usePreviewAggregatedAttributes(
      ocelId,
      before,
      { entity_type: entityType, page_size: ALL },
      options,
    );
    const typed = usePreviewTypedAttributes(
      ocelId,
      before,
      { entity_type: entityType },
      options,
    );
    const both = {
      data:
        aggregated.data && typed.data
          ? { attributes: aggregated.data.response, typed: typed.data }
          : undefined,
      isPending: aggregated.isPending || typed.isPending,
      error: aggregated.error ?? typed.error,
    };

    return (
      <Previewed query={both}>
        {(data) => (
          <AttributesTable
            ocelId={ocelId}
            entityType={entityType}
            data={data}
            extraColumns={filterColumns}
            subTableExtraColumns={filterColumns}
            visibleAttributes={visibleAttributes}
            hideRange
            hideValues
          />
        )}
      </Previewed>
    );
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
    return `in ${filter.values.join(", ")}`;
  }
  return "any value";
};

const summary = (filter: FilterOf<AttributeKey>) => {
  if (!filter.attribute) {
    return "No attribute selected";
  }
  const scope = filter.target_type ? ` (${filter.target_type})` : "";
  return `${filter.attribute}${scope}: ${condition(filter)}`;
};

export const EventAttributeFilter: FilterKind<"event_attribute"> = {
  title: "Event Attribute",
  description:
    "Keeps the events whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition. Activities without the attribute are left untouched.",
  Panel: AttributePanel("events") as FilterPanel<"event_attribute">,
  create: () => ({ type: "event_attribute", attribute: "" }),
  summary,
  isComplete: (filter) => filter.attribute !== "",
};

export const ObjectAttributeFilter: FilterKind<"object_attribute"> = {
  title: "Object Attribute",
  description:
    "Keeps the objects whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition. Object types without the attribute are left untouched.",
  Panel: AttributePanel("objects") as FilterPanel<"object_attribute">,
  create: () => ({ type: "object_attribute", attribute: "" }),
  summary,
  isComplete: (filter) => filter.attribute !== "",
};
