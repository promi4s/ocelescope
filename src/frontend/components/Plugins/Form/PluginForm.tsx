import Form from "@rjsf/mantine";
import validator from "@rjsf/validator-ajv8";
import { useEffect, useMemo, useState } from "react";
import { type Control, Controller } from "react-hook-form";
import type { PluginInputType } from ".";
import { getComputedSelect } from "./Fields/custom";
import type { UiSchema } from "@rjsf/utils";
import { wrapFieldsWithContext } from "./Fields/ocel";
import traverse from "json-schema-traverse";
import RefParser from "@apidevtools/json-schema-ref-parser";
import { unflatten } from "flat";

type PluginFormProps = {
  schema: { [key: string]: any };
  control: Control<PluginInputType>;
  onSubmit: () => void;
  pluginId: string;
  methodName: string;
};

export const buildUiSchemaV2 = async ({
  schema,
}: { schema: { [key: string]: unknown } }) => {
  const deref = await RefParser.dereference(schema as any, {
    dereference: { circular: "ignore" },
  });

  const uiSchema: UiSchema = {};

  traverse(deref, {
    allKeys: true,
    cb: (subschema, pointer) => {
      const pointerComponents = pointer.split("/").slice(1);

      //so only the root is getting skipped
      if (pointerComponents[0] !== "properties") return;

      if (
        pointerComponents[0] === "properties" &&
        pointerComponents.at(-1) === "x-ui-meta"
      ) {
        const path = pointerComponents
          .filter(
            (pathComponent) =>
              !["x-ui-meta", "properties"].includes(pathComponent),
          )
          .join(".");

        uiSchema[path] = {
          "ui:field": subschema.field_type ?? subschema.type,
        };
      }
    },
  });

  return unflatten(uiSchema);
};

const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  control,
  pluginId,
  methodName,
  onSubmit,
}) => {
  const [uiSchema, setUiSchema] = useState<UiSchema | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ui = await buildUiSchemaV2({ schema });
      if (!cancelled) setUiSchema(ui as UiSchema);
    })();

    return () => {
      cancelled = true;
    };
  }, [schema]);

  const fields = useMemo(() => wrapFieldsWithContext(control), [control]);

  const computedFields = useMemo(
    () => getComputedSelect({ methodName, pluginId, control }),
    [methodName, pluginId, control],
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
