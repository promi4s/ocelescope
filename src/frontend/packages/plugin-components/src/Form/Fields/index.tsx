import { getDefaultRegistry } from "@rjsf/core";
import type { FieldProps } from "@rjsf/utils";
import type { ComponentType } from "react";
import { CodeField } from "./CodeField";
import { ComputedSelect } from "./ComputedSelect";
import { EnumMultiSelect, isStringEnumArray } from "./EnumMultiSelect";
import { OCELField } from "./OCELField";
import { SliderField } from "./SliderField";

const DefaultSchemaField = getDefaultRegistry().fields.SchemaField!;

const CUSTOM_FORM_MAP: Record<string, ComponentType<FieldProps>> = {
  ocel: OCELField,
  computed_select: ComputedSelect,
  code: CodeField,
  slider: SliderField,
};

const resolveField = ({
  schema,
  registry,
}: FieldProps): ComponentType<FieldProps> | undefined => {
  const uiType = schema["x-ui-meta"]?.type;

  if (uiType) {
    return CUSTOM_FORM_MAP[uiType];
  }

  if (isStringEnumArray(schema, registry)) {
    return EnumMultiSelect;
  }

  return undefined;
};

const CustomSchemaField: React.FC<FieldProps> = (props) => {
  const FormComponent = resolveField(props);

  return FormComponent ? (
    <FormComponent {...props} />
  ) : (
    <DefaultSchemaField {...props} />
  );
};

export default CustomSchemaField;
