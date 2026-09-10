import validator from "@rjsf/validator-ajv8";
import { useMemo } from "react";
import { PluginFormProvider } from "./context";
import CustomSchemaField from "./Fields";
import { Form } from "./MantineForm";
import type { PluginFormData, PluginInputResources } from "./types";

export type PluginFormProps = {
  schema: { [key: string]: any };
  value: PluginFormData;
  onChange: (value: PluginFormData) => void;
  onSubmit?: () => void;
  pluginId: string;
  methodName: string;
  inputResources?: PluginInputResources;
};

const FIELDS = { SchemaField: CustomSchemaField };

const EMPTY_RESOURCES: PluginInputResources = {};

const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  value,
  onChange,
  onSubmit,
  pluginId,
  methodName,
  inputResources = EMPTY_RESOURCES,
}) => {
  const formSchema = useMemo(() => ({ ...schema, title: "" }), [schema]);

  return (
    <PluginFormProvider
      pluginId={pluginId}
      methodName={methodName}
      inputResources={inputResources}
      configuration={value}
    >
      <Form
        schema={formSchema}
        formData={value}
        validator={validator}
        fields={FIELDS}
        onChange={({ formData }) => onChange(formData)}
        onSubmit={onSubmit}
      />
    </PluginFormProvider>
  );
};

export default PluginForm;
