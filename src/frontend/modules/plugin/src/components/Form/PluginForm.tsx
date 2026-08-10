import validator from "@rjsf/validator-ajv8";
import { useMemo } from "react";
import { type Control, Controller } from "react-hook-form";
import type { PluginInputType } from ".";
import { Form } from "./MantineForm";
import { PluginFormProvider } from "./PluginFormContext";
import CustomSchemaField from "./Fields";

type PluginFormProps = {
  schema: { [key: string]: any };
  control: Control<PluginInputType>;
  onSubmit: () => void;
  pluginId: string;
  methodName: string;
};

const FIELDS = { SchemaField: CustomSchemaField };

const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  control,
  pluginId,
  methodName,
  onSubmit,
}) => {
  const formSchema = useMemo(() => ({ ...schema, title: "" }), [schema]);

  return (
    <PluginFormProvider
      control={control}
      pluginId={pluginId}
      methodName={methodName}
    >
      <Controller
        control={control}
        name="input"
        render={({ field }) => (
          <Form
            schema={formSchema}
            formData={field.value}
            validator={validator}
            fields={FIELDS}
            onChange={({ formData }) => field.onChange(formData)}
            onSubmit={onSubmit}
          />
        )}
      />
    </PluginFormProvider>
  );
};

export default PluginForm;
