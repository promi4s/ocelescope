import { Loader, Select, Stack, TextInput } from "@mantine/core";
import { BoxIcon, TagIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { UploadOption } from "../../types";
import { readXesCaseAttributes } from "./readXesCaseAttributes";

const useCaseAttributes = (file: File) => {
  const [attributes, setAttributes] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    setAttributes(null);
    readXesCaseAttributes(file)
      .catch(() => [])
      .then((keys) => {
        if (active) setAttributes(keys);
      });
    return () => {
      active = false;
    };
  }, [file]);

  return attributes;
};

const XesInput: UploadOption["input"] = ({ file, value, onChange }) => {
  const attributes = useCaseAttributes(file);
  const isLoading = attributes === null;

  return (
    <Stack gap="sm">
      <Select
        label="Case attribute"
        description="Each trace's value of this attribute becomes its object type"
        leftSection={<TagIcon size={16} />}
        rightSection={isLoading ? <Loader size="xs" /> : undefined}
        placeholder={
          isLoading
            ? "Reading attributes…"
            : attributes.length > 0
              ? "None"
              : "No case attributes found"
        }
        data={attributes ?? []}
        disabled={isLoading || attributes.length === 0}
        value={value.type_attribute ?? null}
        onChange={(typeAttribute) => {
          const { type_attribute: _, ...rest } = value;
          onChange(
            typeAttribute ? { ...rest, type_attribute: typeAttribute } : rest,
          );
        }}
        searchable
        clearable
      />
      <TextInput
        label="Object type"
        description="Used for every trace, or for traces without the attribute"
        leftSection={<BoxIcon size={16} />}
        placeholder="Case"
        value={value.object_type ?? ""}
        onChange={(event) =>
          onChange({ ...value, object_type: event.currentTarget.value })
        }
      />
    </Stack>
  );
};

export const xesUploadOption: UploadOption = {
  fileExtension: ["xes", "xes.gz"],
  input: XesInput,
};
