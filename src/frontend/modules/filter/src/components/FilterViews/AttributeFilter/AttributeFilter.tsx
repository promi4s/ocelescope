import { useEventAttributes, useObjectAttributes } from "@ocelescope/api-base";
import type { StepKind, StepPanel } from "@ocelescope/core";
import { AttributesTable, viewParams, viewProps } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import type {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "../../../api/base";
import { useAttributeFilter } from "../../../hooks/useAttributeFilterColumns";
import dayjs from "../../../util/dayjs";
import AttributeDetail from "./AttributeDetail";
import type { AttributeFilter } from "./util";

const AttributePanel: (
  entityType: "objects" | "events",
) => StepPanel<AttributeFilter> = (entityType) => {
  const useTypedAttributes =
    entityType === "events" ? useEventAttributes : useObjectAttributes;
  return ({ ocelId, viewId, step: filter, onChange }) => {
    const { filterColumns } = useAttributeFilter({ filter, onChange });
    const typed = useTypedAttributes(ocelId, viewParams(viewId), {
      query: { placeholderData: keepPreviousData },
    });
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
          viewId={viewId}
          scopes={scopes}
          onClear={() => onChange({ type: filter.type, attribute: "" })}
        />
      );
    }

    return (
      <AttributesTable
        ocelId={ocelId}
        entityType={entityType}
        {...viewProps(viewId)}
        extraColumns={filterColumns}
        subTableExtraColumns={filterColumns}
        hideRange
        hideValues
      />
    );
  };
};

const condition = (filter: AttributeFilter) => {
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

const summary = (filter: AttributeFilter) => {
  if (!filter.attribute) {
    return "No attribute selected";
  }
  const scope = filter.target_type ? ` (${filter.target_type})` : "";
  const negation = filter.mode === "exclude" ? "not " : "";
  return `${filter.attribute}${scope}: ${negation}${condition(filter)}`;
};

const validate = (filter: AttributeFilter) =>
  filter.attribute ? {} : { attribute: "Pick an attribute" };

export const eventAttributeKind: StepKind<EventAttributeFilter> = {
  title: "Event Attribute",
  description:
    "Keeps the events whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition on its value distribution: a range for numbers and dates, chosen values or a pattern otherwise. With Exclude, the matching events are removed instead. Activities without the attribute are left untouched.",
  Panel: AttributePanel("events") as StepPanel<EventAttributeFilter>,
  create: () => ({ type: "event_attribute", attribute: "" }),
  summary,
  validate,
};

export const objectAttributeKind: StepKind<ObjectAttributeFilter> = {
  title: "Object Attribute",
  description:
    "Keeps the objects whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition on its value distribution: a range for numbers and dates, chosen values or a pattern otherwise. With Exclude, the matching objects are removed instead. Object types without the attribute are left untouched.",
  Panel: AttributePanel("objects") as StepPanel<ObjectAttributeFilter>,
  create: () => ({ type: "object_attribute", attribute: "" }),
  summary,
  validate,
};
