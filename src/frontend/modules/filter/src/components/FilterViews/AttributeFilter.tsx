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
  ViewComponent: AttributeFilter("events"),
  generateDefault: () => [],
};

export const ObjectAttributeFilter: FilterViewType<"object_attribute"> = {
  title: "Object Attribute",
  ViewComponent: AttributeFilter("objects"),
  generateDefault: () => [],
};
