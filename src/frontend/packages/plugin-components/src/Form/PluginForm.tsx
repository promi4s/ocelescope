import type RJSFForm from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { useMemo, type ComponentProps, type Ref } from "react";
import { PluginFormProvider } from "./context";
import CustomSchemaField from "./Fields";
import { Form } from "./MantineForm";
import type { PluginInputResources } from "../types";

export type PluginFormProps = {
  pluginId: string;
  methodName: string;
  inputResources?: PluginInputResources;
  ref?: Ref<RJSFForm>;
} & Omit<ComponentProps<typeof Form>, "validator" | "formRef">;

const FIELDS = { SchemaField: CustomSchemaField };

const EMPTY_RESOURCES: PluginInputResources = {};

const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  pluginId,
  methodName,
  inputResources = EMPTY_RESOURCES,
  formData,
  ref,
  ...formProps
}) => {
  const formSchema = useMemo(() => ({ ...schema, title: "" }), [schema]);

  return (
    <PluginFormProvider
      pluginId={pluginId}
      methodName={methodName}
      inputResources={inputResources}
      configuration={formData}
    >
      <Form
        schema={formSchema}
        validator={validator}
        fields={FIELDS}
        formData={formData}
        formRef={ref}
        {...formProps}
      />
    </PluginFormProvider>
  );
};

export default PluginForm;
