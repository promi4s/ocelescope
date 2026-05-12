import type { ValueType } from "@ocelescope/api-base";
import { formatTime } from "./dayjs";

export const formatAttributeValue = (
  type: ValueType,
  value: string | number,
) => {
  switch (type) {
    case "int":
      return value.toLocaleString("en-US");
    case "float":
      return value.toLocaleString("en-US");
    case "date":
      return formatTime(value as string);
    default:
      return value;
  }
};
