import { TextInput } from "@mantine/core";
import type { AnnotationElementType } from "../AnnotationSection/types";
import OcelIdSelect from "./OcelIdSelect";
import OcelTypeSelect from "./OcelTypeSelect";

type Props = {
  ocelId: string;
  elementType?: AnnotationElementType;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  isMulti?: boolean;
  label?: string;
};

const AnnotationElementRefInput: React.FC<Props> = ({
  ocelId,
  elementType,
  value,
  onChange,
  isMulti = false,
  label = "Element",
}) => {
  switch (elementType) {
    case "event":
      return (
        <OcelIdSelect
          ocelId={ocelId}
          entityType="event"
          value={value}
          onChange={onChange}
          isMulti={isMulti}
          label={label}
        />
      );

    case "object":
      return (
        <OcelIdSelect
          ocelId={ocelId}
          entityType="object"
          value={value}
          onChange={onChange}
          isMulti={isMulti}
          label={label}
        />
      );

    case "activity":
      return (
        <OcelTypeSelect
          ocelId={ocelId}
          entityType="activity"
          value={value}
          onChange={onChange}
          isMulti={isMulti}
          label={label}
        />
      );

    case "object_type":
      return (
        <OcelTypeSelect
          ocelId={ocelId}
          entityType="object_type"
          value={value}
          onChange={onChange}
          isMulti={isMulti}
          label={label}
        />
      );

    case "item_type":
      return (
        <OcelTypeSelect
          ocelId={ocelId}
          entityType="item_type"
          value={value}
          onChange={onChange}
          isMulti={isMulti}
          label={label}
        />
      );
    default:
      return (
        <TextInput
          label={label}
          value={typeof value === "string" ? value : value.join(", ")}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="Enter element reference"
        />
      );
  }
};

export default AnnotationElementRefInput;
