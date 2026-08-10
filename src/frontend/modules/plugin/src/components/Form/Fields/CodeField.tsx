import { Box, Input, Skeleton, useComputedColorScheme } from "@mantine/core";
import Editor from "@monaco-editor/react";
import type { FieldProps } from "@rjsf/utils";
import { memo, useMemo } from "react";

const EDITOR_HEIGHT = 160;

const OPTIONS = {
  minimap: { enabled: false },
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: "off",
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  scrollbar: { alwaysConsumeMouseWheel: false },
  wordWrap: "on",
  tabSize: 2,
  fontSize: 13,
  padding: { top: 8, bottom: 8 },
} as const;

export const CodeField = memo(
  ({
    schema,
    required,
    formData,
    onChange,
    rawErrors,
    disabled,
    readonly,
    fieldPathId: { path },
  }: FieldProps) => {
    const meta = schema["x-ui-meta"] as { language?: string } | undefined;

    const colorScheme = useComputedColorScheme("light", {
      getInitialValueInEffect: true,
    });

    const readOnly = disabled || readonly;
    const options = useMemo(() => ({ ...OPTIONS, readOnly }), [readOnly]);

    return (
      <Input.Wrapper
        label={schema.title}
        description={schema.description}
        required={required}
        error={rawErrors?.[0]}
      >
        <Box
          style={{
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: "var(--mantine-radius-default)",
            overflow: "hidden",
          }}
        >
          <Editor
            height={EDITOR_HEIGHT}
            language={meta?.language ?? "plaintext"}
            value={formData ?? ""}
            theme={colorScheme === "dark" ? "vs-dark" : "light"}
            options={options}
            onChange={(value) => onChange(value ?? "", path)}
            loading={<Skeleton height={EDITOR_HEIGHT} radius={0} />}
          />
        </Box>
      </Input.Wrapper>
    );
  },
);
