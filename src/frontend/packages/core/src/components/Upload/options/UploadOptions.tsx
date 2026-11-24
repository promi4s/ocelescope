import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { findUploadOption } from "./configs";
import type { UploadExtras } from "./types";

const formatSize = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const UploadOptions = ({
  files,
  onUpload,
  onCancel,
}: {
  files: File[];
  onUpload: (files: File[], extras: Record<string, UploadExtras>) => void;
  onCancel: () => void;
}) => {
  const [extras, setExtras] = useState<Record<string, UploadExtras>>({});

  return (
    <Stack gap="md">
      {files.flatMap((file) => {
        const option = findUploadOption(file);
        if (!option) return [];
        return [
          <Paper key={file.name} withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" radius="md" size="lg">
                  <FileTextIcon size={18} />
                </ThemeIcon>
                <Text fw={600} truncate style={{ flex: 1 }}>
                  {file.name}
                </Text>
                <Badge variant="light" color="gray">
                  {formatSize(file.size)}
                </Badge>
              </Group>
              <Divider />
              <option.input
                file={file}
                value={extras[file.name] ?? {}}
                onChange={(next) =>
                  setExtras((current) => ({ ...current, [file.name]: next }))
                }
              />
            </Stack>
          </Paper>,
        ];
      })}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onUpload(files, extras)}>Upload</Button>
      </Group>
    </Stack>
  );
};
