import type { AttributeSummary } from "@ocelescope/api-base";
import { viewParams } from "@ocelescope/core";
import dayjs from "../../util/dayjs";
import type { AttributeScope } from "./types";

export const scopeParams = ({
  viewId,
  attribute,
  entityNames,
}: Omit<AttributeScope, "ocelId">) => ({
  ...viewParams(viewId),
  attribute,
  entity_names: entityNames && entityNames.length > 0 ? entityNames : undefined,
});

const DATE_FORMAT = "YYYY-MM-DD HH:mm";

export const formatValue = (
  value: string | number | null,
  type: AttributeSummary["type"],
) => {
  if (value === null) {
    return "–";
  }
  if (type === "date") {
    return dayjs(value).format(DATE_FORMAT);
  }
  if (type === "float" && typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return `${value}`;
};
