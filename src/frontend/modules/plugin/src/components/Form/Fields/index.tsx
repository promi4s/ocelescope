import { getDefaultRegistry } from "@rjsf/core";
import type { FieldProps } from "@rjsf/utils";
import type { ComponentType } from "react";
import { OCELField } from "./ocel";

const DefaultSchemaField = getDefaultRegistry().fields.SchemaField!;

const CUSTOM_FORM_MAP: Record<string, ComponentType<FieldProps>> = {
  ocel: OCELField,
};

const CustomSchemaField: React.FC<FieldProps> = (props) => {
  const uiType = props.schema["x-ui-meta"]?.type;

  const FormComponent = uiType ? CUSTOM_FORM_MAP[uiType] : undefined;

  return FormComponent ? (
    <FormComponent {...props} />
  ) : (
    <DefaultSchemaField {...props} />
  );
};

export default CustomSchemaField;
