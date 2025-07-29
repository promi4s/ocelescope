import { useEventCounts, useObjectCount } from "@/api/fastapi/ocels/ocels";
import { Box, MultiSelect, Select } from "@mantine/core";
import { FieldProps, UiSchema } from "@rjsf/utils";

type OcelFieldProps = {
  value: any;
  isMulti: boolean;
  onChange: (data: any) => void;
  ocelId: string;
  label?: string;
  description?: string;
  requiered?: boolean;
};

// TODO: Merge EventType and ObjectTypeSelector
const EventTypeSelector: React.FC<OcelFieldProps> = ({
  ocelId,
  onChange,
  requiered,
  value,
  isMulti,
  label,
  description,
}) => {
  const { data = {} } = useEventCounts({ ocel_id: ocelId });
  const SelectComponent = isMulti ? MultiSelect : Select;

  return (
    <Box>
      <SelectComponent
        value={value}
        label={label}
        required={requiered}
        clearable
        description={description}
        onChange={onChange}
        data={Object.keys(data)}
      />
    </Box>
  );
};

const ObjectTypeSelector: React.FC<OcelFieldProps> = ({
  ocelId,
  onChange,
  requiered,
  value,
  isMulti,
  label,
  description,
}) => {
  const { data = {} } = useObjectCount({ ocel_id: ocelId });
  const SelectComponent = isMulti ? MultiSelect : Select;

  return (
    <Box>
      <SelectComponent
        value={value}
        label={label}
        required={requiered}
        clearable
        description={description}
        onChange={onChange}
        data={Object.keys(data)}
      />
    </Box>
  );
};

const ocelFieldMap: Record<string, React.FC<OcelFieldProps>> = {
  event_type: EventTypeSelector,
  object_type: ObjectTypeSelector,
};

export const wrapFieldsWithContext = (
  ocelContext: Record<string, string>,
  fields: Record<string, React.FC<OcelFieldProps>>,
) => {
  return Object.fromEntries(
    Object.entries(fields).map(([name, Field]) => [
      name,
      ({
        schema,
        required,
        title,
        formData,
        onChange,
        ...props
      }: FieldProps) => {
        const ocelRef = schema?.["x-ui-meta"]?.ocel_id;
        const isMulti = schema?.type === "array";

        const label = schema?.title;
        const description = schema?.description;

        const ocelId = ocelContext[ocelRef];
        return (
          <Field
            label={label}
            requiered={required}
            description={description}
            isMulti={isMulti}
            onChange={onChange}
            value={formData}
            ocelId={ocelId}
          />
        );
      },
    ]),
  );
};

export function buildOcelUiSchema(
  schema: { [key: string]: unknown },
  ui: UiSchema = {},
  path: string[] = [],
  fields: Record<string, React.FC<any>> = {},
): UiSchema {
  if (!schema || typeof schema !== "object") return ui;

  if (schema.type === "object" && schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const fullPath = [...path, key];
      const field = value;

      const meta = (field as any)["x-ui-meta"];

      if (meta && meta.type === "ocel" && meta.field_type in ocelFieldMap) {
        // Build uiSchema path
        let pointer = ui;
        for (let i = 0; i < fullPath.length - 1; i++) {
          pointer[fullPath[i]] = pointer[fullPath[i]] || {};
          pointer = pointer[fullPath[i]] as UiSchema;
        }
        pointer[fullPath.at(-1)!] = { "ui:field": meta.field_type };

        // Register the custom component
        fields[meta.field_type] = ocelFieldMap[meta.field_type];
      }

      if (field.type === "object") {
        buildOcelUiSchema(field, ui, fullPath, fields);
      }

      if (field.type === "array" && field.items) {
        buildOcelUiSchema(field.items, ui, [...fullPath, "items"], fields);
      }
    }
  }

  return ui;
}
