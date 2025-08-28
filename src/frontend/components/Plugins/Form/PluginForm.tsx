import Form from "@rjsf/mantine";
import validator from "@rjsf/validator-ajv8";
import { useMemo } from "react";
import { Control, Controller } from "react-hook-form";
import { PluginInputType } from ".";
import { getComputedSelect } from "./Fields/custom";
import { UiSchema } from "@rjsf/utils";
import { wrapFieldsWithContext } from "./Fields/ocel";

type PluginFormProps = {
  schema: { [key: string]: any };
  control: Control<PluginInputType>;
  onSubmit: () => void;
  pluginId: string;
  methodName: string;
};

export function buildOcelUiSchema(
  schema: { [key: string]: unknown },
  ui: UiSchema = {},
  path: string[] = [],
): UiSchema {
  if (!schema || typeof schema !== "object") return ui;

  if (schema.type === "object" && schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const fullPath = [...path, key];
      const field = value;

      const meta = (field as any)["x-ui-meta"];

      if (meta && meta.type) {
        let pointer = ui;
        for (let i = 0; i < fullPath.length - 1; i++) {
          pointer[fullPath[i]] = pointer[fullPath[i]] || {};
          pointer = pointer[fullPath[i]] as UiSchema;
        }
        pointer[fullPath.at(-1)!] = {
          "ui:field": meta.field_type ?? meta.type,
        };
      }

      if (field.type === "object") {
        buildOcelUiSchema(field, ui, fullPath);
      }

      if (field.type === "array" && field.items) {
        buildOcelUiSchema(field.items, ui, [...fullPath, "items"]);
      }
    }
  }

  return ui;
}
const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  control,
  pluginId,
  methodName,
  onSubmit,
}) => {
  const uiSchema = useMemo(() => {
    return buildOcelUiSchema(schema, {}, []);
  }, [schema]);

  const fields = useMemo(() => wrapFieldsWithContext(control), [control]);

  const computedFields = useMemo(
    () => getComputedSelect({ methodName, pluginId, control }),
    [methodName, pluginId],
  );

  return (
    <Controller
      control={control}
      name="input"
      render={({ field }) => (
        <>
          <Form
            schema={{ ...schema, title: "" }}
            formData={field.value}
            validator={validator}
            uiSchema={uiSchema}
            fields={{ ...fields, ...computedFields }}
            onChange={(data) => {
              field.onChange(data.formData);
            }}
            onSubmit={onSubmit}
          />
        </>
      )}
    />
  );
};

export default PluginForm;
