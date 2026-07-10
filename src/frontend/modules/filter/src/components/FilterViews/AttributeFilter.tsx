import { AttributesTable } from "@ocelescope/core";
import { useAttributeFilter } from "../../hooks/useAttributeFilterColumns";
import type { FilterView, FilterViewType } from "../../types/filter";

const AttributeFilter: (
  entityType: "objects" | "events",
) => FilterView<"event_attribute" | "object_attribute"> =
  (entityType) =>
  ({ ocelId, control }) => {
    const { filterColumns, visibleAttributes } = useAttributeFilter({
      control,
      path: entityType === "events" ? "event_attribute" : "object_attribute",
    });

    return (
      <AttributesTable
        ocelId={ocelId}
        entityType={entityType}
        ocelVersion={"original"}
        extraColumns={filterColumns}
        subTableExtraColumns={filterColumns}
        visibleAttributes={visibleAttributes}
        hideRange
        hideValues
      />
    );
  };

export const EventAttributeFilter: FilterViewType<"event_attribute"> = {
  title: "Event Attribute",
  description:
    "Filters events by the values of their attributes. For each attribute you can define a condition (e.g. a value range or an allowed set of values), and only events whose attribute values satisfy every condition are kept. Attributes without a condition are ignored.",
  ViewComponent: AttributeFilter("events"),
  generateDefault: () => [],
};

export const ObjectAttributeFilter: FilterViewType<"object_attribute"> = {
  title: "Object Attribute",
  description:
    "Filters objects by the values of their attributes. For each attribute you can define a condition (e.g. a value range or an allowed set of values), and only objects whose attribute values satisfy every condition are kept. Attributes without a condition are ignored.",
  ViewComponent: AttributeFilter("objects"),
  generateDefault: () => [],
};
