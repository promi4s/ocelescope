import Form from "@aokiapp/rjsf-mantine-theme";
import { Box, Button, Group } from "@mantine/core";
import validator from "@rjsf/validator-ajv8";
import { useMemo } from "react";
import { buildOcelUiSchema, wrapFieldsWithContext } from "./Fields";

type PluginFormProps = {
  schema: { [key: string]: any };
  ocelContext: Record<string, string>;
  onSubmit: (formData: any) => void;
};

const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  ocelContext,
  onSubmit,
}) => {
  const rawFields: Record<string, React.FC<any>> = {};
  const uiSchema = buildOcelUiSchema(schema, {}, [], rawFields);
  const fields = wrapFieldsWithContext(ocelContext, rawFields);
  const ocelResetKey = useMemo(
    () => JSON.stringify(ocelContext),
    [ocelContext],
  );
  return (
    <Form
      schema={schema}
      validator={validator}
      uiSchema={uiSchema}
      fields={fields}
      key={ocelResetKey}
      onSubmit={({ formData }) => onSubmit(formData)}
      templates={{
        ButtonTemplates: {
          SubmitButton: () => (
            <Group align="center" justify="center">
              <Button type="submit" color="green">
                Run
              </Button>
            </Group>
          ),
        },
        ObjectFieldTemplate: ({ properties, description }) => (
          <Box style={{ padding: 0, border: "none" }}>
            {description && <p>{description}</p>}
            {properties.map((prop) => (
              <Box key={prop.name} mb="sm">
                {prop.content}
              </Box>
            ))}
          </Box>
        ),
      }}
    />
  );
};

export default PluginForm;
